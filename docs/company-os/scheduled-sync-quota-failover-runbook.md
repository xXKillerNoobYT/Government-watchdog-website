# Scheduled-sync quota fail-over / defer runbook

> **Owner:** AutomationOpsEngineer (AOE). **Status:** active from 2026-08-25.
> **Governs:** every scheduled Government Watchdog run — the auto-go, sync, and
> scanner cadence lanes — that a control-plane schedule spawns without a human in
> the loop. **Tracks:** GOV-2259 / GitHub website #249. **Stage slot:** feeds the
> `.09` Automation-vs-AI boundary matrix (the preflight is code with no model in
> the loop).

This runbook is the durable rule. Where a scheduled-task `SKILL.md`, an issue
comment, or memory disagrees with it, this file wins — fix the other surface.

---

## 1. The failure this exists to stop

A scheduled run wakes an agent, the agent's turn selects a model whose **weekly**
allowance is already exhausted, and the turn dies in under four seconds:
`status=failed`, `issueId=null`, `errorCode=acpx_turn_failed`, `exitCode=1`. The
observed sequence (2026-08-23) was three AutomationOpsEngineer attempts and one
CTO attempt, each failing the same way, each re-selecting the same exhausted
adapter, and **none acquiring a durable issue or checkout** — so the skipped
maintenance/reconciliation/release-safety work had no owner and left no record.

Three things were wrong and this runbook fixes all three:

1. **No preflight.** The run started work before checking whether the model it
   would use was already known-exhausted.
2. **No bounded policy.** Retries and the handoff chose the *same* unavailable
   adapter and failed again, burning control-plane capacity without progress.
3. **No durable owner.** A missed run left nothing behind: no deferral, no reset
   time, no catch-up record, nothing to reconcile after the reset.

> A missing automation run is **not** release evidence. A deferral recorded here
> never authorizes a deploy, merge, access expansion, or public exposure.

---

## 2. The deterministic core

`scripts/scheduled-sync-guard.mjs` (proven by `test/scheduled-sync-guard.test.ts`)
is the code every scheduled run consults. It is pure decision logic plus a durable
ledger; it **never** spawns runs, selects real credentials, publishes, or sends.

| Command | Reads/Writes | What it answers |
|---|---|---|
| `--preflight --lane <lane> [--primary-exhausted] [--fallback-available]` | read-only | Before starting: `proceed` / `fallback` / `wait_deferred` / `defer` / `catch_up`. |
| `--record-deferral --lane <lane> (--message\|--message-file) [--cadence-min N] [--evidence a,b] --apply` | writes ledger | Classify a sanitized failure; if it is a weekly-limit exhaustion, record **one** durable deferral. Idempotent. |
| `--catch-up [--active-lane a,b]` | read-only | List deferrals whose reset has passed and are due, minus lanes with an active run (held). |
| `--reconcile --lane <lane> --apply` | writes ledger | After a lane's catch-up completes, clear its deferral so it stops firing. |

Defaults are a **read-only dry run**; `--apply` is explicit (Forbidden Spell A3).
State lives under `$GW_SCHED_SYNC_STATE_DIR`, else `<repo>/.scheduled-sync-state/`
(git-ignored, per-machine runtime state). Log lines are
`[YYYY-MM-DD HH:MM:SS] [LEVEL] message` in America/Denver.

### The one bounded policy (`decideAdmission`)

Exactly one action, and it **never re-selects a known-exhausted adapter**:

- **proceed** — primary adapter available, lane not deferred → run now.
- **fallback** — primary exhausted, an *approved* fallback is available → run it.
- **wait_deferred** — lane already deferred and the reset has not arrived → do
  nothing. No retry. No second invocation of the exhausted adapter.
- **defer** — nothing available and no live deferral → record **one** deferral.
- **catch_up** — lane was deferred and the reset has passed → reconcile the lane.

"Approved fallback" is a control-plane decision (which adapter, whose budget) —
this code only reports whether one is *available*; it does not choose or spend.
Expanding the approved-fallback set, or any scope beyond Alpine, is a CEO call.

### The durable deferral record

One `(lane, resetInstant)` = one record; recording it again is a no-op
(idempotent). Each record carries: affected **cadence lane**, **reset time** in
America/Denver, **evidence invalidated** (default `scheduled-sync`), the **first
eligible catch-up pulse**, when it was recorded, and whether it has been
reconciled. This record *is* the durable owner of the skipped work — it survives
the process that created it and drives the wake after the reset.

### Sanitization

`sanitizeForOperator` reduces any raw provider text to a single allowed line —
the classification and, when parsed, the reset wall-clock — and **drops**
everything else (URLs, emails, paths, tokens, hashes, civic values) rather than
masking it, so a novel secret shape cannot ride through. Nothing but that line
reaches the ledger or the log. Verified by the leak assertions in the test.

---

## 3. The lifecycle (what a scheduled run does)

1. **Preflight.** Before acquiring an issue, run `--preflight --lane <lane>`.
   - `proceed`/`fallback` → do the work on the returned adapter.
   - `wait_deferred` → exit cleanly; the lane is already owned by a deferral.
   - `defer` → go to step 2.
   - `catch_up` → go to step 4.
2. **Defer once.** On a weekly-limit failure, `--record-deferral … --apply` with
   the **sanitized** message. This establishes the durable owner. Do not retry
   the exhausted adapter; do not loop.
3. **Report, sanitized.** Surface the single sanitized line to the operator. Never
   the provider payload.
4. **Catch-up after reset.** On a pulse at/after the reset, `--catch-up`. For each
   **due** (not held) lane, perform missed-lane reconciliation, then
   `--reconcile --lane <lane> --apply`. A lane with an active Codex/Paperclip run
   is **held**, not started, so reconciliation never overlaps an active run.

---

## 4. Where the preflight is invoked — wired (Option A), one residual escalated

The deterministic core lives in this (public) repo and is fully tested. **Wiring
it into the machine-local control-plane** — having the scheduled GOV run call the
preflight before it works, and call catch-up on the reset pulse — is owner-delegated
machine-local configuration (`~/.claude/scheduled-tasks/…`), which an agent inside
one of those runs must not silently rewrite (same boundary as GOV-2258).

**Status (2026-08-27, GOV-2298):** wired under owner-accepted **Option A** (defer,
fallback OFF). An additive `STEP 0 — Scheduled-sync quota preflight` block was
prepended to both GOV scheduled entries —
`~/.claude/scheduled-tasks/auto-go-gov-website/SKILL.md` (lane `gov-website`) and
`…/auto-go-gov-backend/SKILL.md` (lane `gov-backend`). Each runs
`--preflight --lane <lane>` first and obeys the printed `action` verbatim
(`proceed`/`wait_deferred`/`defer`/`catch_up`), records one durable deferral on a
weekly-limit hit (`--record-deferral … --apply`, idempotent), and reconciles due
lanes on the reset pulse. **`--fallback-available` is never passed**, so no
model-switch/extra-spend path exists (the Option A guarantee). The wiring is
additive (the original iteration body is unchanged beneath STEP 0), fail-open (if
the guard file is absent it emits `{"action":"proceed"}` and runs normally), and
reversible (timestamped `SKILL.md.bak-GOV-2298-*` backups beside each entry). It
does **not** change any task's enabled/disabled state. Full what/where/revert:
the machine-local note `~/.claude/scheduled-tasks/GOV-2298-quota-preflight-wiring.md`.

**One residual, owner/CEO-delegated:** the SKILL.md-layer hook fires only after the
run's agent has spawned and can run one `node` command. The original failure mode
(`acpx_turn_failed`, turn dies < 4 s when the ACPX/Codex adapter selects an
already-exhausted model) can pre-empt STEP 0. A true **pre-spawn** hook inside the
ACPX/Codex scheduler — running the preflight before adapter selection — remains a
delegated follow-up; the lane ids and ledger above are its ready-made building
block. A scheduled run can also always call the guard by hand per §3; the behavior
is identical.

---

## 5. Rollback

The change is additive and side-effect-free until invoked with `--apply`:

- **Disable the behavior:** stop calling `scripts/scheduled-sync-guard.mjs` from
  the scheduler. No build, route, page, lane, or product code depends on it; the
  guard is not in any `build`/`test` gate beyond its own unit test.
- **Revert the code:** `git revert` the PR. The only repository surfaces touched
  are `scripts/scheduled-sync-guard.mjs`, `test/scheduled-sync-guard.test.ts`,
  this runbook, the `.gitignore` entry, one `package.json` script key, and a
  pointer line in `AGENT-RULEBOOK.md`. None are load-bearing for the site.
- **Clear runtime state:** delete `$GW_SCHED_SYNC_STATE_DIR` (or
  `<repo>/.scheduled-sync-state/`). It is git-ignored per-machine state; deleting
  it only forgets in-flight deferrals, which then re-derive from the next failure.

No rollback step touches `BACKEND_REF`, Stage 98, any release gate, or any
private-beta safety rule.

---

## 6. Acceptance mapping (GOV-2259)

| Criterion | Where it is satisfied |
|---|---|
| Preflight detects known exhaustion before issue work | `decideAdmission` → `wait_deferred`; `--preflight` §2 |
| One bounded policy: fallback or single durable deferral, no repeat | `decideAdmission`, `upsertDeferral` idempotency |
| Durable issue/run owner before execution, or reset-time continuation | the deferral record §2; catch-up wake §3.4 |
| Deferred work records lane, reset (Denver), evidence, catch-up pulse | deferral record fields §2 |
| Recovery reconciles missed lanes without overlapping an active run | `dueCatchUps` held-vs-due overlap guard |
| Output sanitized; no credentials/payloads/paths/civic records | `sanitizeForOperator`, leak assertions |
| Synthetic exhausted-quota test proves the whole arc | `test/scheduled-sync-guard.test.ts` (13 cases) |
| Versioned via linked PR with rollback | this runbook §5 + the PR |
| No prompt/schedule/authority/gate/safety rule weakened | §1 note, §4, §5; nothing outward-facing |

**Verified** is not a word AOE may write about its own script (Directive 3). This
runbook and the guard go to **VSR** for the review that turns `ran`/`observed`
into `verified`.
