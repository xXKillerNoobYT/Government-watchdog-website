# Stage 4.06 — Gated reviewer-internal Alpine newsletter archive/detail frontend contract

> **Issue:** GOV-461 (Stage 4.06 · CTO-orchestrated, FrontendTimelineEngineer impl, UXProductDesigner consulted).
> **Repo:** `Government-watchdog-website` (Vite/TS) — `main` is the integrated canonical surface.
> **Renders:** the Stage 4.05 deterministic digest object (`scripts/stage4_newsletter_digest_assembler.py::assemble_digests`,
> backend remote `origin/main` PR #79 / `cf61ea5`). **Consumes verbatim — never recomputes.**
> **Scope (hard):** Town of Alpine only · reviewer-internal · behind the existing gated-beta gate (GOV-418/419) ·
> **no public launch · no email/sender · no real auth/signup · no person-naming · no new labels · no editorial prose.**
> Public deploy stays GOV-420 / Isaac-gated. Editorial voice/summarization is 4.08 (separately gated) — not here.

This contract pins the **frontend/product surface**: a gated archive-list route that lists digests by Alpine coverage
period, and a digest-detail route that renders every required GOV-15 template section from one digest object. It mirrors
the 4.03–4.05 backend chain (`contract → impl → review gate`) on the website repo. A contract defines the shape; it does
not satisfy it — impl + tests land in GOV-461's impl child.

---

## 0. What this slice owns, and what it must not touch

**Owns:** two new hash routes + their components, the data-binding from the digest object to the GOV-15 sections, the
`claimStatus → existing-tone` rendering map (zero new labels), and gated-beta enforcement on both routes.

**Must NOT touch / re-derive (carry Stage 3/4 forward):**
- the digest object shape — **consumed verbatim** from the 4.05 assembler. The frontend never re-partitions, re-sorts,
  re-classifies a section, or rebuilds `sourceTrail`. Sections are id-lists/aggregates; rendering resolves ids back to
  the embedded `items[]`.
- `src/gate/access.ts` — **reused, 0-diff**: `resolveAccess` / `isApproved` / `ACCESS_STATES` are the single source of
  truth for who may see civic data. The archive routes gate identically to `#/app`.
- the existing label/tone layer (`src/ui/state-view.ts` `statusTone` / `uiStatusLabel`, `src/ui/legend.ts`) — **reused**:
  the `claimStatus` map (§4) routes to existing tones; **zero new badges, zero new label strings**.
- the two hard invariants (README §"two hard invariants"): no raw-path field is ever named on the type surface
  (`assertWebSafe` re-sweep applies), and the frontend never recomputes trust. A need to recompute is a pass-up trigger.

---

## 1. Data source & web-safe type surface

The digest object is read through the **same data-access pattern** as the existing app: live reviewer-internal read-API
when wired, else the labeled fixture fallback (`src/data/client.ts` precedent). For this slice the digest object is
delivered as a **labeled fixture** captured from a real `assemble_digests(...)` run (mirrors `test/read-api-sample.json`),
because no live digest endpoint is wired yet — that is a later backend slice, not 4.06.

Add web-safe TypeScript types mirroring the 4.05 object **exactly** (new file `src/types/newsletter-digest.ts`):

```ts
// Mirrors stage4-05-newsletter-digest-assembler-contract §3. Web-safe ONLY:
// localSourcePath is always null on the wire; no transcript_path/deep_link/etc.
export interface NewsletterDigestResponse {
  scope: 'alpine' | (string & {});
  access: 'reviewer_internal' | (string & {});   // NEVER 'public'
  digests: NewsletterDigest[];
}
export interface NewsletterDigest {
  newsletterId: string;                            // 'alpine-historical-YYYY-WW' | 'alpine-historical-undated'
  coveragePeriod: { startDate: string; endDate: string } | null;
  items: NewsletterItem[];                         // carried verbatim from the feed
  sections: DigestSections;
}
export interface DigestSections {
  processedRecords: { count: number; itemIds: string[] };
  sourceSetProgress: {
    sourceCategoriesReviewed: string[];
    chronologicalRange: { oldest: string; newest: string } | null;
    orderingPreserved: string;                     // e.g. 'oldest_to_newest'
    knownGaps: unknown[];                          // carried verbatim from build_readiness_record
    completionFraming: string;
  };
  timelineChunks: string[];
  keyMeetings: string[];
  keyDocuments: string[];
  topics: string[];
  corrections: string[];
  conflicts: string[];
  laterOutcomes: string[];
  unverifiedItems: string[];
  sourceTrail: SourceTrailEntry[];                 // deduped by sourceId, carried unchanged
}
export interface NewsletterItem {
  id: string;                                      // 'alpine-newsletter-item-NNN'
  itemType: NewsletterItemType;
  jurisdiction: { state: string; county: string; town: string };
  recordDate: string;
  coveragePeriod: { startDate: string; endDate: string } | null;
  topicIds: string[]; cardIds: string[]; meetingIds: string[]; sourceIds: string[];
  status: string;
  labels: ItemLabels;
  links: { timelineUrl: string; [k: string]: string };   // reviewer-internal '/alpine/...' routes only
  sourceTrail: SourceTrailEntry[];
  newsletterId: string;
  summary?: string;                                // reviewer-internal free text (NOT editorial AI prose)
  title?: string;
}
export interface ItemLabels {
  claimStatus: ClaimStatus;                        // STAGE3_CLAIM_VOCAB — consumed verbatim
  aiPresented: boolean;
  speakerStatus: string;                           // e.g. 'speaker_unidentified'
  correctionStatus: string;                        // 'none' | ...
  publicationStatus: string;                       // e.g. draft — NEVER rendered as "published"
}
export interface SourceTrailEntry {
  sourceId: string;
  sourceType?: string | null; authorityLevel?: string | null;
  originalUrl?: string | null; archiveUrl?: string | null; scanDate?: string | null;
  localSourcePath: null;                           // ALWAYS null — invariant, asserted by web-safe sweep
  timestampSeconds?: number | null; page?: number | null; section?: string | null;
  verificationStatus?: string | null;
}
export type NewsletterItemType =
  | 'processed_records' | 'timeline_chunk' | 'meeting' | 'document' | 'topic'
  | 'source_link' | 'correction' | 'conflict' | 'later_outcome'
  | 'unverified_item' | 'ai_presented_context';
export type ClaimStatus =
  | 'verified' | 'unverified' | 'ai_presented' | 'disputed' | 'corrected'
  | 'source_changed' | 'source_missing' | 'speaker_unidentified' | 'needs_human_review';
```

`ClaimStatus` and `NewsletterItemType` are the **frozen Stage-3/4 vocabularies** (`STAGE3_CLAIM_VOCAB`,
`ALLOWED_ITEM_TYPES`). The zero-new-label acceptance check (EG-7) is a diff of the rendered label set vs these unions == 0.
The existing `assertWebSafe`/`RAW_PATH_FORBIDDEN_KEYS` sweep (`src/data/web-safe.ts`) MUST run over the digest fixture on
load, exactly as it does for read-API payloads — `localSourcePath` is always `null`, no raw key may appear.

---

## 2. Routes (hash-router; reuse `src/router.ts`)

| Route | Hash | Renders |
|---|---|---|
| Archive list | `#/newsletter` | List of digests for the Alpine coverage periods (newsletterId + coveragePeriod + processed-record count + a per-digest label-state summary). Each row links to the detail route. |
| Digest detail | `#/newsletter/:newsletterId` (e.g. `#/newsletter?id=alpine-historical-2026-19`) | One digest rendered as all required GOV-15 sections (§3). |

- **Routing primitive:** reuse the existing `createRouter`. Because the shell router keys on exact `path`, encode the
  digest selector as a query param (`#/newsletter?id=...`) rather than a path segment — matches the existing
  `#/app?demo=matrix` pattern; no router rewrite.
- **Screenshot override:** support `?state=loading|empty|error` over the data-binding (BEH-STATE precedent) so the
  three async states are capturable. `empty` = a real "no digests for Alpine yet" state, never a fabricated digest.

---

## 3. Digest-detail section rendering (GOV-15 sections are DATA → DOM)

Render **every** section key from the digest's `sections`, resolving each id-list back to the digest's embedded `items[]`
(an item id may appear in more than one section — it is an index, not a partition). Required sections, in order:

| GOV-15 section | Source key | Render |
|---|---|---|
| Processed records | `processedRecords` | count headline + each item (chronological feed order) as a compact record row carrying its label state (§4). |
| Source-set / backfill progress | `sourceSetProgress` | categories reviewed, `chronologicalRange` (oldest→newest), `orderingPreserved`, `knownGaps` listed verbatim, `completionFraming` shown as a **gap/status framing — never "complete"** unless the field says so. |
| Timeline chunks | `timelineChunks` | the resolved items, in feed order. |
| Key meetings / documents | `keyMeetings` / `keyDocuments` | distinct meeting ids / source (document) ids. |
| Topics | `topics` | distinct topic ids. |
| Corrections / conflicts / later outcomes | `corrections` / `conflicts` / `laterOutcomes` | resolved items; each clearly labeled by its claim state. |
| Unverified items | `unverifiedItems` | resolved items, **visibly marked non-verified** (§4) — never styled as verified fact. |
| Source trail | `sourceTrail` | deduped entries; render `sourceId`, `sourceType`, `originalUrl`/`archiveUrl` when present. `localSourcePath` is null and never shown. |

- A section whose list is empty renders as an explicit **"none in this digest"** affordance, not omitted — countability
  and visible gaps are the point (mirrors the backend "row always served" rule).
- `links.timelineUrl` (`/alpine/timeline?card=...`) MAY be surfaced as an in-app deep link to the existing timeline; it is
  a reviewer-internal route, never an external/public URL.

---

## 4. Label-state rendering — zero new labels (EG-7), non-verified never styled as fact

The feed item carries `labels.claimStatus` from the frozen `STAGE3_CLAIM_VOCAB`. The frontend renders it through a
**documented 1:1 map onto the existing presentation tone layer** (`statusTone`/tone classes already used by the card/
timeline surface). No new badge text, no new tone, no upgrade:

| `claimStatus` | Reads as | Tone (reuse existing) |
|---|---|---|
| `verified` | Verified / source-backed | trusted tone |
| `corrected` | Corrected (earlier record kept) | caution tone |
| `unverified` / `needs_human_review` | Not verified | warn tone |
| `disputed` | Disputed (sources conflict) | warn tone |
| `source_changed` | Source changed — re-verify | warn tone |
| `source_missing` | Source missing — unsupported | warn/stop tone |
| `ai_presented` | AI-presented context | the locked AI label (`AI_LABEL_TEXT`) |
| `speaker_unidentified` | Speaker unidentified | neutral tone |

- `labels.aiPresented === true` (or `itemType === 'ai_presented_context'`) MUST carry the existing **locked AI label**
  verbatim — AI-produced rows stay under their own per-record label, never merged into verified rows.
- `publicationStatus` is reviewer-internal state (e.g. draft); it MUST NOT be rendered as a "published" claim.
- The mapping above maps **into** existing strings/tones; if any value would need a brand-new label, that is a pass-up
  trigger (escalate to CTO) — do not invent one.

---

## 5. Gated-beta enforcement (both routes)

Both `#/newsletter` and `#/newsletter?id=...` are **full-app civic surfaces** → gate exactly like `#/app`:

- Resolve access via `resolveAccess(gateParam, reviewerBypass)` and render the civic surface **only** when
  `isApproved(state)` is true. For `anonymous` / `pending` / `denied` (and any non-approved state), the route renders the
  **gate panel** (request-access / waitlist / needs-info copy) and **no digest data** — no list, no sections, no source
  trail. There is no path by which a non-approved state sees Alpine civic content.
- Reviewer bypass (`VITE_REVIEWER_BYPASS` / `?reviewer=1`) reveals the routes locally, identical to the existing app
  pattern. An explicit `?gate=` override still wins (so a gated state is screenshotable with the bypass on).
- The route must **never imply non-Alpine coverage** — jurisdiction is Alpine; copy and headers say Alpine.

---

## 6. Tests / evidence (RED-first where applicable; additive, no regression)

Vitest, mirroring the existing suite (web-safe, adapter, state, render):
1. **Web-safe sweep** — `assertWebSafe` over the digest fixture passes; a planted raw path / non-null `localSourcePath`
   fails loud.
2. **Section presence** — the detail renderer emits a DOM node for **every** required GOV-15 section key, including the
   "none in this digest" affordance for empty lists.
3. **Verbatim binding** — a rendered item's label/sourceTrail equals the digest item of the same id (no recompute).
4. **Zero-new-label** — the set of rendered claim labels ⊆ the §4 map domain (== `STAGE3_CLAIM_VOCAB`); diff == 0.
5. **Non-verified visibility** — every `unverifiedItems` / `disputed` / `ai_presented` row carries its non-verified/AI
   marker (assert the label node is present and is not a verified tone).
6. **Gate enforcement** — for each non-approved `AccessState`, the route renders the gate panel and **no** digest data
   node; `approved`/bypass renders the data. (This is the AC#3 proof.)
7. **No public/email path** — a route/grep audit asserts no email/sender/publish/public-deploy call is wired from these
   routes (AC#3).

Plus **3-viewport screenshot evidence** (desktop 1440×900, tablet 768×1024, mobile 390×844 — per
`BACKEND_FRONTEND_EVIDENCE_WORKFLOW`; a UI row cannot pass on mobile/tablet alone): archive list, digest detail, label
states, and a gated (non-approved) state.

---

## 7. Acceptance (gates GOV-461 closeout)

- Archive list + digest detail render the 4.05 digest fixture behind gated-beta, committed to website `main` via
  **non-author merge** (cite SHA/PR + local-runner result).
- 3-viewport evidence for archive list + detail + label states + a blocked gated state.
- Gate enforcement proven (test #6 + screenshot); grep/route audit confirms no email/publish/public path.
- Zero-new-label diff vs `STAGE3_CLAIM_VOCAB` == 0; non-verified items visibly non-verified.
- Both review legs PASS (VSR + SecPriv no-leak/no-public-surface) before non-author merge — reuse the GOV-458/459/460
  gate pattern against this repo.
- Evidence comment on GOV-461: SHA/PR, screenshots, gate-block evidence, runner result; confirm 4.07–4.15 stay `planned`.
