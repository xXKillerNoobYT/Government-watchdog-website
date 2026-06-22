/**
 * GOV-426 / GOV-427 — design-token layer (single source of truth).
 *
 * One CSS-custom-property block, declared on `:root`, that every reviewer-internal
 * surface (`render.ts` STYLE, `landing.ts` LANDING_STYLE, `topic-tree-view.ts`
 * TREE_STYLE) consumes via `var(--gw-*)`. This kills the measured drift the
 * GOV-426 spec diagnosed (34 hex values / ~140 occurrences re-declared per file,
 * four near-identical pale surfaces, a four-step grey scale, ten border colors).
 *
 * Faithful to `docs/ui-design-system.md` §1 (token table), §2 (verified WCAG 2.1
 * AA contrast — the one compliance fix is `#999 → #767676` on neutral/strong
 * borders), §3 (trust tones stay backend-driven + icon+text), and §5 (floors).
 *
 * The legibility/touch floors live HERE (not render.ts) so the token block can
 * interpolate them WITHOUT a circular import; render.ts re-exports them so the
 * existing `import … from './render'` call-sites and tests keep resolving. The
 * floor px is baked into the token value, so the regression tests still guard a
 * real floor — they now assert the token carries it, per spec §5.1.
 */

/**
 * Reviewer-internal legibility / touch floors, formalized by UXProductDesigner on
 * GOV-100 (not visual-style commitments — Isaac's later pass may restyle ABOVE
 * these). Stated in px so they can never scale below the floor with root font
 * changes, and exported so a unit test can assert the tokens honour them.
 *  - Badge text ≥ 13px computed at the 390px mobile floor (mobile legibility).
 *  - Drawer summary tap target ≥ 44×44px (WCAG 2.5.5 Target Size).
 */
export const BADGE_MIN_FONT_PX = 13;
export const DRAWER_TAP_MIN_PX = 44;

/**
 * The `:root` token block. Prepended to each surface's STYLE constant so all
 * three share one identical palette/scale source. Declaring `:root` more than
 * once is harmless — every block sets the same custom properties.
 */
export const GW_TOKENS = `
:root{
  /* color — surfaces */
  --gw-surface:#ffffff;
  --gw-surface-subtle:#f7f9fc;
  --gw-surface-accent-tint:#eef2f8;
  /* color — text (consolidated four-step grey scale) */
  --gw-text:#1a1a1a;
  --gw-text-secondary:#333333;
  --gw-text-muted:#5b6470;
  /* color — accent */
  --gw-accent:#1a4d8f;
  --gw-accent-text-on:#ffffff;
  /* color — borders (decorative vs state-bearing) */
  --gw-border:#d0d7e0;
  --gw-border-subtle:#e7ebf1;
  --gw-border-strong:#767676;
  /* color — trust tones (§3; backend-driven, icon+text, never colour alone) */
  --gw-ok-text:#1e4620;
  --gw-ok-bg:#e8f0e8;
  --gw-ok-bg-soft:#f3f8f3;
  --gw-caution-text:#7a5b00;
  --gw-caution-text-strong:#5c4500;
  --gw-caution-bg:#fff3cd;
  --gw-caution-bg-soft:#fffaf0;
  --gw-caution-line:#d9a400;
  --gw-stop-text:#7b241c;
  --gw-stop-bg:#fdecea;
  --gw-stop-border:#c0392b;
  --gw-neutral-border:#767676;
  /* type scale (rem, root 16px) */
  --gw-font:system-ui,sans-serif;
  --gw-leading:1.5;
  --gw-leading-tight:1.2;
  --gw-badge-min:${BADGE_MIN_FONT_PX}px;
  --gw-tap-min:${DRAWER_TAP_MIN_PX}px;
  --gw-text-xs:0.72rem;
  --gw-text-sm:0.8rem;
  --gw-text-badge:var(--gw-badge-min);
  --gw-text-body:0.95rem;
  --gw-text-md:1.05rem;
  --gw-text-lg:1.15rem;
  --gw-text-xl:1.8rem;
  /* spacing scale (rem) */
  --gw-space-1:.25rem;
  --gw-space-2:.4rem;
  --gw-space-3:.6rem;
  --gw-space-4:.8rem;
  --gw-space-5:1rem;
  --gw-space-6:1.25rem;
  /* radius + border width (consolidates 4/6/8/10/999 drift to sm/default/pill) */
  --gw-radius-sm:4px;
  --gw-radius:8px;
  --gw-radius-pill:999px;
  --gw-border-w:1px;
}`;
