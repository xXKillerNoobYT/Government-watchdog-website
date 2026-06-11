# GOV-104 — Slice 4·E evidence (trust legend + state matrix + integration smoke)

Reviewer-internal/local, fixture mode. All screenshots are full-page, captured
from labeled fixtures (`FIXTURE MODE — Not real data` banner visible in every
shot). Slice 4·E closes the slice; the Isaac visual/user-flow gate
([GOV-103](/GOV/issues/GOV-103)) is already **cleared** (accepted), which unblocks
this closeout.

> **Data-publication boundary note (SecurityPrivacy consult).** The
> `/verification-artifacts/` gitignore rule keeps reviewer-internal screenshots of
> *real* civic data out of the repo. These 13 images are **fixture-only** — every
> one carries the "Not real data" banner, contains no real record, and no
> raw/local path (the web-safe sweep runs on the fixture at load, and the
> transport scan is asserted in CI). They are committed here as reviewable PR
> evidence, mirroring the GOV-101 precedent.

## Viewport floor (all three classes covered)

| State | Desktop 1440×900 | Tablet 768×1024 | Mobile 390×844 |
| --- | --- | --- | --- |
| **Legend + state matrix** (pending-review / disputed / corrected / do-not-publish) | `gov104-desktop-1440-matrix-legend.png` | `gov104-tablet-768-matrix-legend.png` | `gov104-mobile-390-matrix-legend.png` |
| Loading | `gov104-desktop-1440-loading.png` | `gov104-tablet-768-loading.png` | `gov104-mobile-390-loading.png` |
| Empty | `gov104-desktop-1440-empty.png` | `gov104-tablet-768-empty.png` | `gov104-mobile-390-empty.png` |
| Error | `gov104-desktop-1440-error.png` | `gov104-tablet-768-error.png` | `gov104-mobile-390-error.png` |
| Source drawer open (mobile-drawer standing gate) | — | — | `gov104-mobile-390-drawer-open.png` |

The matrix shot shows the **legend disclosure open** (tap-reachable `<details>`,
not hover-only) explaining every status label + the locked AI label + the
fixture banner, above the four record-level state cards — each with its verbatim
trust badge and tone (ok / caution / stop / neutral).

## What the evidence proves (acceptance criteria)

- **Legend reachable by tap; every label explained.** The legend is a native
  `<details>` (opens on tap/click/Enter, 44px summary target). `legend.ts`
  generates one row per `UiStatus` from the exhaustive `ALL_UI_STATUSES`, plus
  the AI label and fixture banner — so no card can show a label the legend does
  not define (`test/legend.test.ts`).
- **Every state in the matrix renders from a fixture.** Async states
  (loading / empty / error) via `?state=`; record-level states
  (pending-review / disputed / corrected / do-not-publish) from
  `src/fixtures/state-matrix.json` via `?demo=matrix`
  (`test/state-matrix.test.ts`). The disputed card shows **both** conflicting
  sources in its drawer.
- **Integration smoke green with all five assertions** (`test/integration-smoke.test.ts`,
  `npm run test:smoke`, dedicated CI step), run against the REAL captured backend
  read-API sample (`test/read-api-sample.json`):
  1. zero raw/absolute paths in the response body (**transport-level** byte scan
     via `findRawPathLeaksInText` + structural `assertWebSafe`),
  2. no rendered card without a trust label,
  3. no fabricated cross-meeting link (links only from typed backend edges; count
     equals what the backend edges imply; never the untyped "related"),
  4. rollup filter returns descendants (parent → whole subtree; leaf → itself),
  5. a cyclic rollup graph is rejected (degraded, never rendered as a tree).

## Reproduce

```sh
npm ci && npm run typecheck && npm test   # 150 tests, green
npm run test:smoke                         # 5 assertions, green
npm run build                              # production build
npm run dev                                # http://127.0.0.1:5173/#/?demo=matrix  (legend + 4 states)
#                                            http://127.0.0.1:5173/#/?state=loading|empty|error
```
