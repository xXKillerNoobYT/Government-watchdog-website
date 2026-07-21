# MOTY design handoff integration

This document records how the July 2026 MOTY design handoff maps onto the
existing reviewer-internal Government Watchdog frontend. It is intentionally a
data-boundary document as well as a UI plan: a polished fixture must never be
mistaken for a reviewed or live civic record.

The immutable owner-supplied archive and extracted design files are preserved
in [`design/baseline/moty-government-watchdog-2026-07/`](../design/baseline/moty-government-watchdog-2026-07/README.md).
That baseline is authoritative for layout, look, spacing, hierarchy, tool
placement, and interaction intent. Its limited prototype functionality is not a
production behavior contract.

## Product boundary

The design handoff is the approved visual and interaction direction. Its ten
screens, Simple/Advanced skins, shared navigation, agenda analysis patterns,
language-watch callouts, and receipt-first presentation are frontend intent.

The handoff's July 21 agenda, source totals, alerts, official profiles, scores,
newsletter debate, coverage percentages, and delivery settings are synthetic
design fixtures. They may appear only when all of the following are true:

1. the existing beta/reviewer gate admitted the route;
2. an explicit design-fixture route flag is present;
3. the screen says `SYNTHETIC DESIGN FIXTURE — not a live read`; and
4. AI-authored blocks say `AI-PRESENTED` and retain their receipts/disclaimer.

Local storage is allowed for preview-only preferences (mode, location choice,
tracked cards, read-state, and player position). It is never authentication,
authorization, identity proof, alert subscription, or evidence that a delivery
channel was configured.

The fixture restriction applies to the fixture **values**, not to the design's
layout or information architecture. Reviewed routes use the same component
grammar and retain every applicable information slot. A slot with no reviewed
value renders an explicit gap or unavailable control in place; it does not
disappear and it is not populated from the handoff. See the binding ledger in
[`design-information-type-matrix.md`](design-information-type-matrix.md).

The production binding rule is deliberately small:

- **real value** when a reviewed, web-safe contract supplies it;
- **designed slot** in the owner-approved hierarchy in every case; and
- **explicit gap** when the contract is absent or incomplete.

Device-local preview state is allowed only where it is labelled as such.
Synthetic values require the fixture gate described above.

The admitted app has one shared shell on every page. Its canonical nine-tab
order is Home, Fast Agenda, Timeline, Boards, Power Tracker, Source Vault,
Newsletter, Watchlist, and Alerts. The shell owns the only Simple/Advanced
switch. Individual pages read that preference and must not add a second mode
control, including on Timeline.

## Existing safe data that can be reused

- `ReadApiResponse` reviewed statements and their backend-supplied trust,
  verification, correction, provenance, and AI labels.
- Web-safe receipt metadata already projected on evidence links.
- Honest empty states from the real agenda projection.
- Historical, visibly labeled newsletter and card-feed captures.
- Topic labels and typed source aliases from the concept graph.

The frontend must continue to consume these values verbatim. It must not infer
that a machine-extracted row is reviewer-approved, turn a topic into a
government body, derive a score/verdict, or upgrade publication eligibility.
`assertWebSafe` and the raw/private-field denylist remain mandatory for every
new network response.

## Required backend view contracts

All responses should include `scope`, exact `access`, `asOf`/`generatedAt`,
per-source freshness, and a data-origin value such as `live`,
`reviewed_snapshot`, `backend_test_seed`, or `synthetic_design_fixture`.

### Session and access

- `GET /v1/session`
- `POST /v1/access-requests`

The server must authorize reviewer data. Public and reviewer projections must
be separate; protected rows cannot be bundled into public JavaScript and hidden
after download.

### Meetings and agenda

- `GET /v1/jurisdictions/:id/meetings`
- `GET /v1/meetings/:id/agenda-board`
- `GET /v1/agenda-items/:id`

The view needs official item numbers, venue/stream metadata, posting and version
events, motions/hearings, attachments, backend-supplied analysis and
language-watch blocks, process steps, typed issue/thread edges, decisions, and
receipts. Every derived block must carry the backend claim/trust bundle.

### Timeline and bodies

- `GET /v1/events?jurisdiction=&window=&issue=&type=&cursor=`
- `GET /v1/bodies`

Timeline relationships must use backend issue/thread IDs and typed edges, never
title similarity. Bodies need policy-cleared names, cadence, members, and
official links; concept topics are not substitutes.

### Power profiles

- `GET /v1/officials`
- `GET /v1/officials/:id/power-profile`

Names must be policy-cleared. Promise/action alignment, scores, verdicts, vote
classification, and quote status are backend products and must arrive with
receipts and explicit AI/review labels.

### Source vault

- `GET /v1/sources`
- `GET /v1/sources/stats`
- `GET /v1/sources/:id/versions`
- `GET /v1/transparency-alerts`

Version diffs must be deterministic backend output. If a digest is public,
introduce an explicitly web-safe `publicContentDigest`; never expose
`raw_sha256`, local paths, vault references, or private locators.

### Newsletter

- `GET /v1/newsletters`
- `GET /v1/newsletters/:id`

Extend the existing digest contract with pre/post editions, meeting pairs,
agenda sections, debate lines, lenses, checklists, and source trails. A browser
may read a supplied script aloud, but it may not author or silently relabel it.
Until a reviewed response supplies an explicit current, featured, or latest
marker, the default Newsletter route shows the baseline layout as designed
gaps followed by the reviewed archive. It never selects the first response row
as a current edition. A supplied newsletter ID may open its detail view.

### Watchlist, alerts, and location

- `GET/PUT /v1/me/watchlist`
- `GET /v1/me/alerts` plus a mark-read action
- `GET/PUT /v1/me/alert-preferences`
- meeting/agenda reminder action
- `GET /v1/coverage`
- `GET /v1/locations`
- `PATCH /v1/me/location`

Until these exist, tracking, read-state, delivery switches, and location changes
are device-only previews. Coverage percentages, freshness, identity locks, and
successful delivery are server assertions and cannot be claimed by the client.

## Release gates

- Keep the current preview landing and reviewer gate.
- Meet the per-item minimums in
  [`docs/content-quality-baseline.md`](content-quality-baseline.md); visual
  fidelity never overrides a missing receipt, review state, or access decision.
- Do not publish reviewer fixtures or synthetic design content as public civic
  data.
- Preserve the no-raw-path sweep on every live adapter.
- Preserve icon-and-text trust labels and the accessibility floors.
- Validate TypeScript, the full unit suite, the production build, and the public
  zero-content lane before any deployment decision.
