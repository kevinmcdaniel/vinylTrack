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
- `be/src/database.ts` — Prisma client singleton (via `@prisma/adapter-pg`, not Prisma's default driver)
- `be/src/route/` — routers, mounted under `/api/*` from `route/index.ts`
- `be/src/common/` — shared middleware (error handling, auth once #11 lands)
- `be/src/prisma/` — schema, migrations, seed script

The domain schema is **not yet implemented** — `schema.prisma` currently has no models. See [issue #2](https://github.com/kevinmcdaniel/vinylTrack/issues/2) for the planned `user`/`collection`/`artist`/`album`/`copy`/`location`/`want_item` model, extended by later issues (auth/sharing, album art, external metadata).

## Frontend

- `fe/src/app/` — Next.js App Router
- `fe/src/app/docs/` — this docs viewer (reads markdown from repo-root `docs/`)

## Local dev

`docker compose up` brings up the full stack: FE on 5201, BE on 5202, Prisma Studio on 5203, Postgres on 5204. Containers are prefixed `vinyl.*` and use the `vinylnet` docker network (`10.18.0.0/24`) — deliberately distinct from squaretrack's `square.*`/`squarenet` so both stacks can run on the same machine at once.

CI (`.github/workflows/ci.yml`) runs `typecheck` + `lint` for both packages on every push/PR to `main`.
