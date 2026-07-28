# AUTO GO — Todo (Government Watchdog website)

Lightweight scratch board. Owner-pinned items override the area rotation.
Seeded 2026-07-28 on first run.

## Owner-pinned (top of stack)

*The owner's input lane. AUTO GO reads this first and never writes here.*

- [ ] *(empty)*

## Active iteration carry-overs

- [x] **Issue #55 — AC2, AC3, AC5** — done in iteration 2 on
      `auto-go/gov55-bundle-graph-scan` (stacked on PR #96). `--emitted <dir>` mode added to
      `scripts/check-no-direct-exposure.mjs` and wired after `vite build` in both lanes;
      31 new tests. Auditing the emitted artifact subsumes the "Vite/Rollup module graph"
      requirement — Rollup rewrites dynamic `import()` and `new URL(..., import.meta.url)`
      into emitted files, so the artifact *is* the resolved graph and cannot drift from
      what ships.

- [ ] **Issue #55 — AC4, the last non-owner-gated criterion.** "Public build verification
      rejects any private fixture, reviewer-context, reviewer API, bypass, or private marker
      **regardless of import form**." `scanPublicBundle` in `scripts/check-public-bundle.mjs`
      only reads `TEXT_EXTENSIONS`, so a marker carried in an emitted image, font, or other
      binary asset is never looked at. The emitted scan added in iteration 2 already reads
      binaries as `latin1` for the two never-legitimate destination shapes; the same
      treatment applied to `FORBIDDEN_PUBLIC_MARKERS` closes AC4. Small and self-contained.

- [ ] **Issue #55 — AC7 is owner-gated, not agent work.** Hosted anonymous probes need a
      deploy, and deploy is on HOLD per GOV-420. It cannot close from this loop.

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
