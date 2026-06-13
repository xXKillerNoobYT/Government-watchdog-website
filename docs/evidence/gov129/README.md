# GOV-129 evidence — reviewer-internal Alpine timeline on REAL reviewed records

Stage 1 · Slice 4 · GOV-129. The reviewer-internal timeline now renders the
**real reviewed `read_api` records**, replacing the synthetic demo fixtures.

## What these screenshots show

`/` (timeline/home) rendering the **6 real reviewed Alpine records** at the three
COMPANY.md viewport floors. The data is the offline-captured `read_api`
reviewer-internal serve (see provenance below) — fixture mode now serves a real
reviewed snapshot, not synthetic data.

| Viewport | File |
| --- | --- |
| Desktop 1440×900 | `gov129-desktop-1440-real-records.png` |
| Tablet 768×1024 | `gov129-tablet-768-real-records.png` |
| Mobile 390×844 | `gov129-mobile-390-real-records.png` |

Each card shows the verbatim backend trust label (**Source-backed**) and the
locked **AI — not independently verified** label (every promoted row is
`produced_by='ai'`, `verification_status='reviewed_source_linked'`). Header reads
`6 records · 6 Source-backed · 6 AI-produced`. The banner reads **OFFLINE SAMPLE
— not a live read** with the provenance notice — never "not real data" over real
records.

## Data provenance

- **Source:** `read_api.reviewer_internal_records(...)` captured from backend
  `Government-watchdog` `origin/main` **235bba6** (GOV-146 Option-A
  owner-authorized 6-row promotion seed; Isaac approved).
- **Transport:** web-safe swept at the backend boundary (`to_web_safe` +
  `assert_no_raw_paths`) and re-swept by the frontend `assertWebSafe` at load.
  Leak-guard holds on the real payload (0 raw/vault paths; verified in
  `test/client.test.ts` + `test/integration-smoke.test.ts`).
- **Eligibility:** only eligible reviewed rows served (6); public
  `published_records` still 0 (`not_publishable`, reviewer-internal/vault-only).

## Known data gap (routed follow-up)

The real reviewed corpus has **0 topics / 0 agenda threads** — the concept graph
(topic rollups + cross-meeting agenda threads) has not been built over the real
Alpine corpus yet. So the `/topics` tree and agenda-thread surfaces render their
**honest empty-state** on real data; their UI logic stays covered by the labeled
synthetic `src/fixtures/concept-graph-demo.json` (and is screenshot-able via
`?demo=graph`). Building a reviewer-internal-eligible concept graph over the real
corpus is a backend follow-up so those surfaces can also go real.
