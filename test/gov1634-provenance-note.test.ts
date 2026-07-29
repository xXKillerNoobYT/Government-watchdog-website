// @vitest-environment jsdom
//
// GOV-1634 (GOV-1566 F2 follow-up) — surface the web-safe `provenance_note`
// free-text field that the B6 read projection now emits (backend GOV-1625)
// alongside the validated `original_url`. Proves the presenter + render
// contract:
//
//   - the presenter exposes the note present-only (trimmed), undefined when
//     absent/blank — never invents a provenance line,
//   - the render shows the note as a plain provenance line, DISTINCT from the
//     `original_url` locator (a note-present / note-absent fixture pair),
//   - the GOV-1609 §4.2 linkify guard holds BOTH ways on this surface:
//       * it FIRES for `original_url` — a validated http(s) URL renders as an
//         anchor,
//       * it STAYS SILENT for `provenance_note` — free-text prose is NEVER
//         auto-linkified, even when it contains a URL-shaped substring; the
//         note renders as a plain text node with no anchor derived from it,
//   - the whole projection (note present) still passes assertWebSafe, and a
//     planted raw/vault path inside the note fails loud (fail-closed posture).
import { describe, it, expect } from 'vitest';
import { suppliedFileProvenanceNote } from '../src/ui/supplied-files';
import { renderSuppliedFiles } from '../src/ui/pages-program';
import { assertWebSafe, RawPathLeak } from '../src/data/web-safe';
import type { SuppliedFilesProjection, SuppliedSourceFile } from '../src/types/read-api';
import suppliedFilesData from '../src/fixtures/alpine-supplied-files.json';

const FIXTURE = suppliedFilesData as unknown as SuppliedFilesProjection;

function file(p: Partial<SuppliedSourceFile> & { file_id: string; title: string }): SuppliedSourceFile {
  return { ...p };
}

function projection(files: SuppliedSourceFile[], pending?: number): SuppliedFilesProjection {
  return { access: 'reviewer_internal', files, pending_review_count: pending };
}

describe('GOV-1634 suppliedFileProvenanceNote (present-only, verbatim)', () => {
  it('returns the trimmed note when present', () => {
    expect(suppliedFileProvenanceNote(file({ file_id: 'f', title: 'T', provenance_note: '  Clerk email  ' }))).toBe('Clerk email');
  });

  it('is undefined when the note is absent, empty, or whitespace', () => {
    expect(suppliedFileProvenanceNote(file({ file_id: 'f', title: 'T' }))).toBeUndefined();
    expect(suppliedFileProvenanceNote(file({ file_id: 'f', title: 'T', provenance_note: null }))).toBeUndefined();
    expect(suppliedFileProvenanceNote(file({ file_id: 'f', title: 'T', provenance_note: '' }))).toBeUndefined();
    expect(suppliedFileProvenanceNote(file({ file_id: 'f', title: 'T', provenance_note: '   ' }))).toBeUndefined();
  });

  it('does not derive a link — even a URL-shaped note is returned verbatim as prose', () => {
    const note = 'See https://evil.example.com — but this is only prose the clerk typed';
    expect(suppliedFileProvenanceNote(file({ file_id: 'f', title: 'T', provenance_note: note }))).toBe(note);
  });
});

describe('GOV-1634 render — provenance line present / absent pair', () => {
  const q = new URLSearchParams();

  it('shipped fixture: file[0] shows the note verbatim, file[1] shows none', () => {
    const node = renderSuppliedFiles(FIXTURE, q);
    const rows = node.querySelectorAll('[data-test="supplied-file-row"]');
    expect(rows.length).toBe(FIXTURE.files.length);

    const withNote = node.querySelector('[data-file-id="sf_2f1a9c"]');
    const noteEl = withNote?.querySelector('[data-test="supplied-file-provenance-note"]');
    expect(noteEl).not.toBeNull();
    expect(noteEl?.textContent).toContain(String(FIXTURE.files[0].provenance_note));

    const withoutNote = node.querySelector('[data-file-id="sf_7b3e04"]');
    expect(withoutNote?.querySelector('[data-test="supplied-file-provenance-note"]')).toBeNull();
  });
});

describe('GOV-1634 §4.2 linkify guard — fires for origin_url, stays silent for the note', () => {
  const q = new URLSearchParams();

  it('FIRES: a validated http(s) original_url renders as an anchor', () => {
    const node = renderSuppliedFiles(
      projection([file({ file_id: 'f', title: 'T', meeting_id: 1, original_url: 'https://reviewed.example.gov/f.pdf' })]),
      q,
    );
    const anchor = node.querySelector('[data-test="supplied-file-original"]');
    expect(anchor?.getAttribute('href')).toBe('https://reviewed.example.gov/f.pdf');
  });

  it('STAYS SILENT: a URL-shaped provenance_note is plain text, never an anchor', () => {
    const noteUrl = 'https://evil.example.com/phish';
    const node = renderSuppliedFiles(
      projection([file({ file_id: 'f', title: 'T', meeting_id: 1, provenance_note: `Origin: ${noteUrl}` })]),
      q,
    );
    const noteEl = node.querySelector('[data-test="supplied-file-provenance-note"]');
    // The note text renders verbatim...
    expect(noteEl?.textContent).toContain(noteUrl);
    // ...but is a plain text node: no anchor lives inside the note element...
    expect(noteEl?.querySelector('a')).toBeNull();
    // ...and no anchor anywhere in the card was derived from the note URL.
    const hrefs = Array.from(node.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).not.toContain(noteUrl);
  });
});

describe('GOV-1634 web-safe boundary (fail-closed on the note)', () => {
  it('the note-present shipped fixture passes assertWebSafe', () => {
    expect(() => assertWebSafe(FIXTURE)).not.toThrow();
  });

  it('a raw/vault path planted in provenance_note fails loud', () => {
    const leaky = projection([file({ file_id: 'x', title: 'X', provenance_note: 'saved to /Users/isaac/vault/x.pdf' })]);
    expect(() => assertWebSafe(leaky)).toThrow(RawPathLeak);
  });
});
