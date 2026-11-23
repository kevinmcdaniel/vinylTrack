#!/usr/bin/env bats
# Third-party actions are pinned to a full commit SHA with the version as a
# comment (#135): a moved tag can't run new code in a job holding
# `packages: write` or the deploy secrets. Dependabot bumps both together.

WORKFLOWS="$BATS_TEST_DIRNAME/../../.github/workflows"

# Every `uses:` value, one per line, as "file:line: value".
uses_lines() {
  grep -n -E '^[[:space:]]*(-[[:space:]]+)?uses:' "$WORKFLOWS"/*.yml
}

@test "there are actions to check" {
  [ "$(uses_lines | wc -l)" -gt 10 ]
}

@test "every action is a local workflow or pinned to a 40-char SHA with its version" {
  local bad="" line value
  while IFS= read -r line; do
    value="${line#*uses:}"
    value="${value# }"
    if [[ "$value" =~ ^\./\.github/workflows/[A-Za-z0-9._-]+\.yml$ ]]; then continue; fi
    if [[ "$value" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._/-]+@[0-9a-f]{40}\ \#\ v[0-9]+(\.[0-9]+)*$ ]]; then continue; fi
    bad="$bad"$'\n'"$line"
  done < <(uses_lines)
  if [ -n "$bad" ]; then
    echo "not pinned to <sha> # v<version>:$bad"
    return 1
  fi
}
