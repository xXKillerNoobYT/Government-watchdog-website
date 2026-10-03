# GOV-2283 — Scheduling the backend evidence sync (fail-closed, no private data to public path)

**Owner:** AutomationOpsEngineer (AOE `b9611d2e-d5d0-438e-9081-99f94cd65f06`) ·
**Reviewer:** VerificationSafetyReviewer (VSR `3f95c8ce`) ·
**Go-live review:** CTO (`24fddc65`) · **Access-scope co-sign:** SecurityPrivacyAgent (SPA `72d0eccf`)
**Entrypoint:** `scripts/backend-evidence-sync-scheduled.mjs` (wraps
`scripts/backend-evidence-sync.mjs`) · **Tests:** `test/backend-evidence-sync-scheduled.test.ts`
**Source issue:** GOV-2283, follow-up to GOV-2274 (website #255).

> This document owns the **schedule wiring** only. The read lane, its sanitization, and its
> health verdicts are owned by [`gov2274-backend-evidence-sync.md`](gov2274-backend-evidence-sync.md)
> and are unchanged here. No boundary is weakened; no `--apply` exists on either script.

---

## 1. What was missing, and the smallest thing that fills it

GOV-2274 shipped the read capability plus a sanitized, fail-closed `collect`, but it runs only
on manual invocation. The gap is scheduling — and, specifically, the one property a bare cron
does **not** give you for free: **A2/F3 — a scheduled job whose failure nobody is woken for.**

The base `collect` already exits non-zero on any fail-closed verdict. The scheduled wrapper
`backend-evidence-sync-scheduled.mjs` adds exactly one deterministic behaviour on top, and
nothing else:

- **On success (exit 0):** clears any stale alert file and returns 0.
- **On any non-zero:** writes a **sanitized** alert record to a private sink **and** re-exits
  with the same non-zero code, so every host surfaces the failure identically (backend CI cron
  → red run + optional `gh issue create`; machine-local cron → `|| notify`; agent
  scheduled-task → files a blocker). No cached/partial fallback; the bundle is never written on
  a failing run.

It forwards no `--repo` override (scope stays locked in the base script) and has no `--apply`.
This is the smallest change that makes "scheduled **and** fail-closed **and** owner-surfaced"
a tested, host-independent property rather than a per-host convention.

---

## 2. SPA residual-risk-1 — the hard constraint, and how it is held

> The scheduled run MUST NOT route the sanitized bundle, any private issue title, PR head ref,
> author identity, or issue body into any committed path or any public log.

| Surface | Where it goes | Why it is safe |
|---|---|---|
| Evidence **bundle** (carries titles) | `$BACKEND_EVIDENCE_OUT` → run scratch → `./.backend-evidence/latest.json` | All three are gitignored/ephemeral. `/.backend-evidence/` is gitignored (`.gitignore:47`). Never committed. |
| **Alert** record | `$BACKEND_EVIDENCE_ALERT` → run scratch → `./.backend-evidence/alert.json` | Same gitignored stanza. Record is a **closed** shape — `{schema_version, kind, lane, exit, verdict, action, ts, note}` — with no field that can hold a title/body/ref/login. Proven by `buildAlertRecord` key-set + leak-sweep tests. |
| **Log lines** (stdout/stderr) | The host's run log | Only counts/enums/SHAs/states/exit codes/authored copy — the same `log()` discipline the base script already enforces. The wrapper never reads the bundle to build a log line; it branches on the exit code only. |

**Host constraint:** run the schedule where its logs are private — a **machine-local**
scheduler, or **backend CI** (the backend repo is PRIVATE, so its Actions logs are private).
**Never** the public-website Actions runner — that would create a secret surface on the public
repo. This is enforced by choice of host (below), not by the script.

---

## 3. Recommended durable host — backend CI cron (private repo)

The backend repo `xXKillerNoobYT/Government-watchdog` is **PRIVATE** (re-measured 2026-08-29,
`isPrivate:true`), so its Actions logs are private, and the self-hosted `gov-backend` runner is
live. This is a true deterministic cron (no agent in the loop) with native failure surfacing (a
red run), and it is in AOE's owned CI domain. **Staged, not yet applied** — CTO reviews before
it goes live (A3), owner merges (agents do not merge this org's repos).

Add as `.github/workflows/backend-evidence-sync.yml` **in the backend repo** (not this public
repo):

```yaml
# STAGED by GOV-2283 — do not enable until CTO reviews the wiring (A3). Read-only.
name: backend-evidence-sync
on:
  schedule:
    - cron: '17 */6 * * *'   # every 6h at :17 (off the :00 fleet-collision mark)
  workflow_dispatch: {}
permissions:
  contents: read
  issues: read
  pull-requests: read
  checks: read
concurrency:
  group: backend-evidence-sync
  cancel-in-progress: false
jobs:
  refresh:
    runs-on: [self-hosted, macOS, ARM64, government-watchdog, gov-backend]
    steps:
      - name: Check out the website repo (holds the read-only lane script)
        uses: actions/checkout@v4
        with:
          repository: xXKillerNoobYT/Government-watchdog-website
          ref: main
      - name: Scheduled backend evidence refresh (fail-closed)
        env:
          GH_TOKEN: ${{ github.token }}            # reads THIS (backend) repo; private logs
          BACKEND_EVIDENCE_OUT: ${{ runner.temp }}/backend-evidence.json     # ephemeral
          BACKEND_EVIDENCE_ALERT: ${{ runner.temp }}/backend-evidence-alert.json
        run: node scripts/backend-evidence-sync-scheduled.mjs   # non-zero fails the run
      - name: Raise a tracking issue on failure (owner-surfaced)
        if: failure()
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh issue create --repo xXKillerNoobYT/Government-watchdog \
            --title "[scheduled-sync] backend evidence refresh failed (fail-closed)" \
            --body "The scheduled backend-evidence-sync run exited non-zero. Backend PR/sync decisions stay on HOLD until a HEALTHY run. See the (private) Actions log for the sanitized verdict. Ref: GOV-2283." \
            --label "area:automation"
```

Notes: the default `GITHUB_TOKEN` reads the repo it runs in (issues/pulls/checks); Dependabot
alerts may be unavailable to it, which the base script already treats as a **benign** state, not
a failure. `runner.temp` is wiped per run, so the bundle never persists or is committed.

## 3a. Alternative host — machine-local scheduled task

If backend CI is not chosen, register a machine-local entry (this is the same substrate as the
GOV-2298 quota-preflight wiring, and is **owner-delegated** — see §7). It runs where the `gh`
keyring auth and both clones already live:

```bash
# $GW_WEBSITE = the local website clone that holds the lane script (do not hard-code an
# absolute contributor path — this repo is PUBLIC; test #218 rejects /Users/<account>/ paths).
export BACKEND_EVIDENCE_OUT="$HOME/.claude/scheduled-sync-state/backend-evidence.json"
export BACKEND_EVIDENCE_ALERT="$HOME/.claude/scheduled-sync-state/backend-evidence-alert.json"
node "$GW_WEBSITE/scripts/backend-evidence-sync-scheduled.mjs" \
  || echo "[scheduled-sync] backend evidence refresh FAILED — see $BACKEND_EVIDENCE_ALERT"
```

The `$HOME/.claude/scheduled-sync-state/` sink is outside any repo (never committed). Failure
surfacing is the `|| …` branch (or, in an agent scheduled-task, filing a blocker).

---

## 4. Automation / schedule contract (13 fields)

| Field | Value |
|---|---|
| **Target** | Automatic refresh of read-only backend GitHub evidence for the sync/merge gate. |
| **Trigger** | `schedule:` cron `17 */6 * * *` (every 6h) on the backend CI runner **or** the machine-local equivalent; plus `workflow_dispatch` / manual on demand. Read-only; safe to run any time. |
| **Input contract** | `gh` on PATH, authenticated (CI `GITHUB_TOKEN`, or keyring / `GH_TOKEN`). Optional env `BACKEND_EVIDENCE_OUT`, `BACKEND_EVIDENCE_ALERT`, `--out`, `--lane`. `--dry-run` for a no-side-effect plan. No `--repo` (scope-locked in the base script); no `--apply`. |
| **Output contract** | On success: sanitized JSON bundle at `BACKEND_EVIDENCE_OUT` (gitignored/scratch), no alert. On failure: **no bundle**, plus a sanitized alert record at `BACKEND_EVIDENCE_ALERT`. Exit code propagated verbatim. |
| **Log path** | Host run log (backend Actions log = private, or machine-local stdout/stderr). Format `[YYYY-MM-DD HH:MM:SS]/[ISO] [LEVEL] …`, structural only. Nothing private to any fixed/public path. |
| **Success-log line** | `[2026-08-29 07:16:51] [INFO] collect: verdict=HEALTHY open_issues=65 open_pulls=5 recent_merges=18 dependabot=0` then `[…] [INFO] scheduled evidence refresh OK: exit=0 lane=gov-backend-evidence` |
| **Failure-log line** | `[2026-08-29 07:17:37] [ERROR] scheduled evidence refresh FAILED (fail-closed): exit=10 verdict=AUTH_FAILURE lane=gov-backend-evidence → HOLD. alert=…/backend-evidence-alert.json` |
| **Retry policy** | None internal. Read-only + idempotent, so the host may re-invoke on the next tick; a non-zero exit is authoritative "unavailable", never retried into a false green within a run. |
| **Issue threshold** | Any non-zero scheduled run → raise one tracking issue / blocker (the `if: failure()` step, or the `\|\|` branch). `AUTH_FAILURE`/`FORBIDDEN` → SPA + CTO (token/scope); `NOT_FOUND` → CTO (repo identity); `DEGRADED` → AOE. Backend PRs stay HOLD until a HEALTHY run. |
| **Review cadence** | Re-verify on any backend-visibility flip (value is measured, never recalled), on any base-script change, and at each stage that cites backend evidence. |
| **Owner** | AutomationOpsEngineer `b9611d2e-d5d0-438e-9081-99f94cd65f06`. |
| **Acceptance tests** | `test/backend-evidence-sync-scheduled.test.ts` (11) — dry-run no side effects; a non-zero run propagates the exit **and** writes a sanitized alert (leak-swept); healthy run clears the alert and is idempotent; alert shape is closed; arg surface rejects `--apply`/`--repo`; CLI dry-run/usage seam. Plus the base suite (14). |
| **Improvement metric** | Removes the manual "did the connector come back?" judgement from every sync heartbeat and refreshes backend evidence on a fixed cadence, while guaranteeing a failed refresh is surfaced (never a silent stale green) — the A2 failure class this wrapper exists to close. |

---

## 5. Validation (run 2026-08-29, live private backend)

```
# dry-run — no side effects (no gh call, no bundle, no alert)
$ node scripts/backend-evidence-sync-scheduled.mjs --dry-run          # exit 0; out=absent alert=absent

# real scheduled refresh
$ node scripts/backend-evidence-sync-scheduled.mjs
[…] collect: verdict=HEALTHY open_issues=65 open_pulls=5 recent_merges=18 dependabot=0
[…] scheduled evidence refresh OK: exit=0 lane=gov-backend-evidence     # exit 0; alert=absent

# idempotent — twice-run, identical bundle shape, still no alert          # exit 0 / exit 0

# simulated failure (bogus token) — fail-closed raises + sanitized alert
$ GH_TOKEN=ghp_bogus… node scripts/backend-evidence-sync-scheduled.mjs
[…] collect aborted (fail-closed): verdict=AUTH_FAILURE. No bundle written.
[…] scheduled evidence refresh FAILED (fail-closed): exit=10 verdict=AUTH_FAILURE … → HOLD
# exit 10; bundle=absent; alert written = {schema_version,kind,lane,exit,verdict,action,ts,note}
# leak sweep over alert for body|head_ref|login|title|author|token|secret → all 0
```

Full suite green (`test/backend-evidence-sync*.test.ts` → 25 passed), `tsc --noEmit` clean, the
source direct-exposure guard passes.

---

## 6. Boundaries restated (nothing here relaxes them)

- **Read-only.** No `--apply` on either script, ever (A3). No write/mutation (that is website
  #214).
- **Scope-locked** to the one backend repo; `--repo` is not accepted by the wrapper and is
  rejected by the base script.
- **No public-facing action** (F8/F9). This is internal evidence refresh; GOV-1552 owner-hold on
  deploy/publish/spend still stands and is untouched.
- **Fail-closed end-to-end.** Non-zero → HOLD + alert; never a cached/partial green.

---

## 7. Go-live gate & residuals (not silent scope)

The deterministic wiring is built and proven. **Making it live is gated and is not AOE's call
alone:**

1. **CTO** (`24fddc65`) reviews the schedule wiring before it runs on a cadence (A3 posture,
   even though read-only) — pick the host (backend CI cron §3, recommended, vs machine-local
   §3a) and the cadence.
2. **Owner** applies the go-live step: merge the backend workflow PR (agents do not merge this
   org's repos), or enable the machine-local scheduled-task entry (`~/.claude/scheduled-tasks/`
   is an owner-delegated, no-silent-rewrite surface — GOV-2258/GOV-2282; AOE does not flip it).
3. **SPA** (`72d0eccf`) confirms the token choice if a service/scheduled token replaces the
   interactive keyring token — a read-only fine-grained PAT scoped to the backend repo
   (Contents/Issues/Pull requests/Checks/Dependabot alerts/Metadata: Read) is the least-privilege
   recommendation from `gov2274-backend-evidence-sync.md` §6.
4. **VSR** (`3f95c8ce`) independently verifies this wiring (the GOV-2283 acceptance criteria)
   before merge.

**Rollback:** delete `scripts/backend-evidence-sync-scheduled.mjs`,
`test/backend-evidence-sync-scheduled.test.ts`, and this doc; if a host was registered, remove
the workflow file / disable the machine-local entry. No credential, no committed data, no
migration — removal is complete and leaves no residue.
