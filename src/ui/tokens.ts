/**
 * GOV-426 / GOV-427 — design-token layer (single source of truth).
 * GOV-657 / GOV-658 — re-points the color VALUES + font/scale tokens to Isaac's
 *   wireframe design language (mint-accent dark "Advanced" + warm broadsheet-paper
 *   "Simple"). Token NAMES and the §5 floors are unchanged — the app-wide look is a
 *   pure value-swap over this layer (`docs/gov654-design-spec.md` §2; §8 contrast
 *   recompute lives in `test/gov440-dark-theme.test.ts`). New tokens added: page-bg,
 *   header-bg, surface-well, level-{town,county,state}, info-text, tone-*-well/line,
 *   rule-strong, font-serif/mono, text-kicker, text-display, radius-lg.
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
  /* color — surfaces (GOV-657 Simple/broadsheet: warm paper, §2.2) */
  --gw-page-bg:#F3EDDD;
  --gw-header-bg:#FBF7EB;
  --gw-surface-well:#EFE8D6;
  --gw-surface:#FBF7EB;
  --gw-surface-subtle:#FDFAF1;
  --gw-surface-accent-tint:#E7EFF7;
  /* color — text (paper ink; §2.2) */
  --gw-text:#1E1C17;
  --gw-text-secondary:#4A463C;
  --gw-text-muted:#6E685B;
  /* color — accent (wireframe Simple keeps the shipped GW blue verbatim, §2.2) */
  --gw-accent:#1A4D8F;
  --gw-accent-text-on:#ffffff;
  /* color — borders (paper rules; decorative vs state-bearing) */
  --gw-border:#D8D0BC;
  --gw-border-subtle:#E2D9C2;
  --gw-border-strong:#767676;
  --gw-rule-strong:#1E1C17;
  /* color — jurisdiction level (§2.1; county is the language's ONE AA fix, §8.2) */
  --gw-level-town:#0E7A6E;
  --gw-level-county:#8F5D0E;
  --gw-level-state:#274F9B;
  --gw-info-text:#1A4D8F;
  /* color — trust tones (§3; UNCHANGED per §2.2 — already AA-verified §8.2) */
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
  /* color — tone wells + decorative lines (§2.1; light reuses shipped tone bgs) */
  --gw-tone-mint-well:#E7F1EE;
  --gw-tone-mint-line:#0E7A6E;
  --gw-tone-ok-well:#e8f0e8;
  --gw-tone-ok-line:#1e4620;
  --gw-tone-caution-well:#fff3cd;
  --gw-tone-caution-line:#d9a400;
  --gw-tone-stop-well:#fdecea;
  --gw-tone-stop-line:#c0392b;
  --gw-tone-info-well:#E7EFF7;
  --gw-tone-info-line:#1A4D8F;
  /* color — Kanban board chrome (GOV-600 §5): a 3-step elevation ladder
     board < lane < card, harmonized to the broadsheet paper family. */
  --gw-board-bg:#EDE5D1;
  --gw-lane-bg:#F4EEDF;
  --gw-lane-header-bg:#E7DEC8;
  --gw-card-bg:#FBF7EB;`;

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
  /* dark — surfaces (GOV-657 Advanced: near-black page behind elevated slate cards,
     §2.1. Ladder by lightness: page < header < well < surface < subtle) */
  --gw-page-bg:#0B0F14;
  --gw-header-bg:#0D1218;
  --gw-surface-well:#10161D;
  --gw-surface:#12181F;
  --gw-surface-subtle:#141B23;
  --gw-surface-accent-tint:#0F1E1B;
  /* dark — text (off-white to cut glare) */
  --gw-text:#ECF1F7;
  --gw-text-secondary:#C3CDD9;
  --gw-text-muted:#8D99A7;
  /* dark — accent (MINT — brand accent, active nav, kickers, focus ring; §2.1) */
  --gw-accent:#4ED8C3;
  --gw-accent-text-on:#062019;
  /* dark — borders (decorative vs state-bearing ≥ 3:1 on dark) */
  --gw-border:#232C37;
  --gw-border-subtle:#1F2833;
  --gw-border-strong:#8D99A7;
  --gw-rule-strong:#2A3644;
  /* dark — jurisdiction level (word always accompanies the colour; §8.1) */
  --gw-level-town:#4ED8C3;
  --gw-level-county:#E5A83B;
  --gw-level-state:#7DB1FB;
  --gw-info-text:#7DB1FB;
  /* dark — trust tones (light tone text on dark tint; icon+text carries state) */
  --gw-ok-text:#63D68F;
  --gw-ok-bg:#101820;
  --gw-ok-bg-soft:#0E1A13;
  --gw-caution-text:#ECC35C;
  --gw-caution-text-strong:#F4D488;
  --gw-caution-bg:#201A0E;
  --gw-caution-bg-soft:#1B160C;
  --gw-caution-line:#E5A83B;
  --gw-stop-text:#EE7A6D;
  --gw-stop-bg:#1D1412;
  --gw-stop-border:#EE7A6D;
  --gw-neutral-border:#8D99A7;
  /* dark — tone wells + decorative lines (§2.1). WCAG 1.4.11: these borders are
     REINFORCEMENT only — every state is also carried by tone text + word + glyph
     at ≥ 6.5:1 (§8.1). A sole-carrier border must use the tone TEXT colour instead. */
  --gw-tone-mint-well:#0F1E1B;
  --gw-tone-mint-line:#2E6B60;
  --gw-tone-ok-well:#101820;
  --gw-tone-ok-line:#1F3A2C;
  --gw-tone-caution-well:#201A0E;
  --gw-tone-caution-line:#4A3C14;
  --gw-tone-stop-well:#1D1412;
  --gw-tone-stop-line:#52302B;
  --gw-tone-info-well:#101A2B;
  --gw-tone-info-line:#31527E;
  /* dark — Kanban board chrome (GOV-600 §5) re-pointed to the wireframe ladder (§7):
     board(page well) < lane < lane-header < card — one intentional dark surface. */
  --gw-board-bg:#0B0F14;
  --gw-lane-bg:#10161D;
  --gw-lane-header-bg:#12181F;
  --gw-card-bg:#141B23;`;

/**
 * DIMENSIONAL tokens — type scale, spacing, radius, border-width, and the px
 * legibility/touch FLOORS. Theme-agnostic: shared from the base `:root` and NEVER
 * re-declared by the dark block (§11.1 / §11.5). The badge/tap floors are baked in
 * here as `${…}px`, tied to the exported constants, so the regression tests still
 * guard a real floor.
 */
const GW_DIMENSIONS = `
  /* font families (GOV-657 §2.3). Self-hosted WOFF2 subsets are vendored in a
     follow-up leg; until then the fallback stacks keep every layout legible (no
     FOIT). Public Sans = all Advanced UI; Newsreader = Simple/broadsheet; IBM Plex
     Mono = fixture banner, dates, hashes, timeline axis, agenda numbering. */
  --gw-font:'Public Sans',system-ui,sans-serif;
  --gw-font-serif:'Newsreader',Georgia,'Times New Roman',serif;
  --gw-font-mono:'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,monospace;
  /* type scale (rem, root 16px) */
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
  /* GOV-657 §2.3: section-kicker (non-interactive heading, floor-exempt per spec —
     11px is allowed for decorative kickers, NOT for state-bearing chips) + the
     clamp-based broadsheet masthead/display size. */
  --gw-text-kicker:11px;
  --gw-text-display:clamp(1.9rem,4.5vw,3.2rem);
  /* spacing scale (rem) */
  --gw-space-1:.25rem;
  --gw-space-2:.4rem;
  --gw-space-3:.6rem;
  --gw-space-4:.8rem;
  --gw-space-5:1rem;
  --gw-space-6:1.25rem;
  /* radius + border width (consolidates 4/6/8/10/999 drift to sm/default/lg/pill;
     GOV-657 §2.4 adds --gw-radius-lg:14px for the wireframe outer widget cards) */
  --gw-radius-sm:4px;
  --gw-radius:8px;
  --gw-radius-md:10px;
  --gw-radius-lg:14px;
  --gw-radius-pill:999px;
  --gw-border-w:1px;
  /* GOV-600 — Kanban lane min-width (theme-agnostic dimension; the board scrolls
     horizontally once lanes exceed the viewport, mirroring the reference pattern).
     Sized so all five Board-B lifecycle lanes fit the desktop board width without a
     horizontal scroll hiding the populated lane; lanes still grow via 1fr. */
  --gw-lane-min:13rem;`;

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
