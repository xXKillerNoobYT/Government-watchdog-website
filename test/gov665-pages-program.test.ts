import { FIXTURE } from './sample-fixture';
// @vitest-environment jsdom
//
// GOV-665 — Wave 2 pages program: Fast Agenda, timeline levels/filters, and
// Boards directory/detail. These tests pin the public-lane 0-leak invariant, the
// shared `gw_home_mode` Simple/Advanced switch, and the no-score body detail rule.
import { readMode } from '../src/ui/shell';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderBoardsDirectory, renderFastAgenda, renderTimelineLevels } from '../src/ui/pages-program';

import type { AgendaBoard } from '../src/types/agenda-board';
import type { ReadApiResponse } from '../src/types/read-api';
import boardSampleData from '../src/fixtures/agenda-board-projection.sample.dev.json';
import boardRealData from '../src/fixtures/agenda-board-projection.json';
import graphRealData from '../src/fixtures/concept-graph-real.json';

const SAMPLE_BOARD = boardSampleData as unknown as AgendaBoard;
const REAL_BOARD = boardRealData as unknown as AgendaBoard;
const GRAPH_REAL = graphRealData as unknown as ReadApiResponse;

let root: HTMLElement;
let store: Record<string, string>;
beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
  store = {};
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      clear: () => { store = {}; },
    },
  });
  root = document.createElement('div');
  document.body.append(root);
});

function expectRouteInfoNotes(required: readonly string[]): void {
  const triggers = [...root.querySelectorAll<HTMLButtonElement>('[data-info-note]')];
  const ids = triggers.map((node) => node.dataset.infoNote!);
  const labels = triggers.map((node) => node.getAttribute('aria-label'));
  const panelIds = triggers.map((node) => node.getAttribute('aria-controls'));

  expect([...ids].sort()).toEqual([...required].sort());
  expect(new Set(labels).size).toBe(labels.length);
  expect(new Set(panelIds).size).toBe(panelIds.length);
  for (const panelId of panelIds) {
    expect(panelId).toBeTruthy();
    const panel = root.querySelector<HTMLElement>(`#${panelId}`);
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain('What this is');
    expect(panel?.textContent).toContain('Filled from');
    expect(panel?.textContent).toContain('Filed under');
    expect(panel?.textContent).toContain('Current state');
    expect(panel?.textContent).toContain('Expected result');
  }
}

describe('GOV-665 Fast Agenda page', () => {
  it('renders the honest empty next-meeting hero from the real projection', () => {
    renderFastAgenda(root, REAL_BOARD, 'real');
    expect(root.querySelector('[data-test="fast-agenda-empty"]')?.textContent).toContain('No next agenda item is review-ready yet');
    expect(root.querySelector('[data-test="fast-agenda-card"]')).toBeNull();
    expect(root.querySelector('[data-test="fixture-banner"]')).toBeNull();
    expect(root.querySelector('[data-test="source-notice"]')?.textContent).toContain('real');
  });

  it('shows the sample banner only for explicit demo/sample fixture routes', () => {
    renderFastAgenda(root, SAMPLE_BOARD, 'sample', true);
    expect(root.querySelector('[data-test="fixture-banner"]')?.textContent).toContain('OFFLINE SAMPLE');
  });

  it('uses the shell-owned shared mode preference without rendering a duplicate page switch', () => {
    renderFastAgenda(root, SAMPLE_BOARD, 'sample');
    expect(readMode()).toBe('simple');
    expect(root.querySelectorAll('[data-test="fast-agenda-card"]')).toHaveLength(1);
    expect(root.querySelector('[data-test="mode-toggle"]')).toBeNull();

    localStorage.setItem('gw_home_mode', 'advanced');
    renderFastAgenda(root, SAMPLE_BOARD, 'sample');
    expect(root.querySelectorAll('[data-test="fast-agenda-card"]')).toHaveLength(SAMPLE_BOARD.cardCount);
    expect(root.querySelector('[data-test="mode-toggle"]')).toBeNull();
  });

  it('keeps complete contextual note coverage in both reading modes', () => {
    const required = [
      'agenda-overview',
      'agenda-meeting',
      'agenda-lifecycle',
      'agenda-filters',
      'agenda-sources',
      'agenda-gaps',
    ];
    for (const mode of ['simple', 'advanced'] as const) {
      localStorage.setItem('gw_home_mode', mode);
      renderFastAgenda(root, SAMPLE_BOARD, 'sample', true);
      expectRouteInfoNotes(required);
    }
  });

  it('does not let Advanced mode override an explicit light theme choice', () => {
    localStorage.setItem('gw_home_mode', 'advanced');
    localStorage.setItem('gw-theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
    renderFastAgenda(root, SAMPLE_BOARD, 'sample');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('renders zero agenda card content for a public-lane projection', () => {
    renderFastAgenda(root, { ...SAMPLE_BOARD, access: 'public' }, 'sample');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="fast-agenda-card"]')).toBeNull();
    expect(root.querySelector('[data-test="source-notice"]')).toBeNull();
    expect(root.querySelector('[data-test="fixture-banner"]')).toBeNull();
    expect(root.querySelector('[data-info-note]')).toBeNull();
    expect(root.textContent).not.toContain('Meeting and item identity');
  });
});

describe('GOV-665 Timeline levels and event filters', () => {
  it('renders advanced three-lane style buckets for reviewed ordering receipts', () => {
    localStorage.setItem('gw_home_mode', 'advanced');
    renderTimelineLevels(root, GRAPH_REAL, new URLSearchParams('level=day&type=ordering'), 'real');
    expect(root.querySelector('[data-test="timeline-filters"]')?.textContent).toContain('Level: day');
    expect(root.querySelector('[data-test="timeline-filters"]')?.textContent).toContain('Type: ordering');
    expect(root.querySelector('[data-test="timeline-advanced-lanes"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="record-card"]')).toHaveLength(GRAPH_REAL.records!.length);
    expect(root.querySelector('[data-test="timeline-hybrid-intro"]')?.textContent).toContain('fail-closed record cards');
    expect(root.querySelector('[data-test="timeline-filter-form"]')).not.toBeNull();
    expect(root.textContent).toContain('does not assign them to Town, County, or State government');
    expect(root.querySelector('[data-test="timeline-map"]')?.getAttribute('data-mode')).toBe('advanced');
    const receiptCount = [...root.querySelectorAll<HTMLElement>('[data-test="timeline-map-event"]')]
      .reduce((sum, marker) => sum + Number(marker.dataset.recordCount), 0);
    expect(receiptCount).toBe(GRAPH_REAL.records!.length);
    expect(root.querySelectorAll('[data-test="trust-badge"]')).toHaveLength(GRAPH_REAL.records!.length);
    expect(root.querySelector('[data-test="source-drawer"]')).not.toBeNull();
    expect(root.querySelector('[data-test="timeline-county-gap"]')?.textContent).toContain('No reviewed county date records');
    expect(root.querySelector('[data-test="timeline-state-gap"]')?.textContent).toContain('No reviewed state date records');
    expect(root.querySelector('[data-test="timeline-connector-gap"]')?.textContent).toContain('typed cross-record issue edges');
    expect(root.querySelector('[data-test="timeline-tools-unavailable"]')?.textContent).toContain('typed backend fields');
    expect(root.querySelector('[data-test="timeline-map"]')?.textContent).toContain('ordering date, not a typed civic event date');
  });

  it('keeps control, calculation, record, and gap notes in both Timeline modes', () => {
    const required = [
      'timeline-overview',
      'timeline-filters',
      'timeline-date-basis',
      'timeline-map',
      'timeline-records',
      'timeline-gaps',
    ];
    for (const mode of ['simple', 'advanced'] as const) {
      localStorage.setItem('gw_home_mode', mode);
      renderTimelineLevels(root, GRAPH_REAL, new URLSearchParams(), 'real');
      expectRouteInfoNotes(required);
      const methodTrigger = root.querySelector<HTMLButtonElement>(
        '[data-info-note="timeline-date-basis"]',
      )!;
      const methodPanel = root.querySelector<HTMLElement>(
        `#${methodTrigger.getAttribute('aria-controls')}`,
      );
      expect(methodPanel?.textContent).toContain('TIMELINE-ORDER/v1');
      expect(methodPanel?.textContent).toContain('Missing data');
      expect(methodPanel?.textContent).toContain('remains Undated');
    }
  });

  it('keeps map-marker navigation on the Timeline route and focuses the reviewed card', () => {
    window.location.hash = '#/timeline?reviewer=1';
    renderTimelineLevels(root, GRAPH_REAL, new URLSearchParams(), 'real');
    const marker = root.querySelector<HTMLButtonElement>('[data-test="timeline-map-event"]')!;
    const targetId = marker.dataset.targetId!;

    marker.click();

    expect(window.location.hash).toBe('#/timeline?reviewer=1');
    expect(document.activeElement?.id).toBe(targetId);
  });

  it('orders map markers oldest-to-newest to match the left-to-right date axis', () => {
    const base = GRAPH_REAL.records![0];
    const source = base.evidence[0]!;
    const dated: ReadApiResponse = {
      ...GRAPH_REAL,
      records: [
        { ...base, statement_id: 'newer', agenda_item_id: null, evidence: [{ ...source, source_date: '2026-07-20', scan_date: null, last_validated_utc: null }] },
        { ...base, statement_id: 'older', agenda_item_id: null, evidence: [{ ...source, source_date: '2025-01-03', scan_date: null, last_validated_utc: null }] },
      ],
    };

    renderTimelineLevels(root, dated, new URLSearchParams(), 'real');

    expect([...root.querySelectorAll<HTMLElement>('[data-test="timeline-map-event"]')].map((node) => node.dataset.date))
      .toEqual(['2025-01-03', '2026-07-20']);
  });

  it('positions supplied dates proportionally instead of using equal-width event cards', () => {
    const base = GRAPH_REAL.records![0];
    const source = base.evidence[0]!;
    const dated: ReadApiResponse = {
      ...GRAPH_REAL,
      records: [
        { ...base, statement_id: 'start', agenda_item_id: null, evidence: [{ ...source, source_date: '2026-01-01', scan_date: null, last_validated_utc: null }] },
        { ...base, statement_id: 'middle', agenda_item_id: null, evidence: [{ ...source, source_date: '2026-01-06', scan_date: null, last_validated_utc: null }] },
        { ...base, statement_id: 'end', agenda_item_id: null, evidence: [{ ...source, source_date: '2026-01-11', scan_date: null, last_validated_utc: null }] },
      ],
    };

    renderTimelineLevels(root, dated, new URLSearchParams(), 'real');

    const markers = [...root.querySelectorAll<HTMLElement>('[data-test="timeline-map-event"]')];
    expect(markers.map((node) => Number(node.dataset.position))).toEqual([0, 50, 100]);
    expect(markers[1].parentElement?.getAttribute('style')).toContain('--gw-timeline-position:50%');
  });

  it('allocates as many map rows as dense dates require instead of recycling a fixed four-row pattern', () => {
    const base = GRAPH_REAL.records![0];
    const source = base.evidence[0]!;
    const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-12-31'];
    const dated: ReadApiResponse = {
      ...GRAPH_REAL,
      records: dates.map((date, index) => ({
        ...base,
        statement_id: `dense-${index}`,
        agenda_item_id: null,
        evidence: [{ ...source, source_date: date, scan_date: null, last_validated_utc: null }],
      })),
    };

    renderTimelineLevels(root, dated, new URLSearchParams(), 'real');

    const markers = [...root.querySelectorAll<HTMLElement>('[data-test="timeline-map-event"]')];
    const coordinates = markers.map((marker) => ({
      position: Number(marker.dataset.position),
      row: Number(marker.parentElement?.getAttribute('style')?.match(/--gw-timeline-row:(\d+)/)?.[1]),
    }));
    for (let left = 0; left < coordinates.length; left += 1) {
      for (let right = left + 1; right < coordinates.length; right += 1) {
        if (Math.abs(coordinates[left].position - coordinates[right].position) < 42) {
          expect(coordinates[left].row).not.toBe(coordinates[right].row);
        }
      }
    }
    expect(root.querySelector('[data-test="timeline-map-record-events"]')?.getAttribute('style'))
      .toMatch(/--gw-timeline-rows:[5-9]/);
  });

  it('reports reviewed rows and source receipts as separate map quantities', () => {
    const base = GRAPH_REAL.records![0];
    const source = base.evidence[0]!;
    const dated: ReadApiResponse = {
      ...GRAPH_REAL,
      records: [
        {
          ...base,
          statement_id: 'same-date-with-receipts',
          agenda_item_id: 'alpine:2026-01-02:item-1',
          evidence: [
            { ...source, source_date: '2026-01-02', scan_date: null, last_validated_utc: null },
            { ...source, to_source_id: `${source.to_source_id ?? 'source'}-second`, source_date: '2026-01-02', scan_date: null, last_validated_utc: null },
          ],
        },
        {
          ...base,
          statement_id: 'same-date-without-receipts',
          agenda_item_id: 'alpine:2026-01-02:item-2',
          evidence: [],
        },
      ],
    };

    renderTimelineLevels(root, dated, new URLSearchParams(), 'real');

    const marker = root.querySelector<HTMLElement>('[data-test="timeline-map-event"]');
    expect(marker?.dataset.recordCount).toBe('2');
    expect(marker?.dataset.receiptCount).toBe('2');
    expect(marker?.querySelector('[data-test="timeline-map-receipt-count"]')?.textContent)
      .toBe('2 reviewed rows · 2 source receipts');
  });

  it('labels an evidence-date field tie without choosing an unsupported exact basis', () => {
    const base = GRAPH_REAL.records![0];
    const source = base.evidence[0]!;
    const dated: ReadApiResponse = {
      ...GRAPH_REAL,
      records: [{
        ...base,
        statement_id: 'evidence-date-field-tie',
        agenda_item_id: null,
        evidence: [{
          ...source,
          source_date: '2026-01-02',
          scan_date: '2026-01-02',
          last_validated_utc: '2026-01-02T09:00:00Z',
        }],
      }],
    };

    renderTimelineLevels(root, dated, new URLSearchParams(), 'real');

    const marker = root.querySelector<HTMLElement>('[data-test="timeline-map-event"]');
    expect(marker?.dataset.dateBasis).toBe('evidence-date');
    expect(marker?.dataset.isEventDate).toBe('false');
    expect(marker?.textContent).toContain('Evidence ordering date · multiple fields match');
  });

  it('keeps 320px Timeline markers on separate rows when their cards would overlap', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    const base = GRAPH_REAL.records![0];
    const source = base.evidence[0]!;
    const dates = ['2026-01-01', '2026-02-15', '2026-04-11'];
    const dated: ReadApiResponse = {
      ...GRAPH_REAL,
      records: dates.map((date, index) => ({
        ...base,
        statement_id: `mobile-${index}`,
        agenda_item_id: null,
        evidence: [{ ...source, source_date: date, scan_date: null, last_validated_utc: null }],
      })),
    };

    renderTimelineLevels(root, dated, new URLSearchParams(), 'real');

    const markers = [...root.querySelectorAll<HTMLElement>('[data-test="timeline-map-event"]')];
    expect(markers.map((marker) => Number(marker.dataset.position))).toEqual([0, 45, 100]);
    expect(markers[0].parentElement?.getAttribute('style')).toContain('--gw-timeline-row:0');
    expect(markers[1].parentElement?.getAttribute('style')).toContain('--gw-timeline-row:1');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  });

  it('labels every available date as ordering-only until the backend supplies typed civic event semantics', () => {
    const base = GRAPH_REAL.records![0];
    const source = base.evidence[0]!;
    const dated: ReadApiResponse = {
      ...GRAPH_REAL,
      records: [
        { ...base, statement_id: 'agenda-event', agenda_item_id: 'alpine:2026-01-01:item-1', evidence: [] },
        { ...base, statement_id: 'publication', agenda_item_id: null, evidence: [{ ...source, source_date: '2026-01-02', scan_date: null, last_validated_utc: null }] },
        { ...base, statement_id: 'capture', agenda_item_id: null, evidence: [{ ...source, source_date: null, scan_date: '2026-01-03', last_validated_utc: null }] },
        { ...base, statement_id: 'validation', agenda_item_id: null, evidence: [{ ...source, source_date: null, scan_date: null, last_validated_utc: '2026-01-04T09:00:00Z' }] },
      ],
    };

    renderTimelineLevels(root, dated, new URLSearchParams(), 'real');

    const basis = [...root.querySelectorAll<HTMLElement>('[data-test="timeline-map-event"]')]
      .map((node) => [node.dataset.dateBasis, node.dataset.isEventDate]);
    expect(basis).toEqual([
      ['agenda-reference', 'false'],
      ['source-date', 'false'],
      ['capture', 'false'],
      ['validation', 'false'],
    ]);
    expect(root.querySelector('[data-test="timeline-date-disclosure"]')?.textContent)
      .toContain('Every plotted value is an ordering date');
  });

  it('keeps all level, event-type, event-window, and sort slots visible without inventing support', () => {
    renderTimelineLevels(root, GRAPH_REAL, new URLSearchParams(), 'real');

    const unavailableTown = root.querySelector<HTMLButtonElement>(
      '[data-test="timeline-level-town-unavailable"]',
    );
    expect(unavailableTown?.disabled).toBe(true);
    expect(unavailableTown?.textContent).toContain('Town · unavailable');
    expect(root.querySelector<HTMLButtonElement>('[data-test="timeline-level-county-unavailable"]')?.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-test="timeline-level-state-unavailable"]')?.disabled).toBe(true);
    expect(root.querySelector('[data-test="timeline-map-unscoped"]')).not.toBeNull();
    expect(root.textContent).not.toContain('Town supplied');
    expect(root.textContent).not.toContain('TOWN · ALPINE');
    for (const testId of [
      'timeline-type-meeting-unavailable',
      'timeline-type-document-unavailable',
      'timeline-type-change-unavailable',
      'timeline-type-deadline-unavailable',
      'timeline-type-vote-unavailable',
      'timeline-window-next-unavailable',
      'timeline-window-90-unavailable',
      'timeline-window-year-unavailable',
      'timeline-window-all-unavailable',
      'timeline-sort-unavailable',
    ]) {
      expect(root.querySelector<HTMLButtonElement>(`[data-test="${testId}"]`)?.disabled).toBe(true);
    }
  });

  it('surfaces all 224 backend completeness-gap rows with identical Simple and Advanced counts', () => {
    const renderedCounts: string[][] = [];
    for (const mode of ['simple', 'advanced'] as const) {
      localStorage.setItem('gw_home_mode', mode);
      renderTimelineLevels(root, FIXTURE, new URLSearchParams(), 'captured');
      expect(root.querySelector('[data-test="mode-toggle"]'), mode).toBeNull();
      const gapCard = root.querySelector('[data-test="completeness-gap-card"]');
      expect(gapCard?.getAttribute('data-total-gaps')).toBe('224');
      expect(gapCard?.getAttribute('data-no-primary-source-count')).toBe('92');
      expect(root.querySelectorAll('[data-test="record-card"]')).toHaveLength(FIXTURE.records!.length);
      expect(root.querySelectorAll('[data-gap-detail-row]')).toHaveLength(224);
      const counts = [...root.querySelectorAll('[data-test="gap-type-breakdown"] .gw-gap-count')]
        .map((node) => node.textContent ?? '');
      expect(counts.reduce((sum, count) => sum + Number(count), 0)).toBe(224);
      renderedCounts.push(counts);
    }
    expect(renderedCounts[0]).toEqual(renderedCounts[1]);
  });

  it('keeps backend completeness gaps separate and visible when a record filter has no matches', () => {
    renderTimelineLevels(root, FIXTURE, new URLSearchParams('type=agenda'), 'captured');
    expect(root.querySelector('[data-test="timeline-empty"]')).not.toBeNull();
    expect(root.querySelector('[data-test="completeness-gap-card"]')?.getAttribute('data-total-gaps')).toBe('224');
  });

  it('never labels reviewed Timeline or Boards data as a sample fixture', () => {
    renderTimelineLevels(root, GRAPH_REAL, new URLSearchParams('demo=sample'), 'real');
    expect(root.querySelector('[data-test="fixture-banner"]')).toBeNull();

    renderBoardsDirectory(root, GRAPH_REAL, new URLSearchParams('demo=sample'), 'real');
    expect(root.querySelector('[data-test="fixture-banner"]')).toBeNull();
    expect(root.querySelector('[data-test="boards-topic-context-card"]')).not.toBeNull();
  });

  it('shows an honest empty state instead of inventing records for unmatched filters', () => {
    renderTimelineLevels(root, GRAPH_REAL, new URLSearchParams('type=agenda'), 'real');
    expect(root.querySelector('[data-test="timeline-empty"]')?.textContent).toContain('No reviewed records match');
    expect(root.querySelector('[data-test="record-card"]')).toBeNull();
  });

  it('applies the shared shell search query to reviewed fields only', () => {
    const needle = GRAPH_REAL.records![0].statement_id;
    renderTimelineLevels(root, GRAPH_REAL, new URLSearchParams(`search=${encodeURIComponent(needle)}`), 'real');
    expect(root.querySelector('[data-test="timeline-search-filter"]')?.textContent).toContain(needle.toLocaleLowerCase());
    expect(root.querySelectorAll('[data-test="record-card"]')).toHaveLength(1);
  });

  it('submits the hybrid filter controls as an encoded timeline route', () => {
    renderTimelineLevels(root, GRAPH_REAL, new URLSearchParams(), 'real');
    const search = root.querySelector<HTMLInputElement>('[data-test="timeline-search-input"]')!;
    const level = root.querySelector<HTMLSelectElement>('[data-test="timeline-level-select"]')!;
    search.value = 'water main';
    level.value = 'day';
    root.querySelector<HTMLFormElement>('[data-test="timeline-filter-form"]')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(window.location.hash).toBe('#/timeline?search=water+main&level=day');
  });

  it('renders zero timeline cards outside reviewer-internal access', () => {
    renderTimelineLevels(root, { ...GRAPH_REAL, access: 'public' }, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="record-card"]')).toBeNull();
    expect(root.querySelector('[data-test="timeline-map"]')).toBeNull();
    expect(root.querySelector('[data-info-note]')).toBeNull();
    expect(root.textContent).not.toContain('Derived ordering metadata');
  });
});

describe('GOV-665 Boards directory and detail', () => {
  it('never relabels reviewed civic topics as government body cards', () => {
    localStorage.setItem('gw_home_mode', 'advanced');
    renderBoardsDirectory(root, GRAPH_REAL, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="mode-toggle"]')).toBeNull();
    expect(root.querySelector('[data-test="boards-advanced-workbench"]')).not.toBeNull();
    expect(root.querySelector('[data-test="boards-directory-note"]')?.textContent).toContain('civic topics, not policy-cleared government body records');
    expect(root.querySelector('[data-test="board-directory-card"]')).toBeNull();
    expect(root.querySelectorAll('[data-test="boards-topic-context-card"]').length).toBeGreaterThan(1);
    expect(root.querySelector('[data-test="boards-bodies-gap"]')).not.toBeNull();
    expect(root.querySelector('[data-test="boards-cadence-gap"]')).not.toBeNull();
    expect(root.querySelector('[data-test="boards-members-gap"]')).not.toBeNull();
    expect(root.querySelector('[data-test="boards-links-gap"]')).not.toBeNull();
  });

  it('keeps directory, topic, and body-detail notes in both Boards modes', () => {
    const required = [
      'boards-overview',
      'boards-directory',
      'boards-topic',
      'boards-body',
    ];
    for (const mode of ['simple', 'advanced'] as const) {
      localStorage.setItem('gw_home_mode', mode);
      renderBoardsDirectory(root, GRAPH_REAL, new URLSearchParams(), 'real');
      expectRouteInfoNotes(required);
    }
  });

  it('rejects a topic id as a body detail while preserving its Timeline path', () => {
    renderBoardsDirectory(root, GRAPH_REAL, new URLSearchParams('id=topic:alpine:budget-taxes'), 'real');
    expect(root.querySelector('[data-test="board-detail"]')).toBeNull();
    expect(root.querySelector('[data-test="boards-topic-not-body"]')?.textContent).toContain('Town budget and taxes is a reviewed civic topic');
    expect(root.querySelector('[data-test="boards-topic-not-body"] a')?.getAttribute('href')).toContain('#/timeline?search=Town%20budget%20and%20taxes');
  });

  it('renders zero directory cards outside reviewer-internal access', () => {
    renderBoardsDirectory(root, { ...GRAPH_REAL, access: 'public' }, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="board-directory-card"]')).toBeNull();
    expect(root.querySelector('[data-test="boards-topic-context-card"]')).toBeNull();
    expect(root.querySelector('[data-test="source-notice"]')).toBeNull();
    expect(root.querySelector('[data-info-note]')).toBeNull();
    expect(root.textContent).not.toContain('Government-level directory');
  });

  it('shows supplied topic aliases as sourced context without relabeling them as boards', () => {
    renderBoardsDirectory(root, GRAPH_REAL, new URLSearchParams(), 'real');
    const suppliedAliasCount = (GRAPH_REAL.topic_tree?.tree.children ?? [])
      .reduce((count, node) => count + node.topic.sourceAliases.length, 0);
    expect(root.querySelectorAll('[data-test="boards-topic-alias"]')).toHaveLength(suppliedAliasCount);
    expect(root.querySelector('[data-test="boards-topic-alias"]')?.textContent).toContain('source alpine_local_corpus');
  });

  it('keeps the full directory contract in the Simple newspaper composition', () => {
    localStorage.setItem('gw_home_mode', 'simple');
    renderBoardsDirectory(root, GRAPH_REAL, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="mode-toggle"]')).toBeNull();

    expect(root.querySelector('[data-test="boards-simple-edition"]')).not.toBeNull();
    expect(root.querySelector('[data-test="boards-bodies-gap"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="boards-topic-alias"]').length).toBeGreaterThan(0);
    expect(root.querySelector('[data-test="board-directory-card"]')).toBeNull();
  });

  it('preserves the jurisdiction directory and body-detail tool geometry as explicit gaps in both modes', () => {
    localStorage.setItem('gw_home_mode', 'advanced');
    const contractGapIds = [
      'boards-bodies-gap',
      'boards-cadence-gap',
      'boards-members-gap',
      'boards-actions-gap',
      'boards-issues-gap',
      'boards-proof-gap',
      'boards-watch-gap',
      'boards-links-gap',
    ];
    const contractSnapshot = () => ({
      tabs: [...root.querySelectorAll<HTMLElement>('[data-test="boards-jurisdiction-tab"]')]
        .map((node) => `${node.dataset.level}:${node.textContent}`),
      bodySkeletons: [...root.querySelectorAll<HTMLElement>('[data-test="boards-body-card-gap"]')]
        .map((node) => `${node.dataset.level}:${node.textContent}`),
      detailTools: [...root.querySelectorAll<HTMLButtonElement>('[data-test="boards-detail-tools"] button')]
        .map((node) => `${node.disabled}:${node.textContent}`),
      gaps: contractGapIds.map((id) => root.querySelector(`[data-test="${id}"]`)?.textContent),
      topics: [...root.querySelectorAll<HTMLElement>('[data-test="boards-topic-context-card"]')]
        .map((node) => `${node.dataset.topicId}:${node.textContent}`),
    });

    renderBoardsDirectory(root, GRAPH_REAL, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="boards-advanced-workbench"] .gw-boards-contract-advanced-layout')).not.toBeNull();
    expect(root.querySelectorAll<HTMLButtonElement>('[data-test="boards-jurisdiction-tab"]:disabled')).toHaveLength(3);
    expect(root.querySelectorAll('[data-test="boards-body-card-gap"]')).toHaveLength(3);
    expect(root.querySelectorAll<HTMLButtonElement>('[data-test="boards-detail-tools"] button:disabled')).toHaveLength(3);
    expect(root.querySelector('[data-test="board-directory-card"]')).toBeNull();
    expect(root.querySelector('[data-test="board-detail"]')).toBeNull();
    const advanced = contractSnapshot();

    localStorage.setItem('gw_home_mode', 'simple');
    renderBoardsDirectory(root, GRAPH_REAL, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="boards-simple-edition"]')).not.toBeNull();
    expect(root.querySelector('.gw-boards-contract-advanced-layout')).toBeNull();
    expect(contractSnapshot()).toEqual(advanced);
  });
});
