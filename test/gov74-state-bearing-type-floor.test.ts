// GOV-74: state-bearing type must never render below the accessibility floor.
//
// The MOTY baseline specifies an AI badge at 9.5px and section labels at 11px.
// This system pins BADGE_MIN_FONT_PX = 13 and exempts only decorative kickers —
// a deliberate, recorded departure (see docs/ui-design-system.md §Deviation ledger).
//
// The existing tests assert the TOKEN VALUE exists. They do not assert that any
// particular class uses it, which is the hole this closes: a fidelity pass reading
// the baseline literally could set `.gw-shell-origin{font:500 11.5px}` — as it in
// fact had — and every test would stay green.
import { describe, it, expect } from 'vitest';
import { BADGE_MIN_FONT_PX } from '../src/ui/tokens';

// Every exported *_STYLE constant in src/ui, as raw text.
const STYLE_SOURCES = import.meta.glob('../src/ui/*.ts', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

/**
 * Classes that carry STATE a reviewer must be able to read: trust chips, the AI
 * disclosure, and the origin/fixture banner. Decorative classes (kickers, meta,
 * brand lockup) are deliberately exempt and are NOT listed.
 */
const STATE_BEARING = [
  'gw-shell-origin',      // the LIVE / SYNTHETIC FIXTURE banner
  'gw-home-chip',         // trust + claim chips (composes gw-badge-ai)
  'gw-dp-ai-badge',       // AI disclosure in the design lane
];

/** Every `.cls{…}` rule body for `cls`, across all ui sources. */
function rulesFor(cls: string): string[] {
  const out: string[] = [];
  for (const src of Object.values(STYLE_SOURCES)) {
    for (const m of src.matchAll(new RegExp(`\\.${cls}\\b[^{}]*\\{([^{}]*)\\}`, 'g'))) out.push(m[1]);
  }
  return out;
}

describe('GOV-74 state-bearing type never declares a raw sub-floor size', () => {
  it.each(STATE_BEARING)('%s declares no raw px font size below the floor', (cls) => {
    const rules = rulesFor(cls);
    // Guard the derivation: a class that matches nothing would pass vacuously.
    expect(rules.length, `${cls} has at least one rule`).toBeGreaterThan(0);
    for (const body of rules) {
      for (const m of body.matchAll(/font(?:-size)?\s*:[^;]*?(\d+(?:\.\d+)?)px/g)) {
        expect(
          Number(m[1]),
          `${cls} declares ${m[1]}px, below the ${BADGE_MIN_FONT_PX}px state-bearing floor`,
        ).toBeGreaterThanOrEqual(BADGE_MIN_FONT_PX);
      }
    }
  });

  it('the floor itself is still 13 and --gw-text-badge maps onto it', () => {
    expect(BADGE_MIN_FONT_PX).toBe(13);
    const tokens = STYLE_SOURCES['../src/ui/tokens.ts'];
    expect(tokens).toContain('--gw-text-badge:var(--gw-badge-min)');
  });
});
