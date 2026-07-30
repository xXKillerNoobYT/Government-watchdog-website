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

- [x] **Issue #55 — AC7 is owner-gated, not agent work.** Resolved as far as this loop can
      take it in iteration 5: the seven agent-reachable criteria are **merged to `main`**
      (`1c46b1a`). #55 auto-closed on the merge keyword at 7 of 8, so AC7 was re-filed as
      **#109** with the landed evidence recorded on #55 and the two linked both ways. C8 stays
      `blocked` — the blocker is the owner (deploy is HOLD per GOV-420), not code.

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

- [ ] **PR #45 is the only open PR, and it is not this loop's work.** `GOV-1520-updated-desing`
      — MOTY polish pass 1, tablet (768px) grid-blowout overflow on Boards/Vault. It reports
      `MERGEABLE/CLEAN`, but its checks predate #68 exactly as the whole #55 stack's did, and
      #68 rewrote the shell IA and grid primitives that a tablet-overflow fix targets — so its
      green is not only stale, it is stale across the change most likely to invalidate it.
      **Not merged:** the grant is explicit that a PR I did not produce and have not reviewed
      is not mine to merge. Next step is to *read* it and re-run its checks against current
      `main`, not to merge it on a green badge.

- [ ] **#110 — the #59 flake survived both fixes.** Filed this iteration with the measurement
      attached (20560ms vs a 20000ms ceiling; loaded fails, idle passes on the same sha). It
      will recur on **every future stacked merge**, because each merge starts a full
      `Website CI` on `main` that races the next PR's run on the one self-hosted machine.
      Recommended remedy is a `concurrency` group, explicitly **not** a third timeout raise.
      Needs an owner decision — it changes CI semantics for both repos' routines.

## Agent-discovered (awaiting owner ratification or scheduling)

*Surfaced, not acted on.*

- [x] **PR #68 MERGED by the owner 2026-07-30 06:14Z.** The ten-issue P0/P1 MOTY block is
      **unblocked** — #69, #70, #75, #76, #80, #82–#87 all cite files that now exist on
      `main` (`src/ui/coming-soon.ts`, `timeline-lanes.ts`, `diff-view.ts`,
      `docs/product/design-reference-inventory.md`). **This is the largest available lane and
      the natural next iteration's work**, starting with #69 (the P0 COMING SOON binding
      class), which several of the others depend on.

- [ ] **URGENT for the owner's clone — this is now live, not hypothetical.**
      `~/Code/Government-watchdog-website` sits on `main` at `97f23d8`, behind `origin/main`,
      and `docs/product/` + `docs/prompts/` are **untracked** there. #68 has now merged and
      tracks those exact paths, so `git pull` in that clone will **refuse** with
      `untracked working tree files would be overwritten`. Measured in iteration 3: of 11
      paths, 3 are identical and **8 differ, with the local copy the older draft every time**
      (mtime 2026-07-14, missing #68's precedence banner, still writing `Docs/product/*`).
      Nothing local is worth keeping, but untracked files are unrecoverable once deleted, so
      this stays **surfaced, not executed** — the remedy is `rm -rf docs/product docs/prompts`
      in that clone, then `git pull`. This loop worked entirely in a worktree from
      `origin/main` and never touched the owner's checkout.
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

- [x] **RESOLVED in iteration 5 — the stack is merged.** All five landed bottom-up
      (#98 → #96 → #100 → #103 → #107), each on a CI run taken *after* its parent, and the
      final `main` tree is byte-identical to the locally verified rebase tip. The warning
      below was accurate and is now historical; the trackers are on `main`, so future
      iterations branch from `main` rather than from a stack tip. Two protocol lessons are in
      memory: never `--delete-branch` while a dependent PR points at the branch, and
      retargeting a base does **not** re-run CI (close+reopen does).

- [ ] ~~**The #55 stack is now four deep and can only merge bottom-up:**~~
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
