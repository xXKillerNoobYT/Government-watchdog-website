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
