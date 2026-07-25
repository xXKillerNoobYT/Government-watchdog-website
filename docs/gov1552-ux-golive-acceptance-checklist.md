# GOV-1552 — UX go-live acceptance checklist (gated front door)

**Owner role:** UXProductDesigner (`cde31723`)
**Supports:** GOV-1552 (GOV-1523 P3e) CTO Fly.io deploy of the gated front door at
`watchdog.isaac4alpine.com`. **Runs AFTER** that deploy is live; it does **not**
deploy, flip flags, or touch backend/infra.
**Deploy contract this checks against:** `docs/gov1543-deploy-execution-plan.md`
(all three flags — `beta_gate_enabled`, `email_adapter_enabled`,
`notifications_http_enabled` — stay **OFF**; published lane stays honestly EMPTY).

## Why this leg exists

The CTO verify step (GOV-1552 scope §5) proves the *infra-observable* facts:
landing `200`, gated routes constant-`404`, `/api/health` `{"status":"ok"}` through
the edge, `/api/beta/*` neutral. None of that answers the UX question this product
lives or dies on: **can an ordinary Alpine resident who lands on the live URL with
no invite understand what this is, why they can't get in yet, and trust that the
gate says nothing about them?** That is this role's acceptance surface, and it is
otherwise unowned on the board.

This checklist is intentionally executable with **no backend and no invite**: the
`?gate=` screenshot override in `src/gate/access.ts#resolveAccess` renders every
one of the six access states on the live artifact while all flags stay OFF, so the
whole matrix below can be captured against `watchdog.isaac4alpine.com` directly.

## Source-of-truth references (verify the LIVE artifact matches these, not just source)

- Access states + copy: `src/gate/access.ts` — `AccessState` (6 states),
  `gatePanelContent()`, `SCAFFOLDING_NOTE`.
- Trust / AI / fixture labels: `src/ui/legend.ts`, `src/ui/state-view.ts`
  (`uiStatusLabel`, `AI_LABEL_TEXT`, `FIXTURE_BANNER_TEXT`).
- Landing / waitlist / magic-link DOM: `src/ui/landing.ts`,
  `src/ui/waitlist-form.ts`, `src/ui/magic-link-form.ts`.

## Breakpoints & a11y (house convention, matches GOV-760 / GOV-668 evidence)

Capture every row at **1440** (desktop), **768** (tablet), **390** (mobile), and
run the ARIA/keyboard pass once per state. Save PNGs under
`docs/evidence/GOV-1552/` as `NN-<state>-<width>.png`.

## A. Access-state comprehension matrix (`?gate=` override, flags OFF)

For each state, load `https://watchdog.isaac4alpine.com/#/?gate=<state>` and check
the panel renders the **exact** copy from `gatePanelContent()` and passes the
resident-comprehension bar.

| # | `?gate=` | Badge | Must be true for an ordinary resident |
|---|---|---|---|
| A1 | `anonymous` | Not signed in | Clear this is a gated beta; "Join the waitlist" is the obvious next step; no civic data leaks. |
| A2 | `waitlisted` | Waitlisted | Reads as "received, wait your turn" — batching reason is plain; no action demanded. |
| A3 | `pending` | In review | Reads as routine capacity/review; no anxiety, no action demanded. |
| A4 | `denied` | Needs more info | **AC#5 safety:** copy explicitly says it reflects nothing about the person, their community, or civic standing; framed as capacity/process only; re-request path is visible. |
| A5 | `revoked` | Access ended | Same civic-standing safety as A4; "Request access again" action present and reachable. |
| A6 | `approved` | Approved | "Open the full app" affordance present. **With flags OFF the real app stays gated** — confirm this override path does not expose live civic data on the public host (approved copy is scaffolding; note any real-data leak as a P0 blocker). |

**A7 — scaffolding honesty:** `SCAFFOLDING_NOTE` (or its shipped equivalent) is
visible under the gate controls so no resident mistakes the placeholder gate for a
working account system.

## B. Honest-empty & constant-404 (resident reading, not just HTTP code)

- **B1** Published/registry lane renders an honest **empty** state — a resident sees
  a plain "nothing published yet" reading, **not** a broken/error page and **not**
  fabricated placeholder civic data.
- **B2** A gated deep link (e.g. `/#/app`, and a direct `/api`-less gated route)
  returns the constant-404 experience the deploy contract promises, and that 404
  reads as "not available" to a resident — no stack trace, no internal wording.
- **B3** No timeline/topic/meeting/person civic data is reachable from any
  non-`approved` state (AC-1/AC-7 in `access.ts`).

## C. Label visibility (role invariant: source/audit/AI labels always visible)

- **C1** Any card/legend surface reachable pre-gate shows trust labels verbatim
  from `uiStatusLabel` and the **locked** `AI_LABEL_TEXT` — never an invented or
  upgraded trust reading.
- **C2** If fixture data is shown anywhere on the live host, `FIXTURE_BANNER_TEXT`
  is present so nothing reads as real published civic record.

## D. Cross-check against the CTO infra verify (no overlap, just the UX layer)

- **D1** Landing `200` (CTO) ⇒ **and** the landing is comprehensible (A1) + labelled (C).
- **D2** Gated `404` (CTO) ⇒ **and** the 404 reads as "not available", not "broken" (B2).
- **D3** Published lane empty (CTO/flag contract) ⇒ **and** it reads as honest-empty (B1).

## Disposition rule

- All A–C rows pass at 1440/768/390 + ARIA, evidence saved → comment PASS on
  GOV-1552 with the evidence path, then mark this leg `done`.
- Any A4/A5 civic-standing regression, any real civic-data leak (A6/B3), or any
  gated route serving data → **P0 blocker**: comment on GOV-1552, do **not** sign
  off, name the owning role for the fix.
