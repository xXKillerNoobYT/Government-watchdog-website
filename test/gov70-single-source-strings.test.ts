// GOV-70 (iteration 49) — per-field "unavailable" messages come from one place.
//
// #70 says an honesty fix "has to be applied three to five times". MEASURED before
// changing anything, that is now substantially false: design-pages.ts and
// pages-program.ts already call the same five shared helpers (trustLabel,
// verificationStatusLabel, correctionStatusLabel, provenanceBadge, confidenceLabel) once
// each, so the vocabulary was already centralised in statement-presenter.ts.
//
// Across all of src/ui exactly ONE per-field message appeared in more than one module:
// 'Confidence: unavailable'. This guard keeps it that way — and would catch the next one.
import { describe, it, expect } from 'vitest';
import { CONFIDENCE_UNAVAILABLE } from '../src/ui/statement-presenter';

const sources = import.meta.glob('../src/ui/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('GOV-70 — no per-field unavailable message is duplicated across modules', () => {
  it('scans a non-empty set of modules', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10);
  });

  it('emits the confidence message from exactly one module', () => {
    const holders = Object.entries(sources)
      .filter(([, src]) => stripComments(src).includes(`'${CONFIDENCE_UNAVAILABLE}'`))
      .map(([path]) => path.slice(path.lastIndexOf('/') + 1));
    expect(holders, `literal appears in: ${holders.join(', ')}`).toEqual(['statement-presenter.ts']);
  });

  it('finds no OTHER per-field message duplicated across modules', () => {
    const seen = new Map<string, Set<string>>();
    for (const [path, raw] of Object.entries(sources)) {
      const name = path.slice(path.lastIndexOf('/') + 1);
      for (const lit of stripComments(raw).matchAll(/'([^']*(?:unavailable|not present|not supplied)[^']*)'/g)) {
        const text = lit[1];
        // A bare token is a shared word, not a per-field message.
        if (text.split(/\s+/).length < 2) continue;
        if (!seen.has(text)) seen.set(text, new Set());
        seen.get(text)!.add(name);
      }
    }
    const duplicated = [...seen.entries()]
      .filter(([, mods]) => mods.size > 1)
      .map(([text, mods]) => `${JSON.stringify(text)} in ${[...mods].sort().join(', ')}`);
    expect(
      duplicated,
      `these per-field messages live in more than one module and will drift apart:\n${duplicated.join('\n')}`,
    ).toEqual([]);
  });
});
