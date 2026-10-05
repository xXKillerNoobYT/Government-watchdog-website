# Dev Q&A — Government Watchdog website

Design decisions that belong to the owner. AUTO GO files them; it does not answer them.

**How to answer:** edit the `_pending_` line to `_answered YYYY-MM-DD_` and write the
decision underneath. Answered clusters move to the Processed log at the bottom.

Created 2026-07-29 (iteration 4). Until now this file did not exist, so C2 was trivially
green and every design question the loop hit had nowhere to go.

---

## Loop integrity — 2026-07-29

### Q1 — What should C3 actually invoke? _answered 2026-07-30_

**Resolution: (c) — C3 is retired**, exactly as recommended. The shared
`~/.claude/commands/auto-go.md` was edited 2026-07-30 with owner authorization (per the
backend routine's provenance-carrying hub entry; the file itself now carries the change):
C3's row reads "RETIRED 2026-07-30", the checklist is 16 checks, and existing checklists
mark it `n/a (retired)`. **One correction to this question's own premise, measured by the
backend routine and verified in the file:** the assumption "HUNT FIX already owns hunting"
is FALSE — `hunt-fix.md` STEP 3 invokes the same nonexistent `/hunt-fix-loop`. So automated
hunting is currently done by **nothing**; that gap is escalated as website #106 (kept open,
now labelled `owner-decision`) and cross-repo backend #191. The owner decision remaining is
what should own hunting, not whether C3 stays.

**Measurement:** `/auto-go.md`'s C3 says "Invoke `/hunt-fix-loop` focused on this area."
`/hunt-fix-loop` does not exist. `find ~/.claude -iname "*hunt-fix-loop*"` matches
only the unrelated `hunt-fix-loop-heartbeat` scheduled-task directory;
`~/.claude/commands/` has `hunt-fix.md`, which is the separate HUNT FIX cron routine
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

### Q2 — C7 and C10 are unsatisfiable on this repo. Drop, or re-scope? _answered 2026-07-30_

**Resolution: the shared file now carries a general rule that subsumes option (a).** The
2026-07-30 owner-authorized edit adds "a check that cannot fail is not evidence — bind it or
retire it, never leave it `blocked`": on the second consecutive iteration a check is blocked
on a missing prerequisite it must be retired, bound via the project's `area_bindings`, or
marked `n/a` with a stated reason. Applied to this repo in iteration 7: **C10 is `n/a`
repo-wide** (no second platform exists — `grep -ril tauri .` is zero, and the iOS companion
ships nothing the web build ships, so there is no parity relation); **C7 is `n/a` for
`build-guards` only** (this area renders nothing). C7's intent — usability of a real UI —
is alive on this repo and must be **re-bound to the web surface** when the rotation reaches
`pages-civic` / `shell-nav` / `a11y-responsive`; marking it n/a there would be the "silently
absorbed" move this loop refuses. That re-scope body is Q3's territory and stays open.

**Measurement:** C7 (`usability-enforcer`) is specified over "this area's **iOS pages**";
C10 (`cross-platform-qa`) over "**iOS native ↔ Tauri/React** match". `grep -ril tauri .`
returns **zero hits anywhere in this repo**. The `ios/GovWatchdogApp/` companion app exists
(**15** Swift files — 13 Sources, 2 Tests; an earlier note said 90, corrected 2026-07-31 by
count) but is not wired into any npm script and is not "pages" in the enforcer's sense.

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

**ADDENDUM 2026-08-01 (iteration 51) — the hypothetical became an incident.** This question
was filed arguing that an agent editing `src/` has no fast feedback. Since then the gap
caused a real defect: `npx tsc --noEmit && npm run build` was run as one command and
`git commit` as the *next*, so the type error suppressed the success message but **did not
stop the commit** — a PR went up broken carrying a message claiming "tsc clean."

That reframes the ask. The valuable hook is not primarily about *speed* of feedback, it is
about the verification being **structurally unable to be bypassed** by shell chaining. A
`PreToolUse` hook on `Bash(git commit*)` running `tsc --noEmit` alone would have blocked it.

Narrower than the pre-commit hook declined on 2026-07-29: that one ran the full three-command
ritual on the self-hosted runner and would have compounded the #59 flake. This is one local
typecheck and never touches the runner. Still **APPROVE / DEFER / REJECT** — and still not
built, because building an unapproved automation is exactly what this file forbids.

*A1 (wire `e2e:local` into CI) and A2 (remove duplicated CI steps) were filed as issues #104
and #105 rather than as Q&A — they are ordinary work with a clear right answer, not design
decisions. They still need owner merge like any other change.*

---

## Repo memory

### Q5 — Ratify the root `CLAUDE.md`? _pending — PREMISE CORRECTED 2026-07-31_

**The original framing no longer holds.** This question was filed on the assumption that
"the PR is the ratification (nothing lands without an owner merge)". Merge authority moved
to this loop on 2026-07-29, so the file landed on the loop's own merge — nobody ratified it.
It has since been amended repeatedly (CS class, `grep -a` caveat added then removed, the
stale `test/` count replaced, the coming-soon primitive pointer) and is in active daily use
by both routines, so it is load-bearing but **still unreviewed by the owner**.

Mirrored to the owner-facing lane (Government Watchdog Q&A page) 2026-07-31, because an
owner decision parked in an agent-facing file is not actually asked. Kept open here as the
technical record.

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
