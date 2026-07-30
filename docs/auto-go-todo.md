# AUTO GO — Todo (Government Watchdog website)

Lightweight scratch board. Owner-pinned items override the area rotation.
Seeded 2026-07-28 on first run.

## Owner-pinned (top of stack)

*The owner's input lane. AUTO GO reads this first and never writes here.*

- [ ] *(empty)*

## Active iteration carry-overs

- [ ] **Issue #55 remaining acceptance criteria** — iteration 1 landed AC1 (URL-form
      rejection), AC6 (mixed public/private package rejection), and AC8 (precise,
      credential-safe reporting) in `scripts/check-no-direct-exposure.mjs` and
      `scripts/check-public-bundle.mjs`. Still open on that issue:
      AC2 full emitted-asset + module-graph scan (`dist/**` JS/CSS/HTML/JSON/maps/workers/
      manifests); AC3 assert credentials/bearer headers/cookies never attach off-origin;
      AC5 dynamic-import / `new URL(..., import.meta.url)` / CSS-url / binary-asset cases.
      AC7 (hosted anonymous probes) is **owner-gated** — it needs a deploy, and deploy is
      on HOLD per GOV-420.

## Agent-discovered (awaiting owner ratification or scheduling)

*Surfaced, not acted on.*

- [ ] **PR #68 is the critical path for the whole MOTY backlog.** Ten P0/P1 issues cannot
      start until it merges. It reports 707 tests green, `tsc` clean, build succeeding, and
      it has no review comments. Merging it (owner-only) unblocks more work than any other
      single action available right now.
- [ ] **`docs/product/` and `docs/prompts/` are untracked in the owner's working copy at
      `~/Code/Government-watchdog-website`** but are added by PR #68. Worth confirming the
      working copy is not holding an uncommitted variant that will conflict on merge.
- [ ] **No `CLAUDE.md` exists at this repo's root.** The binding contract, the three-command
      verification ritual, and the never-merge/never-main rules currently live only in the
      scheduled-task definition and `docs/company-os/AGENT-RULEBOOK.md` (which is itself
      still unmerged, inside PR #68). Any agent starting cold in this repo has no in-repo
      statement of the rules. Recommend adopting one — C12 will propose it once the
      rotation reaches an area that justifies it.
- [ ] **The GS/DG collapse that GOV-SPA flagged is issue #69**, and #69 is blocked behind
      PR #68. Recorded so the finding is not re-discovered a third time.
- [ ] **Issue #97** — `VITE_READ_API_URL` is documented in `.env.example` but read by no
      code. Needs a decision (remove the key, or wire it up through the same root-relative
      validation as `VITE_API_BASE`); filed rather than guessed.
