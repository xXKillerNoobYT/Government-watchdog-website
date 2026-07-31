# Area plan — `ci-tooling`

Owns `.github/workflows/`, `scripts/local_e2e.sh`, `scripts/gov1569-shot.mjs`, and the
test-infrastructure settings in `vite.config.ts`. Written 2026-07-31 (AUTO GO iteration 27)
because C1's bound contract was `docs/plans/` and no plan for this area existed — the same
gap iteration 1 papered over for `build-guards`.

## What this does

Runs the three-command bar (`npm test`, `tsc --noEmit`, `npm run build`) plus both lane
builds and the four guards on every PR, on **one self-hosted macOS runner**. That single
machine is the defining constraint of this area: nearly every defect here has been a
*contention* problem, not a logic problem.

## Current state (measured, not asserted)

| | |
|---|---|
| Trigger | `push: [main]` + `pull_request: ["**"]` |
| Concurrency | one global group, `cancel-in-progress: false` |
| Wall clock | 33–40s on an idle runner |
| Steps | checkout(v7) → `npm ci` → typecheck → `npm test` → `build:all` → public-bundle guard |

## The flake history — read this before "fixing" a timeout

Four changes, in order, each necessary and none sufficient alone:

1. **#59 / PR #98** — `testTimeout` 5s → 20s. Route-integration tests each
   `await import('../src/main')`, booting ~70 modules in jsdom; the 5s default had no margin.
2. **#68 / #107** — `push` narrowed from `["**"]` to `[main]`. Every PR push had been
   starting **two** full suites concurrently on one machine.
3. **#110 / PR #120** — a global `concurrency` group. The remaining race was *cross-ref*:
   `main`'s post-merge run overlapping a different PR's run. Post-merge proof: a dispatch
   created 9s into a push run **queued** rather than overlapped (04:51:05Z → 04:51:08Z).
4. **#105 / PR #140** — removed the duplicated `test:smoke` step (1.1s; `npm test` already
   matches that file).

**Standing rule: do not raise `testTimeout` again.** It has been missed twice (21624ms, then
20560ms, against a 20000ms ceiling). A threshold fix against a load problem only buys
headroom until the headroom runs out. Fix the load.

## Deliberately not done, with reasons

- **`e2e:local` is not wired into CI (#104, `owner-decision`).** It hard-fails without a
  backend checkout at a hardcoded absolute path and without `Database/gov_watchdog.db`, a
  file gitignored *because it is a disclosure boundary on a public repo*. A job that passes
  because of untracked machine state is worse than no job. Revisit once website#119 /
  backend#195 make the site build from a hash-verified storage snapshot.
- **The triple `tsc --noEmit` stays** (#105). Measured 2.1s each: the standalone step
  fails before the 11.1s suite, and the two inline runs keep each lane script independently
  safe when run alone. Duplicated ≠ wasteful.

## Test plan

`test/integration-smoke.test.ts` (5 assertions) and `test/reviewer-context-routes.test.ts`
(3) are the bound tests. Workflow YAML has no unit-test surface — it is validated by CI
running it, which is why a workflow change is verified by reading the executed **step list**
of the resulting run, not by asserting on the file.

## Security / honesty notes

Workflows must never echo a secret or a `Database/` path. The runner is loopback-only by
design; nothing here may add a network dependency for the *run* (a one-time `npm ci` is the
accepted exception).
