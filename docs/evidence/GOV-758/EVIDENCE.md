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
   mounted in the shell header (`src/ui/shell.ts`). Consumes the leg-2 (GOV-754)
   notification query endpoint via `src/data/notifications.ts` (fixture fallback
   until the endpoint merges). Shows the SERVER unread count; drops unknown kinds
   fail-closed. Five kinds: account_approved / account_revoked / cohort_advanced /
   consent_recorded / unsubscribe_confirmed.
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
- `npm run test` (vitest) — **413 passed** (incl. new `test/gov758-gated-access.test.ts`,
  19 tests: 6-state distinctness + no-civic-data, denial+revocation no-civic-standing
  copy, waitlist email-only + validation + ARIA, notification client normalize/
  fail-closed/fallback, panel bell ARIA + toggle + server unread count).
- `npm run build` — succeeds.

## Scope guard

No public launch, no mass messaging, no cohorts >15 activated by this card. The
waitlist/denial/revocation copy never implies anything about civic standing
(GATED_BETA_ACCESS_WORKFLOW). Notification content renders only inside the gated
shell — unreachable by unauthenticated visitors.
