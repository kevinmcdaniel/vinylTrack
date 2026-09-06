# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

vinylTrack is a family record/album/MP3 collection tracker. It supports more than one named **collection** (Vinyl, Square Dance Calls, General MP3s, …), each with its own artists, releases, physical/digital copies, locations, and a want list. It's a shared app across family members (Google sign-in, per-user access, sharing between specific people) and across devices (phone/tablet/computer), with offline support planned for later.

Full design history and the up-to-date plan live in the GitHub issue tracker — issues #1–#18 (as of this writing) cover scaffold, schema, APIs, UI, auth, hosting, album art, external metadata lookup, and design system adaptation. Treat the issues as the living spec; this file documents what's actually been built.

See also [docs/](./docs/README.md) — the human-facing companion to this file (architecture, dev process, design brief), rendered in-app at `/docs`.

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
Bruno collection covering every resource over HTTP, with assertions on status and response envelope. One folder per resource, ordered by dependency (collection → artist → location → album → copy → want → cleanup); ids chain through runtime vars and the `cleanup` folder removes everything a run creates, so runs are idempotent. Identity is the `x-user-email` dev header driven by an env var (`ownerEmail`/`adminEmail`/`sharedEmail`/`outsiderEmail`/`unknownEmail` mapping to the seeded users), which is what makes the #26 access rules testable from outside the process. **The seeded owner (`kevin`) is deliberately not an admin** — admin is a separate seeded user owning nothing — so "owner" requests exercise the real access rules rather than the admin bypass. This is a *complement* to `npm run test`, not a replacement — supertest never boots a listener, so it can't catch what only breaks over the wire or against realistically-linked seed data.

### Database
Connection config lives in `.env` at the repo root (copy `.env.example`).

## Architecture

### Backend structure
- `be/src/server.ts` — Express app entry point
- `be/src/app.ts` — Express app assembly (middleware + route mounting)
- `be/src/database.ts` — Prisma client singleton using `@prisma/adapter-pg`
- `be/src/route/` — Express routers; `index.ts` mounts sub-routers at `/api/*`
- `be/src/common/` — shared middleware/error handling
- `be/src/prisma/` — `schema.prisma` (generator/datasource) + `collection.prisma` (domain models), `seed.ts`, `migrations/`

The domain schema (`user`, `collection`, `collection_share`, `artist`, `album`, `album_artist`, `location`, `source`, `copy`, `want_item`) landed in issue #2 (`be/src/prisma/collection.prisma`). Auth (#11), multiple-collection UI (#14), album art (#15), and external metadata (#16) add behavior and a few extra fields on top of this schema but haven't changed its shape yet — check the issues before assuming beyond what's in the `.prisma` file.

Response envelope matches squaretrack's convention (list endpoints always `data: []`, never `null`, HTTP 200; single-resource `data: null` + HTTP 404 when missing; `ValidationError`/`ConflictError`/`NotFoundError`/`AuthError` in `be/src/common/errorHandler.ts` map to 406/409/404/401). Follow it for every new endpoint — see the `artist` CRUD vertical (`be/src/{route,controller,service}/artist*.ts`, issue #3) as the reference implementation.

**Authorization scaffolding is real, not a no-op stub** (#26, ahead of #11's real Google OAuth). `be/src/common/authorize.ts`'s `identifyUser` middleware (mounted globally in `app.ts`) resolves `req.user` from an `x-user-email` dev header against the seeded `user` table, falling back to `AUTH_BOOTSTRAP_OWNER_EMAIL` when no header is sent — that's the *only* thing #11 needs to replace (swap the header lookup for a real JWT/session decode; nothing downstream should change). `requireActiveUser`/`requireAdmin` gate on that. `be/src/common/policy.ts` is the actual access-control layer:
- `album`/`copy`/`want_item` are collection-scoped (copy via its album) — list results are always filtered to the caller's owned+shared collections (`requireCollectionAccess` for `:id` routes → 404 if inaccessible, masking existence; `requireCollectionAccessForCreate` → 403 on POST into a collection you don't belong to, since you supplied that id yourself). Admins bypass all of it.
- `artist` is global/unscoped — any active user can read/write; delete is `requireAdmin`-gated (403) since one family member shouldn't be able to remove catalog data others depend on.
- `location` has no `collectionId` — write access follows `ownerId` (owner or admin only; unowned locations are writable by any active user for v1). Read is open to any active user.
- `collection` is **read-only** (`GET /api/collection`, `GET /api/collection/:id`, #33) — the list is scoped to owned+shared, `:id` 404s when inaccessible. No collection create/update/delete exists, so "admin can delete a collection they don't own" isn't wired up anywhere yet — noted as a gap in issue #26, not built.

See `be/src/route/*.ts` for how each route wires these in, and the doc comment at the top of `policy.ts` for the resource/action matrix.

**Duplicate check (#13).** `GET /api/album?includeCopies=true` returns each matching album with its `copies`, so "does anyone already own this, and where" is one request rather than one `GET /api/album/:id` per row — that's what the want-list/shopping screen (#8) is built on. It is opt-in because the browse list (#7) never renders copies and shouldn't pay for the join, and *only* adds detail to a result, never a result: copies come through the album relation, so the accessible-collection scope still decides what comes back. A copy's owner is `location.owner` (`copy` has no owner of its own), selected down to `{ id, name }` — never the `user` row, which carries an email.

### Frontend structure
- `fe/src/app/` — Next.js App Router; the browse UI (#7) lives under the `(app)` group
- `fe/src/lib/` — `api.ts` (server-only API client), `types.ts` (BE response shapes), `filters.ts` (pure helpers)
- `fe/src/ui/` — shared UI components

**All BE data is fetched server-side.** `be/src/app.ts` mounts no CORS middleware, so a browser-direct call to `:5202` would fail; Server Components fetch `${BE_URL}:${BE_PORT_INT}` over the Docker network instead, which also keeps the `x-user-email` dev header off the client. `apiGet` in `fe/src/lib/api.ts` is the single place #11 swaps the dev identity for a real session.

Browse filters live in `searchParams`, not component state — the list is re-fetched on the server, so filtered views are shareable and the back button works. `CollectionSwitcher`/`FilterBar` are the only client components; everything else is a Server Component.

The copied design system in `design/system/` is **not** wired in — it's still squaretrack's, pending #18. The browse UI is plain Tailwind on the `--background`/`--foreground` tokens, factored into `fe/src/ui/` so #18 restyles components rather than rewriting pages.

### Prisma setup
The backend uses `@prisma/adapter-pg` (not the default Prisma driver). After any schema change, run `npm run migrate` in `be/`.

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
