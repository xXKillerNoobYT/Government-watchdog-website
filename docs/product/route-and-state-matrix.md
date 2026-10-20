# Dual-Mode Route and State Matrix

> **Status:** adopted 2026-07-24 as a supporting product spec. Where this document
> disagrees with [`docs/design-handoff-integration.md`](../design-handoff-integration.md)
> or [`docs/design-information-type-matrix.md`](../design-information-type-matrix.md),
> those binding docs win.

## Scope and truth boundary

The current website is an Alpine-only, reviewer-internal/local pilot. `ReadApiResponse.access`, agenda-board access, and the web-safe guard are authoritative. A route may display no civic data outside the allowed lane. This matrix defines the complete target surface, not permission to publish it.

| Route | Current renderer | Simple/free target | Advanced target | Required states |
|---|---|---|---|---|
| `#/` | landing/gate | public explanation only after release gate | same | denied, request access, approved, fixture notice |
| `#/home` | `renderHomeRoute` | Weekly front page; upcoming, recent, issue story, receipts, action | dashboard; civic weather, agenda, issue stack, transparency, timeline, source health | loading, fixture, empty, gap, unavailable widget |
| `#/agenda` | `renderFastAgenda` | meeting digest and essential item rows | filtered meeting workbench + deadlines | reviewer gate, no agenda item, agenda pending, packet changed, no results |
| `#/timeline` | `renderTimelineLevels` | river/event reading view | grouped/lane timeline + filters | reviewer gate, empty filter, undated, source missing |
| `#/app` / `#/agenda-boards` | `renderBoardsRoute` | meeting/issue overview | meeting and lifecycle boards | reviewer gate, zero cards, unanchored statements, empty lane |
| `#/boards` | `renderBoardsDirectory` | body directory only if public-safe | boards/body detail, source aliases | reviewer gate, no tree, missing selected body, no members |
| `#/issue?id=` | `renderIssueDetail` | article-style issue story | dossier + event spine + proof rail | reviewer gate, missing id, no source trail, pending/gap/revision |
| `#/vault` / `#/sources` | `renderSourceVault` | public receipts/source reader | source ledger, validation, revisions, diff, alerts | reviewer gate, no sources, no ledger, no alerts, safe link absent |
| `#/upload` | `renderUploadRoute` → `renderGatedUpload` | reviewer-only source intake action (not a public reading surface) | same intake form + provenance echo | reviewer gate, idle, validating/error, uploading, received, held |
| `#/power` | `renderPowerTracker` | methodology-first scorecard only when approved | official/profile ledger only when approved | reviewer gate, no roster, no records, methodology unavailable |
| `#/watchlist` | `renderWatchlist` | local saved-reading list | alert/history/settings after account design | reviewer gate, empty, local-only, account unavailable |
| `#/location` | `renderLocation` | coverage choice/readiness | same with saved preferences after approval | reviewer gate, covered, not covered, no persistence |
| `#/newsletter` | `renderNewsletterRoute` | weekly/newsletter archive | digest/archive controls | reviewer gate, empty archive, missing issue, print unavailable |
| `#/cards` | `renderCardFeedRoute` | internal regression/support view only | internal regression/support view only | loading, empty, error, fixture, access denial |
| `#/topics`, `#/body`, `#/meeting` | contextual legacy renderers | migrate/alias deliberately | migrate/alias deliberately | access denial, no topic/body/meeting data |

## State taxonomy

Every route and reusable component must support the state most specific to its data condition. Do not turn a missing-data condition into generic “error.”

| State | Meaning | Required UI behavior |
|---|---|---|
| `loading` | request is in progress | skeleton with accessible status; do not show stale facts as current |
| `error` | request/parse/contract error | concise recovery message; no retry claim unless retry exists; preserve no-data boundary |
| `denied` | access is not authorized | show no card/source/disclosure leaf from protected records |
| `fixture` | sample or frozen capture | persistent label naming fixture/offline snapshot and non-live status |
| `empty` | authorized request has no items | explain exactly what has no results; never manufacture a card |
| `gap` | a known record/source/completeness dependency is absent | show what is missing, why it matters, and whether the system is waiting/reviewing |
| `pending` | expected official event/material has not arrived | identify expected artifact/time if known; do not predict outcome |
| `changed` | deterministic source revision/change exists | show compared versions, detection/source times, and link to evidence |
| `review` | content exists but not publishable/approved | internal-only disclosure; do not leak record externally |
| `unavailable` | a designed capability is not yet built or authorized | omit feature where possible; otherwise plainly say unavailable and why |

## Mode-parity contract

For the same canonical record, modes must agree on:

- stable record/agenda/issue identifier
- official title and public-body/meeting context
- source receipts, original/archive links, locators, and revision state
- trust/review/confidence/gap labels
- whether the content is fixture, reviewer-internal, unavailable, or public-safe

Modes may differ in density, hierarchy, card size, number of available filters, and optional research panels. Advanced must never invent analysis. Simple must never conceal the only usable source/trust information.

## Responsive acceptance matrix

| Viewport | Shell/navigation | Cards/content | Required proof |
|---|---|---|---|
| Desktop ≥1280px | full shell and contextual controls | Advanced multi-column/rail/lane layouts; Simple editorial columns | screenshot and keyboard run |
| Tablet 768–1279px | wrapped/scrollable primary nav | two-column layouts collapse intentionally; no clipped proof rail | screenshot and keyboard run |
| Mobile 320–767px | accessible fixed/scrollable nav, no overlap with mode/theme controls | one-column cards; source/action order retained; drawers usable | screenshot at 320/390px plus 200% zoom |

## Existing technical constraints to retain

- `src/ui/shell.ts` already prohibits fake search/alerts and dead navigation.
- **`#/upload` is intentionally NOT a primary nav tab (GOV-2256).** The owner-approved IA (`NAV_TABS`) is the eight reading surfaces; `#/upload` is a reviewer-only *action* surface, reached contextually rather than by a persistent tab — the same deliberate treatment as Alerts and Location, which are header controls, not tabs. It therefore has no active-tab state, and adding one would create the dead/false-active affordance the shell forbids. Its route identity comes from its own descriptive `h1` and contextual note instead. Whether Upload earns a dedicated discoverability affordance is a UXD IA decision, not a rendering fix.
- `src/ui/pages-program.ts` explicitly uses reviewer-internal gates and honest empty messages; preserve those invariants during redesign.
- `src/data/web-safe.ts` / types must remain the no-leak boundary.
- Current per-page mode state (`gw-mode`) and shell state (`gw_home_mode`) must be reconciled before broad page work; the target is **one** mode setting.
