# GOV-150 evidence — `/topics` renders the REAL GOV-149 concept-graph capture

**Issue:** GOV-150 — flip concept-graph fixture to a real GOV-149 capture.
**View captured:** `#/topics?demo=graph` (the real capture; the default `/topics`
renders the same real tree above the live/fixture reviewed timeline).

## What the screenshots show

The civic topic tree is now the **real** GOV-149 reviewer-internal serve:

- Root **Town of Alpine** (`topic:alpine:jurisdiction`) + 3 real civic topics —
  **Town water system**, **Town budget and taxes**, **Town Council governance**
  — each with its inspectable government source term (char-span grounded).
- Derived breadcrumb + rollup result ("4 categories") off the real `topic_rollup` edges.
- Below the tree: the **6 real reviewer-internal statement records** (water main
  break, mill levy, budget work session, bacteriological testing, special meeting,
  executive session), every one carrying its **AI — not independently verified**
  label. Nothing AI/unverified renders without its label.

## 3-viewport coverage (company UI viewport floor)

| Class | File | Viewport |
|---|---|---|
| Desktop | `gov150-desktop-1440-real-topics.png` | 1440×900 |
| Tablet  | `gov150-tablet-768-real-topics.png`  | ~768×1024 |
| Mobile  | `gov150-mobile-390-real-topics.png`  | ~390×844 |

(Full-page captures; widths are content-area after scrollbar.) All three render.

## Class NOT rendered real — named per acceptance

- **Agenda-thread + completeness surfaces** do **NOT** render real data. The real
  Alpine corpus supports **0 agenda threads** (the 6 AI rows carry no agenda-item
  membership and no `updates` chain). GOV-149 accepted this honest-EMPTY state at
  its **Gate 1** — no thread is fabricated from title similarity. These surfaces
  keep the clearly-labeled **synthetic** `concept-graph-demo.json`
  (`?demo=graph-synthetic` for deep nesting + audited move; `?demo=complete` for
  thread completeness). **Owner of the real agenda-thread data:**
  BackendCrawlerEngineer — see GOV-155 / GOV-158 (derive threads/topics from real
  agenda structure). Until then the agenda-thread surface stays synthetic-labeled.

## Reproduce the capture (from GOV-149's serve)

Run in the GOV-149 backend worktree (`xXKillerNoobYT/Government-watchdog` @ `dfd8771`,
GOV-149 #35) against its seeded operational vault DB:

```
python3 scripts/read_api.py --db Database/gov_watchdog.db \
  --topic-root topic:alpine:jurisdiction --reviewer-internal --no-records
```

The `reviewer_internal_records` are stored under the frontend `records` key (same
convention as `alpine-sample.json`, GOV-129); `topic_tree` is verbatim. The body is
web-safe at the backend transport boundary (`to_web_safe` + `assert_no_raw_paths`)
and re-swept by the frontend `assertWebSafe` at load. See
`src/fixtures/concept-graph-real.json` `_provenance`.
