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

## Role accounts

Three hidden service accounts, none of which you can log in as:

| account | home | shell | why |
|---|---|---|---|
| `_vinyltrack` | `/Users/_vinyltrack` (`750`) | `/usr/bin/false` | owns Colima, Docker, `compose.prod.yml`, the app's secret files in `~/secrets/`, and `~/.env` (host config only, never secrets; #65). Needs a real home because Colima and Docker keep their state in `~/.colima` and `~/.docker`, and Colima only shares the home folder with the VM |
| `_vinyldeploy` | `/Users/_vinyldeploy` (`755`, `.ssh` `700`, `authorized_keys` `600`) | `/bin/sh` | CI's SSH login. **Needs a real shell:** `sshd` runs `ForceCommand` as `$SHELL -c …`, so `/usr/bin/false` breaks every deploy. `ForceCommand` and `PermitTTY no` are what stop an interactive session |
| `_cloudflared` | `/var/empty` | `/usr/bin/false` | runs the tunnel daemon. Runs from `--token-file`, so it needs no home ([hosting-maintenance.md](hosting-maintenance.md#cloudflared-daemon)) |

- **They don't show up in System Settings → Users & Groups**, or anywhere else in the GUI. That's macOS hiding `_`-prefixed accounts, not a failed create. List them with `dscl . -list /Users UniqueID | grep '^_'`, and inspect one with `dscl . -read /Users/<name> NFSHomeDirectory UserShell PrimaryGroupID`.
- Setting a home: `dscl . -create /Users/<name> NFSHomeDirectory …` can hang. `sudo dscl . -change /Users/<name> NFSHomeDirectory <old> <new>` does the same job. `dscl` only records the path; `mkdir` and `chown` the directory yourself.
- **Edit their files as them, from an admin session**, not by copying files in as yourself. `sudo -u <name> -H` runs one command as the account, whatever its shell.
- **Secrets are one file each** in `/Users/_vinyltrack/secrets/` (directory `700`, files `600`), named per #65's convention (`db_password`, `turnstile_secret_key`, …). They exist only here: never in the repo, CI, or `.env`.
  ```bash
  sudo -u _vinyltrack -H mkdir -p -m 700 /Users/_vinyltrack/secrets                                          # once
  sudo -u _vinyltrack -H sh -c 'umask 077; openssl rand -hex 32 > /Users/_vinyltrack/secrets/db_password'   # a random secret
  sudo -u _vinyltrack -H vi /Users/_vinyltrack/secrets/<name>                                                # one you were given
  ```
  Generating straight into the file, or typing into `vi`, keeps the value off screen, out of shell history, and out of any file you own. The same `sudo -u … vi` pattern edits `_vinyldeploy`'s `authorized_keys`.
- Inside Colima's VM, file modes don't protect anything: every container user can read a mounted secret (spike in #65). The `600`/`700` modes keep other *macOS* accounts out; per-service `secrets:` lists in compose decide which container sees what. A secret file outside `/Users/_vinyltrack` shows up in the container as an empty directory, not an error.
- **`docker compose` as `_vinyltrack`** needs Homebrew's plugin directory in its Docker config, or `docker compose -f …` fails with `unknown shorthand flag: 'f'`. Colima creates the file; add the key without clobbering its context:
  ```bash
  sudo -u _vinyltrack -H sh -c 'f=$HOME/.docker/config.json; jq ".cliPluginsExtraDirs = [\"/opt/homebrew/lib/docker/cli-plugins\"]" "$f" > "$f.tmp" && mv "$f.tmp" "$f"'
  sudo -u _vinyltrack -H docker compose version
  ```

## `sshd` on the Mac

Turn on System Settings → General → Sharing → **Remote Login**, with "Allow access for: **Only these users**" set to `<admin>` and `_vinyldeploy`. The picker can't show hidden accounts, and the list is enforced through the `com.apple.access_ssh` group, so add `_vinyldeploy` by hand. Without this it gets `Permission denied (publickey)` even with the right key:

```bash
sudo dseditgroup -o edit -a _vinyldeploy -t user com.apple.access_ssh
dseditgroup -o checkmember -m _vinyldeploy com.apple.access_ssh
```

Then `/etc/ssh/sshd_config.d/100-vinyltrack.conf`. That's **`sshd_config.d`**, the server's. `/etc/ssh/ssh_config.d` is the *client's*, and a file there is silently ignored by `sshd`:

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
- No restart needed: launchd starts a fresh `sshd` for each connection, so the next login reads the new file. Sessions already open keep the old settings.
- Check before relying on it. `sudo sshd -t` catches syntax errors (which break every new login, yours included), and this shows what `sshd` will actually apply to the deploy account:
  ```bash
  sudo sshd -T -C user=_vinyldeploy,host=x,addr=127.0.0.1 | grep -iE 'forcecommand|permittty|allowusers|passwordauth'
  ```
  `forcecommand none` means the drop-in isn't being read: check the directory, and that `/etc/ssh/sshd_config` still has `Include /etc/ssh/sshd_config.d/*`.
- Test changes from a second terminal while keeping a working session open.

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

Host *
    AddKeysToAgent yes
    UseKeychain yes
```

- `Host *` goes **last**, and holds only settings that suit every host. `ssh` keeps the first value it finds per setting, and `IdentityFile` *adds up* across matching blocks: an `IdentityFile` under `Host *` (a common leftover from GitHub setup) gets offered to every host. Give GitHub its own `Host github.com` block.
- **The `ProxyCommand` line is required.** Without it `ssh` dials the hostname's Cloudflare edge addresses on port 22 directly, and just hangs.
- Load the key into the agent once, with its passphrase saved to the keychain: `ssh-add --apple-use-keychain ~/.ssh/id_ed25519_vinyl_admin`. Check what a host resolves to with `ssh -G vinyl-admin | grep -E '^(hostname|user|identityfile|proxycommand)'`.

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
| `DEPLOY_KNOWN_HOSTS` | the Mac's host key line. CI pins it rather than using `StrictHostKeyChecking no` |

**The deploy key.** Generate it on your laptop with no passphrase (CI can't type one; Access, `restrict`, and `ForceCommand` stand in for it), then install the public half on the Mac:

```bash
ssh-keygen -t ed25519 -N "" -C "vinyltrack-ci-deploy" -f ~/.ssh/vinyltrack_deploy   # laptop
scp ~/.ssh/vinyltrack_deploy.pub vinyl-lan:                                          # laptop
sed 's/^/restrict /' ~/vinyltrack_deploy.pub | sudo -u _vinyldeploy -H tee -a /Users/_vinyldeploy/.ssh/authorized_keys && rm ~/vinyltrack_deploy.pub   # Mac
gh secret set DEPLOY_SSH_KEY --env production < ~/.ssh/vinyltrack_deploy            # laptop
```

Test from the laptop, which is where the private key is. Logging in *as* `_vinyldeploy` doesn't need you to be it on the Mac. An error that `deploy-shell` doesn't exist (until #60 builds it) means the key got in and `ForceCommand` took over; a shell prompt means the drop-in isn't working:

```bash
ssh -i ~/.ssh/vinyltrack_deploy -o IdentitiesOnly=yes _vinyldeploy@<mac-lan-ip> status
```

Delete the laptop copy once CI has connected for real. GitHub holds the only copy CI needs, and rotation makes a new key anyway.

**The host key line.** A `known_hosts` entry is a hostname plus the server's *public host key*, the one macOS generated when Remote Login was turned on. The hostname must be exactly the one CI dials, i.e. the public hostname on the tunnel route, not the LAN name. Build it from the Mac's key (public, safe to paste):

```bash
cat /etc/ssh/ssh_host_ed25519_key.pub     # on the Mac: ssh-ed25519 AAAA… root@…
```

Drop the trailing comment and put the hostname first: `ssh.<family-domain> ssh-ed25519 AAAA…`. That one line is the secret.

The deploy step:

```bash
ssh -o ProxyCommand="cloudflared access ssh --hostname %h \
      --service-token-id $CF_ACCESS_CLIENT_ID \
      --service-token-secret $CF_ACCESS_CLIENT_SECRET" \
    -o UserKnownHostsFile=known_hosts -o IdentitiesOnly=yes -i deploy_key \
    _vinyldeploy@ssh.<family-domain> "deploy $GITHUB_REF_NAME"
```

Before writing the workflow, check the service-token path from your laptop. It should connect without opening a browser. The token secret is on the command line, so keep it out of shell history: in zsh, `setopt HIST_IGNORE_SPACE` and start the command with a space, or `history -d` it afterwards.

```bash
 ssh -o ProxyCommand="cloudflared access ssh --hostname %h --service-token-id <id> --service-token-secret <secret>" \
    -i ~/.ssh/vinyltrack_deploy -o IdentitiesOnly=yes _vinyldeploy@ssh.<family-domain> status
```

**Then test it with a throwaway workflow before relying on it.** It should SSH in and run `status`. `cloudflared` has open bug reports where the service token is ignored and a browser login is tried instead ([cloudflared#1673](https://github.com/cloudflare/cloudflared/issues/1673)), and a CI runner can't complete a browser login. If the test can't be made to work, the fallback is a pull-based deploy (#60, alternatives), not reopening an inbound path.

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
