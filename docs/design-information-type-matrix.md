# MOTY baseline information-type binding ledger

Status: **required implementation ledger for the July 2026 owner-approved
baseline**

This ledger maps the shared shell and all ten baseline pages to the data the
reviewer build can honestly render today. It is the bridge between the visual
handoff and backend work: the baseline's layout, information hierarchy,
spacing, color, tools, and Simple/Advanced reading modes remain present even
when a civic value is not available.

The non-negotiable rule is:

> **Real value, designed slot, explicit gap.**

A missing backend product changes the content of a slot, not the existence of
the slot. A reviewed route must never borrow a value from the MOTY fixture,
derive a civic conclusion in the browser, or collapse to a thinner legacy
layout.

## Binding classes

| Code | Class | Meaning |
| --- | --- | --- |
| **RV** | Reviewed value | Render an exact value from an admitted, web-safe reviewed response, including its origin, trust, correction, and receipt fields. A captured snapshot is still labelled as a snapshot, not live data. |
| **DG** | Designed gap | Keep the owner-approved information slot visible and state which projection, receipt, or capability is unavailable. Unsupported controls remain disabled. |
| **DL** | Device-local | Browser-only reading preference or interaction state. It must say that it creates no account, identity, coverage, monitoring, subscription, reminder, or delivery. |
| **GS** | Gated synthetic | Populate only after reviewer admission plus an explicit fixture flag and the `SYNTHETIC DESIGN FIXTURE — not a live read` notice. Never mix it into reviewed counts or lists. |
| **CS** | Coming soon | Functionality that **does not exist in any lane** — no reviewed contract, no fixture, no device-local behaviour, and no backend product behind it. Keep the owner-approved slot visible and mark it with the `COMING SOON` marker (`src/ui/coming-soon.ts`). **Never name a backend contract**, because there is none to name. Any control stays disabled. |

### Shipping a GS lane — the shell must be told in the same change

A GS renderer and the route's entry in `SHELL_DESIGN_FIXTURE_ROUTES` (`src/main.ts`) are
**one change, not two**. Ship the renderer alone and the shell keeps announcing
`LIVE SERVER CONTEXT` over synthetic content — the page says fixture, the banner says live,
and the reviewer is told the wrong thing by the surface whose whole job is declaring origin.

This has been the same defect three times: GOV-84 (`/newsletter`), the GOV-82 follow-up
(`/vault`, which survived two iterations), and GOV-163 (`/boards`, caught only because the
prior two were remembered). Every test stayed green each time, because the shell and the page
were each individually correct.

Two rules that fall out of it, both learned the same way:

- **Render a *pure* GS lane synchronously — and check which kind you have first.** A pure
  lane renders nothing but fixture content, so routing it through `withReviewerContext` makes
  it depend on a reviewed read it never uses: the shell declares fixture origin while the page
  waits on — or fails — a fetch. With the backend down that is not a corner case, it is what
  the route shows. `/newsletter` and `/boards` are pure and render synchronously.

  **A hybrid lane is the opposite case and must keep the read.** `/vault?demo=design` renders
  reviewed source rows, counts and the access gate from the response and swaps exactly **one**
  panel for a synthetic one (`designFixture ? versionCompareFixture() : versionCompare()`).
  It needs `withReviewerContext`; making it synchronous would strip the reviewed half of the
  page. *(CORRECTION 2026-08-01 — supersedes the first version of this bullet, which listed
  `/vault` as doing this wrong. It was not measured before being written down. The test is
  whether the design lane renders **any** reviewed value, not whether it renders a fixture.)*

  The shell rule is unaffected by the distinction: **any** route that can render synthetic
  content under design preview belongs in `SHELL_DESIGN_FIXTURE_ROUTES`, pure or hybrid.
- **The test asserting a route has *no* fixture is part of the change that gives it one.** Those
  assertions are green and silently wrong the moment the lane lands. Prefer a derived
  completeness guard over an enumerated "not yet" list — the list shrinks to nothing and stops
  testing anything.

### CS versus DG — the distinction that makes CS necessary

**DG says the data is missing. CS says the feature is.** They are different
statements about the product and must never be substituted for one another:

- **DG** is correct when the capability is designed and a *reviewed projection,
  receipt, or contract* has not shipped yet. Naming the awaited contract is the
  point of a DG slot — it tells a reviewer what would fill it.
- **CS** is correct when there is **no product at all** behind the slot. Writing a
  DG sentence here invents a claim: it tells the reviewer a named backend contract
  is on its way to fill something nobody is building. That is an invented product
  claim, and it is exactly as prohibited as an invented civic fact.

A slot may move CS → DG once a contract genuinely exists to await, and DG → RV once
it ships. It must never move backwards silently.

Static presentation elements such as geometry, typography, tokens, headings,
responsive behavior, and the Simple/Advanced hierarchy are baseline
invariants, not optional data bindings. All five classes use that same visual
grammar.

### Registry of unbuilt features (CS)

Every slot below is CS: it has no product in any lane. Each renders the `COMING SOON`
marker and **no backend-contract sentence**. A row leaves this registry only when the
feature is genuinely being built, at which point it becomes DG with a named contract.

**A registry row is a claim that a marker exists.** The `Marked?` column is not decoration:
without it the table silently implies every listed feature already renders a CS marker, and
a reader auditing the contract would stop there. A `pending` row must name the issue that
will resolve it.

| Unbuilt feature | Owning page | Route | Marked? |
| --- | --- | --- | --- |
| Alert delivery channels (email/text, push, cadence, destination verification) | Alerts | `#/alerts` | ✅ #86 |
| Supporter-plan upsell (baseline's "$25/yr Local Data Geek") | Home (Simple) | `#/home` | ✅ #75 |
| "Fund your area" CTA | Location | `#/location` | ✅ #87 |

**Removed 2026-08-10 — Explainer video.** The owner-supplied, produced asset now
exists, so the Explainer and Home slots are no longer CS. The Home card is neutral
product media; playback is **GS** because the animation contains hypothetical civic
records and figures. It renders only after reviewer admission plus the explicit
`#/explainer?demo=sample` selection, under both a product-demo shell origin and a
visible non-live-data notice. Plain `#/explainer` attaches no media.

**Removed 2026-07-31 — the account "manage" affordance.** It was listed here as CS
pending #71. It is **DG**, and the Global-shell table above has always said so: a contract
genuinely is awaited — server-authoritative `GET /v1/session` plus the approved
access-request flow. #71's own acceptance criteria require the copy to **name that
contract**, which is exactly what CS forbids. Shipped as a disabled `manage` control whose
title names the absent contract (`src/ui/shell.ts`, `accountChip`). **Second phantom removed
from this registry** — both arrived the same way: the table was populated from an issue's
prose instead of from this ledger's own per-slot assignments.

**Removed 2026-07-31 — "⌘K command palette".** It was listed here on the assumption that the
baseline designed a palette. It does not: `reference/README.md:21` specifies a *"search box
⌘K"*, and the shell implements exactly that — `⌘K` focuses the filter field, and
`src/ui/shell.ts` states in both a comment and the control's own `title` that it "does not
open a command palette". The two real search surfaces are already correctly classed
elsewhere — the shell filter is **DL** (it filters records already loaded) and Home's 90-day
archive search is **DG** (disabled, awaiting a reviewed projection). Listing a phantom CS
slot beside them created a three-way conflict between this ledger, the interaction
inventory, and the code. **A registry entry must be verified against the baseline and the
code, not copied from an issue's prose.**

## Current source contracts

| Contract | What the frontend may use now | Boundary |
| --- | --- | --- |
| `ReadApiResponse` | Reviewed Alpine statement records, topic context, evidence links, trust/provenance/correction fields, and supplied completeness gaps. | `TopicTreeResponse` is civic-topic context, **not** a government-body directory. The frontend does not derive people, scores, event edges, coverage, or alerts from statement rows. |
| `AgendaBoard` | Reviewed scope, source name, disclosures, six lifecycle lanes, agenda-anchored cards when supplied, lineage, source references, and gap badges. | The current real projection is an honest zero-card board with unanchored statements. Empty `decisions` and category disclosures stay empty; meeting readiness and agenda analysis are not inferred. |
| `CardFeed` | Reviewed historical cards and their status, speaker, confidence, provenance, evidence, and countable source gaps. | Used as reviewed snapshot input for Home/timeline summaries; it is not a live activity, issue, vote, or alert service. |
| `NewsletterDigestResponse` | Reviewed archived digest items, required sections, claim labels, source trails, coverage periods, and known gaps. | It is not an editorial pre/post newsletter, edition-version service, debate, ideology lens, meeting checklist, or delivery product. |
| `NotificationResponse` | Validated, session-scoped account-workflow notifications only: access, cohort, consent, and unsubscribe events. | Live same-origin reads are the default. Denied, unavailable, timed-out, and invalid responses show zero rows, no badge, and an unavailable explanation; they never substitute a sample. An explicit development-server sample is visibly labelled and cannot be enabled by a production URL, storage value, or reading mode. These rows are **never civic alerts** and cannot populate the Alerts page. |
| Explicit design fixtures | The owner-approved page population and interactions on the supported `demo=design`/sample path. | Synthetic July 21 records, officials, scores, coverage, alerts, debate, lenses, and settings are presentation examples only. |

Every future network response remains subject to the reviewer access gate,
`assertWebSafe`, the raw/private-field denylist, exact origin/freshness labels,
and the backend-supplied trust vocabulary.

### Served `/v1` projection source (GOV-2180 → backend GOV-1816 / GOV-1817)

`AgendaBoard`, `CardFeed`, and `NewsletterDigestResponse` are the three RV
projections the backend now serves VERBATIM over `/v1` (`/v1/agenda-board`,
`/v1/card-feed`, `/v1/newsletter-digest`), each nested under `data` inside the
mandatory GOV-1817 envelope (`scope` / `access` / `origin` / `generatedAt` /
`sourceFreshness`), computed live from the reviewed registry (`origin = live`)
behind the civic gate. `src/data/v1-projections.ts` is the same-origin consumer:
it validates the envelope, re-sweeps for raw paths, unwraps `data` through the
same web-safe walk the fixtures use, and fails closed to the existing gated / gap
states. It NEVER recomputes trust or synthesizes freshness.

- **The binding class does not move — these slots stay RV.** RV already covers a
  captured snapshot *and* a live reviewed read; what changes is the *provenance*
  of the RV value, from a checked-in captured snapshot toward an `origin = live`
  served read. The served response is still labelled by its own `origin`, never
  relabelled as live when it is a snapshot.
- **`sourceFreshness` is an honest empty map this slice.** Its absence renders as
  a Designed Gap (`hasSourceFreshness()` is `false`); no `as-of` is invented.
- **Migration status (this slice):** the consumer client and the reversible flip
  (`VITE_SERVED_PROJECTIONS`, default OFF → the checked-in
  `src/fixtures/*.json`) have landed. The MOTY RV render routes still read the
  fixtures by default. The cutover — wiring those routes to the served path,
  flipping the default to served, and retiring the checked-in projection
  fixtures — awaits a reachable same-origin `/v1` bridge to an authorized
  reviewer session so live equivalence can be evidenced without regressing the
  MOTY screens to gap states. Until then the fixtures remain the captured-snapshot
  fallback and are NOT deleted.

## Global shell

| Major information group | Class | Current binding | Backend contract needed |
| --- | --- | --- | --- |
| Brand, primary navigation, footer disclosure, responsive tool placement | **DG** | The approved shell structure and AI caution are present on every admitted page; they contain no civic facts. Its eight-tab order is Home, Fast Agenda, Timeline, Boards, Power Tracker, Source Vault, Newsletter, and Watchlist; Alerts, Location, and the explainer are reached from persistent header controls rather than tabs. | No data API. Any deliberate navigation or hierarchy departure needs owner approval. |
| Header Alerts chip unread badge | **GS** | The badge counts unread device-local fixture cards and renders only on a route already admitted to design-fixture mode. On a reviewed route the chip is a plain link — a count would assert a civic-alert volume the client cannot know, and a zero would assert quiet. | Civic `GET /v1/me/alerts` plus a read-state contract. Until both exist, no reviewed count may render. |
| Demo control and explainer product media | **GS** | The persistent Demo control opens `#/explainer?demo=sample`. The optimized owner-supplied video and poster render only after reviewer admission plus that explicit flag, under `ILLUSTRATIVE PRODUCT DEMO` and an adjacent notice that the scenario and figures are hypothetical. The dedicated product-demo origin suppresses fixture Alert counts and never claims live-server context or civic freshness. Plain `#/explainer` is a media-free overview. | No civic API. The exact media, poster, transcript, notice, and asset hashes are one reviewed product-media release unit. They must remain outside the anonymous public build graph. |
| Simple/Advanced mode, theme, print | **DL** | The shell owns the single `gw_home_mode` control; pages do not render duplicate mode switches. Theme and mode change presentation only, and print invokes the browser. Both modes preserve the same facts and gaps. | Optional account preference sync only; local mode must continue to work without it. |
| Location chip | **DL** | Shows the saved browser label, with Alpine as the design fallback. It does not prove identity or official coverage. | `GET /v1/locations`, `GET /v1/coverage`, and `PATCH /v1/me/location` before claiming an account-locked or covered place. |
| Global search | **DL** | Routes the entered query to the current reviewed Timeline filter. It is not a full archive search. | A reviewed cross-record search contract with scope, type, range, result count, and receipts. |
| Reviewer identity/account management | **DG** | The chip says `REVIEWER ACCESS / private beta`; it represents the protected lane, not a person, email address, or browser-verified identity. Sites custom access and the server-side allowlist remain the hosted authentication boundary. | Server-authoritative `GET /v1/session` and the approved access-request/account-management flow. |
| Snapshot origin label | **RV** | The shell distinguishes a reviewed snapshot from a synthetic fixture without calling either one live. | Every view response should provide exact `access`, `scope`, and `origin`. |
| Exact freshness | **DG** | A generation time renders only when supplied; otherwise the timestamp stays absent. | Every view response should provide `asOf`/`generatedAt` and per-source freshness. |
| Header notification bell | **GS** | The bell requests same-origin `GET /api/notifications`, validates its allowlisted envelope, and uses the server unread count. Any live failure clears prior rows and the badge and says the count is unavailable. A private `?` note explains filing, source, expected result, and the boundary from civic Alerts. The endpoint currently remains unavailable to the cookie-only browser until the backend binds `gw_beta_session` to one canonical account identity. | Add the reviewed HttpOnly-cookie-to-own-account bridge for `GET /api/notifications`; do not expose a bearer token to browser JavaScript. This contract remains separate from civic `GET /v1/me/alerts`. |

## 1. Home — `#/home`

| Major information group | Class | Current binding | Backend contract needed |
| --- | --- | --- | --- |
| Civic Weather counts | **RV** | Counts describe only the admitted `CardFeed`, `AgendaBoard`, and digest response. No percentage or service-health score is claimed. | A reviewed dashboard aggregate for weekly changes, votes, scope completeness, and per-level freshness. |
| Level filter | **DL** | Filters the admitted Home response in the browser and makes no claim that other government levels are fully queried. | Server-side scope filtering when separately authorized county/state projections exist. |
| Next meeting / Fast Agenda preview | **DG** | The real `AgendaBoard` currently supplies no agenda-anchored cards, so the designed meeting slot explains that gap. | Meetings and agenda-board views with official date/time, body, venue, stream, posting/version status, motions, hearings, attachments, and receipts. |
| Active issues and timeline preview | **RV** | Reviewed card-feed rows, labels, dates when supplied, and receipt links; they remain records, not inferred issue threads. | Typed backend issue/thread IDs and event edges for a true active-issue rollup. |
| Simple briefing and featured story | **RV** | Reviewed archived digest items and source trails, with their exact claim/AI labels. | Reviewed editorial briefing contract if richer plain-language `why it matters` or next-action prose is wanted. |
| Transparency alerts | **DG** | The slot remains visible and says document-change tracking is not connected. | Source-version events plus reviewed transparency-alert generation. |
| Latest verdict | **DG** | No official, score, promise/action alignment, or outcome is inferred from statements. | Reviewed power-profile verdict product with policy-cleared official, promise, action, comparison, review label, and receipts. |
| Language Watch | **DG** | No wording is classified in the browser. | Backend-supplied exact excerpt, locator, AI-presented label, reviewer state, and source receipts. |
| Explainer walkthrough | **GS** | Every Home lane shows the same neutral 1:13 product-media card with no civic figures. It links to the explicitly selected gated demo; playback, poster, example scenario, and visual transcript do not render on Home. | No civic API. Keep the product-media review unit and public-build exclusion described in the Global-shell row. |
| Source Vault summary, edition versions, honesty metrics, 90-day search | **DG** | Their designed slots remain unavailable; a digest source count is not promoted to vault verification, version history, quality scoring, or an archive index. | Source stats/versions, newsletter edition versions, approved quality metrics, and reviewed search endpoints. |
| County and State editions | **DG** | The layouts remain visible and honestly empty because the admitted projections are Alpine-first. | Separately authorized county and state projections with the same web-safe trust contract. |
| Populated Home sample widgets | **GS** | Available only on the explicit reviewer fixture path with a sample banner. | Never a production source. Replace each value only with the matching reviewed contract above. |

**The Home GS lane renders geometry, not civic prose (GOV-76).** `demo=design` populates
Latest Verdict and Language Watch so the approved Home direction is reviewable; the reviewed
lane keeps both DG rows above unchanged. Two constraints bind that fixture and are asserted
in `test/gov658-home-dashboard.test.ts`:

- **No person is named.** Officials are placeholders — `reference/README.md` §State
  Management, "No person-naming in AI analyses". The baseline's `R. Roe` is *not*
  transcribed: a Doe-style surname still reads as a real person in a screenshot.
- **Each synthetic leaf describes itself** (`SYNTHETIC PLACEHOLDER — stands in for a
  reviewed saved quote`) rather than stating a plausible promise-versus-action claim. A
  fabricated verdict reads as a live read once it leaves the browser; a placeholder cannot.
  Language Watch's three tiles are the baseline's wording *patterns*, which assert nothing
  about anyone.

`demo=sample` is unchanged and still leaves both slots empty; the fixture banner states which
lane populated which module, so it never claims "designed gaps remain empty" while they are
filled.

## 2. Fast Agenda — `#/agenda`

| Major information group | Class | Current binding | Backend contract needed |
| --- | --- | --- | --- |
| Board scope, origin, disclosures, lane names, counts | **RV** | Bound verbatim to `AgendaBoard`; the reviewed zero-card result and unanchored-statement count are visible. | Continue the agenda-board contract with exact generation time and meeting selection. |
| Next-meeting readiness card | **DG** | Card count, unanchored count, and supplied lane count are real; official meeting details, posting/version events, votes, video timing, attachments, last/next meetings, and public-comment rules remain explicit gaps. | `GET /v1/jurisdictions/:id/meetings` plus a meeting detail/readiness projection and receipts. |
| Agenda item rows | **DG** | The current board has no anchored card. If cards arrive, only supplied title/order, meeting fields, lane, status, confidence, gaps, lineage, and source refs may populate. | `GET /v1/meetings/:id/agenda-board` and `GET /v1/agenda-items/:id` with official item numbers, motions/hearings, attachments, and action types. |
| AI analysis and Language Watch blocks | **DG** | Both baseline blocks remain in each reviewed row/empty state and say the products are unavailable. | Backend-authored analysis/watch products with exact excerpt/claim, AI and review labels, and receipt locators. |
| Process ladder and decisions | **DG** | No process step, final action, or decision is derived from lane placement; the backend's disclosed-empty `decisions` remains empty. | Typed procedural events and reviewed decision/outcome fields. |
| Supplied receipts and lineage | **RV** | A card may render only its exact `sourceRefs` and typed lineage values; an absent value is never backfilled. | Continue supplying web-safe agenda-item receipts and typed lineage. |
| Connected history, issue links, timeline actions | **DG** | Richer connected-history tools remain unavailable because no matching issue/thread event product is supplied. | Typed issue/thread/event edges and stable deep links. |
| Agenda lifecycle rail | **RV** | All six supplied `AgendaBoard` lifecycle lanes stay visible, including empty lanes, and card placement is backend-owned. The rail is labelled as agenda lifecycle, not issue tracking. | Continue the reviewed agenda-board projection and its backend-owned lane vocabulary. |
| Seven-stage Issue Tracker | **DG** | The separate baseline slot stays unavailable. The six agenda lanes are never translated into Captured/Public Comment/Voted issue-thread stages. | A typed cross-meeting issue/thread product with backend-owned stage, last/next event, level, flags, links, and receipts. |
| Tracking/reminder controls | **DG** | Reviewed rows do not promise monitoring or delivery. | Server watchlist and reminder actions with recipient/session authorization and delivery state. |
| July 21 meeting, analysis, process, and issue population | **GS** | The high-fidelity populated agenda is allowed only in explicit reviewer design-fixture mode. | Never merge fixture rows, dates, counts, or receipts into the reviewed board. |

## 3. Timeline — `#/timeline`

| Major information group | Class | Current binding | Backend contract needed |
| --- | --- | --- | --- |
| Town axis, event cards, trust labels, receipts | **RV** | Uses reviewed `ReadApiResponse` records. Display-order dates come only from agenda/source/scan/validation fields and are labelled as such, not inferred event dates. | `GET /v1/events` with explicit event date/type, stable cursor, scope, and provenance. |
| Search, type, grouping, and result controls | **DL** | Query parameters filter the currently admitted response; result counts describe that response only. | Server search/filter/pagination for complete archive claims and large result sets. |
| County and State lanes | **DG** | Both colored baseline lanes remain present and say their reviewed projections are unavailable. | Separately authorized county/state event responses. |
| Issue-run hover, connector lines, issue preset, deep-linked run | **DG** | The connector slot says typed cross-record issue edges are absent. No title similarity or shared topic label creates a connection. | Backend issue/thread IDs plus typed, receipt-backed event edges. |
| Window presets and archive-to-2019 claim | **DG** | The current response can be grouped by year/month/day but does not claim a complete 90-day/year/all-record archive. | Backend window/cursor contract and completeness metadata. |
| Handoff event dots and linked runs | **GS** | Remain design-reference values unless an explicit fixture route is provided; they never backfill real County/State lanes. | Replace only with reviewed event and edge contracts. |

## 4. Boards — `#/boards`

| Major information group | Class | Current binding | Backend contract needed |
| --- | --- | --- | --- |
| Government-body directory cards | **DG** | The tracked-bodies slot remains visible and empty. | `GET /v1/bodies` with policy-cleared body IDs/names and jurisdiction. |
| Meeting cadence | **DG** | No cadence is inferred from agenda dates or topic records. | Body schedule/cadence fields and freshness. |
| Members and roles | **DG** | No person is named from statement speakers, agenda text, or topic metadata. | Policy-cleared body membership/role rows with effective dates and sources. |
| Official links and calendars | **DG** | No topic source alias is promoted to a board URL. | Body-level official site, meeting calendar, agenda, and contact links. |
| Reviewed civic-topic context | **RV** | `TopicTreeResponse` labels and aliases are shown in a separate, explicit `not a government body profile` section linking back to Timeline. | No change to the topic contract; it must remain separate from bodies. |
| Populated handoff board cards | **GS** | The owner fixture demonstrates layout only and is not executed as the reviewed directory. | Never use `TopicTreeResponse` as a shortcut to populate them. |

## 5. Power Tracker — `#/power`

| Major information group | Class | Current binding | Backend contract needed |
| --- | --- | --- | --- |
| Reviewed evidence records and receipts | **RV** | Statement text/title fallback, exact status/verification fields, and web-safe evidence render as source inputs, not people profiles. | Preserve the existing read contract; add profile references only when backend-owned. |
| Official roster and profile | **DG** | The roster and official tools remain visible and unavailable. No name or role is inferred. | `GET /v1/officials` and `GET /v1/officials/:id/power-profile` with policy-cleared identity and source dates. |
| Score donut, rankings, kept/broken/partial bars | **DG** | No score, percentage, ranking, or performance category is calculated client-side. | Reviewed backend score methodology/version, inputs, result, limitations, and receipts. |
| Promise vs action verdict and consent gate | **DG** | The designed verdict slot remains unavailable; statements are not compared in the browser. | Backend promise/action pair, verdict label, AI/review state, methodology, and receipts. |
| Quote ledger and vote/action table | **DG** | No quote status, vote classification, or action outcome is inferred. | Source-anchored quote records and typed votes/actions with official receipts. |
| Placeholder officials, scores, verdicts, quotes, votes | **GS** | Populated only in explicit reviewer design-fixture mode with the AI/disclaimer interstitial. | Never copy a fixture name or value into the reviewed route. |

**No figure on this page is derived in the browser (GOV-83).** The fixture renders a score
donut, kept/broken/partial bars, a promise ledger and a vote/action record. Every number —
including each bar's percentage — is a **literal in the fixture table**, never computed from
the counts beside it, because scoring is a backend product with a versioned method. Turning a
supplied number into arc length or bar width is presentation; deriving the number is not done.
Vote rows open the existing AI-consent modal, so the hallucination disclaimer always precedes
a promise/action conclusion. Officials remain placeholders, as on Home and Newsletter.

*Note for anyone re-reading the tests:* `test/design-pages.test.ts` used to sweep the whole
fixture page for `\b\d+%` as a proxy for "claims no score". That assertion tested the absence
of a feature **this row authorises**, so it was re-scoped to the actual invariant — no
*production* score is claimed, and every synthetic figure declares `data-origin="fixture"`.

## 6. Source Vault — `#/vault`

| Major information group | Class | Current binding | Backend contract needed |
| --- | --- | --- | --- |
| Source rows and original/archive links | **RV** | Deduplicated web-safe `EvidenceLink` metadata from reviewed statement receipts. Link presence is not called verification. | `GET /v1/sources` for authoritative registry rows, freshness, and pagination. |
| Supplied-file provenance note | **RV** | Free-text `provenance_note` from the B6 supplied-file projection, rendered verbatim as a plain provenance line distinct from the `original_url` locator. Per GOV-1609 §4.2 it is NEVER auto-linkified (only a validated http(s) `original_url` is clickable); absent when the projection omits it. | Backend `provenance_note` TEXT on the supplied-file record (GOV-1625), emitted web-safe alongside the validated `original_url`. |
| Supplied-file projection clearance | **RV** | The `SuppliedFilesProjection` binds to `supplied_file_dto/v1` (GOV-1987 AC#8): envelope `access: web_safe` — every file is reviewer-cleared for the web, NOT `reviewer_internal` — plus `scope: alpine`, `dataOrigin: reviewed_snapshot`, and the pinned `dtoVersion`. Presence in `files` is the web-safe verdict; Simple/Advanced presentation selects the same fields and cannot alter authorization or publication eligibility (no `review_state`/private locator on the wire to unlock). | The pinned `supplied_file_dto/v1` (`Docs/gov1987-supplied-file-dto-v1-contract.md`, backend `89a0ec8`); a version bump is a separate exact-version reviewed integration, never a silent widening. |
| Supplied-file card heading (title) | **DG** | `title` is an honest `null` today per `supplied_file_dto/v1` §2/§3 (no reviewer-curated title column exists). The card renders an honest "Reviewed source file" heading and NEVER back-fills from the raw uploader `original_filename` (an unapproved filename) or any guessed value; the file's kind and civic ties are carried by the metadata rows. | A reviewer title-curation path (schema + workflow) that populates `title`; until then the honest-unavailable heading stands. |
| Source-row count | **RV** | The count describes unique source rows in the admitted response only. | `GET /v1/sources/stats` for an authoritative registry-wide count and freshness. |
| Hash verification and open-flag stats | **DG** | Hash percentage and transparency-flag count remain unavailable. | `GET /v1/sources/stats` with backend-defined denominator, method, timestamp, and status. |
| Transparency alerts | **DG** | The slot remains visible; statement status is not converted into a document-change alert. | `GET /v1/transparency-alerts` over reviewed source-version events. |
| Document version compare | **DG** | No v1/v2 content or diff is fabricated. | `GET /v1/sources/:id/versions` with deterministic web-safe diff and both version receipts. |
| Vault ledger and video-status ladder | **DG** | No hash, custody event, release age, transcript state, or missing-video flag is inferred from dates. | Web-safe ledger/version history and reviewed video-release/transcript status events. |
| Third-party verification | **DG** | Original/archive link totals are shown, but archive provider and validation result remain unavailable. | Reviewed provider, capture, validation, and freshness fields; never expose raw hashes or private locators. |
| Packet-diff sample | **GS** | The sample route may show a visibly labelled visual placeholder only. | Replace with the deterministic source-versions contract, not fixture diff text. |

## 7. Newsletter — `#/newsletter`

| Major information group | Class | Current binding | Backend contract needed |
| --- | --- | --- | --- |
| Archive list, digest identity, coverage period | **RV** | Exact archived `NewsletterDigestResponse` values. The default route shows the full baseline structure plus an explicit current-edition gap and archive; it does not infer “current” from response order. A supplied ID opens detail. | `GET /v1/newsletters` with origin, edition status, freshness, featured/current markers, and pagination. |
| Digest sections, items, claim labels, gaps, source trail | **RV** | All required sections render, including explicit empty sections, and trust/AI labels stay verbatim. | `GET /v1/newsletters/:id`; preserve the frozen claim vocabulary and web-safe source trail. |
| Pre/post meeting pairs and edition versions | **DG** | A coverage period or newsletter ID is not treated as version history or a paired edition. | Reviewed edition IDs, pair relationship, status, generation/publication times, and receipts. |
| Full agenda story, motions, diffs, public comment, checklist, Language Watch | **DG** | Digest items are not expanded into unsupported agenda detail or procedural judgments. | Agenda-item editorial projection with backend-supplied blocks, states, labels, and locators. |
| Roundtable debate, voice script, and playback position | **DG** | No debate line or speaker position is invented. Browser speech may read only an approved supplied script. | Reviewed debate/script product with AI/review disclosures, sources, speakers-as-roles, and version. |
| Six ideological/founding lenses and drift checks | **DG** | No record is classified into a lens or ideological conclusion in the browser. | Explicit reviewed lens product with methodology, source support, qualifications, and approval. |
| July 21 newsletter, debate, lenses, and delivery examples | **GS** | Preserved as owner design reference only unless an explicit gated fixture renderer is added. | Never seed reviewed newsletter fields from the handoff. |

## 8. Watchlist — `#/watchlist`

| Major information group | Class | Current binding | Backend contract needed |
| --- | --- | --- | --- |
| Watched reviewed-record titles, status, receipts | **RV** | A saved key resolves to civic detail only when the admitted `ReadApiResponse` contains that exact statement ID. Unknown local keys expose no fixture metadata. | Server watchlist entries should carry stable typed target IDs and fetch authorized target summaries. |
| Add/remove state | **DL** | `gw_tracked` changes this browser's reading list only. | `GET/PUT /v1/me/watchlist` for account sync, authorization, and multi-device state. |
| Issue/board/official/document type filters | **DG** | Only reviewed statements are enabled; unsupported target-type tools remain visible and disabled. | Typed watchable-target directory and per-type reviewed projections. |
| Watch history, changes, votes, deadlines, delivery | **DG** | No history or notification promise is derived from tracked IDs. | Server event history plus civic alerts/reminder contracts. |
| Populated issue/official fixture digest | **GS** | Available only in explicit reviewer design-fixture mode and remains separate from reviewed IDs. | Never resolve a reviewed ID through the fixture catalog. |

## 9. Location — `#/location`

| Major information group | Class | Current binding | Backend contract needed |
| --- | --- | --- | --- |
| Current reviewer scope and matching Alpine records | **RV** | The page can show admitted Alpine statement records only when the device label does not select another place. | Coverage/location responses must bind a selected location ID to separately authorized civic projections. |
| Saved place label | **DL** | `gw_location` is a browser preference and explicitly does not prove identity, residence, or coverage. | `PATCH /v1/me/location` only after a server session and approved location policy. |
| Breadcrumb and State/County/Town directory controls | **DG** | The reviewed layout keeps the controls visible but disabled because no authoritative directory is connected. | `GET /v1/locations` with stable IDs, hierarchy, names, and availability state. |
| Coverage, backlog, freshness, funding, and speed | **DG** | No percentage, processed-today state, backlog, or funding conclusion is calculated from record count. | `GET /v1/coverage` with backend-defined measures, denominators, timestamps, gaps, and provenance. |
| Identity lock / change-place policy | **DG** | No driver-license, account lock, exemption, or support workflow is claimed. | Approved identity/location policy and server-managed change flow. |
| State/county/town tiles and coverage percentages | **GS** | Fixture mode may demonstrate picker behavior and synthetic percentages with a fixture disclaimer. | Never promote tile color, percentage, or availability from the fixture. |

## 10. Alerts — `#/alerts`

| Major information group | Class | Current binding | Backend contract needed |
| --- | --- | --- | --- |
| Unread civic feed and earlier history | **DG** | The baseline feed/history panels remain visible. Statement records and shell account notifications are not converted into civic alerts. | `GET /v1/me/alerts` plus stable event IDs, severity, timestamps, source receipts, read state, and mark-read action. |
| Tracked-item diagnostics | **DL** | The page may count locally stored keys that exactly match reviewed records; this does not mean monitoring is active. | Server watchlist-to-alert registration and monitor state. |
| Delivery settings | **DG** | Email, text, push, meeting-eve, and digest controls remain disabled on the reviewed route. | `GET/PUT /v1/me/alert-preferences` with verified recipient/channel state and delivery policy. |
| Trigger rules | **DG** | No agenda-posted, document-changed, deadline, meeting-eve, or missing-video event is inferred. | Backend trigger definitions and source-version/meeting event producers with provenance. |
| Alert cards and delivery examples | **GS** | Synthetic severity cards render only in explicit reviewer fixture mode. They are not sourced from `NotificationResponse`. | Replace only with the civic alerts contract, never the account-notification endpoint. |
| Read state in fixture mode | **DL** | Browser-only interaction preview; it sends nothing and registers no recipient. `gw_alerts_read` only. | Mark-read API before any persistence claim. |
| Delivery-channel controls in fixture mode | **CS** | No channel, recipient verification, or delivery service exists in any lane, so the fixture lane shows the `COMING SOON` marker naming all five channels and stores nothing. It previously rendered persisted `role="switch"` toggles defaulting ON — a switch that survives a reload reads as a configured setting whatever the surrounding notice says (#86). | None — this is an unbuilt feature, not an awaited contract. The reviewed lane's row above keeps `GET/PUT /v1/me/alert-preferences` as the contract it awaits. |

## Hard prohibitions

- **No TopicTree-as-Boards.** A reviewed topic label is navigation context, not a
  tracked government body, meeting cadence, member roster, or official link.
- **No civic alerts from account notifications.** Access/cohort/consent messages
  in `NotificationResponse` never populate the Alerts feed or badge as civic
  monitoring events.
- **No invented coverage.** Record counts, a saved location, or fixture map
  colors do not establish coverage, backlog, freshness, funding, or speed.
- **No invented official, score, or verdict.** Statement records do not identify
  a scored official or support a promise/action judgment without the dedicated
  backend product and receipts.
- **No invented lens or debate.** Digest items do not authorize ideological
  classification, synthesized speakers, or a scripted debate.
- **No invented timeline edge.** Similar titles, dates, topics, or agenda items
  do not create an issue run, connector, causal link, or cross-government edge.
- **No fixture promotion.** Synthetic dates, counts, names, percentages,
  settings, quotes, votes, and source labels never become fallbacks for reviewed
  slots.

## Reviewer checklist for changing this ledger

Update this file in the same change whenever a baseline information group is
added, removed, enabled, disabled, or rebound.

- [ ] Name the exact baseline page, major information group, and reviewed route.
- [ ] Assign **RV**, **DG**, **DL**, **GS**, or **CS**; do not use an ambiguous
      “temporary” or “mostly real” state.
- [ ] For **RV**, name the exact response type/field or endpoint, access scope,
      origin/freshness value, trust label, and receipt path.
- [ ] For **DG**, keep the slot in both Simple and Advanced modes, name the
      missing contract, and disable any action that cannot succeed.
- [ ] For **DL**, label the state as browser-only and verify it makes no account,
      identity, coverage, monitoring, subscription, reminder, or delivery claim.
- [ ] For **GS**, require reviewer admission, an explicit fixture flag, and the
      fixture banner before any synthetic leaf reaches the DOM.
- [ ] For **CS**, require the `COMING SOON` marker from `src/ui/coming-soon.ts`, add
      the slot to the CS registry above with its owning page and route, and **forbid
      any backend-contract sentence** — there is no contract to await, so naming one
      invents a product claim. Before assigning CS, confirm the slot is not simply a
      DG whose contract is unshipped: DG means the *data* is missing, CS means the
      *feature* is.
- [ ] **CS copy is authored literal text — never interpolated from a response.**
      `comingSoonNote(feature, detail)` must receive written strings, not values built
      from a projection. All seven call sites satisfy this today (audited 2026-07-31,
      zero `${…}` interpolation). Passing data in would put civic content inside a slot
      that says nothing is built — an invented claim — and would route response text
      into the DOM through a path no reviewer reads as data-bearing.
- [ ] Confirm an adjacent source was not repurposed: TopicTree is not Boards,
      account notifications are not civic alerts, statements are not official
      profiles, and record counts are not coverage.
- [ ] Confirm Simple and Advanced preserve the same facts, qualifications,
      receipts, gaps, access restrictions, and source origin.
- [ ] Run `assertWebSafe`/private-field checks and verify unknown trust/status
      values fail closed without disappearing.
- [ ] Verify the public/non-approved lane contains zero civic records, fixture
      leaves, counts, or content-bearing attributes.
- [ ] Test reviewed populated, reviewed empty/gap, fixture, and denied-access
      states at desktop, tablet, and mobile widths.
- [ ] Record any deliberate baseline omission in the pull request with the
      accessibility, data-integrity, or usability reason and owner approval.

Related requirements: [MOTY baseline
README](../design/baseline/moty-government-watchdog-2026-07/README.md),
[design handoff integration](design-handoff-integration.md), and [content-quality
baseline](content-quality-baseline.md).
