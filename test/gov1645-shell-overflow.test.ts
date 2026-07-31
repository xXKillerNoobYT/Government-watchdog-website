import { describe, it, expect } from 'vitest';
import { SHELL_STYLE } from '../src/ui/shell';

/**
 * GOV-1645 — no horizontal body scroll on the shell content wrapper.
 *
 * A co-owner review (GOV-1643, finding F1) reported a constant ~24px horizontal
 * body scroll on `main.gw-shell-content` at 1440/768/390. Live browser
 * measurement on the current bundle showed the report was a STALE-SERVER
 * phantom (it reproduced only against an older bundle whose shell predates the
 * Simple/Advanced mode attribute); the current shell keeps
 * `documentElement.scrollWidth === clientWidth` at all three widths in both
 * modes. See docs/evidence/GOV-1645/.
 *
 * The one real artifact was the default UA `<body>` margin (the app has no reset
 * and #app mounts directly on <body>), which both inset the full-bleed shell 8px
 * off the viewport edges and is the offset any future body-level element would
 * turn into exactly this class of horizontal scroll. This suite pins the CSS
 * invariants that keep the shell inside the viewport. The vitest environment has
 * no layout engine, so we assert the source-of-truth style rather than measured
 * geometry; the measured proof lives in docs/evidence/GOV-1645/.
 */

/** Return the declaration body between the braces of the first matching rule. */
function ruleBody(selectorLiteral: string): string {
  const start = SHELL_STYLE.indexOf(selectorLiteral);
  expect(start, `selector ${selectorLiteral} present in SHELL_STYLE`).toBeGreaterThanOrEqual(0);
  const open = SHELL_STYLE.indexOf('{', start);
  const close = SHELL_STYLE.indexOf('}', open);
  expect(open, 'rule opens').toBeGreaterThan(-1);
  expect(close, 'rule closes').toBeGreaterThan(open);
  return SHELL_STYLE.slice(open + 1, close);
}

describe('GOV-1645 — shell stays within the viewport (no horizontal body scroll)', () => {
  it('zeroes the default UA <body> margin so the shell is full-bleed and cannot offset into overflow', () => {
    // The reset must cover <body> (where #app mounts). Whitespace-tolerant.
    const normalized = SHELL_STYLE.replace(/\s+/g, '');
    expect(
      /(^|[},])html,body\{[^}]*margin:0/.test(normalized)
        || /(^|[},])body\{[^}]*margin:0/.test(normalized),
      'SHELL_STYLE resets the <body> margin to 0',
    ).toBe(true);
  });

  it('sizes the content wrapper by width:100% + max-width, never 100vw (which ignores the scrollbar)', () => {
    const content = ruleBody('.gw-shell-content{');
    expect(content, 'content wrapper fills its container').toContain('width:100%');
    expect(content, 'content wrapper is capped, not full-viewport').toMatch(/max-width:\s*\d/);
    // 100vw includes the vertical scrollbar and is the classic source of a few
    // px of horizontal body scroll — the shell must never size a width to it.
    expect(content).not.toContain('100vw');
  });

  it('keeps box-sizing:border-box on the shell chain so padding never widens a 100% box', () => {
    const rootBox = ruleBody('.gw-shell-root,.gw-shell-root *{');
    expect(rootBox).toContain('box-sizing:border-box');
  });

  it('never sizes any shell width to 100vw', () => {
    expect(SHELL_STYLE).not.toMatch(/(?:min-)?width:\s*100vw/);
  });
});


// GOV-88: the mobile bottom tab track is 836px inside a 390px viewport — 446px
// off-screen, 4 of 10 items visible, and `scrollbar-width:none` gives a touch
// user no signal that five destinations exist. Keyboard/AT users are unaffected
// (every tab is tabIndex 0 and focus scrolls it into view), which is what makes
// this a discoverability defect rather than a hidden lock.
//
// The affordance is a self-hiding scroll shadow: cover layers scroll WITH the
// content (`local`) while shadow layers stay put (`scroll`), so a shadow shows
// only while there is genuinely more content that way. These assertions pin the
// pieces that make it self-hiding — a later "simplify" that drops the mixed
// background-attachment would leave a shadow permanently stuck on at both ends,
// which is a worse lie than no shadow.
describe('GOV-88 mobile tab overflow is discoverable', () => {
  const mobileBlock = (): string => {
    const at = SHELL_STYLE.indexOf('@media (max-width:760px)');
    expect(at, 'mobile media query present').toBeGreaterThan(-1);
    return SHELL_STYLE.slice(at);
  };

  it('gives the fixed tab bar a scroll shadow on both edges', () => {
    const block = mobileBlock();
    expect(block).toContain('background-attachment:local,local,scroll,scroll');
    // Two covers + two shadows: four layers, or the self-hiding behaviour breaks.
    const sizes = /background-size:([^;]+);/.exec(block)?.[1] ?? '';
    expect(sizes.split(',')).toHaveLength(4);
    const positions = /background-position:([^;]+);/.exec(block)?.[1] ?? '';
    expect(positions.split(',')).toHaveLength(4);
  });

  it('keeps the cover layers opaque against the bar background', () => {
    // A transparent cover cannot hide its shadow at the scroll extreme, so the
    // shadow would never switch off. The cover must use the bar's own colour.
    const block = mobileBlock();
    expect(block).toContain('linear-gradient(to right,var(--gw-header-bg)');
    expect(block).toContain('linear-gradient(to left,var(--gw-header-bg)');
    expect(block).toContain('background-color:var(--gw-header-bg)');
  });

  /** The body of the fixed mobile tab-bar rule specifically — NOT the whole
   *  media-query tail. Scoping matters: `.gw-shell-actions` also declares
   *  `overflow-x:auto`, so a `toContain` over the region passed even with the
   *  declaration deleted from the tab bar. */
  const fixedTabsRule = (): string => {
    const block = mobileBlock();
    const at = block.indexOf('.gw-shell-tabs,.gw-shell-root[data-mode="simple"] .gw-shell-tabs{position:fixed');
    expect(at, 'fixed mobile tab-bar rule present').toBeGreaterThan(-1);
    const open = block.indexOf('{', at);
    return block.slice(open + 1, block.indexOf('}', open));
  };

  it('uses a theme-adaptive shadow colour, not a hardcoded black', () => {
    // This app ships a dark theme by default (--gw-header-bg #0D1218). A black
    // shadow there is invisible, so the affordance would be decorative in the
    // theme most people see — which is exactly what the first draft did.
    const block = mobileBlock();
    expect(block).toContain('linear-gradient(to right,var(--gw-border-strong)');
    expect(block).toContain('linear-gradient(to left,var(--gw-border-strong)');
    expect(fixedTabsRule(), 'no hardcoded black shadow').not.toMatch(/rgba\(0,\s*0,\s*0,\s*\.?\d/);
  });

  it('still scrolls — the shadow is an affordance, not a replacement', () => {
    expect(fixedTabsRule()).toContain('overflow-x:auto');
  });
});
