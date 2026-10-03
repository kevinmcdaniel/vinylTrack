# Home server update schedule

What gets updated on the M1 Pro home server, how often, and how. This is the maintenance half of the host runbook ([#59](https://github.com/kevinmcdaniel/vinylTrack/issues/59)); how the machine is set up in the first place lands in `hosting.md` with that issue.

The server runs **lights-out**, so every step here is done remotely from the daily-use computer. The only exception is the quarterly battery check.

```bash
ssh vinyl-admin          # Cloudflare Access SSH; setup in hosting-remote-access.md
```

If the Cloudflare path is down, use the break-glass path: UniFi Teleport, then `ssh vinyl-lan`. See [hosting-remote-access.md](hosting-remote-access.md).

Paths below (`/Users/_vinyltrack/…`, `/usr/local/libexec/vinyltrack/…`, daemon labels) follow the #59 plan. Correct them here once the host is actually built. The `cloudflared` daemon is built and its paths are real; see [`cloudflared` daemon](#cloudflared-daemon).

## Schedule at a glance

| what | cadence | when | downtime |
|---|---|---|---|
| macOS security responses | automatic | as Apple ships them | none, or one unattended reboot |
| macOS point releases (e.g. 26.x) | monthly | maintenance window, within 30 days of release | one reboot (a few minutes) |
| macOS major versions | deliberate | wait for the `.1` or `.2`, typically 2–3 months after release | one reboot plus re-verification |
| Homebrew packages (`colima`, `docker`, `cloudflared`, …) | monthly | maintenance window | about 1 minute per restarted service |
| UniFi gateway firmware (UniFi OS / Network) | monthly check | maintenance window, *after* the Mac is verified | the gateway reboots, so the whole home network drops briefly |
| Security advisory for `cloudflared` / Docker / macOS / UniFi | out of cycle | **within 72 hours** | as above |
| App images (`be`, `fe`, `mailer`, base images `node:24-alpine`, `postgres:17-alpine`) | every release, and **at least monthly** | tag a release (#60) | seconds (rolling `up -d`) |
| Postgres **minor** version (17.x) | with app images | automatically with the next image pull | seconds |
| Postgres / Node **major** version | planned | its own issue (Node: #31) | planned window |
| npm dependencies / Dependabot alerts | weekly review | with the next code change | none (ships in a release) |
| Backup restore test | quarterly | maintenance window | none (scratch DB) |
| Battery and hardware check | quarterly | in person, the only physical step | none |
| Credential rotation | per credential | see [Rotation](#rotation) | none to seconds |
| Domain renewal / Cloudflare account check | yearly | a month before the domain expires | none |

**Maintenance window:** first Sunday of the month, morning (low family use). Move it freely; the point is that there is one, so updates don't pile up.

## Monthly window: in order

Order matters: back up first, reboot last.

1. **Check the starting state.** Everything should be healthy *before* anything changes, so a problem afterwards is clearly caused by the update:
   ```bash
   sudo -u _vinyltrack -H docker compose -f /Users/_vinyltrack/compose.prod.yml ps
   ```
   Also check that the tunnel shows **Healthy** in Zero Trust → Networks → Tunnels.
2. **Take a backup now,** not last night's:
   ```bash
   sudo -u _vinyltrack -H /usr/local/libexec/vinyltrack/backup.sh
   ```
3. **Homebrew:**
   ```bash
   brew update
   brew outdated            # read this before upgrading
   brew upgrade
   brew cleanup
   ```
4. **Restart only the services whose binaries changed.**
   - `colima`: the new binary is used only once the VM restarts, and restarting the VM stops vinylTrack for about a minute: `sudo launchctl kickstart -k system/com.vinyltrack.colima`. The stack returns via `restart: unless-stopped`.
   - Inside the VM, the Docker engine is updated with `colima update` if the installed Colima has it (`colima --help`). **Never `colima delete`.** The Postgres volume lives inside the VM's disk, and deleting the VM deletes the database.
   - **`cloudflared`: last, and not over the tunnel.** Restarting `cloudflared` cuts the `ssh vinyl-admin` session you'd be using, and briefly takes the app offline. Do this step over **Teleport** (`ssh vinyl-lan`), so a `cloudflared` that fails to come back is still fixable:
     ```bash
     sudo launchctl kickstart -k system/com.cloudflare.cloudflared
     ps -axo user,pid,command | grep '[c]loudflared'   # one line, user _cloudflared
     ```
     Then confirm the tunnel is **Healthy** in the dashboard, and that `ssh vinyl-admin` works again from a second terminal *before* you close the LAN session. If `ps` shows `root`, or two lines, an upgrade has rewritten the plist or `brew services` started a second copy. Fix it as described in [`cloudflared` daemon](#cloudflared-daemon).
5. **macOS:**
   ```bash
   softwareupdate -l
   sudo softwareupdate -i -a -R
   ```
   `-R` reboots when needed. The Mac comes back unattended (FileVault is off, and every service, `cloudflared` included, is a LaunchDaemon). On Apple silicon, `softwareupdate` can ask for a volume owner's credentials (`--user <admin> --stdinpass`). Note what it actually asks for the first time, and update this step.
6. **Verify:** reconnect, then repeat step 1. Also check that:
   - the public hostname loads,
   - the uptime monitor is green,
   - the tunnel shows **Healthy** in Zero Trust → Networks → Tunnels.
7. **UniFi gateway firmware, only after everything above is verified.** UniFi Network → Settings → Control Plane → Updates. The gateway reboot drops the whole home network, including Teleport and the tunnel, for a few minutes. Don't do it while connected *through* Teleport, and don't do it in the same step as a Mac change, so any breakage has only one cause.

**If something breaks:**
- **Homebrew package:** `brew` keeps no old versions after `cleanup`. Skip `cleanup` until verification passes if a rollback might be needed, or reinstall a specific version from its bottle.
- **macOS:** point releases can't be rolled back. That's why majors wait for `.1` or `.2`, and why the backup comes first.

## `cloudflared` daemon

One LaunchDaemon, running as the `_cloudflared` role account:

| what | where |
|---|---|
| plist | `/Library/LaunchDaemons/com.cloudflare.cloudflared.plist`, `root:wheel` `644` |
| label | `com.cloudflare.cloudflared` |
| user / group | `UserName` `_cloudflared`, and `GroupName` set to that account's own group, **not** `staff` |
| tunnel token | `/Library/Application Support/com.cloudflare.cloudflared/token` (`--token-file`). Directory `700` and file `600`, both owned by `_cloudflared`. There's no `/etc/cloudflared` or config file |
| logs | `/Library/Logs/com.cloudflare.cloudflared.{out,err}.log`, owned by `_cloudflared` |

- **Never `brew services start cloudflared`.** It installs its own job (`sh.brew.cloudflared`) running as **root**, next to this one. If one appears, stop it with `brew services stop cloudflared` (as the admin, not with `sudo`).
- **Killing the process doesn't stop it.** `KeepAlive` restarts it on any unsuccessful exit. Stop it with `sudo launchctl bootout system/com.cloudflare.cloudflared`, and start it with `sudo launchctl bootstrap system /Library/LaunchDaemons/com.cloudflare.cloudflared.plist`.
- **Changes to the plist only take effect on `bootout` + `bootstrap`.** `kickstart` restarts the process with the plist launchd already has loaded.
- **Healthy:** `ps` shows exactly one `cloudflared`, user `_cloudflared`, and the error log shows `Registered tunnel connection` lines.

## macOS versions

- **Security responses** (Apple's out-of-band security fixes): System Settings → General → Software Update → Automatic Updates → *Install Security Responses and system files* **on**. They install without a full update, and occasionally reboot. The Mac comes back by itself.
- **Automatic downloads on, automatic install of macOS updates off.** Point releases install in the monthly window, so an update never reboots the server at a random time.
- **Major versions (e.g. 26 → 27)** wait for the `.1` or `.2` release. Before upgrading, check release notes and issue trackers for the four things that must keep working: `cloudflared`, Colima (its virtualization framework), `sshd` with the `sshd_config.d` drop-in, and LaunchDaemons running as role accounts. Do it in a window with time to spare.
- Firmware updates come bundled with macOS on Apple silicon; there's no separate step.

## App images and base images

The app is updated only by **tagging a release** ([#60](https://github.com/kevinmcdaniel/vinylTrack/issues/60)); nobody pulls images by hand on the host.

- Each release rebuilds `be`, `fe`, and `mailer` from `node:24-alpine`, and pulls the current `postgres:17-alpine`. That means base-image security fixes arrive only when a release is cut.
- **If 30 days pass without a release, cut a patch release anyway** (`vX.Y.Z+1`, no code changes needed), just to pick up base-image fixes.
- **Postgres minor versions** (17.x) are drop-in: a new image on the same data directory. **Major versions** (17 → 18) need a dump and restore, or `pg_upgrade`, so they get their own issue and a planned window.
- **Node major versions** follow #31 (26, once it's LTS), not this schedule.

## Security advisories (out of cycle)

Don't wait for the monthly window when there's a security fix for anything exposed to the network. Apply within **72 hours**:

| component | where advisories appear |
|---|---|
| macOS | Apple security releases (support.apple.com/100100) |
| UniFi Cloud Gateway (Teleport) | UniFi security advisory bulletins (community.ui.com → Releases / Security) |
| `cloudflared` | GitHub releases for `cloudflare/cloudflared` (watch → releases) |
| Colima / Docker engine | GitHub releases for `abiosoft/colima`, plus Docker security announcements |
| npm dependencies | Dependabot alerts on this repo |

Same steps as the monthly window, for just the affected piece.

## Quarterly

- **Restore test:** restore the latest backup into a scratch database, and spot-check row counts against production. A backup that has never been restored doesn't count.
- **Battery and hardware:** the one physical step. A laptop that's always charging can end up with a **swollen battery**, which is a fire and hardware risk. Look for a lifted trackpad, a case that rocks on a flat surface, or a gap at the seams. Remotely, check the condition and cycle count:
  ```bash
  system_profiler SPPowerDataType | grep -E 'Cycle Count|Condition|Maximum Capacity'
  ```
  If the condition isn't `Normal`, or there's any sign of swelling, power the Mac down and get the battery serviced.
- **Disk space:**
  ```bash
  df -h /
  sudo -u _vinyltrack -H colima ssh -- df -h
  ```
  Also prune old backups if the retention job isn't keeping up.

## Rotation

| credential | cadence | how |
|---|---|---|
| Mailer Gmail refresh token + `MAILER_TOKEN` | every 6 months, or on suspected leak | [#62](https://github.com/kevinmcdaniel/vinylTrack/issues/62) rotation steps |
| Cloudflare Access service token `vinyltrack-ci` (`CF_ACCESS_CLIENT_*`) | yearly, **before its 1-year expiry** | create a new token → add it to the `ssh.<family-domain>` CI policy → update the GitHub `production` secrets → test a `status` deploy → delete the old token |
| CI deploy SSH key (`DEPLOY_SSH_KEY`) | yearly, alongside the service token | new ed25519 key → public half into `_vinyldeploy`'s `authorized_keys` (with `restrict`) → GitHub secret → test → remove the old public key |
| Admin SSH key (`id_ed25519_vinyl_admin`) | on a new laptop, or on suspected leak | new key → add the public half on the Mac → test `ssh vinyl-admin` → remove the old one |
| Cloudflare Tunnel token | on suspected leak | rotate the tunnel's token in the Cloudflare Zero Trust dashboard → write it to the token file (owner `_cloudflared`, mode `600`; see [`cloudflared` daemon](#cloudflared-daemon)) → `kickstart -k` the daemon |
| Turnstile secret | on suspected leak | rotate in the Cloudflare dashboard → host `.env` → restart `be` |
| Production DB password | on suspected leak | change it in Postgres and the host `.env` together, then restart `be` |

**Emergency revoke:** deleting the `vinyltrack-ci` service token in Zero Trust cuts CI off at the edge immediately. Removing a key from `authorized_keys` cuts that key off at the Mac. Either alone is enough.

## Yearly

- The domain's auto-renew is on at Cloudflare Registrar, and the payment method is current. Check a month before expiry.
- Review who has access: the Access policy emails on `ssh.<family-domain>` (and on `vinyl.<family-domain>` until #11), UniFi Teleport invites, and the keys in `authorized_keys` for `<admin>` and `_vinyldeploy`.
- Review this schedule: remove what no longer applies, add anything new that runs on the host.
