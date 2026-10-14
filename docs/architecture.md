# Architecture

## Repo layout

- `be/` — Express API with Prisma ORM (`@prisma/adapter-pg`)
- `fe/` — Next.js 16 App Router frontend
- `mailer/` — a small Express service that sends the sign-in email (see [Mailer](#mailer))
- `bruno/` — the [Bruno](https://www.usebruno.com) API collection, one folder per resource (see [process](process.md))
- `design/` — design tokens/components/guidelines (carried over from squaretrack, not yet adapted — see [issue #18](https://github.com/kevinmcdaniel/vinylTrack/issues/18))
- `docker-compose.yml` — local dev orchestration: `be`, `fe`, `mailer`, `db`, `studio`, plus one-shot `migrate`/`seed` jobs
- `compose.prod.yml` — the production stack, attached to each GitHub Release (see [Releasing and deploying](hosting-deploy.md))
- `dev-secrets/` — committed fake secrets for dev (see [Config and secrets](#config-and-secrets))
- `host/` — the scripts that run on the home server for deploys, with their bats tests
- `CLAUDE.md` — operating instructions for Claude Code sessions working in this repo (commands, conventions, strict TypeScript flags)

## Backend

- `be/src/server.ts` — Express entry point
- `be/src/app.ts` — middleware + route mounting
- `be/src/config.ts` — the only place the BE reads its environment (see [Config and secrets](#config-and-secrets))
- `be/src/database.ts` — Prisma client singleton (via `@prisma/adapter-pg`, not Prisma's default driver)
- `be/src/route/` — routers, mounted under `/api/*` from `route/index.ts`
- `be/src/controller/` — request/response handling, one file per resource
- `be/src/service/` — queries and business rules, one file per resource
- `be/src/common/` — shared middleware: error handling, `authorize.ts` (who the caller is), `policy.ts` (what they may touch)
- `be/src/prisma/` — schema, migrations, seed script

Each resource is a route → controller → service vertical; `artist` is the reference implementation. Every response uses the same envelope, and the error classes in `common/errorHandler.ts` map to status codes (`ValidationError` 406, `ConflictError` 409, `NotFoundError` 404, `AuthError` 401).

`authorize.ts` resolves the caller from a short-lived bearer token the FE signs (see [Sign-in and access](#sign-in-and-access-73-74)); the `x-user-email` dev header still works in `development`/`test` only, for the BE tests and Bruno. `policy.ts` scopes collection-owned resources to the collections you own or have been shared. A resource in a collection you cannot reach reads as 404 rather than 403, so the answer doesn't reveal that it exists. See [issue #26](https://github.com/kevinmcdaniel/vinylTrack/issues/26) and the matrix comment at the top of `policy.ts`.

### The domain schema

The models live in `be/src/prisma/collection.prisma`, **not** in `schema.prisma` — that file carries only the generator and datasource, and `prisma.config.ts` points `schema` at the *directory* so both load. An empty-looking `schema.prisma` does not mean there are no models.

- `user` — someone with an account: pending, active, or declined, and maybe an admin ([#73](https://github.com/kevinmcdaniel/vinylTrack/issues/73)).
- `collection` — a named collection with an owning user, shared with other people through `collection_share`.
- `artist`, `album`, `album_artist` — the catalog. Artists are global; an album belongs to one collection.
- `location` — where a copy sits: nested (Room → Shelf) for physical storage, or a path for digital. Belongs to a collection.
- `owner` — who a copy belongs to.
- `copy` — one physical or digital instance, tying together an album, a location, and an owner.
- `source` — where a copy came from (person, store, other).
- `want_item` — an album-level or artist-level want.

Two things to know before reading it. **A copy carries its own owner** rather than inheriting one from wherever it sits, which is what lets a lent record keep its attribution when it moves. And **an owner is not a user**: `owner.userId` is nullable, so a grandparent or a kid too young to sign in can own records without an account.

Landed in [issue #2](https://github.com/kevinmcdaniel/vinylTrack/issues/2) and reshaped by [issue #53](https://github.com/kevinmcdaniel/vinylTrack/issues/53). Album art ([#15](https://github.com/kevinmcdaniel/vinylTrack/issues/15)) and external metadata ([#16](https://github.com/kevinmcdaniel/vinylTrack/issues/16)) extend it further.

## Frontend

- `fe/src/app/` — Next.js App Router; the browse UI lives under the `(app)` route group
- `fe/src/lib/` — `types.ts` (BE response shapes), `filters.ts` (pure helpers), plus the files below
- `fe/src/ui/` — shared components
- `fe/src/app/docs/` — this docs viewer (reads markdown from repo-root `docs/`; admins only)
- `fe/src/lib/config.ts` — the FE's config reader, checked at boot by `fe/src/instrumentation.ts`
- `fe/src/auth.ts` — Auth.js (JWT sessions; Google, an emailed magic link, plus a dev-only seeded-user sign-in). Every sign-in is decided by the BE (`POST /api/auth/sign-in`)
- `fe/src/lib/session.ts` — where pages check access (signed in? approved? admin?), right next to the data they fetch
- `fe/src/lib/api.ts` — server-side BE client; signs a short-lived token for the current user on every call

## Sign-in and access (#73, #74)

1. A visitor signs in with Google, or asks for a sign-in link by email (or, in dev, signs in as a seeded user). A Cloudflare Turnstile check rides along; the **BE** validates it. The emailed link is good for 15 minutes, once.
2. The BE finds or creates the `user`. The very first user ever becomes the admin; everyone after that starts **pending**.
3. A pending user sees "waiting for approval". An admin approves (optionally linking an existing `owner`) or denies at `/admin/requests`, reached from the `/admin` back office; a declined user can ask again.
4. Every FE→BE call carries a token signed with a secret only the FE and BE share. The BE re-reads the user's status on every request, so approving or denying takes effect at once.

The FE never touches the database. Sessions are JWTs, and the only things Auth.js stores — magic-link tokens, hashed — go through the BE.

## Admin back office (#90)

Admins get an **Admin** link in the header, badged with the number of pending access requests. `/admin` answers "what do I need to do?":

- **To do:** pending access requests (→ `/admin/requests`) and owners with no linked account. From BE `GET /api/admin/summary`, two counts, which also feeds the badge; non-admins never call it.
- **Version:** the release each workload reports. Different versions mean a deploy didn't finish.
- **Workloads:** fe, be, db and mailer, each up or down. From BE `GET /api/admin/health`: a `SELECT 1` and the mailer's own `/health`, 3 s each. A failing workload is a `down` entry, never an error response, and a BE that doesn't answer shows as down. A down mailer links to the re-authorize runbook. Health comes over the network, not from Docker: mounting the Docker socket into `be` would hand it root on the host.
- **Runbooks:** links into `/docs`.

The docs are split: `docs/` (this set: architecture, process, hosting runbooks) is admin-only at `/docs`, and `docs/user/` is the help any approved user reads at `/help`. Help is in the header for everyone; admins reach `/docs` from `/admin`.

## Mailer

`mailer/` ([#62](https://github.com/kevinmcdaniel/vinylTrack/issues/62)) sends exactly one email, the sign-in link, through the family Workspace's Gmail API as a dedicated sender. Only the BE can reach it (`mailnet` is an internal network holding just the two), with a bearer token, and it rate-limits per recipient and overall. In dev it runs in log mode and prints links instead of sending. Its health reflects whether the Gmail grant still works, and a deploy requires every service healthy, so **a revoked Gmail grant blocks releases** until it is re-authorised; see [Mailer token](hosting-maintenance.md#mailer-token).

## Config and secrets

Config and secrets are kept apart ([#65](https://github.com/kevinmcdaniel/vinylTrack/issues/65)):

| kind | examples | dev | prod |
|---|---|---|---|
| config | ports, `BE_URL`, `APP_ENV`, DB host/name/user | literal values in `docker-compose.yml` | literal values in `compose.prod.yml` (#60) |
| host config | public domain | not needed | `/Users/_vinyltrack/.env`, compose interpolation only |
| secrets | `db_password` | committed fakes in `dev-secrets/` | `/Users/_vinyltrack/secrets/<name>`, `600`, owner `_vinyltrack` |

- Every secret is a **Docker secret file**, mounted at `/run/secrets/<name>` only into the services that list it. No service uses `env_file`, so `fe` never sees the DB password.
- Secret `<name>` is read from the path in `<NAME>_FILE` (`db_password` → `DB_PASSWORD_FILE`). Outside production, a plain `<NAME>` variable also works, for CI and host-run tooling. Naming convention: lowercase `snake_case`, owner first, no extension.
- `be/src/config.ts` builds the DB URL from config parts plus the password, validates everything at startup, and reports every problem at once. `APP_ENV` is required. With `APP_ENV=production` (or a misspelt value) it refuses plain-variable secrets, the automation bypass (`AUTOMATION_KEY`/`TURNSTILE_TEST_SECRET_KEY`), Cloudflare's test Turnstile secrets, and the `x-user-email` header. The FE applies the same rule.
- Dev never holds a real credential: anything that needs one uses the dev/automation workaround instead.

All BE data is fetched server-side. `be/src/app.ts` mounts no CORS middleware, so a browser-direct call to `:5202` would fail; Server Components fetch over the Docker network instead, which also keeps the signed tokens off the client. Browse filters live in the URL rather than component state, so a filtered view is shareable and the back button works.

## Local dev

`docker compose up` brings up the full stack: FE on 5201, BE on 5202, Prisma Studio on 5203, Postgres on 5204. Containers are prefixed `vinyl.*` and use the `vinylnet` docker network (`10.18.0.0/24`) — deliberately distinct from squaretrack's `square.*`/`squarenet` so both stacks can run on the same machine at once.

There's nothing to set up first: config is in the compose file and the dev DB password is a committed fake (`dev-secrets/db_password`). `.env` is optional and only overrides host ports. A dev volume created before #65 needs its password changed once; see `dev-secrets/README.md`.

CI (`.github/workflows/ci.yml`) runs on every push/PR to `main`: typecheck + lint + test for each package (BE, FE, mailer), the Bruno API collection against a booted, seeded API, the host scripts (bats + shellcheck), and a build of the production images. See [process](process.md) for what each layer catches.
