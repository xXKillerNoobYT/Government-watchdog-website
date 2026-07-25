// @vitest-environment jsdom
//
// GOV-1571 (GOV-1566 F3) — before/after supersede view, consuming the B6
// web-safe projection ONLY (built from a B5 supersede mark). Proves the
// fail-closed contract:
//
//   - a supersede pairs a `before` (previously-shown, already web-safe) with an
//     `after` that is present ONLY when the new version is itself web_safe;
//     while re-review is in flight `after` is null and its content is NOT shown,
//   - the reprocessing signal is a bare count + coarse lane — never a record's
//     text, a filename, an uploader, or a `review_state`,
//   - the coarse reprocessing lane is NOT the raw `review_state` (denylisted) —
//     a projection carrying `review_state` trips assertWebSafe,
//   - events tie to the correct meeting / agenda item via the `before` file,
//   - the whole projection passes assertWebSafe (fail-loud on a planted path),
//   - the shipped contract fixture renders in the vault before/after view.
import { describe, it, expect } from 'vitest';
import {
  supersedeEventsForItem,
  reprocessingNotice,
  reprocessingStatusLabel,
  supersedeFlagLabel,
  supersedeSideRows,
  hasClearedAfter,
} from '../src/ui/supersede-view';
import { renderSupersedeView } from '../src/ui/pages-program';
import { assertWebSafe, RawPathLeak, RAW_PATH_FORBIDDEN_KEYS } from '../src/data/web-safe';
import type {
  SupersedeEvent,
  SupersedeProjection,
  SuppliedSourceFile,
} from '../src/types/read-api';
import supersedeData from '../src/fixtures/alpine-supersede-events.json';

const FIXTURE = supersedeData as unknown as SupersedeProjection;

function file(p: Partial<SuppliedSourceFile> & { file_id: string; title: string }): SuppliedSourceFile {
  return { ...p };
}

function event(p: Partial<SupersedeEvent> & { supersede_id: string; before: SuppliedSourceFile }): SupersedeEvent {
  return { version_group_id: 'vg', ...p };
}

function projection(events: SupersedeEvent[]): SupersedeProjection {
  return { access: 'reviewer_internal', events };
}

describe('GOV-1571 supersede tie (meeting / agenda item, via before file)', () => {
  const a = event({
    supersede_id: 's1',
    before: file({ file_id: 'b1', title: 'Packet v1', meeting_id: 148, agenda_item_id: 'ai_148_03' }),
  });
  const b = event({
    supersede_id: 's2',
    before: file({ file_id: 'b2', title: 'Minutes v1', meeting_id: 148, agenda_item_id: null }),
  });
  const c = event({
    supersede_id: 's3',
    before: file({ file_id: 'b3', title: 'Other v1', meeting_id: 200, agenda_item_id: 'ai_200_01' }),
  });
  const proj = projection([a, b, c]);

  it('agenda-item tie is tightest and wins over meeting', () => {
    expect(supersedeEventsForItem(proj, { agendaItemId: 'ai_148_03', meetingId: 148 })).toEqual([a]);
  });

  it('falls back to the meeting tie when no agenda item is given', () => {
    expect(supersedeEventsForItem(proj, { meetingId: 148 })).toEqual([a, b]);
  });

  it('matches a meeting id across number/string forms', () => {
    expect(supersedeEventsForItem(proj, { meetingId: '148' })).toEqual([a, b]);
  });

  it('fails closed: no tie context ⇒ no events (never dumps everything)', () => {
    expect(supersedeEventsForItem(proj, {})).toEqual([]);
    expect(supersedeEventsForItem(proj, { meetingId: '', agendaItemId: '' })).toEqual([]);
  });
});

describe('GOV-1571 after-side is fail-closed', () => {
  it('hasClearedAfter is true only when a web-safe after file is present', () => {
    const cleared = event({ supersede_id: 's', before: file({ file_id: 'b', title: 'B' }), after: file({ file_id: 'a', title: 'A' }) });
    const inReview = event({ supersede_id: 's', before: file({ file_id: 'b', title: 'B' }), after: null });
    expect(hasClearedAfter(cleared)).toBe(true);
    expect(hasClearedAfter(inReview)).toBe(false);
  });
});

describe('GOV-1571 reprocessing notice is content-free', () => {
  const before = file({ file_id: 'b', title: 'B' });

  it('shows a bare count + coarse lane, nothing else', () => {
    const e = event({ supersede_id: 's', before, reprocessing_status: 'reviewing', reprocessing_record_count: 2 });
    expect(reprocessingNotice(e)).toBe(
      'Records being re-reviewed — 2 records being re-reviewed; not re-shown as verified until review completes.',
    );
  });

  it('uses past tense for a completed re-review (no self-contradiction)', () => {
    const e = event({ supersede_id: 's', before, reprocessing_status: 'complete', reprocessing_record_count: 3 });
    expect(reprocessingNotice(e)).toBe('Re-review complete — 3 records re-reviewed.');
  });

  it('reports just the lane when the count is missing/zero', () => {
    const e = event({ supersede_id: 's', before, reprocessing_status: 'queued' });
    expect(reprocessingNotice(e)).toBe('Re-review queued.');
  });

  it('is absent when there is neither a count nor a status', () => {
    expect(reprocessingNotice(event({ supersede_id: 's', before }))).toBeUndefined();
  });

  it('maps every coarse lane to an honest label (never the raw review_state)', () => {
    expect(reprocessingStatusLabel('queued')).toBe('Re-review queued');
    expect(reprocessingStatusLabel('reviewing')).toBe('Records being re-reviewed');
    expect(reprocessingStatusLabel('complete')).toBe('Re-review complete');
    expect(reprocessingStatusLabel(undefined)).toBe('Reprocessing status unavailable');
  });
});

describe('GOV-1571 red-flag label', () => {
  const before = file({ file_id: 'b', title: 'B' });

  it('is undefined when the event is not flagged', () => {
    expect(supersedeFlagLabel(event({ supersede_id: 's', before }))).toBeUndefined();
  });

  it('humanizes a coarse reason and never emits prose detail', () => {
    const e = event({ supersede_id: 's', before, flagged: true, flag_reason: 'content_changed' });
    expect(supersedeFlagLabel(e)).toBe('Superseded — previously-shown information changed (content changed).');
  });

  it('falls back to a generic flag when no reason is supplied', () => {
    const e = event({ supersede_id: 's', before, flagged: true });
    expect(supersedeFlagLabel(e)).toBe('Superseded — previously-shown information changed.');
  });
});

describe('GOV-1571 web-safe boundary', () => {
  it('the raw review_state key is denylisted (never crosses the wire)', () => {
    expect(RAW_PATH_FORBIDDEN_KEYS as readonly string[]).toContain('review_state');
    const leaky = { access: 'reviewer_internal', events: [{ supersede_id: 's', version_group_id: 'vg', before: { file_id: 'b', title: 'B', review_state: 'reviewing' } }] };
    expect(() => assertWebSafe(leaky)).toThrow(RawPathLeak);
  });

  it('the shipped contract fixture passes assertWebSafe', () => {
    expect(() => assertWebSafe(FIXTURE)).not.toThrow();
  });

  it('a planted raw/vault path in a before/after file fails loud', () => {
    const leaky = projection([event({ supersede_id: 's', before: file({ file_id: 'b', title: 'B', original_url: '/Users/isaac/vault/b.pdf' } as SuppliedSourceFile) })]);
    expect(() => assertWebSafe(leaky)).toThrow(RawPathLeak);
  });

  it('side rows never include a raw-path field', () => {
    const rows = supersedeSideRows(FIXTURE.events[0].before);
    for (const row of rows) {
      expect(RAW_PATH_FORBIDDEN_KEYS as readonly string[]).not.toContain(row.key);
      expect(row.value).not.toMatch(/^\/(Users|home|var|tmp|private|Volumes)\//);
    }
  });
});

describe('GOV-1571 render (before/after view)', () => {
  const q = new URLSearchParams();

  it('renders honest empty panel when B6 is not wired (no projection)', () => {
    const node = renderSupersedeView(undefined, q);
    expect(node.getAttribute('data-state')).toBe('empty');
    expect(node.querySelector('[data-test="supersede-row"]')).toBeNull();
    expect(node.textContent).toContain('not wired yet');
  });

  it('renders a red-flag before/after card with reprocessing status', () => {
    const node = renderSupersedeView(FIXTURE, q);
    const rows = node.querySelectorAll('[data-test="supersede-row"]');
    expect(rows.length).toBe(FIXTURE.events.length);
    // First event is cleared: both panes carry a file title + link.
    const first = rows[0];
    expect(first.getAttribute('data-flagged')).toBe('true');
    expect(first.querySelector('[data-test="supersede-flag"]')?.textContent).toContain('previously-shown information changed');
    expect(first.querySelector('[data-test="supersede-before-link"]')?.getAttribute('href')).toMatch(/^https:\/\//);
    expect(first.querySelector('[data-test="supersede-after-link"]')?.getAttribute('href')).toMatch(/^https:\/\//);
    expect(first.querySelector('[data-test="supersede-reprocessing"]')?.textContent).toContain('re-reviewed');
  });

  it('holds the after pane when the new version is still in re-review (no content)', () => {
    const node = renderSupersedeView(FIXTURE, q);
    // Second fixture event has after:null (reviewing) — its pane shows the hold
    // note and NO after link/title of an unreviewed file.
    const inReviewAfter = node.querySelectorAll('[data-test="supersede-after"]')[1];
    expect(inReviewAfter.getAttribute('data-state')).toBe('pending');
    expect(inReviewAfter.querySelector('[data-test="supersede-after-link"]')).toBeNull();
    expect(inReviewAfter.textContent).toContain('not shown until re-review completes');
  });

  it('the rendered DOM carries no raw-path marker', () => {
    const node = renderSupersedeView(FIXTURE, q);
    expect(node.outerHTML).not.toMatch(/\/Users\/|\/home\/|Obsidian Vault|\.sha256/);
  });
});
