import { FIXTURE } from './sample-fixture';
// @vitest-environment jsdom
//
// GOV-301 (Stage 2 frontend surface) — render the completeness-gap card (~90
// `no_primary_source` Alpine meetings) on the reviewer-internal timeline.
//
// Covers the GOV-298 read-time gap contract end to end:
//   - pure `buildGapSummary` projection (counts, grouping, scope guard, never-hide),
//   - the rendered card (headline count, per-type breakdown, per-meeting list),
//   - the REAL fixture contract (92 no_primary_source / 224 total, web-safe),
//   - VERBATIM consumption — severity / resolved_status are never recomputed.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildGapSummary,
  gapTypeLabel,
  type GapSummaryView,
} from '../src/ui/timeline';
import { render } from '../src/ui/render';
import { resolved } from '../src/state/async-state';
import { isEmptyResponse } from '../src/data/client';
import { assertWebSafe } from '../src/data/web-safe';
import type { ReadApiResponse, CompletenessGapCard } from '../src/types/read-api';

function gap(partial: Partial<CompletenessGapCard> & { gap_id: string }): CompletenessGapCard {
  return {
    subject_id: 'subj',
    subject_node_type: 'meeting',
    gap_type: 'no_primary_source',
    severity: 'warn',
    resolved_status: 'open',
    ...partial,
  };
}

function resp(cards: CompletenessGapCard[] | undefined, scope = 'alpine'): ReadApiResponse {
  return { scope, access: 'reviewer_internal', records: [], completeness_gaps: cards };
}

describe('GOV-301 buildGapSummary — pure projection', () => {
  it('returns null when no gaps are served (nothing to surface)', () => {
    expect(buildGapSummary(resp(undefined))).toBeNull();
    expect(buildGapSummary(resp([]))).toBeNull();
  });

  it('drops the whole gap surface for a non-Alpine response (scope guard)', () => {
    const cards = [gap({ gap_id: 'g1' })];
    expect(buildGapSummary(resp(cards, 'teton'))).toBeNull();
  });

  it('counts every served row and never hides one (countability invariant)', () => {
    const cards = [
      gap({ gap_id: 'n1', gap_type: 'no_primary_source', subject_id: '2023-04-26' }),
      gap({ gap_id: 'n2', gap_type: 'no_primary_source', subject_id: '2024-02-06' }),
      gap({ gap_id: 'p1', gap_type: 'pdf_text_unextracted', subject_id: 'doc-1', severity: 'info' }),
    ];
    const view = buildGapSummary(resp(cards)) as GapSummaryView;
    expect(view.total).toBe(3);
    expect(view.noPrimarySourceCount).toBe(2);
    expect(view.noPrimarySource.map((c) => c.subject_id)).toEqual(['2023-04-26', '2024-02-06']);
  });

  it('groups by gap_type, ordered by descending count then gap_type', () => {
    const cards = [
      gap({ gap_id: 'a', gap_type: 'missing_transcript' }),
      gap({ gap_id: 'b', gap_type: 'no_primary_source' }),
      gap({ gap_id: 'c', gap_type: 'no_primary_source' }),
      gap({ gap_id: 'd', gap_type: 'pdf_text_unextracted' }),
      gap({ gap_id: 'e', gap_type: 'pdf_text_unextracted' }),
    ];
    const view = buildGapSummary(resp(cards)) as GapSummaryView;
    // no_primary_source (2) and pdf_text_unextracted (2) tie -> alpha; then missing_transcript (1).
    expect(view.groups.map((g) => `${g.gapType}:${g.count}`)).toEqual([
      'no_primary_source:2',
      'pdf_text_unextracted:2',
      'missing_transcript:1',
    ]);
  });

  it('labels an off-SSOT / unknown gap_type without dropping it (fail-closed)', () => {
    expect(gapTypeLabel('unknown')).toBe('unknown (off-SSOT)');
    expect(gapTypeLabel('some_future_kind')).toBe('some future kind');
    const view = buildGapSummary(resp([gap({ gap_id: 'x', gap_type: 'unknown' })])) as GapSummaryView;
    expect(view.total).toBe(1);
    expect(view.groups[0].label).toBe('unknown (off-SSOT)');
  });
});

describe('GOV-301 gap card — render', () => {
  let root: HTMLElement;
  beforeEach(() => {
    document.head.replaceChildren();
    document.body.replaceChildren();
    root = document.createElement('div');
    document.body.append(root);
  });

  function ready(data: ReadApiResponse): void {
    render(root, resolved(data, 'fixture', isEmptyResponse));
  }

  it('renders the headline no_primary_source count + total + per-type breakdown', () => {
    const cards = [
      gap({ gap_id: 'n1', gap_type: 'no_primary_source', subject_id: '2023-04-26', detail: 'no source-of-record primary document' }),
      gap({ gap_id: 'n2', gap_type: 'no_primary_source', subject_id: '2024-02-06' }),
      gap({ gap_id: 'p1', gap_type: 'pdf_text_unextracted', subject_id: 'doc-1', severity: 'info' }),
    ];
    ready(resp(cards));
    const card = root.querySelector('[data-test="completeness-gap-card"]');
    expect(card).not.toBeNull();
    expect(root.querySelector('[data-test="gap-no-primary-source-count"]')?.textContent).toBe('2');
    expect(card?.getAttribute('data-no-primary-source-count')).toBe('2');
    expect(card?.getAttribute('data-total-gaps')).toBe('3');
    expect(root.querySelector('[data-test="gap-count-no_primary_source"]')?.textContent).toBe('2');
    expect(root.querySelector('[data-test="gap-count-pdf_text_unextracted"]')?.textContent).toBe('1');
  });

  it('lists each no_primary_source meeting with VERBATIM severity + status (never recomputed)', () => {
    const cards = [
      gap({ gap_id: 'n1', subject_id: '2023-04-26', severity: 'warn', resolved_status: 'open', detail: 'only derived material' }),
      gap({ gap_id: 'n2', subject_id: '2024-02-06', severity: 'blocking', resolved_status: 'acknowledged' }),
    ];
    ready(resp(cards));
    const meetings = [...root.querySelectorAll('[data-test="gap-meeting"]')];
    expect(meetings.length).toBe(2);
    expect(meetings.map((m) => m.getAttribute('data-subject'))).toEqual(['2023-04-26', '2024-02-06']);
    const sevs = [...root.querySelectorAll('[data-test="gap-severity"]')].map((n) => n.textContent);
    expect(sevs).toEqual(['warn', 'blocking']); // exact backend values, not re-derived
    const statuses = [...root.querySelectorAll('[data-test="gap-status"]')].map((n) => n.textContent);
    expect(statuses).toEqual(['open', 'acknowledged']);
    expect(root.querySelector('[data-test="gap-detail"]')?.textContent).toBe('only derived material');
  });

  it('keeps a detailed row for every supplied gap type instead of reducing non-primary gaps to totals', () => {
    ready(resp([
      gap({ gap_id: 'n1', subject_id: '2023-04-26' }),
      gap({ gap_id: 'p1', subject_id: 'packet-1', gap_type: 'pdf_text_unextracted' }),
      gap({ gap_id: 'v1', subject_id: 'video-1', gap_type: 'video_unavailable' }),
    ]));

    const rows = [...root.querySelectorAll<HTMLElement>('[data-gap-detail-row]')];
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.dataset.gapType)).toEqual([
      'no_primary_source',
      'pdf_text_unextracted',
      'video_unavailable',
    ]);
  });

  it('omits the gap detail row when the backend omitted it (no fabrication)', () => {
    ready(resp([gap({ gap_id: 'n1', subject_id: '2023-04-26', detail: undefined })]));
    expect(root.querySelector('[data-test="gap-meeting"]')).not.toBeNull();
    expect(root.querySelector('[data-test="gap-detail"]')).toBeNull();
  });

  it('does not render the gap card when no gaps are served', () => {
    ready(resp([]));
    expect(root.querySelector('[data-test="completeness-gap-card"]')).toBeNull();
  });

  it('keeps the gap card distinct from the thread completeness surface (no data-test collision)', () => {
    ready(resp([gap({ gap_id: 'n1', subject_id: '2023-04-26' })]));
    // The thread surface owns [data-test="completeness-gaps"]; the gap card must NOT reuse it.
    expect(root.querySelector('[data-test="completeness-gaps"]')).toBeNull();
    expect(root.querySelector('[data-test="completeness-gap-card"]')).not.toBeNull();
  });
});

describe('GOV-301 real fixture contract (alpine-sample.json)', () => {
  it('carries the real captured gap cards: 92 no_primary_source / 224 total', () => {
    const cards = FIXTURE.completeness_gaps ?? [];
    expect(cards.length).toBe(224);
    expect(cards.filter((c) => c.gap_type === 'no_primary_source').length).toBe(92);
  });

  it('every gap card is a subset of the web-safe GAP_CARD_FIELDS (no internal columns)', () => {
    const allowed = new Set(['gap_id', 'subject_id', 'subject_node_type', 'gap_type', 'severity', 'resolved_status', 'detail']);
    const forbidden = ['source_id', 'detected_run_id', 'detected_utc'];
    for (const c of FIXTURE.completeness_gaps ?? []) {
      for (const k of Object.keys(c)) expect(allowed.has(k)).toBe(true);
      for (const f of forbidden) expect(f in c).toBe(false);
    }
  });

  it('the gap-card body is web-safe (passes the raw-path sweep)', () => {
    // FIXTURE already passed assertWebSafe at module load; re-assert the gap slice
    // explicitly so a future hand edit that paints a vault path fails this test.
    expect(() => assertWebSafe(FIXTURE.completeness_gaps)).not.toThrow();
  });

  it('renders the ~90 headline count from the real fixture', () => {
    const view = buildGapSummary(FIXTURE) as GapSummaryView;
    expect(view.noPrimarySourceCount).toBe(92);
    expect(view.total).toBe(224);
  });
});
