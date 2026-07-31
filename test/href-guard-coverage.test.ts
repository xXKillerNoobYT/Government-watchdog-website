// C13 (iteration 48) — the C8 href fix is central, so its COVERAGE needs a guard.
//
// C8 refused unsafe URL schemes inside every module's `el()` attribute setter rather than
// at ~28 call sites, because patching call sites invites the one that gets missed. That is
// the right shape, but it has a failure mode of its own: a NEW module with its own `el()`
// helper, or one revert, silently reopens the hole with every test still green.
//
// So this sweep asserts the property directly: every module that sets attributes from a
// record must route `href` through `safeExternalHref`. Derived from the source, never
// enumerated, and guarded against matching nothing.
import { describe, it, expect } from 'vitest';

const sources = import.meta.glob('../src/ui/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/**
 * The public lane is DELIBERATELY excluded and the exclusion is asserted, not assumed.
 * These modules are in `PUBLIC_LOCAL_MODULES` (vite.config.ts), so importing
 * `src/data/web-safe` into them would break the public bundle boundary — `build:all` is
 * what proves that. They render no backend data, so they take no supplied href.
 */
const PUBLIC_LANE = ['info-note.ts', 'public-landing.ts', 'fonts.ts', 'tokens.ts'];

/**
 * Comments must be stripped before testing for the call. The first version of this guard
 * used `src.includes('safeExternalHref')`, which the explanatory COMMENT above the check
 * satisfies — so deleting the actual call while keeping the comment passed. Caught by red
 * proof. A guard that matches prose is not testing behaviour.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Modules whose `el()` builds elements from an attribute record. */
function setsAttributesFromRecord(src: string): boolean {
  return /Object\.entries\(attrs\)/.test(src);
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

describe('C13 — every attribute setter refuses unsafe href schemes', () => {
  const builders = Object.entries(sources).filter(([, src]) => setsAttributesFromRecord(src));

  it('finds the attribute-setting modules at all', () => {
    // Without this, a changed helper shape turns the whole sweep into decoration.
    expect(builders.length).toBeGreaterThan(15);
  });

  it('routes href through safeExternalHref in every non-public module', () => {
    const unguarded = builders
      .filter(([path]) => !PUBLIC_LANE.includes(basename(path)))
      .filter(([, src]) => !/safeExternalHref\s*\(/.test(stripComments(src)))
      .map(([path]) => basename(path));
    expect(
      unguarded,
      `these build elements from an attribute record but never call safeExternalHref, so a `
      + `supplied javascript: URL would reach the DOM:\n${unguarded.join('\n')}`,
    ).toEqual([]);
  });

  it('keeps the public lane free of the validator, so the bundle boundary holds', () => {
    // The exclusion is deliberate; if one of these ever imports it, `build:all` fails and
    // this test says why before the build does.
    for (const name of PUBLIC_LANE) {
      const entry = Object.entries(sources).find(([path]) => basename(path) === name);
      if (!entry) continue;
      expect(entry[1], `${name} is in PUBLIC_LOCAL_MODULES and must not import src/data`)
        .not.toMatch(/from '\.\.\/data\//);
    }
  });
});
