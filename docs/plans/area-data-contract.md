# Area plan — `data-contract`

Owns `src/data/`, `src/types/`, `src/fixtures/`, `src/state/`. Written 2026-07-31
(AUTO GO iteration 32) because C1's bound contracts are the response/ledger docs and no
area plan existed to hold the sequencing findings below.

## What this area is for

It is the repo's **honesty boundary in code**: every value that reaches a civic slot passes
through here, and `assertWebSafe` is the last thing standing between a raw backend path and
the DOM. Nothing in this area may recompute trust, derive a verdict, or promote a fixture
value into a reviewed slot.

## Current state

| | |
|---|---|
| Types | `agenda-board`, `newsletter-digest`, `notification`, `read-api`, `upload-intake` |
| Leak boundary | `assertWebSafe` + `RAW_PATH_FORBIDDEN_KEYS`, table-driven in `test/web-safe.test.ts` |
| Async surface | `ReviewerContextStore` — fail-closed, verified: success → 401 leaves **0 rows** and stays unavailable |
| Missing | the five canonical presentation types (#70) |

## #70 — the one open issue, and the order it should be done in

`docs/product/issue-card-contract.md` is adopted, but **none of its presentation types
exist**. Four surfaces hand-roll their own card, so the same absent field is worded
differently per page and an honesty fix must be applied three to five times — missing one
is invisible. That is the defect: not duplication for its own sake, but **divergent trust
wording with no single place to correct it**.

**Two sequencing facts, checked 2026-07-31:**

1. **The stated blocker is stale.** The issue says to land after PR #57. **#57 is closed and
   was never merged**; the shared reviewer context exists anyway (`src/state/reviewer-context.ts`).
   Nothing to wait for.
2. **#85 should land first**, and neither issue records the other. Both restructure
   `src/ui/pages-program.ts`. #85 deletes ~340 lines of orphan renderers; #70 migrates
   `renderIssueDossierCard`, whose only caller (`renderIssueDetail`) is *not* a #85 deletion
   target. Doing #85 first shrinks the file #70 migrates instead of forcing a rebase across
   a large deletion.

**Suggested order once picked up:** #85 → `src/types/presentation.ts` (AC1, self-contained)
→ shared card module + the 7 test-matrix rows (AC2/AC5) → migrate `design-pages.ts` →
migrate `pages-program.ts` → delete both duplicate badge builders (AC3/AC4).

**Why it was not started in a tail-end pass:** every section of it renders **trust labels**.
The failure mode is a subtly reworded trust state on one surface — precisely what the issue
exists to prevent. It wants a focused pass.

## Test plan

`client`, `web-safe`, `reviewer-normalize`, `state-matrix`, `state-view`,
`gov1527-api-integration`. The web-safe suite is already table-driven over
`RAW_PATH_FORBIDDEN_KEYS`, which is the right shape: it tracks the constant rather than a
hand-picked sample.

## Honesty notes

No adapter added here may recompute trust, derive a civic conclusion, or promote a fixture
value into a reviewed slot. Fixture rendering keeps requiring reviewer access, the fixture
flag, and the `SYNTHETIC DESIGN FIXTURE` banner.
