#!/bin/bash
# SessionStart hook for Claude Code cloud sessions. The cloud container has no
# Docker, so this stands in for the parts of `docker compose up` that tests
# need: npm deps in be/fe/mailer, a local Postgres, migrations and the seed.
# Long-running services (be, mailer, fe) are not started here: hook children
# don't outlive the hook reliably. `.claude/hooks/cloud-stack.sh up` does that.
#
# Values come from the committed fakes in dev-secrets/, the same as dev compose.
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
SECRETS="$ROOT/dev-secrets"

# npm ci only when the lockfile changed since the last install: a cached
# container keeps node_modules, and npm install could rewrite the lockfile (#44).
for pkg in be fe mailer; do
  dir="$ROOT/$pkg"
  stamp="$dir/node_modules/.vt-lock-sha"
  want="$(sha256sum "$dir/package-lock.json" | cut -d' ' -f1)"
  if [ "$(cat "$stamp" 2>/dev/null || true)" != "$want" ]; then
    echo "session-start: npm ci in $pkg" >&2
    (cd "$dir" && npm ci --no-audit --no-fund >&2)
    echo "$want" > "$stamp"
  fi
done

# BE env, as CI's `be` job has it, but with dev-secrets/ files. Persisted so
# `cd be && npm run test` (whose setup.ts needs a live DB) and Prisma work as-is.
# cloud-stack.sh sets each service's own env on top of this.
BE_ENV=(
  "APP_ENV=test"
  "DB_HOST=localhost"
  "DB_PORT_INT=5432"
  "DB_VINYLTRACK_NAME=vinyltrack"
  "DB_VINYLTRACK_USER=vinyltrack"
  "DB_PASSWORD_FILE=$SECRETS/db_password"
  "PUBLIC_HOSTNAME=localhost"
  "INTERNAL_API_SECRET_FILE=$SECRETS/internal_api_secret"
  "TURNSTILE_SECRET_KEY_FILE=$SECRETS/turnstile_secret_key"
  "MAILER_URL=http://localhost:5299"
  "MAILER_TOKEN_FILE=$SECRETS/mailer_token"
  # Playwright otherwise forces localhost through the agent proxy, which 405s.
  "PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1"
)
for kv in "${BE_ENV[@]}"; do
  export "${kv?}"
  [ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export ${kv%%=*}='${kv#*=}'" >> "$CLAUDE_ENV_FILE"
done

# Postgres: whatever the image ships (16 today; dev compose uses 17).
if ! command -v pg_ctlcluster > /dev/null; then
  echo "session-start: no Postgres in this image, skipping DB setup" >&2
  exit 0
fi
service postgresql start >&2
for _ in $(seq 1 30); do pg_isready -q -h localhost && break; sleep 1; done

PW="$(cat "$SECRETS/db_password")"
su postgres -c "psql -v ON_ERROR_STOP=1 -q" >&2 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vinyltrack') THEN
    CREATE ROLE vinyltrack;
  END IF;
END \$\$;
-- Every run, so a role left by an earlier hand setup matches dev-secrets/.
ALTER ROLE vinyltrack LOGIN SUPERUSER PASSWORD '$PW';
SQL
su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname = 'vinyltrack'\"" | grep -q 1 \
  || su postgres -c "createdb -O vinyltrack vinyltrack" >&2

# Seed wipes and refills its own tables, so it is safe on every start.
cd "$ROOT/be"
npx prisma generate >&2
npx prisma migrate deploy >&2
npx prisma db seed >&2
echo "session-start: deps, Postgres, migrations and seed ready" >&2
