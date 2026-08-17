// @vitest-environment jsdom
//
// GOV-1570 (GOV-1566 F2) — reviewed supplied files in the source drawer,
// consuming the B6 web-safe projection ONLY. Proves the fail-closed contract:
//
//   - only web_safe files render — the projection carries no per-file review
//     flag, so presence IS the verdict; the raw `review_state` key would trip
//     assertWebSafe (it is on RAW_PATH_FORBIDDEN_KEYS),
//   - pending/held files never leak content: the placeholder is a bare count,
//     never a filename / uploader / version of a not-yet-reviewed file,
//   - files tie to the correct meeting / agenda item (agenda-item tie is
//     tightest; no tie context ⇒ no files, never a dump),
//   - the whole projection passes assertWebSafe (fail-loud on a planted raw path),
//   - the shipped contract fixture renders in the vault source drawer.
import { describe, it, expect } from 'vitest';
import {
  suppliedFilesForItem,
  groupSuppliedFilesByMeeting,
  pendingReviewNotice,
  suppliedFileMeta,
  suppliedFileHeading,
} from '../src/ui/supplied-files';
import { renderSuppliedFiles } from '../src/ui/pages-program';
import { assertWebSafe, RawPathLeak, RAW_PATH_FORBIDDEN_KEYS } from '../src/data/web-safe';
import type { SuppliedFilesProjection, SuppliedSourceFile } from '../src/types/read-api';
import suppliedFilesData from '../src/fixtures/alpine-supplied-files.json';

const FIXTURE = suppliedFilesData as unknown as SuppliedFilesProjection;

function file(p: Partial<SuppliedSourceFile> & { file_id: string; title: string | null }): SuppliedSourceFile {
  return { ...p };
}

function projection(files: SuppliedSourceFile[], pending?: number): SuppliedFilesProjection {
  return { access: 'web_safe', files, pending_review_count: pending };
}

describe('GOV-1570 supplied-files tie (meeting / agenda item)', () => {
  const a = file({ file_id: 'f1', title: 'Packet', meeting_id: 148, agenda_item_id: 'ai_148_03' });
  const b = file({ file_id: 'f2', title: 'Minutes', meeting_id: 148, agenda_item_id: null });
  const c = file({ file_id: 'f3', title: 'Other packet', meeting_id: 200, agenda_item_id: 'ai_200_01' });
  const proj = projection([a, b, c]);

  it('agenda-item tie is tightest and wins over meeting', () => {
    expect(suppliedFilesForItem(proj, { agendaItemId: 'ai_148_03', meetingId: 148 })).toEqual([a]);
  });

  it('falls back to the meeting tie when no agenda item is given', () => {
    expect(suppliedFilesForItem(proj, { meetingId: 148 })).toEqual([a, b]);
  });

  it('matches a meeting id across number/string forms', () => {
    expect(suppliedFilesForItem(proj, { meetingId: '148' })).toEqual([a, b]);
  });

  it('fails closed: no tie context ⇒ no files (never dumps everything)', () => {
    expect(suppliedFilesForItem(proj, {})).toEqual([]);
    expect(suppliedFilesForItem(proj, { meetingId: '', agendaItemId: '' })).toEqual([]);
  });

  it('groups by meeting deterministically, untied files under null', () => {
    const untied = file({ file_id: 'f4', title: 'Loose', meeting_id: null });
    const groups = groupSuppliedFilesByMeeting(projection([a, b, c, untied]));
    expect(groups.map((g) => g.meetingId)).toEqual(['148', '200', null]);
    expect(groups[0].files).toEqual([a, b]);
  });
});

describe('GOV-1570 pending placeholder is content-free', () => {
  it('shows a bare count and nothing else', () => {
    expect(pendingReviewNotice(projection([], 3))).toBe(
      '3 supplied files pending review — not shown until independently reviewed.',
    );
    expect(pendingReviewNotice(projection([], 1))).toContain('1 supplied file ');
  });

  it('is absent for zero / negative / NaN / missing counts', () => {
    expect(pendingReviewNotice(projection([], 0))).toBeUndefined();
    expect(pendingReviewNotice(projection([], -1))).toBeUndefined();
    expect(pendingReviewNotice(projection([], Number.NaN))).toBeUndefined();
    expect(pendingReviewNotice(projection([]))).toBeUndefined();
  });
});

describe('GOV-1570 web-safe boundary', () => {
  it('the raw review_state key is denylisted (never crosses the wire)', () => {
    expect(RAW_PATH_FORBIDDEN_KEYS as readonly string[]).toContain('review_state');
    // A projection carrying it fails loud rather than rendering a raw state.
    const leaky = { access: 'web_safe', files: [{ file_id: 'x', title: 'X', review_state: 'pending' }] };
    expect(() => assertWebSafe(leaky)).toThrow(RawPathLeak);
  });

  it('the shipped contract fixture passes assertWebSafe', () => {
    expect(() => assertWebSafe(FIXTURE)).not.toThrow();
  });

  it('a planted raw/vault path in a file fails loud', () => {
    const leaky = projection([file({ file_id: 'x', title: 'X', original_url: '/Users/isaac/vault/x.pdf' } as SuppliedSourceFile)]);
    expect(() => assertWebSafe(leaky)).toThrow(RawPathLeak);
  });

  it('metadata rows never include a raw-path field', () => {
    const rows = suppliedFileMeta(FIXTURE.files[0]);
    for (const row of rows) {
      expect(RAW_PATH_FORBIDDEN_KEYS as readonly string[]).not.toContain(row.key);
      expect(row.value).not.toMatch(/^\/(Users|home|var|tmp|private|Volumes)\//);
    }
  });
});

describe('GOV-1570 render (source drawer)', () => {
  const q = new URLSearchParams();

  it('renders honest empty panel when B6 is not wired (no projection)', () => {
    const node = renderSuppliedFiles(undefined, q);
    expect(node.getAttribute('data-state')).toBe('empty');
    expect(node.querySelector('[data-test="supplied-file-row"]')).toBeNull();
    expect(node.textContent).toContain('not wired yet');
  });

  it('renders reviewed files grouped by meeting, with links', () => {
    const node = renderSuppliedFiles(FIXTURE, q);
    const rows = node.querySelectorAll('[data-test="supplied-file-row"]');
    expect(rows.length).toBe(FIXTURE.files.length);
    const group = node.querySelector('[data-test="supplied-files-group"]');
    expect(group?.getAttribute('data-meeting-id')).toBe('148');
    expect(node.querySelector('[data-test="supplied-file-original"]')?.getAttribute('href')).toMatch(/^https:\/\//);
  });

  it('renders the pending count but no pending file content', () => {
    const node = renderSuppliedFiles(FIXTURE, q);
    const pending = node.querySelector('[data-test="supplied-files-pending"]');
    expect(pending?.textContent).toContain('pending review');
    // Exactly the reviewed files are present as rows — pending items contribute
    // no row, no title, no filename.
    expect(node.querySelectorAll('[data-test="supplied-file-row"]').length).toBe(FIXTURE.files.length);
  });

  it('the rendered DOM carries no raw-path marker', () => {
    const node = renderSuppliedFiles(FIXTURE, q);
    expect(node.outerHTML).not.toMatch(/\/Users\/|\/home\/|Obsidian Vault|\.sha256/);
  });
});

describe('GOV-2033 design-fixture honest-null title parity', () => {
  // The authoritative `supplied_file_dto/v1` structurally emits `title: null` (no
  // reviewer-title column exists). This design fixture is reachable only in
  // explicit design-preview mode, so a hand-authored non-null title would show a
  // richer heading than the live DTO ever renders. Pin the parity: every fixture
  // file carries an honest-`null` title and renders the honest-unavailable
  // heading, never a synthetic card title. Re-populating a title fails loud here.
  it('every design-fixture file has an honest-null title', () => {
    expect(FIXTURE.files.length).toBeGreaterThan(0);
    for (const f of FIXTURE.files) {
      expect(f.title).toBeNull();
    }
  });

  it('each renders the honest "Reviewed source file" heading, never a synthetic title', () => {
    for (const f of FIXTURE.files) {
      expect(suppliedFileHeading(f)).toBe('Reviewed source file');
    }
  });
});
