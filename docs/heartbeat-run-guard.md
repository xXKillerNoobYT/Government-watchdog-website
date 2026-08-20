# Heartbeat run guard — bound browser-audit calls and recover stale runs

**Owner:** AutomationOpsEngineer (`b9611d2e-d5d0-438e-9081-99f94cd65f06`) ·
**Status:** v1, landed for GOV-2135 / [website#229](https://github.com/xXKillerNoobYT/Government-watchdog-website/issues/229) ·
**Reviewed by:** VerificationSafetyReviewer (`3f95c8ce-c929-4c30-a327-9871bcbc5643`)

This runbook owns the rule. Where CLAUDE.md or another doc summarizes it, this
file wins.

---

## 1. The failure this removes

Scheduled heartbeats run browser/viewport audit calls that drive a `vite preview`
/ `vite` server through Playwright (`scripts/local_e2e.sh`, `scripts/gov1569-shot.mjs`).
website#229 recorded, on **America/Denver** wall-clock:

| Symptom | Measured |
|---|---|
| A viewport-emulation call ran unbounded | ~215,179 s (**59h 46m 19s**), from the `2026-08-16 06:16 -06:00` pulse |
| A later call ran despite a nominal 90 s tool timeout | ~100,854 s (**~28h**) — the *tool* timeout gave **no hard cancel** |
| Vite child processes survived the owning call | orphaned `vite` after the call was no longer useful |
| Two-hour pulses starved until manual rebaseline | to `2026-08-18 18:19 -06:00` |

The root cause is that the timeout lived **inside** the called tool. A call that
never resolves, or ignores its own cancellation, is never actually stopped, and
its child server is never reaped.

## 2. The mechanism

`scripts/heartbeat-guard.mjs` enforces the bound **outside** the tool, plus a
durable lease, recovery, and cadence catch-up. Nothing here changes the
automation prompt, the schedule, an authority boundary, a private-beta gate, or a
publication-safety check — it is purely additive supervision.

1. **Hard wall-clock cancellation (AC1).** `runBounded()` spawns the audit command
   as the leader of its **own process group** (`detached: true`) and sets a
   parent-side deadline **shorter than the two-hour pulse**. When it fires, the
   parent signals the whole group — the tool cannot opt out.
2. **Recursive cleanup + verification (AC2).** Cancellation is `SIGTERM` →
   `grace` → `SIGKILL`, group-directed, so it reaches the Vite child (and any
   grandchild). Afterwards the guard **verifies** the owned ports are no longer
   listening; a survivor or bound port is a cleanup failure, not a pass.
3. **Durable lease (AC3).** `lease.json` records `runId`, `owner`, `lane`, `step`,
   `startEpochMs`, `deadlineEpochMs`, `pgid`, and owned `ports`. The deadline is a
   wall-clock instant, so the lease **expires independently of the worker** even
   if the worker is wedged.
4. **Stale-run recovery (AC4).** The next heartbeat calls `recover` **first**: an
   expired lease (or one whose worker pgid is dead) is marked stale, any survivor
   is killed, ports are freed, an append-only Session is written, and the lease is
   cleared — so the pulse **resumes** instead of deferring indefinitely.
5. **America/Denver cadence reconciliation (AC5).** `reconcileCadence()` computes,
   against Denver-anchored pulses, which lane pulses were missed and a **deduped**
   catch-up plan (one entry per lane, in-progress lanes excluded) so missed lanes
   are caught up **without overlapping or duplicating**.
6. **Append-only Session log (AC6).** Every stall/recovery/bounded run appends one
   JSON line to `sessions.jsonl`: elapsed time, affected lane, cleanup result,
   evidence invalidated, and next-due work.

### Runtime state (git-ignored — machine-local run evidence, not source)

```
.heartbeat-guard/
  lease.json        # the live run's durable lease (absent when idle)
  sessions.jsonl    # append-only stall/recovery/run record
  completions.json  # lane -> last successful-completion epoch (cadence input)
  guard.log         # [YYYY-MM-DD HH:MM:SS] [LEVEL] message
```

## 3. How the scheduled heartbeat uses it

Each pulse, before doing any browser work:

```bash
# 1. Recover any prior stalled run (kills survivors, frees ports, logs, clears lease).
node scripts/heartbeat-guard.mjs recover --apply

# 2. See what is due / was missed (read-only).
node scripts/heartbeat-guard.mjs reconcile

# 3. Run the lane's browser audit under a hard bound shorter than the 2h pulse.
node scripts/heartbeat-guard.mjs run \
  --lane a11y-responsive --deadline-seconds 300 --ports 4173 --apply \
  -- bash scripts/local_e2e.sh
```

`run --apply` recovers first, acquires the lease, runs the command bounded, on
timeout hard-cancels the whole group and verifies the ports, then appends a
Session and clears the lease. **The default is a dry-run** that spawns nothing and
prints the plan; `--apply` is required to spawn, kill, or clear.

**`run --apply` exit codes** (so timeout/cleanup failures are actionable
required-check failures — AC8):

| Code | Meaning |
|---|---|
| `0` | Command completed; completion recorded for cadence |
| `2` | Command exited non-zero |
| `3` | **Timed out** and was hard-cancelled cleanly (group gone, ports freed); the audit did **not** finish, so its output is **not** release evidence |
| `4` | Timed out **and cleanup failed** (a survivor process or bound port remains) — inspect `status`, free the named ports |
| `1` | Usage / spawn error |

## 4. Script contract (`scripts/heartbeat-guard.mjs`)

| Field | Value |
|---|---|
| **Target** | Bound every heartbeat browser/tool call; recover stale runs; reconcile the Denver cadence |
| **Trigger** | Each scheduled heartbeat pulse (`recover` → `reconcile` → `run`) |
| **Input contract** | `--lane`, `--deadline-seconds` (`0 < N <` 7200), optional `--ports`, `--grace-seconds`, `--owner`, `--state-dir`, and `-- <command…>`; cadence reads `completions.json` |
| **Output contract** | `lease.json`, `sessions.jsonl`, `completions.json`, `guard.log`; killed process groups; freed ports; JSON report on stdout |
| **Log path** | `.heartbeat-guard/guard.log` (override with `--state-dir`) |
| **Success-log shape** | `[2026-08-20 10:14:02] [INFO] run <id> completed in 0h 4m 12s` |
| **Failure-log shape** | `[2026-08-20 10:16:00] [ERROR] run <id> TIMED OUT after 0h 5m 00s; hard-cancelled group killed=true sigkill=true portsFreed=true` |
| **Retry policy** | No auto-retry of the guarded command. A timed-out lane is re-scheduled by the **next** pulse via `reconcile` catch-up (deduped) |
| **Issue threshold** | Any `run --apply` exit `4` (cleanup failure) or a `recover` exit `4` → file an issue naming the surviving pgid/port; a starved cadence (`reconcile` shows missed lanes across ≥2 pulses) → file with the Session excerpt |
| **Review cadence** | Re-verify on any change to the heartbeat schedule, the pulse interval, or the lane rotation |
| **Owner** | AutomationOpsEngineer `b9611d2e-d5d0-438e-9081-99f94cd65f06` |
| **Acceptance tests** | `test/heartbeat-guard.test.ts` (runs under `npm test`); also `node scripts/heartbeat-guard.mjs selfcheck` |
| **Improvement metric** | Worst-case heartbeat occupancy by a single browser call drops from **unbounded** (measured 59.8 h) to `≤ --deadline-seconds + grace` (< 2 h by construction); zero orphaned Vite children; zero indefinitely-deferred pulses |

## 5. Automation-vs-AI boundary (this mechanism)

Every step here is **code with no model in the loop**: the deadline, the
`process.kill(-pgid, …)` escalation, the port probe, the lease read/write, the
staleness decision, and the cadence arithmetic are all deterministic. No AI step
decides whether to cancel, what to kill, or which lane is due. The only judgement
that stays with an agent is *acting on* a filed cleanup-failure or
cadence-starvation issue — which is exactly the boundary Directive 7 draws.

## 6. Verifying a change

```bash
npm test && npx tsc --noEmit && npm run build        # CLAUDE.md §3 — all three
node scripts/heartbeat-guard.mjs selfcheck            # end-to-end kill/recover/catch-up
```

The synthetic workload `scripts/heartbeat-guard-hang.mjs` reproduces website#229
with **no browser, credential, provider payload, local path, or civic record**: it
ignores cooperative `SIGTERM` and spawns a child server that binds a loopback
port. `test/heartbeat-guard.test.ts` drives it to prove hard cancellation,
recursive cleanup, lease expiry, recovery, and deduped catch-up. Because that test
runs under `npm test` — a required CI check — a regression in any of those is a
red required check (AC8).

## 7. Rollback

The change is additive and self-contained. To roll back completely:

```bash
git revert <merge-commit>        # removes the harness, workload, test, doc, gitignore entry
```

or, to disable at runtime without reverting, simply stop invoking
`scripts/heartbeat-guard.mjs` from the heartbeat — no other code imports it, and
`test/heartbeat-guard.test.ts` exercises only the module (removing the two script
files would make just that one test file fail; the rest of the suite is
unaffected). The git-ignored `.heartbeat-guard/` state directory can be deleted
freely; it is rebuilt on the next run.

## 8. Not covered here (distinct trackers, per website#229)

`#92` responsive-capture harness · `#110` self-hosted CI runner contention ·
`#214` connector write authorization · `#225` stale worktree registration. This
runbook is only tool-call hard cancellation, stale-run recovery, orphan child
cleanup, and Denver cadence catch-up — together.
