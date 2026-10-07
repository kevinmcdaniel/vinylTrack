#!/usr/bin/env bats
# deploy.sh runs as _vinyltrack and does the actual deploy (#60). Sourced, not
# executed: `docker`, `curl`, `sleep` and `logger` are stubbed as functions
# that record their calls, and ROOT points at a temp dir.

setup() {
  # shellcheck source=../libexec/deploy.sh
  source "$BATS_TEST_DIRNAME/../libexec/deploy.sh"
  ROOT="$BATS_TEST_TMPDIR/root"
  mkdir -p "$ROOT"
  CALLS="$BATS_TEST_TMPDIR/calls"
  : > "$CALLS"
  HEALTH="healthy"        # what `docker inspect` reports for every service
  FAIL_ON=""              # a docker subcommand (e.g. "migrate") that should fail
  FETCH_FAILS=""

  docker() {
    echo "VERSION=${VINYLTRACK_VERSION:-} docker $*" >> "$CALLS"
    local last="${!#}"
    case "$*" in
      inspect*) echo "$HEALTH" ;;
      *" ps -q "*) echo "id-$last" ;;
      *"exec -T db pg_dump"*) echo "-- dump" ;;
    esac
    if [ -n "$FAIL_ON" ] && [[ "$*" == *"$FAIL_ON"* ]]; then return 1; fi
    return 0
  }
  curl() {
    echo "curl $*" >> "$CALLS"
    [ -z "$FETCH_FAILS" ] || return 22
    local out=""
    while [ $# -gt 0 ]; do [ "$1" = "-o" ] && out="$2"; shift; done
    echo "services: {}" > "$out"
  }
  sleep() { :; }
  logger() { :; }
}

deployed() { echo "$1" > "$ROOT/current-version"; mkdir -p "$ROOT/releases/$1"; echo "services: {}" > "$ROOT/releases/$1/compose.prod.yml"; }
line_of() { grep -n -- "$1" "$CALLS" | head -1 | cut -d: -f1; }

# ── deploy ───────────────────────────────────────────────────────────────

@test "deploy fetches compose.prod.yml from the tag's GitHub Release" {
  run main deploy v1.2.3
  [ "$status" -eq 0 ]
  grep -q "curl .*https://github.com/kevinmcdaniel/vinylTrack/releases/download/v1.2.3/compose.prod.yml" "$CALLS"
  [ -f "$ROOT/releases/v1.2.3/compose.prod.yml" ]
}

@test "deploy runs pull, migrate, up in order, as project vinyltrack, with the tag as VINYLTRACK_VERSION" {
  run main deploy v1.2.3
  [ "$status" -eq 0 ]
  local pull migrate up
  pull=$(line_of "compose .* pull")
  migrate=$(line_of "run --rm migrate")
  up=$(line_of "up -d")
  [ -n "$pull" ] && [ -n "$migrate" ] && [ -n "$up" ]
  [ "$pull" -lt "$migrate" ] && [ "$migrate" -lt "$up" ]
  ! grep "docker compose" "$CALLS" | grep -v -- "-p vinyltrack" | grep -q .
  ! grep "docker compose" "$CALLS" | grep -v "^VERSION=v1.2.3 " | grep -q .
}

@test "deploy reads host config from ROOT/.env when it exists" {
  touch "$ROOT/.env"
  run main deploy v1.2.3
  grep -q -- "--env-file $ROOT/.env" "$CALLS"
}

@test "first deploy skips the backup (nothing running yet)" {
  run main deploy v1.2.3
  [ "$status" -eq 0 ]
  ! grep -q "pg_dump" "$CALLS"
}

@test "a later deploy dumps the database before pulling anything" {
  deployed v1.2.2
  run main deploy v1.2.3
  [ "$status" -eq 0 ]
  [ "$(line_of pg_dump)" -lt "$(line_of "compose .* pull")" ]
  grep -q -- "-f $ROOT/releases/v1.2.2/compose.prod.yml exec -T db pg_dump" "$CALLS"
  ls "$ROOT"/backups/pre-v1.2.3-*.sql.gz >/dev/null
}

@test "success records the new version" {
  deployed v1.2.2
  run main deploy v1.2.3
  [ "$status" -eq 0 ]
  [ "$(cat "$ROOT/current-version")" = "v1.2.3" ]
}

@test "unhealthy after deploy fails the run and keeps the old version recorded" {
  deployed v1.2.2
  HEALTH="unhealthy"
  run main deploy v1.2.3
  [ "$status" -ne 0 ]
  [[ "$output" == *"healthy"* ]]
  [ "$(cat "$ROOT/current-version")" = "v1.2.2" ]
}

@test "a failed fetch stops before docker is touched" {
  FETCH_FAILS=1
  run main deploy v1.2.3
  [ "$status" -ne 0 ]
  ! grep -q "docker" "$CALLS"
}

@test "a failed migration stops before up" {
  FAIL_ON="run --rm migrate"
  run main deploy v1.2.3
  [ "$status" -ne 0 ]
  ! grep -q "up -d" "$CALLS"
}

@test "a failed backup stops the deploy" {
  deployed v1.2.2
  FAIL_ON="pg_dump"
  run main deploy v1.2.3
  [ "$status" -ne 0 ]
  ! grep -q "compose .* pull" "$CALLS"
}

# ── rollback ─────────────────────────────────────────────────────────────

@test "rollback deploys the older tag without running migrations" {
  deployed v1.2.3
  run main rollback v1.2.2
  [ "$status" -eq 0 ]
  ! grep -q "migrate" "$CALLS"
  grep -q "up -d" "$CALLS"
  [ "$(cat "$ROOT/current-version")" = "v1.2.2" ]
  [[ "$output" == *"pre-v1.2.3"* || "$output" == *"backups"* ]]
}

# ── status ───────────────────────────────────────────────────────────────

@test "status reports the current version and succeeds when healthy" {
  deployed v1.2.3
  run main status
  [ "$status" -eq 0 ]
  [[ "$output" == *"v1.2.3"* ]]
}

@test "status fails when a service is unhealthy" {
  deployed v1.2.3
  HEALTH="unhealthy"
  run main status
  [ "$status" -ne 0 ]
}

@test "status with nothing deployed says so" {
  run main status
  [ "$status" -ne 0 ]
  [[ "$output" == *"nothing deployed"* ]]
}

# ── guards ───────────────────────────────────────────────────────────────

@test "re-validates the tag even though deploy-shell already did" {
  for tag in "latest" "v1.2" 'v1.2.3;id' "../v1.2.3"; do
    : > "$CALLS"
    run main deploy "$tag"
    [ "$status" -eq 2 ] || { echo "accepted: $tag"; return 1; }
    ! grep -q . "$CALLS"
  done
}

@test "refuses unknown actions" {
  run main restart
  [ "$status" -eq 2 ]
}

@test "refuses to run while another deploy holds the lock" {
  mkdir "$ROOT/.deploy.lock"
  run main deploy v1.2.3
  [ "$status" -ne 0 ]
  [[ "$output" == *"another deploy"* ]]
  ! grep -q "docker" "$CALLS"
}

@test "releases the lock afterwards, on success and on failure" {
  run main deploy v1.2.3
  [ ! -d "$ROOT/.deploy.lock" ]
  FAIL_ON="run --rm migrate"
  run main deploy v1.2.4
  [ ! -d "$ROOT/.deploy.lock" ]
}
