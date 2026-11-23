#!/bin/bash
# Installs a pinned cloudflared on the deploy runner (#135), from deploy.yml:
#   install-cloudflared.sh <version> <sha256>
# The .deb is checked against the SHA-256 the workflow carries before dpkg
# sees it; a mismatch fails the job. Dependabot doesn't track this pin: bump
# the version and hash together (docs/hosting-deploy.md). Bash 3.2-safe, like
# the other host scripts, so its bats tests run on the macOS runner too.

sha256_of() {
  if command -v sha256sum > /dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

install_cloudflared() {
  local version="${1:-}" want="${2:-}" deb="cloudflared.deb" got
  if ! [[ "$version" =~ ^[0-9]{4}\.[0-9]+\.[0-9]+$ ]] || ! [[ "$want" =~ ^[0-9a-f]{64}$ ]]; then
    echo "usage: install-cloudflared.sh <version, e.g. 2026.11.1> <sha256, 64 hex>" >&2
    return 2
  fi
  if ! curl -fsSL -o "$deb" "https://github.com/cloudflare/cloudflared/releases/download/$version/cloudflared-linux-amd64.deb"; then
    echo "::error::could not download cloudflared $version" >&2
    return 1
  fi
  got="$(sha256_of "$deb")"
  if [ "$got" != "$want" ]; then
    echo "::error::cloudflared $version checksum mismatch: expected $want, got $got" >&2
    rm -f "$deb"
    return 1
  fi
  echo "$deb: OK ($want)"
  sudo dpkg -i "$deb"
}

# Run only when executed; when sourced (tests), just define the functions.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  install_cloudflared "$@"
  exit $?
fi
