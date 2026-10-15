#!/bin/bash
# Run the dev stack in a Claude Code cloud session, where there is no Docker:
#   .claude/hooks/cloud-stack.sh up|down|status
# Same ports and settings as docker-compose.yml: fe 5201, be 5202, Postgres
# 5432 (started by session-start.sh), mailer 5299 in log mode. Logs and pids go
# to $VT_STACK_DIR (default /tmp/vinyltrack-stack). Magic links land in mailer.log.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SECRETS="$ROOT/dev-secrets"
RUN="${VT_STACK_DIR:-/tmp/vinyltrack-stack}"
mkdir -p "$RUN"

DB_ENV=(DB_HOST=localhost DB_PORT_INT=5432 DB_VINYLTRACK_NAME=vinyltrack DB_VINYLTRACK_USER=vinyltrack
  "DB_PASSWORD_FILE=$SECRETS/db_password")

health() { curl -fs -o /dev/null --max-time 2 "$1"; }

start() { # name dir health-url cmd...
  local name=$1 dir=$2 url=$3; shift 3
  if health "$url"; then echo "$name: already up"; return; fi
  # setsid: its own process group, which records its leader's pid for `down`.
  (cd "$dir" && nohup setsid bash -c 'echo $$ > "$0"; exec "$@"' "$RUN/$name.pid" "$@" > "$RUN/$name.log" 2>&1 &)
  for _ in $(seq 1 90); do
    if health "$url"; then echo "$name: up ($url)"; return; fi
    sleep 1
  done
  echo "$name: no answer from $url after 90s, see $RUN/$name.log" >&2
  tail -n 20 "$RUN/$name.log" >&2
  return 1
}

stop() {
  local name=$1 pid
  pid="$(cat "$RUN/$name.pid" 2>/dev/null || true)"
  if [ -n "$pid" ] && kill -0 "$pid" 2> /dev/null; then
    # npx/tsx/next spawn children; take down the whole process group.
    kill -- -"$pid" 2> /dev/null || kill "$pid"
    echo "$name: stopped"
  fi
  rm -f "$RUN/$name.pid"
}

case "${1:-}" in
  up)
    service postgresql status > /dev/null 2>&1 || service postgresql start
    start mailer "$ROOT/mailer" http://localhost:5299/health \
      env APP_ENV=development PORT=5299 PUBLIC_HOSTNAME=localhost MAILER_MODE=log \
      MAILER_FROM=vinyltrack@example.org FE_PORT_EXT=5201 "MAILER_TOKEN_FILE=$SECRETS/mailer_token" \
      npx tsx src/server.ts
    # Turnstile as dev compose has it: always-pass secret for the browser widget,
    # plus automation mode so `cd be && npm run test:api` (Bruno) passes in full.
    start be "$ROOT/be" http://localhost:5202/api/health \
      env APP_ENV=development NODE_ENV=development PORT=5202 PUBLIC_HOSTNAME=localhost "${DB_ENV[@]}" \
      "INTERNAL_API_SECRET_FILE=$SECRETS/internal_api_secret" \
      "TURNSTILE_SECRET_KEY_FILE=$SECRETS/turnstile_secret_key" \
      "AUTOMATION_KEY_FILE=$SECRETS/automation_key" \
      TURNSTILE_TEST_SECRET_KEY=1x0000000000000000000000000000000AA \
      MAILER_URL=http://localhost:5299 "MAILER_TOKEN_FILE=$SECRETS/mailer_token" \
      npx tsx src/server.ts
    # docsFs reads <cwd>/docs, which compose mounts; link it, kept out of git.
    [ -e "$ROOT/fe/docs" ] || ln -s ../docs "$ROOT/fe/docs"
    grep -qx '/fe/docs' "$ROOT/.git/info/exclude" 2> /dev/null || echo '/fe/docs' >> "$ROOT/.git/info/exclude"
    start fe "$ROOT/fe" http://localhost:5201/api/health \
      env -u PORT APP_ENV=development NODE_ENV=development BE_URL=http://localhost BE_PORT_INT=5202 \
      PUBLIC_HOSTNAME=localhost AUTH_URL=http://localhost:5201 TURNSTILE_SITE_KEY=1x00000000000000000000AA \
      "AUTH_SECRET_FILE=$SECRETS/auth_secret" "INTERNAL_API_SECRET_FILE=$SECRETS/internal_api_secret" \
      npx next dev -p 5201
    echo "stack up: fe http://localhost:5201  logs $RUN/*.log"
    echo "note: next dev may rewrite fe/tsconfig.json; don't commit that"
    ;;
  down)
    for s in fe be mailer; do stop "$s"; done
    ;;
  status)
    for s in "mailer http://localhost:5299/health" "be http://localhost:5202/api/health" "fe http://localhost:5201/api/health"; do
      set -- $s
      if health "$2"; then echo "$1: up"; else echo "$1: down"; fi
    done
    pg_isready -q -h localhost && echo "postgres: up" || echo "postgres: down"
    ;;
  *)
    echo "usage: $0 up|down|status" >&2
    exit 2
    ;;
esac
