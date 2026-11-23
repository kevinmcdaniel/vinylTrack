#!/usr/bin/env bats
# The deploy job installs a pinned cloudflared and checks its SHA-256 before
# dpkg ever sees it (#135). Sourced: `curl` and `sudo` are stubbed.

setup() {
  # shellcheck source=../libexec/install-cloudflared.sh
  source "$BATS_TEST_DIRNAME/../libexec/install-cloudflared.sh"
  cd "$BATS_TEST_TMPDIR"
  CALLS="$BATS_TEST_TMPDIR/calls"
  : > "$CALLS"
  curl() {
    echo "curl $*" >> "$CALLS"
    local out=""
    while [ $# -gt 0 ]; do [ "$1" = "-o" ] && out="$2"; shift; done
    printf 'fake cloudflared package\n' > "$out"
  }
  sudo() { echo "sudo $*" >> "$CALLS"; }
  GOOD="$(printf 'fake cloudflared package\n' > expected && sha256_of expected)"
}

@test "downloads the pinned version, checks it, then installs it" {
  run install_cloudflared 2026.11.1 "$GOOD"
  [ "$status" -eq 0 ]
  [[ "$output" == *"cloudflared.deb: OK"* ]]
  grep -q 'releases/download/2026.11.1/cloudflared-linux-amd64.deb' "$CALLS"
  grep -q '^sudo dpkg -i cloudflared.deb$' "$CALLS"
}

@test "a wrong checksum fails before dpkg runs" {
  run install_cloudflared 2026.11.1 "$(printf '0%.0s' {1..64})"
  [ "$status" -eq 1 ]
  [[ "$output" == *"::error::"*"checksum mismatch"* ]]
  ! grep -q dpkg "$CALLS"
  [ ! -e cloudflared.deb ]
}

@test "a failed download fails before dpkg runs" {
  curl() { echo "curl $*" >> "$CALLS"; return 22; }
  run install_cloudflared 2026.11.1 "$GOOD"
  [ "$status" -eq 1 ]
  ! grep -q dpkg "$CALLS"
}

@test "refuses a missing or malformed version or checksum" {
  run install_cloudflared
  [ "$status" -eq 2 ]
  run install_cloudflared latest "$GOOD"
  [ "$status" -eq 2 ]
  run install_cloudflared 2026.11.1 not-a-sha
  [ "$status" -eq 2 ]
  ! grep -q curl "$CALLS"
}
