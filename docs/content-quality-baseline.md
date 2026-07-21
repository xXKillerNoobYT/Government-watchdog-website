# Government Watchdog beta content-quality baseline

This is the minimum content standard for the current Town of Alpine beta. It
applies to timeline cards, agenda items, newsletters, source records, profiles,
alerts, and any other civic-content block.

In this document, **release** means inclusion in the gated reviewer beta. It
does **not** mean public publication or public readiness. The current app is
reviewer-internal; a public lane must render no civic records.

## Governing principles

1. The backend-supplied record, status, provenance, correction, and access
   fields are authoritative. The frontend consumes them verbatim and never
   upgrades trust or publication eligibility.
2. A polished presentation never outranks missing evidence. When a requirement
   is unknown or unmet, the item stays visibly incomplete, non-verified, or
   withheld.
3. Simple and Advanced views may change density and wording, but must preserve
   the same facts, qualifications, labels, receipts, and access restrictions.

## Enforceable minimums

### 1. Source and receipt linkage

- Every factual sentence must resolve to at least one backend-supplied source
  or receipt identifier. The receipt must expose the web-safe source metadata
  supplied for that record and, when available, an exact locator such as page,
  section, or timestamp.
- Links must be presented as live, stale with a validated archive substitute,
  or unavailable. An orphaned link cannot support a verified claim.
- Raw paths, vault references, private locators, and non-web-safe fields never
  enter rendered content. Existing web-safe sweeps remain mandatory.
- A record without resolvable support is shown as `source_missing` or another
  backend-supplied non-verified state. It is not rewritten into a sourced fact.

### 2. Reviewed and machine-extracted status

- Only an item the backend marks `verified` or reviewed/source-backed may use
  verified-fact treatment.
- `ai_presented`, `unverified`, `needs_human_review`, `speaker_unidentified`,
  `disputed`, `source_changed`, and `source_missing` retain their exact status
  and non-verified treatment wherever the item appears.
- Machine extraction, a grounded source relationship, or a high confidence
  value does not equal human review.
- An unknown status receives the least-trusted available treatment and is
  escalated; the frontend does not invent a replacement label.

### 3. Plain-language accuracy

- A summary must preserve the source-supported actor, action, object, date,
  amount, jurisdiction, uncertainty, and procedural stage. Omitting a material
  qualifier is an accuracy failure.
- Numbers, dates, quotations, attributions, vote outcomes, and legal terms may
  appear only when present in the record or its receipt trail.
- Plain language may explain procedure but may not infer motive, intent,
  legality, guilt, impact, or a final outcome the record does not establish.
- Disputed records show the supplied conflict without adjudicating it. Missing
  information is stated as missing, not smoothed over.

### 4. AI disclosure

- AI-origin text carries the existing locked AI/non-verification label in the
  same card or section, before or alongside the text. The disclosure cannot be
  hidden inside a source drawer, tooltip, or footer.
- AI text is visually and semantically distinct from verified facts and never
  inherits a verified tone.
- Synthetic design screens retain their explicit `AI-PRESENTED` wording and
  receipt disclaimer; that fixture wording does not promote the content.

### 5. Timestamps and freshness

- A data surface identifies its backend-supplied origin and `asOf` or
  `generatedAt` value. A captured snapshot says that it is not a live read.
- Event date and processing/capture date remain distinct. A processing date is
  never presented as the event date.
- If an event date is unavailable, show an honest undated/unknown state rather
  than estimating or borrowing a nearby date.
- Per-source freshness and changed/stale states are shown when supplied. A
  changed source returns to review before it can regain verified treatment.

### 6. Corrections

- Corrections are additive and traceable: keep the earlier record, add the
  backend/VSR-supplied correction status, correction date, reason, and source,
  and link the records when that relationship is supplied.
- Never silently edit history, delete the original to hide an error, or mark a
  correction resolved on the client.
- Corrected editorial content re-enters reviewer approval before release.

### 7. Missing or incomplete data

- Missing sources, dates, transcripts, sections, attachments, identities, and
  coverage are visible gaps. Do not imply “complete,” “everything,” or “full
  picture” unless the backend explicitly supplies that conclusion.
- A gaps-only response is not an empty response. Render the gaps and their
  supplied statuses.
- Do not create placeholder facts to fill a sparse page. A concise honest gap
  is preferable to a speculative summary.

### 8. Names and sensitive claims

- Name only policy-cleared, on-record public officials when the name and role
  are tied to the cited record. An unidentified speaker stays unidentified.
- Do not infer identity from context, voice, title similarity, or another
  record. Do not name private residents merely because they appear in raw
  material.
- Allegations, legal conclusions, health or safety claims, and claims that may
  materially harm a person require explicit source support and reviewer
  approval. Otherwise withhold the claim and escalate it for review.

### 9. Accessibility and format

- Trust, AI, correction, gap, and freshness states use meaningful text (and an
  icon where the design provides one); color alone never carries status.
- Content uses a logical heading order, real lists/tables for structured data,
  descriptive source-link text, and controls with accessible names.
- Essential facts and status text are not embedded only in an image, hover
  state, blur, or color. Gated detail controls remain keyboard operable and
  restore focus when closed.
- Existing mobile badge-legibility, touch-target, contrast, reduced-motion,
  and responsive layout floors must not regress.

### 10. Fixture separation

- Synthetic design content appears only after reviewer access **and** an
  explicit fixture flag. The page must say
  `SYNTHETIC DESIGN FIXTURE — not a live read` before any fixture record.
- Fixtures never mix into a reviewed-data list, count, freshness indicator, or
  empty state. Device-only preview actions do not claim server persistence,
  identity, subscription, reminder delivery, or official coverage.
- A fixture may demonstrate layout and interaction only; it is never evidence
  about the Town of Alpine.

### 11. Reviewer and public eligibility

- For the current beta, civic items are eligible only for an approved
  reviewer-internal session. Anonymous, pending, denied, revoked, unknown, or
  other non-approved access renders the gate and zero civic records.
- `do-not-publish`, reviewer-only, synthetic, and machine-extracted content is
  never public-eligible.
- Verification alone does not make an item public-eligible. Public eligibility
  would additionally require a separately authorized web-safe public
  projection, exclusion of reviewer/synthetic data from public assets, the
  required safety/security review, and explicit owner approval of the exact
  release. Those conditions are not claimed complete here.

## Page-level states

- **Loading:** show a neutral loading state; do not show stale cards as if they
  were the requested result.
- **No reviewed content:** say “No reviewed [items] yet.” Do not imply that no
  civic activity occurred.
- **Known gaps only:** render the gap summary; do not replace it with a generic
  empty state.
- **Empty subsection:** keep the section and say “None in this digest” or the
  surface-specific equivalent so absence is countable.
- **Error:** use an alert state. If the app falls back to a labeled snapshot or
  fixture, show that fallback notice before its content.
- **Access unavailable:** render the gate only, with no civic data, receipts,
  private fields, counts, or content-bearing DOM attributes.

## Fail-closed rules

Any one of these conditions blocks an item from reviewer-beta release until it
is corrected or explicitly kept as a labeled gap:

- missing or unresolvable receipt for a factual assertion;
- missing, unknown, or contradictory trust/access status;
- AI or machine-extracted text without its non-verification disclosure;
- invented or unsupported name, date, number, quote, attribution, or outcome;
- stale/orphaned support presented as current verified evidence;
- a correction that overwrites history or lacks a correction source;
- fixture content without both reviewer access and the fixture banner/flag;
- raw/private data in the payload or DOM;
- an access check that fails, cannot run, or returns an unrecognized state.

Failing closed means: do not upgrade, guess, or hide the problem. Withhold the
claim or show the backend-supplied non-verified/gap state, keep civic content out
of non-approved lanes, and route the issue to the responsible reviewer/backend
owner.

## Per-item reviewer release checklist

- [ ] Scope and jurisdiction are correct.
- [ ] Every factual sentence resolves to a web-safe receipt and locator when available.
- [ ] Backend trust, provenance, correction, and access states are shown verbatim.
- [ ] AI/machine origin is disclosed and not styled as verified.
- [ ] Names, dates, numbers, quotations, and outcomes match the cited record.
- [ ] Event date, capture date, origin, and freshness are not conflated.
- [ ] Missing evidence and uncertainty remain visible.
- [ ] Corrections preserve the earlier record and cite the correction source.
- [ ] Status and essential meaning are accessible without color, hover, or imagery.
- [ ] The item is in the correct reviewed, gap, fixture, or withheld lane.

If any box cannot be checked, the item does not ship as a verified reviewer-beta
item. It remains a clearly labeled gap/non-verified item or is withheld.

## Existing contracts carried forward

- `README.md` — data contract and two hard invariants.
- `docs/design-handoff-integration.md` — fixture/data boundary and release gates.
- `docs/stage3-06-card-feed-frontend-contract.md` — receipt, status, empty-state,
  and reviewer-lane behavior.
- `docs/stage4-06-newsletter-archive-detail-frontend-contract.md` — verbatim
  binding, visible empty sections, and gated archive behavior.
- `docs/stage4-08-newsletter-editorial-contract.md` — source-linked prose,
  prohibited language, corrections, and reviewer handoff.
- `docs/ui-design-system.md` — accessibility and non-color status floors.
