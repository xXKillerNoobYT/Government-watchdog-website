# AUTO GO — Memory (Government Watchdog website)

*Compressed wisdom from prior iterations. Seeded 2026-07-28 on first run.*

## Decisions

- **[2026-07-28]** First run found no trackers and 28 open issues. Rather than start the
  area rotation at area 1, I triaged the backlog against open PR #68 first. That reordering
  was the whole value of the iteration — see Patterns.
- **[2026-07-28]** Chose issue #55 (build-guard generalization) over the higher-priority
  P0 #69 because #69's acceptance criteria name files that do not exist on `main`. Priority
  is meaningless if the work is not yet possible; availability gates priority.

## What worked

- **[2026-07-28]** `gh pr view <n> --json files` cross-referenced against
  `git cat-file -e main:<path>` is the fast, reliable way to tell "available work" from
  "work queued behind an unmerged PR". Do this before picking an item, every time.

## What didn't

- **[2026-07-28] Re-running a red CI check to "see if it was flaky" is not evidence and not
  a fix.** Three re-runs of the same commit produced three different failure sets (4 tests,
  then 1, then 2). What actually settled it was a controlled A/B on a clean branch: two full
  suites concurrently, same code, only `--testTimeout` differing — 5s failed both twins, 20s
  passed both. Reproduce the condition, then change one variable.

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

### build-guards
- `scripts/check-no-direct-exposure.mjs` is a *source-and-config* scan, not a bundle scan —
  it never reads `dist/`. `scripts/check-public-bundle.mjs` is the bundle scan. They are
  separate guards with separate blind spots; a finding in one is not covered by the other.
- The exposure guard's original design was deliberately narrow (two known loopback ports)
  so an unrelated number could not trip it. Generalizing it means *adding* rules beside that
  one, not loosening it — the port rule must keep its exact original behavior.

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
