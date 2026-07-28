---
last_run: 2026-07-28T00:35:00-07:00
last_task: auto-go
last_status: completed
project: xXKillerNoobYT/Government-watchdog-website
areas:
  - gate
  - shell-nav
  - pages-civic
  - data-contract
  - honesty-ledger
  - build-guards
  - deploy-release
  - intake-upload
  - a11y-responsive
  - ci-tooling
current_area: build-guards
current_area_checklist:
  C1_plan_complete: done
  C1b_plan_vs_code_drift_clean: pending
  C2_qa_resolved: done
  C2b_github_issues_ingested: done
  C3_hunt_fix_clean: pending
  C4_tests_present: pending
  C5_tests_pass: pending
  C6_build_warnings_zero: pending
  C7_ui_polish: pending
  C7b_dev_improvement_polish: pending
  C8_security_reviewed: in_progress
  C9_performance_reviewed: pending
  C10_cross_platform_parity: pending
  C11_github_issues_resolved: pending
  C11b_process_gaps_clean: pending
  C12_claude_md_reflects_area: pending
  C13_automation_opportunities_reviewed: pending
in_progress: false
iteration_count: 1
day_started_at: 2026-07-28
stop_flag: false
budget_mode: false
budget_mode_until: null
last_meta_recommender_at: null
last_meta_github_sync_at: 2026-07-28T00:20:00-07:00
last_meta_revise_at: null
last_meta_improver_at: null
last_meta_self_audit_at: null
last_meta_self_improve_at: null
---

# AUTO GO Heartbeat — Government Watchdog website

## Area definitions

Derived 2026-07-28 from this repo's real structure (`src/{gate,ui,data,state,types,fixtures}`,
`scripts/`, `deploy/`, `.github/workflows/`). Not the WiredPart rotation.

| Area | Owns |
|---|---|
| `gate` | `src/gate/`, reviewer admission, access lanes, fail-closed behavior, `?reviewer=1` bypass |
| `shell-nav` | `src/ui/shell.ts`, router, tab IA, theme, Simple/Advanced mode toggle |
| `pages-civic` | MOTY route renderers — home, timeline, vault, power, newsletter, boards, location, watchlist |
| `data-contract` | `src/data/`, `src/types/`, `src/fixtures/`, web-safe assertion, reviewer-normalize, provenance |
| `honesty-ledger` | RV / DG / DL / GS binding contract, `docs/design-information-type-matrix.md`, designed-gap + COMING SOON markers |
| `build-guards` | `scripts/check-*.mjs`, exposure scanning, public↔private lane separation, `vite.config.ts` |
| `deploy-release` | `deploy/`, `Dockerfile`, `fly.toml`, `BACKEND_REF`, sites worker, compatibility manifest |
| `intake-upload` | gated upload, supplied-files drawer, supersede view, provenance form |
| `a11y-responsive` | print stylesheet, 1440/768/390 viewports, keyboard order, state-bearing type floors |
| `ci-tooling` | `.github/workflows/`, screenshot capture, test infrastructure |

Verification commands for this project (all three, every iteration that changes code):
`npm test` · `npx tsc --noEmit` · `npm run build`.

## Heartbeat Log

- [2026-07-28T00:12:00-07:00] ITERATION 1 — FIRST RUN — no tracker files existed. Seeded `auto-go-soul.md`, `auto-go-memory.md`, `auto-go-todo.md`, `auto-go-heartbeat.md`, `auto-go-metrics.md`. Areas derived from repo structure (10 areas), not the WiredPart default rotation.
- [2026-07-28T00:20:00-07:00] ITERATION 1 — global github-issues-sync — 28 open issues triaged against open PRs. **Finding: the P0/P1 MOTY honesty+frontend block (#69, #70, #75, #76, #80, #82–#87) is blocked behind unmerged PR #68** — every one cites `src/ui/coming-soon.ts` / `timeline-lanes.ts` / `diff-view.ts` / `docs/product/design-reference-inventory.md`, none of which exist on `main`. Not startable without duplicating #68 or guaranteeing a conflict.
- [2026-07-28T00:35:00-07:00] ITERATION 1 — area: build-guards — check: C8 (security reviewed) — status: in_progress — issue #55 partial: generalized the direct-exposure guard beyond the two known loopback ports and added a mixed public/private deploy-package rejection. 3 of 8 acceptance criteria landed with tests; remaining 5 explicitly scoped out and recorded on the issue.
