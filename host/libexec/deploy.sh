#!/bin/bash
# deploy.sh: deploys vinylTrack on the home server, as _vinyltrack (#60).
# Called by deploy-shell through one sudoers rule; never by hand over SSH,
# though an admin can run it with `sudo -u _vinyltrack -H`.
#
#   deploy.sh deploy <tag>     fetch, back up, pull, migrate, up, wait for health
#   deploy.sh rollback <tag>   same, minus migrate (migrations are forward-only)
#   deploy.sh status           current version + health; non-zero if unhealthy
#
# Each release's compose.prod.yml comes from that tag's GitHub Release assets,
# so the compose file always matches the images. Written for macOS /bin/bash 3.2.

ROOT=/Users/_vinyltrack
REPO=kevinmcdaniel/vinylTrack
PROJECT=vinyltrack
SERVICES="db be fe"
HEALTH_TRIES=60       # × 2s
TAG_RE='^v[0-9]+\.[0-9]+\.[0-9]+(-rc\.[0-9]+)?$'

log() {
  echo "deploy: $*"
  logger -t vinyltrack-deploy "$*"
}

fail() {
  log "FAILED: $*"
  return 1
}

compose_file() { echo "$ROOT/releases/$1/compose.prod.yml"; }

current_version() { [ -f "$ROOT/current-version" ] && cat "$ROOT/current-version"; }

compose() {
  local file="$1"; shift
  local args=(compose -p "$PROJECT")
  [ -f "$ROOT/.env" ] && args+=(--env-file "$ROOT/.env")
  docker "${args[@]}" -f "$file" "$@"
}

fetch_release() {
  local tag="$1" dir="$ROOT/releases/$1"
  mkdir -p "$dir" || return 1
  curl -fsSL -o "$dir/compose.prod.yml.tmp" \
    "https://github.com/$REPO/releases/download/$tag/compose.prod.yml" || { rm -f "$dir/compose.prod.yml.tmp"; return 1; }
  mv "$dir/compose.prod.yml.tmp" "$dir/compose.prod.yml"
}

backup() {
  local tag="$1" current file
  current="$(current_version)" || return 0   # first deploy: nothing to back up
  mkdir -p "$ROOT/backups" || return 1
  file="$ROOT/backups/pre-$tag-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
  log "backing up database (running $current) to $file"
  if ! compose "$(compose_file "$current")" exec -T db pg_dump -U vinyltrack -d vinyltrack | gzip > "$file"; then
    rm -f "$file"
    return 1
  fi
}

wait_healthy() {
  local file="$1" tries="$2" i svc id state all report
  for ((i = 0; i < tries; i++)); do
    all=1 report=""
    for svc in $SERVICES; do
      id="$(compose "$file" ps -q "$svc")"
      state="$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null)" || state="missing"
      [ -n "$state" ] || state="missing"
      report="$report $svc=$state"
      [ "$state" = "healthy" ] || all=0
    done
    if [ "$all" = 1 ]; then
      log "healthy:$report"
      return 0
    fi
    [ $((i + 1)) -lt "$tries" ] && sleep 2
  done
  log "not healthy:$report"
  return 1
}

do_deploy() {
  local action="$1" tag="$2" file previous
  file="$(compose_file "$tag")"
  previous="$(current_version)" || previous=""
  export VINYLTRACK_VERSION="$tag"

  log "$action $tag (currently ${previous:-nothing})"
  fetch_release "$tag"                       || { fail "could not fetch compose.prod.yml for $tag"; return; }
  backup "$tag"                              || { fail "database backup failed"; return; }
  compose "$file" pull                       || { fail "image pull failed"; return; }
  if [ "$action" = deploy ]; then
    compose "$file" run --rm migrate         || { fail "migration failed; nothing restarted"; return; }
  else
    log "rollback: migrations are not reversed. To undo schema changes, restore the pre-${previous:-<tag>} dump in $ROOT/backups"
  fi
  compose "$file" up -d --remove-orphans     || { fail "compose up failed"; return; }
  wait_healthy "$file" "$HEALTH_TRIES"       || { fail "services not healthy after $((HEALTH_TRIES * 2))s; still recorded as ${previous:-nothing}"; return; }

  echo "$tag" > "$ROOT/current-version"
  log "$action $tag done"
}

do_status() {
  local current
  current="$(current_version)" || { echo "deploy: nothing deployed yet"; return 1; }
  echo "deploy: current version $current"
  export VINYLTRACK_VERSION="$current"
  compose "$(compose_file "$current")" ps
  wait_healthy "$(compose_file "$current")" 1
}

main() {
  export HOME="$ROOT"
  export PATH=/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin
  set -f
  set -o pipefail

  local action="${1:-}" tag="${2:-}"
  case "$action" in
    deploy|rollback)
      if [ $# -ne 2 ] || ! [[ "$tag" =~ $TAG_RE ]]; then
        echo "deploy: invalid tag '$tag'" >&2
        return 2
      fi
      ;;
    status)
      [ $# -eq 1 ] || { echo "deploy: status takes no arguments" >&2; return 2; }
      ;;
    *)
      echo "usage: deploy.sh deploy <tag> | rollback <tag> | status" >&2
      return 2
      ;;
  esac

  if [ "$action" = status ]; then
    do_status
    return
  fi

  mkdir -p "$ROOT" && mkdir "$ROOT/.deploy.lock" 2>/dev/null || {
    echo "deploy: another deploy is running (remove $ROOT/.deploy.lock if it isn't)" >&2
    return 1
  }
  trap 'rmdir "$ROOT/.deploy.lock" 2>/dev/null' EXIT
  do_deploy "$action" "$tag"
}

# Run only when executed; when sourced (tests), just define the functions.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
  exit $?
fi
