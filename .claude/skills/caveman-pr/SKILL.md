---
name: caveman-pr
description: >
  Create a GitHub pull request in a consistent caveman-style format. Gathers the
  branch diff, commits, and linked issue; writes a terse caveman-voice body with a
  Conventional Commits title; previews it; then opens the PR with `gh`. Same skeleton
  every time — lead summary, what/how, test/verify, linked issue, Claude Code trailer.
  Fires whenever the user wants to open a PR: "create pr", "create a PR",
  "open/raise/make a pull request", "gh pr", "ship this branch", "PR this up",
  "/caveman-pr", or "/pr" — and after finishing a branch of work even if they don't
  say "PR". ALSO owns the compound "commit and create pr" (plus "commit and pr",
  "commit then open a PR", "commit + pr", "commit and ship it"): for those this skill
  is the entry point and orchestrates in order — it invokes the caveman-commit skill
  to make the commit(s) FIRST, then runs the PR flow, so the sequence is always
  commit → PR. For a commit alone ("write a commit", "/commit") use caveman-commit;
  for reviewing someone else's PR use caveman-review.
---

Open a pull request in the family voice — caveman prose, exact facts, same skeleton
every time. Unlike caveman-commit/caveman-review (which only emit text), this one
acts: it gathers context, drafts the PR, shows it to you, and on confirmation runs
`gh pr create`. It never invents results.

## Voice — caveman prose, precise tech

Narration is caveman (`caveman` skill, **full** level). Facts are not. That split is
the whole point: reviewers get the voice without losing the precision a PR needs.

Caveman the prose:
- Drop articles (`a`, `an`, `the`) and linking verbs (`is`, `are`, `was`) where meaning survives.
- Short simple-present grunts. First person is `caveman` or `me`, not `I`.
- State the *why* plainly — "old way slow. bad." — don't pad it.

**Never** caveman-ize, abbreviate, or "simplify" these — copy them exactly:
- the **title** (clean Conventional Commits, normal English — it's scanned in the PR list)
- file paths, directory names, code identifiers (functions, vars, types, routes)
- shell commands, flags, env vars
- numbers and counts ("213 green", "14 tests", port `:5101`)
- issue/PR refs (`#18`), URLs, the Claude Code trailer

Grunt is for connective tissue, never the load-bearing facts.

| normal | caveman |
|---|---|
| This PR adds a bulk import flow. | PR add bulk import flow. |
| Users can now paste many sequences at once. | user paste many sequence at once. no more one-by-one. |
| The old parser only handled one sequence, which was slow. | old parser do one sequence only. slow. bad. |
| I verified this manually on the dev server. | caveman check by hand on dev server. work. |

## PR format

Always this skeleton. **Required**: lead, one of What/How, one of Test/Verify, the
issue line, the trailer. **Optional** (include only when they earn their place): the
`>` callout, Behavior, Note.

```
<lead — 1-3 caveman sentences: what PR do + why it matter. carries the "why">

> <callout — special context only: stacked PR, base retarget, breaking change, needs follow-up>

## what            (use "## how" instead when the *approach/mechanism* is the interesting part)
- caveman bullet. identifiers/paths/routes EXACT.
- ...

## behavior         (optional — table of case -> result when behavior is a matrix)
| case | result |
|---|---|
| ... | ... |

## test            (use "## verify" when it's manual/runtime checking, not automated tests)
- how caveman check. exact counts, commands, paths. TDD note if test came first.
- live-verify note if done (what URL/port, what observed).

## note            (optional — caveats, open items, things to flag in review)

Closes #N          (use "Refs #N" when the PR advances but does not fully close the issue)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Notes:
- The **lead** does the heavy lifting — what changed and why, in two or three grunts.
  Don't add a separate "## why" header; fold the why into the lead.
- Prefer **`## how`** when the mechanism is the story (algorithms, comparison keys,
  tricky logic); **`## what`** when it's mostly a list of changes.
- A **table** in Behavior beats paragraphs when enumerating cases.
- The issue line and trailer are the last two lines, always, in that order.

## Commit-and-PR (compound requests)

When the request is a compound — "commit and create pr", "commit and pr", "commit
then open a PR", "commit + pr", "commit and ship it" — this skill is the entry point
and runs the two halves in order:

1. **Commit first.** Invoke the `caveman-commit` skill (via the Skill tool) to stage
   and commit the outstanding work. caveman-commit owns the commit message format
   (Conventional Commits, ≤50-char subject, body only when the "why" isn't obvious) —
   don't reinvent it here, just hand off.
2. **Then PR.** Continue with the PR workflow below. The fresh commit(s) are now in
   `git log <base>..HEAD`, so they flow naturally into the title and body.

Guardrails:
- Working tree already clean? Skip step 1 and just open the PR.
- Uncommitted changes but the user only said "create pr" (no "commit")? Don't silently
  commit — note the dirty tree in the preview and let the user decide. Committing is
  their call; this skill only commits when the request says so.

## Workflow

1. **Locate head and base.**
   - Head = current branch. If it's the default branch (`main`/`master`), stop — tell
     the user to branch first; never open a PR from the default branch.
   - Base = repo default branch, from
     `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`. Honor an
     override if the user named a base (e.g. a stacked PR onto another branch).

2. **Find the linked issue.** Parse the branch name (`issue-(\d+)` →
   `feat/issue-18-...` ⇒ `#18`) and scan commit subjects for `(#\d+)`. Use it for the
   title's `(#N)` and the `Closes`/`Refs` line. If none is found, omit the issue line
   rather than inventing one — and say so in your preview.

3. **Gather the real material — read the change, don't guess.**
   - `git log <base>..HEAD --pretty=format:'%s%n%b'` for intent.
   - `git diff <base>...HEAD --stat`, then read the actual diff/files for the parts
     you'll describe. The body must match what the code does.

4. **Build the title + body.** Title: `type(scope): short summary (#N)` — reuse the
   Conventional Commits type/scope from the commits (caveman-commit style), summarize
   the whole branch, normal English, aim ≤ ~70 chars. Body: the skeleton above,
   caveman prose, exact facts.

5. **Preview and confirm.** Show the user the exact title and body you'll submit (and
   the base/head/draft). Wait for confirmation before creating — opening a PR is
   outward-facing. Skip the wait only if the user already said go ahead.

6. **Push, then create.**
   - Ensure the branch is on origin: `git push -u origin HEAD` if there's no upstream
     or it's ahead. (The user asking for a PR is the ask to push.)
   - Write the body to a temp file and pass `--body-file` to avoid shell-escaping
     mangling. Then:
     ```
     gh pr create --base <base> --head <branch> --title "<title>" --body-file <tmp>
     ```
     Add `--draft` when the user passed a draft arg.
   - If a PR already exists for the branch, don't error out — offer to update its body:
     `gh pr edit <num> --title "<title>" --body-file <tmp>`.

7. **Report.** Give the PR back as a markdown link with the full URL, e.g.
   `[squaretrack#82](https://github.com/kevinmcdaniel/squaretrack/pull/82)`.

**Args:** `/caveman-pr` (full flow), `/caveman-pr draft` (open as draft),
`/caveman-pr <base>` (override base branch). Combine freely.

## Auto-Clarity

Drop the grunts and write plain, full prose for PRs where a misread is costly:
breaking changes, security fixes, data migrations, irreversible/risky operations, or
anything where reviewers need the full reasoning to act safely. A `BREAKING CHANGE:`
note or a "this migration is one-way" warning is not the place for fragments. Resume
caveman for the rest of the body. (Same instinct as the `caveman` skill's Auto-Clarity.)

## Honesty

A PR body is a claim other people act on, so the caveman voice never licenses fudging.
Describe only what actually happened:
- Ran no tests? Say `no test this PR — <reason>`, don't write "all green".
- Didn't run typecheck/lint? Don't claim they're clean.
- Skipped a step? Name it in `## note`.
Same precision rule as the facts list in Voice, applied to outcomes.

## Example

Branch `feat/issue-18-sequence-import-ui`, base `main`.

Title:
```
feat(sequences): paste/parse/review import editor (#18)
```

Body:
```
PR add bulk import for sequence. user paste many sequence text at once, caveman parse
each, user review, then save all together. before, user add sequence one-by-one.
slow. now fast.

## what
- new paste/parse/review editor at `fe/src/app/(app)/sequences/import/`
- parse step hit `POST /api/sequence/parse`, return `{ module, presentation }` per block
- review step let user fix bad row before save
- bulk save reuse find-or-adopt (#21) so duplicate module no make twin

## test
- TDD first. 14 new test in `fe/src/app/(app)/sequences/import/import.test.tsx`
  — paste split, parse error row, review edit, bulk save. all green.
- FE typecheck + lint clean.
- caveman live-check on :5101: paste 3 sequence, one bad, fix, save → 2 new module,
  1 reuse existing. work.

Closes #18

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Note the split: prose grunts, but `POST /api/sequence/parse`, the file path, the
counts, `#18`/`#21`, and `:5101` are all exact.

## Boundaries

The action exception in the caveman family: caveman-commit and caveman-review only
emit text, but caveman-pr **creates the PR** with `gh` — after a preview and your OK.
It pushes the branch as part of that, and updates an existing PR for the branch rather
than duplicating. It will **not**: open a PR from the default branch, commit unless
the request says so, or claim results it didn't verify. "stop caveman-pr" or "normal
mode": write the PR body in normal verbose prose instead of caveman.
