# Stage 3.06 — Card-feed frontend surface CONTRACT (Docs-only, planning)

> **Status:** CONTRACT (docs-only). Authorizes **no** production code, **no** scope/launch/budget unlock.
> **Owner role:** FrontendTimelineEngineer. **Issue:** GOV-353. **Parent:** GOV-352 (CTO sequencing dispatch).
> **Stage:** 3.06 `plan→impl` planning child. **NON-implementation. NON-unlock.**
> **Scope:** Town of Alpine only · reviewer-internal · **no public launch / no public projection.**
> **Goal:** `eac4a8db-364e-4ed1-9098-e474db4b2e09` (stays OPEN at this doc's merge; flips to *achieved* only at the GOV-354 implementation merge — mirror of GOV-346).
> **Grounded (this dispatch):** backend `origin/main` HEAD `6d65bd3` (GOV-347/#63); website `origin/main` HEAD `a89e89f` (GOV-314/#16).
> **Mirrors:** the proven GOV-346 shape (contract → premium → impl).

This document **pins the user-visible frontend surface** that the implementation child (GOV-354)
will build. It consumes the **GOV-347 card-feed envelope exactly as shipped** and re-uses the
existing reviewer-internal Alpine timeline. It re-derives **no** backend field and invents **no** field.

---

## 0. Input of record (consume; do not re-derive)

Source of truth: backend `Docs/stage3-05-card-feed-contract.md` §2 (derived status vocab) and §3
(feed shape), plus `scripts/stage3_card_feed.py`, at backend `origin/main` HEAD `6d65bd3`. The
website **consumes** this; it does not re-derive it.

```jsonc
{ "scope": "alpine", "access": "reviewer_internal",
  "cards": [
    { "handle": "c1_<40hex>",
      "type": "statement|meeting|decision|source|correction|ai_presented|info|source_missing",
      "title", "date", "jurisdiction", "reviewed_summary", "status",
      "confidence_label", "speaker_label", "provenance_status",
      "evidence": [ { "relation", "final_url", "locator_kind",
                      "timestamp_human", "timestamp_seconds", "page", "section" } ] },
    { "handle", "type": "source_missing", "jurisdiction", "status": "source_missing",
      "gap_type", "severity", "resolved_status", "detail?" }
  ] }
```

Two card shapes share the `cards[]` array: a **present card** (eight `type` values that carry
content + evidence) and a **`source_missing` card** (gap-only, no evidence, routed to the gap lane).

---

## 1. Data-delivery handoff decision (the key open architectural choice)

**DECISION: (a) committed reviewer-internal fixture mirroring `stage3_card_feed.py` output.**

| Option | Verdict | Reason |
|---|---|---|
| **(a) committed fixture** | **CHOSEN** | Lowest new attack surface. Mirrors the existing `src/fixtures/` pattern (`alpine-sample.json`). Swept by `assertWebSafe` at module load (`src/data/client.ts:37`). Reuses the GOV-314 `access==='reviewer_internal'` lane gate with **zero** new network/runtime surface. No public projection. |
| (b) build-time generated data file | Rejected for 3.06 | Adds a generator/build step and a new artifact-trust question (who runs it, when, with what corpus) for no Stage-3.06 benefit. Revisit only if the feed must refresh without a commit. |
| (c) live gated endpoint | Rejected for 3.06 | Adds a network surface and an auth/gating layer that does not exist on this static reviewer-internal site. Out of Alpine-first scope; would require a SecPriv + CEO publication gate. **Pass-up trigger** if ever needed. |

**Delivery contract for GOV-354:**

1. The card feed lands as a committed reviewer-internal fixture, e.g.
   `src/fixtures/alpine-card-feed.json`, captured **verbatim** from
   `scripts/stage3_card_feed.py` against the real reviewed Alpine corpus (the same capture
   discipline as [`gw-frontend-readapi-sample-capture`] — throwaway backend worktree, real DB, no AI/network).
2. The fixture carries a `_provenance` block (capture date, method, backend `origin/main` HEAD,
   `raw_path_sweep: CLEAN`, `access: reviewer_internal`) — mirroring `alpine-sample.json`.
3. The loader sweeps the fixture through `assertWebSafe(...)` **at module load** (fail-loud) exactly
   as `client.ts` does today. A hand edit that paints a vault/absolute path or a forbidden raw key
   (`RAW_PATH_FORBIDDEN_KEYS`) makes the app throw `RawPathLeak` immediately.
4. The fixture mode keeps the visible **FIXTURE banner** ("Reviewer-internal offline snapshot — not
   a live read") — no card feed is ever presented as a live read.

> The feed MUST stay behind the reviewer-internal gate and add **no** public projection (§5).

---

## 2. Field → component map

Every GOV-347 envelope field maps to a **concrete existing component**. No new presentation
primitive is required; 3.06 is a *consume-the-new-envelope* adapter over the GOV-153/205/257/293/301/314
timeline. "Existing anchor" cites the file/symbol the impl reuses.

### 2.1 Present card (`type ∈ {statement, meeting, decision, source, correction, ai_presented, info}`)

| GOV-347 field | UI surface | Existing anchor (reuse, do not rewrite) |
|---|---|---|
| `handle` (`c1_<40hex>`) | Stable list key + per-card scroll anchor (replaces the per-day `gw-day-*` anchor as the card identity) | `render.ts` `recordCard` `opts.anchorId`; time-navigator jump (`timeNavigatorAside`) |
| `type` | Leading **emoji/icon + hover title** in the badges row; also selects the card variant (see §3) | `render.ts` `gw-badges` row (new per-`type` glyph map; **icon + text, never colour alone**, mirroring the GOV-314 provenance glyph rule) |
| `title` | Card head (the visible headline) | `recordCard` head — **new** explicit title element (today the body shows `statement_text`; the feed gives a real `title`) |
| `date` | Card head date + **chronological ordering** + day grouping | `timeline.ts` `buildTimeline` ordering; `buildTimeNavigator` year→month→day bars |
| `jurisdiction` | **Alpine-scope filter** — non-`alpine` rows dropped + logged, never shown under the Alpine view | `timeline.ts` Alpine scope lock (BEH-FILTER-2; `render.ts:486-487` warnings) |
| `reviewed_summary` | Card **body** (reviewer-internal text), inside the click-to-reveal blur region | `recordCard` `gw-fact` / `gw-analysis` body; GOV-153 #2 reveal blur. **Reviewer-internal-only field (§5).** |
| `status` | **Trust/status label + gated blocks** (see §3 status→UI map) | `state-view.ts` `recordTone` + `trustLabel`; `gw-badge gw-tone-*`. Consumed **verbatim**, never recomputed. |
| `confidence_label` | Sharp **Confidence** meta chip (never blurred) | `statement-presenter.ts` `confidenceLabel` (5-value SSOT map); `render.ts` `gw-confidence` |
| `speaker_label` | Sharp **Speaker** meta line (never blurred) | `statement-presenter.ts` `speakerLabel` (verbatim pass-through); `render.ts` `gw-speaker`. **Reviewer-internal-only field (§5).** |
| `provenance_status` | **Provenance / audit-passed badge** (reviewer-internal lane only) | `statement-presenter.ts` `provenanceBadge` (fail-closed: only `grounded` → "Audit-passed"; all else → "Unverified provenance"); `render.ts:116-134`. **Reviewer-internal-only field (§5).** |
| `evidence[]` | **Source drawer** (one labeled field list per row) | `render.ts` `evidenceDrawer` + `statement-presenter.ts` `drawerFields` |

### 2.2 Evidence row (`evidence[]` element) → source drawer fields

The GOV-347 evidence shape is **leaner** than today's `EvidenceLink`. Map present keys; **omit**
absent ones (the drawer already projects present-only). Honesty rows that must always show are kept.

| GOV-347 evidence key | Drawer field | Existing anchor |
|---|---|---|
| `relation` | "Relation" (how this evidence relates to the card — e.g. primary source / supports) | `drawerFields` text row (**new key**, rendered verbatim) |
| `final_url` | "Original source" → **View original** link (new tab, `rel=noopener`) | `drawerFields` `original_url` link row |
| `locator_kind` | "Citation pointer" (the *kind* of exact-source anchor) | `statement-presenter.ts` `locatorKindLabel` |
| `timestamp_human` · `page` · `section` | "Locator" (composed `p.N · section · ⏱`) | `statement-presenter.ts` `locatorText` |
| `timestamp_seconds` | **Not surfaced as a value.** May only feed an offset on `final_url` if the public URL itself supports it; **never** compose a raw/vault deep link | `web-safe.ts` `RAW_PATH_FORBIDDEN_KEYS` (`deep_link`) — leak guard |
| *(archive / published_by / scan_date / verification_status / correction_status absent in this envelope)* | **Bounded gap.** The "Archived copy → Archive not available" honesty row still renders; the other rows simply do not appear until a future envelope carries them | `drawerFields` always-emit archive row; present-only projection |

### 2.3 `source_missing` card → completeness-gap card

`type: "source_missing"` cards are **not** record cards. They route to the gap lane.

| GOV-347 field | UI surface | Existing anchor |
|---|---|---|
| `handle` | Per-meeting subject id / list key | `render.ts` `gapCardSection` `data-subject`, `gap-subject` |
| `gap_type` | Gap-kind label + per-type count in the breakdown | `timeline.ts` `buildGapSummary` groups; `render.ts` `gap-type-*` |
| `severity` | Severity badge (colour from `severityTone`; backend `severity` decides, never the UI) | `render.ts` `severityTone` + `gap-severity` |
| `resolved_status` | Status badge (neutral tone) | `render.ts` `gap-status` |
| `detail?` | Optional muted detail line (present-only) | `render.ts` `gap-detail` |
| `status: "source_missing"` | Routes the card to the gap lane (not the trust-badge lane) | `buildGapSummary` / `gapCardSection` |

> **Adapter note for GOV-354:** today `buildGapSummary` reads top-level `completeness_gaps[]`
> (GOV-298 shape). The card feed instead carries gaps as `source_missing` cards inside `cards[]`.
> The impl child adds a thin adapter that **partitions** `cards[]` into present cards
> (→ `recordCard`) and `source_missing` cards (→ gap summary), preserving every field verbatim.
> No gap is invented, re-classified, or marked resolved on the client.

---

## 3. Status → UI map (honesty posture)

The backend `status` / `type` vocab (backend §2 derived vocab) maps to visible labels + gated
blocks. The frontend **never recomputes trust**; it maps the backend value 1:1 to copy/tone.
Visual polish must **never** imply verification.

| Backend signal | UI treatment | Honesty rule |
|---|---|---|
| `type: source_missing` (`status: source_missing`) | Gap lane only (§2.3) | A missing source is shown as a **gap**, never as a present record card. |
| `type: ai_presented` **and/or** `status: unverified` | **Always gated-blocked**: rendered inside the `gw-analysis` AI region with the locked **"AI analysis — not independently verified"** caption + the **AI label** badge, behind the click-to-reveal blur | AI-origin text never reads as a verified fact. Badges (trust + AI) stay **sharp/outside** the blur so they can't be hidden (`render.ts:176-204`). |
| `status: disputed` | **Bounded gap — not surfaceable today.** Do **not** render a fabricated dispute UI or a second "other side". If a card arrives `disputed`, surface a neutral **withheld/gated** state (`do-not-publish`-style stop tone) and **omit** the body, or drop it from the present lane | Never invent a dispute, a counter-source, or a correction the backend did not ship. |
| `status: source_changed` | **Bounded gap — not surfaceable today.** Same as `disputed`: no fabricated "source changed" correction card | Never fabricate a correction/diff. |
| `type: correction` | Render only when the backend ships an explicit correction card with its own evidence; label **"Corrected"** and link forward (typed link), never rewrite the prior card | Corrections work **forward** from the correction date; known-then text is never edited. |
| present trust states (`source-backed`, `archived-source-backed`, `corrected`, `pending-review`, `unverified`, `needs-clarification`, …) | Single trust badge via `recordTone` + `trustLabel`; tone is **colour only** | Exactly one status badge per card; consumed verbatim from the backend `ui_status`/`status`. |
| `do-not-publish` | Reviewer-internal lane: stop-toned badge, body gated. Public lane: **0 cards** (§5) | A do-not-publish record is never rendered on any public surface. |

> **GOV-354 must pin** the exact backend §2 `status` string → `UiStatus` mapping against backend
> `Docs/stage3-05-card-feed-contract.md` §2 at build time, extending `state-view.ts` with a
> verbatim table and a fail-closed default (unknown value → least-trusted tone, never dropped),
> mirroring how `confidenceLabel`/`locatorKindLabel` title-case unforeseen values rather than hiding them.

---

## 4. States (per `BACKEND_FRONTEND_EVIDENCE_WORKFLOW.md`)

| State | Surface | Existing anchor |
|---|---|---|
| **empty** | "No reviewed Alpine cards yet" panel; a gaps-only feed is **not** empty (a `source_missing`-only feed still renders the gap card) | `state-view.ts` `stateView`; `client.ts` `isEmptyResponse` (gaps count) |
| **loading** | Neutral loading panel | `stateView` loading branch |
| **error** | Alert-role error panel; on a live-read failure, fall back to the labeled fixture **with a visible notice** | `stateView` error; `client.ts` fallback notice |
| **pending-review** | Per-card `pending-review` trust tone; body gated | `recordTone`/`trustLabel` |
| **corrected** | "Corrected" badge + forward link to the correction card | §3 `type: correction` |
| **do-not-publish** | Reviewer-internal: gated stop tone. Public: 0 cards | §3 + §5 |

Every state keeps labels visible; visual polish never implies verification.

---

## 5. Reviewer-internal / no-public-leak invariant (hard contract clause)

**`access === 'reviewer_internal'` is the SOLE gate** (mirror GOV-314). This is a hard contract
clause, not a styling preference:

1. **Public lane renders 0 cards.** When `envelope.access !== 'reviewer_internal'`, the surface
   renders **zero** cards (present *and* `source_missing`). The card-feed adapter returns an empty
   list before any DOM is built.
2. **Reviewer-internal-only fields never enter a public-lane render or DOM:** `reviewed_summary`
   (and any `statement_text`), `speaker_label`, and `provenance_status` are **only** read on the
   reviewer-internal lane. They are not written into attributes, data-* hooks, or text on the public
   lane — they are absent from the public DOM entirely (not merely hidden by CSS).
3. The provenance badge is rendered **only** when `access === 'reviewer_internal'` (existing
   `render.ts:492` gate). The client never synthesizes a provenance verdict on the public lane.
4. **Defense in depth:** the whole feed still passes `assertWebSafe` (raw-path / forbidden-key
   sweep) regardless of lane, so a leak-bearing locator fails loud even on the reviewer-internal lane.

> Any need to render cards to a non-reviewer-internal audience = public projection → **STOP**,
> comment, escalate to CEO/Isaac (§7). This doc authorizes none.

---

## 6. Premium success-criteria block (paste-in for goal `eac4a8db`)

Filled against `/Users/IA/Documents/Obsidian Vault/01_projects/Government-Watchdog v1 Plans/Docs/2026-06-06-Premium-Success-Criteria-Framework.md`.

```markdown
## GOV Premium Success Criteria

Stage: 3.06 (card-feed frontend surface) → 3.07/GOV-354 implementation
Scope: Town of Alpine only · reviewer-internal · no public launch / no public projection
Project/repo: website xXKillerNoobYT/Government-watchdog-website (78066972-3f3b-4075-9c1e-2d6817001099)
Owner role: FrontendTimelineEngineer (consumes GOV-347 backend envelope; UX review UXProductDesigner; safety VSR + SecPriv)
Reviewer path: Impl(Plan) → VSR leg → SecPriv leg → CTO non-author merge
Blockers / unlock rule: this doc unlocks nothing; GOV-354 implementation child is the next executable step. Goal eac4a8db stays OPEN at this doc's merge; achieved only at GOV-354 merge.

### Success Definition
- Success means: A reviewer can open the reviewer-internal Alpine card feed and, for one present card, read its title/date/speaker_label, see exactly one trust badge + (when grounded) an audit-passed provenance badge, expand the source drawer to its evidence (relation, View-original link, citation-pointer kind, locator), AND see the source_missing meetings surfaced as countable gaps — every visible field traced to a named GOV-347 envelope key with zero invented fields.
- Evidence proving success: GOV-354 PR with passing unit/integration suite (card-feed adapter + web-safe sweep + reviewer-internal lane test), `git diff --stat`, and the 3-viewport screenshot floor below.

### Failure Definition
- Failure looks like: a card renders without a trust label; AI/ai_presented or unverified text reads as a verified fact; a disputed/source_changed card shows a fabricated dispute/correction; reviewed_summary/speaker_label/provenance_status appears in a public-lane DOM; a source_missing meeting is shown as a present record; any raw/vault path reaches the wire (RawPathLeak).
- Stop/escalation trigger: any need for public launch/public projection, a live gated endpoint, legal/privacy/publication judgment, official-contact automation, budget, or scope beyond Alpine → STOP and escalate to CEO/Isaac.

### Workability
- Real user/operator workflow: reviewer (Isaac/designer + VSR) opens the reviewer-internal Alpine feed to audit what is known/presented/AI-interpreted and what is still missing a primary source.
- Inputs: committed reviewer-internal fixture captured verbatim from scripts/stage3_card_feed.py (real reviewed Alpine corpus).
- Outputs: chronologically-ordered present cards + a completeness-gap card; every present field source-traced; gaps countable.
- Missing/stale/disputed source behavior: source_missing → gap lane; disputed/source_changed → bounded gap, not surfaced (no fabrication); unverified/ai_presented → gated-blocked AI region.
- Resume/retry behavior: live mode falls back to the labeled fixture with a visible notice; fixture re-capture is a deterministic re-run of stage3_card_feed.py (no AI/network).

### Ease of Use
- Resident/Isaac comprehension target (30s): "These are reviewed Alpine records in time order; each shows how confident/where-from it is; these meetings still have no primary source." Trust + AI badges are sharp/legible (≥13px at the 390px floor) and never hidden behind the reveal blur.
- Labels/statuses/gaps visible: trust badge, AI label, provenance badge, confidence + speaker meta, completeness-gap counts, fixture banner — all visible without hover; the trust legend is a tap-reachable <details>.
- Required screenshot/prototype/wireframe/review note: 3-viewport screenshots (below) + the text-only interaction sketch (below) + UXProductDesigner review.

### Comparable Research
- Comparable tools reviewed:
  - DocumentCloud — primary-source document management, annotation, publishing. Lesson: every card must drill to the original document/locator (drives the source drawer + final_url + citation-pointer). Avoid: burying provenance behind annotation chrome. Fit: fits Alpine local-document records well.
  - GovTrack — chronology + status tracking of legislative activity. Lesson: stable chronological order + plain-English status labels (drives buildTimeline ordering + verbatim status copy). Avoid: federal-scale taxonomy not needed for a single town. Fit: chronology UX fits; legislative scope does not.
  - Open States — structured jurisdiction/bill/vote/action data via typed API. Lesson: keep concepts typed and separate (drives concept separation + typed links, GOV-36). Avoid: API-first complexity for a static reviewer-internal site. Fit: data model lesson fits; live API does not (option (c) rejected).
  - Granicus / govMeetings — meeting agendas, minutes, video, timestamps. Lesson: timestamped source anchors into meeting video/minutes (drives locator_kind/timestamp_human in the drawer). Avoid: portal lock-in / opaque sources. Fit: meeting+timestamp model fits Alpine meeting records.
- Lessons GOV should use: drill-to-source on every card; stable chronology; typed/separate concepts; timestamped/locator-anchored evidence.
- Patterns GOV should avoid: hiding provenance, federal-scale taxonomy, live-API complexity at this stage, portal lock-in.
- Source links:
  - https://www.documentcloud.org/
  - https://substack.govtrack.us/about
  - https://docs.openstates.org/api-v3/
  - https://granicus.com/solution/govmeetings

### Tradeoffs
- Main tradeoffs: committed fixture (simple, low attack surface, reuses lane gate) vs live endpoint (fresher, but new network/auth/public-projection risk); flat card feed (simple to render) vs concept-map integrity (cards are presentation nodes, not source of truth — GOV-36); AI summarization vs human verification (AI is always gated/labeled, never verified-by-default).
- Chosen approach and reason: committed reviewer-internal fixture (option (a)) — lowest new attack surface, reuses the GOV-314 lane gate, no public projection, mirrors the proven src/fixtures pattern.

### Plan Before Implementation
- Concept/data model: GOV-347 card-feed envelope (present card + source_missing card); cards are presentation nodes over the backend concept map (GOV-36), not the source of truth.
- UI/operator behavior: §2 field→component map, §3 status→UI map, §4 states, §5 reviewer-internal invariant — all over the existing timeline.ts/render.ts/statement-presenter.ts surface.
- Verification commands or review steps: npm test (full suite incl. a new card-feed adapter test + web-safe sweep + reviewer-internal lane test); npm run build / tsc; 3-viewport browser capture.
- Artifact paths: docs/stage3-06-card-feed-frontend-contract.md (this doc); GOV-354 → src/fixtures/alpine-card-feed.json + a card-feed adapter module + tests.
- Failure handling: assertWebSafe fails loud on any raw path; unknown status → least-trusted tone (fail-closed); live-read failure → labeled fixture + notice.

### Source and Auditability
- Required source fields (per card): final_url (original), locator_kind + timestamp_human/page/section (locator), relation; jurisdiction; status; confidence_label; provenance_status. No orphan claims.
- Local source-data paths: reviewer-internal fixture captured from the real Alpine corpus (TOA Alpine evidence base / backend operational DB); raw paths never cross the web-safe boundary.
- Archive/Wayback/timestamp/page requirements: archive row always visible ("Archive not available" until the envelope carries it); page/section/timestamp surfaced as the locator when present.
- Verification/correction status handling: status consumed verbatim; corrections link forward; disputed/source_changed are bounded gaps (not fabricated).

### Timeline and Concept Integrity
- Known-then vs later-outcome handling: chronological order via date; later outcomes/corrections link forward (typed) and never rewrite prior cards.
- Correction handling: only explicit backend `type: correction` cards render a correction; forward-linked, never an edit-in-place.
- Concept records kept separate: jurisdictions, bodies, meetings, agenda items, documents/sources, people/roles, topics, statements, decisions, outcomes, evidence links, and website cards stay distinct (GOV-36); cards are presentation nodes only.
- Required typed relationships: source supports card; later outcome updates prior event; document supersedes/amends prior (existing edgeTypeLabel: Supersedes/Amends/Revisits/In thread/Rolls up to).

### Acceptance Evidence
- Required artifacts: this contract doc; GOV-354 fixture + adapter + tests.
- Required tests/checks: full npm test suite green; tsc/build clean; web-safe sweep on the new fixture; reviewer-internal lane = N cards while public lane = 0 cards.
- Required issue/PR/screenshot/API/source evidence: GOV-354 PR link, test output, and the 3-viewport screenshot floor (desktop 1440×900 + tablet 768×1024 + mobile 390×844).
```

### 6.1 Text-only interaction sketch (reviewer-internal Alpine card feed)

```
┌───────────────────────────────────────────────────────────────┐
│ ⚠ FIXTURE MODE — Reviewer-internal offline snapshot, not live   │
├───────────────────────────────────────────────────────────────┤
│ ▸ Trust & AI legend   (tap to open — explains every badge)      │
│                                                                 │
│ ╭─ Completeness gaps ─────────────────────────────────────────╮ │
│ │  N Alpine meeting(s) still lack a primary source            │ │
│ │  [no_primary_source ⊙12] [stale_source ⊙3] …                │ │
│ │  ▸ Meetings lacking a primary source (N)  (tap to open)      │ │
│ ╰─────────────────────────────────────────────────────────────╯ │
│                                                                 │
│  Year │ Month │ Day        ╭─ card ─────────────────────────╮  │
│  2024 │  Mar  │  12   ◀──── │ 🗣 Statement  [Source-backed]    │  │
│  2023 │  Feb  │  04        │ [✓ Audit-passed]                │  │
│       │       │            │ Title of the record             │  │
│       │       │            │ Speaker: Name, Role             │  │
│       │       │            │ Confidence: Source-anchored     │  │
│       │       │            │ [ Reveal details ]   ← blurred  │  │
│       │       │            │   reviewed_summary (gated)      │  │
│       │       │            │   ▸ Sources (2)  → drawer       │  │
│       │       │            ╰─────────────────────────────────╯  │
│                            ╭─ card ─────────────────────────╮  │
│                            │ 🤖 AI presented  [Unverified]   │  │
│                            │ [AI analysis — not verified]    │  │
│                            │ …gated AI body behind reveal…   │  │
│                            ╰─────────────────────────────────╯  │
└───────────────────────────────────────────────────────────────┘
Public lane (access ≠ reviewer_internal): 0 cards, no reviewed_summary/
speaker_label/provenance_status anywhere in the DOM.
```

### 6.2 UI viewport evidence floor (named, required at GOV-354 closeout)

- **Desktop:** 1440×900
- **Tablet:** 768×1024
- **Mobile:** 390×844

A `Pass` for this responsive surface requires desktop + tablet + mobile evidence (or an explicit
issue-level exception naming the missing class, reason, and next owner).

### 6.3 Owner / design review points

- **UXProductDesigner** — resident-comprehension + label legibility / tap-reachability review
  (badge legibility, legend reachability, mobile drawer, locked AI label).
- **Isaac** — design/visual review is a **separate slice-level gate before any public surface**;
  this doc is reviewer-internal and unlocks no public launch.

---

## 7. Non-unlock / pass-up

This doc unlocks nothing. Any discovered need for **public launch / public projection**, a live
gated endpoint, **legal/privacy/publication judgment**, **budget**, **official-contact automation**,
or **scope beyond Alpine** → STOP, comment, escalate to CEO/Isaac.

## 8. Review lane

`Impl(Plan)` → **VSR** leg → **SecPriv** leg → **CTO non-author merge**. At merge the CTO applies the
§6 premium block to goal `eac4a8db`, records evidence, and **leaves `eac4a8db` OPEN** — it flips to
*achieved* only at the GOV-354 implementation merge (mirror of GOV-346).

---

*Related records:* GOV-352 (parent dispatch) · GOV-347/#63 (backend card-feed envelope) · GOV-354
(implementation child) · GOV-346 (mirrored contract→premium→impl shape) · GOV-314/#16 (provenance
badge + reviewer-internal lane gate) · GOV-301 (completeness-gap card) · GOV-293 (confidence/speaker/
citation) · GOV-153/205/257 (timeline, cards, source drawer, gated blocks) · GOV-36 (concept
separation + typed links).
