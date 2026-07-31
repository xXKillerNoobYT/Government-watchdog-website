// @vitest-environment jsdom
//
// GOV-1569 hostile-input hunt (C7b/C9, 2026-07-31). The existing suite proves the
// HONESTY contract; this proves ROBUSTNESS, which nothing else asserted for a
// surface that accepts files from a person.
//
// Three properties, each a real regression risk on an upload form:
//   1. validation never throws on a well-formed StagedUpload carrying hostile
//      VALUES (a throw here strands the user mid-form with no state),
//   2. an error message never echoes the raw value back — echoing is both an
//      injection vector and a leak, and F0 §C7 forbids reflecting raw input,
//   3. an error message stays bounded, so a 5000-char origin cannot blow the
//      layout or the aria-live announcement.
//
// Deliberately NOT asserted: that validation rejects long or path-like
// filenames. Spec §3.2 defines validation as MECHANICAL — type, size, required
// provenance — and nothing else. The name is rendered as text (el() uses
// createTextNode) and the backend is the sanitising boundary, exactly as the
// client gate is not the confidentiality boundary. A future pass should not
// "fix" this into a content judgement.
import { describe, it, expect } from 'vitest';
import { validateStagedUpload, DEFAULT_INTAKE_CONSTRAINTS, formatBytes } from '../src/ui/gated-upload';
import type { StagedUpload } from '../src/types/upload-intake';

const staged = (over: Partial<StagedUpload> = {}): StagedUpload => ({
  file: { name: 'minutes.pdf', sizeBytes: 1024, mimeType: 'application/pdf' },
  provenance: { sourceOrigin: 'Town clerk email', description: 'June minutes' },
  ...over,
});

describe('GOV-1569 upload validation is robust against hostile values', () => {
  const cases: [string, StagedUpload][] = [
    ['5000-char filename', staged({ file: { name: 'x'.repeat(5000), sizeBytes: 10, mimeType: 'application/pdf' } })],
    ['path traversal name', staged({ file: { name: '../../etc/passwd', sizeBytes: 10, mimeType: 'application/pdf' } })],
    ['negative size', staged({ file: { name: 'a.pdf', sizeBytes: -5, mimeType: 'application/pdf' } })],
    ['NaN size', staged({ file: { name: 'a.pdf', sizeBytes: NaN, mimeType: 'application/pdf' } })],
    ['empty name', staged({ file: { name: '', sizeBytes: 10, mimeType: 'application/pdf' } })],
    ['markup in origin', staged({ provenance: { sourceOrigin: '<img src=x onerror=alert(1)>', description: 'd' } })],
    ['5000-char origin', staged({ provenance: { sourceOrigin: 'o'.repeat(5000), description: 'd' } })],
  ];
  for (const [label, input] of cases) {
    it(`does not throw and stays mechanical: ${label}`, () => {
      let res: ReturnType<typeof validateStagedUpload> | undefined;
      let threw: string | null = null;
      try { res = validateStagedUpload(input, DEFAULT_INTAKE_CONSTRAINTS); }
      catch (e) { threw = String(e); }
      console.log(`  ${label} -> ${threw ?? JSON.stringify(res)}`);
      expect(threw, label).toBeNull();
      // An error message must never echo the raw value back (leak / injection vector).
      const msg = `${res?.fileError ?? ''}${res?.originError ?? ''}${res?.descriptionError ?? ''}`;
      expect(msg.includes('onerror'), `${label}: echoes markup`).toBe(false);
      expect(msg.length, `${label}: unbounded message`).toBeLessThan(400);
    });
  }
  it('formatBytes never emits scientific notation for a real file size', () => {
    // File.size is bounded well below 1e21; check the realistic domain.
    for (const n of [0, 1, 1023, 1024, 1e6, 1e9, 1e12, Number.MAX_SAFE_INTEGER]) {
      expect(formatBytes(n), String(n)).not.toMatch(/e\+/);
    }
  });
});
