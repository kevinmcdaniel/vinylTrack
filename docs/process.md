# Development process

## Design → review → plan → approve → TDD

For any non-trivial feature: write up the design/approach first (usually a GitHub issue, iterated on as it's reviewed) and get it reviewed before breaking it into implementation tasks. Get the task breakdown approved before writing code. TDD (below) governs the coding step once a plan is approved — it isn't a replacement for the design/planning step.

## TDD-first

Lead every feature/bugfix with a failing test, then implement to green. A passing typecheck or build is not a substitute for a test.

## Two layers of API testing

They catch different things.

**In-process (`be/ npm run test`)** — vitest + supertest, importing `app.ts` directly against a real Postgres. Fast, runs in CI, and is where TDD happens: this is the layer you add a failing test to before writing code.

**Over the wire (`be/ npm run test:api`)** — the [Bruno](https://www.usebruno.com) collection in `bruno/`, hitting the running container on `:5202` with assertions on every request. It needs a seeded stack:

```bash
docker compose up -d
docker compose run --rm seed
cd be && npm run test:api
```

The supertest layer never boots a listener, so it structurally cannot see anything that only breaks over HTTP, or anything that only shows up against realistically-linked seed data rather than bare fixtures. Requests chain created ids through runtime vars and a final `cleanup` folder removes everything a run creates, so repeated runs are idempotent.

**Both layers are enforced.** `.github/workflows/ci.yml` runs on every push/PR to `main`: typecheck + lint + test for each of BE, FE and mailer, the host scripts (bats + shellcheck), a build of the production images, and a separate `api` job that migrates and seeds a Postgres service, boots the API with `tsx`, waits on `/api/health`, then runs the Bruno collection through the same `npm run test:api` and the same `local` environment file you use locally — no `baseUrl` override to drift out of sync. It publishes a JUnit report and a step summary, and `--bail` stops at the first failing request rather than cascading. Wiring this up was issue #41.

Caller identity is the `x-user-email` dev header (accepted in `development`/`test` only; the real app uses signed bearer tokens), driven by an environment variable — switching between owner, admin, shared member, outsider, and an unknown user is a one-field change, which is what makes the access-control behaviour testable from outside. Owner and admin are deliberately separate seeded users: if the owner were also an admin, every "owner" request would silently take the admin bypass in `policy.ts` and the plain non-admin owner — what most family members are — would never be exercised. The collection is also usable interactively: open `bruno/` in the Bruno app and pick the `local` environment.

## Branch + PR per issue

Every change goes on a feature branch tied to a specific GitHub issue — never committed directly to `main`. Branch naming: `<type>/issue-<N>-<short-slug>` (e.g. `feat/issue-2-core-schema`). Open a PR per issue with a body that references it (`Closes #N`) so it closes automatically on merge, or `Refs #N` when the PR moves the issue forward without finishing it.

(The very first scaffold commits predate this rule, since they were the initial commits to an empty repo — everything from issue #2 onward follows it.)
