# Releasing and deploying

How vinylTrack gets from a git tag to the home server ([#60](https://github.com/kevinmcdaniel/vinylTrack/issues/60)). **A tag is a release.** Nothing deploys from `main` or from a PR.

```
git tag v0.2.0 && git push origin v0.2.0
  └─ release.yml
       1. CI re-runs against the tagged commit      (red commit → stops here)
       2. arm64 images built and pushed to GHCR     ghcr.io/kevinmcdaniel/vinyltrack-{be,fe,migrate}:v0.2.0
       3. GitHub Release created, compose.prod.yml attached, notes generated from PR titles
       4. deploy.yml waits for your approval on the `production` environment
            └─ runner → Cloudflare Access (service token) → sshd → deploy-shell → deploy.sh
                 fetch compose.prod.yml → pg_dump → pull → migrate → up → wait for health
```

Steps 1–3 run straight away. Step 4 sits as *Waiting for review* until you approve it, so a release can be cut now and deployed at a quiet time later. GitHub lets an approval wait up to 30 days.

## Versions

- The **git tag is the only version.** `be/` and `fe/` `package.json` versions are never bumped.
- The tag is baked into every image at build time. `GET /api/health` on the BE and the FE reports it, so `curl …/api/health` always tells you what's running.
- `vX.Y.Z-rc.N` for dry runs (GitHub pre-release, no `latest` image tag), `vX.Y.Z` for real releases. Before 1.0: minor for features, patch for fixes. `v1.0.0` once the family is using it (after #11).
- **If 30 days pass without a release, cut a patch release anyway**, to pick up base-image security fixes ([hosting-maintenance.md](hosting-maintenance.md#app-images-and-base-images)).

## Everyday use

```bash
git switch main && git pull
git tag v0.2.0 && git push origin v0.2.0      # release; approve the deploy in Actions when ready
gh run watch                                   # follow it
```

Approve in GitHub: Actions → the *Release* run → *Review deployments* → `production` → Approve.

**Redeploy or roll back** by running `deploy.yml` *from the tag you want*:

```bash
gh workflow run deploy.yml --ref v0.1.0 -f action=rollback   # older release, migrations not run
gh workflow run deploy.yml --ref v0.2.0                       # redeploy the same release
```

Running it from the tag (`--ref`) matters: the `production` environment only accepts `v*` tags, and the tag is read from the ref. Only tags that already contain `deploy.yml` can be dispatched this way.

**Rollback doesn't undo migrations.** Migrations are forward-only. Rolling back past one means restoring the dump `deploy.sh` took just before that release went out:

```bash
ls /Users/_vinyltrack/backups/                 # pre-<tag>-<utc>.sql.gz, one per deploy
```

**Status** of what's running, from your laptop:

```bash
ssh vinyl.deploy status          # LAN; or through Access with the CI key (see hosting-remote-access.md)
```

## What deploy.sh does, and when it stops

`deploy.sh` runs as `_vinyltrack`, project `vinyltrack`, with host config from `/Users/_vinyltrack/.env` and secrets from `/Users/_vinyltrack/secrets/`. Each step must succeed before the next runs:

| step | on failure |
|---|---|
| take `~/.deploy.lock` | "another deploy is running": nothing touched |
| fetch `compose.prod.yml` from the tag's GitHub Release into `~/releases/<tag>/` | nothing touched |
| `pg_dump` from the running release → `~/backups/pre-<tag>-<utc>.sql.gz` (skipped on the first deploy) | nothing touched |
| `pull` all images, `migrate` included | old release still running |
| `run --rm migrate` (deploy only, not rollback) | old release still running; schema may be partly migrated, so restore the dump if so |
| `up -d --remove-orphans` | check `status` |
| `db`, `be`, `fe` healthy within 2 minutes | the new release is running but unhealthy; `current-version` still names the old one. Roll back |
| write `~/current-version` | — |

Every request reaching `deploy-shell`, accepted or refused, is logged:

```bash
log show --last 1d --predicate 'eventMessage CONTAINS "vinyltrack-deploy"' | tail -20
```

## One-time setup

Done once per server; redo the install step whenever `host/libexec/` changes.

1. **Install the host scripts** (root-owned, read-only to everyone else). From the repo on your laptop:
   ```bash
   scp host/libexec/deploy-shell host/libexec/deploy.sh vinyl.admin:
   ```
   On the server:
   ```bash
   sudo install -d -o root -g wheel -m 755 /usr/local/libexec/vinyltrack
   sudo install -o root -g wheel -m 755 ~/deploy-shell ~/deploy.sh /usr/local/libexec/vinyltrack/ && rm ~/deploy-shell ~/deploy.sh
   ```
2. **The one sudoers rule**: `_vinyldeploy` may run `deploy.sh` as `_vinyltrack`, and nothing else.
   ```bash
   echo '_vinyldeploy ALL=(_vinyltrack) NOPASSWD: /usr/local/libexec/vinyltrack/deploy.sh' | sudo tee /etc/sudoers.d/vinyltrack-deploy >/dev/null
   sudo chmod 440 /etc/sudoers.d/vinyltrack-deploy && sudo visudo -cf /etc/sudoers.d/vinyltrack-deploy
   sudo -l -U _vinyldeploy        # shows only that rule
   ```
3. **`_vinyltrack`'s Docker config** must have no `credsStore` (pulls fail looking for a keychain helper), per [hosting-remote-access.md](hosting-remote-access.md#role-accounts).
4. **Secrets and host config** on the server, per [hosting-remote-access.md](hosting-remote-access.md#role-accounts). `compose.prod.yml` refuses to start without them, and `be`/`fe` refuse Cloudflare's test keys in production:

   | `/Users/_vinyltrack/secrets/` | what |
   |---|---|
   | `db_password` | random |
   | `internal_api_secret` | random, ≥32 chars (`openssl rand -hex 32`); shared by `be` and `fe` |
   | `auth_secret` | random, ≥32 chars; encrypts the session cookie |
   | `turnstile_secret_key` | the **real** Turnstile widget's secret for `vinyl.<family-domain>` |
   | `google_oauth_client_secret` | from the Google OAuth client in `vinyltrack-503118` |
   | `mailer_token` | random, ≥32 chars; shared by `be` and `mailer` |
   | `gmail_client_secret` | the mailer's Desktop OAuth client secret (`vinyltrack-mailer` project) |
   | `gmail_refresh_token` | written by `npm run authorize` (step 7 below) |

   | `/Users/_vinyltrack/.env` (host config, not secret) | what |
   |---|---|
   | `PUBLIC_HOSTNAME` | `vinyl.<family-domain>` |
   | `GOOGLE_OAUTH_CLIENT_ID` | the OAuth client's ID |
   | `TURNSTILE_SITE_KEY` | the real widget's site key (public; sent to every browser) |
   | `MAILER_FROM` | the sender mailbox, e.g. `vinyltrack@<family-domain>` |
   | `GMAIL_CLIENT_ID` | the mailer's OAuth client ID |
   | `FE_PORT_EXT` | optional, default `5201` |
5. **GitHub `production` environment** (Settings → Environments):
   - Secrets `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`; variable `DEPLOY_HOST` ([hosting-remote-access.md](hosting-remote-access.md#ci-github-actions--deploy)).
   - *Required reviewers*: you.
   - *Deployment branches and tags* → *Selected branches and tags* → tag rule `v*`, and **nothing else**. No branch rules, `main` included: only a release tag may deploy.
6. **GHCR packages public.** The first release creates `vinyltrack-be`, `vinyltrack-fe`, `vinyltrack-migrate` (and, from #62, `vinyltrack-mailer`) as *private* packages, and the server pulls without logging in. For each: github.com/kevinmcdaniel?tab=packages → the package → *Package settings* → *Change visibility* → Public. The repo is public anyway; this needs doing once, after the first release's image job and before its deploy is approved.

7. **The mailer's Gmail access (#62).** Releases from #62 on won't deploy until this is done: `deploy.sh` requires the mailer healthy, and it is only healthy with a working Gmail grant.
   - **Sender user** in Workspace, e.g. `vinyltrack@<family-domain>`: a dedicated mailbox, never a person's, so a leaked token can only send as it. 2-step verification on, password in the password manager, no other use.
   - **GCP project `vinyltrack-mailer`**, parent = the family domain's organization (IAM & Admin → Manage resources), **not** `vinyltrack-503118`: the consent-screen audience is per project, and family sign-in must be External while this must be Internal.
     - APIs & Services → Library → **Gmail API** → Enable.
     - OAuth consent screen: audience **Internal**; scopes: `https://www.googleapis.com/auth/gmail.send` **only**.
     - Credentials → OAuth client ID → **Desktop app** → keep the client ID (`.env` `GMAIL_CLIENT_ID`) and secret (`secrets/gmail_client_secret`).
   - **Admin console** → Security → Access and data control → API controls → Manage third-party app access → add the client ID → **Trusted**.
   - **Authorize**, in a browser signed in as the **sender user**, from a checkout on your laptop:
     ```bash
     cd mailer && GMAIL_CLIENT_ID=… GMAIL_CLIENT_SECRET=… npm run authorize -- --out ./gmail_refresh_token
     ```
     It prints a consent URL, catches Google's redirect on `127.0.0.1`, and writes the token with mode `600`. It refuses to overwrite an existing file, so always pass a fresh path. Copy it to the server as `_vinyltrack` (`sudo -u _vinyltrack -H vi /Users/_vinyltrack/secrets/gmail_refresh_token`, paste), then delete the local file.
   - **Check after the next deploy:** send a sign-in email to yourself, and in Gmail → *Show original* expect SPF, DKIM and DMARC all `PASS`.

## The images

| image | base | contents |
|---|---|---|
| `vinyltrack-be` | `gcr.io/distroless/nodejs24-debian13:nonroot` | compiled `dist/` + runtime deps only. No shell, no package manager, uid 65532 |
| `vinyltrack-fe` | same | Next.js standalone output + `docs/` |
| `vinyltrack-migrate` | same | Prisma CLI, schema engine, schema + migrations. Runs `prisma migrate deploy` and exits |
| `vinyltrack-mailer` | same | compiled mailer + Express; reachable from `be` only (`mailnet`, internal), out to Google via `egress` |

Distroless has no shell: `docker exec … sh` doesn't work, and Node is `/nodejs/bin/node`. Healthchecks in `compose.prod.yml` use Node's `fetch`. For a look inside a running container, `docker exec <c> /nodejs/bin/node -e "…"`.
