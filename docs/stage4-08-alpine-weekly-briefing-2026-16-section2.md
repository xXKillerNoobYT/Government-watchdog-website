# Alpine Weekly Briefing — `alpine-historical-2026-16` — Section 2 (verified) draft

> **Issue:** GOV-492 (Stage 4.08 · NewsletterEditor). **Reviewer of record: VerificationSafetyReviewer.**
> **Governs / written against:** the Stage 4.08 editorial contract
> (`docs/stage4-08-newsletter-editorial-contract.md`, GOV-470) over the deterministic Stage 4.05 digest
> (`scripts/stage4_newsletter_digest_assembler.py::assemble_digests`).
> **Scope (hard):** Town of Alpine only · **reviewer-internal only** · behind the existing gated-beta gate ·
> **no public deploy · no email/sender · no real beta accounts · no publication-readiness claim · no person-naming.**
> **Public deploy stays GOV-420 / Isaac-gated. This draft does not and cannot unblock it.**

This draft delivers the **section-2 (verified) briefing item** that GOV-470 §9 item #1 was waiting on. The backend
data dependency is now satisfied: PR #85 (GOV-488 Stage 5.04 record verifier/producer) is squash-merged to crawler
`main` at `6c724147` (2026-06-23), driving **≥1 Alpine record to `verified`** end-to-end through
`read_api.reviewer_internal_records` → 4.05 `assemble_digests(...)` into bucket `alpine-historical-2026-16`
(1 verified item; the other 6 stay `ai_presented`).

Every line below is carried **verbatim** from that digest item or is a structural/provenance statement. **No facts added.**

---

## Provenance of this draft (how the verified item was obtained — not a committed fixture)

The verified item is produced at runtime, not stored. Reproduction (crawler repo `main` @ `6c724147`):

1. Seed the reviewer-internal Alpine corpus (one reviewed, source-backed-but-not-yet-grounded record + 6 unsourced
   `ai_presented` observations — the GOV-477 "0 verified items" starting state), per
   `tests/test_gov488_stage5_record_verify.py::_seed`.
2. Run the Stage 5.04 producer `scripts/stage5_record_verifier.py` (`verify_record(...)`): it records the preserved
   raw predecessor (a `documents` child carrying the content `sha256`; raw bytes/path stay backend-only and never
   reach a served body) → `raw_linked` → provenance turns `grounded` → the record composes to `verified` through
   `stage3_card_feed._compose_record_status`. No URL, date, or hash is fabricated.
3. Feed `read_api.reviewer_internal_records(conn)` into 4.05 `assemble_digests(conn)`; the verified item lands in
   bucket `alpine-historical-2026-16` as item id `alpine-newsletter-item-003`.

Digest envelope confirmed: `scope: alpine`, `access: reviewer_internal`. Bucket `alpine-historical-2026-16` holds
**7 items: 1 `verified` + 6 `ai_presented`** (matching the GOV-489 VSR-audited shape).

---

## Section 2 — WHAT WE CAN SUPPORT THIS WEEK (verified, source-backed)

> Contract §2 / §3: section 2 carries only items whose `labels.claimStatus == verified`, labels carried **verbatim**
> from the digest — never authored, never upgraded.

**[VERIFIED — source-backed]**  *(digest item `alpine-newsletter-item-003` · card `c1_257498426c846b351bd260c8078ff91c30d7c9c8`)*

> Reviewed Alpine civic claim stmt-verified.

- **Coverage week:** `alpine-historical-2026-16` (2026-04-13 → 2026-04-19) · **Record date:** 2026-04-13
- **Jurisdiction:** Town of Alpine, Lincoln County, WY
- **Labels (carried verbatim from the digest):** `claimStatus: verified` · `aiPresented: false` ·
  `speakerStatus: speaker_unidentified` · `correctionStatus: none` · `publicationStatus: draft`
- **Primary source (resolvable):** Town Council Minutes — `sourceType: minutes`, `authorityLevel: official` —
  `https://www.alpinewy.gov/minutes/2026-04-13.pdf` (page 1; `verificationStatus: human_verified`)
- **Reviewer-internal links:** timeline `/alpine/timeline?card=c1_257498426c846b351bd260c8078ff91c30d7c9c8` ·
  source `/alpine/sources/alpine_minutes`

> **Honest-scope note (binding, do not strip):** the verified item's statement text is the **structural seed value
> `"Reviewed Alpine civic claim stmt-verified."`**, not yet a substantive "the Town did X" civic claim. What this
> milestone proves is the **provenance pipeline**: a reviewed, source-grounded Alpine record now composes to
> `verified` end-to-end (reviewed → source-linked → raw-preserved → `grounded` → `verified`). It does **not** assert
> any specific dated event, vote, decision, or quotation. Section 2 must not be inflated into reporting that the
> underlying text does not contain. The *first substantive verified civic claim* is still pending real-corpus
> evidence (see Reviewer notes).

**Three-lens framing:** none. Contract §2 hangs Conservative/Progressive/Libertarian lenses only on a *genuinely
contested* verified or disputed item. This item carries a placeholder claim with no contested content, so **no lens
sections are produced.**

---

## Surrounding sections (rendered for honesty — every section rendered even when empty, contract §2)

- **1. Header:** Alpine · coverage week `alpine-historical-2026-16` (2026-04-13 → 2026-04-19) ·
  **Reviewer-internal — not published.**
- **3. AI-extracted observations (not verified):** **6 items**, each under the locked label
  **`AI — not independently verified`** (`alpine-newsletter-item-001/002/004/005/006/007`, all
  `aiPresented: true`). Kept in their own labeled lane; **not** verified, never borrowed up into section 2.
- **4. Open questions / unverified:** none distinct this week.
- **5. Disputed / conflicting:** none in this digest.
- **6. Corrections:** none in this digest.
- **7. Evidence gaps & backfill status:** render the digest's `sourceSetProgress` / `completionFraming` verbatim as
  **gap/status framing — never "complete."** This briefing reports **1** verified item, not a complete picture.
- **8. Source trail:** the single section-2 item resolves to `sourceId: alpine_minutes`. `localSourcePath` is `null`
  and is never shown.

---

## Source trail (section 2)

| sourceId | type | authority | originalUrl (resolvable primary) | archiveUrl (link-level; **unvalidated this run**) | scanDate | page | verification |
|---|---|---|---|---|---|---|---|
| `alpine_minutes` | minutes | official | `https://www.alpinewy.gov/minutes/2026-04-13.pdf` | `https://web.archive.org/web/20260415000000/...` | 2026-04-13 | 1 | `human_verified` |

`localSourcePath: null` (never shown). The item carries **one** resolvable primary `originalUrl`. The `archiveUrl`
present in `sourceTrail` is a **link-level** reference; the source-level `archiveAvailability.nearestSnapshotRef` is
**`null`** (`archiveStatus: not_checked`). See the archive constraint below.

---

## Evidence-fidelity constraints honored (carry-forward from GOV-489 VSR audit — binding on copy)

1. **No unsubstantiated archive/snapshot claim.** The 5.03 `nearestSnapshotRef` is `null` for this item; grounding is
   genuine but carried at the **evidence-link level**, not via a resolved Wayback snapshot. This draft therefore cites
   the **resolvable `originalUrl`** as the primary source and treats the `archiveUrl` as an unvalidated link-level
   reference (flagged for the source-link validation workflow — live / stale / orphaned — before any non-internal
   use). It does **not** assert a "verified Wayback snapshot."
2. **`verified` vs `ai_presented` stay visibly distinct.** The 1 verified item (section 2) and the 6 `ai_presented`
   observations (section 3) are in separate labeled lanes; no AI observation is laundered into section 2.
3. **Reviewer-internal only.** No public deploy, email, sender, signup, person-naming. `speaker_unidentified` stays
   unidentified. **GOV-420 stays blocked (Isaac-gated), independent of this draft.**
4. **No facts beyond the verified evidence.** Statement text carried verbatim; no number, date, quote, or attribution
   added beyond the digest item / `sourceTrail`.

---

## Reviewer notes (VSR handoff — contract §7)

- **0 labels upgraded, 0 records re-classified.** Labels carried verbatim from digest item `alpine-newsletter-item-003`.
- **No person named.** `speakerStatus: speaker_unidentified` honored.
- **`publicationStatus: draft`** surfaced as reviewer-internal state — never rendered as "published."
- **Archive URL not independently validated this run.** The seeded reviewer-internal `archiveUrl`
  (`web.archive.org/web/20260415000000/...`) was **not** re-resolved against live Wayback, and the source-level
  `nearestSnapshotRef` is `null`. Flagged per contract §4 / `NEWSLETTER_WORKFLOWS.md` source-link validation:
  must be marked live / stale / orphaned before this item appears outside reviewer-internal review. Not an editorial
  fix.
- **`originalUrl` not HTTP-validated against the live web in this run** — it is the seeded reviewer-internal corpus
  value. Live source-link validation belongs to a real-corpus run, not a fabricated check here (TOOLS.md: do not
  fabricate source data).
- **Substantive-content gap (lead reviewer flag).** The verified item's text is the structural seed placeholder
  `"Reviewed Alpine civic claim stmt-verified."`. The milestone proven is the *provenance pipeline*, not a reportable
  civic fact. The **first substantive verified Alpine claim** (real minutes/agenda text behind a `verified` record)
  remains the open follow-up that gates editorial confidence for a non-placeholder section 2. This is a
  backend/source-archival follow-up (GOV-470 §9), **not** a reason to publish thin content and **not** a public-path
  unblock.

**Disposition:** this draft enters review as a reviewer-internal work product. Nothing here is approved until
VerificationSafetyReviewer signs off. No public / email / deploy step exists in this flow.
