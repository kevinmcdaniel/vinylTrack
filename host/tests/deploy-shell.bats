#!/usr/bin/env bats
# deploy-shell is _vinyldeploy's sshd ForceCommand (#60). It must accept
# exactly `deploy <tag>`, `rollback <tag>`, `status`, and refuse the rest.
#
# The script is sourced, not executed, so `sudo` and `logger` can be stubbed
# as shell functions: a function wins over any PATH lookup, so the real ones
# are never reached.

setup() {
  # shellcheck source=../libexec/deploy-shell
  source "$BATS_TEST_DIRNAME/../libexec/deploy-shell"
  CALLS="$BATS_TEST_TMPDIR/calls"
  : > "$CALLS"
  sudo() { echo "sudo $*" >> "$CALLS"; }
  logger() { echo "logger $*" >> "$CALLS"; }
}

run_shell() {
  SSH_ORIGINAL_COMMAND="$1" run main
}

@test "status runs deploy.sh status as _vinyltrack" {
  run_shell "status"
  [ "$status" -eq 0 ]
  grep -qx "sudo -n -u _vinyltrack /usr/local/libexec/vinyltrack/deploy.sh status" "$CALLS"
}

@test "deploy <tag> runs deploy.sh deploy <tag>" {
  run_shell "deploy v1.2.3"
  [ "$status" -eq 0 ]
  grep -qx "sudo -n -u _vinyltrack /usr/local/libexec/vinyltrack/deploy.sh deploy v1.2.3" "$CALLS"
}

@test "rollback <tag> runs deploy.sh rollback <tag>" {
  run_shell "rollback v0.1.0"
  [ "$status" -eq 0 ]
  grep -qx "sudo -n -u _vinyltrack /usr/local/libexec/vinyltrack/deploy.sh rollback v0.1.0" "$CALLS"
}

@test "accepts release-candidate tags" {
  run_shell "deploy v0.1.0-rc.12"
  [ "$status" -eq 0 ]
  grep -q "deploy.sh deploy v0.1.0-rc.12" "$CALLS"
}

@test "logs every request, accepted or not" {
  run_shell "deploy v1.2.3"
  grep -q "^logger -t vinyltrack-deploy .*deploy v1.2.3" "$CALLS"
  : > "$CALLS"
  run_shell "rm -rf /"
  grep -q "^logger -t vinyltrack-deploy .*rejected" "$CALLS"
}

@test "refuses an interactive session (no command)" {
  run_shell ""
  [ "$status" -eq 2 ]
  [[ "$output" == *"interactive"* ]]
  ! grep -q "^sudo" "$CALLS"
}

@test "refuses unknown commands" {
  for cmd in "bash" "ls -la" "scp -t /tmp" "sh -c id" "deploy-all" "Status" "rsync --server"; do
    : > "$CALLS"
    run_shell "$cmd"
    [ "$status" -eq 2 ] || { echo "accepted: $cmd"; return 1; }
    ! grep -q "^sudo" "$CALLS"
  done
}

@test "refuses malformed or hostile tags" {
  for tag in "1.2.3" "v1.2" "v1.2.3.4" "v1.2.3-beta" "v1.2.3-rc" "v1.2.3;id" 'v1.2.3$(id)' "v1.2.3 && id" "../v1.2.3" "latest" "v01.2.3x" "*"; do
    : > "$CALLS"
    run_shell "deploy $tag"
    [ "$status" -eq 2 ] || { echo "accepted tag: $tag"; return 1; }
    ! grep -q "^sudo" "$CALLS"
  done
}

@test "refuses missing or extra arguments" {
  for cmd in "deploy" "rollback" "status now" "deploy v1.2.3 v1.2.4" "deploy v1.2.3 --force"; do
    : > "$CALLS"
    run_shell "$cmd"
    [ "$status" -eq 2 ] || { echo "accepted: $cmd"; return 1; }
    ! grep -q "^sudo" "$CALLS"
  done
}

@test "does not glob-expand the command" {
  cd "$BATS_TEST_TMPDIR"
  touch v9.9.9
  run_shell "deploy v9.9.?"
  [ "$status" -eq 2 ]
  ! grep -q "^sudo" "$CALLS"
}

@test "passes deploy.sh's exit status through" {
  sudo() { echo "sudo $*" >> "$CALLS"; return 7; }
  run_shell "status"
  [ "$status" -eq 7 ]
}

@test "refuses a command containing a newline or other control character" {
  for cmd in $'status\nrm -rf /' $'deploy v1.2.3\n' $'status\r' $'deploy\tv1.2.3'; do
    : > "$CALLS"
    run_shell "$cmd"
    [ "$status" -eq 2 ] || { echo "accepted: $(printf %q "$cmd")"; return 1; }
    ! grep -q "^sudo" "$CALLS"
  done
}
