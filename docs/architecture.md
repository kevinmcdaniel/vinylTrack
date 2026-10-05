# Architecture

## Repo layout

- `be/` — Express API with Prisma ORM (`@prisma/adapter-pg`)
- `fe/` — Next.js 15 App Router frontend
- `design/` — design tokens/components/guidelines (carried over from squaretrack, not yet adapted — see [issue #18](https://github.com/kevinmcdaniel/vinylTrack/issues/18))
- `docker-compose.yml` — local dev orchestration: `be`, `fe`, `db`, `studio`, plus one-shot `migrate`/`seed` jobs
- `CLAUDE.md` — operating instructions for Claude Code sessions working in this repo (commands, conventions, strict TypeScript flags)

## Backend

- `be/src/server.ts` — Express entry point
- `be/src/app.ts` — middleware + route mounting
- `be/src/config.ts` — the only place the BE reads its environment (see [Config and secrets](#config-and-secrets))
- `be/src/database.ts` — Prisma client singleton (via `@prisma/adapter-pg`, not Prisma's default driver)
- `be/src/route/` — routers, mounted under `/api/*` from `route/index.ts`
- `be/src/common/` — shared middleware (error handling, auth once #11 lands)
- `be/src/prisma/` — schema, migrations, seed script

The domain schema is **not yet implemented** — `schema.prisma` currently has no models. See [issue #2](https://github.com/kevinmcdaniel/vinylTrack/issues/2) for the planned `user`/`collection`/`artist`/`album`/`copy`/`location`/`want_item` model, extended by later issues (auth/sharing, album art, external metadata).

## Frontend

- `fe/src/app/` — Next.js App Router
- `fe/src/app/docs/` — this docs viewer (reads markdown from repo-root `docs/`)
- `fe/src/lib/config.ts` — the FE's config reader, checked at boot by `fe/src/instrumentation.ts`

## Config and secrets

Config and secrets are kept apart ([#65](https://github.com/kevinmcdaniel/vinylTrack/issues/65)):

| kind | examples | dev | prod |
|---|---|---|---|
| config | ports, `BE_URL`, `APP_ENV`, DB host/name/user | literal values in `docker-compose.yml` | literal values in `compose.prod.yml` (#60) |
| host config | public domain | not needed | `/Users/_vinyltrack/.env`, compose interpolation only |
| secrets | `db_password` | committed fakes in `dev-secrets/` | `/Users/_vinyltrack/secrets/<name>`, `600`, owner `_vinyltrack` |

- Every secret is a **Docker secret file**, mounted at `/run/secrets/<name>` only into the services that list it. No service uses `env_file`, so `fe` never sees the DB password.
- Secret `<name>` is read from the path in `<NAME>_FILE` (`db_password` → `DB_PASSWORD_FILE`). Outside production, a plain `<NAME>` variable also works, for CI and host-run tooling. Naming convention: lowercase `snake_case`, owner first, no extension.
- `be/src/config.ts` builds the DB URL from config parts plus the password, validates everything at startup, and reports every problem at once. `APP_ENV` is required. With `APP_ENV=production` (or a misspelt value) it refuses plain-variable secrets and the dev-only `AUTH_BOOTSTRAP_OWNER_EMAIL`. The FE applies the same identity rule.
- Dev never holds a real credential: anything that needs one uses the dev/automation workaround instead.

## Local dev

`docker compose up` brings up the full stack: FE on 5201, BE on 5202, Prisma Studio on 5203, Postgres on 5204. Containers are prefixed `vinyl.*` and use the `vinylnet` docker network (`10.18.0.0/24`) — deliberately distinct from squaretrack's `square.*`/`squarenet` so both stacks can run on the same machine at once.

There's nothing to set up first: config is in the compose file and the dev DB password is a committed fake (`dev-secrets/db_password`). `.env` is optional and only overrides host ports. A dev volume created before #65 needs its password changed once; see `dev-secrets/README.md`.

CI (`.github/workflows/ci.yml`) runs `typecheck` + `lint` for both packages on every push/PR to `main`.
