# GOV-301 — completeness-gap card (≈90 `no_primary_source` meetings)

Stage 2 frontend surface. Renders the GOV-298 read-time, web-safe
completeness-gap projection on the reviewer-internal Alpine timeline.

## Data provenance (real, not fabricated)

- Backend `origin/main` HEAD scoped against: `a47fb7d` (GOV-298 / PR #53,
  `read_api.completeness_gap_cards` + `build_response(include_completeness_gaps=True)`).
- Website `origin/main` HEAD scoped against: `3890ae0` (GOV-293 / PR #14).
- Gap cards captured by running the deterministic `structure_real_corpus.py`
  (no AI / no network) over the real Alpine corpus, then
  `read_api.py --completeness-gaps --no-records`.
- Result: **224 gaps total — 92 `no_primary_source`**, plus 89
  `pdf_text_unextracted`, 32 `missing_timestamps`, 11 `missing_transcript`.
- Web-safe: zero raw-path / forbidden-key hits; internal columns
  (`source_id` / `detected_run_id` / `detected_utc`) never SELECTed by the
  backend projection, so absent by construction (asserted in the fixture test).

## Viewport evidence (COMPANY.md floor: desktop + tablet + mobile)

| File | Viewport |
|---|---|
| `01-desktop-1440x900-completeness-gap-card.png` | Desktop 1440×900 |
| `02-tablet-768x1024-completeness-gap-card.png` | Tablet 768×1024 |
| `03-mobile-390x844-completeness-gap-card.png` | Mobile 390×844 |

Each shows: the **92** `no_primary_source` headline count, the per-gap-type
breakdown (all kinds countable), and the expanded per-meeting list (date +
verbatim `severity`/`resolved_status` badges + web-safe `detail`). The
no_primary_source meeting list is a tap-reachable `<details>` disclosure (≥44px
summary); gap rows are never hidden — countability is the point.
