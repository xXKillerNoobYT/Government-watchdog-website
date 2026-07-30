# AUTO GO — Memory (Government Watchdog website)

*Compressed wisdom from prior iterations. Seeded 2026-07-28 on first run.*

## Decisions

- **[2026-07-28]** First run found no trackers and 28 open issues. Rather than start the
  area rotation at area 1, I triaged the backlog against open PR #68 first. That reordering
  was the whole value of the iteration — see Patterns.
- **[2026-07-28]** Chose issue #55 (build-guard generalization) over the higher-priority
  P0 #69 because #69's acceptance criteria name files that do not exist on `main`. Priority
  is meaningless if the work is not yet possible; availability gates priority.

- **[2026-07-28]** Extended issue #55 on a branch **stacked on the open PR #96** rather than
  pushing more commits into #96 itself. #96 was green and waiting on the owner; growing it
  would have delayed a mergeable PR and enlarged its review. The remaining work also depended
  on #96's code, so basing on `main` would have guaranteed a conflict. Stack when the next
  step depends on an open PR that is already ready to merge.
- **[2026-07-28]** Emitted-artifact rules key on **dial position** (`fetch(`, `<link href>`,
  CSS `url(`), never on "contains an absolute URL". Fixtures cite real public records and are
  bundled verbatim; a shape-only rule would have failed the build on honest civic data — the
  exact outcome the honesty contract exists to prevent. A citation is evidence; a dial is a
  destination. `<a href>` is deliberately not matched for the same reason.
- **[2026-07-29]** Closed a guard's blind spot by **deleting the list that caused it**, not by
  extending it. `scanPublicBundle` skipped everything outside a nine-entry text-extension
  allow-list; adding `.woff2`, `.png`, `.wasm` would have left the next new extension blind.
  Reading every file as `latin1` removes the list entirely — one path, nothing to go stale.
  When a guard's hole is "the enumeration is incomplete", ask whether the enumeration is
  needed at all before growing it.
- **[2026-07-29]** Marked C8 **`blocked`, not `done`**, with issue #55 at 7 of 8 AC. The last
  criterion needs a hosted deploy this loop may not perform. `done` would claim something
  nobody verified; `in_progress` would imply the loop is still working it. `blocked` + reason
  is the only honest state, and unlike `in_progress` it lets the rotation advance.
- **[2026-07-29]** Filed the ASCII-escape blind spot as **#102** instead of fixing it inside
  the AC4 change. It is a different criterion (encoding form, not import form), it is not
  live today, and covering only the `\uXXXX` variant would have produced a guard that reads
  as complete and still misses `\xXX`. A half guard is worse than a filed issue.

- **[2026-07-29]** Wrote a root `CLAUDE.md` as a **thin router**, not a rulebook. The standing
  principle is that systems shrink; a CLAUDE.md restating
  `docs/design-information-type-matrix.md` or the incoming `AGENT-RULEBOOK.md` would be a
  second source of truth that rots silently. It carries only what an agent needs *before* it
  knows where to look, then points — and says outright that the linked document wins on
  conflict, and that it should shrink further once the rulebook lands.
- **[2026-07-29]** `loop-self-improve` applied **zero mutations on purpose**. Every trigger
  the loop defines is specified over weeks ("3+ consecutive weeks", ">10 findings/week",
  "14+ days") and only 4 rows over 2 days existed. Doing nothing and writing down *why*, plus
  what to watch for, is the correct output of a self-improvement pass with insufficient data —
  and `~/.claude/commands/auto-go.md` is shared with the backend routine, so a mutation
  inferred from website data alone would silently retune a second, actively-running loop.
- **[2026-07-29]** Filed the two structural loop defects (C3 no-op, C7/C10 unsatisfiable) as
  **Q&A + issue rather than fixing them**, even though the self-improve pass is nominally
  allowed to toggle a check. Both change what a *required* check means, which is the
  graduation bar itself — that is the owner's decision, not a tuning knob.

## What worked

- **[2026-07-28]** `gh pr view <n> --json files` cross-referenced against
  `git cat-file -e main:<path>` is the fast, reliable way to tell "available work" from
  "work queued behind an unmerged PR". Do this before picking an item, every time.
- **[2026-07-29] Measure the speculative hole before deciding whether to build for it.** The
  ASCII-escape risk looked urgent until two greps settled it: the bundle contains the literal
  `·` and **zero** `\uXXXX` escapes anywhere. That turned an invented emergency into a filed
  issue (#102) with the exact trigger condition written down. Two greps, one right decision.
- **[2026-07-29] A table-driven test over a constant list catches assumptions, not just code.**
  Asserting "planting marker X yields exactly 1 violation" failed — because several markers
  nest inside others (`reviewer_internal` ⊂ `reviewer_internal_records`). The code was right
  and the test's arithmetic was wrong. Over a list of literals, assert **membership**, never
  cardinality.

- **[2026-07-29] A checklist item can be green with no artifact behind it, and nothing notices.**
  `C1_plan_complete` was recorded `done` from iteration 1 while `docs/plans/` did not exist at
  all. Four of the six tracker paths the checklist writes to had never been created here, so
  C1, C2, C11b, and C13 could not persist anything — each pass re-derived the same findings
  and dropped them. **Before trusting a check's recorded state, verify its artifact exists.**
- **[2026-07-29] Verify the resemblance before filing the finding.** `EMITTED_TEXT_EXTENSIONS`
  in the exposure guard looks exactly like the `TEXT_EXTENSIONS` allow-list deleted from
  `check-public-bundle.mjs` in iteration 3, and reading two comments settled that it is the
  structural opposite: unlisted files are **not skipped**, they are read as `latin1` and
  scanned with the high-signal subset. Recorded in the area plan as an explicit non-finding so
  a later pass does not "discover" it a second time.

## What didn't

- **[2026-07-28] Re-running a red CI check to "see if it was flaky" is not evidence and not
  a fix.** Three re-runs of the same commit produced three different failure sets (4 tests,
  then 1, then 2). What actually settled it was a controlled A/B on a clean branch: two full
  suites concurrently, same code, only `--testTimeout` differing — 5s failed both twins, 20s
  passed both. Reproduce the condition, then change one variable.

- **[2026-07-28] A guard that passes on the real artifact has proven nothing yet.** Both
  lanes went green on the first run of the new emitted scan, which is equally consistent with
  "clean bundle" and "rules match nothing". Injecting three destinations into a copy of the
  real 826 kB artifact — a credentialed `fetch`, an off-origin CSS `url()`, and a loopback
  host in a `.woff2`'s bytes — is what turned the pass into evidence. Always pair a green
  guard with a negative control on real output.

- **[2026-07-29] "The timeout fix landed" is not the same as "the timeout is fixed."** #98
  raised `testTimeout` to 20s and the same test failed at **21624ms** nine days later — a
  1.6s miss. A threshold fix against a load problem only buys headroom, and the headroom
  runs out. The tell that it was still load and not the code: a **docs-only commit** went
  red, and the *same sha* passed on the other twin. Fix the load, not the number.
- **[2026-07-29] When another open PR already fixes what you need, copy its diff verbatim.**
  PR #68 makes the identical `push: branches: [main]` change. Writing the fix byte-identical
  and *verifying it with a diff of both hunks* means the two merge cleanly in either order
  and whichever lands first makes the other a no-op. Independently inventing a better-worded
  equivalent would have manufactured a conflict for no gain.

## Patterns

- **[2026-07-28] The MOTY backlog is a dependency fan, not a flat list.** Issues #69, #70,
  #75, #76, #80, #82–#87 all cite `src/ui/coming-soon.ts`, `timeline-lanes.ts`,
  `diff-view.ts`, or `docs/product/design-reference-inventory.md` — none of which exist on
  `main`. All of them are introduced by **open PR #68**. Until the owner merges #68, that
  entire P0/P1 block is unstartable, and any attempt to start it would either duplicate #68
  or create a guaranteed conflict. The genuinely open lanes on `main` are the ones #68 never
  touches: `scripts/` build guards, `deploy/`, `vite.config.ts`, `.github/workflows/`.
- **[2026-07-28] The repo has three near-identical names.** Always `git remote get-url origin`
  before any work. The website is `Government-watchdog-website`; the backend is
  `Government-watchdog` (same words, one letter's case apart).

## Per-area notes

### the loop itself
- **C3 has never run.** It invokes `/hunt-fix-loop`, which does not exist anywhere on disk
  (`hunt-fix.md` is the separate peer routine, not a callable body). Required for graduation.
  Issue #106 / `dev-qa.md` Q1.
- **C7 and C10 can never go green here** — specified over "iOS pages" and "iOS native ↔
  Tauri", and this repo has zero Tauri references. It *does* have `ios/GovWatchdogApp/`
  (90 Swift files) but that is a thin auth companion in no npm script. `dev-qa.md` Q2.
- **`auto-go.md` was generalized to multi-project on 2026-07-27; the SKILL.md bodies it
  dispatches to were not.** `plan-enforcer`, `usability-enforcer`, and `dev-pipeline-manager`
  still carry `Features/<area>/`, `swift build`, and "iOS page" verbatim.
- **Eight scheduled-task scanners are orphaned, and three lie about it** in their own
  frontmatter ("Wires into C8 dispatch" when the target never mentions them). Do not treat a
  scanner's self-description as evidence of coverage.

### build-guards
- `scripts/check-no-direct-exposure.mjs` is a *source-and-config* scan, not a bundle scan —
  it never reads `dist/`. `scripts/check-public-bundle.mjs` is the bundle scan. They are
  separate guards with separate blind spots; a finding in one is not covered by the other.
- The exposure guard's original design was deliberately narrow (two known loopback ports)
  so an unrelated number could not trip it. Generalizing it means *adding* rules beside that
  one, not loosening it — the port rule must keep its exact original behavior.
- **The two guards had a seam, not a hole.** Source scan skips `dist/`; bundle scan reads
  `dist/` only for private markers. Closed by giving the exposure guard an `--emitted <dir>`
  mode rather than adding a third script — both modes answer the same question from one rule
  vocabulary, and splitting them would let the definitions drift apart.
- **A production bundle is one line**, so the line-oriented `violationsIn` is useless on it;
  emitted scanning has to be whole-text with a windowed excerpt for reporting. That is the
  real reason `emittedViolationsIn` is a separate function and not a flag on the old one.
- **A byte-oriented read needs a byte-oriented needle.** Reading files as `latin1` (one byte,
  one char) and then searching for the marker's own JS string misses every marker with a
  non-ASCII character: `Workspace · Home · Alpine` is 25 chars in source, 27 bytes on disk.
  The needle must be `Buffer.from(marker, 'utf8').toString('latin1')`. Getting the read right
  and the needle wrong produces a guard that scans everything and finds nothing.
- **`Buffer` does not typecheck in `test/`, only in `scripts/`.** No `@types/node` means the
  `.mjs` guards may use `Buffer` freely (they are never typechecked) but a `.ts` test may not.
  Build the same latin1 string there with `TextEncoder` + `String.fromCharCode`.
- **Test the pure half only.** This repo carries no `@types/node` on purpose, so every guard
  is split pure-decision / filesystem-walk (`violationsIn`+`scanDirectExposure`,
  `privateSiblingLanes`+`privateSiblingArtifacts`, `emittedViolationsIn`+`scanEmittedArtifact`).
  Follow that split or the TypeScript suite cannot reach the new code.

### gate
- Per GOV-SPA's 2026-07-28 adversarial sweep: the **client gate is UI scaffolding, not the
  confidentiality boundary**. `?gate=approved` and `?reviewer=1` intentionally fail *open*.
  Confidentiality rests on the server-side Sites custom-access worker. Do not "fix" the
  client bypasses as if they were the boundary; do not weaken the server-side assumption.

### ci-tooling
- **The CI runner is self-hosted and single-machine, and every PR push starts TWO concurrent
  full suites** (`on:` lists `push` and `pull_request` both on `["**"]`). Route-integration
  tests each `await import('../src/main')`, booting the whole 70-module app in jsdom —
  ~3.6s idle against Vitest's 5s default. Under the doubled load they time out
  non-deterministically. Signature: the same sha green on one twin, red on the other.
  Fixed by `testTimeout: 20_000` in `vite.config.ts` (#59 / PR #98). PR #68 independently
  removes the doubled trigger; the two fixes compose and neither replaces the other.
- **Before blaming your own branch for a red check, compare which commit went red.** Here
  the code commit passed twice and a markdown-only commit failed — that alone ruled the
  branch out in one look at `gh run list`.

### honesty-ledger
- GOV-SPA observed the app has **no literal COMING SOON label** — unbuilt-feature states and
  missing-data states are both rendered through the designed-gap mechanism, collapsing GS
  and DG into one affordance. Issue #69 is the fix, and it is blocked behind PR #68.

## About the owner

- *(nothing beyond CLAUDE.md recorded yet)*
