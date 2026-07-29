# Dev Q&A — Government Watchdog website

Design decisions that belong to the owner. AUTO GO files them; it does not answer them.

**How to answer:** edit the `_pending_` line to `_answered YYYY-MM-DD_` and write the
decision underneath. Answered clusters move to the Processed log at the bottom.

Created 2026-07-29 (iteration 4). Until now this file did not exist, so C2 was trivially
green and every design question the loop hit had nowhere to go.

---

## Loop integrity — 2026-07-29

### Q1 — What should C3 actually invoke? _pending_

**Measurement:** `/auto-go.md`'s C3 says "Invoke `/hunt-fix-loop` focused on this area."
`/hunt-fix-loop` does not exist. `find /Users/IA/.claude -iname "*hunt-fix-loop*"` matches
only the unrelated `hunt-fix-loop-heartbeat` scheduled-task directory;
`/Users/IA/.claude/commands/` has `hunt-fix.md`, which is the separate HUNT FIX cron routine
with its own heartbeat and soul, not a callable body.

**Consequence:** C3 is a required area-graduation check that has been silently doing nothing.
An area can graduate with C3 green having run no scanner.

**Why this is not an autonomous fix:** every option changes what a required check *means*.

- **(a) Point C3 at the HUNT FIX body.** Reuses real, working code. But HUNT FIX is a peer
  routine with its own heartbeat and 3-hour-offset schedule; invoking it from inside AUTO GO
  means two routines writing one tracker, and the offset that keeps them apart stops meaning
  anything.
- **(b) Write a new area-scoped scanner** that AUTO GO owns. Clean separation, and C3 finally
  does what it says. Costs a new SKILL.md and creates the exact "adding a system" the
  standing principle asks to avoid unless something retires.
- **(c) Retire C3** and let HUNT FIX own hunting entirely on its own schedule. This is the
  *shrink* option: AUTO GO stops claiming a check it never ran, 17 checks become 16, and
  nothing is lost that was actually happening. Recommended on the standing principle
  (remove > merge > simplify > automate), but it lowers the graduation bar, so it is
  the owner's call.

**Recommendation: (c).** Also filed as GitHub issue #106.

### Q2 — C7 and C10 are unsatisfiable on this repo. Drop, or re-scope? _pending_

**Measurement:** C7 (`usability-enforcer`) is specified over "this area's **iOS pages**";
C10 (`cross-platform-qa`) over "**iOS native ↔ Tauri/React** match". `grep -ril tauri .`
returns **zero hits anywhere in this repo**. The `ios/GovWatchdogApp/` companion app exists
(90 Swift files) but is not wired into any npm script and is not "pages" in the enforcer's
sense.

**Consequence:** both are required for area graduation, so **no area on this project can ever
graduate** while they stand as written. `build-guards` is the first area to hit this.

**Options:** (a) mark C7/C10 not-applicable per-project via a heartbeat field, preserving
them for WiredPart; (b) re-scope C7 to the web UI (this repo has real usability surface — it
just is not iOS) and drop C10 entirely, since it has no second platform to compare; (c) leave
them and accept that areas never graduate.

**Note (b) is two decisions, not one** — re-scoping C7 needs a web-appropriate scanner body,
which does not exist yet. **Recommendation: (a) now** (unblocks graduation immediately,
changes nothing for WiredPart), with (b)'s C7 re-scope filed separately if wanted.

### Q3 — The dispatched SKILL.md bodies were never generalized. _pending_

`auto-go.md` was generalized to multi-project on 2026-07-27, but `plan-enforcer`,
`usability-enforcer`, and `dev-pipeline-manager` still carry WiredPart vocabulary verbatim
(`Features/<area>/`, `swift build`, "iOS page"). Generalizing them is a larger change than
the self-improve pass may make autonomously. Worth doing, or accept per-project drift?

---

## Automation recommendations — 2026-07-29

Each recommendation from `docs/automation-recommendations.md` needs APPROVE / DEFER / REJECT.
AUTO GO implements only what is approved and reports failures rather than skipping silently.

### Q4 — A3: add repo-level Claude Code automation? _pending_

`find .claude -type f` returns only `.claude/settings.local.json`. Proposed: a PostToolUse
hook (or `/verify` skill) on edits under `src/` that reuses the already-exported
`PUBLIC_LOCAL_MODULES` set and `check-no-direct-exposure.mjs`, giving instant lane-violation
feedback instead of waiting for the full build chain. Purely additive, reuses existing logic,
no second source of truth. **APPROVE / DEFER / REJECT?**

*A1 (wire `e2e:local` into CI) and A2 (remove duplicated CI steps) were filed as issues #104
and #105 rather than as Q&A — they are ordinary work with a clear right answer, not design
decisions. They still need owner merge like any other change.*

---

## Repo memory

### Q5 — Ratify the root `CLAUDE.md`? _pending_

Both AUTO GO routines independently found that this repo had **no `CLAUDE.md`**, so an agent
starting cold had no in-repo statement of the binding contract, the three-command
verification, or the never-main/never-merge rules — those lived only in a scheduled-task
definition and in `docs/company-os/AGENT-RULEBOOK.md`, which is itself still unmerged inside
PR #68.

This iteration proposes one at the repo root. It is deliberately **thin and pointer-based**:
it restates no rule that `docs/design-information-type-matrix.md` owns, and its closing note
says it should shrink further once `AGENT-RULEBOOK.md` lands. Every claim in it was verified
against the repo rather than recalled. Merging the PR is the ratification — flagging it here
so the decision is explicit rather than incidental.

---

## Processed / closed

*(none yet)*
