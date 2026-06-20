# GOV-354 — Stage 3.06 card-feed implementation evidence

Render the GOV-347 card-feed `{scope, access, cards[]}` envelope on the
reviewer-internal Alpine timeline. Route: `#/cards` (hash-router).

## Viewport evidence floor (`BACKEND_FRONTEND_EVIDENCE_WORKFLOW.md`)

| Class | Viewport | File | State |
|---|---|---|---|
| Desktop | 1440×900 | `desktop-1440x900-reviewer-internal.png` | reviewer-internal lane (6 present cards + gap card + time-nav) |
| Tablet | 768×1024 | `tablet-768x1024-reviewer-internal.png` | reviewer-internal lane |
| Mobile | 390×844 | `mobile-390x844-reviewer-internal.png` | reviewer-internal lane |
| No-leak | 1440×900 | `public-lane-1440x900-zero-cards.png` | **public lane = 0 cards** (`#/cards?access=public`) |

All three viewport classes (desktop · tablet · mobile) are present — **no missing
class**. Captured via Playwright against `vite preview` of the production build.

## What each screenshot proves (against the GOV-353 contract)

- **Cards render from the GOV-347 feed** — `handle` is the list key/scroll anchor;
  `type` shows a 🤖 emoji + hover; `date` in the card head; `speaker_label`
  ("Meeting Attendee") + `confidence_label` ("Auto-caption (untimed)") in the sharp
  meta row; `reviewed_summary` in the gated/blurred body; `evidence[]` opens the
  source drawer; `status` drives the "Unverified" trust badge; `provenance_status`
  drives the reused GOV-314 "✓ Audit-passed" badge.
- **Gated blocks** — every present card in this real seed corpus is
  `type=ai_presented`, so each renders inside the AI region with the locked
  **"AI — not independently verified"** label + the click-to-reveal blur. AI/unverified
  text never reads as a verified fact; the trust + AI badges stay sharp (outside the blur).
- **Completeness gaps (GOV-301 lane)** — the `source_missing` cards route to the
  gap card: headline **"90 Alpine meeting(s) still lack a primary source"**, 213 total
  gaps across all kinds, per-type breakdown. No fabricated `disputed`/`source_changed`.
- **Reviewer-internal / no-public-leak invariant (§5)** — the public lane renders
  **0 cards** and surfaces no `reviewed_summary`/`speaker_label`/`provenance_status`.
  The sole gate is `access==='reviewer_internal'`, enforced in the adapter before any
  DOM is built (proven by `test/gov354-card-feed.test.ts`).

## Data provenance (honest scope)

- Fixture `src/fixtures/alpine-card-feed.json` is a **verbatim** capture of
  `scripts/stage3_card_feed.py` at backend `origin/main` HEAD `6d65bd3`
  (GOV-347/#63) over a real seeded reviewer-internal Alpine corpus DB. Pure
  re-projection (no AI, no network, no client re-derivation). Swept by
  `assertWebSafe` at module load.
- **Present-card scope caveat:** every present card in this seed corpus is
  `ai_presented` (machine-extracted, unreviewed). The other present types
  (`statement`/`meeting`/`decision`/`source`/`correction`) and the
  `verified`/`corrected` statuses are exercised by the adapter unit tests with
  synthetic cards until the reviewed corpus promotes non-AI present cards.
- **`title` field caveat:** this envelope (HEAD `6d65bd3`) emits no `title` key;
  the head renders title **present-only** (omitted, never invented) per the §2.2
  bounded-gap rule. The head element + glyph map are in place for when the backend
  ships titles.

## CI (website runner)

`npm run typecheck` · `npm test` (225 passed, 14 new in `gov354-card-feed.test.ts`)
· `npm run build` — all green.
