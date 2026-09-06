---
name: prisma-migrate
description: >
  Handles Prisma schema changes, migrations, and client generation for the vinylTrack BE.
  All Prisma commands run inside the vinyl.be Docker container — never on the host.
  Use when user says "run migration", "migrate", "prisma migrate", "update schema",
  "generate prisma client", "prisma generate", or makes schema changes to .prisma files.
---

## Rules

**All Prisma commands run inside Docker.**

```bash
docker exec vinyl.be sh -c "cd /app && npx prisma <command>"
```

Never run `npx prisma` on the host. `DB_VINYLTRACK_URL` in the repo-root `.env` points at
the hostname `vinyl.db`, which only resolves on the `vinylnet` docker network — from the
host it does not resolve at all. The container also has the `prisma.config.ts` that points
at `src/prisma` (the schema directory).

`be/package.json` does define `npm run migrate` (`npx prisma migrate dev`), but it runs on
the host and only works if you point `DB_VINYLTRACK_URL` at `localhost:${DB_PORT_EXT}`
(5204) first. Prefer the container.

**Two one-shot compose services already exist** — use them rather than hand-rolling the
equivalent `docker exec`:

```bash
docker compose run --rm migrate   # npx prisma migrate deploy
docker compose run --rm seed      # npx prisma db seed (waits for migrate)
```

---

## Workflow: schema change → migration → generate → verify

### 1. Edit schema

Edit `.prisma` files in `be/src/prisma/`. The schema is split across more than one file —
all are loaded because `prisma.config.ts` sets `schema: 'src/prisma'` (directory, not a
single file).

Files:
- `be/src/prisma/schema.prisma` — generator + datasource only, no models
- `be/src/prisma/collection.prisma` — every model (`user`, `collection`, `collection_share`,
  `artist`, `album`, `album_artist`, `location`, `source`, `copy`, `want_item`)

`schema.prisma` having no models does not mean there are none — check `collection.prisma`
before concluding anything is unimplemented.

### 2. Create and apply migration

```bash
docker exec vinyl.be sh -c "cd /app && npx prisma migrate dev --name <descriptive_name>"
```

`migrate dev` creates a migration SQL file in `src/prisma/migrations/` AND applies it AND
regenerates the client. One command does all three.

**If `migrate dev` fails with P3014 (shadow database error):**

The DB user needs CREATE DATABASE permission:
```bash
docker exec vinyl.db psql -U vinyltrack -d vinyltrack -c "ALTER USER vinyltrack CREATEDB;"
```
Usually a no-op here: the postgres image makes `POSTGRES_USER` (`vinyltrack`) the superuser,
so it already has CREATEDB — and there is no separate `postgres` role to connect as.

**If a collation version warning blocks the shadow DB:**
```bash
docker exec vinyl.db psql -U vinyltrack -d vinyltrack -c "UPDATE pg_database SET datcollversion = NULL WHERE datname IN ('template1', 'template0', 'postgres', 'vinyltrack');"
```

**If tables have data that would be dropped/altered destructively:** truncate them first
(dev only — confirm with the user before truncating).

### 3. Generate client only (no schema change)

Use when the Prisma client is out of sync but schema/DB are already in sync:

```bash
docker exec vinyl.be sh -c "cd /app && npx prisma generate"
```

Output goes to `be/src/generated/client` (set by the `generator` block), not `node_modules`.

### 4. Deploy migrations (CI / production)

```bash
docker compose run --rm migrate
```

`migrate deploy` applies all pending migrations without creating new ones. No shadow DB
needed. Safe for non-interactive environments. CI runs the same step directly as
`npx prisma migrate deploy` against a service container (see `.github/workflows/ci.yml`).

### 5. Reseed after a schema change

```bash
docker compose run --rm seed
```

Wipe-and-replace, safe to re-run. The Bruno collection (`cd be && npm run test:api`) asserts
against seeded rows, so a schema change usually means reseeding before the API tests pass.

### 6. Restart BE after generate

The BE uses nodemon + tsx and hot-reloads source changes. A newly generated Prisma client
still needs a restart to be picked up:

```bash
docker compose restart be
```

Verify it started:
```bash
docker logs vinyl.be 2>&1 | tail -5
```

---

## Migration history pitfalls

- **Never delete a migration file that has been applied to any DB** — use
  `prisma migrate resolve --rolled-back <name>` if a migration needs to be undone.
- **If `_prisma_migrations` is out of sync with migration files:** delete the stale row from
  `_prisma_migrations` and re-run `migrate deploy` to reapply.
- **`0_init` baseline pattern:** only needed when an existing DB has no migration history.
  Create a baseline with
  `migrate diff --from-empty --to-config-datasource --script > 0_init/migration.sql`
  then mark it applied with `migrate resolve --applied 0_init`.

---

## prisma.config.ts

```ts
export default defineConfig({
  schema: 'src/prisma',           // directory — loads all .prisma files
  migrations: {
    path: 'src/prisma/migrations',
    seed: 'tsx src/prisma/seed.ts',
  },
  datasource: {
    url: env('DB_VINYLTRACK_URL'),
  },
})
```

`schema` must point to the **directory**, not `schema.prisma`. Pointing at the file makes
`migrate` miss the other `.prisma` files and generate drop-everything migrations.

---

## Quick reference

Containers: `vinyl.be` (API), `vinyl.db` (Postgres 17), `vinyl.fe`, `vinyl.studio`, plus
one-shot `vinyl.migrate` / `vinyl.seed`. Ports: FE 5201, BE 5202, Studio 5203, DB 5204.

| Goal | Command |
|---|---|
| New schema changes → migration + apply + generate | `migrate dev --name <name>` |
| Apply existing migrations (deploy/CI) | `docker compose run --rm migrate` |
| Reseed dev data | `docker compose run --rm seed` |
| Regenerate client only | `prisma generate` |
| See pending migrations | `migrate status` |
| Mark a migration as applied (no SQL run) | `migrate resolve --applied <name>` |
| Generate diff SQL without applying | `migrate diff --from-config-datasource --to-schema src/prisma --script` |
| Check DB tables | `docker exec vinyl.db psql -U vinyltrack -d vinyltrack -c "\dt"` |

Names come from `.env` (`DB_VINYLTRACK_USER`, `DB_VINYLTRACK_NAME`, `DB_PORT_INT`,
`DB_PORT_EXT`) — the values above are the `.env.example` defaults.
