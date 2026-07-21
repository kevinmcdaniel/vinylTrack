# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

vinylTrack is a family record/album/MP3 collection tracker. It supports more than one named **collection** (Vinyl, Square Dance Calls, General MP3s, …), each with its own artists, releases, physical/digital copies, locations, and a want list. It's a shared app across family members (Google sign-in, per-user access, sharing between specific people) and across devices (phone/tablet/computer), with offline support planned for later.

Full design history and the up-to-date plan live in the GitHub issue tracker — issues #1–#17 (as of this writing) cover scaffold, schema, APIs, UI, auth, hosting, album art, and external metadata lookup. Treat the issues as the living spec; this file documents what's actually been built.

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
```

### Database
Connection config lives in `.env` at the repo root (copy `.env.example`).

## Architecture

### Backend structure
- `be/src/server.ts` — Express app entry point
- `be/src/app.ts` — Express app assembly (middleware + route mounting)
- `be/src/database.ts` — Prisma client singleton using `@prisma/adapter-pg`
- `be/src/route/` — Express routers; `index.ts` mounts sub-routers at `/api/*`
- `be/src/common/` — shared middleware/error handling
- `be/src/prisma/` — schema (currently empty — see issue #2), `seed.ts`, `migrations/`

The domain schema (`user`, `collection`, `artist`, `album`, `copy`, `location`, `want_item`, etc.) is designed in issue #2 and its follow-ups (#11 auth/sharing, #14 multiple collections, #15 album art, #16 external metadata) but not yet implemented in code — check the issues before assuming any of these models exist.

### Frontend structure
- `fe/src/app/` — Next.js App Router
- `fe/src/ui/` — shared UI components (not yet created)

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
