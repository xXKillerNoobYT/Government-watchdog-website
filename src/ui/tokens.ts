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
 * COLOR tokens — LIGHT values (default; §1.1 / §2 of the spec). Declarations only,
 * no selector wrapper, so the exact same string can be pinned by BOTH the base
 * `:root` AND the explicit `:root[data-theme="light"]` override (single source —
 * no drift between default and forced-light). These are the ONLY tokens the dark
 * theme re-declares (GOV-438 §11.1); the dimensional tokens below are shared.
 */
const GW_COLORS_LIGHT = `
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
  --gw-neutral-border:#767676;`;

/**
 * COLOR tokens — DARK values (GOV-438 §11.1). SAME token NAMES as the light set;
 * dark VALUES only. Surfaces go to an elevated dark slate (not pure black — avoids
 * OLED smear/halation), text goes off-white, tone backgrounds invert to dark tints
 * carrying light tone text, the accent lifts to a light blue, and every
 * state-bearing border lightens to clear the 3:1 floor on the dark surface. Every
 * pairing is verified ≥ 4.5:1 (text) / ≥ 3:1 (state UI) in spec §11.2.
 *
 * Contains ONLY `--gw-*` *color* properties — NO `--gw-badge-min`/`--gw-tap-min`/
 * type/spacing/radius/border-width — so the §5 legibility/touch floors and their
 * regression tests stay valid for free (the floors live on dimensional tokens the
 * dark block never touches; §11.5). This is grep-verifiable.
 */
const GW_COLORS_DARK = `
  /* dark — surfaces (elevated slate, not #000) */
  --gw-surface:#15181d;
  --gw-surface-subtle:#1e232b;
  --gw-surface-accent-tint:#1b2942;
  /* dark — text (off-white to cut glare) */
  --gw-text:#f2f4f7;
  --gw-text-secondary:#ced5de;
  --gw-text-muted:#a4adba;
  /* dark — accent (lifted light blue) */
  --gw-accent:#8ab4f8;
  --gw-accent-text-on:#0b1b30;
  /* dark — borders (decorative vs state-bearing ≥ 3:1 on dark) */
  --gw-border:#333a44;
  --gw-border-subtle:#262c34;
  --gw-border-strong:#8a93a0;
  /* dark — trust tones (light tone text on dark tint; icon+text carries state) */
  --gw-ok-text:#8fe6a8;
  --gw-ok-bg:#14241a;
  --gw-ok-bg-soft:#172b1d;
  --gw-caution-text:#f5cf6a;
  --gw-caution-text-strong:#f8d98a;
  --gw-caution-bg:#2a2410;
  --gw-caution-bg-soft:#211d12;
  --gw-caution-line:#d9a400;
  --gw-stop-text:#f6a39a;
  --gw-stop-bg:#2a1512;
  --gw-stop-border:#e57368;
  --gw-neutral-border:#8a93a0;`;

/**
 * DIMENSIONAL tokens — type scale, spacing, radius, border-width, and the px
 * legibility/touch FLOORS. Theme-agnostic: shared from the base `:root` and NEVER
 * re-declared by the dark block (§11.1 / §11.5). The badge/tap floors are baked in
 * here as `${…}px`, tied to the exported constants, so the regression tests still
 * guard a real floor.
 */
const GW_DIMENSIONS = `
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
  --gw-border-w:1px;`;

/**
 * The token block. Prepended to each surface's STYLE constant so all three share
 * one identical palette/scale source. Declaring `:root` more than once is harmless
 * — every block sets the same custom properties.
 *
 * Theme model (GOV-438 §11.4 — `prefers-color-scheme` + explicit override):
 *  1. Base `:root` carries the LIGHT colors + the shared dimensional tokens — the
 *     default when no preference is expressed (the safe institutional default).
 *  2. `@media (prefers-color-scheme: dark)` re-declares ONLY the color tokens with
 *     dark values — auto-dark for OS-dark users.
 *  3. `:root[data-theme="dark"]` / `:root[data-theme="light"]` are the explicit
 *     toggle overrides. An attribute selector (specificity 0,2,0) outranks both the
 *     base `:root` and the `@media` `:root` (both 0,1,0), so the TOGGLE ALWAYS WINS
 *     over the OS preference — no `!important`, no JS recompute (theme-toggle.ts
 *     just sets `data-theme` on the root element).
 *
 * The dark selectors reuse `GW_COLORS_DARK` (color-only); dimensional tokens are
 * NEVER repeated there, so the floors are physically un-overridable by the theme.
 */
export const GW_TOKENS = `
:root{${GW_COLORS_LIGHT}${GW_DIMENSIONS}
}
@media (prefers-color-scheme:dark){
  :root{${GW_COLORS_DARK}
  }
}
:root[data-theme="dark"]{${GW_COLORS_DARK}
}
:root[data-theme="light"]{${GW_COLORS_LIGHT}
}`;
