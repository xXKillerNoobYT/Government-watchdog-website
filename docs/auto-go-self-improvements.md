# AUTO GO — self-improvements (Government Watchdog website)

Record of `loop-self-audit` findings and `loop-self-improve` mutations. Every entry carries
the trigger metric and the change made — or the reasoning for making none.

---

## 2026-07-29 — iteration 4 — first `loop-self-audit` + `loop-self-improve` pass

Both meta-checks were two days overdue; iterations 2 and 3 deferred them for carry-over work
that genuinely outranked them, and both recorded the deferral honestly rather than skipping
it silently.

### `loop-self-audit` findings

**S1 — Severity 1. C3 invokes a command that does not exist, so C3 is a no-op.**
`/auto-go.md`'s C3 dispatch says "**Invoke `/hunt-fix-loop` focused on this area**".
`/hunt-fix-loop` was searched for exhaustively and is **verified missing**:
`find /Users/IA/.claude -iname "*hunt-fix-loop*"` matches only the unrelated
`hunt-fix-loop-heartbeat` scheduled-task directory; `/Users/IA/.claude/skills` has no `hunt*`
entry; `/Users/IA/.claude/commands/` contains `hunt-fix.md`, which is the separate HUNT FIX
cron routine with its own heartbeat — not a callable body named `hunt-fix-loop`.

This means one of the 17 area checks has been silently doing nothing every time the rotation
reached it. It is listed as required for area graduation, so an area could "graduate" with
C3 green having run no scanner at all. **Not fixed autonomously** — deciding what C3 should
invoke instead (the HUNT FIX body? a new scoped scanner? retire C3?) changes the meaning of
a required check, which the loop's own rules route to Q&A. Filed as `docs/dev-qa.md` Q1 and
as GitHub issue **#106** with label `loop-self-audit`.

**S2 — Eight orphaned scanners, three of which falsely advertise that they are wired in.**
Of the 25 directories under `~/.claude/scheduled-tasks/`, these are referenced by no check in
`auto-go.md` and are not reachable transitively through anything it dispatches:
`grdb-silent-bug-scanner`, `identity-string-audit-scanner`, `render-perf-scanner`,
`service-permission-gate-scanner`, `production-readiness`, `usability-hunter`,
`page-rebuild-enforcer`, `issue-closure-verifier`.

Three of them state in their own frontmatter that they are wired in, and are not:
`grdb-silent-bug-scanner` claims "Wires into C3 and C8 dispatch" (C8's `security-review/SKILL.md`
does not mention it, and C3's target does not exist); `identity-string-audit-scanner` claims
"Wires into C8 dispatch" (not mentioned); `render-perf-scanner` claims "Wires into C7b
dispatch" (`dev-improvement-scanner/SKILL.md` does not mention it); `production-readiness`
says "Invoked as a check inside /auto-go" while `grep -c "production-readiness" auto-go.md`
returns 0. A scanner that claims its own wiring is worse than one that says nothing, because
an audit that trusts the frontmatter concludes coverage exists.

**S3 — C7 and C10 can never legitimately go green on this project.**
C7 (`usability-enforcer`, "this area's **iOS pages**") and C10 (`cross-platform-qa`, "iOS
native ↔ **Tauri**/React match") are written around WiredPart's architecture. Measured here:
`grep -ril tauri .` returns **zero hits anywhere** in this repo, so C10 has no second leg to
compare. This repo *does* contain a native app (`ios/GovWatchdogApp/`, 90 Swift files, its
own `.xcodeproj`) — correcting an assumption carried in earlier notes — but it is a thin
auth/session companion, not wired into any npm script, and not "pages" in the enforcer's
sense. C7 and C10 are therefore structurally unsatisfiable, and `build-guards` cannot
graduate while they are required. Filed as `docs/dev-qa.md` Q2.

Related: `C1b`'s `plan-enforcer`, `C7`'s `usability-enforcer`, and `C11b`'s
`dev-pipeline-manager` bodies all still carry WiredPart vocabulary (`Features/<area>/`,
`swift build`, "iOS page") verbatim. `auto-go.md` itself was generalized to multi-project on
2026-07-27; **the bodies it dispatches to were not**.

**S4 — Six tracker paths the checklist writes to had never existed for this project.**
Verified missing on both the tracker branch and locally: `docs/dev-qa.md`, `docs/plans/`,
`docs/automation-recommendations.md`, `docs/auto-go-self-improvements.md`,
`docs/hunt-fix-tracker.md`, `docs/DevTODO/`. C1, C2, C11b, and C13 all write to these paths,
so those checks had structurally never persisted anything here. **Four of the six are created
by this iteration** (`dev-qa.md`, `plans/`, `automation-recommendations.md`, and this file).
`hunt-fix-tracker.md` is downstream of S1 and cannot be created honestly until C3 has a real
body. `DevTODO/` is WiredPart escalation tooling with no equivalent need here yet.

**S5 — Trackers are NOT stale.** All five `docs/auto-go-*.md` files were written within the
last ~36 hours. Recorded because the audit's own premise expected staleness and the
measurement contradicted it.

### `loop-self-improve` — analysis, and why zero mutations were applied

`docs/auto-go-metrics.md` holds **4 rows spanning 2 days** (iterations 1, 1b, 2, 3).

Every mutation trigger the loop defines is specified over **weeks**: "zero findings for 3+
consecutive weeks" (demote a check), ">10 findings/week" (promote), "the same missing-scanner
issue 3+ times" (build the scanner), "median Q&A answer time > 7 days", "queue growing by
>5/week", "no area graduated in 14+ days". **Two days of data cannot evaluate any of them.**

Mutating the loop on 4 rows would also be riskier here than elsewhere: `~/.claude/commands/auto-go.md`
is shared with the `auto-go-gov-backend` routine, which is actively mid-flight (its iteration 5
shipped backend PR #181 earlier today). A priority reorder inferred from two days of *website*
data would silently retune the backend routine too.

**Mutations applied this pass: none.** The two structural defects that would justify one
(S1, S3) are both changes to what a *required* check means, which the loop's own rules route
to owner Q&A rather than to autonomous edit. They are filed there, with the measurements
attached, so the next pass starts from evidence instead of rediscovering them.

**What this pass did instead:** built the four missing tracker artifacts (S4) so that C1, C2,
C13, and this check have somewhere to persist. Until they did, each pass would have
re-derived the same findings and dropped them — which is what the last three iterations show.

**Watch for next pass (needs ~3 weeks of rows):** whether C8 keeps producing the highest
finding yield (it has produced every finding so far, 11 of 11 across iterations 1–3), and
whether `build-guards` graduates at all given S3 blocks it on C7/C10.
