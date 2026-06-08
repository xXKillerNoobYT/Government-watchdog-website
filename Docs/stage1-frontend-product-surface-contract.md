# Stage 1.06 — Alpine Frontend / Product Surface Contract

- **Stage:** Stage 1.06 — Frontend/product surface contract (Alpine-first).
- **Goal:** `0d2e317f-a4d0-4997-96fe-55bcd9ae9f0d` — Stage 1.06 — Frontend/product surface contract.
- **Issue:** GOV-35.
- **Owner:** FrontendTimelineEngineer. Review: CTO (architecture/contract readiness); VerificationSafetyReviewer + SecurityPrivacyAgent (any public/private/label/access boundary); UXProductDesigner (surface/UX patterns).
- **Project/repo:** Government Watchdog Website / `xXKillerNoobYT/Government-watchdog-website`.
- **Predecessor:** GOV-34 (Stage 1.05 backend/tooling implementation contract, `done`).
- **Status of this document:** Specification / contract only. **Not implementation.** No code is shipped, no data is published, scope is Alpine-only.
- **Date:** 2026-06-07.

> This is the website-side counterpart to the GOV-34 backend contract. It defines *what the Alpine civic-timeline product surface must do* — pages, cards, drawers, labels, filters, states, evidence layers, and the backend↔frontend handoff — as **testable behavior statements** that a later implementation issue (and a reviewer) can verify against the running site and the committed fixtures.

---

## 0. How to read this contract

- Every requirement is a numbered behavior statement: `BEH-<area>-<n>`. Each is written to be **checkable** against either the running page, the committed `data/*.json` fixtures, or `app.js`.
- Each area lists **happy-path** behavior and **negative / adversarial civic cases** (missing page, changed page, duplicate source, ambiguous name, broken archive, private data, unsupported claim, stale output). A surface is not contract-complete until its negative cases are specified.
- "Must" = required for any card/page to ship. "Should" = strong default, deviation requires a recorded reason. "Later-gated" = planned, blocked until a named gate passes.
- This contract **builds forward on** existing accepted artifacts (see §1 backward check). Where it restates a prior rule it cites the source; it does not contradict prior accepted work. Where it finds a gap it records it (see §10 mismatches) rather than silently resolving it.

---

## 1. Required backward check (prior work reviewed)

Per the GOV-35 required backward check, the following prior goals/artifacts were read and are inherited as accepted constraints. This contract builds on them; it does not restart or contradict them.

| Artifact (in this repo unless noted) | Inherited decision used here |
|---|---|
| `Docs/gov-5-card-status-visual-system.md` | The 10-state card status/trust label vocabulary, color/icon system, progress chips, source-confidence strip, and caution-block pattern. Adopted verbatim in §4. |
| `Docs/gov-48-alpine-timeline-card-source-drawer-spec.md` | Universal card anatomy and the 13 required source-drawer fields, empty/loading/error states, mobile full-screen sheet behavior. Adopted in §5–§6. |
| `Docs/gov-67-trust-notices-correction-safety-review.md` | Trust-notice / correction labeling rules and required private-review warning text. Adopted in §4.4 and §8. |
| `Docs/gov-78-stage-1-rebaseline-acceptance-rubric.md` | The 10 Stage-1 rubric areas and no-go conditions. This contract is written to satisfy them; mapped in §12. |
| `Docs/gov-51-...-verification-safety-review.md`, `Docs/gov-69-...-walkthrough-review-script.md` | Evidence-layer handling (known-then / presented-then / ai-thought-then / corrected-later / actual-later), speaker-attribution safety, private-review-only boundaries. Adopted in §7 and §8. |
| `Docs/stage3-alpine-timeline-card-mvp-plan.md`, `Docs/stage4-...-newsletter-backbone-plan.md` | Timeline MVP and newsletter backbone plans. Page inventory in §3 stays consistent with these. |
| `data/alpine-concept-map.cards.json` (`schemaVersion: gov-watchdog-card-map.v1`) | The live card/source handoff shape consumed by `app.js`. Treated as the operative frontend-input contract in §9. |
| `data/alpine-newsletter-items.json`, `data/alpine-private-walkthrough-readiness.json` | Newsletter-item and walkthrough-readiness shapes. Referenced in §3.6 and §9. |
| `app.js` (1037 lines), `index.html`, `styles.css` | The current Alpine walkthrough scaffold that already implements jurisdiction lock, status mapping, gating, source drawer, and fixture fallback. This contract codifies the behavior it already exhibits and names the gaps. |
| GOV-34 issue record (Stage 1.05 backend/tooling contract, `done`) | Backend produces source-traceable, publication-gated records; AI fields kept separate; APIs expose only approved/gated records. Consumed in §9; mismatches recorded in §10. |
| Company workflow files (`BACKEND_FRONTEND_EVIDENCE_WORKFLOW`, `AI_GATEWAY_PROCESSING_WORKFLOW`, `RISK_ASSESSMENT_WORKFLOW`, `GATED_BETA_ACCESS_WORKFLOW`, `WORKFLOW_GOVERNANCE`) | No orphan claims; AI ≠ primary evidence; gated beta; privacy no-go rules. Enforced throughout, summarized in §8 and §11. |

**Gaps / contradictions found during the backward check:** see §10. The most material is a **status-vocabulary mismatch**: the gov-5 UI defines 10 status labels, but the `gov-watchdog-card-map.v1` `verificationStatus` field carries only 5 enum values, with the remaining UI states derived in `app.js` from `card.type` and `correctionStatus`. This is recorded as a backend-contract alignment item, not silently resolved.

**No contradictions** were found that block this contract; all inherited rules are compatible. Scope stayed planning-only and Alpine-only.

---

## 2. Product framing (success / failure)

**What this product surface is:** a private, reviewer-facing Alpine civic timeline that shows, for every meaningful claim, *what happened, what was known then, what was presented then, what AI interpreted then, what was corrected later, what actually happened later,* and the full source/verification trail — with AI/unverified/disputed/corrected/source-changed content always visibly labeled and gated, and nothing published publicly until gates pass.

**Success definition (this contract):**
- A reviewer can open the site, see Alpine timeline cards newest-first, read each card's status label without interaction, open every card's source drawer to its full evidence trail, filter by time/body/topic/source-type/verification, and never encounter a claim without a source row or an unlabeled AI/unverified item.
- Every behavior statement below is verifiable against the running page, the committed fixtures, or `app.js`.

**Failure definition (this contract):** any of — a card renders without a visible status label; a claim appears with no source-drawer row (orphan claim); AI/unverified/disputed content reads as verified fact; a private/raw path or private identity leaks to a surface; a non-Alpine record displays; a publication/email/public-export action is reachable without the gate; the site silently shows stale or partial data as if complete.

---

## 3. Surface inventory (pages / views)

The Alpine presentation is a small set of surfaces. Each is **reviewer/internal** today; a **public** variant is later-gated behind GATED_BETA_ACCESS + a CEO/VerificationSafetyReviewer publication gate.

| Surface | Reviewer/internal view (active now) | Public view (later-gated) |
|---|---|---|
| 3.1 Timeline (home) | Newest-first Alpine card feed with filters and per-card source drawer. Default landing (`activePage: "timeline"`). | Gated; only approved (`publicExportApproved: true`) cards, with all labels intact. |
| 3.2 Card detail / source drawer | Drawer/sheet exposing the full 13-field source trail per card. | Same drawer, approved cards only, raw/local paths stripped. |
| 3.3 Topic view | Timeline filtered to one topic (`topicIds`). | Gated. |
| 3.4 Body / meeting view | Cards grouped by government body / meeting. | Gated. |
| 3.5 Trust / status legend | Static explainer of every status label and what it means. | Public-safe; ships with the public view. |
| 3.6 Newsletter / digest archive | Reviewer view of `alpine-newsletter-items.json` digests with per-item source trail and lens labels. **No send action.** | Later-gated (Stage 4 newsletter gate + publication gate). |
| 3.7 Access-state surfaces | Gated-beta states: not-signed-in, waitlisted, pending review, approved, denied/needs-info, revoked. | Required before any public/beta exposure. |
| 3.8 Empty / loading / error surfaces | First-class states for no-data, partial-data, broken-archive, failed-fetch, fixture-mode. | Same. |

**Reviewer vs public difference (the core rule):** the reviewer/internal view may show gated cards *with their gate labels and caution blocks visible*; the public view may show **only** records whose backend state is approved-for-public **and** whose source trail is complete. Visual polish must never imply verification (BEH-LABEL-1).

### Negative / adversarial surface cases
- **BEH-SURF-N1 (missing page):** Requesting a topic/body/meeting that has no cards must render the empty state (§8) with the active filter echoed, not a blank screen or a 404 that loses context.
- **BEH-SURF-N2 (stale output):** If the loaded feed's `scope.generatedUtc` is older than a configured freshness window, the surface must show a "data as of `<generatedUtc>`" notice; it must never present stale data as live/complete.
- **BEH-SURF-N3 (private data):** No surface may expose a `localSourcePath`, vault path, raw hash, private identity, address, or voter/account data. Drawer uses `sourceRegistryId` (safe ID) only.

---

## 4. Trust / status label system

Adopted from `gov-5-card-status-visual-system.md`. These are the **only** sanctioned status labels; implementation must use the exact text (no paraphrasing).

### 4.1 Status labels (always visible, never hover-only)

| UI status key | Exact badge text | Color | Icon | Meaning |
|---|---|---|---|---|
| `verified` | `Verified` | `#1F7A4D` | ✓ | Supported by reviewed source evidence |
| `source-backed` | `Source-backed` | `#2F6F73` | ◐ | Source exists; interpretation reasonably open |
| `ai-presented` | `AI-generated — not independently verified` | `#6B4BA1` | ✨ | Generated from records, not verified |
| `unverified` | `Unverified` | `#9A6A00` | ? | Not enough source support yet |
| `needs-clarification` | `Needs clarification` | `#8A5A2B` | ! | Record incomplete; needs official source |
| `disputed` | `Disputed` | `#A33A3A` | ⚠ | Sources/validators conflict |
| `corrected` | `Corrected` | `#B05C00` | ↺ | Updated after correction; original preserved |
| `source-changed` | `Source changed` | `#6C5B00` | Δ | Original source replaced/moved/changed |
| `source-missing` | `Source missing` | `#7A4E2B` | ⧉ | Original public source unavailable |
| `do-not-publish` | `Do not publish` | `#3F3F46` | ⛔ | Private/sensitive/unsupported; never on public |

- **BEH-LABEL-1:** Every card must render exactly one status badge, visible without scrolling or hover, on both desktop and a 375px mobile viewport. Visual styling must never substitute for the label (no "looks verified" without the word).
- **BEH-LABEL-2:** The badge text must match this table character-for-character. A reviewer comparing rendered text to this table finds no paraphrase.
- **BEH-LABEL-3 (adversarial — unsupported claim):** A card whose backing record has no reviewed source must never resolve to `verified`. It resolves to `unverified` (default), `ai-presented`, `source-missing`, or `do-not-publish` per its data.

### 4.2 Progress / presentation chips (do NOT replace status)
`Ready`, `Needs source`, `Needs timestamp`, `Needs review`, `Design review`, `Backfill continuing`. These show *work state* and may appear alongside a status badge but never instead of it (BEH-LABEL-4).

### 4.3 Source-confidence strip (beside badge, not replacing it)
`Strong source trail` / `Basic source trail` / `Archive/local trail` / `Source gap`. Derived from source count + authority + archive state (BEH-LABEL-5).

### 4.4 Caution blocks (gated content)
For `ai-presented`, `unverified`, `needs-clarification`, `disputed`, `corrected`, `source-changed`, `source-missing`, `do-not-publish`:
- **BEH-GATE-1:** Default collapsed. Status badge + source strip visible; the source drawer remains reachable without expanding. Detail body hidden until an intentional expand action.
- **BEH-GATE-2:** Expand control uses explicit acknowledgement copy, e.g. `I understand this is AI-presented — show details`, `Show correction history`, `Show source-change trail`.
- **BEH-GATE-3 (required warning text, from gov-67):** source-change, hot-topic, and correction notices must carry their exact private-review warning text; "review priority is not verification"; correction notices state the original context is preserved.

---

## 5. Card contract

### 5.1 Universal card anatomy (from gov-48)
Type marker (emoji/icon + text + hover explanation), title (≤80 chars, plain English, no pipeline jargon), event/record date (not crawl date), status badge (§4.1, always visible), 1–2 sentence resident-readable summary, source-confidence strip, 1–3 topic tags, related-concept links (meeting / agenda item / source / topic / decision / correction / later outcome), actions (`View source trail`, `Open source moment`, `Show caution details`, `Show correction history`).

- **BEH-CARD-1:** Cards render newest-first by `timelineDate` by default.
- **BEH-CARD-2:** Every card with a backing source exposes a visible source-drawer trigger.
- **BEH-CARD-3 (no orphan claims):** A card may not display a claim/summary unless it has at least one source-drawer row **or** carries a status that makes the absence explicit (`source-missing`, `unverified`, `do-not-publish`). There is no silent claim-without-source.
- **BEH-CARD-4 (stub):** `stub`/grey cards are internal-only and never appear in any public view.

### 5.2 Card states required before any card ships
`verified`, `ai-presented` (`AI-generated — not independently verified`), `disputed` (both source links visible), `corrected` (link to correction card), plus the gov-5 extensions (`source-backed`, `unverified`, `needs-clarification`, `source-changed`, `source-missing`, `do-not-publish`) and `stub`. A card component is not done until each state has a fixture and renders correctly (BEH-CARD-5).

### 5.3 Negative / adversarial card cases
- **BEH-CARD-N1 (ambiguous name / speaker):** A transcript-derived statement must not display a speaker name unless reviewed minutes/transcript support it. Otherwise it carries `speaker_unidentified` and the card does not guess. *No name is better than wrong attribution.*
- **BEH-CARD-N2 (duplicate source):** When two cards reference the same `sourceRecordId`, the drawer shows the same registry ID; the UI must not present duplicates as independent corroboration.
- **BEH-CARD-N3 (stale output):** A card generated from a feed older than the freshness window shows the "as of `<generatedUtc>`" notice (BEH-SURF-N2) rather than implying currency.
- **BEH-CARD-N4 (unsupported claim):** see BEH-LABEL-3.

---

## 6. Source-drawer evidence contract (no orphan claims)

The drawer is the anti-orphan mechanism: every meaningful claim traces here. Adopted from gov-48. **All present fields must be visible when the drawer opens** (mobile: full-screen sheet, status repeated at top, sticky close, source actions before long audit notes).

### 6.1 Required drawer fields
1. Source type (plain-English label) 2. Published by (authority) 3. Jurisdiction (Wyoming › Lincoln County › Town of Alpine) 4. Event/publication date 5. Original URL (when public) 6. Archive URL **or** `Archive not available` (never fabricated) 7. Captured date (scan/fetch UTC) 8. Safe source reference (`sourceRegistryId`; **never** a raw/local path) 9. Timestamp/page/section locator 10. Verification status 11. Correction status 12. Reviewer/audit note 13. Related concepts (typed links).

- **BEH-DRAWER-1:** Opening a drawer on any sourced card shows fields 1–13 for each source where the field exists. A field that exists in data must not be hidden.
- **BEH-DRAWER-2 (broken archive):** When `archiveStatus` indicates no snapshot, the drawer shows `Archive not available` (or `Archive not available as of <date>`) as a visible row — it is never hidden and never replaced with a fabricated URL.
- **BEH-DRAWER-3 (source moment):** When a source has `deepLinkUrl`/`startSeconds`, an `Open source moment` action deep-links to the exact timestamp; absent that, the row shows the plain original URL.
- **BEH-DRAWER-4 (private data):** The drawer renders `sourceRegistryId`, never `localSourcePath`/vault path/raw hash. (BEH-SURF-N3.)
- **BEH-DRAWER-5 (empty / source gap):** A card with no drawer payload shows a `Source gap` placeholder and the card stays gated; the drawer trigger still exists and explains the gap rather than vanishing.
- **BEH-DRAWER-6 (failed fetch):** If the drawer payload fails to load, show a retryable error state in the drawer, not a closed/empty drawer that looks sourceless.
- **BEH-DRAWER-7 (verbatim vs paraphrase):** A quote in the drawer must be labeled verbatim or AI-paraphrased.

---

## 7. Evidence-layer surfacing (known-then → actual-later)

The product's signature: surface the time-layers **without rewriting prior context**. Layer is carried per card/record (`timelineLayer` ∈ `known_then | presented_then | ai_thought_then | corrected_later | actual_later`).

- **BEH-LAYER-1 (known-then):** Reviewed source-linked cards present what was known/presented at the record's date; their text is not edited when later facts arrive.
- **BEH-LAYER-2 (ai-thought-then):** Machine-labeled interpretations are private-review cards, never public claims, always gated (`ai-presented`), source-gap flagged for human review.
- **BEH-LAYER-3 (corrected-later):** A correction card **links back** to the known-then card; the older card preserves its original context; the newer card carries its own source drawer and date.
- **BEH-LAYER-4 (actual-later):** A later-outcome card links back to the older known-then card and does **not** rewrite what was known at the earlier date.
- **BEH-LAYER-5 (adversarial — changed page):** When a source's page changed after capture, the card carries `source-changed`, and the drawer lets the reviewer compare original URL / archive state / captured date before treating the item as stable; the prior known-then card is not retroactively altered.
- **BEH-LAYER-6 (concept separation):** Cards are presentation nodes over the concept graph (jurisdiction / body / meeting / agenda item / document-source / person-role / statement / vote / decision / topic / outcome). The card summary is **not** the source of truth; typed links connect concepts (per the June-6 concept-map directive, GOV-36).

---

## 8. Filters

Filters operate over the concept graph. Alpine scope is **locked**, not a user choice.

| Filter | Behavior | Source field |
|---|---|---|
| Jurisdiction | Locked to Alpine (state WY, county Lincoln, town Alpine). US/expansion option shown `locked`. | `jurisdictionId` |
| Time | Range/sort over `timelineDate`; newest-first default. | `timelineDate` |
| Body / meeting | Filter by government body / meeting node. | graph edge / `primaryNodeId` |
| Topic | Filter by topic tag. | `topicIds` |
| Source-type | Filter by source class (document, transcript, video, minutes, agenda, notice, news, archive). | source `sourceType` |
| Verification-status | Filter by status (§4.1). | derived UI status |

- **BEH-FILTER-1 (Alpine lock — happy path):** With no filter applied, the feed shows only `jurisdictionId === "jurisdiction:wy:town-of-alpine"` cards. The Alpine filter is the active default.
- **BEH-FILTER-2 (adversarial — non-Alpine record):** A feed item lacking the Alpine `jurisdictionId` is dropped from display and a warning is logged; it is never rendered.
- **BEH-FILTER-3 (expansion locked):** Selecting a non-Alpine jurisdiction is disabled/`locked`; it cannot load non-Alpine data. Expansion is later-gated only.
- **BEH-FILTER-4 (empty result):** A filter combination with no matches shows the empty state (§8 states) echoing the active filters, not a blank feed.
- **BEH-FILTER-5 (status filter integrity):** Filtering to `verified` must exclude `ai-presented`/`unverified`/`disputed`/`do-not-publish` cards; the filter must not leak gated content into a "verified" view.

> Implementation note (not a contract relaxation): the current `app.js` implements jurisdiction lock and topic filter; **time / body / source-type / verification-status filters are not yet implemented** and are required by this contract for the Stage-1 timeline deliverable. Recorded in §10 as a frontend implementation gap.

---

## 9. Empty / loading / error / access states

Each is a **first-class** state, not an afterthought (BACKEND_FRONTEND_EVIDENCE_WORKFLOW).

| State | Required behavior | ID |
|---|---|---|
| Loading | Skeleton/placeholder; never render partial cards as complete. | BEH-STATE-1 |
| Empty (no data) | "No Alpine records for this view" + active filter echo + how to clear. | BEH-STATE-2 |
| Partial data | Visible "partial / backfill continuing" notice; gaps shown as gaps, not hidden. | BEH-STATE-3 |
| Broken archive | `Archive not available` row in drawer (BEH-DRAWER-2). | BEH-STATE-4 |
| Failed fetch (feed) | Error banner + automatic fixture fallback with a visible `FIXTURE MODE — Not real data` banner. | BEH-STATE-5 |
| Failed fetch (drawer) | Retryable in-drawer error (BEH-DRAWER-6). | BEH-STATE-6 |
| Fixture mode | Visible fixture banner whenever fixture data is in use; fixtures are historical/sample only, never fabricated recent events. | BEH-STATE-7 |
| Publication-boundary violation | If a loaded feed lacks `publicExportApproved` discipline (e.g. a "public" feed with `false`), refuse to render it as public and surface the boundary error. | BEH-STATE-8 |

### Gated-beta access states (GATED_BETA_ACCESS_WORKFLOW, later-gated UI)
- **BEH-ACCESS-1:** The product defines distinct surfaces for not-signed-in, waitlisted, pending-review, approved, denied/needs-info, revoked/disabled.
- **BEH-ACCESS-2:** Civic evidence dashboards, community validation, newsletters, and sensitive analysis are **not** shown to unauthenticated/unapproved users.
- **BEH-ACCESS-3:** Waitlist denial copy must not imply anything about civic standing; messaging explains access is controlled for quality/safety/source-review integrity.
- **BEH-ACCESS-4:** Account validation state is kept separate from civic-claim verification state (they are different vocabularies and must not be conflated in UI).

---

## 10. Backend ↔ frontend handoff consumption (GOV-34) + mismatches

The frontend consumes the GOV-34 backend handoff. The operative input shape in this repo is `gov-watchdog-card-map.v1` (`data/alpine-concept-map.cards.json`), with sibling feeds `gov-watchdog-newsletter-items.v1` and `gov-watchdog-private-walkthrough-readiness.v1`.

### 10.1 Consumed shape (input contract)
- **Feed envelope:** `schemaVersion`, `feedId`, `scope { jurisdictionId, stage, generatedUtc, reviewLane, publicExportApproved, scopeNote }`, `nodes[]`, `edges[]`, `cards[]`.
- **Card:** `id`, `type`, `title`, `dek`, `primaryNodeId`, `timelineDate`, `jurisdictionId`, `topicIds[]`, `statusLabel`, `verificationStatus`, `correctionStatus`, `publicExportApproved`, `sourceCount`, `claimSummary`, `sourceDrawer { drawerTitle, sources[] }`, `noticeBlocks[]`, `trustState`, `links[]`.
- **Source:** `sourceRecordId`, `sourceType`, `title`, `url`, `deepLinkUrl`, `archiveUrl`, `scanOrFetchUtc`, `sourceRegistryId`, `sourceAuthorityLevel`, `archiveStatus`, `verificationStatus`, `correctionStatus`, `citationNote`, `transcriptSegmentId`, `transcriptStatementId`, `startSeconds`, `endSeconds`.

### 10.2 Frontend consumption rules
- **BEH-HANDOFF-1:** The frontend validates `scope.jurisdictionId === "jurisdiction:wy:town-of-alpine"` before rendering a feed; a non-Alpine feed is rejected.
- **BEH-HANDOFF-2:** The frontend treats `publicExportApproved: false` as private-review-only; it never derives a public claim from such a feed/card.
- **BEH-HANDOFF-3:** AI-only/unverified/disputed/private fields may not be promoted to a public claim (BACKEND_FRONTEND_EVIDENCE_WORKFLOW handoff rule).
- **BEH-HANDOFF-4:** Source-backed fields and AI/generated fields are rendered in distinct regions; the drawer keeps `verificationStatus`/`correctionStatus` adjacent to each source.

### 10.3 Recorded mismatches / gaps (AC #4)
1. **Status-vocabulary mismatch (backend-contract alignment item).** gov-5 UI defines **10** status states; `verificationStatus` in `gov-watchdog-card-map.v1` enumerates **5** (`reviewed_source_linked`, `machine_extracted_unreviewed`, `disputed`, `do_not_publish`, `source_changed`). The remaining UI states (`source-backed`, `unverified`, `needs-clarification`, `corrected`, `source-missing`) are derived in `app.js` from `card.type` + `correctionStatus` rather than from a single typed field. **Recommendation:** the backend handoff contract should define one explicit, typed `uiStatus`/verification vocabulary (or a documented mapping table) so the frontend does not infer status from `type`. → raise as a backend-contract patch / blocker against the GOV-34 contract (owner: BackendCrawlerEngineer + CTO). *No data is invented by the frontend in the meantime; the derivation in `app.js` is documented, not authoritative.*
2. **Filter coverage gap (frontend implementation, not a contract conflict).** Time / body / source-type / verification-status filters required by §8 are not yet implemented in `app.js` (only jurisdiction lock + topic). → carry into the Stage-1 timeline implementation issue, not a backend mismatch.
3. **Layer-field naming.** This contract names the evidence layer `timelineLayer`; fixtures use `timelineLayer`/`timeline layer` semantics inconsistently across feeds. → confirm a single field name with backend during implementation; low risk.

These are recorded here and will be mirrored in the GOV-35 closeout comment. Items (1) is a backend-contract alignment item to be raised as a blocker/patch; (2) and (3) are frontend/implementation follow-ups for Stage 1.07+.

---

## 11. Privacy / safety constraints (RISK_ASSESSMENT + non-negotiables)

- **BEH-SAFE-1:** No private identity, address, contact data, minors, private parcel-owner info, voter/account-validation data, raw vault paths, or raw hashes appear in any surface spec'd here. Drawer uses safe `sourceRegistryId` only.
- **BEH-SAFE-2:** Publication remains gated; no public launch, email/newsletter send, public correction record, or public export is reachable from these surfaces without the CEO/VerificationSafetyReviewer publication gate.
- **BEH-SAFE-3:** No accusation/motive/legal conclusion copy; civic framing stays neutral and source-grounded (gov-78 rubric area 10).
- **BEH-SAFE-4:** AI output is never primary evidence; every AI item points back to `sourceRecordId`/citation or is labeled `ai-presented` / `do-not-publish` (AI_GATEWAY_PROCESSING_WORKFLOW).
- **BEH-SAFE-5:** Discovery that would change safety/privacy/publication/access/traceability rules **pauses work** pending CEO/CTO/reviewer acceptance.

---

## 12. Premium success-criteria posture (GOV-38) & rubric mapping

| GOV-38 / gov-78 criterion | Where addressed |
|---|---|
| Success / failure definition | §2 |
| Workability | §3 inventory + §9 states (every state has defined behavior) |
| Ease of use | §5 card anatomy, §6 drawer, mobile rules (full-screen sheet) |
| Comparable-tool research | §13 (timeline, cards, source-drawer, civic-board patterns) |
| Pros / cons / tradeoffs | §13 |
| Source / auditability | §6 drawer (13 fields, no orphan claims), §11 |
| Concept separation + typed links | §7 BEH-LAYER-6 |
| Verification artifacts | this contract + fixtures + screenshots required at implementation |
| Owner / design review points | §14 |
| Alpine scope / no-go | §8 filters, §11, §10 mismatches |

Rubric areas 1–10 (gov-78) are each satisfied: 1 Alpine scope (§8, §11) · 2 claim inventory (§5 BEH-CARD-3) · 3 source trail (§6) · 4 raw preservation (backend; drawer never shows raw) · 5 reproducibility (fixtures + handoff §10) · 6 confidence labels visible at point of use (§4) · 7 timeline integrity (§7) · 8 concept separation (§7 BEH-LAYER-6) · 9 privacy (§11) · 10 civic framing (§11 BEH-SAFE-3).

---

## 13. Comparable-tool research (per GOV-38, section-specific)

- **Timeline:** chronology tools (e.g. TimelineJS-style, news "what we know so far" trackers, court/incident timelines). *Pro:* newest-first + per-event sourcing fits civic records; *con:* most do not separate known-then vs corrected-later — our evidence-layer model (§7) is the differentiator. *Tradeoff:* layer separation adds card volume; mitigated by gating/collapse.
- **Cards + source drawers:** progressive-disclosure card UIs (knowledge panels, fact-check cards). *Pro:* drawer keeps claim readable while making evidence one tap away; *con:* easy to let polish imply trust — countered by BEH-LABEL-1.
- **Status/label systems:** fact-checker rating scales (verified/disputed/false). *Pro:* familiar; *con:* civic data needs more states (source-changed, source-missing, do-not-publish) — hence the 10-state system.
- **Civic/issue board (later):** once Alpine is caught up to current date, plan a board for upcoming meetings, active issues, pending/decided items, follow-ups, corrections — *gated, no unsupported claims* (FRONTEND_TIMELINE_WORKFLOWS June-6 directive). Out of scope to build now; noted for sequencing.

---

## 14. Owner / design / review points

- **UXProductDesigner:** confirm card anatomy, drawer layout, mobile sheet, and label legibility against this contract.
- **VerificationSafetyReviewer + SecurityPrivacyAgent:** confirm label visibility, gating, and that no private/raw data path is reachable, before any semi-public review.
- **CTO:** confirm the handoff input contract (§10) and approve raising the status-vocabulary mismatch as a backend-contract patch.
- **CEO:** sequences Stage 1.07; owns any stage-order/scope change.
- **Isaac (owner):** any publication, legal/privacy, official-contact, campaign, or budget decision.

---

## 15. Next-unlock recommendation

- **Recommended next:** Stage 1.07 — **Transcript / evidence / statement model** (the typed record model behind statements, speaker-attribution safety, and the source/citation targets the drawer consumes).
- **Blocker needed?** No hard blocker on Stage 1.07 planning from this contract. Stage 1.07 is the natural sequential successor and can begin as a planning/spec issue once GOV-35 is accepted by CTO.
- **One backend-contract follow-up to raise (not a Stage-1.07 blocker):** the §10.3(1) status-vocabulary alignment item — route to BackendCrawlerEngineer/CTO as a GOV-34 backend-contract patch so frontend status is read from a typed field rather than inferred from `card.type`.

---

*Scope statement: this document is planning/specification only. No website code was shipped, no data was published, no public surface or API claim was exposed, no officials were contacted, and scope remained Town-of-Alpine only.*
