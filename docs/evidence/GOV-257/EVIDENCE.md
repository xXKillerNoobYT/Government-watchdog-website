# GOV-257 — Stage 1.06 Frontend/Product-Surface Evidence (Alpine)

Verification owner: FrontendTimelineEngineer. Date: 2026-06-18.
Repo: `xXKillerNoobYT/Government-watchdog-website`. Branch base commit: `4f156bb`.
Run: `VITE_USE_FIXTURES=true` (default) Vite dev at `http://127.0.0.1:5173/`, driven with Playwright.

This is a **verification pass**, not a flip. On Pass, CEO/CTO flips goal `0d2e317f` → achieved (no-overclaim rule).

## Surfaces verified (file paths)
- App boot / routes: `src/main.ts` (`/`, `/topics`, `/body`, `/meeting`; `?state=`, `?demo=matrix` overrides)
- Renderer + card/badge/drawer/legend/time-bar: `src/ui/render.ts`
- State→copy (loading/empty/error/ready, trust labels, AI label): `src/ui/state-view.ts`
- Data client (fixture/live + web-safe re-sweep + fallback): `src/data/client.ts`
- Transport raw-path/private-locator guard: `src/data/web-safe.ts`
- Default data (84 records, all `produced_by:ai` + `ui_status:source-backed`): `src/fixtures/alpine-sample.json`
- Trust-state matrix sample: `src/fixtures/state-matrix.json`

## Build / test gate
- `npm run typecheck` — clean
- `npm test` — **172/172 passed** across 14 files (incl. `web-safe.test.ts` 23, `integration-smoke.test.ts` "zero raw/absolute paths in response body", `state-matrix.test.ts`, `gov153-timeline-ux.test.ts`)

## Screenshots (this folder)
| # | Viewport | Surface |
|---|---|---|
| 01 | Desktop 1440×900 | Timeline default — banner, AI count header, legend, time-bar, blurred cards w/ sharp badges |
| 02 / 02b | Desktop 1440×900 | Legend open + card revealed + source drawer open (full provenance) |
| 03 | Desktop 1440×900 | State-matrix — Pending review / Disputed / Corrected / Do-not-publish badges |
| 04 | Desktop 1440×900 | Error state |
| 05 | Desktop 1440×900 | Empty state |
| 06 | Tablet 768×1024 | Timeline default |
| 07 | Mobile 390×844 | Timeline default |
| 08 | Mobile 390×844 | Card revealed + drawer open (fields stacked) |
| 09 | Desktop 1440×900 | Loading state |

## Pass/Fail per acceptance bullet
1. Only reviewed source-linked info exposed; AI/unverified/disputed/corrected labeled or gated — **PASS**
2. Trust/status labels present; clear empty/loading/error states — **PASS**
3. Source drawer/provenance reachable from every card (no orphan claims) — **PASS**
4. No private identity/address/voter-registry data in any surface — **PASS**
5. All three viewport classes (Desktop/Tablet/Mobile) — **PASS**

## Non-blocking note
Desktop legend rows show slight label↔meaning text overlap when a badge label exceeds the 11rem grid column (e.g. "AI — not independently verified"); both remain readable and it resolves on mobile (≤420px rows stack). Polish item for the later Isaac visual slice, not a 1.06 contract failure.
