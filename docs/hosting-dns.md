# Moving the family domain to Cloudflare

Runbook for moving `<family-domain>` off Squarespace (inherited from Google Domains) entirely: DNS, email forwarding, and registration all go to Cloudflare, and the Squarespace domain service is closed at the end. Cloudflare Tunnel needs it, because a tunnel can only publish hostnames in a zone that Cloudflare serves. That tunnel is what gives family devices public HTTPS to the app without opening any ports through the double NAT ([#12](https://github.com/kevinmcdaniel/vinylTrack/issues/12), [#59](https://github.com/kevinmcdaniel/vinylTrack/issues/59)).

The domain name is deliberately left out of this doc, because the repo is public. Substitute it where you see `<family-domain>`.

There are two separate moves, and they happen in this order:

1. **DNS** (the nameservers point at Cloudflare). This is required. It's quick and easy to reverse.
2. **Registration** (Squarespace → Cloudflare Registrar). This takes about 5 days, is priced at cost, and can happen only after step 1 is live. Once it's done, rolling back means another transfer, so finish verifying step 1 first.

The two steps are separate because Cloudflare won't accept the transfer until the zone is already active on its nameservers.

## What can break

The domain already does more than vinylTrack. Anything that currently resolves through Squarespace DNS stops working the moment the nameservers change, **unless the same record already exists in Cloudflare.** Squarespace's DNS settings are ignored entirely once custom nameservers are in use.

The records most likely to be in use:

| What | Records | If missed |
| --- | --- | --- |
| Google Workspace / Gmail on the domain | `MX` (Google), `TXT` SPF, `TXT` DKIM (`google._domainkey`), `TXT` DMARC (`_dmarc`) | Mail bounces or lands in spam |
| Squarespace email forwarding (the old Google Domains free forwarding, which Squarespace runs on Mailgun) | 2 `MX` + 2 `TXT`, specific to this domain, shown in Squarespace's forwarding panel | Forwarded addresses silently stop delivering |
| Google site / Search Console verification | `TXT google-site-verification=…` | Loses verified-domain status, which the GCP OAuth consent screen's authorized domains rely on |
| A website (Squarespace site, or `www` elsewhere) | `A` / `CNAME` on `@` and `www` | Site goes down |
| Anything else: a subdomain for another app, old dynamic DNS, and so on | whatever is there | whatever it served |

**Email forwarding is the one to watch.** It keeps working under custom nameservers, but only if its MX/TXT records are copied into Cloudflare. Squarespace shows an *Action required* banner with the exact records once the switch is made. **Plan: replace it with Cloudflare Email Routing** (free, does the same job natively), because Squarespace forwarding won't survive the registration transfer. Set up the same forwarding addresses in Email Routing during Step 1. Email Routing adds its own MX/TXT records, so **don't** also copy Squarespace's Mailgun MX records; the two would compete on MX.

## Step 0: inventory (do this before touching anything)

1. Squarespace → **Domains** → `<family-domain>` → **DNS** → **DNS settings**. Screenshot or copy **every** record: custom records, preset records (Google Workspace, Squarespace defaults), and the email forwarding section.
2. Note whether **DNSSEC** is on (**Domains** → `<family-domain>` → **DNS** → **DNSSEC**).
3. Note the current nameservers, so there's a known state to roll back to.
4. From a terminal, capture what the world currently sees:

   ```bash
   for t in A AAAA CNAME MX TXT NS CAA; do echo "== $t"; dig +short <family-domain> $t; done
   dig +short www.<family-domain> CNAME
   dig +short _dmarc.<family-domain> TXT
   dig +short google._domainkey.<family-domain> TXT
   ```

   Keep this output. Step 3 compares against it.

## Step 1: set up the zone in Cloudflare (no effect on live traffic yet)

1. Create a Cloudflare account (free plan) and **Add a domain** → `<family-domain>` → Free plan.
2. Cloudflare scans for existing records and imports what it finds. **The scan is best-effort.** Check it against the Step 0 inventory line by line, and add anything missing by hand, especially DKIM, DMARC, and the verification TXT records.
3. Set every imported record to **DNS only** (grey cloud) for now. That reproduces today's behavior exactly. `MX` records can't be proxied anyway. Proxying (orange cloud) can come later, one record at a time.
4. **Email** → **Email Routing**: recreate every forwarding address from the Step 0 inventory, and let it add its MX/TXT records. Delete any Squarespace/Mailgun MX records the scan imported.
5. Note the two assigned nameservers (`<name>.ns.cloudflare.com`).

Until the nameservers change, nothing in Cloudflare is live, so this step can be redone as often as needed.

## Step 2: switch nameservers

1. **If DNSSEC is on at Squarespace, turn it off first** and wait 24 hours. A stale DS record pointing at Squarespace's keys makes validating resolvers treat the domain as broken, which means *total* resolution failure for part of the internet. Squarespace also disables DNSSEC automatically when custom nameservers are set, but doing it yourself ahead of time avoids the gap.
2. Optionally, lower the TTLs on critical records at Squarespace a day ahead, so any mistake clears quickly.
3. Squarespace → **Domains** → `<family-domain>` → **DNS** → **Domain nameservers** → **Use custom nameservers** → enter both Cloudflare nameservers and remove the Squarespace ones.
4. Wait for Cloudflare to email that the zone is **Active**. That's usually within an hour, occasionally up to 24–48 hours.

## Step 3: verify

```bash
dig +short NS <family-domain>          # both *.ns.cloudflare.com
```

Re-run the Step 0 `dig` loop and diff it against the saved output. Everything except `NS` should match.

Then check each thing by actually using it:
- Send mail **to** the domain from an outside account, both to a real mailbox and to each forwarded address.
- Send mail **from** the domain to a Gmail account. Check **Show original** → SPF / DKIM / DMARC all `PASS`.
- Load the website, if there is one.
- GCP console (`vinyltrack-503118`) → OAuth consent screen: the authorized domain still shows as verified.

## Step 4: re-enable DNSSEC

Cloudflare → `<family-domain>` → **DNS** → **Settings** → **Enable DNSSEC**. Cloudflare shows a DS record. Add it at Squarespace (**DNSSEC** → add DS record: key tag, algorithm, digest type, digest). Or leave DNSSEC off until the transfer finishes, since Cloudflare Registrar then sets DS automatically. That's the simpler path when the transfer follows soon after.

## Step 5: publish the app hostname

This is part of [#59](https://github.com/kevinmcdaniel/vinylTrack/issues/59) and gated on real auth ([#11](https://github.com/kevinmcdaniel/vinylTrack/issues/11)). The DNS move itself doesn't publish anything.

`cloudflared tunnel route dns <tunnel> vinyl.<family-domain>` creates a proxied `CNAME` → `<tunnel-id>.cfargotunnel.com`. It's the only record that *has* to be proxied. Then add `https://vinyl.<family-domain>` to the Google OAuth redirect URIs and the Turnstile widget's hostnames.

## Step 6: transfer registration to Cloudflare Registrar

This doesn't depend on Step 5. It can go ahead as soon as Step 3 checks out.

Prerequisites, from Cloudflare's rules:
- The zone is **Active** on Cloudflare (Step 2 done).
- The domain was registered, or last transferred, more than 60 days ago.
- Registrant name, organization, and email haven't changed in the last 60 days. Changing them starts a 60-day lock, so **don't** tidy up the contact details right before transferring.
- The TLD is supported by Cloudflare Registrar. Check before starting.

Steps:
1. Squarespace: turn off the domain lock, and request the **authorization (EPP) code**.
2. Cloudflare → **Domain Registration** → **Transfer Domains** → select the domain → enter the code → confirm the contact details and pay. The price is at cost, and most gTLDs get a one-year extension included.
3. Approve the transfer in the email from Squarespace, if one arrives. Otherwise it completes by itself in about 5 days.
4. Afterwards, confirm DNSSEC is on in Cloudflare, and that auto-renew is on.

**Don't start until email forwarding runs on Cloudflare Email Routing** and has been tested (Step 3). Squarespace forwarding is a feature of a Squarespace-registered domain, so expect it to go away with the transfer.

## Step 7: close out Squarespace

1. Confirm Cloudflare shows the domain under **Domain Registration** with the new expiry date, and turn on **auto-renew**.
2. Confirm DNSSEC is on (Cloudflare → **DNS** → **Settings**) and `dig +short DS <family-domain>` returns a record.
3. Check the Squarespace account: the domain should have left it. Turn off anything still set to renew or bill, and close the account if nothing else lives there.

## Rollback

Before Step 6, rolling back is just Squarespace → **Domain nameservers** → **Use Squarespace nameservers**. The original records are still sitting there untouched. Turn off DNSSEC in Cloudflare and remove the DS record first, if Step 4 was done.

## References

- Squarespace: [Making changes to nameservers](https://support.squarespace.com/hc/en-us/articles/4404183898125-Making-changes-to-nameservers)
- Squarespace: [DNSSEC for Squarespace domains](https://support.squarespace.com/hc/en-us/articles/31094668921229-DNSSEC-for-Squarespace-domains)
- Squarespace: [Email forwarding with a Squarespace domain](https://support.squarespace.com/hc/en-us/articles/19000909092237-Email-forwarding-with-a-Squarespace-domain)
- Cloudflare: [Transfer your domain to Cloudflare](https://developers.cloudflare.com/registrar/get-started/transfer-domain-to-cloudflare/)
