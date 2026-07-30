# Government Watchdog — Stage Gate Logic

Company `bcac096e-4aff-4ce3-ad33-c4e0b693b36f` · UI prefix `GOV` · HEAD goal `5e8b8006-94ed-4489-8fa2-643f8ec16724`

This document is the binding rule set for when a Stage is allowed to start, when it is allowed to be
called achieved, who may declare it, and what forces it back. It replaces judgement-based
advancement. Anything not satisfiable by pointing at a named artifact is not a gate criterion.

Read-only inputs used to write this: `paperclipai goal list -C bcac096e-…`, `paperclipai goal get`,
`paperclipai issue list -C bcac096e-…`, `paperclipai agent list`. Nothing was mutated.

---

## 0. Ground truth as observed (2026-07-24)

### 0.1 Stage goals that actually exist

| Stage | Goal id | Status now | Owner agent now | Sub-goal slots | Sub-goal statuses |
|---|---|---|---|---|---|
| 0 | `51bc7f65-1276-4707-87a5-89fe1eb5a612` | achieved | CEO | 19 | 19 achieved |
| 1 | `927f07dc-546b-4cfe-8139-5265aee0bf63` | achieved | SourceArchivist | 15 | 15 achieved |
| 2 | `95ad6677-cb64-43fb-91b8-9cfa59eb894e` | achieved | TranscriptEvidenceEngineer | 15 | 15 achieved |
| 3 | `88190dca-4a76-4730-80c3-d66a76351b5c` | achieved | FrontendTimelineEngineer | 15 | 15 achieved |
| 4 | `ff6cc34e-43db-409b-b94f-7c7ffb0e95b8` | achieved | NewsletterEditor | 15 | 15 achieved |
| 5 | `9d3d7fbd-841f-4dac-b783-818f015191ba` | **active** | VerificationSafetyReviewer | 16 | **16 planned** |
| 6 | `c10c406c-0535-4908-889f-4d9cbe5dd48d` | planned | UXProductDesigner | 15 | 15 planned |
| 7 | `fbd4665c-ab8e-4636-8a05-f3afc9d9cfe3` | planned | NewsletterEditor | 15 | 15 planned |
| 8 | `bad2cdb3-bba8-48fb-9ffb-588c97631ab3` | planned | VerificationSafetyReviewer | 15 | 15 planned |
| 9 | *(does not exist)* | — | — | — | Numbering gap is intentional; see §2.10 |
| 10 | `4303f57b-8806-4b4c-8019-39ad059d3d96` | planned | SourceArchivist | 15 | 15 planned |
| 11 | `6d609fc0-141b-46e9-bfbc-93ed811bd823` | planned | BackendCrawlerEngineer | 15 | 15 planned |
| 12 | `c0199c89-30db-46e7-833f-f29b78cd4711` | planned | CEO | 15 | 15 planned |
| 98 | `75434c93-3713-4613-92d7-d7ac89f27fa0` | planned | SecurityPrivacyAgent | 15 | 15 planned |

Non-stage team goal: **MOTY design — full application across the website**
`2d9611c1-5cfe-4639-863d-57bc38fb0869`, status active, owner FrontendTimelineEngineer, **0 sub-goals**.

### 0.2 Three defects in the current state that this spec exists to stop

1. **Stage 5 is `active` with zero active sub-goals.** All 16 slots are `planned`. Under §3.2 an
   active stage must have at least one `active` sub-goal or it is mis-declared. Stage 5 is
   currently active by declaration only.
2. **MOTY (`2d9611c1`) is an active team goal with no sub-goal slots at all** — it has no gate
   surface, so it cannot be exited deterministically. Under §3.6 a team goal with zero sub-goals
   may not be set `active`.
3. **VerificationSafetyReviewer (`3f95c8ce`) owns Stages 5 and 8 and is also the mandated
   independent reviewer.** That is self-certification. §3.5 forbids it and names the substitute
   reviewer.

### 0.3 Agent id registry (used throughout)

| Short | Agent | Id |
|---|---|---|
| CEO | CEO | `e618342a-fd40-46f9-918a-b562e8948b87` |
| CTO | CTO | `24fddc65-edca-462b-8647-61b596c8a46f` |
| VSR | VerificationSafetyReviewer | `3f95c8ce-c929-4c30-a327-9871bcbc5643` |
| SPA | SecurityPrivacyAgent | `72d0eccf-74e0-4633-ae77-1cedc8b782ba` |
| ARCH | SourceArchivist | `beef0e42-7126-44ec-b261-5d89c9187b2d` |
| TXE | TranscriptEvidenceEngineer | `09b5d302-ae06-4320-bb16-f679aae721fe` |
| FTE | FrontendTimelineEngineer | `a73c847f-72cf-411c-a77b-3753f8a2225f` |
| BCE | BackendCrawlerEngineer | `f26f530c-44f4-4aa8-8957-e0d992eebdf0` |
| NED | NewsletterEditor | `6b3d5c0e-aed5-491a-8d3e-760d8d896286` |
| UXD | UXProductDesigner | `cde31723-2c94-4dbe-802a-497a051fec16` |
| AOE | AutomationOpsEngineer | `b9611d2e-d5d0-438e-9081-99f94cd65f06` |
| OWNER | Isaac (human owner) | not an agent; approval recorded on a GOV issue |

---

## 1. Universal gate machinery

### 1.1 The 15-slot template is the gate surface

Every stage carries the same numbered sub-goal slots. This is already true in the tree and is now
load-bearing: **a stage exits when every slot is `achieved` and every slot has a registered evidence
artifact.** Slots may be closed as *Not Applicable* only via §3.7.

| Slot | Name | Default slot owner |
|---|---|---|
| .01 | Spec package and root-plan reconciliation | stage owner |
| .02 | Acceptance criteria and exit gate | stage owner |
| .03 | Source/data inventory contract | stage owner or ARCH |
| .04 | Raw preservation and reproducibility | stage owner or ARCH |
| .05 | Backend/tooling implementation contract | BCE |
| .06 | Frontend/product surface contract | FTE (or UXD where design-led) |
| .07 | Transcript/evidence/statement model | TXE |
| .08 | Newsletter/briefing/editorial behavior | NED |
| .09 | Automation vs AI boundary matrix | AOE |
| .10 | QA and workflow testing plan | VSR |
| .11 | Security/privacy/publication gates | SPA |
| .12 | Traceability and audit trail | stage owner |
| .13 | Back-gap/regression analysis | stage owner |
| .14 | Documentation maintenance and project state continuity | stage owner |
| .15 | Agent handoff and owner escalation | stage owner |
| .16+ | Stage-specific slot(s) | assigned at entry |
| .QA-* | Extra QA slots (Stage 0 precedent, 4 used) | VSR / UXD / CTO |

### 1.2 Evidence artifact kinds (closed vocabulary)

Every exit criterion names exactly one kind plus a resolvable locator. No other kinds count.

| Kind | What it is | Locator format | Who can produce |
|---|---|---|---|
| `SPEC` | Committed markdown at a fixed path in one of the two repos | `website:docs/…md@<sha>` or `backend:docs/…md@<sha>` | producing agent |
| `TEST` | Named automated test or suite, green, with a run reference | `<suite>::<test name>` + CI run URL or `npm test` exit-0 log path | producing agent |
| `DATASET` | Committed fixture/registry file with row count and content hash | `path@<sha256>` + `rows=<n>` | producing agent |
| `RUNLOG` | Preserved crawl/job/import run summary with hash and timestamps | `runId` + stored summary path + `sha256` | BCE / ARCH / AOE |
| `SCREENSHOT` | Image under `docs/evidence/<GOV-###>/` at a stated viewport | `docs/evidence/GOV-123/NN-<viewport>-<what>.png` | producing agent |
| `REVIEW` | Paperclip markdown comment sign-off by a **non-producing** agent | `[GOV-123](/GOV/issues/GOV-123)` comment permalink | VSR (or SPA per §3.5) |
| `OWNER` | Explicit written approval by Isaac | `[GOV-123](/GOV/issues/GOV-123)` comment authored by the owner user | Isaac only |

Rules:
- A `SPEC` that only restates intent is not evidence. It must contain the concrete contract
  (fields, states, thresholds, routes, file paths) the criterion asserts.
- A `TEST` must fail if the criterion is violated. A test that passes on an empty fixture is not
  evidence for a coverage criterion.
- `SCREENSHOT` is evidence only for visual/presentation criteria, and only at all three baseline
  viewports (1440 desktop, 768 tablet, 390 mobile) when the criterion is about a rendered surface.
- `REVIEW` never substitutes for a missing `SPEC`/`TEST`/`DATASET`. It is layered on top.

### 1.3 The stage receipt

Each stage's slot `.02 — Acceptance criteria and exit gate` holds the **stage receipt**: one
markdown table, committed at `docs/company-os/receipts/stage-<N>.md`, with one row per exit
criterion:

```
| # | Exit criterion (verbatim from §2) | Evidence kind | Locator | Producer | Slot | Verified-by | Verified-at |
```

A stage may not be declared achieved while any row has an empty `Locator` or empty `Verified-by`.
The receipt file is itself a `SPEC` artifact and is the single thing the reviewer reads.

---

## 2. Per-stage gates

Notation: **E** = entry criterion, **X** = exit criterion. Every X carries its evidence kind.

### 2.0 Stage 0 — Governance, repos, runners, and source-of-truth foundation *(achieved)*

**Purpose:** Establish the operating foundation (company, repos, runners, data/backup boundaries,
agent limits) so later stages never have to ask where to start.
**Owner:** CEO `e618342a`. **Independent reviewer:** VSR.

| | Criterion | Evidence |
|---|---|---|
| E1 | Company, both repos, and at least one runner exist and are reachable | `RUNLOG` |
| X1 | Operating model doc names, for backend + website + source data + backup + safety + ownership, exactly where each lives | `SPEC` |
| X2 | Local verification routes execute green in both repos (website `npm test`; backend test entrypoint) | `TEST` ×2 |
| X3 | A written "cannot be published or exposed" list exists and is referenced by the agent operating goals | `SPEC` |
| X4 | Stage 1 entry criteria are all satisfiable from the Stage 0 output with no open question | `REVIEW` |
| X5 | Gating rules for later stages are written down (this document supersedes and is the X5 artifact) | `SPEC` — `docs/company-os/stage-gates.md` |

*Back-annotation duty:* Stage 0 is already `achieved`. Under §5.2 it does not reopen, but its
receipt `docs/company-os/receipts/stage-0.md` must be back-filled before Stage 6 entry, because
Stage 6 asserts Stage 0's boundaries hold under beta load.

### 2.1 Stage 1 — Alpine source inventory and raw preservation *(achieved)*

**Purpose:** Build the Alpine official-source backbone and preserve raw sources before any analysis.
**Owner:** ARCH `beef0e42`. **Independent reviewer:** VSR.

| | Criterion | Evidence |
|---|---|---|
| E1 | Stage 0 achieved | goal status |
| E2 | Storage location for raw/semi-raw material is defined and is not publicly served | `SPEC` |
| X1 | Alpine source registry exists; every row has scan date, source type, jurisdiction, status, title, public URL (or explicit null), archive availability, review state | `DATASET` with `rows=n, sha256` |
| X2 | ≥1 registry batch and ≥1 collection run are reviewable end-to-end | `RUNLOG` ×2 |
| X3 | ≥1 meeting or video source is represented, or an explicit designed-gap record states none was available | `DATASET` |
| X4 | Changed / disappeared / replaced-source observations are captured as typed records, not free text | `SPEC` + `DATASET` |
| X5 | An agent can locate and process Alpine records without asking the owner | `REVIEW` (reviewer performs the lookup unaided and records the path) |

### 2.2 Stage 2 — Alpine meeting transcript and exact-source model *(achieved)*

**Purpose:** Make meeting evidence traceable to exact timestamps with safe speaker attribution.
**Owner:** TXE `09b5d302`. **Independent reviewer:** VSR.

| | Criterion | Evidence |
|---|---|---|
| E1 | Stage 1 achieved and ≥1 meeting/video source preserved | goal status + `DATASET` |
| X1 | Transcript segment model defines meeting date, source video, text, start/end time, agenda item (nullable), speaker label, speaker verification state, exact jump target | `SPEC` |
| X2 | ≥1 Alpine meeting has timestamped transcript records | `DATASET` |
| X3 | ≥3 statements resolve to exact source moments (deep link opens at the timestamp) | `TEST` (link-resolution test over the 3 statements) |
| X4 | No unverified speaker is named anywhere in output | `TEST` (assertion over the corpus, fails on any named-unverified speaker) |
| X5 | Newsletter, timeline, and topic surfaces consume the same evidence chain (no parallel copy) | `SPEC` + `TEST` (shared-module import assertion) |

### 2.3 Stage 3 — Alpine timeline and card model MVP *(achieved)*

**Purpose:** First timeline-first Alpine experience built on preserved sources and transcript evidence.
**Owner:** FTE `a73c847f`. **Independent reviewer:** VSR.

| | Criterion | Evidence |
|---|---|---|
| E1 | Stages 1 and 2 achieved | goal status |
| X1 | Private route renders ≥5 sourced Alpine cards | `TEST` + `SCREENSHOT` (1440/768/390) |
| X2 | ≥1 card links to a meeting timestamp that resolves | `TEST` |
| X3 | ≥1 card exposes source drawer detail | `SCREENSHOT` + `TEST` |
| X4 | AI-presented, unverified, disputed, corrected states each have a distinct visible pattern | `SCREENSHOT` ×4 + `TEST` (state→class mapping) |
| X5 | Frontend does not recompute trust; it renders backend-supplied trust verbatim or an explicit gap | `TEST` (no trust arithmetic in render path) + `REVIEW` |
| X6 | Website and backend checks pass on the changed work | `TEST` ×2 |
| X7 | Cards are a presentation layer over separate civic concepts, not the data source | `SPEC` |

### 2.4 Stage 4 — Historical weekly newsletter backbone *(achieved)*

**Purpose:** Digest layer that summarises chronological historical backfill without inventing claims.
**Owner:** NED `6b3d5c0e`. **Independent reviewer:** VSR.

| | Criterion | Evidence |
|---|---|---|
| E1 | Stage 3 achieved; timeline + topic records queryable | goal status |
| X1 | Every digest item resolves to ≥1 source-trail record | `TEST` (orphan-claim detector returns 0) |
| X2 | Sample Alpine historical weekly digest exists and is reviewable internally | `SPEC` + `SCREENSHOT` |
| X3 | Newsletter item model is tied to source and timeline record ids, not to free text | `SPEC` + `DATASET` |
| X4 | AI-presented / unverified content carries a visible label in every render path | `TEST` + `SCREENSHOT` |
| X5 | A reviewer reaches full understanding of one digest in ≤15 minutes | `REVIEW` (reviewer records start/end timestamps) |
| X6 | Historical digest behavior is separated in code from pre-meeting-briefing behavior | `SPEC` + `TEST` |

### 2.5 Stage 5 — Corrections, source-version change detection, and verification *(active)*

**Purpose:** Detect, preserve, compare, reprocess, review, and disclose changed/disappeared/replaced
civic sources without rewriting history.
**Owner:** currently VSR `3f95c8ce` — **must be reassigned** (see §3.5). Recommended producer owner:
BCE `f26f530c` (deterministic diff/preservation is backend work). **Independent reviewer:** VSR.

| | Criterion | Evidence |
|---|---|---|
| E1 | Stages 1–4 achieved | goal status |
| E2 | ≥1 Stage 5 sub-goal is `active` — **not true today**, blocks legitimate active status | goal status |
| E3 | Source registry stores per-version URL, retrieval time, hash, provenance | `DATASET` |
| X1 | Original and changed versions are both preserved with URL, retrieval time, hash, provenance, typed supersession/correction lineage | `SPEC` + `TEST` (round-trip: change a fixture source, both versions retrievable) |
| X2 | Material late agenda change is flagged, with materiality criteria written as code-checkable rules (not prose) | `SPEC` + `TEST` (rule fires on the material fixture, does not fire on the trivial fixture) |
| X3 | States `detected / pending-reprocess / partially-reprocessed / review-pending / verified-comparison / withheld / failed` all render and are all reachable | `TEST` (state machine coverage = 7/7) + `SCREENSHOT` |
| X4 | Before/after structured diff anchors to page, section, agenda item, meeting, attachment | `SPEC` + `TEST` |
| X5 | Only affected normalization, linkage, tags, summaries, six lens outputs, and reviews are invalidated and rerun | `TEST` (invalidation set equals expected affected set; unaffected records untouched) |
| X6 | Each affected lens receives old version + new version + deterministic diff, and **no lens can read another lens's output** | `TEST` (lens isolation assertion) + `REVIEW` |
| X7 | Prior user-facing state is preserved with correction lineage, never overwritten | `TEST` (history record count is non-decreasing across a correction) |
| X8 | A changed agenda traces from detection through every affected work receipt and review | `RUNLOG` + `REVIEW` |
| X9 | No comparison is marked complete while any affected stage or lens is pending / failed / unreviewed | `TEST` (fail-closed assertion) |
| X10 | Diffing, hashing, versioning, and matching run in code with no model in the loop | `SPEC` (slot .09 boundary matrix) + `REVIEW` |
| X11 | Slot .16 — late source-change red flags, diff, and affected-work reprocessing — has a named owner | goal `ownerAgentId` non-null (**currently null**) |

### 2.6 Stage 6 — Alpine private beta and legal-review preparation *(planned)*

**Purpose:** Run the controlled 2→3→15 private beta and produce a decision-ready beta + legal-review
package. Authorises no public release, no paid access, no broad crawling.
**Owner:** UXD `cde31723`. **Independent reviewer:** VSR; SPA co-signs X7–X9.

| | Criterion | Evidence |
|---|---|---|
| E1 | Stage 5 achieved | goal status |
| E2 | MOTY design goal `2d9611c1` merged to `origin/main` (stated entry condition in the Stage 6 goal) | merge commit sha |
| E3 | Beta cohort list (2, then 3, then 15) exists with per-person consent recorded | `DATASET` |
| X1 | Evidence coverage measured and reported as a number per surface | `DATASET` + `SPEC` |
| X2 | Source-change handling exercised live during beta ≥1 time, with the Stage 5 pipeline receipts | `RUNLOG` |
| X3 | Webhook processing is ordered and provably so under a replay/out-of-order test | `TEST` |
| X4 | Five-minute target performance measured on the real beta path, with the measured number recorded | `RUNLOG` |
| X5 | Model + reviewer cost per beta week recorded against a stated budget | `DATASET` (cost export) |
| X6 | Accessibility pass on all beta surfaces at 1440/768/390 | `TEST` (automated a11y suite) + `SCREENSHOT` |
| X7 | Safety and support-burden log kept for the whole cohort window | `RUNLOG` + `REVIEW` by SPA |
| X8 | Capacity headroom stated as a number (concurrent users, storage, crawl rate) | `SPEC` |
| X9 | Legal-review package assembled and complete against its own checklist | `SPEC` + `REVIEW` by SPA |
| X10 | Every rendered slot in the beta is RV, DG, or GS — no bare placeholder, no Coming Soon on civic data | `TEST` (slot audit) + `SCREENSHOT` |
| X11 | Cohort ramp 2→3→15 executed in order, each step reviewed before the next | `REVIEW` ×3 |

### 2.7 Stage 7 — Alpine current-date operations and pre-meeting briefings *(planned)*

**Purpose:** Add current-day operations and pre-meeting briefings on top of a proven historical model.
**Owner:** NED `6b3d5c0e`. **Independent reviewer:** VSR.

| | Criterion | Evidence |
|---|---|---|
| E1 | Stages 4 and 5 achieved | goal status |
| E2 | Alpine historical chain is processed far enough that a current briefing can link backwards | `DATASET` (coverage number) |
| X1 | New Alpine agendas and packets are detected automatically | `RUNLOG` + `TEST` |
| X2 | One Alpine pre-meeting briefing generated from source records in test or simulation | `RUNLOG` + `SPEC` (briefing model) |
| X3 | Every briefing item has a source trail or is explicitly marked "needs review" | `TEST` (0 items with neither) |
| X4 | Briefing items link to prior topics, or explicitly render the missing-historical-chain gap | `TEST` + `SCREENSHOT` |
| X5 | Orphan-claim count in briefings = 0 | `TEST` |
| X6 | Current summaries are not presented as settled conclusions while underlying history is unprocessed | `TEST` (label assertion) + `REVIEW` |
| X7 | Briefing carries agenda items, packet source trail, prior cards, unresolved questions, deadlines, labels, hot-topic indicators, exact evidence | `SPEC` + `SCREENSHOT` |

### 2.8 Stage 8 — Auditor verification and civic servant badge model *(planned)*

**Purpose:** Add human verification and civic-servant identity signals without exposing private identity data.
**Owner:** currently VSR `3f95c8ce` — **must be reassigned** (see §3.5). Recommended producer owner:
SPA `72d0eccf` for identity separation, with FTE for the public trail surface. **Independent
reviewer:** whichever of VSR / SPA is not the producer; CTO breaks a tie.

| | Criterion | Evidence |
|---|---|---|
| E1 | Stage 6 achieved (real users exist to be auditors) | goal status |
| E2 | Private identity storage boundary from Stage 0 confirmed still valid | `REVIEW` |
| X1 | Area-based auditor pools and active-auditor definition are written as computable rules | `SPEC` |
| X2 | Threshold `min(10 people, 50% of active auditors in area)` is implemented exactly | `TEST` (boundary cases: 4, 20, 21, 40 active auditors) |
| X3 | A notice does not disappear until threshold is met | `TEST` (notice persists at threshold−1) |
| X4 | Public views show username + verification action and **never** address, identity, or validation data | `TEST` (public serialiser field allowlist) + `SCREENSHOT` |
| X5 | Civic servant badges are opt-in, with recorded opt-in event | `DATASET` + `TEST` |
| X6 | Badges expire and require reverification after election or hiring cycles | `TEST` (clock-advance test) |
| X7 | No sensitive private field appears in any generated record (newsletter, digest, lens output) | `TEST` (corpus scan) + `REVIEW` by SPA |

### 2.9 Stage 9 — *(does not exist)*

There is **no Stage 9 goal** in the tree. Sub-slot `.09` on every stage is "Automation vs AI
boundary matrix", which is what causes the string `Stage N.09` to appear 14 times and can be
mistaken for a Stage 9. The numbering runs 8 → 10 deliberately.

**Rule:** no agent may create a Stage 9. If work is proposed that would sit between Stage 8 and
Stage 10, it is added as a numbered sub-slot (`.16`, `.17`, …) on Stage 8 or Stage 10, not as a new
stage. Creating a new top-level stage requires an `OWNER` artifact.

### 2.10 Stage 10 — Star Valley / Lincoln County source inventory and backfill preparation *(planned)*

**Purpose:** Prepare the first expansion beyond Alpine while keeping Alpine as the model standard.
**Owner:** ARCH `beef0e42`. **Independent reviewer:** VSR.

| | Criterion | Evidence |
|---|---|---|
| E1 | Stages 1–5 achieved (source, transcript, timeline, digest, corrections all proven on Alpine) | goal status |
| E2 | Owner has confirmed expansion beyond Alpine may be *prepared* (preparation only, no crawl) | `OWNER` |
| X1 | Jurisdiction model represents Wyoming / county / town / district / board / agency | `SPEC` + `DATASET` |
| X2 | ≥1 county and ≥1 non-Alpine town representable in test data | `DATASET` |
| X3 | Filters traverse Wyoming → county → town in the UI | `TEST` + `SCREENSHOT` |
| X4 | Source seeds defined for Star Valley and Lincoln County, with approved regional-news and official-record source classes distinguished | `DATASET` + `SPEC` |
| X5 | Crawler priority tiers defined with explicit tier assignment per seed | `SPEC` + `DATASET` |
| X6 | Newsletter scope selectable as local / regional / statewide | `TEST` |
| X7 | Focused-area rule encoded: full source set gathered before oldest-to-newest processing begins | `SPEC` + `TEST` (processing refuses to start on an incomplete set) |
| X8 | Alpine remains the model standard — no Alpine regression introduced | `TEST` (Alpine suites still green) |

### 2.11 Stage 11 — Star Valley / Lincoln County historical backfill execution *(planned)*

**Purpose:** Execute the first post-Alpine historical backfill.
**Owner:** BCE `f26f530c`. **Independent reviewer:** VSR; SPA co-signs X6.

| | Criterion | Evidence |
|---|---|---|
| E1 | Stage 10 achieved | goal status |
| E2 | Owner has approved starting the regional crawl (distinct from Stage 10's preparation approval) | `OWNER` |
| E3 | Capacity/cost headroom from Stage 6 X5/X8 still holds at regional volume | `SPEC` |
| X1 | ≥1 regional backfill batch processed and reviewable | `RUNLOG` + `DATASET` |
| X2 | Records processed oldest → newest, provably | `TEST` (ordering assertion over the batch) |
| X3 | Historical digest generated from the batch with full source trail | `SPEC` + `TEST` (orphan claims = 0) |
| X4 | Crawler progress resumes correctly after an induced interruption | `TEST` (kill-and-resume) + `RUNLOG` |
| X5 | No future-knowledge contamination: historical context contains nothing dated after the record | `TEST` (timestamp-leak detector = 0 hits) |
| X6 | Raw and generated evidence remain private until reviewed | `TEST` (no unreviewed record on a public route) + `REVIEW` by SPA |
| X7 | Regional timeline chunks render when ready, with designed gaps where not | `SCREENSHOT` + `TEST` |

### 2.12 Stage 12 — Wyoming statewide expansion readiness *(planned)*

**Purpose:** Prove the model is ready to generalise statewide — readiness only, no statewide crawl.
**Owner:** CEO `e618342a`. **Independent reviewer:** VSR; SPA co-signs X3.

| | Criterion | Evidence |
|---|---|---|
| E1 | Stage 11 achieved | goal status |
| E2 | Regional metrics from Stage 11 exist as numbers, not impressions | `DATASET` |
| X1 | Jurisdiction model generalises across Wyoming counties, towns, and state agencies | `SPEC` + `TEST` (model loads ≥3 distinct jurisdiction types) |
| X2 | Scalable storage and crawler plan states cost per 1000 sources, rate limits, crawl-ethics rules, archival policy | `SPEC` with numbers |
| X3 | Legal, privacy, and moderation checklist exists and is completed, not merely drafted | `SPEC` + `REVIEW` by SPA |
| X4 | Source-seed onboarding procedure runnable by an agent for a new county without owner input | `SPEC` + `RUNLOG` (dry run on one new county) |
| X5 | Human verification (Stage 8 model) scales by area — threshold math holds for a large-area pool | `TEST` |
| X6 | State / county / town selector plan specified and prototyped | `SPEC` + `SCREENSHOT` |
| X7 | Regional metrics show the model works, against thresholds fixed **before** measurement | `DATASET` + `SPEC` (thresholds committed first) |
| X8 | Owner approves statewide expansion | `OWNER` |
| X9 | No statewide crawl has started | `RUNLOG` (crawl scope audit shows regional only) |

### 2.13 Stage 98 — Deferred public release gate *(planned; see §7 for the full checklist)*

**Purpose:** The single owner-controlled decision point for any public release. Intentionally
`planned`, never opportunistically activated.
**Owner:** SPA `72d0eccf`. **Independent reviewer:** VSR. **Sole authority to achieve:** Isaac.

**Entry:** Stages 0–8 and 10–12 all `achieved`; §7 checklist packages all assembled; owner has
stated in writing that a release decision is being opened (`OWNER`).
**Exit:** all of §7 satisfied **and** an `OWNER` artifact naming release scope, geography,
funding/eligibility model, and communication plan.

**Standing prohibition (unchanged by this document):** no task in any stage may deploy publicly,
publish, invite broad users, activate billing, or contact the public without its own separate
explicit owner approval. Stage 98 achievement is not a blanket authorisation; it authorises exactly
the scope named in its `OWNER` artifact.

---

## 3. The advancement rule

### 3.1 Legal states and legal transitions

Goal statuses in Paperclip are `planned`, `active`, `achieved`. Only these transitions are legal:

```
planned  --ENTRY-->   active
active   --EXIT-->    achieved
achieved --REGRESS--> active     (§5)
active   --HALT-->    planned    (§3.8, only if zero slots have started)
```

`planned → achieved` is illegal in all cases. A stage that appears to be already done must still
pass through `active` long enough to register its receipt.

### 3.2 `planned → active` (ENTRY)

Declared by: the **stage owner agent** (or CEO for stages the CEO owns).

Preconditions, all mandatory:
1. Every hard-blocking predecessor in §6 is `achieved`.
2. Every stage-specific **E** criterion in §2 has its evidence registered.
3. The concurrency budget in §4 has room.
4. The stage has ≥1 sub-goal slot, and the owner sets ≥1 slot to `active` in the same operation.
5. Every slot has a non-null `ownerAgentId`. (Stage 5 slot `.16` currently violates this.)
6. The stage owner is not the independent reviewer for that stage (§3.5).
7. A stage-entry issue `GOV-#### [Stage N ENTRY]` is created, checked out, and carries the §6
   `blockedByIssueIds` set — which must be empty at the moment of entry.

If any precondition fails, the stage stays `planned` and the owner posts the failing precondition as
a markdown comment on the entry issue.

### 3.3 `active → achieved` (EXIT)

Two-party, never one. The sequence is fixed:

1. **Producer completes.** Stage owner sets all slots `achieved`, commits
   `docs/company-os/receipts/stage-<N>.md` with every row populated, and moves the stage-exit issue
   `GOV-#### [Stage N EXIT]` to `todo` with a comment linking the receipt.
2. **Producer does not touch the stage status.** The stage stays `active`.
3. **Independent review.** VSR (or the §3.5 substitute) checks out the exit issue and independently
   resolves every locator in the receipt. Resolving means: opening the file at the stated sha,
   re-running the named test, opening the screenshot, reading the sign-off. A locator that does not
   resolve is a fail.
4. **Reviewer verdict**, posted as a markdown comment on the exit issue, one of:
   - `PASS` — every row resolved and every criterion met.
   - `PARTIAL` — see §3.4.
   - `FAIL` — ≥1 criterion unmet; names each unmet criterion and the missing artifact.
5. **Only on `PASS`** does the reviewer set the stage goal to `achieved`
   (`paperclipai goal update <stageGoalId> --status achieved`) and close the exit issue `done`.
6. Stages whose exit touches publication, identity, or public exposure (5, 6, 8, 11, 12, 98)
   additionally require an SPA `REVIEW` comment before step 5.
7. Stage 98 additionally requires an `OWNER` artifact; the reviewer may not set it `achieved` on
   agent authority at all.

**Self-certification ban:** the producing agent may never post the `REVIEW` artifact for its own
stage, may never set its own stage to `achieved`, and may never resolve its own exit issue. A
violation is itself a regression trigger (§5.1 R5).

### 3.4 Partial completion

`PARTIAL` means some slots are genuinely done and some are not. It never yields `achieved`. The
reviewer must, in the same comment:

1. List each unmet criterion with its missing evidence kind.
2. For each, either (a) leave the slot `active`, or (b) split the unmet part into a **new sub-goal
   slot** on the same stage (`.16`, `.17`, …) with a named owner.
3. Set the stage back to / keep it at `active`.
4. Record whether the deficit blocks successors. If it does not, successors listed in §6 may still
   enter — but only if the reviewer explicitly writes `CARRY-FORWARD OK: <successor stages>` and
   names the residual risk. Absent that line, successors stay blocked.

A stage may hold at most **two** consecutive `PARTIAL` verdicts. The third review must be `PASS` or
`FAIL`; a third `PARTIAL` is automatically converted to `FAIL` and escalated to CTO.

### 3.5 Reviewer independence and the conflict fix

The independent reviewer is **VerificationSafetyReviewer `3f95c8ce`** for every stage — except where
VSR is the producing owner. Today that is **Stage 5** and **Stage 8**.

Resolution, in priority order:
1. **Preferred:** reassign the producing ownership away from VSR.
   `Stage 5 → BCE f26f530c` (deterministic preservation/diff is backend work).
   `Stage 8 → SPA 72d0eccf` (identity separation is a privacy problem).
   VSR then reviews normally.
2. **Fallback if the owner declines reassignment:** the independent reviewer for that stage is
   **SPA `72d0eccf`**, and CTO `24fddc65` co-signs. VSR still may not self-certify.

This substitution must be recorded in the stage receipt header before entry, not decided at exit.

### 3.6 Team goals with no gate surface

A team-level goal may not be `active` with zero sub-goals. **MOTY `2d9611c1` currently violates
this.** Remedy: either give MOTY the slot template (minimum `.01`, `.02`, `.06`, `.10`, `.11`,
`.14`), or reparent it as a sub-goal slot of Stage 6, which is where its stated purpose (private-beta
presentation readiness) actually lands.

### 3.7 Not-Applicable slots

A slot may be closed as N/A only when: the stage owner proposes it in the receipt with a written
reason, **and** the independent reviewer countersigns it in the exit comment. An N/A slot is written
in the receipt as `N/A — <reason> — countersigned <reviewer> <date>`. Unilateral N/A by the producer
is a self-certification violation.

### 3.8 Halting an entered stage

`active → planned` is legal only when zero slots have moved off `planned` and no evidence artifact
has been registered — i.e. the entry was a mistake. Declared by the stage owner, countersigned by
CTO. Any stage with real work done goes to §5 instead.

---

## 4. The concurrency rule ("1 to 5 at a time")

### 4.1 What is counted

The budget counts **team-level Stage goals with status `active`**. It does not count company-level
tracks (which are standing programs, not stages), agent operating goals, or sub-goal slots.

Current count under this definition: **2** — Stage 5 (`9d3d7fbd`) and MOTY (`2d9611c1`, which under
§3.6 must either become gate-bearing or be reparented into Stage 6).

### 4.2 The budget

- **Minimum 1, maximum 5** active stages at any time. Zero active stages is itself a violation and
  must be resolved by the CEO within one heartbeat by entering the next eligible stage.
- **At most 2** of the active stages may be *evidence-producing* stages (1, 2, 5, 7, 10, 11) — these
  contend for the same crawl/preservation capacity.
- **At most 1** stage requiring an `OWNER` artifact for entry (10, 11, 12, 98) may be active at once.
- Stage 98 counts against the budget and, while active, caps the total at **2** (Stage 98 plus at
  most one other), because a release decision must not compete for reviewer attention.
- Concurrency is enforced at ENTRY (§3.2 precondition 3). It is never enforced retroactively by
  demoting a running stage.

### 4.3 How the next stage is chosen

When a slot in the budget frees, the CEO selects deterministically. Apply in order; the first rule
that yields exactly one candidate wins:

1. **Eligibility filter.** Candidate set = stages that are `planned` and whose §6 hard blockers are
   all `achieved` and whose **E** criteria all have registered evidence.
2. **Unblocking power.** Prefer the candidate that hard-blocks the most other stages (§6 out-degree).
3. **Lowest stage number.** Among ties, the lower number wins — this preserves the oldest-to-newest
   and Alpine-first discipline.
4. **Reviewer load.** If the winner would give VSR a third simultaneous review queue, defer it and
   take the next candidate.
5. **Owner-gated last.** A stage needing an `OWNER` entry artifact is never auto-selected; the CEO
   must request the approval and wait.

If the eligibility filter is empty while the budget has room, the CEO does **not** invent work. The
CEO posts the blocking chain on the HEAD goal issue and the budget stays under-filled until a stage
exits or a blocker clears.

### 4.4 Worked example against today's tree

Budget 5, currently 2 active (Stage 5, MOTY). Eligible `planned` stages: none — Stage 6 needs
Stage 5 achieved plus the MOTY merge; Stages 7, 8, 10, 11, 12, 98 all chain behind. Correct
behaviour today is therefore: **do not open a third stage.** Finish Stage 5's slots (all 16 are
still `planned`, which is the actual problem) and land MOTY.

---

## 5. The blocked and regression rule

### 5.1 Regression triggers — `achieved → active`

Any one of these forces a stage back to `active`:

| | Trigger | Detected by | Who may declare |
|---|---|---|---|
| R1 | A `TEST` artifact cited in the stage receipt goes red on `main` | CI | AOE, VSR, CTO |
| R2 | A `SPEC`, `DATASET`, `SCREENSHOT`, or `RUNLOG` locator no longer resolves (file moved/deleted, sha gone, fixture rewritten) | receipt-resolution sweep | VSR, CTO |
| R3 | A criterion is discovered to have been mis-verified — evidence existed but did not actually test the criterion | any agent, on review | VSR, CTO |
| R4 | A gap is discovered in a later stage that only the earlier stage can close (back-gap; slot `.13` exists for this) | any agent | VSR, CTO |
| R5 | A self-certification, unilateral-N/A, or reviewer-independence violation is found | audit | VSR, CTO, SPA |
| R6 | A hard-gate breach: unreviewed/private/sensitive material exposed, AI output rendered as fact, frontend recomputing trust, lens cross-contamination | SPA or VSR | **SPA or VSR, immediately** |
| R7 | A source-version change (Stage 5 class) invalidates evidence a later stage relied on | Stage 5 pipeline | VSR, BCE |
| R8 | Owner states the stage does not meet intent | Isaac | Isaac (overrides everything) |

### 5.2 Who may declare a regression

- **VSR** and **CTO** may regress any stage.
- **SPA** may regress any stage on R6 (hard-gate breach) and does so **immediately, without
  discussion** — R6 is fail-closed.
- The **stage owner** may regress its own stage (self-reporting is always allowed; self-clearing
  never is).
- **Isaac** may regress anything for any reason.
- No other agent may set a stage from `achieved` to `active`. An agent that believes a stage should
  regress files a `GOV-#### [REGRESSION CANDIDATE Stage N]` issue and assigns it to VSR.

### 5.3 What a regression does

1. Stage status → `active`. It **counts against the §4 budget immediately**, and if that pushes the
   count over 5, the most recently entered non-regressed stage is halted per §3.8 if it has no work,
   otherwise the CEO records the over-budget condition and opens no further stages.
2. The failing criteria's slots → `active`. Slots not implicated stay `achieved`.
3. Every stage that lists the regressed stage as a hard blocker in §6 and is currently `active` is
   evaluated by VSR: it either continues (reviewer writes `CARRY-FORWARD OK`) or is itself regressed.
   Successors already `achieved` are **not** automatically regressed — only if their own receipt
   rows depend on the invalidated evidence (R4/R7 chain).
4. On an R6 breach, all stages whose surfaces render the breached content are regressed together and
   the affected surface is withheld until re-review, per the fail-closed rule.
5. Re-exit follows §3.3 in full. A previously granted `PASS` never carries over; the reviewer
   re-resolves the whole receipt, not just the regressed rows.

### 5.4 Blocked (as distinct from regressed)

A stage that cannot proceed for an external reason stays `active` and its blocking work is expressed
as a **first-class blocker**: the stage's slot issue gets the blocking issue id in
`blockedByIssueIds`. Free-text "blocked on X" in a comment is not a blocker and does not count.
Every blocked issue must name an unblock owner. Per the Paperclip rules an agent must never retry a
409 and must leave a final disposition of `done`, `in_review` with a real reviewer path, or
`blocked` with a named unblock owner.

---

## 6. Dependency graph

### 6.1 Hard blocks

`A → B` means B may not enter `active` until A is `achieved`.

```
0 ──> 1 ──> 2 ──> 3 ──> 4 ──> 5 ──> 6 ──> 7
                              │      │
                              │      └──> 8 ──┐
                              │               │
                              └──> 10 ──> 11 ──> 12 ──> 98
                                                  ▲     ▲
                       6 ──────────────────────────┘     │
                       7, 8, 11 ───────────────────────────┘
```

Explicit edge list:

| Blocker | Blocks | Reason |
|---|---|---|
| 0 | 1 | Storage/boundary/runner foundation must exist before raw preservation |
| 1 | 2 | No transcripts without preserved meeting/video sources |
| 2 | 3 | Cards must sit on the exact-source evidence chain |
| 3 | 4 | Digest is generated from timeline + topic records |
| 4 | 5 | Corrections must be able to invalidate digests, so digests must exist |
| 5 | 6 | Beta cannot run without source-change handling (Stage 6 X2 depends on it) |
| 5 | 10 | Regional preparation requires the corrections model to be proven on Alpine |
| 6 | 7 | Current-day operations follow a proven beta model |
| 6 | 8 | Auditor pools need real beta users |
| 6 | 12 | Statewide readiness needs measured cost/capacity/accessibility from beta |
| 7 | 98 | Public release presupposes working current-day operations |
| 8 | 98 | Public release presupposes human verification and identity separation |
| 10 | 11 | Cannot backfill a region whose source inventory is not prepared |
| 11 | 12 | Statewide readiness requires a proven regional backfill |
| 12 | 98 | Release scope decision requires statewide-readiness answers |
| MOTY `2d9611c1` | 6 | Stated in the Stage 6 goal: Stage 6 activates when the MOTY PR merges to `origin/main` |

### 6.2 Soft dependencies (advisory, not encoded as blockers)

- 8 → 12 (X5 asks whether verification scales by area; if 8 is not achieved, Stage 12 X5 is a
  `PARTIAL` candidate rather than a blocker).
- 5 → 7 (already implied through 6, listed for clarity: briefings must respect correction lineage).

### 6.3 Paperclip encoding

For each stage N create exactly two tracking issues in company `bcac096e-…`, linked to the stage
goal via `goalId`:

- `GOV-#### [Stage N ENTRY] <stage title>` — assignee = stage owner agent.
- `GOV-#### [Stage N EXIT] <stage title>` — assignee = independent reviewer (§3.5).

Encoding rules:

1. `[Stage N ENTRY].blockedByIssueIds` = the set of `[Stage M EXIT]` issue ids for every M that hard-blocks
   N in §6.1. Stage 6's ENTRY additionally includes the MOTY tracking issue id.
2. `[Stage N EXIT].blockedByIssueIds` = the set of issue ids for every slot issue of Stage N
   (`Stage N.01` … `Stage N.15`, plus `.16+`/`.QA-*`). The exit issue is therefore mechanically
   unblockable only when every slot is done.
3. Slot issues carry their own `blockedByIssueIds` for intra-stage ordering — at minimum
   `.02` is blocked by `.01`, and `.10`/`.11` are blocked by `.05`/`.06`/`.07` where those slots
   produce the thing being tested.
4. A regression (§5) reopens `[Stage N EXIT]` from `done` to `todo` and re-adds the implicated slot
   issue ids to its `blockedByIssueIds`.
5. Stage 98's EXIT issue additionally carries a blocker issue per §7 checklist section (five
   blockers), each cleared only by an `OWNER` or countersigned `REVIEW` artifact.
6. No blocker is ever expressed as prose. If it is not in `blockedByIssueIds`, it does not block.

---

## 7. Stage 98 — the owner-gate checklist

Stage 98 goal `75434c93-3713-4613-92d7-d7ac89f27fa0`. Producer/assembler: SPA `72d0eccf`.
Independent reviewer: VSR `3f95c8ce`. **Only Isaac may set this goal to `achieved`.**

Five packages. Each item needs its named evidence before the package's blocker issue clears.

### 7.1 Legal / safety package — clears `GOV-#### [98-LEGAL]`

| # | Item | Satisfying evidence |
|---|---|---|
| L1 | Legal review of publishing government-source material for the named release geography is complete | `SPEC` legal-review package (Stage 6 X9 artifact, refreshed for the release scope) + `OWNER` acknowledging it was read |
| L2 | Defamation / attribution exposure assessed: no unverified speaker is named anywhere public | `TEST` corpus scan = 0 hits + `REVIEW` by VSR |
| L3 | AI-output labelling holds on every public surface — no AI text renders without its label | `TEST` label-coverage assertion + `SCREENSHOT` at 1440/768/390 for each public surface |
| L4 | Facts, sources, verification state, and publication state are provably immune to lens influence | `TEST` (lens write-path assertion: lens output cannot mutate canonical fields) + `REVIEW` by VSR |
| L5 | Six lenses remain isolated — no lens reads another lens's output | `TEST` isolation suite |
| L6 | Abuse cases enumerated and mitigated (scraping-for-harassment, doxxing via cross-reference, coordinated false correction) | `SPEC` abuse-case register + `REVIEW` by SPA |
| L7 | Terms, privacy policy, and correction/takedown policy published-ready and owner-approved | `SPEC` + `OWNER` |
| L8 | Nothing raw, private, unreviewed, sensitive, or unsafe is reachable from any public route | `TEST` route audit (every public route serves only reviewed records) + `REVIEW` by SPA |

### 7.2 Evidence / correction package — clears `GOV-#### [98-EVIDENCE]`

| # | Item | Satisfying evidence |
|---|---|---|
| E1 | Evidence coverage per public surface stated as a number and meeting a pre-committed threshold | `DATASET` coverage export + `SPEC` thresholds committed before measurement |
| E2 | Every public claim resolves to a source trail; orphan claims = 0 | `TEST` orphan detector |
| E3 | Source versions preserved with URL, retrieval time, hash, provenance, lineage | `DATASET` + `TEST` round-trip |
| E4 | Old/new comparison renders for every flagged material change in scope | `TEST` + `SCREENSHOT` |
| E5 | Affected-record reprocessing is complete — zero records in `pending-reprocess`, `partially-reprocessed`, `review-pending`, or `failed` within release scope | `DATASET` state census showing 0 in those four states |
| E6 | Correction lineage preserves prior public state rather than overwriting it | `TEST` history-non-decreasing assertion |
| E7 | Deterministic work (discovery, preservation, hashing, versioning, diffing, matching) has no model in the loop | `SPEC` boundary matrix (slot .09 across stages) + `REVIEW` by VSR |
| E8 | Every RV/DG/GS slot on every public surface is correctly typed; no Coming Soon on civic data | `TEST` slot audit + `SCREENSHOT` per public page |
| E9 | Full trace demonstrated live: one changed agenda from detection → every affected work receipt → every review | `RUNLOG` + `REVIEW` by VSR |

### 7.3 Accessibility package — clears `GOV-#### [98-A11Y]`

| # | Item | Satisfying evidence |
|---|---|---|
| A1 | Automated accessibility suite green on every public route | `TEST` |
| A2 | Keyboard-only traversal completes every primary task (find, open source drawer, jump to timestamp, read lens, file correction) | `REVIEW` by UXD with a recorded step list, + `SCREENSHOT` of focus states |
| A3 | Screen-reader pass on the source drawer, trust labels, and diff view — the three highest-risk components | `REVIEW` by UXD |
| A4 | Colour is never the sole carrier of trust/verification state | `TEST` (state→text/icon mapping) + `SCREENSHOT` |
| A5 | Responsive integrity at 1440 / 768 / 390 with no horizontal body scroll | `SCREENSHOT` ×3 per public page + `TEST` |
| A6 | Plain-language pass on trust labels, designed-gap copy, and correction copy | `REVIEW` by NED |

### 7.4 Cost / capacity package — clears `GOV-#### [98-CAPACITY]`

| # | Item | Satisfying evidence |
|---|---|---|
| C1 | Model + reviewer cost per unit of published output, measured not estimated | `DATASET` cost export from the beta and regional runs |
| C2 | Projected monthly cost at the named release scope, against a stated ceiling | `SPEC` with numbers + `OWNER` accepting the ceiling |
| C3 | Storage projection and archival policy for the release scope | `SPEC` |
| C4 | Crawl rate limits and crawl-ethics rules encoded, not just documented | `SPEC` + `TEST` (rate limiter enforced) |
| C5 | Capacity headroom: concurrent users, request latency against the five-minute target, queue depth | `RUNLOG` load test |
| C6 | Backup and recovery exercised — a restore actually performed and verified | `RUNLOG` restore log + `REVIEW` by AOE |
| C7 | Fail-closed behaviour verified under dependency outage (model API down, source host down) | `TEST` (public surface degrades to designed gaps, never to unlabelled or stale-as-fresh content) |

### 7.5 Release review package — clears `GOV-#### [98-RELEASE]`

| # | Item | Satisfying evidence |
|---|---|---|
| R1 | Release **scope** named exactly: which surfaces, which record classes, which states are public | `OWNER` |
| R2 | Release **geography** named exactly (e.g. Alpine only / Star Valley / Lincoln County / statewide) | `OWNER` |
| R3 | Funding and eligibility model named (funded / donated / free / paid per area) | `OWNER` |
| R4 | Communication plan named: what is said, to whom, when, and what is explicitly not claimed | `SPEC` + `OWNER` |
| R5 | Account, notification, and support operations ready for public volume | `SPEC` + `RUNLOG` |
| R6 | Rollback plan: how the public surface is withdrawn within a stated time bound | `SPEC` with the time bound + `TEST` (withdrawal switch exercised in staging) |
| R7 | Packages 7.1–7.4 all cleared | four blocker issues `done` |
| R8 | Isaac's explicit approval, referencing R1–R4 by their recorded values | `OWNER` — the only artifact that may move Stage 98 to `achieved` |

**Nothing in Stage 98 may deploy, publish, invite broad users, activate billing, or contact the
public before R8 exists.** Assembling the packages is permitted; acting on them is not.

---

## 8. Immediate corrective actions implied by this spec

These are consequences of §0.2, listed so they can be filed as issues. This document does not
perform them.

| # | Action | Owner | Rule |
|---|---|---|---|
| 1 | Set ≥1 Stage 5 slot to `active`, or return Stage 5 to `planned` | Stage 5 owner | §3.2 pre-4 |
| 2 | Assign an owner to Stage 5 slot `.16` (currently null) | CEO | §3.2 pre-5 |
| 3 | Reassign Stage 5 producing ownership away from VSR (recommend BCE) | CEO | §3.5 |
| 4 | Reassign Stage 8 producing ownership away from VSR (recommend SPA) | CEO | §3.5 |
| 5 | Give MOTY `2d9611c1` a slot template or reparent it under Stage 6 | FTE + CEO | §3.6 |
| 6 | Create `[Stage N ENTRY]` / `[Stage N EXIT]` issue pairs for all 14 stages and wire §6.3 blockers | AOE | §6.3 |
| 7 | Back-fill receipts `docs/company-os/receipts/stage-{0,1,2,3,4}.md` for the already-achieved stages | each stage owner | §1.3 |
| 8 | Record the Stage 5 and Stage 8 reviewer substitution in their receipt headers before entry | VSR | §3.5 |
