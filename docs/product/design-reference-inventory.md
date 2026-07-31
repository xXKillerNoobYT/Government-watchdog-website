# Government Watchdog Design Canvas Inventory

**Status:** Phase 0 baseline — implementation reference, not production data.
Adopted into the repo 2026-07-24. Where this document disagrees with
[`docs/design-handoff-integration.md`](../design-handoff-integration.md) or
[`docs/design-information-type-matrix.md`](../design-information-type-matrix.md),
those binding docs win.

## Rule of use

The ten `*.dc.html` files in
[`design/baseline/moty-government-watchdog-2026-07/reference/`](../../design/baseline/moty-government-watchdog-2026-07/reference/)
are the owner-approved visual and interaction direction. They contain sample labels, people, counts, dates, and civic claims. Those examples **must never be copied into live or reviewer-internal UI** unless the web-safe data contract provides the same fact and source trail.

Every planned surface must render one of: canonical reviewed data, an explicitly labeled fixture, an honest empty/gap state, or an unavailable state. It must never fill a visual slot with invented government activity.

## Global design language

| Mode | Audience and purpose | Visual language | Mandatory qualities |
|---|---|---|---|
| **Simple / free** | Residents who want to understand what is happening and what to do next | warm broadsheet paper, Newsreader editorial hierarchy, Public Sans utility text | readable story flow, sources/receipts, next public action, uncertainty made plain |
| **Advanced / future entitlement** | Civic researchers and power users | dark elevated data panels, Public Sans UI, IBM Plex Mono for IDs/timestamps | filters, provenance, comparison, lifecycle detail, disclosures, no unsupported analysis |

Shared primitives: GW brand; Alpine/location context; Simple/Advanced mode control; jurisdiction chips; trust/status badges with text plus color; source receipts; cards; drawers; empty/gap states; mobile bottom navigation; fixture banner where applicable.

## Uploaded-screen coverage

| Reference file | Simple reference | Advanced reference | Required production route(s) | Key interactions/micro-tabs |
|---|---|---|---|---|
| `Home.dc.html` | Simple Home / Weekly front page | Advanced Home | `#/home` | level selector; issue cards; fast agenda; source receipts; alerts; timeline preview; print; mode switch |
| `Fast Agenda.dc.html` | Meeting newspaper digest | Fast Agenda workbench | `#/agenda` | All/Town/County/State; meeting groups; agenda/packet/timeline/receipt links; print; change notice |
| `Timeline.dc.html` | Timeline river | Master Timeline | `#/timeline` | sort; clear; Town/County/State toggles; thread preset; receipts; mode switch |
| `Boards.dc.html` | Boards overview | lifecycle/meeting boards | `#/app`, `#/boards` | jurisdiction tabs; board picker; cards; open agenda/timeline/documents; watch |
| `Power Tracker.dc.html` | scorecard editorial view | official/profile ledger | `#/power` | jurisdiction tabs; official picker; person timeline; receipts; methodology/disputed state |
| `Source Vault.dc.html` | receipts-ledger view | source archive | `#/vault` | source filters; version state; word-diff toggle; original/archive links; change alerts |
| `Watchlist.dc.html` | light saved-items page | alert/settings page | `#/watchlist` | local watch toggle; remove; notification/category settings; deadline links |
| `Newsletter.dc.html` | Weekly issue | dark digest/archive | `#/newsletter` | print; previous/next issue; restart; date picker; story jump links |
| `Location.dc.html` | coverage chooser | location picker | `#/location` | state/county/town selection; covered/uncovered; save; return destination |
| `Wireframes.dc.html` | 2a–2d and 1b/1f/1p/1r–1t alternatives | 3a–3c and 1a/1c–1o alternatives | reference only until accepted per route | all layout alternatives listed below |

## Wireframe alternative catalog

### Approved-direction Simple layouts

| ID | Name | Production decision |
|---|---|---|
| 2a | Simple Home — Weekly Front Page | primary Simple home layout |
| 2b | Simple Home — Big Print Edition | accessibility/large-type responsive variant, not a separate data product |
| 2c | Simple ↔ Advanced toggle concept | shared shell behavior |
| 2d | Simple Issue Page — article style | primary Simple issue-detail layout |
| 1b | Home — Front Page | alternate composition reference for Simple home |
| 1f | Timeline — River | primary Simple timeline model |
| 1p | Newsletter — Weekly Front Page | primary Simple newsletter/archive layout |
| 1r | Mobile — Home Simple | required mobile acceptance reference |
| 1s | Mobile — Fast Agenda | required mobile acceptance reference |
| 1t | Mobile — Power Tracker | required mobile acceptance reference |

### Approved-direction Advanced layouts

| ID | Name | Production decision |
|---|---|---|
| 3a | Advanced Home — dark | primary Advanced home |
| 3b | Advanced Issue Detail — dark | primary Advanced issue dossier/proof rail |
| 3c | Advanced Fast Agenda — dark | primary Advanced agenda workbench |
| 1a | Home — Mission Control | dashboard composition reference |
| 1c | Home — Radar Tiles | optional future dashboard composition; no fabricated metrics |
| 1d | Home — Receipt Stream | source-feed component reference |
| 1e | Timeline — Three Lanes | advanced timeline grouped by authorized jurisdiction only |
| 1g | Timeline — Subway Map | deferred; needs a validated relationship model |
| 1h | Issue — Dossier | issue detail architecture |
| 1i | Issue — Timeline Spine | issue event component reference |
| 1j | Issue — Receipts First | evidence-first detail variant |
| 1k | Power Tracker — Scoreboard | deferred until methodology/roster data is approved |
| 1l | Official Profile — Ledger Split | deferred until reviewed person/role records exist |
| 1m | Promise vs Action — Courtroom | deferred until approved methodology and source-linked claims exist |
| 1n | Hidden Things — Alerts + Diff | requires deterministic alert/diff projection |
| 1o | Source Vault — Ledger Table | requires ledger/change-history projection |
| 1q | Newsletter — 15-Minute Read | newsletter reading-density option |

## Interaction inventory and required states

| Interaction | Reference behavior | Current honest implementation status | Completion requirement |
|---|---|---|---|
| Mode switch | Simple ↔ Advanced changes density and palette | shell and page toggles exist; content parity is incomplete | one persisted mode authority, no conflicting storage keys, route-specific layouts |
| Jurisdiction controls | All/Town/County/State filters | controls are shown in canvases; Alpine-only pilot | only enable backed coverage; disabled/unavailable controls explain scope |
| Search / ⌘K | search records, documents, officials | **DL** for the shell field (filters records already loaded — real behaviour, browser-only) and **DG** for Home's 90-day archive search (disabled, awaiting a reviewed archive-search projection). **Not CS:** the baseline designs a *"search box ⌘K"* (`reference/README.md:21`), not a command palette, and the shell implements exactly that — `⌘K` focuses the filter field and the code says outright it "does not open a command palette" | keep the DL/DG split; the shell field must keep saying it is not an archive search, and Home's field stays disabled until the projection exists |
| Alerts | alert count/settings | **CS** for delivery channels (email/text, cadence, destination) — no product in any lane; **DG** for the civic alert *count*, which awaits a deterministic alerts projection | never render a fake count; mark the delivery settings `COMING SOON` with no contract named, and keep the count as a designed gap naming the awaited projection |
| Print | Weekly/digest printing | reference only | stylesheet + print test, or omit control |
| Source links | original/archive/receipt | partial source links exist | source receipt fields, safe external links, locator/version disclosure |
| Diff | version and word-diff view | sample-only placeholder | source-version/ledger contract and deterministic diff projection |
| Watch | follow/remove/settings | local-only statement watch exists | label local-only now; entitlement/account/privacy design before sync/email |
| Boards/lanes | lifecycle and meeting groups | agenda board exists reviewer-internal | backend-provided lanes only; no frontend inference |
| Official/Power analysis | scorecard/promise analysis | scaffold explicitly has no roster/scores | keep unavailable until source/methodology review |
| Location | select/save coverage area | static Alpine/uncovered picker | separate product/account decision before persistence/notifications |

## Non-negotiable micro-detail rules

1. Every state has text, icon/label, and color—not color alone.
2. Every source claim includes source receipt or an explicit missing/unknown state.
3. Any generated/AI-assisted explanation carries its label and never masks the original record.
4. Timestamps identify whether they are source date, archive capture, validation, record update, or detection date.
5. Buttons either work, lead to an available route, or are not rendered. Disabled future features must say why.
6. At 320px width and 200% zoom, no essential action or source link may be inaccessible.
7. Desktop, tablet, and mobile are separate acceptance views; “responsive” is not just shrinking the desktop layout.
