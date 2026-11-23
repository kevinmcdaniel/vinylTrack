#!/usr/bin/env bats
# Published ports listen on localhost only (#135). Dev compose has the
# x-user-email header and committed fake secrets, so on 0.0.0.0 anyone on the
# same Wi-Fi is any seeded user. FE alone may opt in via FE_BIND for a phone.

ROOT_DIR="$BATS_TEST_DIRNAME/../.."

# Each published port entry (the list under a `ports:` key), quotes and
# leading "- " stripped.
port_entries() {
  awk '/^[[:space:]]*ports:[[:space:]]*$/ { p = 1; next }
       p && /^[[:space:]]*-[[:space:]]/ { print; next }
       { p = 0 }' "$1" | sed -E 's/^[[:space:]]*-[[:space:]]*//; s/"//g'
}

check_file() {
  local file="$1" min="$2" bad="" n=0 entry
  while IFS= read -r entry; do
    n=$((n + 1))
    case "$entry" in
      127.0.0.1:*) ;;
      '${FE_BIND:-127.0.0.1}:'*) ;;
      *) bad="$bad $entry" ;;
    esac
  done < <(port_entries "$file")
  [ "$n" -ge "$min" ] || { echo "expected at least $min port entries in $file, found $n"; return 1; }
  [ -z "$bad" ] || { echo "not bound to localhost in $file:$bad"; return 1; }
}

@test "dev compose binds every published port to localhost" {
  check_file "$ROOT_DIR/docker-compose.yml" 4
}

@test "only the FE may opt out, through FE_BIND" {
  run grep -c 'FE_BIND' "$ROOT_DIR/docker-compose.yml"
  [ "$output" = "1" ]
  grep -q '\${FE_BIND:-127.0.0.1}:\${FE_PORT_EXT:-5201}:4000' "$ROOT_DIR/docker-compose.yml"
}

@test "prod compose binds every published port to localhost" {
  check_file "$ROOT_DIR/compose.prod.yml" 1
}
