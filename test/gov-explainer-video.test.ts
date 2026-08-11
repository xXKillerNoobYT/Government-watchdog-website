import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SHARED_BINARY_ASSETS } from '../vite.config';

/**
 * The explainer walkthrough is an ILLUSTRATION, not a record.
 *
 * Owner, 2026-08-11: "just an example really, made up numbers, but the goal."
 *
 * These tests exist because the failure they guard is not a crash — it is a
 * credibility failure that renders perfectly. A watchdog product that presents
 * constructed filings and aspirational percentages as findings has conceded its
 * own argument, and nothing in a build log would ever notice.
 */

const source = readFileSync(new URL('../src/ui/public-landing.ts', import.meta.url), 'utf8');

describe('explainer disclosure', () => {
  it('states in the page that the case is not an Alpine record', () => {
    expect(source).toContain('Illustrative example — not Alpine records.');
  });

  it('names the constructed specifics rather than disclaiming vaguely', () => {
    // A generic "for illustration only" is easy to miss and easy to disbelieve.
    // Naming the resolution and the street is what makes it unambiguous.
    expect(source).toContain('Resolution 2026-041');
    expect(source).toContain('Cedar Street');
    expect(source).toMatch(/constructed to show how the tool reads an agenda item/);
  });

  it('marks the percentages as a target, never as a measurement', () => {
    expect(source).toMatch(/the outcome this product aims for, not a measured result/);
    // Guard the specific regression: a bare percentage presented as fact.
    expect(source).not.toMatch(/\b96%\s*(of|informed)/i);
  });
});

describe('explainer media', () => {
  it('does not download until the visitor asks for it', () => {
    // Alpine is the rural-connection audience this product serves. A 1.7 MB
    // autoload on the landing page is a real cost to the people it is for.
    expect(source).toContain("preload: 'none'");
    expect(source).toContain("poster: '/media/explainer-poster.jpg'");
    expect(source).not.toContain('autoplay');
  });

  it('is reachable and described for assistive technology', () => {
    expect(source).toContain("controls: ''");
    expect(source).toContain("'aria-describedby': 'explainer-disclosure explainer-summary'");
    // The video is silent, so the text summary is the accessible equivalent.
    expect(source).toContain('The video is silent. In text:');
  });

  it('references only same-origin paths', () => {
    for (const m of source.matchAll(/(?:src|poster):\s*'([^']+)'/g)) {
      expect(m[1].startsWith('/')).toBe(true);
    }
  });

  it('emits both media files into every lane', () => {
    expect(SHARED_BINARY_ASSETS).toContain('media/explainer.mp4');
    expect(SHARED_BINARY_ASSETS).toContain('media/explainer-poster.jpg');
  });
});
