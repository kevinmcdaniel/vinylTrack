---
name: prisma-migrate
description: >
  Handles Prisma schema changes, migrations, and client generation for the squaretrack BE.
  All Prisma commands run inside the square.be Docker container — never on the host.
  Use when user says "run migration", "migrate", "prisma migrate", "update schema",
  "generate prisma client", "prisma generate", or makes schema changes to .prisma files.
---

## Rules

**All Prisma commands run inside Docker.**

```bash
docker exec square.be sh -c "cd /app && npx prisma <command>"
```

Never run `npx prisma` on the host. The BE container has the correct DB connection string (`square.db:5432`) and the `prisma.config.ts` that points to `src/prisma` (the schema directory).

---

## Workflow: schema change → migration → generate → verify

### 1. Edit schema

Edit `.prisma` files in `be/src/prisma/`. Schema is split across multiple files — all are loaded because `prisma.config.ts` sets `schema: 'src/prisma'` (directory, not single file).

Key files:
- `be/src/prisma/schema.prisma` — generator + datasource config
- `be/src/prisma/calls.prisma` — calls domain models
- `be/src/prisma/people.prisma` — people domain models

### 2. Create and apply migration

```bash
docker exec square.be sh -c "cd /app && npx prisma migrate dev --name <descriptive_name>"
```

`migrate dev` creates a migration SQL file in `src/prisma/migrations/` AND applies it AND regenerates the client. One command does all three.

**If `migrate dev` fails with P3014 (shadow database error):**

The squaretrack user needs CREATE DATABASE permission. Grant it once:
```bash
docker exec square.db psql -U postgres -c "ALTER USER squaretrack CREATEDB;"
```

**If there is a collation version warning that blocks the shadow DB:**
```bash
docker exec square.db psql -U postgres -c "UPDATE pg_database SET datcollversion = NULL WHERE datname IN ('template1', 'template0', 'postgres', 'squaretrack');"
```

**If tables have data that would be dropped/altered destructively:** truncate them first (dev only — confirm with user before truncating).

### 3. Generate client only (no schema change)

Use when Prisma client is out of sync but schema/DB are already in sync:

```bash
docker exec square.be sh -c "cd /app && npx prisma generate"
```

### 4. Deploy migrations (CI / production)

```bash
docker exec square.be sh -c "cd /app && npx prisma migrate deploy"
```

`migrate deploy` applies all pending migrations without creating new ones. No shadow DB needed. Safe for non-interactive environments.

### 5. Restart BE after generate

The BE uses nodemon + tsx and hot-reloads source changes. However, a newly generated Prisma client requires a restart to be picked up:

```bash
docker compose restart be
```

Verify it started:
```bash
docker logs square.be 2>&1 | tail -5
```

---

## Migration history pitfalls

- **Never delete a migration file that has been applied to any DB** — use `prisma migrate resolve --rolled-back <name>` if a migration needs to be undone.
- **If `_prisma_migrations` is out of sync with migration files:** delete the stale row from `_prisma_migrations` and re-run `migrate deploy` to reapply.
- **`0_init` baseline pattern:** only needed when an existing DB has no migration history. Create a baseline with `migrate diff --from-empty --to-config-datasource --script > 0_init/migration.sql` then mark applied with `migrate resolve --applied 0_init`.

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
    url: env('DB_SQUARETRACK_URL'),
  },
})
```

`schema` must point to the **directory**, not `schema.prisma`. Pointing to the file causes `migrate` to miss the other `.prisma` files and generate drop-everything migrations.

---

## Quick reference

| Goal | Command |
|---|---|
| New schema changes → migration + apply + generate | `migrate dev --name <name>` |
| Apply existing migrations (deploy/CI) | `migrate deploy` |
| Regenerate client only | `prisma generate` |
| See pending migrations | `migrate status` |
| Mark a migration as applied (no SQL run) | `migrate resolve --applied <name>` |
| Generate diff SQL without applying | `migrate diff --from-config-datasource --to-schema src/prisma --script` |
| Check DB tables | `docker exec square.db psql -U squaretrack -d squaretrack -c "\dt"` |
