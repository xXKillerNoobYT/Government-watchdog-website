# GOV-758 — Frontend gated access states, waitlist form, notification panel

GOV-721 leg 3/5 (FrontendTimelineEngineer). Vite/TS, **no React** (constraint D3 —
extends the existing `src/ui/*.ts` idioms). Evidence for the UXProductDesigner →
VSR review gate.

## Deliverables → where

1. **All 6 gated access states** — `src/gate/access.ts` (`AccessState` union +
   `gatePanelContent`), rendered by `src/ui/landing.ts`. States:
   not-signed-in (`anonymous`) / waitlisted / pending-review (`pending`) /
   approved / denied / revoked. Every non-`approved` state renders **zero civic
   data** — enforced by `renderGatedApp` (only `approved` runs the app) and the
   landing carrying no timeline/cards/drawers (AC-1/AC-7).
2. **Waitlist intake form** — `src/ui/waitlist-form.ts`. Collects **email + area
   interest ONLY** (no name/phone/address/other PII). Client-side validation +
   inline confirmation; the `onSubmit` seam is where leg-2's intake POST wires in.
3. **In-app notification panel (bell + drawer)** — `src/ui/notification-panel.ts`,
   mounted in the shell header (`src/ui/shell.ts`). Consumes same-origin
   `GET /api/notifications` through `src/data/notifications.ts`. Live is the
   default: denied, unavailable, timed-out, and malformed responses clear prior
   rows and the badge, say the count is unavailable, and never substitute sample
   account text. Valid envelopes preserve the SERVER unread count and reject the
   whole response for malformed allowlisted fields. The five kinds remain:
   account_approved / account_revoked / cohort_advanced / consent_recorded /
   unsubscribe_confirmed. A development-server-only sample is visibly labelled
   beside the closed bell and inside the drawer.
4. **ARIA + responsive** — labels/`aria-*` on every interactive control; captured
   at 1440×900 / 768×1024 / 390×844.

## Screenshots (AC-7: 6 states × 3 viewports = 18, + 2 notification panel)

| # | Viewport | State |
|---|----------|-------|
| 01–06 | desktop 1440×900 | not-signed-in, waitlisted, pending-review, approved, denied, revoked |
| 07–12 | tablet 768×1024 | not-signed-in, waitlisted, pending-review, approved, denied, revoked |
| 13–18 | mobile 390×844 | not-signed-in, waitlisted, pending-review, approved, denied, revoked |
| 19 | desktop 1440×900 | notification panel (bell + drawer open, all 5 kinds) |
| 20 | mobile 390×844 | notification panel (bottom-sheet drawer) |

Captured with Playwright/Chromium against `npm run dev` (localhost:5173),
`?gate=<state>` on the `#/` landing; notification panel via `#/app?reviewer=1`.

## Verification

- `npm run typecheck` — clean.
- `npm run test` (Vitest 3.2.7) — **45/45 files, 650/650 tests passed**.
  Issue #52 extends the suite with live
  401/403/404/500, rejected fetch, timeout, malformed JSON/schema, raw locator,
  exact timestamp, allowlist, explicit demo, stale-request, stale-row, responsive,
  focus, and ARIA regressions in `test/gov52-honest-notifications.test.ts`.
- `npm run build:all` — public: 17 modules, JS 32.28 kB / 10.33 kB gzip;
  private beta: 62 modules, JS 710.20 kB / 141.60 kB gzip. Public module and
  completed-asset boundaries passed. Notification sample IDs, sample account
  copy, and the demo source module are absent from both production artifacts.
  The private chunk warning remains tracked separately in frontend #49.
- Independent final reviews — **P0 none, P1 none, P2 none** in the frontend
  diff. The backend cookie-to-owner dependency is tracked in backend #135.
- Loopback visual smoke — at 700×900 the drawer and private `?` panel use
  viewport-fixed geometry and remain inside the viewport; at 1440×900 the
  drawer remains anchored to the bell. Both show the named dialog, `Count
  unavailable`, no badge, no sample rows, and the full filing explanation.

## Scope guard

No public launch, no mass messaging, no cohorts >15 activated by this card. The
waitlist/denial/revocation copy never implies anything about civic standing
(GATED_BETA_ACCESS_WORKFLOW). Notification content renders only inside the gated
shell — unreachable by unauthenticated visitors. Real browser delivery remains
blocked until the backend maps the revocable HttpOnly beta cookie to one exact
canonical notification owner; the frontend does not expose a bearer token to
work around that server boundary.
