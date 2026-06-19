# GOV-293 — Render confidence + exact-source citation + safe speaker on the reviewer-internal Alpine timeline

**Slice:** Stage 2 frontend surface (FrontendTimelineEngineer)
**Repo:** `xXKillerNoobYT/Government-watchdog-website`
**Website `origin/main` HEAD scoped against:** `4a1573c29a7c34afb93a3725df6fef9df88d590a` (GOV-257 / PR #13)
**Backend `origin/main` HEAD the contract was verified against:** `0e1c81a3bc8750a47f91f57802faf5ee10d0355a`

Reviewer-internal / beta-gated only. **No public projection.** Alpine only. No AI in this slice — it renders already-derived, web-safe backend fields verbatim.

---

## What was added

For each statement on the existing reviewer-internal Alpine timeline:

1. **`confidence_label`** (GOV-283) — rendered as a sharp "Confidence: …" chip in the at-a-glance meta row. Verbatim mapping of the 5-value SSOT vocabulary (`source_anchored_timed`, `auto_caption_timed`, `auto_caption_untimed`, `minutes_summary`, `derived_summary`). Never recomputed; an unforeseen future value still renders (title-cased) rather than being dropped.
2. **Exact-source citation** — the evidence drawer now surfaces the `locator_kind` as a **"Citation pointer"** field (e.g. *Character span (exact source text)*, *Transcript timestamp*, *Page*). This is the "where it came from" trail descriptor. The raw integer char offsets are **not** served on statement evidence rows (absent from the backend `WEB_SAFE_FIELD_ALLOWLIST`), so the pointer KIND is surfaced — no offsets are fabricated.
3. **Safe `speaker_label`** (GOV-290) — rendered verbatim as a sharp "Speaker: …" line. The backend fail-closes this to a provably name-free generic (`Meeting Attendee` / `Community Member`) unless the attribution cleared the write+read naming gate (then it is the approved `Name, Role`). The frontend never resolves, infers, or upgrades a speaker.

`confidence_label` and `speaker_label` are backend **API-envelope keys attached AFTER `to_web_safe`** — the raw columns they derive from (`transcript_class`, `display_label`, `speaker_attribution_id`) never cross the web-safe boundary.

### Placement (safety)
The Speaker + Confidence meta row sits **OUTSIDE** the GOV-153 click-to-reveal blur region (sharp at all times), alongside the trust badge and locked AI label — so an AI / low-confidence row reads as such at a glance. Asserted by a render test (`card-info` contains neither `speaker-label` nor `confidence-label`).

### No fabrication
When the backend did not send the field (the real 84-record capture predates GOV-283/290), the card **omits** the row rather than inventing a label — proven in evidence shot 04 and a render test.

---

## Web-safe boundary (SecPriv leg)
- New fields are enum strings / fail-closed safe labels; they carry no raw/local path. `assertWebSafe` (client-side transport sweep) runs on every fixture/live payload and a render test asserts no `/Users/`, `Obsidian Vault`, `transcript_path`, or `.sha256` reaches the DOM through the new fields.
- The `speaker_label` only ever holds an approved `Name, Role` when the backend's two-layer naming gate passed; all other rows collapse to a generic label. The frontend renders it verbatim and never derives a name (pass-up rule).
- `locator_kind` exposes the citation pointer KIND only; integer char offsets are stripped server-side (not allowlisted) and never reach the client.

---

## Verification

- `npm run typecheck` — clean.
- `npm test` — **186 passed** (incl. new `confidenceLabel` / `speakerLabel` / `locatorKindLabel` / drawer-citation-pointer presenter tests and render placement + no-fabrication tests).
- `npm run build` — clean (`tsc --noEmit && vite build`).

## Three-viewport evidence (COMPANY.md floor)

| # | File | Viewport | Shows |
|---|------|----------|-------|
| 01 | `01-desktop-1440x900-confidence-speaker-citation.png` | Desktop 1440×900 | `?demo=matrix` — all 4 trust states, each with Speaker + Confidence meta row + Citation pointer in the drawer; full confidence vocabulary (Source-anchored / Auto-caption timed+untimed / Derived summary) and all 3 speaker forms (Meeting Attendee / Community Member / Jane Doe, Mayor). |
| 02 | `02-tablet-768x1024-confidence-speaker-citation.png` | Tablet 768×1024 | Same surface, tablet layout. |
| 03 | `03-mobile-390x844-confidence-speaker-citation.png` | Mobile 390×844 | Same surface; meta row wraps cleanly, badge legibility floor (≥13px) holds. |
| 04 | `04-desktop-1440x900-real84-citation-pointer-no-fabrication.png` | Desktop 1440×900 | **Real 84-record capture** — `Citation pointer: Character span (exact source text)` rendered on real captured data; no fabricated speaker/confidence row (the pre-GOV-283/290 capture lacks those keys → correctly omitted). |

Synthetic demo (`state-matrix.json`) carries a visible "OFFLINE SAMPLE / not real data" banner. The real capture is reviewer-internal, not owner-published.
