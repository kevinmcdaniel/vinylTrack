# Remote access to the home server

How you (the admin), CI, and the family reach the M1 Pro home server, which is behind double NAT and has no inbound ports ([#59](https://github.com/kevinmcdaniel/vinylTrack/issues/59)). There are two independent paths:

| path | carries | runs on | depends on |
|---|---|---|---|
| **Cloudflare Tunnel + Access** (primary) | the app (`vinyl.<family-domain>`), admin SSH, CI deploys | `cloudflared` on the Mac | Cloudflare, and `cloudflared` being healthy |
| **UniFi Teleport** (break-glass) | your laptop onto the home LAN, for Screen Sharing and LAN SSH | the UniFi Cloud Gateway | Ubiquiti's cloud; **nothing on the Mac** |

They're kept separate on purpose. If a `cloudflared` update breaks the tunnel, the app and the Cloudflare SSH path go down together, and Teleport is how you get in to fix it. There's no Tailscale: between them, these two cover everything it would have done.

The domain name and account names are placeholders, because the repo is public: `<family-domain>`, `<admin>` (the macOS admin's short name), `<mac-lan-ip>`.

## Hostnames

Both are published through the **one** existing tunnel. No second daemon.

| hostname | tunnel service | Access application | who |
|---|---|---|---|
| `vinyl.<family-domain>` | `http://127.0.0.1:<FE port>` | none after #11. Before #11, a family email allowlist (below) | family |
| `ssh.<family-domain>` | `ssh://127.0.0.1:22` | **required**, self-hosted app | you, plus the CI service token |

Tunnel ingress, in the `cloudflared` config file or as the tunnel's public hostnames in the dashboard:

```yaml
ingress:
  - hostname: vinyl.<family-domain>
    service: http://127.0.0.1:<FE port>
  - hostname: ssh.<family-domain>
    service: ssh://127.0.0.1:22
  - service: http_status:404
```

The FE container publishes its port on `127.0.0.1` only (`127.0.0.1:<FE port>:<FE_PORT_INT>` in `compose.prod.yml`, [#60](https://github.com/kevinmcdaniel/vinylTrack/issues/60)), so the tunnel is the only way to reach it. The BE, DB, and mailer publish nothing.

## Cloudflare Access: `ssh.<family-domain>`

Zero Trust → Access → Applications → **Add → Self-hosted**, domain `ssh.<family-domain>`. Two policies:

| policy | action | include | require |
|---|---|---|---|
| Admin | Allow | Emails: your address | Login method: Google (MFA comes from your Google account) |
| CI deploy | **Service Auth** | Service Token: `vinyltrack-ci` | none |

- Set the session duration to 24 hours, so you sign in through the browser at most once a day.
- Create the service token under Zero Trust → Access → Service Auth → **Create service token**, name `vinyltrack-ci`, duration **1 year** (a reminder is in [hosting-maintenance.md](hosting-maintenance.md#rotation)). The client ID and secret are shown **once**: put them straight into the GitHub `production` environment as `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`.
- The Zero Trust free plan covers up to 50 users, which is plenty.

**Two locks, one on each side.** Access decides who can *reach* port 22. `sshd` then still requires a key for the specific account. A leaked service token without the deploy key gets nothing, and neither does the key without the token.

## `sshd` on the Mac

Turn on System Settings → General → Sharing → **Remote Login**, with "Allow access for: **Only these users**" set to `<admin>` and `_vinyldeploy`. Then `/etc/ssh/sshd_config.d/100-vinyltrack.conf`:

```
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
AllowUsers <admin> _vinyldeploy

Match User _vinyldeploy
    ForceCommand /usr/local/libexec/vinyltrack/deploy-shell
    PermitTTY no
    AllowTcpForwarding no
    AllowAgentForwarding no
    X11Forwarding no
```

- **Key-only.** Passwords are off for everyone.
- `_vinyldeploy` can only ever run `deploy-shell`, whatever the client asks for. `deploy-shell` reads the requested command from `$SSH_ORIGINAL_COMMAND` and accepts exactly `deploy <tag>`, `rollback <tag>`, or `status` (#60).
- `_vinyltrack` and `_cloudflared` aren't in `AllowUsers` and have no shell (#59).
- Check with `sudo sshd -t` before restarting (turning Remote Login off and on again restarts it).

**Keep `sshd` off-limits to the rest of the LAN.** `sshd` listens on every interface, because the break-glass path (below) comes in over the LAN. Add a UniFi firewall rule: allow TCP 22 and 5900 (Screen Sharing) to the Mac only from the **Teleport client subnet** and your own devices, and block them from every other LAN client (family devices, IoT).

## Your daily-use computer

One-time setup:

```bash
brew install cloudflared
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_vinyl_admin -C "vinyl-admin"
```

Use a passphrase, and let the macOS keychain (or a password manager's SSH agent) hold it. Put the public key in `~<admin>/.ssh/authorized_keys` on the Mac. Do that once at the machine or over Teleport, since the Cloudflare path needs the key to already be there.

`~/.ssh/config`:

```
Host vinyl-admin
    HostName ssh.<family-domain>
    User <admin>
    IdentityFile ~/.ssh/id_ed25519_vinyl_admin
    IdentitiesOnly yes
    ProxyCommand /opt/homebrew/bin/cloudflared access ssh --hostname %h

Host vinyl-lan
    HostName <mac-lan-ip>
    User <admin>
    IdentityFile ~/.ssh/id_ed25519_vinyl_admin
    IdentitiesOnly yes
```

Everyday use:

```bash
ssh vinyl-admin
```

The first connection of the day opens a browser for the Access sign-in (Google). After that, `cloudflared` caches the token for the session duration.

Cloudflare also offers a browser-rendered SSH terminal for the same hostname, for when you're on a machine without your key. It's optional, and off by default. Only turn it on together with short-lived certificates, because otherwise a browser terminal still needs a key on that machine.

## CI (GitHub Actions → deploy)

The `production` environment in #60 holds:

| secret | what |
|---|---|
| `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` | the `vinyltrack-ci` service token |
| `DEPLOY_SSH_KEY` | a private ed25519 key used only for this. Its public half sits in `_vinyldeploy`'s `authorized_keys`, prefixed with `restrict` |
| `DEPLOY_KNOWN_HOSTS` | the Mac's host key line (`ssh-keyscan` over the LAN, once). CI pins it rather than using `StrictHostKeyChecking no` |

The deploy step:

```bash
ssh -o ProxyCommand="cloudflared access ssh --hostname %h \
      --service-token-id $CF_ACCESS_CLIENT_ID \
      --service-token-secret $CF_ACCESS_CLIENT_SECRET" \
    -o UserKnownHostsFile=known_hosts -o IdentitiesOnly=yes -i deploy_key \
    _vinyldeploy@ssh.<family-domain> "deploy $GITHUB_REF_NAME"
```

**Test this with a throwaway workflow before relying on it.** It should SSH in and run `status`. `cloudflared` has open bug reports where the service token is ignored and a browser login is tried instead ([cloudflared#1673](https://github.com/cloudflare/cloudflared/issues/1673)), and a CI runner can't complete a browser login. If the test can't be made to work, the fallback is a pull-based deploy (#60, alternatives), not reopening an inbound path.

## Break-glass: UniFi Teleport

Use this when the Cloudflare path is down, or for the GUI.

1. UniFi Network → Settings → Teleport & VPN → **Teleport**: enable it, and create an invite for yourself.
2. On the laptop: install **WiFiman**, accept the invite, and connect with Teleport. It's WireGuard, with the connection set up through Ubiquiti's cloud, so it needs no public IP or port forwarding and works through the double NAT.
3. You're now on the home LAN (in the Teleport client subnet):
   ```bash
   ssh vinyl-lan
   open vnc://<mac-lan-ip>        # Screen Sharing
   ```

Teleport is a way into the whole home network, so the **UniFi account needs MFA**. Check who has Teleport invites during the yearly review.

## Family access before #11

Until real auth ships ([#11](https://github.com/kevinmcdaniel/vinylTrack/issues/11)), the app has no login of its own: anyone who reaches the FE is the bootstrap owner. So `vinyl.<family-domain>` stays behind an Access application:

- Self-hosted app on `vinyl.<family-domain>`, one **Allow** policy listing family email addresses, login methods Google and one-time PIN (by email, for anyone without a Google account).
- **Remove this application when #11 ships.** The app's own sign-in and Turnstile take over, and a second login in front would get in the way.

## Quick reference

| I want to… | do |
|---|---|
| get a shell | `ssh vinyl-admin` |
| see the screen | Teleport on → `open vnc://<mac-lan-ip>` |
| get in when Cloudflare is broken | Teleport on → `ssh vinyl-lan` |
| deploy | tag a release; CI does the rest (#60) |
| revoke CI's access right now | delete the `vinyltrack-ci` service token in Zero Trust, or remove the key from `_vinyldeploy`'s `authorized_keys` |
| revoke my laptop's access | remove its key from `~<admin>/.ssh/authorized_keys` (over the other path) |
