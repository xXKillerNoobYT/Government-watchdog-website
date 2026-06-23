# Stage 4.08 — Reviewer-internal weekly briefing editorial contract (over the 4.05 digest)

> **Issue:** GOV-470 (Stage 4.08 · NewsletterEditor). Reviewer of record: VerificationSafetyReviewer.
> **Governs:** the *editorial layer* — how a human writes one weekly internal briefing **over** the deterministic
> Stage 4.05 digest object (`scripts/stage4_newsletter_digest_assembler.py::assemble_digests`) that the Stage 4.06
> routes render (`docs/stage4-06-newsletter-archive-detail-frontend-contract.md`).
> **Scope (hard):** Town of Alpine only · **reviewer-internal only** · behind the existing gated-beta gate
> (GOV-418/419) · **no public deploy · no email/sender · no real beta accounts · no public marketing · no claim of
> publication readiness · no person-naming beyond on-record officials**.
> **Public deploy stays GOV-420 / Isaac-gated. This contract does not and cannot unblock it (AC#4).**

A contract defines the editorial *behavior*; it is not itself a published briefing. The 4.05 digest is the only
evidence source — this contract adds **plain-language framing and labels**, never new facts. Every editorial sentence
must trace to a digest item id and its `sourceTrail`. No orphan claims.

---

## 0. What this slice owns, and what it must not touch

**Owns:** the editorial format for one reviewer-internal weekly briefing — required sections, the allowed-label
taxonomy (mapped 1:1 onto the frozen digest vocabulary), prohibited language, source-link requirements, correction
handling, and reviewer notes; plus a worked sample outline over the *current* digest.

**Must NOT touch / re-derive (carry Stage 3/4 forward):**
- The digest object or its labels. The briefing **consumes the 4.05 digest verbatim**. It never re-classifies an item,
  upgrades a label, re-sorts, or invents a record. A need to change a label is a pass-up to backend/VSR, not an edit.
- The frozen `ClaimStatus` vocabulary (`STAGE3_CLAIM_VOCAB`) and the locked AI label string
  (`AI_LABEL_TEXT = "AI — not independently verified"`). The briefing introduces **zero new labels** (mirrors EG-7).
- Gating. The briefing is a reviewer-internal work product; it is not a public surface and is never wired to email,
  a sender, a signup, or a public deploy path.

---

## 1. Evidence reality this contract is written against (read first)

The current reviewed Alpine corpus — the verbatim Stage 3.05 card-feed capture that feeds the 4.05 digest
(`src/fixtures/alpine-card-feed.json`, backend `origin/main` HEAD `6d65bd3`, captured 2026-06-20) — contains:

| Bucket | Count | What it means editorially |
|---|---|---|
| `verified` source-backed items | **0** | The briefing has **no "verified fact" items to report** today. |
| `ai_presented` items (auto-caption, untimed, `provenance: grounded`) | **6** | Reportable **only** under the locked AI label; never as fact. |
| `source_missing` gaps | **213** | The dominant, reportable reality: what we cannot yet support. |

**Editorial consequence (binding):** until verified items exist, the weekly briefing's lead content is the
**gap/observation** picture, not a "news" picture. A briefing that reads as confident reporting over this digest is a
contract violation. The honest briefing says: *here are 6 AI-extracted observations awaiting verification, and here is
the large body of evidence we do not yet have.* This is why the briefing stays reviewer-internal (AC#3) and cannot feed
public deploy (AC#4).

---

## 2. Required briefing sections (in order)

One weekly briefing = one digest (`newsletterId` = `alpine-historical-YYYY-WW` | `…-undated`). Render **every** section,
even when empty ("none in this digest this week") — visible gaps are the point, mirroring the 4.06 "row always served"
rule.

| # | Section | Source (4.05 digest key) | Editorial rule |
|---|---|---|---|
| 1 | **Header** | `newsletterId`, `coveragePeriod`, `scope`, `access` | State Alpine, the coverage week (or "undated — record dates incomplete"), and **"Reviewer-internal — not published"** verbatim. Never imply public release. |
| 2 | **What we can support this week** | items with `claimStatus: verified` | Verified, source-backed items only. **If empty (current state): say so explicitly — do not borrow from AI-presented to fill it.** |
| 3 | **AI-extracted observations (not verified)** | `claimStatus: ai_presented` / `itemType: ai_presented_context` / `labels.aiPresented` | Each item under the **locked AI label**, with its confidence (e.g. `auto_caption_untimed`) and provenance shown. Plain summary, no added interpretation. |
| 4 | **Open questions / unverified** | `unverifiedItems`, `needs_human_review`, `speaker_unidentified` | Framed as *questions*, never findings. Unidentified speakers stay unidentified (no name). |
| 5 | **Disputed / conflicting** | `disputed`, `conflicts` | Show both sides from the source record; do not adjudicate. |
| 6 | **Corrections** | `corrections`, `laterOutcomes`, `correctionStatus` | Per §6. Original kept, correction labeled, source for the correction required. |
| 7 | **Evidence gaps & backfill status** | `sourceSetProgress`, `source_missing` items, `knownGaps`, `completionFraming` | Render `completionFraming` as a **gap/status framing — never "complete"** unless the field says so. List categories reviewed and `chronologicalRange`. |
| 8 | **Source trail** | `sourceTrail` | Per §4. Every claim above resolves to a source id here. `localSourcePath` is null and never shown. |
| 9 | **Reviewer notes** | (editorial) | What the editor was unsure about, what to verify next, what was deliberately omitted. For VSR, not for any reader-facing output. |

**Three-lens framing (role workflow):** apply Conservative / Progressive / Libertarian framing **only** to a section-2
(verified) or section-5 (disputed) item that is genuinely contested, and only as labeled perspective grounded in the
same source set. **With zero verified items this week, no lens sections are produced** — lenses must never be hung off
AI-presented or unverified items.

---

## 3. Allowed labels (the only labels an editor may apply)

Labels are **not authored** — they are the digest item's `labels.claimStatus`, surfaced verbatim. The editor's job is to
*carry* the label, never to assign or upgrade one. Allowed values (frozen `STAGE3_CLAIM_VOCAB`):

| Label | Briefing reads as | Editor may place in section |
|---|---|---|
| `verified` | Verified / source-backed | 2 (only) |
| `ai_presented` | **AI — not independently verified** (locked string) | 3 |
| `unverified` / `needs_human_review` | Not verified | 4 |
| `speaker_unidentified` | Speaker unidentified | 4 |
| `disputed` | Disputed (sources conflict) | 5 |
| `corrected` | Corrected (earlier record kept) | 6 |
| `source_changed` | Source changed — re-verify | 7 |
| `source_missing` | Source missing — unsupported | 7 |

- `labels.publicationStatus` (e.g. `draft`) is reviewer-internal state and **must never be rendered as "published"**.
- If an item seems to need a label outside this set, **stop and escalate** — do not invent a label.

---

## 4. Source-link requirements (no orphan claims)

- **Every** editorial sentence cites at least one `sourceId` resolvable in the digest's `sourceTrail`. A sentence with
  no resolvable source id may not appear in the briefing.
- Surface, when present: `sourceType`, `authorityLevel`, `originalUrl`, `archiveUrl`, `scanDate`,
  `timestampSeconds`/`page`/`section`. Prefer the `archiveUrl` when the live URL is stale.
- Run the **source-link validation workflow** (`NEWSLETTER_WORKFLOWS.md`) before a briefing leaves draft: each URL
  marked live / stale (→ substitute Wayback) / orphaned (→ remove the claim or mark
  `[Source unavailable — claim unverified]` and route to VSR).
- `localSourcePath` is always `null`; raw/local paths are never named (web-safe invariant carries from 4.06).
- A briefing item whose only support is an `ai_presented` auto-caption is **not** a sourced fact — it is an AI
  observation (section 3), labeled as such.

---

## 5. Prohibited language (hard stops)

The briefing must NOT:
- State an `ai_presented`, `unverified`, `disputed`, or `source_missing` item as fact, or drop its label.
- Use publication/authority verbs for unverified content: "confirmed", "announced", "the Town decided/voted",
  "as reported", "officially" — unless the underlying item is `verified` and source-backed.
- Name any person who is not an on-record public official tied to the record; never name an `speaker_unidentified`
  source. (Company rule: *no name is better than wrong speaker attribution.*)
- Editorialize beyond the source record, draw legal/accusatory conclusions, or recommend action against any person.
- Imply completeness ("full picture", "everything that happened") — the digest is a known-incomplete backfill.
- Imply public release, subscriber delivery, or publication readiness. The header says **reviewer-internal**.
- Add a number, date, quote, or attribution not present in the digest item / `sourceTrail`.

---

## 6. Correction handling

- Corrections come **from the digest** (`corrections` / `correctionStatus` / `laterOutcomes`) or from a VSR finding —
  the editor never silently rewrites a prior briefing.
- Format (carries `NEWSLETTER_WORKFLOWS.md` correction workflow):
  `[CORRECTION YYYY-MM-DD] Original: "<exact prior text>" → Corrected: "<new text>" — Source: <sourceId/url> — Reason: <brief>`
- The original record is **kept**, never deleted ("earlier record kept"). The corrected briefing re-enters review; no
  re-issue without VSR sign-off.

---

## 7. Reviewer notes (VSR handoff)

Each briefing draft carries a short reviewer-notes block: items the editor was unsure about, any URL that validated
stale/orphaned, any item where the label felt wrong (flagged, not changed), and the explicit confirmation that
**no verified items were upgraded and no person was named**. The draft goes `in_review` to VerificationSafetyReviewer;
nothing in the briefing is treated as approved until VSR signs off. No public/email/deploy step exists in this flow.

---

## 8. Sample internal briefing outline — Alpine, current digest (no invented facts)

> Grounded strictly in `src/fixtures/alpine-card-feed.json` (6 `ai_presented`, 213 `source_missing`, 0 `verified`).
> Every line below is either a real card summary carried verbatim or a structural/gap statement. **No facts added.**

```
ALPINE WEEKLY BRIEFING — Reviewer-internal — NOT published
Coverage: undated (record dates incomplete; capture 2026-06-20) · Scope: Town of Alpine · Access: reviewer_internal

1. WHAT WE CAN SUPPORT THIS WEEK (verified, source-backed)
   — None this week. The reviewed corpus currently has 0 verified items. (Not a slow news week — an evidence gap.)

2. AI-EXTRACTED OBSERVATIONS — AI — not independently verified
   (confidence: auto_caption_untimed · provenance: grounded · 6 items; each awaits source verification)
   • "A Town Council special meeting was convened on October 9, 2024 at approximately 7:01 p.m."   [AI — not verified]
   • "Per the annexation report summary, the Town of Alpine's mill levy is 5 mills."               [AI — not verified]
   • "The Town of Alpine water system was shut down on May 21, 2026 due to a water main break."     [AI — not verified]
   • "The Town Council scheduled a Budget Work Session for Thursday, June 11, 2026 at 2:00 PM."      [AI — not verified]
   • "Bacteriological testing confirmed the water met all safe drinking-water standards before the
      advisory was lifted."                                                                          [AI — not verified]
   • "The council reported it took no action during its executive session before reconvening the
      regular session."                                                                              [AI — not verified]
   (None of the above may be stated as fact, dated reliably, or attributed to a named person.)

3. OPEN QUESTIONS / UNVERIFIED        — none distinct from section 2 this week.
4. DISPUTED / CONFLICTING             — none in this digest.
5. CORRECTIONS                        — none in this digest.

6. EVIDENCE GAPS & BACKFILL STATUS    (the lead story this week)
   • 213 of 219 records are source_missing. Categories of gap to backfill before editorial confidence:
     missing timestamps, missing transcript, no primary source, PDF text unextracted.
   • completionFraming: render verbatim from the digest as gap/status — NOT "complete".
   • All 6 present items share record-date 2026-06-12 (processing date), not their event dates → no reliable
     chronological ordering yet.

7. SOURCE TRAIL — resolve every item above to its sourceId; show originalUrl/archiveUrl where present;
   localSourcePath is null. (Section-2 items currently resolve only to auto-caption provenance, not primary sources.)

8. REVIEWER NOTES (for VSR) — 0 verified items, so no lens framing and no section-1 content was produced.
   No person named. No label upgraded. Section-2 items carried under the locked AI label only.
```

---

## 9. Missing evidence that blocks editorial confidence (AC#3 — routed as follow-up, not publication)

The briefing cannot reach editorial confidence (and therefore cannot approach any public path) until the backend/source
chain supplies, for Alpine:

1. **At least one `verified`, source-backed item** with a resolvable primary `originalUrl` + `archiveUrl` — today there
   are zero. Without this, every weekly briefing is gaps-only.
2. **Primary sources for the 6 AI-presented observations** (meeting minutes/agenda/notice/recording) so they can move
   from `ai_presented` → `verified` or be retired.
3. **Real record/event dates** so digests bucket into actual coverage weeks instead of `…-undated` (present items all
   carry the processing date, not event dates).
4. **A captured 4.05 digest fixture** from a real `assemble_digests(...)` run (the 4.06 contract notes the fixture is not
   yet captured) so the editor writes over the actual digest object, not the upstream card feed.

**Routing:** these are backend/source-archival gaps, owned by the crawler/source/transcript chain — **not** an editorial
fix and **not** a reason to publish thin content. Tracked as a follow-up issue (child of GOV-470) with a blocker noting
that reviewer-internal editorial confidence is gated on verified Alpine evidence. **GOV-420 (public deploy) stays
blocked regardless** — nothing in this contract unblocks it.

---

## 10. Acceptance (gates GOV-470 closeout)

- This contract defines sections, allowed labels, prohibited language, source-link requirements, correction handling,
  and reviewer notes for one reviewer-internal weekly briefing (AC#1). ✅ §2–§7.
- A sample briefing outline over the current digest, inventing no facts beyond verified evidence (AC#2). ✅ §8.
- Missing evidence blocking editorial confidence is identified and routed as a backend/source follow-up, not as a
  publication step (AC#3). ✅ §9 + follow-up issue.
- GOV-420 left blocked; this issue cannot and does not unblock public deploy (AC#4). ✅ stated §0/§9.
- Reviewer of record: VerificationSafetyReviewer signs off before this contract governs any future briefing.
