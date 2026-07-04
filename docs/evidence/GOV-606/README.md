# GOV-606 — Wire agenda board to the real reviewed-Alpine projection (GOV-605)

Frontend swap of the GOV-599 agenda-Kanban board (PR #27) from fixture/sample data
to the **real** GOV-605 board projection (backend merge `655afba3`, PR #96),
consumed VERBATIM. Alpine-first, reviewer-internal, additive-only. GOV-420
public-launch gate untouched.

## Data provenance (both fixtures are genuine backend output, not hand-authored)

- `src/fixtures/agenda-board-projection.json` — the **REAL** reviewed-Alpine board.
  Captured by running `scripts/stage5_agenda_board.py::agenda_board(conn)` (backend
  `655afba3`) against the Stage-1 reviewer-internal promotion seed (the 6 real
  reviewer-internal Alpine rows, GOV-146/GOV-208). The real corpus has **no
  agenda-anchored reviewed statements yet**, so this is the honest empty board:
  `cardCount:0`, six lanes shown, `unanchoredStatementCount:6`, `emptyState:true`.
- `src/fixtures/agenda-board-projection.sample.dev.json` — a **DEV sample**, a
  genuine `agenda_board(conn)` output over the backend module's own test seed
  (`tests/test_gov605_stage5_agenda_board.py::_seed`). NOT real Alpine data; used
  only via `#/app?demo=sample` under a "DEV SAMPLE" banner to exercise the
  populated-card UX the empty real board cannot show.

Reproduce (backend repo, python ≥3.12):

```
# real (empty) board — against a copy of the GOV-146 reviewer-internal seed DB:
python3.12 scripts/stage5_agenda_board.py --db /path/to/reviewer_internal_seed.db
# dev sample — apply_migrations + tests/_seed, then agenda_board(conn)
```

## Screenshots (3-viewport floor met on the real projection)

| File | Route | Viewport |
|---|---|---|
| `gov606-real-empty-desktop.png` | `#/app?reviewer=1` (real) | Desktop 1440×900 |
| `gov606-real-empty-tablet.png` | `#/app?reviewer=1` (real) | Tablet 768×1024 |
| `gov606-real-empty-mobile.png` | `#/app?reviewer=1` (real) | Mobile 390×844 |
| `gov606-sample-meeting-desktop.png` | `#/app?reviewer=1&demo=sample` — Agendas by meeting | Desktop |
| `gov606-sample-tracking-desktop.png` | `#/app?reviewer=1&demo=sample` — Agenda tracking (6 lanes) | Desktop |
| `gov606-public-gated-desktop.png` | `#/app?access=public` — no-leak gate | Desktop |

The dev-sample screenshots prove AC3: verbatim status/confidence/lane badges,
`videoRef` deep-link, typed `lineage`, source drawer, disclosed `gapBadges`, and the
disclosed-empty `decisions` + `categoryAnchor` latents. The public-gated shot proves
the reviewer-internal lane is the sole gate (zero card content, no leaf leak). The
true-dark elevation ladder (board < lane < card) is an unchanged token invariant,
covered by the unit tests in `test/gov606-agenda-board.test.ts`.

## Verification

- `npm run typecheck` — clean
- `npm test` — 300 passed (16 in `test/gov606-agenda-board.test.ts`)
- `npm run build` — clean (tsc + vite)
