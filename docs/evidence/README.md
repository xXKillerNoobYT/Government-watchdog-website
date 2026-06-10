# GOV-101 — Slice 4·C evidence (timeline + agenda thread + completeness)

Reviewer-internal/local, fixture mode. All screenshots are full-page, captured
from the labeled fixture (`FIXTURE MODE — Not real data` banner visible).

> **Data-publication boundary note (for SecurityPrivacy consult).** The
> `/verification-artifacts/` gitignore rule keeps reviewer-internal screenshots
> of *real* civic data out of the repo. These five images are **fixture-only** —
> every one carries the "Not real data" banner, contains no real record, and no
> raw/local path (the web-safe sweep runs on the fixture at load). They are
> therefore committed here as reviewable PR evidence. If the consult prefers they
> live under `/verification-artifacts/` instead, they can be moved in one step.

| File | Viewport | State |
| --- | --- | --- |
| `01-desktop-1440-gaps.png` | 1440×900 | timeline + assembled thread + completeness **gaps** |
| `02-tablet-768-gaps.png` | 768×1024 | same, tablet |
| `03-mobile-390-gaps.png` | 390×844 | same, mobile (drawer + legend reachable) |
| `04-desktop-1440-complete.png` | 1440×900 | completeness **complete** (`?demo=complete`) |
| `05-mobile-390-complete.png` | 390×844 | completeness **complete**, mobile |

## What the screenshots prove (acceptance criteria)

- **Timeline newest-first, Alpine-locked.** Cards order 2019-07-09 → 2019-06-25
  → 2019-06-11 by derived `timelineDate`. Non-Alpine records are dropped + logged
  (`console.warn`, see `timeline-render.test.ts`).
- **Assembled thread, ≥2 instances, typed lifecycle links.** "fireworks rules"
  assembles 3 per-meeting instances in known-then order, each with typed
  `Supersedes` / `Amends` / `Revisits` links (never an untyped "related"). A
  member with no edge shows "no linked prior/next item recorded".
- **Completeness from backend data; never false-complete.** The fixture ships the
  honest `gaps` state (unreviewed instance + missing minutes/transcript). The
  `complete` shot uses a backend-equivalent `{state:"complete"}` supplied as data
  (`?demo=complete`) — the frontend never derives it. Absent → "completeness
  unknown" (covered by tests), never `complete`.

## Reproduce

```sh
npm ci && npm run build && npm test   # 96 tests, green
npm run dev                            # http://127.0.0.1:5173/#/  (gaps)
#                                        http://127.0.0.1:5173/#/?demo=complete
```
