# Government Watchdog — proposed project descriptions

**Status: PROPOSAL. Nothing in this file has been applied to Paperclip.**
Read-only commands were used to produce it (`project list`, `project get`, `goal list`, `goal get`,
`issue list`, `agent list`, `company list`). No project, goal, or issue was mutated.

Company: Government Watchdog `bcac096e-4aff-4ce3-ad33-c4e0b693b36f`, UI prefix `GOV`.
Written 2026-07-25 against live state. Companion specs: `AGENT-RULEBOOK.md`, `stage-gates.md`,
`beta-release-plan.md` in this directory.

**Test each description has to pass:** an agent that reads *only* the description — no goals, no
issues, no chat history — can decide whether a given piece of work belongs in this project, and if
not, knows which project or agent to file it against instead.

---

## 0. State this proposal was written against

| Project | ID | Status | Issues | Goals linked |
|---|---|---|---|---|
| Government Watchdog Website | `78066972-3f3b-4075-9c1e-2d6817001099` | `in_progress` | 147 | 7 |
| Government Watchdog Backend | `0a1832c4-1556-49a1-bcc5-857f2ca72962` | `in_progress` | 1281 | 10 |
| paperclip Heart Beat manger | `7f07c40a-1438-4bbd-b3db-69eb54e11178` | `planned` | 20 (0 open) | 1 |
| MOVED — Isaac4Alpine Website Maintenance | `5a2564df-ddd3-43df-8ca7-36b532c1e90c` | `cancelled` | 57 (6 open) | 1 |

Stage ladder as of this writing: Stages 0–4 `achieved`; **Stage 5 `active`**; Stages 6, 7, 8, 10,
11, 12, 98 `planned`; there is no Stage 9 goal. Active team goals counted against the 1–5
concurrency budget: **2** — Stage 5 `9d3d7fbd` and MOTY `2d9611c1`.

Two facts that shape every description below:

1. **The Website and Backend descriptions already contain the right boundary language.** The
   substance of both — web-safe records only, no invented civic claims, preserve source versions,
   red-flag late changes, nothing public before Stage 98 — is preserved verbatim or near-verbatim in
   the proposals. What is added is structure (IN SCOPE / OUT OF SCOPE with a named alternate owner),
   the goal roster with a reason per goal, the stage position and its next transition, and a
   project-level definition of done. Nothing is removed.
2. **Out-of-scope bullets always name where the work goes instead.** A bullet that only says "not
   here" produces an orphaned task; a bullet that says "not here — file against X" produces a
   routed one.

---

## 1. Government Watchdog Website — `78066972-3f3b-4075-9c1e-2d6817001099`

### 1.1 Goals actually linked (verified)

| Goal | Status | Why the Website owns it |
|---|---|---|
| `fe3fc35a` Website product experience and trust presentation track | active | This project's primary track — it *is* the browser experience. |
| `2d9611c1` MOTY design — full application across the website | active | Design-of-record application across all ten screens; lives only in the website repo. |
| `6834f0dd` Premium product success criteria and rejection framework | active | The bar that rejects weak demos, orphan claims, unclear status labels — enforced at the render layer. |
| `527b9486` Security, privacy, safety, and publication control system | active | Shared with Backend. Website owns the *render-side* half: gated states, no unreviewed material on screen, no publication implication. |
| `55f432ec` Newsletter, digest, and briefing product track | planned | Shared with Backend. Website owns layout, lens placement, and honesty-tracker surface; generation is backend + gated. |
| `c10c406c` Stage 6 — Alpine private beta and month-end presentation target | planned | The beta is presented through this project; Stage 6 E2 is literally "MOTY merged to `origin/main`". |
| `5e8b8006` 00 — HEAD GOAL | active | Every project links the head goal. |

Note: `2d9611c1` is an active team goal with **zero sub-goals**, so it currently has no gate surface
(stage-gates §3.6). The description below states that as a known open item rather than pretending it
is gated.

### 1.2 Proposed description (exact text to apply)

```
Frontend website project for Government Watchdog. Owns everything a human sees in a browser, and nothing that produces the evidence behind it.

Owns the Simple and Advanced customer experience using web-safe backend records only: timeline-first and agenda-card surfaces, current/foundational party-lens cards, source drawers, before/after source-change comparisons, reprocessing/red-flag status, maps with disclosed methodology, filters, alerts, newsletter presentation, and launch-gate presentation. Design references are layout-only; UI must never invent civic claims or hide incomplete/review-pending state.

IN SCOPE
- Render surfaces: timeline, 11-column civic Kanban, agenda/issue cards, source vault and source drawers, diff viewer, debate player, watchlists, maps, search and filters.
- The three MOTY modes: Reader Mode, Dashboard Mode, private Admin Mode, and the eight-tab shell matching the design IA.
- The RV / DG / GS binding contract at every information slot, plus the "Coming Soon" chip for unbuilt FEATURES only.
- Trust presentation: receipts drawer, "What changed?", "Why am I seeing this?", Plain-English/Official/Side-by-side toggle, "Verify this issue" proof page, correction button entry point, verification-manifest display.
- Client-side primitives with no civic semantics: modal, chip, device-local store, kanban, timeline lanes, code-computed diff view.
- Accessibility, responsive behavior at 1440/768/390, print/email-friendly Reader Mode, and the frontend test suite (Vitest).
- Beta presentation readiness for the Alpine private beta cohort.
- Repo: https://github.com/xXKillerNoobYT/Government-watchdog-website (TypeScript + Vite, no framework).

OUT OF SCOPE — file against the named owner instead
- Source discovery, crawling, preservation, hashing, versioning, diff computation, normalization, matching, tagging: Government Watchdog Backend (0a1832c4-1556-49a1-bcc5-857f2ca72962).
- Any trust, confidence, coverage, or verification value the frontend would have to compute: Backend. The frontend renders backend-supplied trust verbatim or renders an explicit gap. It never recomputes.
- Lens text generation and newsletter body generation: Backend + NewsletterEditor, and currently held under the GOV-545 Option A hold (deferred slots 5.08 / 5.09 / 5.11). Website may build the layout that will hold that output; it may not generate it.
- Auditor thresholds, badge issuance, identity separation: Backend, Stage 8 track (2d8c4151).
- Isaac Aznoe for Mayor campaign site work: the Isaac4Alpine company (26683153-85d3-440a-a2e9-9ebc0b8f63c2, prefix ISA), project Isaac4Alpine Website (902f97ed-01f3-437f-bd33-d78dcbb221ac).
- Paperclip heartbeat/pacer/cluster tooling: WPR2 Dev company, project Paperclip Plugin Sub Management (85d78df9-abd8-45d4-a56f-1b82519e34c9).
- Deployment to a public origin, public DNS, or public invite: Stage 98 owner gate (75434c93). Not this project, not any agent.

GOALS THIS PROJECT SERVES
- fe3fc35a Website product experience and trust presentation track — the project's primary track.
- 2d9611c1 MOTY design — full application across the website — design-of-record, vendored at design/baseline/moty-government-watchdog-2026-07/.
- 6834f0dd Premium product success criteria and rejection framework — the bar every surface is judged against.
- 527b9486 Security, privacy, safety, and publication control system — render-side half: gated states, no unreviewed material on screen.
- 55f432ec Newsletter, digest, and briefing product track — layout and honesty-tracker surface only; generation is Backend and gated.
- c10c406c Stage 6 — Alpine private beta — Stage 6 entry condition E2 is the MOTY merge to origin/main.
- 5e8b8006 HEAD GOAL.

CURRENT STAGE AND NEXT TRANSITION
Position: Stages 0-4 achieved. MOTY (2d9611c1) is active and is this project's live work. Stage 6 (c10c406c) is planned and is the next stage this project owns.
Known gap: MOTY is an active team goal with zero sub-goals, so it has no gate surface. It must either receive the slot template (minimum .01, .02, .06, .10, .11, .14) or be reparented as a slot under Stage 6 before it can exit. See docs/company-os/stage-gates.md section 3.6.
Stage 6 ENTRY needs, in addition to the seven standard entry preconditions: Stage 5 achieved (E1); the MOTY work merged to origin/main with a recorded merge sha (E2); and a beta cohort list of 2, then 3, then 15 with per-person consent recorded (E3). Stage 6 EXIT is producer-then-reviewer: the owner commits docs/company-os/receipts/stage-6.md covering X1-X11, VerificationSafetyReviewer independently re-resolves every locator, SecurityPrivacyAgent co-signs X7-X9, and only the reviewer sets the goal achieved.

DEFINITION OF DONE FOR THIS PROJECT
1. Every one of the ten MOTY screens renders at baseline fidelity, and every information slot on every screen is a Reviewed Value, an explicit Designed Gap, or Gated Synthetic fixture content - a slot audit test proves zero bare placeholders and zero "Coming Soon" markers sitting on civic data.
2. Automated accessibility passes at 1440/768/390 and the Vitest suite is green on main.
3. A reader can, from the browser alone, answer: what happened, what was known then, what later changed, and which sources support each claim - without the UI ever presenting AI or unverified material as settled fact.
4. Stage 6 is achieved by reviewer PASS with a committed receipt.
5. The site remains unpublished. Reaching this definition of done authorizes no deployment.

HARD CONSTRAINTS SPECIFIC TO THIS PROJECT
- RV / DG / GS: every information slot renders exactly one of a Reviewed Value, an explicit Designed Gap, or Gated Synthetic fixture content. Gated Synthetic requires all three of: reviewer-internal access, the fixture flag set, and a visible "SYNTHETIC DESIGN FIXTURE" banner.
- "Coming Soon" is only ever a marker for an unbuilt FEATURE. Missing civic DATA always uses designed-gap copy. This is not a style preference; a Coming Soon marker on civic data is a correctness bug.
- The frontend never recomputes trust. It renders what the backend supplies, verbatim, or it renders an explicit gap.
- Design references are layout-only. A design comp is never a source for a civic claim.
- MOTY design-of-record is the baseline vendored at design/baseline/moty-government-watchdog-2026-07/ (established by commit 0e0795e / PR #39, extended by PRs #40-#43; owner zip confirmed byte-identical sha256 c2da1ae0... on 2026-07-24). Isaac's direction on GOV-1520: keep that level of detail.
- No surface may imply public availability. Public release is the Stage 98 owner gate and requires explicit owner approval; beta progress implies nothing about it.
```

### 1.3 What changed and why

- Kept verbatim: the "web-safe backend records only" sentence, the surface list, "Design references
  are layout-only; UI must never invent civic claims or hide incomplete/review-pending state", and
  the Stage 98 sentence. These were already the strongest part of the description.
- Added: the opening boundary sentence ("owns everything a human sees … nothing that produces the
  evidence"), which is the one-line version an agent can route on.
- Added: OUT OF SCOPE with six named alternate owners, including the two cross-company routes
  (Isaac4Alpine, WPR2 Dev) that agents currently have no way to discover from the description.
- Added: the goal roster with a one-line reason each, so an agent can tell why `55f432ec` appears
  here as well as on Backend.
- Added: stage position, the MOTY no-gate-surface gap, Stage 6 entry/exit conditions, project-level
  done, and the constraint block.

---

## 2. Government Watchdog Backend — `0a1832c4-1556-49a1-bcc5-857f2ca72962`

### 2.1 Goals actually linked (verified)

| Goal | Status | Why the Backend owns it |
|---|---|---|
| `ce908143` Backend civic evidence platform and crawler/tooling track | planned | The project's primary track. |
| `9d3d7fbd` Stage 5 — Corrections, hot-topic detection, Wayback verification | **active** | The one stage this project is executing right now. |
| `b1d69179` Transcript, statement, and exact-evidence track | planned | Exact-evidence anchoring is a backend data model, not a render concern. |
| `2d8c4151` Human verification, auditor, correction, and community trust track | planned | Auditor thresholds and identity separation are storage/serialiser problems (Stage 8). |
| `31744b17` Security testing, abuse-case, and privacy regression program | active | The test program runs against backend serialisers and pipelines. |
| `527b9486` Security, privacy, safety, and publication control system | active | Shared with Website. Backend owns the *gate* half: what may leave storage at all. |
| `55f432ec` Newsletter, digest, and briefing product track | planned | Shared with Website. Backend owns generation and source-trail enforcement. |
| `ead53ca1` Focused-area expansion control: Alpine → Star Valley/Lincoln → Wyoming | planned | Expansion is a contract-portability question about crawlers and jurisdiction models. |
| `a44b4936` Planning source and board backup continuity | active | Also linked to the Heart Beat project; see §3 — Backend should be its sole home. |
| `5e8b8006` 00 — HEAD GOAL | active | Every project links the head goal. |

### 2.2 Proposed description (exact text to apply)

```
Backend, core, crawler, and API project for Government Watchdog. This is the workhorse: it produces every fact the product is allowed to show, and it decides what may leave storage at all.

Owns official source discovery, source-version preservation and diffs, chronology, deterministic normalization/tagging/linkage, transcript/video provenance, signed webhook/event ingestion, ordered work receipts, independent stage reviews, six isolated current/foundational lens runs, cost/capacity metering, web-safe APIs, and portable scale contracts.

A material late agenda/source change is a red flag: preserve both versions, compute before/after, identify affected records, and reprocess/review all affected work without overwriting history. No raw or unreviewed data and no AI output is public by default.

IN SCOPE
- Deterministic evidence spine, all in code with no model in the loop: discovery, fetch, raw preservation, SHA-256 hashing, versioning, before/after diff, normalization, matching, linkage, tagging, gap detection, resumable oldest-to-newest runs.
- Source registry: per-version URL, retrieval time, hash, provenance, first/last seen, last changed, extraction version, prior versions, typed supersession and correction lineage.
- Change handling: materiality rules written as code-checkable rules, red-flag detection, affected-record lineage, targeted invalidation and reprocessing, fail-closed completion state.
- Transcript, statement, and exact-evidence models with conservative speaker attribution.
- The six isolated interpretation lenses (Republican, Liberal, Libertarian x current/foundational): the runner, the isolation guarantee, versioning, costing, and fail-closed behavior.
- Publication gate: the risk ladder L0 auto-publish / L1 caution label / L2 human review / L3 never auto-publish, the public serialiser field allowlists, and the web-safe API surface the website reads.
- Auditor pools, verification thresholds, badge lifecycle, and the private-identity separation boundary.
- Newsletter, digest, and pre-meeting briefing generation with source-trail enforcement and orphan-claim detection.
- Signed webhook and routine ingestion with provable ordering; work receipts; cost and capacity metering.
- Backfill and expansion tooling, and the portability contracts that let Alpine's model be reused for Star Valley / Lincoln County and then Wyoming.
- Repo: https://github.com/xXKillerNoobYT/Government-watchdog.

OUT OF SCOPE — file against the named owner instead
- Any browser surface, layout, component, style, or accessibility work: Government Watchdog Website (78066972-3f3b-4075-9c1e-2d6817001099).
- Deciding how a value is displayed, labelled in the UI, or laid out on a card: Website. Backend decides what the value is and whether it may be shown at all.
- Campaign work of any kind: the Isaac4Alpine company (26683153-85d3-440a-a2e9-9ebc0b8f63c2, prefix ISA).
- Paperclip heartbeat, pacer, budget, or multi-host cluster tooling: WPR2 Dev company, project Paperclip Plugin Sub Management (85d78df9-abd8-45d4-a56f-1b82519e34c9).
- Public deployment, public API exposure, paid access, billing activation, or broad crawling: Stage 98 owner gate (75434c93). Assembling the packages is permitted; acting on them is not.
- Live crawling beyond the currently authorized corpus: still gated. The authorized corpus is the local Town of Alpine archive per the GOV-612 ladder. Widening it is an owner decision, not an engineering one.

GOALS THIS PROJECT SERVES
- ce908143 Backend civic evidence platform and crawler/tooling track — the primary track.
- 9d3d7fbd Stage 5 — Corrections, source-version change detection, and verification — the stage currently active.
- b1d69179 Transcript, statement, and exact-evidence track — exact-evidence anchoring is a data model, not a render concern.
- 2d8c4151 Human verification, auditor, correction, and community trust track — thresholds and identity separation are storage and serialiser problems.
- 31744b17 Security testing, abuse-case, and privacy regression program — the suite runs against backend serialisers and pipelines.
- 527b9486 Security, privacy, safety, and publication control system — gate half: what may leave storage.
- 55f432ec Newsletter, digest, and briefing product track — generation and source-trail enforcement.
- ead53ca1 Focused-area expansion control — expansion is a question about crawler and jurisdiction-model portability.
- a44b4936 Planning source and board backup continuity — Paperclip stays the operative control plane; goal/board state must be recoverable.
- 5e8b8006 HEAD GOAL.

CURRENT STAGE AND NEXT TRANSITION
Position: Stages 0-4 achieved. Stage 5 (9d3d7fbd) is active and is this project's live work. Stage 7 (fbd4665c) and Stage 8 (bad2cdb3) are the next stages this project owns; both are planned and both are hard-blocked on Stage 5.
Stage 5 currently sits in a defective active state and must be repaired before it can exit: all 16 sub-goal slots are still planned (at least one must be active for the stage to be legitimately active), slot 5.16 has a null ownerAgentId, and VerificationSafetyReviewer is both the producing owner and the mandated independent reviewer. Recommended fixes: set at least one slot active, name an owner for 5.16, reassign producing ownership to BackendCrawlerEngineer (f26f530c), and record the reviewer substitution in the receipt header before entry. See docs/company-os/stage-gates.md sections 2.5, 3.5, and 8.
Stage 5 EXIT is producer-then-reviewer, in this order: the owner sets all slots achieved and commits docs/company-os/receipts/stage-5.md with one row per exit criterion X1-X11 carrying evidence kind, locator, producer, slot, verified-by and verified-at; the owner moves the [Stage 5 EXIT] issue to todo and never touches the goal status; VerificationSafetyReviewer independently re-resolves every locator and posts PASS, PARTIAL, or FAIL; only on PASS does the reviewer set the goal achieved.
There is no Stage 9 goal. The 8-to-10 gap is real, not a data error - the 14 "Stage N.09 - Automation vs AI boundary matrix" slots are what make it look otherwise.

DEFINITION OF DONE FOR THIS PROJECT
1. The deterministic evidence spine runs end to end for Alpine - discovery, preservation, hash, version, diff, normalize, link, tag, receipt - resumable, re-runnable, and producing identical output on a re-run of the same corpus.
2. Stages 1, 2, 3, 4 and 5 each have a committed receipt under docs/company-os/receipts/ whose locators a reviewer other than the producer has independently re-resolved.
3. A changed agenda can be traced from source detection through every affected work receipt and review, and no comparison is ever marked complete while an affected stage or lens is pending, failed, or unreviewed.
4. Every read the website performs goes through a web-safe API that carries backend-computed trust; no raw, private, unreviewed, sensitive, or unsafe record is reachable through any public path.
5. The same contracts run unchanged for a second jurisdiction (Star Valley / Lincoln County) without a schema change - that is what makes the expansion goal real rather than aspirational.
6. Stage 98 release packages are assembled and reviewable. They are not acted on.

HARD CONSTRAINTS SPECIFIC TO THIS PROJECT
- Deterministic work has no model in the loop. Discovery, preservation, hashing, versioning, diffing, and matching are code. AI is for explanation and draft analysis, always labelled, always with receipts.
- The six lenses share canonical evidence and never see each other's output. Lens isolation is an asserted test, not a convention.
- A political lens or unsupported model output can never change facts, sources, verification state, or publication state.
- Source versions are preserved, never overwritten. Prior user-facing state is superseded with correction lineage, and the history record count never decreases across a correction.
- Publishing rules, adopted verbatim: no source no claim; no exact citation no quote; no official-action claim without an official record; no broken-promise label without both a promise source and an action source; no criminal or corruption claim unless directly sourced from official or legal records; unclear items say "unclear"; low-confidence output is labelled.
- AI lane-2 steps of the 15-step flow (classify, summarize, lenses - steps 7-9) are NOT authorized. They sit under the GOV-545 Option A hold as deferred slots 5.08 / 5.09 / 5.11. Requirement enrichment does not reopen them.
- Never store personal, subscriber, payment, or unverified data immutably in the proof layer.
- Fail closed. When a gate cannot be evaluated, the answer is no.
```

### 2.3 What changed and why

- Kept verbatim: the ownership sentence (source discovery through portable scale contracts), the
  material-late-change red-flag paragraph, and the "no raw/unreviewed data or AI output is public by
  default / Stage 98" close. All three were already precise.
- Added: the routing sentence at the top ("produces every fact the product is allowed to show, and
  decides what may leave storage at all") — this is the Website/Backend boundary in one line.
- Added: the explicit Website↔Backend split rule ("Backend decides what the value is and whether it
  may be shown at all; Website decides how it is displayed"), which is the ambiguity that actually
  causes misfiled issues.
- Added: the GOV-612 crawl-corpus gate and the GOV-545 Option A hold as *constraints in the
  description*, not just as goal text an agent may never read.
- Added: the no-Stage-9 note, because agents repeatedly read the `.09` slots as a missing stage.

---

## 3. paperclip Heart Beat manger — `7f07c40a-1438-4bbd-b3db-69eb54e11178`

### 3.1 Findings

Current description, in full: `I do have this in the other company as well but want it here&#x20;`
— that is 51 characters, an HTML entity, and no boundary of any kind.

Evidence gathered:

| Signal | Value |
|---|---|
| Issues | 20 total. **19 `done`, 1 `cancelled` (GOV-181). Zero open.** |
| Date range | 2026-06-15 → 2026-06-25. Nothing in a month. |
| Content | GOV-167 through GOV-189 + GOV-223, GOV-547 — the Heartbeat Manager v1 milestone chain (M1 usage adapter, M2 pacer/budget, M3 trigger engine, M4 cluster coordinator, M5 provider-usage adapter, M6 orchestrator daemon + plugin packaging) and its cluster follow-ups. Complete. |
| Project status | `planned` — despite all its work being finished. |
| Repo binding | `https://github.com/xXKillerNoobYT/Paperclip-AI-Heartbeat-manger/pulls` — a `/pulls` **web page path**, not a clonable repo URL. Paperclip has therefore resolved `repoName` to `pulls` and provisioned a managed checkout folder literally named `pulls`. The binding is broken. |
| Duplicate | The same tooling has a healthy home: **WPR2 Dev** company `803d6ebd`, project **Paperclip Plugin Sub Management** `85d78df9-abd8-45d4-a56f-1b82519e34c9`, 48 issues, `in_progress`, repo URL correct (`.../Paperclip-AI-Heartbeat-manger`, no `/pulls`). |
| Sole goal | `a44b4936` Planning source and board backup continuity — **already also linked to the Backend project**, so archiving strands nothing. |

The stated reason for the project's existence ("I do have this in the other company as well but want
it here") is a *visibility* wish, not a scope. It was satisfied once, in June, by the v1 milestone
chain; the chain closed; nothing replaced it. The live tooling continues in WPR2 Dev against the
repo URL that actually works.

### 3.2 Recommendation: **ARCHIVE**

Four independent reasons, any one of which would be sufficient:

1. **No open work and none pending.** 19 done, 1 cancelled, 0 open, nothing new in a month.
2. **Duplicate of an active project in another company** that has the correct repo binding and 48
   issues of live work. Two homes for one codebase is exactly the ambiguity these descriptions exist
   to remove.
3. **Broken codebase binding.** The `/pulls` URL means any agent that checks this project out gets a
   directory named `pulls` and no working remote. Fixing it would only recreate the duplicate.
4. **Nothing is stranded.** Its one goal `a44b4936` is already linked to Backend, which is where
   "Paperclip stays the operative control plane" belongs — that goal is about *Government Watchdog's*
   planning state, not about the heartbeat daemon's source code.

**Counter-argument considered and rejected:** heartbeats are load-bearing Paperclip mechanics, so it
is tempting to keep a heartbeat project inside every company. But this project never *ran* GOV's
heartbeats — it built the manager, once, and the manager is maintained in WPR2 Dev. Keeping an empty
mirror does not make heartbeats more reliable; it makes the next heartbeat issue land in the wrong of
two places 50% of the time.

### 3.3 If the owner archives (recommended) — retirement description to apply

Apply this text, then `--status cancelled` and `--archived-at <now>`. It follows the same retirement
pattern already used successfully on the Isaac4Alpine project.

```
ARCHIVED 2026-07-25. Government Watchdog does not maintain the Paperclip heartbeat manager; WPR2 Dev does.

Why this project existed: it mirrored the Heartbeat Manager v1 build into the Government Watchdog company for visibility. That build completed. All 20 issues here are closed (19 done, GOV-181 cancelled), the last of them on 2026-06-25, and the milestone chain GOV-167 through GOV-189 plus GOV-223 and GOV-547 covers M1 usage adapter, M2 pacer/budget planner, M3 trigger engine, M4 multi-computer coordinator, M5 provider-usage adapter, and M6 orchestrator daemon plus plugin packaging. Nothing is outstanding.

Live home for this tooling: company WPR2 Dev (803d6ebd-cc2a-415f-8bbf-6a800fa36d20), project Paperclip Plugin Sub Management (85d78df9-abd8-45d4-a56f-1b82519e34c9), repo https://github.com/xXKillerNoobYT/Paperclip-AI-Heartbeat-manger. That project holds the correct repo binding; this one was bound to a /pulls web-page URL and never had a working checkout.

Government Watchdog agents: file heartbeat, pacer, budget, cluster-coordination, and plugin-packaging work in WPR2 Dev. Do not open it here.

The goal this project carried, a44b4936 Planning source and board backup continuity, is NOT retired. It stays active and is served by Government Watchdog Backend (0a1832c4-1556-49a1-bcc5-857f2ca72962) — that goal is about keeping Paperclip the operative control plane for Government Watchdog planning, goal, and backup state, which is a Government Watchdog concern and not a heartbeat-daemon concern.
```

### 3.4 If the owner keeps it instead — minimum viable description

Only apply this if the owner intends the project to become GOV's heartbeat-operations surface. It
also requires two repairs the description cannot make on its own: fix the repo URL to
`https://github.com/xXKillerNoobYT/Paperclip-AI-Heartbeat-manger` (drop `/pulls`), and set status
`in_progress` or leave `planned` deliberately.

```
Government Watchdog's operations surface for Paperclip heartbeat scheduling — the local mirror of the heartbeat manager, kept here so GOV heartbeat behavior can be tuned without opening the WPR2 Dev company.

IN SCOPE
- GOV-side heartbeat cadence, pacing, and budget configuration.
- Diagnosing GOV heartbeat liveness incidents and stuck-issue-graph incidents.
- Verifying that GOV agents wake, check out, and dispose correctly.

OUT OF SCOPE — file against the named owner instead
- Heartbeat manager source code, milestones, packaging, and cluster coordination: WPR2 Dev company (803d6ebd-cc2a-415f-8bbf-6a800fa36d20), project Paperclip Plugin Sub Management (85d78df9-abd8-45d4-a56f-1b82519e34c9). This project consumes that tool; it does not develop it.
- Government Watchdog product work of any kind: the Website (78066972) or Backend (0a1832c4) project.

GOAL THIS PROJECT SERVES
- a44b4936 Planning source and board backup continuity — heartbeat reliability is what keeps Paperclip the operative control plane; if agents do not wake, goal state stops being live.

CURRENT STAGE AND NEXT TRANSITION
Not a staged project. It carries no Stage goal and produces no stage receipt. It has no ENTRY or EXIT gate and never blocks a stage transition.

DEFINITION OF DONE
Standing operations, not a finite deliverable. Healthy state: GOV agents wake on schedule, every liveness incident has a closed recovery issue, and no GOV issue sits blocked on a heartbeat failure for more than one heartbeat interval.

HARD CONSTRAINTS
- Never modify Paperclip permissions, agent configuration, or company settings from here to work around a stuck issue. Escalate to the owner instead.
- This project may not be used as a place to park Government Watchdog product work that has no obvious home.
```

---

## 4. MOVED — Isaac4Alpine Website Maintenance — `5a2564df-ddd3-43df-8ca7-36b532c1e90c`

### 4.1 Findings — the move already happened, and the description has drifted

The campaign move is **already executed**, not pending. Live state:

- Project renamed to `MOVED — Isaac4Alpine Website Maintenance`, status `cancelled`,
  `archivedAt: null` (deliberately still visible).
- Root goal `746b65e6` renamed `MOVED — Isaac4Alpine campaign (now its own company)`, status
  `cancelled`.
- Destination confirmed live: company **Isaac4Alpine** `26683153-85d3-440a-a2e9-9ebc0b8f63c2`
  (prefix `ISA`), project **Isaac4Alpine Website** `902f97ed-01f3-437f-bd33-d78dcbb221ac`, root goal
  `d5e0d63e`, lead **Bill — Campaign Manager** `5d5048b1`. That project currently has **0 issues**.
- The existing retirement description is already good — it explains the separation rationale
  (budget, goals, contact lists, and books stay structurally separate) and, unusually well, explains
  why the residual issues were *deliberately* left behind rather than migrated.

**But it has drifted in one material way, and that drift will mislead an agent:**

| Description says | Live state says |
|---|---|
| "32 issues stay linked to this project" | 57 issues are linked |
| "4 of them still open — GOV-821, GOV-1596, GOV-806, GOV-1597" | **6** are open |
| — | `GOV-1590` (backlog, BCE) is open and unnamed |
| — | `GOV-1585` (blocked, CEO) is open and unnamed |

`GOV-1585` — *"Get upto date with the Changs that has happened"*, assigned to **CEO** `e618342a`,
status `blocked` — is **not campaign work at all**. It is a generic company-orientation issue that
landed in a cancelled campaign project, which means it is now invisible in every reasonable view of
active work. That is a routing bug, not a content problem.

`GOV-1590` is legitimate residual work: it is the authoring step that feeds `GOV-821`, in the same
cross-meeting-linking family as the four issues that *are* named, and owned by
BackendCrawlerEngineer. It belongs in the "deliberately left behind" list; it was simply created
after the list was written.

### 4.2 Recommendation: **KEEP (do not archive yet), refresh the description, re-file GOV-1585**

- **Do not archive while 6 issues are open.** Archiving hides them, and five of them are real,
  90%-complete engineering work owned by GOV agents (BCE authors ledger data, CTO owns writer and
  schema, FrontendTimelineEngineer owns the renderer). The Isaac4Alpine company has no engineering
  staff, so re-filing them under Bill would strand them — the existing description already reasons
  this out correctly and that reasoning still holds.
- **Refresh the counts and name all six open issues**, so the description matches reality and an
  agent reading it can see the full residual set.
- **Move `GOV-1585` out of this project** before applying — it is CEO orientation work, not campaign
  work, and should sit against the Website or Backend project (or no project). Once it moves, the
  residual set is a clean 5-issue cross-meeting-linking cluster. The description below is written
  for the post-move state and names GOV-1585's relocation explicitly so the change is auditable.
- **Archive condition:** when all remaining GOV issues close, set `archivedAt`. Until then it stays
  `cancelled` and visible.

### 4.3 Proposed description (exact text to apply)

```
RETIRED 2026-07-25. Moved to the Isaac4Alpine company so campaign budget, goals, contact lists, and books stay structurally separate from Government Watchdog product work.

New home: company Isaac4Alpine (26683153-85d3-440a-a2e9-9ebc0b8f63c2, prefix ISA), project Isaac4Alpine Website (902f97ed-01f3-437f-bd33-d78dcbb221ac), root goal d5e0d63e-1f9d-4337-bcb7-53755568d816, lead Bill — Campaign Manager (5d5048b1-3d2c-43e1-843c-c87f96491539).

New campaign work opens in ISA. Do not open new campaign issues here.

IN SCOPE (residual only, nothing new)
- Finishing the cross-meeting-linking cluster listed below, under its existing GOV identifiers, then closing.

OUT OF SCOPE
- Every new campaign task — site content, messaging, events, contacts, budget, books: the Isaac4Alpine company (prefix ISA).
- Government Watchdog product work: the Website (78066972-3f3b-4075-9c1e-2d6817001099) or Backend (0a1832c4-1556-49a1-bcc5-857f2ca72962) project. This project is not a parking place for unrouted work.

DELIBERATELY LEFT BEHIND: 57 issues stay linked to this project, 5 of them still open. They are not orphans. They are owned by Government Watchdog engineering agents (BackendCrawlerEngineer authors the ledger data, CTO owns the writer and schema, FrontendTimelineEngineer owns the renderer), and the Isaac4Alpine company has no engineering staff. Re-filing them under Bill would strand work that is already 90 percent done. They finish here, under their existing GOV identifiers, then close.

The open residual set, all one cross-meeting-linking cluster:
- GOV-821 (blocked, FrontendTimelineEngineer) — cross-meeting linking on Town agenda cards, Isaac design direction. The code pipeline is done and verified; it is waiting on data.
- GOV-1596 (backlog, BackendCrawlerEngineer) — author verified cross_meeting ledger entries from official records; the data lane split out of GOV-821.
- GOV-1590 (backlog, BackendCrawlerEngineer) — author the first cross_meeting ledger entry from an official record; feeds GOV-821's data acceptance.
- GOV-806 (backlog, FrontendTimelineEngineer) — the original cross-meeting-linking request from Isaac (GOV-796).
- GOV-1597 (todo, BackendCrawlerEngineer) — liveness-incident recovery issue for GOV-821.

RELOCATED: GOV-1585 ("Get upto date with the Changs that has happened", CEO) was filed here by mistake. It is company-orientation work, not campaign work, and has been moved out of this project so it is not hidden inside a cancelled project.

DEFINITION OF DONE FOR THIS PROJECT
All five residual issues closed. At that point this project is set archivedAt and disappears from the board. It is deliberately left un-archived until then so the open work stays visible.

Everything opened after 2026-07-25 goes to ISA.
```

### 4.4 What changed and why

- Kept verbatim: the retirement header, the separation rationale, the new-home identifiers, and the
  entire "deliberately left behind" argument — that reasoning is correct and is the most valuable
  thing in the current text.
- Corrected: `32 issues` → `57`, `4 open` → `5` (after GOV-1585 is moved out).
- Added: the two previously unnamed open issues, with owner and status per issue, so the residual
  set is fully enumerated rather than partially.
- Added: an explicit archive condition and definition of done, so a future agent knows *when* this
  project may finally be archived instead of guessing.
- Added: a bullet stating this project is not a parking place for unrouted work — that is what
  GOV-1585 revealed.

---

## 5. Cross-cutting observations (not part of any description)

These surfaced while reading state. They are recorded here for the owner; this file performs none of
them.

1. **`59fd6f5e` "Goal/spec governance and 800+ line package program" is `active` and linked to no
   project.** It is the only active goal with no project home. Candidates: Backend (closest existing
   home), or a new lightweight "Company OS / governance" project alongside
   `docs/company-os/`. Worth a decision either way — an active goal with no project is invisible in
   project-scoped views.
2. **11 of the 13 top-level Stage goals are linked to no project**, including all the achieved ones
   (Stages 0–4) and every future stage (7, 8, 10, 11, 12, 98). Only Stage 5 (Backend) and Stage 6
   (Website) are project-linked. If stage receipts are meant to be discoverable from a project, the
   remaining stages need linking to whichever project owns their production.
3. **`docs/company-os/` lives in the *website* repo** while most of what it governs is backend work.
   That is workable, but the Backend description should probably eventually state where receipts are
   committed. Left out of this draft pending an owner decision on whether the governance docs move.
4. **Stage 5 defects** (all 16 slots `planned`, `.16` owner null, VSR owning and reviewing) are named
   in the Backend description rather than silently omitted, so an agent reading only the description
   still learns the stage is not in a clean active state.

---

## 6. Apply commands — DO NOT RUN until the owner approves

Recorded for convenience. Each `--description` takes the exact fenced text from the matching section
above.

```sh
C=bcac096e-4aff-4ce3-ad33-c4e0b693b36f

# 1. Website
paperclipai project update 78066972-3f3b-4075-9c1e-2d6817001099 -C $C \
  --description "$(cat website-description.txt)"

# 2. Backend
paperclipai project update 0a1832c4-1556-49a1-bcc5-857f2ca72962 -C $C \
  --description "$(cat backend-description.txt)"

# 3a. Heart Beat manger — RECOMMENDED: archive
paperclipai project update 7f07c40a-1438-4bbd-b3db-69eb54e11178 -C $C \
  --description "$(cat heartbeat-retired.txt)" \
  --status cancelled \
  --archived-at 2026-07-25T00:00:00Z

# 3b. Heart Beat manger — ONLY IF the owner keeps it (also fix the repo URL: drop the /pulls suffix)
# paperclipai project update 7f07c40a-1438-4bbd-b3db-69eb54e11178 -C $C \
#   --description "$(cat heartbeat-kept.txt)"

# 4. Isaac4Alpine — refresh only; do NOT set --archived-at while issues are open.
#    Move GOV-1585 out of this project BEFORE applying, since the text says it was moved.
paperclipai project update 5a2564df-ddd3-43df-8ca7-36b532c1e90c -C $C \
  --description "$(cat isaac4alpine-retired.txt)"
```
