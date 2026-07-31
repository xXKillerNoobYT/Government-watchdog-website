// C8 (iteration 46) — URL-scheme validation for supplied hrefs.
//
// Source URLs originate in ingested external documents. `assertWebSafe` does not cover
// them (it guards raw-path and locator leakage), which was verified by planting
// `javascript:alert(1)` into the newsletter fixture: it passed assertWebSafe and then
// rendered into 4 live anchors on the detail view. This module is what stands between
// that value and an href.
import { describe, it, expect } from 'vitest';
import { safeExternalHref } from '../src/data/web-safe';

const TAB = String.fromCharCode(9);
const NEWLINE = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const NUL = String.fromCharCode(0);

describe('safeExternalHref', () => {
  it('allows ordinary http and https sources', () => {
    for (const url of [
      'https://example.gov/agenda.pdf',
      'http://example.gov/minutes',
      'https://web.archive.org/web/2026/https://example.gov/x',
    ]) {
      expect(safeExternalHref(url), url).toBe(url);
    }
  });

  it('allows in-app targets, which carry no scheme', () => {
    expect(safeExternalHref('#/vault')).toBe('#/vault');
    expect(safeExternalHref('/alpine/records')).toBe('/alpine/records');
  });

  it('refuses every script-bearing and local scheme', () => {
    for (const url of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'vbscript:msgbox(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'blob:https://example.gov/abc',
    ]) {
      expect(safeExternalHref(url), url).toBeNull();
    }
  });

  it('is not bypassable with control characters or padding', () => {
    // A browser parses every one of these as `javascript:`. A naive
    // `startsWith('javascript:')` check misses all but the first.
    for (const url of [
      '  javascript:alert(1)',
      `java${TAB}script:alert(1)`,
      `java${NEWLINE}script:alert(1)`,
      `java${CR}${NEWLINE}script:alert(1)`,
      `${NUL}javascript:alert(1)`,
      `${TAB}javascript:alert(1)`,
    ]) {
      expect(safeExternalHref(url), JSON.stringify(url)).toBeNull();
    }
  });

  it('refuses non-strings, empties and unparseable values rather than guessing', () => {
    for (const bad of [null, undefined, 42, {}, [], '', '   ', 'not a url', 'example.gov']) {
      expect(safeExternalHref(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});
