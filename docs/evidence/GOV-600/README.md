# GOV-600 — Agenda Kanban boards + true dark theme (evidence)

GOV-599 Child 1 (Frontend). Owner-confirmed UX redesign: the reviewer-internal
app now opens by default to an **Agendas by meeting** Kanban board, with a top
toggle to **Agenda tracking** over time, on a **true dark theme**. Reviewer-internal
Alpine only — no public deploy; the public-launch gate (GOV-420) is untouched.

Local repro:

```
npm ci && npm run build && npm test        # tsc + vite build, 300 tests pass
npm run dev                                 # then open the reviewer walkthrough:
#   http://127.0.0.1:<port>/#/app?reviewer=1
```

The theme control (bottom-right) cycles System → Dark → Light; the shots below pin
`data-theme` explicitly. `#/app?access=public` forces the public lane.

## Screenshots (3-viewport floor: 1440×900 / 768×1024 / 390×844)

| File | View | Theme | Viewport | Shows |
|---|---|---|---|---|
| `01-boardA-meeting-dark-desktop-1440.png` | Board A (default) | Dark | Desktop | Agendas-by-meeting opens by default; one real meeting-day lane (2026-06-12, 6 reviewed AI cards) + completeness-gap card (213 meetings lack a primary source); true-dark elevation ladder board < lane < card. |
| `02-boardA-meeting-dark-tablet-768.png` | Board A | Dark | Tablet | Same, tablet layout. |
| `03-boardA-meeting-dark-mobile-390.png` | Board A | Dark | Mobile | Lanes stack full-width below the 640px floor; tap targets ≥44px. |
| `04-boardB-tracking-dark-desktop-1440.png` | Board B | Dark | Desktop | Agenda-tracking: 5 lifecycle lanes (Upcoming/Noticed → Open → Revisited → Decided → Dormant); the SYNTHETIC "fireworks rules" thread sits in its **verbatim backend `decided`** lane at the newest cursor; typed Supersedes/Amends/Revisits edges; as-of scrubber. |
| `05-boardB-tracking-dark-mobile-390.png` | Board B | Dark | Mobile | Lifecycle lanes stack; scrubber wraps. |
| `06-boardA-meeting-light-desktop-1440.png` | Board A | Light | Desktop | Light theme still fully works (toggle wins over OS). |
| `07-public-lane-gated-0-cards-dark-desktop.png` | (gate) | Dark | Desktop | `access=public` → reviewer-internal-only notice, **0 boards, 0 cards** — the gate is the sole render path, by construction. |

## What is real vs synthetic vs backend-gap (honest labelling)

- **Board A = real reviewed data.** It groups the verbatim GOV-347 card-feed
  (backend HEAD 6d65bd3) by each card's own `date`. The real corpus currently has
  6 present (AI-presented) cards on one meeting day + 213 source-missing gaps, so
  Board A honestly shows **one** meeting-day lane. It is labelled "grouped by date"
  because the card-feed envelope ships `date` but **not** `meeting_id`.
- **Board B = clearly-labelled SYNTHETIC demo.** The real corpus has **0 agenda
  threads**, so Board B runs on the synthetic `concept-graph-demo.json` thread
  under a permanent "SYNTHETIC — not real Alpine data" banner. It proves the
  lane layout + as-of movement; it is never presented as real.
- **Trust integrity preserved:** the backend `ui_status` (10-state) is consumed
  verbatim, the locked "AI — not independently verified" label stays outside the
  click-to-reveal blur, sources drawers are intact, `assertWebSafe` sweeps all
  board data, and **lane placement is never a new trust signal**. Board B's
  terminal lane is the backend's verbatim `AgendaThreadNode.status`; intermediate
  as-of lanes are a structural "known-then" display over recorded meeting
  instances, never a frontend-inferred status.

## Backend gaps that block full fidelity (GOV-599 Child 2)

- **B1** — emit `meeting_id` + real `agenda_item_id` + `item_order` on the card-feed
  envelope → true multi-meeting Board A columns.
- **B2** — real agenda-thread extraction from the reviewed corpus → Board B on real data.
- **B3** — backend-assigned per-meeting agenda status/stage (reviewed, source-linked)
  → real lane placement (must stay backend-owned; never frontend-inferred).
