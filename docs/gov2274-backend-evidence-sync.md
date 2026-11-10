# GOV-2274 — Backend evidence sync (private-backend GitHub read access)

**Owner:** AutomationOpsEngineer (AOE) · **Reviewer:** VerificationSafetyReviewer (VSR) ·
**Access-scope co-sign:** SecurityPrivacyAgent (SPA)
**Script:** `scripts/backend-evidence-sync.mjs` · **Tests:** `test/backend-evidence-sync.test.ts`
**Source issue:** website #255 / GOV-2274 (P1, scheduled-sync evidence reliability)

---

## 1. Root cause & fix direction (measured, not assumed)

The backend repo `xXKillerNoobYT/Government-watchdog` is **PRIVATE** (re-measured
2026-08-25, `gh repo view --json isPrivate` → `true`; visibility has flipped twice, so this
is a re-measure value, not a recalled one). The scheduled-sync lane's previous GitHub
connector path returned a **sanitized not-found** for the private backend, so backend
issue / PR / review / check / mergeability / dependabot evidence could not refresh and every
backend PR decision was stuck HOLD.

The failing connector was simply an **unauthorized path**. The local `gh` token
(`X-OAuth-Scopes: gist, project, read:org, repo, workflow`, viewer permission **ADMIN** on
the backend) reads every required surface cleanly. Measured 2026-08-25:

| Surface | Endpoint | Result |
|---|---|---|
| Repo metadata | `repos/{backend}` | `private:true`, default_branch `main` |
| Open issues | `repos/{backend}/issues?state=open` | 66 (excl. PRs) |
| Open PRs | `repos/{backend}/pulls?state=open` | 6 (heads + draft state) |
| Reviews | `.../pulls/{n}/reviews` | readable |
| Required checks | `.../commits/{sha}/check-runs` | readable (PR #324 `success:2`) |
| Mergeability | `.../pulls/{n}` `mergeable`,`mergeable_state` | `true` / `clean` |
| Recent merges | `.../pulls?state=closed` | 19 merged |
| Dependabot alerts | `.../dependabot/alerts` | readable (0 open) |
| Code scanning | `.../code-scanning/alerts` | 403 **"not enabled"** — config state, **not** an access failure |

**No token or connector-config change is required for read access** — the scope already
exists. The remedy is to route the sync lane's read-only evidence through the authenticated
`gh` transport deterministically, sanitized and fail-closed. That is what this script is.

---

## 2. The two hard boundaries

1. **Sanitized output (this website repo is PUBLIC).** Private issue/PR **bodies** and
   **titles**, author logins, and head **branch names** must never reach a log line or the
   console. Log/console lines carry only counts, numbers, opaque SHAs, states, booleans,
   enums, severities, timestamps. The evidence **bundle file** may carry titles (for triage)
   but **never bodies**, and is written only to a gitignored / scratch path — never committed.
2. **Fail-closed.** Any auth failure, forbidden, not-found, or unexpected error on a required
   surface exits **non-zero**. The caller MUST treat non-zero as *evidence unavailable → keep
   HOLD*. Only exit `0` means the bundle is complete and fresh. No cached/partial fallback.

**Scope lock:** the only repo this script will read is `ALLOWED_REPO`
(`xXKillerNoobYT/Government-watchdog`). `--repo` anything-else → exit `3` with a logged
reason. The issue's safety section explicitly forbids alternate repository routing.

**Read-only:** no endpoint mutates; there is deliberately no `--apply`.

---

## 3. Health verdicts — access failure vs absence (acceptance criterion)

`node scripts/backend-evidence-sync.mjs health` distinguishes, via exit code:

| Exit | Verdict | Meaning | Caller action |
|---|---|---|---|
| 0 | `HEALTHY` | repo + issues + pulls readable | evidence may refresh |
| 10 | `AUTH_FAILURE` | token invalid/expired (`gh api user` fails, or 401) | rotate/re-scope token; **HOLD** |
| 11 | `FORBIDDEN` | token valid but 403 on repo (authorized-but-denied) | grant read; **HOLD** |
| 12 | `NOT_FOUND` | 404 on repo with a valid token: absent / renamed / hidden | do **not** guess; **HOLD** |
| 13 | `DEGRADED` | repo readable but a required surface errored | **HOLD** |
| 2 | usage · 3 | scope-rejected | operator error |

Code-scanning / advanced-security "not enabled" is reported as `feature_disabled` and never
changes the verdict — it is a repo config state, not an unavailable evidence surface.

---

## 4. Automation contract (13 fields)

| Field | Value |
|---|---|
| **Target** | Read-only backend GitHub evidence for the scheduled-sync lane |
| **Trigger** | Sync-lane heartbeat / on demand. Read-only; safe to run any time. Not yet scheduled (see §7). |
| **Input contract** | `gh` on PATH, authenticated (keyring) or `GH_TOKEN`/`GITHUB_TOKEN`. Subcommand `health` \| `collect`. Optional `--out PATH`. `--repo` other than the backend is rejected. |
| **Output contract** | `health`: sanitized log lines + exit code. `collect`: sanitized JSON bundle (schema_version 1: repo meta, issue summaries, PRs with base/head-SHA/draft/reviews/checks/mergeability, recent merges, dependabot severity counts) at `--out`, plus a summary log line. |
| **Log path** | stdout/stderr (`[YYYY-MM-DD HH:MM:SS] [LEVEL] …`). The caller lane captures to its own run log; nothing here writes a private value to a fixed public path. |
| **Success-log line** | `[2026-08-25 16:10:18] [INFO] collect: verdict=HEALTHY open_issues=66 open_pulls=6 recent_merges=19 dependabot=0` |
| **Failure-log line** | `[2026-08-25 16:10:18] [ERROR] NOT_FOUND: token is valid but the backend repo is absent, renamed, or hidden from this token. … Keeping HOLD.` |
| **Retry policy** | None internal. Read-only + idempotent, so the caller may re-invoke; a non-zero exit is authoritative "unavailable", never retried into a false green. |
| **Issue threshold** | Any non-zero `health` on a scheduled run → the sync lane files/annotates a blocker and keeps affected backend PRs HOLD. `AUTH_FAILURE`/`FORBIDDEN` route to SPA + CTO (token/scope); `NOT_FOUND` routes to CTO (repo identity). |
| **Review cadence** | Re-verify on any backend-visibility flip (this file records the current value as *measured*, never recalled) and at each stage that cites backend evidence. |
| **Owner** | AutomationOpsEngineer `b9611d2e-d5d0-438e-9081-99f94cd65f06` |
| **Acceptance tests** | `test/backend-evidence-sync.test.ts` (14) — health classification incl. access-failure≠absence, feature-disabled non-fatal, sanitization (no body/branch leak), log format, scope-lock, and the CLI seam rejecting an alternate repo with a non-zero exit. |
| **Improvement metric** | Replaces a per-heartbeat manual "is the connector back?" judgement + N hand-run `gh api` calls with one deterministic exit code, and closes the class of failure where a sanitized not-found was mistaken for repo absence (kept every backend PR on HOLD). |

---

## 5. Validation (run 2026-08-25, real private backend)

```
$ node scripts/backend-evidence-sync.mjs health
[…] health: repo=xXKillerNoobYT/Government-watchdog token=valid repo_status=200 verdict=HEALTHY exit=0
[…] surfaces: issues=ok pulls=ok code_scanning=feature_disabled          # exit 0

$ node scripts/backend-evidence-sync.mjs collect --out "$PAPERCLIP_RUN_SCRATCH_DIR/backend-evidence.json"
[…] collect: verdict=HEALTHY open_issues=66 open_pulls=6 recent_merges=19 dependabot=0  # exit 0
# bundle assertion: no "body" field anywhere; no head_ref (branch name) anywhere.

$ node scripts/backend-evidence-sync.mjs health --repo xXKillerNoobYT/Government-watchdog-website
[…] --repo … is out of scope; only xXKillerNoobYT/Government-watchdog is authorized      # exit 3

$ node scripts/backend-evidence-sync.mjs bogus
[…] unknown subcommand: bogus                                                            # exit 2
```

Idempotency: `collect` overwrites the single bundle file; a second run produces the same
shape and leaves no accumulated state. `health` and `collect` never mutate the backend.

---

## 6. Least-privilege scopes & rollback

- **Scope used:** GitHub `repo` (read side) + the read endpoints above. `read:org` is
  present but not required by this script. No `admin:*`, no write, no delete. A read-only
  fine-grained PAT limited to the backend repo (Contents:R, Issues:R, Pull requests:R,
  Checks:R, Dependabot alerts:R, Metadata:R) is sufficient and is the recommended
  least-privilege token if the sync lane moves off the interactive keyring token — **SPA to
  confirm the fine-grained scope set before any scheduled/service token is provisioned.**
- **Rollback:** delete `scripts/backend-evidence-sync.mjs`, `test/backend-evidence-sync.test.ts`,
  the `docs/` file, and the `.gitignore` stanza. The script adds no scheduled job, no
  credential, and no committed data, so removal is complete and leaves no residue.

---

## 7. Not done here (follow-ups, not silent scope)

- **Not scheduled.** This restores the *read capability* + a health check. Wiring it into the
  sync lane's cadence (and choosing the token: keyring vs. a least-privilege fine-grained PAT)
  is a separate change requiring **SPA access-scope co-sign** and **CTO** lane sequencing —
  A3/A5 forbid me scheduling an automated job on my own authority.
- **Write/mutation** (issue close, label, comment) is website #214's domain, explicitly out of
  scope here (read-evidence only).
- **Close-loop** `github_issues_sync.py --close …#255` references a tool absent from this repo;
  the GitHub issue is closed via `gh` at merge, per standing practice.
