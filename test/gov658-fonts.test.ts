// GOV-658 (GOV-654 leg 2/5) — sub-leg 2c: self-hosted webfonts (spec §2.3 + §3.5).
//
// Guards the privacy-critical font posture so a reviewer, VSR, or CI can
// re-verify it mechanically instead of by eye:
//
//   1. §3.5 zero-leak: NO third-party font-CDN reference anywhere in src/ — a
//      gated `noindex` reviewer app must emit zero runtime beacons to Google
//      Fonts (or any CDN). Fonts are vendored (`@fontsource/*`) and served from
//      our own origin through the Vite build.
//   2. §2.3 token stacks lead with a self-hosted family and keep a legible
//      system fallback (no FOIT if a webfont fails).
//   3. §2.3 weight budget: `src/ui/fonts.ts` imports only the enumerated
//      `latin-*` weights (not the all-subsets barrel that blows the ≤350KB
//      budget), and imports every weight the spec calls for.
//   4. Boot wiring: `src/main.ts` actually imports the font module — otherwise
//      the tokens name families the origin never serves.
//
// Source text is read via Vite `?raw` imports + `import.meta.glob` (typed by
// vite/client, already in tsconfig `types`) — no Node `fs`, so typecheck stays
// green without adding `@types/node`.
import { describe, it, expect } from 'vitest';
import { GW_TOKENS } from '../src/ui/tokens';
import { SELF_HOSTED_FONT_FAMILIES } from '../src/ui/fonts';
import fontsSource from '../src/ui/fonts.ts?raw';
import mainSource from '../src/main.ts?raw';
import pkg from '../package.json';

// Every TypeScript source under src/, as raw text, keyed by path.
const SRC_FILES = import.meta.glob('../src/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Extract a single `--token:value;` declaration value out of GW_TOKENS. */
function tokenValue(name: string): string {
  const m = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(GW_TOKENS);
  expect(m, `token ${name} present`).not.toBeNull();
  return m![1].trim();
}

describe('GOV-658 §2.3 — self-hosted webfonts', () => {
  it('token font stacks lead with a vendored family + keep a system fallback (§2.3)', () => {
    const sans = tokenValue('--gw-font');
    const serif = tokenValue('--gw-font-serif');
    const mono = tokenValue('--gw-font-mono');

    expect(sans).toMatch(/^'Public Sans'/);
    expect(serif).toMatch(/^'Newsreader'/);
    expect(mono).toMatch(/^'IBM Plex Mono'/);

    // Fallback stack survives a font-load failure — never a bare single family.
    expect(sans).toMatch(/system-ui|sans-serif/);
    expect(serif).toMatch(/Georgia|serif/);
    expect(mono).toMatch(/ui-monospace|monospace/);
  });

  it('every token family is one we self-host (no un-vendored family named first)', () => {
    for (const family of SELF_HOSTED_FONT_FAMILIES) {
      expect(GW_TOKENS).toContain(`'${family}'`);
    }
  });

  it('§3.5 — zero third-party font-CDN references anywhere in src/', () => {
    const banned = [
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'use.typekit',
      'fonts.bunny.net',
    ];
    const scanned = Object.keys(SRC_FILES);
    expect(scanned.length, 'glob picked up src files').toBeGreaterThan(5);
    for (const [path, text] of Object.entries(SRC_FILES)) {
      for (const host of banned) {
        expect(text.includes(host), `${path} must not reference ${host}`).toBe(false);
      }
    }
  });

  it('§2.3 weight budget — fonts.ts imports exactly the enumerated latin weights', () => {
    const expectedImports = [
      '@fontsource/public-sans/latin-400.css',
      '@fontsource/public-sans/latin-600.css',
      '@fontsource/public-sans/latin-700.css',
      '@fontsource/public-sans/latin-800.css',
      '@fontsource/newsreader/latin-400.css',
      '@fontsource/newsreader/latin-600.css',
      '@fontsource/newsreader/latin-700.css',
      '@fontsource/newsreader/latin-400-italic.css',
      '@fontsource/ibm-plex-mono/latin-400.css',
      '@fontsource/ibm-plex-mono/latin-500.css',
    ];
    for (const imp of expectedImports) {
      expect(fontsSource, `imports ${imp}`).toContain(imp);
    }
    // No all-subsets barrel import (e.g. `@fontsource/public-sans/400.css`
    // without the latin- prefix pulls every unicode subset → blows the budget).
    expect(fontsSource).not.toMatch(/@fontsource\/[^/]+\/\d+(-italic)?\.css/);
    expect(fontsSource).not.toMatch(/@fontsource\/[^/]+\/index\.css/);
  });

  it('@fontsource families are declared runtime dependencies (reproducible in CI)', () => {
    const deps = (pkg as { dependencies?: Record<string, string> }).dependencies ?? {};
    expect(deps['@fontsource/public-sans']).toBeTruthy();
    expect(deps['@fontsource/newsreader']).toBeTruthy();
    expect(deps['@fontsource/ibm-plex-mono']).toBeTruthy();
  });

  it('boot wires the font module (§2.3 — else tokens name families the origin never serves)', () => {
    expect(mainSource).toMatch(/import\s+['"]\.\/ui\/fonts['"]/);
  });
});
