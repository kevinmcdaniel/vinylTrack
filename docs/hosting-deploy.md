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
3. **Secrets and host config** on the server, per [hosting-remote-access.md](hosting-remote-access.md#role-accounts): `/Users/_vinyltrack/secrets/db_password`, and `/Users/_vinyltrack/.env` with `FE_PORT_EXT` if the default `5201` doesn't suit.
4. **GitHub `production` environment** (Settings → Environments):
   - Secrets `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`; variable `DEPLOY_HOST` ([hosting-remote-access.md](hosting-remote-access.md#ci-github-actions--deploy)).
   - *Required reviewers*: you.
   - *Deployment branches and tags* → *Selected branches and tags* → add tag rule `v*`.
5. **GHCR packages public.** The first release creates `vinyltrack-be`, `vinyltrack-fe` and `vinyltrack-migrate` as *private* packages, and the server pulls without logging in. For each: github.com/kevinmcdaniel?tab=packages → the package → *Package settings* → *Change visibility* → Public. The repo is public anyway; this needs doing once, after the first release's image job and before its deploy is approved.

## The images

| image | base | contents |
|---|---|---|
| `vinyltrack-be` | `gcr.io/distroless/nodejs24-debian13:nonroot` | compiled `dist/` + runtime deps only. No shell, no package manager, uid 65532 |
| `vinyltrack-fe` | same | Next.js standalone output + `docs/` |
| `vinyltrack-migrate` | same | Prisma CLI, schema engine, schema + migrations. Runs `prisma migrate deploy` and exits |

Distroless has no shell: `docker exec … sh` doesn't work, and Node is `/nodejs/bin/node`. Healthchecks in `compose.prod.yml` use Node's `fetch`. For a look inside a running container, `docker exec <c> /nodejs/bin/node -e "…"`.
