# Development process

## Design → review → plan → approve → TDD

For any non-trivial feature: write up the design/approach first (usually a GitHub issue, iterated on as it's reviewed) and get it reviewed before breaking it into implementation tasks. Get the task breakdown approved before writing code. TDD (below) governs the coding step once a plan is approved — it isn't a replacement for the design/planning step.

## TDD-first

Lead every feature/bugfix with a failing test, then implement to green. A passing typecheck or build is not a substitute for a test.

## Two layers of API testing

They catch different things, and both are expected to be green before a PR merges.

**In-process (`be/ npm run test`)** — vitest + supertest, importing `app.ts` directly against a real Postgres. Fast, runs in CI, and is where TDD happens: this is the layer you add a failing test to before writing code.

**Over the wire (`be/ npm run test:api`)** — the [Bruno](https://www.usebruno.com) collection in `bruno/`, hitting the running container on `:5202` with assertions on every request. It needs a seeded stack:

```bash
docker compose up -d
docker compose run --rm seed
cd be && npm run test:api
```

The supertest layer never boots a listener, so it structurally cannot see anything that only breaks over HTTP, or anything that only shows up against realistically-linked seed data rather than bare fixtures. Requests chain created ids through runtime vars and a final `cleanup` folder removes everything a run creates, so repeated runs are idempotent.

Caller identity is the `x-user-email` dev header, driven by an environment variable — switching between owner, shared member, outsider, and an unknown user is a one-field change, which is what makes the access-control behaviour testable from outside. The collection is also usable interactively: open `bruno/` in the Bruno app and pick the `local` environment.

## Branch + PR per issue

Every change goes on a feature branch tied to a specific GitHub issue — never committed directly to `main`. Branch naming: `<type>/issue-<N>-<short-slug>` (e.g. `feat/issue-2-core-schema`). Open a PR per issue with a body that references it (`Closes #N`) so it closes automatically on merge.

(The very first scaffold commits predate this rule, since they were the initial commits to an empty repo — everything from issue #2 onward follows it.)
