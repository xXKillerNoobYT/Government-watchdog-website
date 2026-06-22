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

  it('re-declares the §11.1 dark COLOR values', () => {
    const dark = block(':root[data-theme="dark"]');
    // a representative span of the §11.1 table (surface, text, accent, each tone)
    expect(dark).toContain('--gw-surface:#15181d');
    expect(dark).toContain('--gw-text:#f2f4f7');
    expect(dark).toContain('--gw-accent:#8ab4f8');
    expect(dark).toContain('--gw-accent-text-on:#0b1b30');
    expect(dark).toContain('--gw-ok-text:#8fe6a8');
    expect(dark).toContain('--gw-caution-text:#f5cf6a');
    expect(dark).toContain('--gw-stop-text:#f6a39a');
    expect(dark).toContain('--gw-stop-border:#e57368');
    expect(dark).toContain('--gw-border-strong:#8a93a0');
    expect(dark).toContain('--gw-neutral-border:#8a93a0');
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

describe('GOV-440 — dark palette is WCAG 2.1 AA (recomputed from §11.1 values)', () => {
  // [foreground, background, target, label] — the full §11.2 table.
  const TEXT_PAIRS: [string, string, number, string][] = [
    ['#f2f4f7', '#15181d', 4.5, 'body on surface'],
    ['#ced5de', '#15181d', 4.5, 'secondary on surface'],
    ['#a4adba', '#15181d', 4.5, 'muted on surface'],
    ['#ced5de', '#1e232b', 4.5, 'secondary on subtle'],
    ['#a4adba', '#1e232b', 4.5, 'muted on subtle'],
    ['#8ab4f8', '#15181d', 4.5, 'link on surface'],
    ['#8ab4f8', '#1b2942', 4.5, 'accent on accent-tint'],
    ['#0b1b30', '#8ab4f8', 4.5, 'text-on-accent (button)'],
    ['#8fe6a8', '#14241a', 4.5, 'ok text on ok bg'],
    ['#8fe6a8', '#172b1d', 4.5, 'ok text on ok-bg-soft'],
    ['#f5cf6a', '#2a2410', 4.5, 'caution text on caution bg'],
    ['#f8d98a', '#2a2410', 4.5, 'caution banner on caution bg'],
    ['#f5cf6a', '#211d12', 4.5, 'caution text on caution-bg-soft'],
    ['#f6a39a', '#2a1512', 4.5, 'stop text on stop bg'],
  ];
  const UI_PAIRS: [string, string, number, string][] = [
    ['#8ab4f8', '#15181d', 3.0, 'focus ring on surface'],
    ['#8fe6a8', '#15181d', 3.0, 'ok border on surface'],
    ['#d9a400', '#15181d', 3.0, 'caution-line on surface'],
    ['#e57368', '#15181d', 3.0, 'stop border on surface'],
    ['#8ab4f8', '#1b2942', 3.0, 'accent border on accent-tint'],
    ['#8a93a0', '#15181d', 3.0, 'strong/neutral border on surface'],
  ];

  it.each(TEXT_PAIRS)('text %s on %s ≥ %f:1 (%s)', (fg, bg, target) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(target);
  });

  it.each(UI_PAIRS)('UI %s on %s ≥ %f:1 (%s)', (fg, bg, target) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(target);
  });

  it('matches the spec §11.2 published ratios (guards a value typo)', () => {
    // spot-check the two tightest margins quoted in §11.2
    expect(contrast('#8a93a0', '#15181d')).toBeCloseTo(5.73, 1); // border-strong/neutral
    expect(contrast('#e57368', '#15181d')).toBeCloseTo(5.92, 1); // stop border
  });
});
