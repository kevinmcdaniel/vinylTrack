# Development process

## Design → review → plan → approve → TDD

For any non-trivial feature: write up the design/approach first (usually a GitHub issue, iterated on as it's reviewed) and get it reviewed before breaking it into implementation tasks. Get the task breakdown approved before writing code. TDD (below) governs the coding step once a plan is approved — it isn't a replacement for the design/planning step.

## TDD-first

Lead every feature/bugfix with a failing test, then implement to green. A passing typecheck or build is not a substitute for a test.

## Branch + PR per issue

Every change goes on a feature branch tied to a specific GitHub issue — never committed directly to `main`. Branch naming: `<type>/issue-<N>-<short-slug>` (e.g. `feat/issue-2-core-schema`). Open a PR per issue with a body that references it (`Closes #N`) so it closes automatically on merge.

(The very first scaffold commits predate this rule, since they were the initial commits to an empty repo — everything from issue #2 onward follows it.)
