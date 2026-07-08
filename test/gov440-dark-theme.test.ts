import { describe, it, expect } from 'vitest';
import { GW_TOKENS, BADGE_MIN_FONT_PX, DRAWER_TAP_MIN_PX } from '../src/ui/tokens';
import { STYLE } from '../src/ui/render';

/**
 * GOV-440 — dark theme via token-value swap (implements GOV-438 §11).
 *
 * Two things this guards, per spec §11.5/§11.7:
 *  1. The dark block is a COLOR-ONLY swap: it re-declares the §11.1 color tokens
 *     and NEVER a dimensional/floor token — so the §5 legibility/touch floors and
 *     their regression tests stay valid for free (grep-verifiable, asserted here).
 *  2. The dark palette is WCAG 2.1 AA: every text pairing ≥ 4.5:1 and every
 *     state-bearing border ≥ 3:1 on the dark surface (§11.2), recomputed from the
 *     final token values so VSR can re-verify in CI rather than by hand.
 */

/** Extract the declaration body of a CSS selector block from GW_TOKENS. */
function block(selectorLiteral: string): string {
  const start = GW_TOKENS.indexOf(selectorLiteral);
  expect(start, `selector ${selectorLiteral} present`).toBeGreaterThanOrEqual(0);
  const open = GW_TOKENS.indexOf('{', start);
  const close = GW_TOKENS.indexOf('}', open);
  return GW_TOKENS.slice(open + 1, close);
}

// ── WCAG 2.1 relative-luminance contrast (sRGB), same formula as spec §2/§11.2 ──
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`bad hex ${hex}`);
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('GOV-440 — dark theme is a color-only swap (floors untouchable)', () => {
  it('declares the dark theme via @media + data-theme override, plus a light pin', () => {
    expect(GW_TOKENS).toContain('@media (prefers-color-scheme:dark)');
    expect(GW_TOKENS).toContain(':root[data-theme="dark"]');
    expect(GW_TOKENS).toContain(':root[data-theme="light"]');
  });

  it('re-declares the GOV-657 §2.1 dark COLOR values (wireframe Advanced palette)', () => {
    const dark = block(':root[data-theme="dark"]');
    // a representative span of the §2.1 table (surface, text, mint accent, each tone)
    expect(dark).toContain('--gw-surface:#12181F');
    expect(dark).toContain('--gw-text:#ECF1F7');
    expect(dark).toContain('--gw-accent:#4ED8C3');
    expect(dark).toContain('--gw-accent-text-on:#062019');
    expect(dark).toContain('--gw-ok-text:#63D68F');
    expect(dark).toContain('--gw-caution-text:#ECC35C');
    expect(dark).toContain('--gw-stop-text:#EE7A6D');
    expect(dark).toContain('--gw-stop-border:#EE7A6D');
    expect(dark).toContain('--gw-border-strong:#8D99A7');
    expect(dark).toContain('--gw-neutral-border:#8D99A7');
    // new §2.1 tokens the wireframe language requires
    expect(dark).toContain('--gw-page-bg:#0B0F14');
    expect(dark).toContain('--gw-level-town:#4ED8C3');
    expect(dark).toContain('--gw-level-county:#E5A83B');
    expect(dark).toContain('--gw-level-state:#7DB1FB');
    expect(dark).toContain('--gw-info-text:#7DB1FB');
  });

  it('NEVER overrides a dimensional/floor token in the dark block (§11.5)', () => {
    const dark = block(':root[data-theme="dark"]');
    // NB: `--gw-text-secondary` / `--gw-text-muted` ARE colour tokens and SHOULD
    // be in the dark block — so the type-scale tokens are listed by exact name
    // rather than a `--gw-text-` prefix that would also match those colours.
    for (const dim of [
      '--gw-badge-min',
      '--gw-tap-min',
      '--gw-text-xs',
      '--gw-text-sm',
      '--gw-text-badge',
      '--gw-text-body',
      '--gw-text-md',
      '--gw-text-lg',
      '--gw-text-xl',
      '--gw-space-',
      '--gw-radius',
      '--gw-border-w',
      '--gw-font',
      '--gw-leading',
    ]) {
      expect(dark, `dark block must not set ${dim}`).not.toContain(dim);
    }
  });

  it('keeps the badge/tap floors on the shared base tokens (unchanged by dark)', () => {
    // identical guarantee the light floor test makes — proves dark did not move it
    expect(STYLE).toContain(`--gw-badge-min:${BADGE_MIN_FONT_PX}px`);
    expect(STYLE).toContain(`--gw-tap-min:${DRAWER_TAP_MIN_PX}px`);
    expect(STYLE).toContain('--gw-text-badge:var(--gw-badge-min)');
  });
});

describe('GOV-657 §8.1 — dark (Advanced) palette is WCAG 2.1 AA (recomputed)', () => {
  // [foreground, background, target, label] — the full §8.1 table (new values).
  const TEXT_PAIRS: [string, string, number, string][] = [
    ['#ECF1F7', '#0B0F14', 4.5, 'body on page'],
    ['#ECF1F7', '#12181F', 4.5, 'body on surface'],
    ['#ECF1F7', '#141B23', 4.5, 'body on subtle'],
    ['#C3CDD9', '#12181F', 4.5, 'secondary on surface'],
    ['#C3CDD9', '#141B23', 4.5, 'secondary on subtle'],
    ['#8D99A7', '#12181F', 4.5, 'muted on surface'],
    ['#8D99A7', '#141B23', 4.5, 'muted on subtle'],
    ['#4ED8C3', '#0B0F14', 4.5, 'mint on page (focus ring)'],
    ['#4ED8C3', '#12181F', 4.5, 'mint on surface'],
    ['#4ED8C3', '#0F1E1B', 4.5, 'mint on mint well'],
    ['#062019', '#4ED8C3', 4.5, 'on-mint (button)'],
    ['#63D68F', '#12181F', 4.5, 'ok text on surface'],
    ['#63D68F', '#101820', 4.5, 'ok text on ok well'],
    ['#63D68F', '#0E1A13', 4.5, 'ok text on ok-bg-soft'],
    ['#ECC35C', '#12181F', 4.5, 'caution text on surface'],
    ['#ECC35C', '#201A0E', 4.5, 'caution text on banner bg'],
    ['#ECC35C', '#1B160C', 4.5, 'caution text on caution-bg-soft'],
    ['#F4D488', '#201A0E', 4.5, 'caution-strong on caution bg'],
    ['#EE7A6D', '#12181F', 4.5, 'stop text on surface'],
    ['#EE7A6D', '#1D1412', 4.5, 'stop text on stop well'],
    ['#E5A83B', '#12181F', 4.5, 'county amber on surface'],
    ['#7DB1FB', '#12181F', 4.5, 'state blue on surface'],
    ['#7DB1FB', '#141B23', 4.5, 'info link on subtle'],
  ];
  const UI_PAIRS: [string, string, number, string][] = [
    ['#4ED8C3', '#12181F', 3.0, 'mint focus ring on surface'],
    ['#63D68F', '#12181F', 3.0, 'ok border on surface'],
    ['#E5A83B', '#12181F', 3.0, 'caution-line/county border on surface'],
    ['#EE7A6D', '#12181F', 3.0, 'stop border on surface'],
    ['#8D99A7', '#141B23', 3.0, 'strong border on subtle'],
    ['#8D99A7', '#12181F', 3.0, 'neutral border on surface'],
  ];

  it.each(TEXT_PAIRS)('text %s on %s ≥ %f:1 (%s)', (fg, bg, target) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(target);
  });

  it.each(UI_PAIRS)('UI %s on %s ≥ %f:1 (%s)', (fg, bg, target) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(target);
  });

  it('matches the spec §8.1 published ratios (guards a value typo)', () => {
    // spot-check the two tightest margins quoted in §8.1
    expect(contrast('#8D99A7', '#141B23')).toBeCloseTo(5.99, 1); // border-strong on subtle
    expect(contrast('#EE7A6D', '#12181F')).toBeCloseTo(6.50, 1); // stop border on surface
  });
});

describe('GOV-657 §8.2 — light (Simple/broadsheet) palette is WCAG 2.1 AA', () => {
  // New coverage: light was previously untested for contrast. [fg,bg,target,label].
  const LIGHT_PAIRS: [string, string, number, string][] = [
    ['#1E1C17', '#FBF7EB', 4.5, 'ink on paper'],
    ['#1E1C17', '#F3EDDD', 4.5, 'ink on canvas'],
    ['#1E1C17', '#FDFAF1', 4.5, 'ink on panel'],
    ['#4A463C', '#FBF7EB', 4.5, 'secondary ink on paper'],
    ['#6E685B', '#FBF7EB', 4.5, 'muted ink on paper'],
    ['#6E685B', '#FDFAF1', 4.5, 'muted ink on panel'],
    ['#1A4D8F', '#FBF7EB', 4.5, 'link/blue on paper'],
    ['#0E7A6E', '#FBF7EB', 4.5, 'town teal on paper'],
    ['#0E7A6E', '#FDFAF1', 4.5, 'town teal on panel'],
    ['#8F5D0E', '#FBF7EB', 4.5, 'county amber FIX on paper'],
    ['#8F5D0E', '#FDFAF1', 4.5, 'county amber FIX on panel'],
    ['#274F9B', '#FDFAF1', 4.5, 'state blue on panel'],
  ];

  it.each(LIGHT_PAIRS)('text %s on %s ≥ %f:1 (%s)', (fg, bg, target) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(target);
  });

  it('the county AA fix clears 4.5 where the raw wireframe value failed (§8.2)', () => {
    // wireframe drew #A36A10 (4.24 — FAILS); spec adopts #8F5D0E (5.24 — passes).
    expect(contrast('#A36A10', '#FBF7EB')).toBeLessThan(4.5); // documents the failure
    expect(contrast('#8F5D0E', '#FBF7EB')).toBeGreaterThanOrEqual(4.5); // the fix ships
    expect(contrast('#8F5D0E', '#FBF7EB')).toBeCloseTo(5.24, 1);
  });
});
