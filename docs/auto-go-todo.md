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

- [ ] **Iteration 4 opens with the five overdue meta-checks.** `recommender`,
      `revise-claude-md`, `improver`, `self-audit`, `self-improve` have never fired and are
      two days overdue. Iterations 2 and 3 both deferred them for carry-over work that
      genuinely outranked them; C1b is a fresh check, so iteration 4 has no such excuse.
      `loop-self-improve` now has four metrics rows — still thin, but enough to read a trend.

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
