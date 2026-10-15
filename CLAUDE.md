# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

vinylTrack is a family record/album/MP3 collection tracker. It supports more than one named **collection** (Vinyl, Square Dance Calls, General MP3s, …), each with its own artists, releases, physical/digital copies, locations, and a want list. It's a shared app across family members (Google sign-in, per-user access, sharing between specific people) and across devices (phone/tablet/computer), with offline support planned for later.

Full design history and the up-to-date plan live in the GitHub issue tracker — issues #1–#18 (as of this writing) cover scaffold, schema, APIs, UI, auth, hosting, album art, external metadata lookup, and design system adaptation. Treat the issues as the living spec; this file documents what's actually been built.

See also [docs/](./docs/README.md) — the human-facing companion to this file (architecture, dev process, design brief, hosting runbooks), rendered in-app at `/docs` for admins only (#90); approved non-admins are redirected to `/help`, which renders `docs/user/` (user help) for any active user. `fe/src/lib/docsFs.ts` takes the root dir and never descends into subfolders, so `docs/user/` stays out of the admin list and nothing outside `docs/user/` resolves under `/help`.

Monorepo structure:
- `be/` — Express.js backend API with Prisma ORM
- `fe/` — Next.js 15 frontend with App Router

## Development Commands

### Docker (recommended for full-stack dev)
```bash
docker compose up          # Start all services: BE (5202), FE (5201), DB (5204), Prisma Studio (5203)
```

### Backend (`be/`)
```bash
npm run dev      # Generate Prisma client + start nodemon (hot reload)
npm run migrate  # Run Prisma migrations (prisma migrate dev)
npm run test      # vitest run
npm run typecheck
npm run lint
```

### Frontend (`fe/`)
```bash
npm run dev        # Start Next.js with Turbopack on $PORT
npm run build      # Production build
npm run lint       # ESLint (flat config, max-warnings 0)
npm run typecheck  # tsc --noEmit
npm run test       # vitest run (jsdom + Testing Library)
```

FE tests live next to what they cover (`src/lib/*.test.ts`, `src/ui/*.test.tsx`). `server-only` is aliased to a stub in `vitest.config.mts` — it throws outside a Server Component build, and there's no RSC boundary under vitest to enforce.

### API testing (`bruno/`)
```bash
cd be && npm run test:api   # bru run --env local -r, against a running+seeded stack on :5202
```
Bruno collection covering every resource over HTTP, with assertions on status and response envelope. One folder per resource, ordered by dependency (collection → artist → owner → location → album → copy → want → cleanup); ids chain through runtime vars and the `cleanup` folder removes everything a run creates, so runs are idempotent. Identity is the `x-user-email` dev header (development/test only) driven by an env var (`ownerEmail`/`adminEmail`/`sharedEmail`/`outsiderEmail`/`unknownEmail` mapping to the seeded users), which is what makes the #26 access rules testable from outside the process. **The seeded owner (`kevin`) is deliberately not an admin** — admin is a separate seeded user owning nothing — so "owner" requests exercise the real access rules rather than the admin bypass. The `auth` folder calls the real Turnstile `siteverify`: a folder script mints a service token from `INTERNAL_API_SECRET` (`crypto-js`, safe sandbox), and `npm run test:api` fills `INTERNAL_API_SECRET`/`AUTOMATION_KEY` from `dev-secrets/` when unset. The "no automation key" case expects 401 only when `TURNSTILE_ALWAYS_FAILS=true` (CI). The `magic-link` cases go BE → a log-mode mailer (CI starts one on `:5299`); locally the mailer's 3-per-15-min limit can turn the flagged-user case into a 429, which it accepts outside CI. This is a *complement* to `npm run test`, not a replacement — supertest never boots a listener, so it can't catch what only breaks over the wire or against realistically-linked seed data.

### Database
No setup needed for dev: DB config is literal in `docker-compose.yml`, and the password is the committed fake `dev-secrets/db_password`. `.env` is optional (host port overrides only) and never holds secrets. See **Config and secrets** below.

## Architecture

### Backend structure
- `be/src/server.ts` — Express app entry point
- `be/src/app.ts` — Express app assembly (middleware + route mounting)
- `be/src/database.ts` — Prisma client singleton using `@prisma/adapter-pg`
- `be/src/route/` — Express routers; `index.ts` mounts sub-routers at `/api/*`
- `be/src/common/` — shared middleware/error handling
- `be/src/prisma/` — `schema.prisma` (generator/datasource only) + `collection.prisma` (every model), `seed.ts`, `migrations/`. `prisma.config.ts` points `schema` at this *directory*, so Prisma loads both files — `schema.prisma` having no models does not mean there are none.

The models (`user`, `collection`, `collection_share`, `artist`, `album`, `album_artist`, `location`, `source`, `copy`, `want_item`) landed in issue #2 (`be/src/prisma/collection.prisma`). Auth (#11), multiple-collection UI (#14), album art (#15), and external metadata (#16) add behavior and a few extra fields on top of this schema but haven't changed its shape yet — check the issues before assuming beyond what's in the `.prisma` file.

**Ownership (#53).** `owner` is its own model, and a `copy` points at it directly: a record lent to a cousin changes `locationId` while `ownerId` stays put, which deriving the owner from the location could never express. An owner is *not* a user — `owner.userId` is nullable so a grandparent or a kid too young to sign in can own records, and it is indexed rather than unique, so the one-owner-row-per-account rule is enforced in create/update (409) instead of by the DB. `location` now carries a required `collectionId`; two collections sharing one physical shelf are two location rows that happen to share a name. Two deliberate half-measures until a follow-up cleanup migration: `copy.ownerId` is nullable in the column but required by the API (406), because a non-null column cannot be added to a populated table in one step; and `location.ownerId` still exists, unused and unseeded, pending its drop.

Response envelope matches squaretrack's convention (list endpoints always `data: []`, never `null`, HTTP 200; single-resource `data: null` + HTTP 404 when missing; `ValidationError`/`ConflictError`/`NotFoundError`/`AuthError` in `be/src/common/errorHandler.ts` map to 406/409/404/401). Follow it for every new endpoint — see the `artist` CRUD vertical (`be/src/{route,controller,service}/artist*.ts`, issue #3) as the reference implementation.

**Identity (#73, replacing #26's dev stub).** `be/src/common/authorize.ts`'s `identifyUser` (mounted globally in `app.ts`) sets `req.user` from `Authorization: Bearer <token>`: an HS256 token the FE signs with the `internal_api_secret` secret (`be/src/common/internalToken.ts`; ~60 s, max 120 s, `aud`/`iss` checked). It re-reads the user on **every** request, so approve/deny/demote take effect at once. A *service* token (`sub: service:fe`) sets `req.service = 'fe'` and no user; `requireService` gates FE-only routes like `POST /api/auth/sign-in`, the only place users are created (first user on an empty table → active admin, inside a serializable transaction). `x-user-email` still works in `development`/`test` only (`config.devIdentityHeader`), which is what the BE suite and Bruno use. **There is no fallback identity**: nothing presented → 401, and a bad token never falls back to the header. Turnstile is validated BE-side by `verifyTurnstile` (`be/src/common/turnstile.ts`), with automation mode for e2e. `requireActiveUser`/`requireAdmin` gate on that. `be/src/common/policy.ts` is the actual access-control layer:
- `album`/`copy`/`want_item` are collection-scoped (copy via its album) — list results are always filtered to the caller's owned+shared collections (`requireCollectionAccess` for `:id` routes → 404 if inaccessible, masking existence; `requireCollectionAccessForCreate` → 403 on POST into a collection you don't belong to, since you supplied that id yourself). Admins bypass all of it.
- `artist` is global/unscoped — any active user can read/write; delete is `requireAdmin`-gated (403) since one family member shouldn't be able to remove catalog data others depend on.
- `owner` is global/unscoped like `artist` — any active user can read/write; delete is `requireAdmin`-gated (403), since removing an owner strips attribution from copies other family members depend on.
- `location` is collection-scoped too, as of #53 — the list is filtered to accessible collections, `:id` 404s when inaccessible, and POST into someone else's collection is 403. The old `ownerId` rule (and `requireLocationWriteAccess` with it) is gone, along with the "unowned locations are writable by anyone" v1 carve-out. `GET /api/location?collectionId=` narrows the list to one collection, which is what a picker needs (#8).
- `collection` is **read-only** (`GET /api/collection`, `GET /api/collection/:id`, #33) — the list is scoped to owned+shared, `:id` 404s when inaccessible. No collection create/update/delete exists, so "admin can delete a collection they don't own" isn't wired up anywhere yet — noted as a gap in issue #26, not built.

See `be/src/route/*.ts` for how each route wires these in, and the doc comment at the top of `policy.ts` for the resource/action matrix.

**Duplicate check (#13).** `GET /api/album?includeCopies=true` returns each matching album with its `copies`, so "does anyone already own this, and where" is one request rather than one `GET /api/album/:id` per row — that's what the want-list/shopping screen (#8) is built on. It is opt-in because the browse list (#7) never renders copies and shouldn't pay for the join, and *only* adds detail to a result, never a result: copies come through the album relation, so the accessible-collection scope still decides what comes back. A copy's owner is the copy's own `owner` relation (#53), selected down to `{ id, name }` — the `owner` row has no email to leak in the first place, and `location` no longer answers "whose".

**Copy placement.** `album` → `collection` and `location` → `collection` are the same chain, so a copy may not straddle two: `assertLocationInCollection` in `be/src/service/copy.ts` rejects a mismatched `locationId` with a 406 on create, on a move, and on the want-list's mark-as-found. That flow also attributes the new copy to the caller's own owner row when no `ownerId` is given — you usually buy your own records.

### Frontend structure
- `fe/src/app/` — Next.js App Router; the browse UI (#7) lives under the `(app)` group
- `fe/src/lib/` — `api.ts` (server-only API client), `types.ts` (BE response shapes), `filters.ts` (pure helpers)
- `fe/src/ui/` — shared UI components

**All BE data is fetched server-side.** `be/src/app.ts` mounts no CORS middleware, so a browser-direct call to `:5202` would fail; Server Components and Server Actions fetch `${BE_URL}:${BE_PORT_INT}` over the Docker network instead.

**Sign-in (#73, #74).** `fe/src/auth.ts` is Auth.js v5 (pinned `5.0.0-beta.32`) with **JWT sessions** (`auth_secret`): the FE never touches the database. Providers: Google (when configured; required in production), an emailed **magic link** (always), and, in `development`/`test` only, a `dev` credentials provider ("sign in as a seeded user"). Every sign-in goes through BE `POST /api/auth/sign-in` via `lib/backendSignIn.ts` with a service token; Google's Turnstile token rides through the OAuth redirect in the short-lived `vt_turnstile` httpOnly cookie. The session carries only the BE user id.
- `lib/session.ts` is the data-access layer: `requireSessionUserId` → `/sign-in`, `getCurrentUser` (BE `GET /api/auth/me`, any status), `requireActiveUser` → `/pending`, `requireAdmin`. Check access there, next to the data — **not in layouts** (Next 16 guidance; layouts don't re-run on navigation). `ui/UserMenu.tsx` in the layout only displays.
- `lib/api.ts` `apiGet`/`apiPost` call `requireActiveUser`, then sign a ~60 s bearer token (`lib/internalToken.ts`, `internal_api_secret`) per request. The FE never sends `x-user-email`.
- Pages: `/sign-in`, `/pending` (waiting / declined + ask again), `(app)/admin/requests`, `(app)/collection/new`. `ui/Turnstile.tsx` renders the widget explicitly and puts the token in a `turnstileToken` form field; `lib/turnstileKey.ts` swaps in the test site key for a request with the configured `x-automation-key`.
- **Magic links (#74).** The email provider (15 min, single use) requires an adapter, but `lib/authAdapter.ts` only stores and spends verification tokens (hashed by Auth.js) through BE `POST /api/auth/verification-token[/use]`; every lookup (`getUserByEmail`, `getUserByAccount`, `getUser`) misses and `createUser` returns the user the `signIn` callback already resolved via BE sign-in (provider `email`, no Turnstile: the link proves the address). **Setting an adapter puts Google on Auth.js's database path too** (`getUserByAccount`, `linkAccount`), so those are no-ops as well; `authAdapter.test.ts` runs Auth.js's own `handleLoginOrRegister` (imported by path) for both providers so an upgrade that needs more fails a test. Sending is `lib/magicLink.ts` → BE `POST /api/auth/magic-link` (Turnstile action `sign-in`: the sign-in page has one widget for every form, its token copied into each, cleared and replaced after every submit) → mailer. Auth.js hands `sendVerificationRequest` the form fields and the browser's headers, so the Turnstile token, client IP and automation key need no cookie. A failed send is a `MagicLinkError` (an `AuthError`, so Auth.js rethrows it) that the server action turns into `?error=email-<reason>`. `pages.verifyRequest` is `/sign-in/check-email`. Dev compose sets `AUTH_URL`, or Auth.js error redirects use the container's port 4000.
- Server-only FE tests that use `jose` need `// @vitest-environment node` (jsdom's `Uint8Array` is cross-realm). `vitest.config.mts` inlines `next-auth` (it imports `next/server` extensionless), so tests can import it directly.

Browse filters live in `searchParams`, not component state — the list is re-fetched on the server, so filtered views are shareable and the back button works. `CollectionSwitcher`/`FilterBar` are the only client components; everything else is a Server Component.

**Design (#18).** The look comes from `design/wireframes/`, written up in `docs/design-system.md`; squaretrack's copied `design/system/` is gone. Every color token lives in `fe/src/lib/themes.ts` (themes `classic`, `warm`, `dark`); the root layout renders them as CSS vars and sets `<html data-theme>` from the `vt_theme` cookie (no cookie = follow the OS between classic and dark; the header's Theme menu sets it). Tailwind maps them to colors (`bg-surface`, `text-text-muted`) plus `font-display`/`font-sans`/`font-mono`, and `dark:` follows the chosen theme. `themes.test.ts` holds every text/background pair to 4.5:1 in every theme: a new pairing goes in its list, and a color change must keep it green. `ui/colorTokens.test.ts` fails on raw palette utilities (`black/10`, `red-500`) and `[var(--…)]`/`[#hex]` values outside its shrinking `LEGACY` list. UI lives in `fe/src/ui/` so #18 restyles components rather than rewriting pages.

### Config and secrets (#65)
- **Only `be/src/config.ts` and `fe/src/lib/config.ts` read `process.env`.** Everything else calls `getConfig()`. Add new settings there, with a test.
- Config (ports, hosts, `APP_ENV`) is literal in the compose files. Every **secret is a Docker secret file**: secret `<name>` is read from the path in `<NAME>_FILE`, mounted at `/run/secrets/<name>` only into services that list it in `secrets:`. No service uses `env_file`. Dev secrets are committed fakes in `dev-secrets/`; prod secrets live only on the host in `/Users/_vinyltrack/secrets/`.
- Secret names: lowercase `snake_case`, owner first (`db_password`, `google_oauth_client_secret`), no extension, one value per file.
- `APP_ENV` is required (`development`/`test`/`production`). Production — and any unknown value — refuses plain-variable secrets, `AUTOMATION_KEY`/`TURNSTILE_TEST_SECRET_KEY`, and Cloudflare's `1x`/`2x`/`3x` test Turnstile secrets; `x-user-email` is off. Any new dev-only or automation bypass must be added to that refusal list, with a test. `AUTH_BOOTSTRAP_OWNER_EMAIL` is gone and is an error if set.
- The BE has two loaders: `getConfig()` (everything, used by the app) and `getDatabaseConfig()` (APP_ENV + DB only, used by `database.ts` and `prisma.config.ts`), so `migrate`/`seed`/`studio` never need the auth secrets. Auth secrets (`internal_api_secret`, `turnstile_secret_key`) are mounted into `be` only.
- BE tests in `src/tests/` all run `src/tests/setup.ts`, whose `afterAll` needs a live DB — even pure unit tests like `config.test.ts`. Run the suite inside `vinyl.be`.

### Mailer (#62)
- `mailer/` is a third package (Express 5, same toolchain and config pattern as `be`; tests in `mailer/src/tests/`, no DB). It sends **one fixed email** (the sign-in link) through the family Workspace's Gmail API as a dedicated sender user: `POST /magic-link { to, url }` with bearer `mailer_token`, link allowlisted to the app origin, one recipient, 3 per recipient + 30 overall per 15 min, logs the recipient's domain only.
- `GET /health` reflects a Gmail token check (at start, then every 15 min while healthy and every 30 s while not); `invalid_grant` → 503. `deploy.sh` requires every long-running service in the *target release's* `compose.prod.yml` healthy (`compose config --services`, minus `migrate`), so from #62 on **a revoked Gmail grant blocks releases until re-authorised** (`npm run authorize`, runbook in `docs/hosting-maintenance.md`); rollbacks to pre-#62 releases check only the services those releases have.
- `MAILER_MODE=log` (dev/test) prints links instead of sending; production refuses it. Dev compose runs the mailer in log mode.
- Network: `mailnet` (`internal: true`) holds only `be` and `mailer`; prod `mailer` also joins `egress` (any destination: known gap). `be` gets `MAILER_URL` + `mailer_token`; its only caller is `be/src/common/mailerClient.ts` (#74), which waits 45 s (longer than the mailer's worst case) and logs every failure by status or error name.

### Release and deploy (#60)
- **A `v*` tag is a release**; nothing deploys from `main`. `release.yml` re-runs `ci.yml` (`workflow_call`) on the tagged commit, builds arm64 images to GHCR, creates the GitHub Release with `compose.prod.yml` attached, then calls `deploy.yml`, which waits for approval on the `production` environment. Redeploy/rollback: `gh workflow run deploy.yml --ref <tag> [-f action=rollback]`. Runbook: `docs/hosting-deploy.md`.
- The git tag is the only version (`VINYLTRACK_VERSION`, baked in at build, reported by `/api/health`). Don't bump `package.json` versions. **No release candidates:** a new feature starts a new minor (`v0.3.0`), further releases while that feature is being built bump the patch (`v0.3.1`), the next feature gets the next minor. Tags are annotated (`git tag -m vX.Y.Z vX.Y.Z`).
- `Dockerfile.be`/`Dockerfile.fe`: `dev` must stay the first stage (`docker-compose.yml` pins `target: dev`); `prod`/`migrate` run on distroless (no shell, `node` at `/nodejs/bin/node`). CI's `images` job builds them on every PR.
- `host/libexec/deploy-shell` (sshd `ForceCommand` for `_vinyldeploy`) and `deploy.sh` run on the server under macOS `/bin/bash` 3.2 — no bash 4 features. Tests: `npx bats@1.11.1 host/tests` (sourced, with `docker`/`sudo`/`curl` stubbed as functions); CI also runs shellcheck. Changing them means reinstalling on the server.

### Prisma setup
The backend uses `@prisma/adapter-pg` (not the default Prisma driver). After any schema change, run `npm run migrate` in `be/`.

## Repo skills — read these before writing a commit, PR, or review

**`.claude/skills/` holds this repo's own skills. Check it at the start of a session.** They are house conventions, not suggestions: commits, PR bodies, and review comments in this repo are expected to follow them. A remote/web session may not register them as invocable `/slash` commands (skills load at session start, so a branch that *adds* them lands too late) — in that case read the `SKILL.md` directly and follow it by hand. Don't fall back to generic style because the slash command didn't appear.

| skill | use it for |
| --- | --- |
| `caveman` | the terse house voice; `full` is the default level. Chat replies only revert with "stop caveman"/"normal mode" |
| `caveman-commit` | every commit message. Conventional Commits, ≤50-char subject, body only when the *why* isn't obvious |
| `caveman-pr` | every PR body. Fixed skeleton — lead, what/how, optional behavior table, test/verify, note, then `Closes`/`Refs #N` as the last line, nothing after it. `Refs` (not `Closes`) when the PR advances an issue without finishing it |
| `caveman-review` | PR review comments. One line each: `L42: 🔴 bug: <problem>. <fix>.` |
| `caveman-help` | the reference card for the above |
| `prisma-migrate` | schema changes and migrations |

The voice rule that matters most: caveman the *prose*, never the facts. File paths, identifiers, routes, shell commands, counts, and issue refs are copied exactly. Both `caveman` and `caveman-pr` also carry an Auto-Clarity rule — drop the grunts entirely for breaking changes, security fixes, data migrations, and anything where a misread is costly.

**No AI attribution, anywhere.** Commits carry no `Co-Authored-By:`/`Claude-Session:` trailer and PR bodies carry no "Generated with Claude Code" line — `caveman-commit` and `caveman-pr` both say so. Claude Code adds that text by default, so it is turned off in settings (`attribution.commit: ""`, `attribution.pr: ""`, `attribution.sessionUrl: false`) rather than stripped by hand. If a trailer shows up anyway, the session predates the setting — a session reads settings at start, so it won't pick up a mid-session change.

## Process rules for this repo

- **TDD-first**: lead every feature/bugfix with a failing test, then implement to green. A passing typecheck/build is not a substitute for a test.
- **Design → review → plan → approve → TDD**: for any non-trivial feature, write up the design/approach first (this usually means a GitHub issue, iterated on) and get it reviewed before breaking it into implementation tasks. Get the task breakdown approved before writing code. TDD governs the coding step once a plan is approved — it isn't a replacement for the design/planning step.

## Typecheck & lint configs

Both packages run `tsc --noEmit` and ESLint flat-config in CI (`.github/workflows/ci.yml`).

**TypeScript strict flags enabled in both `be/tsconfig.json` and `fe/tsconfig.json`:**
- `strict`
- `noUnusedLocals`, `noUnusedParameters` — prefix intentionally-unused args with `_` (e.g. Express middleware `_req`, `_res`)
- `noFallthroughCasesInSwitch`
- `noImplicitOverride`

**ESLint:** `--max-warnings 0` in both packages. `@typescript-eslint/consistent-type-imports` enforced. FE also runs `react-hooks/exhaustive-deps` as error.

**BE module setup:** `"type": "module"` + `"module": "NodeNext"`. Relative imports require `.js` extensions. Scripts use `tsx`.
