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

- [x] **Issue #55 — AC4** — done in iteration 3 on
      `auto-go/gov55-public-bundle-binary-markers` (stacked on PR #100). The
      `TEXT_EXTENSIONS` allow-list was **deleted** rather than extended: every emitted file
      is read as `latin1` and matched against each marker's UTF-8 bytes, so no extension can
      be blind again. 11 new tests. Proven on the real artifact first — `reviewer_internal`
      appended to a shipped `.woff2` and `Workspace · Home · Alpine` written to a `.bin`
      both scored **0 violations** before the change and are both named after it.

- [ ] **Issue #55 — AC7 is owner-gated, not agent work.** Hosted anonymous probes need a
      deploy, and deploy is on HOLD per GOV-420. It cannot close from this loop. **This is
      the only criterion left**; #55 is 7 of 8. C8 is recorded `blocked` on it, not `done`.

- [x] **Iteration 4 opens with the five overdue meta-checks** — done. All six fired. The
      backlog is cleared and the four missing tracker artifacts they write to now exist.
      `loop-self-improve` turned out **not** to have enough data after all: four rows over two
      days cannot evaluate a single one of its triggers, which are all specified over weeks.
      Zero mutations applied, with the reasoning recorded rather than the pass skipped.

- [ ] **C1b is `in_progress`, not done — residual build-guards drift is #102 and #97.**
      D1 (#101, the `VITE_*` value-scan fail-open) is fixed and red-proved. **#102** (marker
      match blind to ASCII-escaped forms) is the next real item in this area: measured as
      latent, not live, one `esbuild.charset: 'ascii'` away from real. **#97** needs an owner
      decision, so it is Q&A-shaped, not code-shaped. Next iteration should close #102.

- [ ] **`build-guards` cannot graduate until `dev-qa.md` Q2 is answered.** C7 and C10 are
      required and structurally unsatisfiable on this repo. Every other check can go green and
      the area still will not advance. This blocks the rotation itself, not just this area —
      worth surfacing to the owner ahead of the other questions.

## Agent-discovered (awaiting owner ratification or scheduling)

*Surfaced, not acted on.*

- [ ] **PR #68 is the critical path for the whole MOTY backlog.** Ten P0/P1 issues cannot
      start until it merges. It reports 707 tests green, `tsc` clean, build succeeding, and
      it has no review comments. Merging it (owner-only) unblocks more work than any other
      single action available right now.
- [x] **`docs/product/` and `docs/prompts/` untracked in the owner's working copy — checked
      in iteration 3, and it is a real snag.** All 11 paths compared against PR #68: 3 are
      identical, **8 differ and the local copy is the older draft every time** (mtime
      2026-07-14, missing #68's `Status: … those binding docs win` precedence banner, still
      writing `Docs/product/*` with a capital D). Because they are untracked, `git merge` /
      `git pull` of #68 in `~/Code/Government-watchdog-website` will **refuse** with
      `untracked working tree files would be overwritten` — and #68 is the merge that
      unblocks the ten-issue P0/P1 block. Nothing local is worth keeping, but untracked
      files are unrecoverable once deleted, so this was **surfaced, not cleaned**: remedy
      (`rm -rf docs/product docs/prompts` in the owner's clone) is commented on PR #68 for
      the owner to run. No files touched.
- [x] **No `CLAUDE.md` exists at this repo's root** — proposed in iteration 4, and the PR is
      the ratification (nothing lands without an owner merge). Deliberately **thin and
      pointer-based**: it restates no rule that `docs/design-information-type-matrix.md` owns,
      and its closing note says it should shrink further once `AGENT-RULEBOOK.md` lands. Every
      claim in it was verified against the repo rather than recalled — including two
      corrections to standing assumptions (this repo *does* have an `ios/GovWatchdogApp/`
      companion app; it has *no* Tauri target anywhere). Tracked as `dev-qa.md` Q5.
- [ ] **The GS/DG collapse that GOV-SPA flagged is issue #69**, and #69 is blocked behind
      PR #68. Recorded so the finding is not re-discovered a third time.
- [ ] **Issue #97** — `VITE_READ_API_URL` is documented in `.env.example` but read by no
      code. Needs a decision (remove the key, or wire it up through the same root-relative
      validation as `VITE_API_BASE`); filed rather than guessed.

- [ ] **The #55 stack is now four deep and can only merge bottom-up:**
      #98 (`vite.config.ts` timeout) → #96 (exposure generalization + package shape) →
      #100 (emitted-artifact scan) → the iteration-3 branch. Each is green and each was
      stacked because it genuinely depended on the one below. Nothing is wrong with it, but
      it is four owner merges in order, and the loop's trackers live on the topmost branch —
      so every future iteration must branch from the tip, and the trackers are invisible on
      `main` until the whole stack lands. Worth knowing before the next stack starts.

- [ ] **Issue #102** — the public-bundle marker match is blind to ASCII-escaped forms.
      Filed in iteration 3 with the measurement attached: the current build emits UTF-8
      literally and has zero `\uXXXX` escapes, so it is latent, not live. One
      `esbuild.charset: 'ascii'` away from being real.
