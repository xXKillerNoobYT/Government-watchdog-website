# GOV-2260 — Topics completeness-gap badge wraps at mobile widths (GH WEB#248)

## Defect

On the explicit synthetic Topics graph (`#/topics?demo=graph-synthetic`), the
backend-supplied completeness status
`gaps (unreviewed instance, missing minutes/transcript)` was styled
`white-space:nowrap` on `.gw-completeness-badge` (`src/ui/render.ts`). As an
inline element it grew the pill to ~362px and pushed the document past a
320/390px viewport into horizontal scroll.

Reported baseline (scheduled Frontend/design audit, website
`822a892524f32a24564797418b7cd2b0e82b6828`):

| viewport | doc scrollWidth / clientWidth | badge width |
|---|---|---|
| 320px | **408 / 305** (103px overflow) | ~362.55px |
| 390px | **408 / 375** (33px overflow) | ~362.55px |
| 640px | contained | ~362px |

## Fix

`.gw-completeness-badge` is now a bounded wrapping pill:
`display:inline-block; max-width:100%; white-space:normal;
overflow-wrap:break-word` (was `white-space:nowrap`). The badge stays inside its
card, the label flows onto multiple lines, and an over-long token breaks rather
than overflowing. The supplied text renders **verbatim** — nothing is truncated,
suppressed, or recomputed; no fail-closed or gap state is changed.

## Measured proof (post-fix)

Driven with system Chrome over CDP against the `private-beta` preview build
(vitest has no layout engine, so geometry is read in a real browser). Device
metrics `mobile:true`, `document.fonts.ready` awaited before measuring.

| viewport | doc scrollWidth / clientWidth | overflow | badge W×H | white-space | text |
|---|---|---|---|---|---|
| 320px | 320 / 320 | **0** | 229 × 41 (2 lines) | normal | full verbatim |
| 390px | 390 / 390 | **0** | 299 × 41 (2 lines) | normal | full verbatim |
| 640px | 640 / 640 | **0** | 363 × 24 (1 line) | normal | full verbatim |

The 640px badge measures 363px — matching the reported 362.55px single-line
baseline, confirming the same element. Body scrollWidth == clientWidth at every
width.

Screenshots (badge scrolled into view):

- `fix-320-topics.png` — 320px, no horizontal scroll.
- `fix-390-topics.png` — 390px, gap badge wrapped to two lines inside a bounded
  pill, verbatim text.
- `fix-640-topics.png` — 640px, unchanged single-line rendering (contained).

## Regression coverage

`test/timeline-render.test.ts` → `GOV-2260 — completeness-gap badge wraps and
stays inside the viewport`: pins the CSS invariant (no `white-space:nowrap`;
`white-space:normal` + `max-width:100%` + `overflow-wrap:break-word` +
`inline-block`), asserts the worst-case supplied label renders verbatim, and
guards against a truncation affordance (`text-overflow` / `overflow:hidden`)
sneaking in. The source-of-truth-CSS assertion pattern mirrors GOV-1645.
