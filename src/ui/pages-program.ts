/**
 * GOV-665 — Wave 2 pages: Fast Agenda, advanced Timeline, and Boards directory.
 *
 * These surfaces consume only the committed web-safe GOV-605/GOV-149 captures.
 * They do not derive trust, counts, scores, verdicts, or publication state. Demo
 * data is allowed only behind `?demo=sample` and is visibly labeled by callers.
 */

import type { AgendaBoard, AgendaBoardCard, AgendaLane } from '../types/agenda-board';
import type {
  EvidenceLink,
  ReadApiResponse,
  StatementRecord,
  SuppliedFilesProjection,
  SuppliedSourceFile,
  SupersedeEvent,
  SupersedeProjection,
  TopicTreeNode,
} from '../types/read-api';
import { ensureStyle, gapCardSection, recordCard } from './render';
import {
  groupSuppliedFilesByMeeting,
  pendingReviewNotice,
  safeHttpUrl,
  suppliedFileMeta,
} from './supplied-files';
import {
  reprocessingNotice,
  supersedeFlagLabel,
  supersedeSideRows,
  hasClearedAfter,
} from './supersede-view';
import { FIXTURE_BANNER_TEXT, trustLabel } from './state-view';
import { buildGapSummary, buildTimeline, recordTimelineDate } from './timeline';
import {
  confidenceLabel,
  correctionStatusLabel,
  provenanceBadge,
  verificationStatusLabel,
} from './statement-presenter';
import {
  renderPrivateInfoNote,
  type PrivateInfoNoteId,
} from './private-info-note';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

export type PageMode = 'simple' | 'advanced';
// The handoff defines one cross-page reading-mode preference.  Older page
// renderers briefly used a second `gw-mode` key, which let the persistent shell
// say Advanced while a page rendered Simple.  Keep one source of truth so the
// two complete skins always move together.
const MODE_KEY = 'gw_home_mode';
const WATCHLIST_KEY = 'gw-watchlist';

export function readPageMode(): PageMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === 'simple' || v === 'advanced') return v;
  } catch {
    /* storage unavailable */
  }
  return 'simple';
}

function fixtureBanner(notice?: string): HTMLElement {
  return el('div', { class: 'gw-fixture-banner', role: 'status', 'data-test': 'fixture-banner' }, [
    FIXTURE_BANNER_TEXT,
    el('small', {}, ['Reviewer-internal offline snapshot — not a live read.']),
    ...(notice ? [el('div', { class: 'gw-notice' }, [notice])] : []),
  ]);
}

function sourceNotice(notice: string): HTMLElement {
  return el('div', { class: 'gw-state', role: 'status', 'data-test': 'source-notice' }, [notice]);
}

interface PageShellOptions {
  notice?: string;
  fixture?: boolean;
  /** False suppresses every provenance/fixture notice until lane admission. */
  admitted?: boolean;
  /** Private route explanation; never rendered before reviewer admission. */
  noteId?: PrivateInfoNoteId;
}

function headingWithInfo(
  heading: HTMLElement,
  noteId: PrivateInfoNoteId,
  testId?: string,
): HTMLDivElement {
  return el('div', {
    class: 'gw-context-info-heading',
    ...(testId ? { 'data-test': testId } : {}),
  }, [
    heading,
    renderPrivateInfoNote(noteId),
  ]);
}

function noteRow(
  label: string,
  noteIds: readonly PrivateInfoNoteId[],
  testId: string,
): HTMLDivElement {
  return el('div', {
    class: 'gw-context-info-row',
    role: 'group',
    'aria-label': label,
    'data-test': testId,
  }, noteIds.map((id) => renderPrivateInfoNote(id)));
}

function pageShell(root: HTMLElement, testId: string, title: string, options: PageShellOptions = {}): HTMLElement {
  ensureStyle();
  ensureBaselinePageStyle();
  root.className = 'gw-root gw-boards-root';
  root.replaceChildren();
  const admitted = options.admitted !== false;
  if (admitted) {
    if (options.fixture) root.append(fixtureBanner(options.notice));
    else if (options.notice) root.append(sourceNotice(options.notice));
  }
  const heading = el('h1', { class: 'gw-h1' }, [title]);
  const shell = el('div', { class: 'gw-boards', 'data-test': testId }, [
    admitted && options.noteId
      ? headingWithInfo(heading, options.noteId, `${testId}-info`)
      : heading,
  ]);
  root.append(shell);
  return shell;
}

const BASELINE_PAGE_STYLE = `
.gw-baseline-mode-mount{margin-top:var(--gw-space-4)}
.gw-baseline-simple-sheet{max-width:70rem;margin:0 auto;padding:var(--gw-space-6);border:var(--gw-border-w) solid var(--gw-rule-strong);border-top:4px solid var(--gw-rule-strong);background:var(--gw-surface);font-family:var(--gw-font-serif);display:grid;gap:var(--gw-space-5)}
.gw-baseline-simple-head{text-align:center;border-bottom:3px double var(--gw-rule-strong);padding-bottom:var(--gw-space-5)}
.gw-baseline-simple-head p{margin:.25rem 0;color:var(--gw-text-secondary)}
.gw-baseline-simple-head>p:first-child{font:800 var(--gw-text-kicker)/1.2 var(--gw-font);letter-spacing:1.3px;color:var(--gw-accent)}
.gw-baseline-simple-head h2{margin:.35rem auto;font-size:clamp(1.7rem,3vw,2.8rem);line-height:1.05;max-width:22ch}
.gw-baseline-simple-sheet>.gw-board,.gw-baseline-simple-sheet [data-test="boards-topic-context"]>.gw-board,.gw-baseline-simple-sheet [data-test="source-vault-list"]{grid-template-columns:1fr}
.gw-baseline-simple-sheet .gw-state,.gw-baseline-simple-sheet .gw-card{border-radius:0;border-left:0;border-right:0;box-shadow:none}
.gw-baseline-advanced-workbench{display:grid;gap:var(--gw-space-5)}
.gw-baseline-workbench-head{display:flex;justify-content:space-between;gap:var(--gw-space-5);align-items:end;border-bottom:var(--gw-border-w) solid var(--gw-border);padding-bottom:var(--gw-space-4)}
.gw-baseline-workbench-head p{font:800 var(--gw-text-kicker)/1.2 var(--gw-font);letter-spacing:1.2px;color:var(--gw-accent);margin:0}
.gw-baseline-workbench-head h2{font-size:var(--gw-text-lg);margin:0;text-align:right}
.gw-context-info-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--gw-space-3)}
.gw-context-info-heading>:first-child{min-width:0}
.gw-context-info-row{display:flex;align-items:center;justify-content:flex-end;gap:var(--gw-space-2);flex-wrap:wrap}
.gw-vault-contract-toolbar>.gw-context-info-row{grid-column:1/-1}
.gw-source-vault-advanced-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:var(--gw-space-5);align-items:start}
.gw-source-vault-gap-stack{display:grid;gap:var(--gw-space-4)}
@media(max-width:800px){.gw-baseline-simple-sheet{padding:var(--gw-space-4)}.gw-baseline-workbench-head{align-items:start;flex-direction:column}.gw-baseline-workbench-head h2{text-align:left}.gw-source-vault-advanced-grid{grid-template-columns:1fr}}
`;

let baselinePageStyleInjected = false;

function ensureBaselinePageStyle(): void {
  if (baselinePageStyleInjected && document.head.querySelector('[data-test="baseline-page-style"]')) return;
  document.head.append(el('style', { 'data-test': 'baseline-page-style' }, [BASELINE_PAGE_STYLE]));
  baselinePageStyleInjected = true;
}

function allCards(board: AgendaBoard): AgendaBoardCard[] {
  return board.lanes.flatMap((lane) => lane.cards);
}

function firstSourceLink(card: AgendaBoardCard): HTMLElement | string {
  const source = card.sourceRefs[0];
  if (!source?.originalUrl) return 'Source link not present in reviewed projection';
  return el('a', { href: source.originalUrl, target: '_blank', rel: 'noopener noreferrer' }, ['Open source']);
}

function honestAgendaEmpty(board: AgendaBoard): HTMLElement {
  return el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'fast-agenda-empty', role: 'status' }, [
    el('h2', {}, ['No next agenda item is review-ready yet']),
    el('p', {}, [
      board.unanchoredStatementCount > 0
        ? `${board.unanchoredStatementCount} reviewed Alpine statement(s) exist, but none are anchored to an agenda item yet.`
        : 'The reviewed Alpine projection currently has no agenda-anchored cards.',
    ]),
  ]);
}

function fastAgendaCard(card: AgendaBoardCard): HTMLElement {
  return el('article', { class: 'gw-card', 'data-test': 'fast-agenda-card', 'data-agenda-item': card.agendaItemId }, [
    el('p', { class: 'gw-muted', 'data-test': 'fast-agenda-meeting' }, [
      [card.meetingDate, card.meetingBody, card.meetingTitle].filter(Boolean).join(' · ') || 'Meeting context not present in projection',
    ]),
    el('h2', { 'data-test': 'fast-agenda-title' }, [card.agendaItemTitle ?? card.agendaItemId]),
    el('div', { class: 'gw-badges' }, [
      el('span', { class: 'gw-badge gw-tone-neutral', 'data-test': 'fast-agenda-lane' }, [card.laneLabel]),
      el('span', { class: 'gw-badge gw-tone-caution', 'data-test': 'fast-agenda-status' }, [card.statusBadge]),
    ]),
    el('p', { class: 'gw-muted', 'data-test': 'fast-agenda-source' }, [firstSourceLink(card)]),
    el('p', { class: 'gw-muted', 'data-test': 'fast-agenda-count' }, [
      `${card.recordCount} reviewed statement${card.recordCount === 1 ? '' : 's'} under this item`,
    ]),
  ]);
}

function agendaLaneSummary(lane: AgendaLane): HTMLElement {
  return el('li', { class: 'gw-related', 'data-test': 'fast-agenda-lane-summary', 'data-lane': String(lane.lane) }, [
    el('span', { class: 'gw-related-type' }, [lane.laneLabel]),
    ` ${lane.cardCount}`,
  ]);
}

export function renderFastAgenda(root: HTMLElement, board: AgendaBoard, notice?: string, fixture = false): void {
  const shell = pageShell(root, 'fast-agenda-page', 'Fast Agenda', {
    notice,
    fixture,
    admitted: board.access === 'reviewer_internal',
    noteId: 'agenda-overview',
  });
  if (board.access !== 'reviewer_internal') {
    shell.append(el('section', { class: 'gw-state', 'data-test': 'state-reviewer-gated', role: 'status' }, [
      el('h2', {}, ['Reviewer-internal only']),
      el('p', {}, ['The Fast Agenda page renders no cards outside the reviewer-internal lane.']),
    ]));
    return;
  }

  const mount = el('div', { 'data-test': 'fast-agenda-mount' });
  ((mode: PageMode) => {
    mount.replaceChildren();
    mount.append(noteRow(
      'How Fast Agenda cards are filed',
      ['agenda-meeting', 'agenda-lifecycle', 'agenda-sources'],
      'fast-agenda-card-info',
    ));
    const cards = allCards(board);
    if (!cards.length) {
      mount.append(honestAgendaEmpty(board));
    } else if (mode === 'simple') {
      mount.append(fastAgendaCard(cards[0]));
    } else {
      mount.append(el('div', { class: 'gw-board', 'data-test': 'fast-agenda-list' }, cards.map(fastAgendaCard)));
    }
    mount.append(el('section', { class: 'gw-state', 'data-test': 'fast-agenda-disclosures', role: 'note' }, [
      headingWithInfo(
        el('p', { class: 'gw-muted' }, ['Agenda projection limits, rendered verbatim:']),
        'agenda-gaps',
        'fast-agenda-gap-info',
      ),
      noteRow(
        'About planned agenda controls',
        ['agenda-filters'],
        'fast-agenda-filter-info',
      ),
      el('ul', { class: 'gw-muted' }, [
        el('li', {}, [board.disclosures.decisions]),
        el('li', {}, [board.disclosures.categories]),
        ...board.lanes.map(agendaLaneSummary),
      ]),
    ]));
  })(readPageMode());
  shell.append(mount);
}

export type TimelineLevel = 'year' | 'month' | 'day';
export type TimelineEventType = 'all' | 'agenda' | 'ordering' | 'undated';

function eventType(record: StatementRecord): Exclude<TimelineEventType, 'all'> {
  if (isoDate(record.agenda_item_id)) return 'agenda';
  if (recordTimelineDate(record)) return 'ordering';
  return 'undated';
}

function dateBucket(date: string | undefined, level: TimelineLevel): string {
  if (!date) return 'Undated';
  if (level === 'year') return date.slice(0, 4);
  if (level === 'month') return date.slice(0, 7);
  return date;
}

function selectValue(query: URLSearchParams, key: string, fallback: string, allowed: readonly string[]): string {
  const value = query.get(key) ?? fallback;
  return allowed.includes(value) ? value : fallback;
}

function filterOption(value: string, label: string, selected: string): HTMLOptionElement {
  return el('option', value === selected ? { value, selected: '' } : { value }, [label]);
}

function timelineFilterBar(
  query: URLSearchParams,
  level: TimelineLevel,
  type: TimelineEventType,
  resultCount: number,
): HTMLElement {
  const form = el('form', {
    class: 'gw-timeline-filterbar',
    role: 'search',
    'aria-label': 'Filter reviewed timeline records',
    'data-test': 'timeline-filter-form',
  });
  const searchInput = el('input', {
    type: 'search',
    name: 'search',
    value: query.get('search') ?? '',
    placeholder: 'Search reviewed records…',
    'aria-label': 'Search reviewed timeline records',
    'data-test': 'timeline-search-input',
  });
  const levelSelect = el('select', {
    name: 'level',
    'aria-label': 'Group timeline by',
    'data-test': 'timeline-level-select',
  }, [
    filterOption('month', 'Group by month', level),
    filterOption('day', 'Group by day', level),
    filterOption('year', 'Group by year', level),
  ]);
  const typeSelect = el('select', {
    name: 'type',
    'aria-label': 'Timeline record type',
    'data-test': 'timeline-type-select',
  }, [
    filterOption('all', 'All reviewed records', type),
    filterOption('agenda', 'Agenda-id ordering date (not event)', type),
    filterOption('ordering', 'Evidence/capture ordering date (not event)', type),
    filterOption('undated', 'Undated', type),
  ]);
  const submit = el('button', { type: 'submit', class: 'gw-timeline-filter-submit' }, ['Apply filters']);
  const reset = el('a', {
    class: 'gw-timeline-filter-reset',
    href: '#/timeline',
    'data-test': 'timeline-filter-reset',
  }, ['Clear']);
  form.append(
    headingWithInfo(
      el('strong', {}, ['Timeline search and display filters']),
      'timeline-filters',
      'timeline-filter-info',
    ),
    el('label', { class: 'gw-timeline-field gw-timeline-search-field' }, [
      el('span', {}, ['Search']),
      searchInput,
    ]),
    el('label', { class: 'gw-timeline-field' }, [el('span', {}, ['Group']), levelSelect]),
    el('label', { class: 'gw-timeline-field' }, [el('span', {}, ['Record type']), typeSelect]),
    submit,
    reset,
    el('span', { class: 'gw-timeline-result-count', 'data-test': 'timeline-result-count', role: 'status' }, [
      `${resultCount} reviewed row${resultCount === 1 ? '' : 's'}`,
    ]),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const next = new URLSearchParams();
    const term = searchInput.value.trim();
    if (term) next.set('search', term);
    if (levelSelect.value !== 'month') next.set('level', levelSelect.value);
    if (typeSelect.value !== 'all') next.set('type', typeSelect.value);
    const encoded = next.toString();
    window.location.hash = encoded ? `/timeline?${encoded}` : '/timeline';
  });
  return form;
}

export interface TimelineProjectionOptions {
  /**
   * The serving endpoint's Alpine scope does not establish a government level.
   * Callers may opt into `town` only when a separate reviewed projection proves
   * that relationship.
   */
  exactGovernmentLevel?: 'town' | 'unavailable';
}

/** Preserve the full handoff tool geometry without enabling unsupported claims. */
function timelineUnavailableTools(exactGovernmentLevel: 'town' | 'unavailable'): HTMLElement {
  const unavailable = (testId: string, label: string): HTMLButtonElement => el('button', {
    type: 'button',
    disabled: '',
    'aria-disabled': 'true',
    'data-test': testId,
  }, [label]);
  const toolGroup = (label: string, children: HTMLElement[]): HTMLElement => el('div', {
    class: 'gw-timeline-tool-group',
    role: 'group',
    'aria-label': label,
  }, [el('span', { class: 'gw-timeline-tool-label' }, [label]), ...children]);

  const governmentLevelControls = exactGovernmentLevel === 'town'
    ? [
      el('span', { class: 'gw-timeline-tool-status', 'data-state': 'supplied', 'data-test': 'timeline-level-town' }, ['Town · supplied']),
      unavailable('timeline-level-county-unavailable', 'County · unavailable'),
      unavailable('timeline-level-state-unavailable', 'State · unavailable'),
    ]
    : [
      unavailable('timeline-level-town-unavailable', 'Town · unavailable'),
      unavailable('timeline-level-county-unavailable', 'County · unavailable'),
      unavailable('timeline-level-state-unavailable', 'State · unavailable'),
    ];

  return el('section', {
    class: 'gw-timeline-tool-gaps',
    role: 'note',
    'data-test': 'timeline-tools-unavailable',
    'data-state': 'unavailable',
  }, [
    el('div', {}, [
      el('p', { class: 'gw-timeline-kicker' }, ['DESIGNED TIMELINE TOOLS']),
      headingWithInfo(
        el('strong', {}, [
          exactGovernmentLevel === 'town'
            ? 'Only the reviewed Town ordering projection is connected'
            : 'The exact government-level projection is not connected',
        ]),
        'timeline-gaps',
        'timeline-gap-info',
      ),
      el('p', {}, [
        'Unsupported government level, event-kind, issue, event-window, and event-sort controls stay visible but disabled until typed backend fields are supplied.',
      ]),
    ]),
    el('div', { class: 'gw-timeline-tool-gap-controls' }, [
      toolGroup('Government level', governmentLevelControls),
      toolGroup('Event category', [
        unavailable('timeline-type-meeting-unavailable', 'Meeting'),
        unavailable('timeline-type-document-unavailable', 'Document'),
        unavailable('timeline-type-change-unavailable', 'Change'),
        unavailable('timeline-type-deadline-unavailable', 'Deadline'),
        unavailable('timeline-type-vote-unavailable', 'Vote'),
      ]),
      toolGroup('Issue run', [unavailable('timeline-issue-preset-unavailable', 'Issue preset · unavailable')]),
      toolGroup('Event window', [
        unavailable('timeline-window-next-unavailable', 'Next 3 weeks · unavailable'),
        unavailable('timeline-window-90-unavailable', 'Past 90 days · unavailable'),
        unavailable('timeline-window-year-unavailable', 'Past year · unavailable'),
        unavailable('timeline-window-all-unavailable', 'Complete archive · unavailable'),
      ]),
      toolGroup('Sort', [unavailable('timeline-sort-unavailable', 'Event chronology · unavailable')]),
    ]),
  ]);
}

interface TimelineMapRecord {
  record: StatementRecord;
  timelineDate?: string;
}

type TimelineDateBasis = 'agenda-reference' | 'source-date' | 'capture' | 'validation' | 'evidence-date' | 'undated';

interface TimelineDateBasisView {
  kind: TimelineDateBasis;
  label: string;
  isEventDate: boolean;
}

const TIMELINE_DATE_BASIS: Record<TimelineDateBasis, TimelineDateBasisView> = {
  'agenda-reference': { kind: 'agenda-reference', label: 'Agenda-id ordering date · not event', isEventDate: false },
  'source-date': { kind: 'source-date', label: 'Source ordering date · meaning not typed', isEventDate: false },
  capture: { kind: 'capture', label: 'Capture/scan date · not event', isEventDate: false },
  validation: { kind: 'validation', label: 'Validation date · not event', isEventDate: false },
  'evidence-date': { kind: 'evidence-date', label: 'Evidence ordering date · multiple fields match', isEventDate: false },
  undated: { kind: 'undated', label: 'Undated', isEventDate: false },
};

function isoDate(value: string | null | undefined): string | undefined {
  return value?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
}

/** Describe the exact field that supplied recordTimelineDate; never promote it to an event date. */
function timelineDateBasis(record: StatementRecord, timelineDate: string | undefined): TimelineDateBasisView {
  if (!timelineDate) return TIMELINE_DATE_BASIS.undated;
  if (isoDate(record.agenda_item_id) === timelineDate) return TIMELINE_DATE_BASIS['agenda-reference'];
  const evidence = record.evidence ?? [];
  const matches = new Set<TimelineDateBasis>();
  if (evidence.some((row) => isoDate(row.last_validated_utc) === timelineDate)) matches.add('validation');
  if (evidence.some((row) => isoDate(row.scan_date) === timelineDate)) matches.add('capture');
  if (evidence.some((row) => isoDate(row.source_date) === timelineDate)) matches.add('source-date');
  if (matches.size > 1) return TIMELINE_DATE_BASIS['evidence-date'];
  const [match] = matches;
  if (match) return TIMELINE_DATE_BASIS[match];
  return TIMELINE_DATE_BASIS.undated;
}

function timelinePosition(date: string, firstDate: string, lastDate: string): number {
  const dateMs = Date.parse(`${date}T00:00:00Z`);
  const firstMs = Date.parse(`${firstDate}T00:00:00Z`);
  const lastMs = Date.parse(`${lastDate}T00:00:00Z`);
  if (![dateMs, firstMs, lastMs].every(Number.isFinite) || firstMs === lastMs) return 50;
  return Math.round(((dateMs - firstMs) / (lastMs - firstMs)) * 10_000) / 100;
}

function timelineRecordAnchor(index: number): string {
  return `gw-timeline-record-${index + 1}`;
}

function timelineMapLabel(record: StatementRecord): string {
  const value = record.statement_text?.trim() || record.statement_id;
  return value.length > 92 ? `${value.slice(0, 89)}…` : value;
}

/**
 * Preserve the handoff's cross-government timeline bar without pretending the
 * current Alpine statement projection contains a government-level assignment or
 * typed issue-run edges. Markers use only the same web-safe ordering date as the
 * record list; unavailable lanes and connector behavior remain visible gaps.
 */
function timelineMap(
  records: readonly TimelineMapRecord[],
  mode: PageMode,
  exactGovernmentLevel: 'town' | 'unavailable',
): HTMLElement {
  const dated = records
    .map((entry, index) => ({ ...entry, index }))
    .filter((entry): entry is TimelineMapRecord & { timelineDate: string; index: number } => Boolean(entry.timelineDate))
    .sort((a, b) => a.timelineDate.localeCompare(b.timelineDate) || a.index - b.index);
  const dates = [...new Set(dated.map((entry) => entry.timelineDate))].sort();
  const firstDate = dates[0];
  const lastDate = dates.at(-1);
  const undatedCount = records.length - dated.length;

  const clustersByKey = new Map<string, {
    date: string;
    basis: TimelineDateBasisView;
    entries: typeof dated;
  }>();
  for (const entry of dated) {
    const basis = timelineDateBasis(entry.record, entry.timelineDate);
    const key = `${entry.timelineDate}:${basis.kind}`;
    const cluster = clustersByKey.get(key) ?? { date: entry.timelineDate, basis, entries: [] };
    cluster.entries.push(entry);
    clustersByKey.set(key, cluster);
  }
  // Allocate the first row whose prior card is far enough away on the axis.
  // Unlike index % 4, this never reuses a row for nearby dates and the map
  // height grows with the allocation, so dense/mobile clusters stay tappable.
  const minimumPositionGap = typeof window !== 'undefined' && window.innerWidth <= 640 ? 50 : 42;
  const rowEndPositions: number[] = [];
  const clusters = [...clustersByKey.values()].map((cluster) => {
    const position = timelinePosition(cluster.date, firstDate!, lastDate!);
    let row = rowEndPositions.findIndex((prior) => position - prior >= minimumPositionGap);
    if (row === -1) row = rowEndPositions.length;
    rowEndPositions[row] = position;
    return { ...cluster, position, row };
  });
  const rowCount = Math.max(1, rowEndPositions.length);

  const recordEvents = dated.length
    ? el('ol', {
      class: 'gw-timeline-map-events',
      'data-test': 'timeline-map-record-events',
      'aria-label': 'Proportionally positioned reviewed ordering-date markers',
      style: `--gw-timeline-rows:${rowCount}`,
    }, clusters.map((cluster) => {
      const position = cluster.position;
      const targetId = timelineRecordAnchor(cluster.entries[0].index);
      const rowCountForCluster = cluster.entries.length;
      const receiptCount = cluster.entries.reduce((count, entry) => count + (entry.record.evidence?.length ?? 0), 0);
      const firstLabel = timelineMapLabel(cluster.entries[0].record);
      const copy = rowCountForCluster === 1 ? firstLabel : `${firstLabel} · +${rowCountForCluster - 1} more`;
      const marker = el('button', {
          type: 'button',
          class: `gw-timeline-map-event gw-timeline-map-event-${cluster.basis.kind}`,
          title: `${cluster.basis.label}: ${copy}`,
          'data-test': 'timeline-map-event',
          'data-date': cluster.date,
          'data-date-basis': cluster.basis.kind,
          'data-is-event-date': String(cluster.basis.isEventDate),
          'data-position': String(position),
          'data-record-count': String(rowCountForCluster),
          'data-receipt-count': String(receiptCount),
          'data-target-id': targetId,
        }, [
          el('span', { class: 'gw-timeline-map-dot', 'aria-hidden': 'true' }, []),
          el('time', { datetime: cluster.date }, [cluster.date]),
          el('span', { class: 'gw-timeline-map-event-copy' }, [copy]),
          el('span', { class: 'gw-timeline-map-basis' }, [cluster.basis.label]),
          el('span', { class: 'gw-timeline-map-status', 'data-test': 'timeline-map-receipt-count' }, [
            `${rowCountForCluster} reviewed row${rowCountForCluster === 1 ? '' : 's'} · ${receiptCount} source receipt${receiptCount === 1 ? '' : 's'}`,
          ]),
        ]);
      marker.addEventListener('click', () => {
        const target = document.getElementById(targetId);
        if (!target) return;
        target.focus({ preventScroll: true });
        if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'start' });
      });
      return el('li', {
        style: `--gw-timeline-position:${position}%;--gw-timeline-row:${cluster.row}`,
        'data-edge': position === 0 ? 'start' : position === 100 ? 'end' : 'middle',
      }, [marker]);
    }))
    : el('div', { class: 'gw-timeline-map-gap', role: 'status', 'data-test': 'timeline-map-date-gap' }, [
      el('strong', {}, ['No web-safe timeline date available']),
      el('span', {}, [
        `${records.length} authorized row${records.length === 1 ? '' : 's'} remain in the undated record list below; no government level was inferred.`,
      ]),
    ]);

  const unavailableLane = (level: string, testId: string): HTMLElement => el('div', {
    class: 'gw-timeline-map-gap',
    role: 'status',
    'data-test': testId,
  }, [
    el('strong', {}, [`${level} projection unavailable`]),
    el('span', {}, [`No reviewed ${level.toLocaleLowerCase()} date records are supplied to this route; no markers were invented.`]),
  ]);

  return el('section', {
    class: `gw-timeline-map gw-timeline-map-${mode}`,
    'data-test': 'timeline-map',
    'data-mode': mode,
  }, [
    el('header', { class: 'gw-timeline-map-head' }, [
      el('div', {}, [
        el('p', { class: 'gw-timeline-kicker' }, ['CROSS-GOVERNMENT DATE-ORDER BAR']),
        headingWithInfo(
          el('h2', {}, [
            exactGovernmentLevel === 'town'
              ? 'Town supplied; County and State reserved'
              : 'Date ordering supplied; government level unavailable',
          ]),
          'timeline-map',
          'timeline-map-info',
        ),
      ]),
      el('div', { class: 'gw-timeline-map-legend', 'aria-label': 'Timeline marker legend' }, [
        el('span', { class: 'is-agenda' }, ['● Agenda-id ordering date · not event']),
        el('span', { class: 'is-source' }, ['● Source ordering date · meaning not typed']),
        el('span', { class: 'is-capture' }, ['● Capture/validation · not event']),
        el('span', { class: 'is-undated' }, ['● Undated below']),
      ]),
    ]),
    noteRow(
      'How Timeline ordering dates are calculated',
      ['timeline-date-basis'],
      'timeline-date-basis-info',
    ),
    el('div', { class: 'gw-timeline-map-axis', 'aria-label': 'Timeline date range' }, [
      el('span', {}, [firstDate ?? 'No dated start']),
      el('i', { 'aria-hidden': 'true' }, []),
      el('span', {}, [lastDate ?? 'No dated end']),
    ]),
    el('div', { class: 'gw-timeline-map-lanes' }, [
      el('section', {
        class: `gw-timeline-map-lane ${exactGovernmentLevel === 'town' ? 'gw-timeline-map-town' : 'gw-timeline-map-unscoped'}`,
        'data-test': exactGovernmentLevel === 'town' ? 'timeline-map-town' : 'timeline-map-unscoped',
      }, [
        exactGovernmentLevel === 'town'
          ? el('h3', {}, ['TOWN', el('small', {}, ['Alpine'])])
          : el('h3', {}, ['AUTHORIZED RECORDS', el('small', {}, ['Level unavailable'])]),
        recordEvents,
      ]),
      el('section', { class: 'gw-timeline-map-lane gw-timeline-map-county', 'data-test': 'timeline-map-county' }, [
        el('h3', {}, ['COUNTY']),
        unavailableLane('County', 'timeline-county-gap'),
      ]),
      el('section', { class: 'gw-timeline-map-lane gw-timeline-map-state', 'data-test': 'timeline-map-state' }, [
        el('h3', {}, ['STATE']),
        unavailableLane('State', 'timeline-state-gap'),
      ]),
    ]),
    el('footer', { class: 'gw-timeline-map-foot' }, [
      el('p', { 'data-test': 'timeline-date-disclosure' }, [
        'Every plotted value is an ordering date, not a typed civic event date. Agenda ids, source date fields, capture/scan dates, and validation dates retain their exact basis without inferring publication or event meaning.',
      ]),
      el('p', { 'data-test': 'timeline-connector-gap' }, [
        'Issue-run highlighting and connector lines are unavailable until the backend supplies typed cross-record issue edges.',
      ]),
      ...(undatedCount ? [el('p', {}, [`${undatedCount} undated reviewed row${undatedCount === 1 ? '' : 's'} appear below and are not placed on the bar.`])] : []),
    ]),
  ]);
}

export function renderTimelineLevels(
  root: HTMLElement,
  data: ReadApiResponse,
  query: URLSearchParams,
  notice?: string,
  options: TimelineProjectionOptions = {},
): void {
  ensureTimelineHybridStyle();
  const exactGovernmentLevel = options.exactGovernmentLevel ?? 'unavailable';
  const shell = pageShell(root, 'timeline-levels-page', 'Timeline', {
    admitted: data.access === 'reviewer_internal',
    noteId: 'timeline-overview',
  });
  shell.classList.add('gw-timeline-hybrid');
  if (data.access !== 'reviewer_internal') {
    shell.append(el('section', { class: 'gw-state', 'data-test': 'state-reviewer-gated', role: 'status' }, [
      el('h2', {}, ['Reviewer-internal only']),
      el('p', {}, ['The timeline renders no cards outside the reviewer-internal lane.']),
    ]));
    return;
  }

  const level = selectValue(query, 'level', 'month', ['year', 'month', 'day']) as TimelineLevel;
  const requestedType = query.get('type') === 'source' ? 'ordering' : query.get('type');
  const type = (requestedType && ['all', 'agenda', 'ordering', 'undated'].includes(requestedType)
    ? requestedType
    : 'all') as TimelineEventType;
  const search = (query.get('search') ?? '').trim().toLocaleLowerCase();
  const timeline = buildTimeline(data);
  const gapSummary = buildGapSummary(data);
  const filtered = timeline.ordered.filter(({ record }) => {
    if (type !== 'all' && eventType(record) !== type) return false;
    if (!search) return true;
    const haystack = [
      record.statement_id,
      record.statement_text,
      record.speaker_label,
      record.agenda_item_id,
      ...(record.evidence ?? []).flatMap((evidence) => [
        evidence.to_source_id,
        evidence.published_by,
        evidence.jurisdiction,
      ]),
    ]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .toLocaleLowerCase();
    return haystack.includes(search);
  });
  const byBucket = new Map<string, TimelineMapRecord[]>();
  for (const entry of filtered) {
    const { timelineDate } = entry;
    const bucket = dateBucket(timelineDate, level);
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), entry]);
  }

  shell.append(
    el('section', { class: 'gw-timeline-intro', 'data-test': 'timeline-hybrid-intro' }, [
      el('div', {}, [
        el('p', { class: 'gw-timeline-kicker' }, ['REVIEWED RECORD TIMELINE']),
        el('h2', {}, ['What the current Alpine record actually supports']),
        el('p', { class: 'gw-muted' }, [
          'The handoff’s timeline framing, backed by fail-closed record cards, source receipts, explicit missing-data gaps, and truthful date semantics.',
        ]),
      ]),
      el('aside', { class: 'gw-timeline-scope', role: 'note' }, [
        el('strong', {}, [
          exactGovernmentLevel === 'town'
            ? 'TOWN · ALPINE'
            : 'ALPINE ENDPOINT CONTEXT · EXACT LEVEL UNAVAILABLE',
        ]),
        el('span', {}, [
          exactGovernmentLevel === 'town'
            ? 'County and State lanes remain unavailable until reviewed backend projections exist.'
            : 'These records came from the Alpine serving context, but the response does not assign them to Town, County, or State government.',
        ]),
      ]),
    ]),
    ...(notice ? [el('div', { class: 'gw-timeline-origin', role: 'status', 'data-test': 'source-notice' }, [notice])] : []),
    el('div', { class: 'gw-timeline-filter-meta', 'data-test': 'timeline-filters', 'aria-label': 'Applied timeline filters' }, [
      el('span', {}, [`Level: ${level}`]),
      el('span', {}, [`Type: ${type}`]),
      ...(search ? [el('span', { 'data-test': 'timeline-search-filter' }, [`Search: ${search}`])] : []),
    ]),
    timelineFilterBar(query, level, type, filtered.length),
    timelineUnavailableTools(exactGovernmentLevel),
  );

  const mount = el('div', { 'data-test': 'timeline-mode-mount' });
  ((mode: PageMode) => {
    mount.replaceChildren();
    mount.append(noteRow(
      'About reviewed Timeline rows and receipts',
      ['timeline-records'],
      'timeline-records-info',
    ));
    if (gapSummary) mount.append(gapCardSection(gapSummary));
    if (filtered.length === 0) {
      mount.append(el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'timeline-empty', role: 'status' }, [
        el('h2', {}, ['No reviewed records match this timeline filter']),
        el('p', {}, ['No records were invented to fill this filter.']),
      ]));
      return;
    }
    mount.append(timelineMap(filtered, mode, exactGovernmentLevel));
    if (mode === 'simple') {
      mount.append(el('div', { class: 'gw-timeline-simple-list', 'data-test': 'timeline-simple' }, filtered.map(({ record }, index) =>
        el('div', { id: timelineRecordAnchor(index), class: 'gw-timeline-record-anchor', tabindex: '-1' }, [
          recordCard(record, undefined, undefined, { reviewerInternal: true }),
        ]),
      )));
      return;
    }
    const recordIndex = new Map(filtered.map((entry, index) => [entry.record.statement_id, index]));
    const lanes = [...byBucket.entries()].map(([bucket, records]) =>
      el('section', { class: 'gw-lane', 'data-test': 'timeline-bucket', 'data-bucket': bucket }, [
        el('div', { class: 'gw-lane-header' }, [
          el('span', { class: 'gw-lane-name' }, [bucket]),
          el('span', { class: 'gw-lane-count' }, [String(records.length)]),
        ]),
        el('div', { class: 'gw-lane-body' }, records.map(({ record }) =>
          el('div', {
            id: timelineRecordAnchor(recordIndex.get(record.statement_id) ?? 0),
            class: 'gw-timeline-record-anchor',
            tabindex: '-1',
          }, [recordCard(record, undefined, undefined, { reviewerInternal: true })]),
        )),
      ]),
    );
    mount.append(el('div', { class: 'gw-timeline-lanes', 'data-test': 'timeline-advanced-lanes' }, lanes));
  })(readPageMode());
  shell.append(mount);
}

export const TIMELINE_HYBRID_STYLE = `
.gw-timeline-hybrid{max-width:none;display:flex;flex-direction:column;gap:14px}
.gw-timeline-hybrid>.gw-h1,.gw-timeline-hybrid>.gw-context-info-heading>.gw-h1{font-size:clamp(1.8rem,3vw,2.7rem);margin:0;line-height:1.05}
.gw-timeline-intro{display:grid;grid-template-columns:minmax(0,1fr) minmax(250px,360px);gap:20px;align-items:end;background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);padding:18px 20px}
.gw-timeline-intro h2{font-size:1.18rem;margin:3px 0 5px}
.gw-timeline-intro p{margin:0}
.gw-timeline-kicker{font:800 var(--gw-text-kicker)/1.2 var(--gw-font);letter-spacing:1.4px;color:var(--gw-accent)}
.gw-timeline-scope{display:flex;flex-direction:column;gap:5px;background:var(--gw-tone-mint-well);border:var(--gw-border-w) solid var(--gw-tone-mint-line);border-radius:10px;padding:12px 14px;color:var(--gw-text-secondary);font-size:var(--gw-text-sm)}
.gw-timeline-scope strong{color:var(--gw-level-town);font-family:var(--gw-font-mono);font-size:11px;letter-spacing:.8px}
.gw-timeline-origin{background:var(--gw-surface-well);border:var(--gw-border-w) dashed var(--gw-border);border-radius:10px;padding:10px 14px;text-align:center;color:var(--gw-text-secondary);font-size:var(--gw-text-sm)}
.gw-timeline-filter-meta{display:flex;gap:6px;flex-wrap:wrap}
.gw-timeline-filter-meta span{font:600 11px/1.2 var(--gw-font-mono);color:var(--gw-text-muted);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);padding:5px 9px;background:var(--gw-surface-subtle)}
.gw-timeline-filterbar{display:grid;grid-template-columns:minmax(220px,1fr) minmax(155px,auto) minmax(170px,auto) auto auto auto;gap:10px;align-items:end;background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);padding:14px}
.gw-timeline-filterbar>.gw-context-info-heading{grid-column:1/-1}
.gw-timeline-field{display:flex;flex-direction:column;gap:5px;color:var(--gw-text-muted);font-size:11px;font-weight:800;letter-spacing:.45px;text-transform:uppercase}
.gw-timeline-field input,.gw-timeline-field select{width:100%;min-height:var(--gw-tap-min);border:var(--gw-border-w) solid var(--gw-border);border-radius:8px;background:var(--gw-surface-subtle);color:var(--gw-text);padding:8px 10px;font:500 var(--gw-text-badge)/1.2 var(--gw-font)}
.gw-timeline-field input:focus-visible,.gw-timeline-field select:focus-visible{outline:2px solid var(--gw-accent);outline-offset:1px;border-color:var(--gw-accent)}
.gw-timeline-filter-submit,.gw-timeline-filter-reset{display:inline-flex;align-items:center;justify-content:center;min-height:var(--gw-tap-min);border-radius:8px;padding:8px 13px;font:700 var(--gw-text-badge)/1 var(--gw-font);cursor:pointer}
.gw-timeline-filter-submit{border:var(--gw-border-w) solid var(--gw-accent);background:var(--gw-accent);color:var(--gw-accent-text-on)}
.gw-timeline-filter-reset{border:var(--gw-border-w) solid var(--gw-border);background:transparent;color:var(--gw-text-secondary);text-decoration:none}
.gw-timeline-result-count{align-self:center;color:var(--gw-text-muted);font:600 11px/1.25 var(--gw-font-mono);white-space:nowrap}
.gw-timeline-tool-gaps{display:grid;grid-template-columns:minmax(210px,.55fr) minmax(0,1.45fr);align-items:start;gap:16px;background:var(--gw-surface-well);border:var(--gw-border-w) dashed var(--gw-border);border-radius:var(--gw-radius-lg);padding:12px 14px;color:var(--gw-text-secondary)}
.gw-timeline-tool-gaps p{margin:3px 0 0;font-size:var(--gw-text-sm)}.gw-timeline-tool-gaps strong{color:var(--gw-text)}
.gw-timeline-tool-gap-controls{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:9px}.gw-timeline-tool-group{display:flex;flex-wrap:wrap;align-items:center;gap:5px;border:var(--gw-border-w) solid var(--gw-border-subtle);border-radius:9px;padding:6px}.gw-timeline-tool-label{width:100%;color:var(--gw-text-muted);font:800 9px/1.2 var(--gw-font);letter-spacing:.7px;text-transform:uppercase}.gw-timeline-tool-gap-controls button,.gw-timeline-tool-status{min-height:var(--gw-tap-min);display:inline-flex;align-items:center;border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);background:var(--gw-surface);color:var(--gw-text-muted);padding:7px 11px;font:700 var(--gw-text-badge)/1 var(--gw-font)}.gw-timeline-tool-gap-controls button{cursor:not-allowed}.gw-timeline-tool-status[data-state="supplied"]{border-color:var(--gw-level-town);background:var(--gw-tone-mint-well);color:var(--gw-level-town);cursor:default}
.gw-timeline-hybrid .gw-view-toggle{width:max-content;background:var(--gw-surface-well);border-radius:var(--gw-radius-pill)}
.gw-timeline-map{display:grid;gap:12px;margin:14px 0;background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);padding:16px;overflow:hidden}
.gw-timeline-map-head{display:flex;align-items:end;justify-content:space-between;gap:16px}
.gw-timeline-map-head h2{margin:3px 0 0;font-size:var(--gw-text-lg)}
.gw-timeline-map-legend{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px 12px;color:var(--gw-text-muted);font:600 11px/1.3 var(--gw-font-mono)}
.gw-timeline-map-legend .is-agenda{color:var(--gw-caution-text)}.gw-timeline-map-legend .is-source{color:var(--gw-ok-text)}.gw-timeline-map-legend .is-capture{color:var(--gw-info-text)}
.gw-timeline-map-axis{display:grid;grid-template-columns:auto minmax(40px,1fr) auto;gap:10px;align-items:center;color:var(--gw-text-muted);font:600 11px/1.2 var(--gw-font-mono)}
.gw-timeline-map-axis i{height:1px;background:var(--gw-border-strong)}
.gw-timeline-map-lanes{display:grid;gap:8px}
.gw-timeline-map-lane{display:grid;grid-template-columns:90px minmax(0,1fr);gap:10px;align-items:stretch;min-height:64px;border:var(--gw-border-w) solid var(--gw-border);border-left-width:4px;border-radius:10px;background:var(--gw-surface-well);padding:8px}
.gw-timeline-map-lane h3{display:flex;flex-direction:column;justify-content:center;gap:3px;margin:0;font:800 11px/1.2 var(--gw-font);letter-spacing:1px}.gw-timeline-map-lane h3 small{color:var(--gw-text-muted);font-size:10px;letter-spacing:0}
.gw-timeline-map-town{border-left-color:var(--gw-level-town)}.gw-timeline-map-unscoped{border-left-color:var(--gw-accent)}.gw-timeline-map-county{border-left-color:var(--gw-level-county)}.gw-timeline-map-state{border-left-color:var(--gw-level-state)}
.gw-timeline-map-events{position:relative;min-height:max(76px,calc(var(--gw-timeline-rows,1) * 70px + 12px));margin:0 8px;padding:0;list-style:none;background:linear-gradient(to right,var(--gw-border-subtle) 1px,transparent 1px) 0 0/25% 100%;overflow:hidden}
.gw-timeline-map-events li{position:absolute;top:calc(var(--gw-timeline-row) * 70px);left:var(--gw-timeline-position);width:clamp(142px,20vw,230px);transform:translateX(-50%)}.gw-timeline-map-events li[data-edge="start"]{transform:none}.gw-timeline-map-events li[data-edge="end"]{transform:translateX(-100%)}
.gw-timeline-map-event{display:grid;grid-template-columns:auto 1fr auto;gap:3px 8px;align-items:center;width:100%;min-height:62px;padding:7px 9px;border:var(--gw-border-w) solid var(--gw-border);border-radius:8px;background:var(--gw-surface);color:var(--gw-text);font:inherit;text-align:left;cursor:pointer;box-shadow:0 3px 10px color-mix(in srgb,var(--gw-bg) 55%,transparent)}
.gw-timeline-map-event:hover,.gw-timeline-map-event:focus-visible{border-color:var(--gw-accent);outline:2px solid var(--gw-accent);outline-offset:1px}
.gw-timeline-map-dot{grid-row:1/3;width:11px;height:11px;border-radius:50%;background:var(--gw-ok-text);box-shadow:0 0 0 3px var(--gw-tone-ok-well)}
.gw-timeline-map-event-agenda-reference .gw-timeline-map-dot{background:var(--gw-caution-text);box-shadow:0 0 0 3px var(--gw-tone-caution-well)}.gw-timeline-map-event-capture .gw-timeline-map-dot,.gw-timeline-map-event-validation .gw-timeline-map-dot,.gw-timeline-map-event-evidence-date .gw-timeline-map-dot{background:var(--gw-info-text);box-shadow:0 0 0 3px var(--gw-tone-info-well)}
.gw-timeline-map-event time{font:600 10px/1.2 var(--gw-font-mono);color:var(--gw-text-muted)}
.gw-timeline-map-event-copy{grid-column:2/4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:700}.gw-timeline-map-basis{grid-column:2/4;color:var(--gw-text-muted);font:700 9px/1.2 var(--gw-font-mono)}
.gw-timeline-map-status{font:700 9px/1 var(--gw-font);color:var(--gw-text-secondary);text-transform:uppercase}
.gw-timeline-map-gap{display:flex;flex-direction:column;justify-content:center;gap:3px;min-width:0;border:var(--gw-border-w) dashed var(--gw-border);border-radius:8px;padding:8px 10px;color:var(--gw-text-muted);font-size:11px}.gw-timeline-map-gap strong{color:var(--gw-text-secondary)}
.gw-timeline-map-foot{display:flex;flex-wrap:wrap;gap:5px 18px;border-top:var(--gw-border-w) solid var(--gw-border-subtle);padding-top:9px;color:var(--gw-text-muted);font:500 10.5px/1.4 var(--gw-font-mono)}.gw-timeline-map-foot p{margin:0}
.gw-timeline-map-simple .gw-timeline-map-event-copy{font-family:var(--gw-font-serif);font-size:14px}.gw-timeline-record-anchor{scroll-margin-top:150px;min-width:0}
.gw-timeline-lanes{display:flex;flex-direction:column;gap:14px}
.gw-timeline-lanes>.gw-lane{width:100%;background:var(--gw-surface-well);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);overflow:hidden}
.gw-timeline-lanes .gw-lane-header{position:static;border-bottom:var(--gw-border-w) solid var(--gw-border);padding:11px 14px;background:var(--gw-surface)}
.gw-timeline-lanes .gw-lane-body{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px;padding:10px}
.gw-timeline-lanes .gw-card,.gw-timeline-simple-list .gw-card{margin:0;border-radius:11px;background:var(--gw-card-bg)}
.gw-timeline-simple-list{display:flex;flex-direction:column;gap:10px}
@media (max-width:900px){
  .gw-timeline-intro{grid-template-columns:1fr}
  .gw-timeline-filterbar{grid-template-columns:1fr 1fr}
  .gw-timeline-search-field,.gw-timeline-result-count{grid-column:1/-1}
  .gw-timeline-tool-gaps{grid-template-columns:1fr}.gw-timeline-tool-gap-controls{justify-content:flex-start}
}
@media (max-width:640px){
  .gw-timeline-filterbar{grid-template-columns:1fr}
  .gw-timeline-search-field,.gw-timeline-result-count{grid-column:auto}
  .gw-timeline-map-head{align-items:start;flex-direction:column}.gw-timeline-map-legend{justify-content:flex-start}
  .gw-timeline-map-lane{grid-template-columns:1fr}.gw-timeline-map-lane h3{display:block}
  .gw-timeline-map-events{min-height:max(70px,calc(var(--gw-timeline-rows,1) * 62px + 8px));margin:0}.gw-timeline-map-events li{top:calc(var(--gw-timeline-row) * 62px);width:clamp(112px,34vw,160px)}.gw-timeline-map-event{min-height:54px}.gw-timeline-map-event-copy{font-size:10px}
  .gw-timeline-lanes .gw-lane-body{grid-template-columns:1fr}
}
`;

let timelineHybridStyleInjected = false;
function ensureTimelineHybridStyle(): void {
  if (timelineHybridStyleInjected) return;
  document.head.append(el('style', { 'data-test': 'timeline-hybrid-style' }, [TIMELINE_HYBRID_STYLE]));
  timelineHybridStyleInjected = true;
}

function topicLabel(node: TopicTreeNode): string {
  return node.topic.canonicalHumanLabel ?? node.topic.name ?? node.topic.topic_id;
}

function flattenTopics(node: TopicTreeNode): TopicTreeNode[] {
  return [node, ...node.children.flatMap(flattenTopics)];
}

const BOARDS_VAULT_FIDELITY_STYLE = `
.gw-boards-contract-directory,.gw-boards-contract-detail,.gw-vault-contract-panel{display:grid;gap:var(--gw-space-4);background:var(--gw-board-bg);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-4)}
.gw-boards-contract-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--gw-space-2);padding:var(--gw-space-2);background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius)}
.gw-supplied-files-group{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-3)}
.gw-supplied-files-group>.gw-card{min-width:0}
.gw-supplied-files-group>.gw-card a{display:inline-block;margin-right:var(--gw-space-4)}
.gw-supersede-card{display:grid;gap:var(--gw-space-3);min-width:0}
.gw-supersede-card[data-flagged="true"]{border-color:var(--gw-caution-text-strong)}
.gw-supersede-flag{margin:0;font:700 var(--gw-text-badge)/1.3 var(--gw-font);color:var(--gw-caution-text-strong);background:var(--gw-caution-bg-soft);border:var(--gw-border-w) solid var(--gw-caution-text-strong);border-radius:var(--gw-radius);padding:var(--gw-space-2) var(--gw-space-3)}
.gw-supersede-card .gw-vault-contract-diff-pane[data-state="pending"]{background:var(--gw-caution-bg-soft)}
.gw-supersede-card .gw-vault-contract-diff-pane a{display:inline-block;margin-top:var(--gw-space-2)}
.gw-boards-contract-tab,.gw-boards-contract-tool,.gw-vault-contract-tool{min-height:var(--gw-tap-min);font:700 var(--gw-text-badge)/1.2 var(--gw-font);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-card-bg);color:var(--gw-text-secondary);padding:var(--gw-space-2) var(--gw-space-3)}
.gw-boards-contract-tab:disabled,.gw-boards-contract-tool:disabled,.gw-vault-contract-tool:disabled{cursor:not-allowed;opacity:.78}
.gw-boards-contract-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--gw-space-3)}
.gw-boards-contract-card{display:grid;gap:var(--gw-space-3);min-height:12rem;background:var(--gw-card-bg);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-4)}
.gw-boards-contract-card h3,.gw-boards-contract-detail h3,.gw-vault-contract-panel h3{margin:0}
.gw-boards-contract-card-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--gw-space-2);margin-top:auto}
.gw-boards-contract-card-metrics span{min-width:0;border:var(--gw-border-w) solid var(--gw-border-subtle);border-radius:var(--gw-radius);padding:var(--gw-space-2);text-align:center;font-size:var(--gw-text-xs);color:var(--gw-text-muted)}
.gw-boards-contract-detail-head{display:flex;gap:var(--gw-space-3);align-items:center;flex-wrap:wrap}
.gw-boards-contract-detail-head .gw-muted{margin-left:auto}
.gw-boards-contract-tools,.gw-vault-contract-tools{display:flex;gap:var(--gw-space-2);flex-wrap:wrap}
.gw-boards-contract-slots{display:grid;grid-template-columns:1.05fr 1.25fr 1fr;gap:var(--gw-space-3);align-items:start}
.gw-boards-contract-slot-stack,.gw-vault-contract-stack{display:grid;gap:var(--gw-space-3)}
.gw-boards-contract-gap{text-align:left;min-height:8.5rem;background:var(--gw-card-bg)}
.gw-boards-contract-advanced-layout{display:grid;gap:var(--gw-space-4);align-items:start}
.gw-vault-contract-toolbar{display:grid;grid-template-columns:minmax(220px,1.5fr) minmax(160px,.75fr) minmax(160px,.75fr);gap:var(--gw-space-3);align-items:end;background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-4)}
.gw-vault-contract-field{display:grid;gap:var(--gw-space-1);font:700 var(--gw-text-badge)/1.2 var(--gw-font);color:var(--gw-text-secondary)}
.gw-vault-contract-field input,.gw-vault-contract-field select{min-height:var(--gw-tap-min);width:100%;border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-card-bg);color:var(--gw-text-secondary);padding:var(--gw-space-2) var(--gw-space-3)}
.gw-vault-contract-toolbar-note{grid-column:1/-1;margin:0;color:var(--gw-text-muted);font-size:var(--gw-text-xs)}
.gw-vault-contract-stat-explainer{border-top:var(--gw-border-w) solid var(--gw-border-subtle);padding-top:var(--gw-space-2);font-size:var(--gw-text-xs);color:var(--gw-text-secondary)}
.gw-vault-contract-stat-explainer summary{cursor:pointer;font-weight:700;color:var(--gw-accent)}
.gw-vault-contract-advanced-layout{display:grid;grid-template-columns:minmax(220px,.72fr) minmax(340px,1.45fr) minmax(240px,.83fr);gap:var(--gw-space-4);align-items:start}
.gw-vault-contract-receipts{display:grid;gap:var(--gw-space-3)}
.gw-vault-contract-receipts[data-test="source-vault-list"]{grid-auto-flow:row;grid-auto-columns:auto;overflow-x:visible}
.gw-vault-contract-version-controls{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:var(--gw-space-2);align-items:end}
.gw-vault-contract-version-controls .gw-vault-contract-field{text-align:left}
.gw-vault-contract-diff-summary{display:flex;gap:var(--gw-space-2);align-items:center;flex-wrap:wrap;border:var(--gw-border-w) solid var(--gw-border-subtle);border-radius:var(--gw-radius);padding:var(--gw-space-3)}
.gw-vault-contract-diff{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gw-space-3)}
.gw-vault-contract-diff-pane{min-height:12rem;text-align:left;background:var(--gw-card-bg);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-4)}
.gw-vault-contract-ledger-row{display:flex;justify-content:space-between;gap:var(--gw-space-3);border-bottom:var(--gw-border-w) solid var(--gw-border-subtle);padding:var(--gw-space-2) 0;color:var(--gw-text-secondary)}
.gw-vault-contract-video-ladder{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--gw-space-2)}
.gw-vault-contract-video-ladder span{border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-2);text-align:center;font-size:var(--gw-text-xs);color:var(--gw-text-muted)}
.gw-vault-contract-manifest{display:grid;gap:var(--gw-space-2);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-3);background:var(--gw-card-bg)}
.gw-vault-contract-manifest code{overflow-wrap:anywhere;color:var(--gw-text-muted)}
[data-test="boards-simple-edition"] .gw-boards-contract-cards,[data-test="boards-simple-edition"] .gw-boards-contract-slots{grid-template-columns:1fr}
[data-test="boards-simple-edition"] .gw-boards-contract-card{min-height:0;border-radius:0;border-left:0;border-right:0}
[data-test="boards-simple-edition"] .gw-boards-contract-directory,[data-test="boards-simple-edition"] .gw-boards-contract-detail,[data-test="source-vault-simple-edition"] .gw-vault-contract-panel,[data-test="source-vault-simple-edition"] .gw-vault-contract-toolbar{border-radius:0;border-left:0;border-right:0;background:transparent}
[data-test="source-vault-simple-edition"] .gw-vault-contract-toolbar,[data-test="source-vault-simple-edition"] .gw-vault-contract-version-controls,[data-test="source-vault-simple-edition"] .gw-vault-contract-diff{grid-template-columns:1fr}
[data-test="source-vault-simple-edition"] .gw-vault-contract-toolbar-note{grid-column:auto}
@media(max-width:1000px){.gw-vault-contract-advanced-layout{grid-template-columns:1fr}.gw-boards-contract-slots{grid-template-columns:1fr 1fr}.gw-vault-contract-toolbar{grid-template-columns:1fr 1fr}.gw-vault-contract-toolbar-note{grid-column:1/-1}}
@media(max-width:640px){.gw-boards-contract-tabs,.gw-boards-contract-cards,.gw-boards-contract-slots,.gw-vault-contract-toolbar,.gw-vault-contract-version-controls,.gw-vault-contract-diff{grid-template-columns:1fr}.gw-vault-contract-toolbar-note{grid-column:auto}.gw-boards-contract-detail-head .gw-muted{margin-left:0;width:100%}.gw-vault-contract-video-ladder{grid-template-columns:1fr}}
`;

function ensureBoardsVaultFidelityStyle(): void {
  if (document.head.querySelector('[data-test="boards-vault-fidelity-style"]')) return;
  document.head.append(el('style', { 'data-test': 'boards-vault-fidelity-style' }, [BOARDS_VAULT_FIDELITY_STYLE]));
}

function topicContextCard(node: TopicTreeNode): HTMLElement {
  const aliases = node.topic.sourceAliases ?? [];
  return el('article', { class: 'gw-card', 'data-test': 'boards-topic-context-card', 'data-topic-id': node.topic.topic_id }, [
    el('p', { class: 'gw-muted' }, ['REVIEWED CIVIC TOPIC · not a government body profile']),
    el('h2', {}, [topicLabel(node)]),
    el('p', { class: 'gw-muted' }, [`Jurisdiction: ${node.topic.jurisdiction_id ?? 'not present'}`]),
    el('p', { class: 'gw-muted' }, [`Source aliases: ${aliases.length}`]),
    ...(aliases.length ? [el('ul', { 'data-test': 'boards-topic-aliases' }, aliases.map((alias) => {
      const locator = alias.sourceRef.locator;
      const locatorText = [
        locator?.timestampHuman,
        locator?.page == null ? '' : `page ${locator.page}`,
        locator?.section,
        locator?.paragraph,
        locator?.charStart == null || locator?.charEnd == null ? '' : `characters ${locator.charStart}–${locator.charEnd}`,
      ].filter(Boolean).join(' · ');
      return el('li', { 'data-test': 'boards-topic-alias' }, [
        el('strong', {}, [alias.term]),
        el('span', { class: 'gw-muted' }, [` · ${alias.aliasType.replace(/_/g, ' ')} · source ${alias.sourceRef.sourceId ?? 'not present'}`]),
        ...(locatorText ? [el('span', { class: 'gw-muted' }, [` · ${locatorText}`])] : []),
        ...(alias.sourceRef.originalUrl ? [el('a', { href: alias.sourceRef.originalUrl, target: '_blank', rel: 'noopener noreferrer' }, [' Open original'])] : []),
        ...(alias.sourceRef.archiveUrl ? [el('a', { href: alias.sourceRef.archiveUrl, target: '_blank', rel: 'noopener noreferrer' }, [' Open archive'])] : []),
      ]);
    }))] : []),
    el('a', { href: `#/timeline?search=${encodeURIComponent(topicLabel(node))}`, 'data-test': 'boards-topic-timeline-link' }, ['Find reviewed records in Timeline']),
  ]);
}

function boardContractGap(title: string, body: string, testId: string): HTMLElement {
  return el('section', { class: 'gw-state gw-boards-contract-gap', 'data-state': 'empty', 'data-test': testId, role: 'status' }, [
    el('h2', {}, [title]),
    el('p', {}, [body]),
  ]);
}

export function renderBoardsDirectory(root: HTMLElement, data: ReadApiResponse, query: URLSearchParams, notice?: string): void {
  const shell = pageShell(root, 'boards-directory-page', 'Boards directory', {
    notice,
    admitted: data.access === 'reviewer_internal',
    noteId: 'boards-overview',
  });
  if (data.access !== 'reviewer_internal') {
    shell.append(el('section', { class: 'gw-state', 'data-test': 'state-reviewer-gated', role: 'status' }, [
      el('h2', {}, ['Reviewer-internal only']),
      el('p', {}, ['The Boards directory renders no body detail outside the reviewer-internal lane.']),
    ]));
    return;
  }
  const tree = data.topic_tree?.tree;
  const nodes = tree ? flattenTopics(tree) : [];
  const directoryNote = (): HTMLElement => el('section', { class: 'gw-state', 'data-test': 'boards-directory-note', role: 'note' }, [
      el('h2', {}, ['Government body directory is not in this projection']),
      el('p', {}, [
        'The reviewed payload contains civic topics, not policy-cleared government body records. Topics are never relabelled as boards, and no cadence, member, or official-link value is inferred.',
      ]),
    ]);
  const jurisdictionLanes = [
    { level: 'town', label: 'Town boards', place: 'Alpine' },
    { level: 'county', label: 'County boards', place: 'Lincoln' },
    { level: 'state', label: 'State bodies', place: 'Wyoming' },
  ];
  const directoryGeometry = (): HTMLElement => el('section', {
    class: 'gw-boards-contract-directory',
    'data-test': 'boards-directory-geometry',
    'aria-label': 'Government body directory contract gaps',
  }, [
    noteRow(
      'About government body directory controls',
      ['boards-directory'],
      'boards-directory-info',
    ),
    el('div', { class: 'gw-boards-contract-tabs', role: 'group', 'aria-label': 'Unavailable government-level directory filters' },
      jurisdictionLanes.map((lane) => el('button', {
        type: 'button',
        class: 'gw-boards-contract-tab',
        'data-test': 'boards-jurisdiction-tab',
        'data-level': lane.level,
        'aria-disabled': 'true',
        disabled: '',
      }, [`${lane.label} · ${lane.place}`]))),
    el('section', {
      class: 'gw-boards-contract-cards',
      'data-state': 'empty',
      'data-test': 'boards-bodies-gap',
      role: 'status',
    }, jurisdictionLanes.map((lane) => el('article', {
      class: 'gw-boards-contract-card',
      'data-test': 'boards-body-card-gap',
      'data-level': lane.level,
    }, [
      el('p', { class: 'gw-muted' }, [`${lane.label.toLocaleUpperCase()} · ${lane.place}`]),
      el('h3', {}, ['Body record unavailable']),
      el('p', {}, ['A policy-cleared bodies projection must supply the official name before this directory card can be populated.']),
      el('div', { class: 'gw-boards-contract-card-metrics', 'aria-label': 'Unavailable body facts' }, [
        el('span', {}, ['Next meeting\nNot supplied']),
        el('span', {}, ['Active issues\nNot supplied']),
        el('span', {}, ['Changed docs\nNot supplied']),
      ]),
    ]))),
    boardContractGap(
      'Meeting cadence unavailable',
      'No body schedule, next-meeting, or cadence fields are present in the reviewed concept graph.',
      'boards-cadence-gap',
    ),
  ]);

  const detailGeometry = (): HTMLElement => el('section', {
    class: 'gw-boards-contract-detail',
    'data-test': 'boards-detail-geometry',
    'aria-label': 'Government body detail contract gaps',
  }, [
    noteRow(
      'About planned government body details',
      ['boards-body'],
      'boards-body-info',
    ),
    el('header', { class: 'gw-boards-contract-detail-head' }, [
      el('p', { class: 'gw-muted' }, ['BOARD DETAIL']),
      el('h2', {}, ['No policy-cleared body selected']),
      el('span', { class: 'gw-muted' }, ['Town · County · State']),
    ]),
    el('section', { 'data-state': 'empty', 'data-test': 'boards-links-gap', role: 'status' }, [
      el('h3', {}, ['Body action tools unavailable']),
      el('p', {}, ['No body-level identifier, official link, meeting route, or document route is supplied by the current contract.']),
      el('div', { class: 'gw-boards-contract-tools', 'data-test': 'boards-detail-tools' }, [
        el('button', { type: 'button', class: 'gw-boards-contract-tool', 'data-test': 'boards-detail-tool-fast-agenda', disabled: '' }, ['Fast agenda ›']),
        el('button', { type: 'button', class: 'gw-boards-contract-tool', 'data-test': 'boards-detail-tool-timeline', disabled: '' }, ['Board timeline ›']),
        el('button', { type: 'button', class: 'gw-boards-contract-tool', 'data-test': 'boards-detail-tool-documents', disabled: '' }, ['Documents ›']),
      ]),
    ]),
    el('div', { class: 'gw-boards-contract-slots' }, [
      boardContractGap(
        'Members and roles unavailable',
        'No policy-cleared member-name, role, term, or score rows are present in the reviewed payload.',
        'boards-members-gap',
      ),
      el('div', { class: 'gw-boards-contract-slot-stack' }, [
        boardContractGap(
          'Recent actions and votes unavailable',
          'No body-scoped action or vote records are connected to a reviewed government body.',
          'boards-actions-gap',
        ),
        boardContractGap(
          'Active issues before this body unavailable',
          'Reviewed civic topics remain separate below; none is inferred to be before a particular body.',
          'boards-issues-gap',
        ),
      ]),
      el('div', { class: 'gw-boards-contract-slot-stack' }, [
        boardContractGap(
          'Documents and proof unavailable',
          'Reviewed receipt metadata is not joined to a policy-cleared government body record.',
          'boards-proof-gap',
        ),
        boardContractGap(
          'Watch flags unavailable',
          'No body-scoped transparency-alert projection is connected, so no watch status is inferred.',
          'boards-watch-gap',
        ),
      ]),
    ]),
  ]);

  const requestedTopicId = query.get('id');
  const requestedTopicNotice = (): HTMLElement | null => {
    if (!requestedTopicId) return null;
    const selected = nodes.find((node) => node.topic.topic_id === requestedTopicId);
    return el('section', { class: 'gw-state', 'data-test': 'boards-topic-not-body', role: 'status' }, [
      el('h2', {}, ['Requested id is not a government body record']),
      el('p', {}, [selected
        ? `${topicLabel(selected)} is a reviewed civic topic. Use Timeline to inspect its source-backed records.`
        : 'The requested id is not present in the reviewed topic context.']),
      ...(selected ? [el('a', {
        href: `#/timeline?search=${encodeURIComponent(topicLabel(selected))}`,
      }, ['Open this topic in Timeline'])] : []),
    ]);
  };

  const topicContext = (): HTMLElement => el('section', { 'data-test': 'boards-topic-context' }, [
    headingWithInfo(
      el('h2', {}, ['Reviewed topic context']),
      'boards-topic',
      'boards-topic-info',
    ),
    el('p', { class: 'gw-muted' }, [
      'These source-backed topic labels help navigate reviewed records; they do not satisfy or replace the Boards directory contract.',
    ]),
    ...(nodes.length
      ? [el('div', { class: 'gw-board' }, nodes.map(topicContextCard))]
      : [boardContractGap('No reviewed topic context', 'The current projection supplied neither body records nor topic context.', 'boards-topic-context-gap')]),
  ]);

  ensureBaselinePageStyle();
  ensureBoardsVaultFidelityStyle();
  const mount = el('div', { class: 'gw-baseline-mode-mount', 'data-test': 'boards-mode-mount' });
  ((mode: PageMode) => {
    mount.setAttribute('data-mode', mode);
    const selectedNotice = requestedTopicNotice();
    if (mode === 'simple') {
      mount.replaceChildren(el('section', { class: 'gw-baseline-simple-sheet', 'data-test': 'boards-simple-edition' }, [
        el('header', { class: 'gw-baseline-simple-head' }, [
          el('p', {}, ['BOARDS · REVIEWED ALPINE EDITION']),
          el('h2', {}, ['Who meets, what is missing, and where topic records live']),
          el('p', {}, ['Plain-English directory status first; reviewed topic context follows without being relabelled as a government body.']),
        ]),
        directoryNote(),
        directoryGeometry(),
        ...(selectedNotice ? [selectedNotice] : []),
        topicContext(),
        detailGeometry(),
      ]));
      return;
    }
    mount.replaceChildren(el('section', { class: 'gw-baseline-advanced-workbench', 'data-test': 'boards-advanced-workbench' }, [
      el('header', { class: 'gw-baseline-workbench-head' }, [
        el('p', {}, ['BOARDS DIRECTORY · EVIDENCE WORKBENCH']),
        el('h2', {}, ['Body-contract gaps beside reviewed civic-topic context']),
      ]),
      directoryNote(),
      el('div', { class: 'gw-boards-contract-advanced-layout' }, [
        directoryGeometry(),
        detailGeometry(),
      ]),
      ...(selectedNotice ? [selectedNotice] : []),
      topicContext(),
    ]));
  })(readPageMode());
  shell.append(mount);
}

function statementTitle(record: StatementRecord): string {
  return record.statement_text?.slice(0, 96) || record.statement_id;
}

function readWatchIds(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function persistWatchIds(ids: Set<string>): void {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...ids].sort()));
  } catch {
    /* non-fatal: the in-DOM toggle state still reflects the click */
  }
}

function recordSourceSummary(record: StatementRecord): string {
  const first = record.evidence?.[0];
  return [first?.source_type, first?.published_by, first?.source_date].filter(Boolean).join(' · ') || 'Reviewed source metadata not present';
}

function watchToggle(record: StatementRecord, onChange?: () => void): HTMLElement {
  const button = el('button', { type: 'button', class: 'gw-view-tab', 'data-test': 'watch-toggle', 'data-id': record.statement_id });
  const sync = () => {
    const ids = readWatchIds();
    const watched = ids.has(record.statement_id);
    button.setAttribute('aria-pressed', String(watched));
    button.textContent = watched ? 'Watching locally' : 'Watch locally';
  };
  button.addEventListener('click', () => {
    const ids = readWatchIds();
    if (ids.has(record.statement_id)) ids.delete(record.statement_id);
    else ids.add(record.statement_id);
    persistWatchIds(ids);
    sync();
    onChange?.();
  });
  sync();
  return button;
}

function powerRosterEmpty(): HTMLElement {
  return el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'power-roster-empty', role: 'status' }, [
    el('h2', {}, ['No reviewed person or role roster yet']),
    el('p', {}, ['The reviewed Alpine projection does not include member-name or role rows, so this page stops at the evidence trail and does not invent people.']),
  ]);
}

export function renderPowerTracker(root: HTMLElement, data: ReadApiResponse, _query: URLSearchParams, notice?: string): void {
  const shell = pageShell(root, 'power-tracker-page', 'Power Tracker', {
    notice,
    admitted: data.access === 'reviewer_internal',
  });
  if (data.access !== 'reviewer_internal') {
    shell.append(el('section', { class: 'gw-state', 'data-test': 'state-reviewer-gated', role: 'status' }, [
      el('h2', {}, ['Reviewer-internal only']),
      el('p', {}, ['The Power Tracker renders no roster or records outside the reviewer-internal lane.']),
    ]));
    return;
  }

  shell.append(el('section', { class: 'gw-state', 'data-test': 'power-scope-note', role: 'note' }, [
    el('p', {}, ['Gated Alpine scaffold. It shows reviewed records and source trails only; no comparative tables or outcome judgments are computed here.']),
  ]));
  shell.append(powerRosterEmpty());

  const records = data.records ?? [];
  const mount = el('div', { 'data-test': 'power-mode-mount' });
  ((mode: PageMode) => {
    mount.replaceChildren();
    if (!records.length) {
      mount.append(el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'power-records-empty', role: 'status' }, [
        el('h2', {}, ['No reviewed Alpine records available']),
        el('p', {}, ['No records were fabricated for this view.']),
      ]));
      return;
    }
    const cards = records.map((record) => el('article', { class: 'gw-card', 'data-test': 'power-record', 'data-id': record.statement_id }, [
      el('p', { class: 'gw-muted' }, [`Record ${record.statement_id}`]),
      el('h2', {}, [statementTitle(record)]),
      el('div', { class: 'gw-badges' }, [
        el('span', { class: 'gw-badge gw-tone-neutral', 'data-test': 'power-status' }, [record.ui_status ?? 'status not present']),
        el('span', { class: 'gw-badge gw-tone-caution', 'data-test': 'power-verification' }, [record.verification_status ?? 'verification not present']),
      ]),
      el('p', { class: 'gw-muted', 'data-test': 'power-source' }, [recordSourceSummary(record)]),
      el('a', { href: `#/issue?id=${encodeURIComponent(record.statement_id)}`, 'data-test': 'power-record-link' }, ['Open record']),
      watchToggle(record),
      ...(mode === 'advanced' ? [evidenceMetaRows(record.evidence ?? [])] : []),
    ]));
    mount.append(el('div', { class: 'gw-board', 'data-test': mode === 'advanced' ? 'power-advanced-list' : 'power-simple-list' }, cards));
  })(readPageMode());
  shell.append(mount);
}

export function renderWatchlist(root: HTMLElement, data: ReadApiResponse, _query: URLSearchParams, notice?: string): void {
  const shell = pageShell(root, 'watchlist-page', 'Watchlist', {
    notice,
    admitted: data.access === 'reviewer_internal',
  });
  if (data.access !== 'reviewer_internal') {
    shell.append(el('section', { class: 'gw-state', 'data-test': 'state-reviewer-gated', role: 'status' }, [
      el('h2', {}, ['Reviewer-internal only']),
      el('p', {}, ['The Watchlist renders no local selections outside the reviewer-internal lane.']),
    ]));
    return;
  }
  shell.append(el('section', { class: 'gw-state', 'data-test': 'watchlist-local-note', role: 'note' }, [
    el('p', {}, ['Local-only watch toggles. No email, account sync, or alert settings are wired.']),
  ]));
  const mount = el('div', { 'data-test': 'watchlist-mount' });
  const renderList = () => {
    const ids = readWatchIds();
    const watched = (data.records ?? []).filter((record) => ids.has(record.statement_id));
    mount.replaceChildren();
    if (!watched.length) {
      mount.append(el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'watchlist-empty', role: 'status' }, [
        el('h2', {}, ['No local watch items yet']),
        el('p', {}, ['Use Power Tracker or the reviewed records below to add items on this device only.']),
      ]));
    } else {
      mount.append(el('div', { class: 'gw-board', 'data-test': 'watchlist-items' }, watched.map((record) =>
        el('article', { class: 'gw-card', 'data-test': 'watchlist-item', 'data-id': record.statement_id }, [
          el('h2', {}, [statementTitle(record)]),
          el('p', { class: 'gw-muted' }, [recordSourceSummary(record)]),
          el('a', { href: `#/issue?id=${encodeURIComponent(record.statement_id)}`, 'data-test': 'watchlist-record-link' }, ['Open record']),
          watchToggle(record, renderList),
        ]),
      )));
    }
    mount.append(el('details', { class: 'gw-drawer', 'data-test': 'watchlist-add-records' }, [
      el('summary', {}, ['Reviewed records available to watch']),
      el('div', { class: 'gw-board' }, (data.records ?? []).map((record) =>
        el('article', { class: 'gw-card', 'data-test': 'watchlist-candidate', 'data-id': record.statement_id }, [
          el('h3', {}, [statementTitle(record)]),
          watchToggle(record, renderList),
        ]),
      )),
    ]));
  };
  ((mode: PageMode) => {
    mount.setAttribute('data-mode', mode);
    renderList();
  })(readPageMode());
  shell.append(mount);
}

const COVERAGE = {
  state: 'Wyoming',
  county: 'Lincoln County',
  town: 'Alpine',
} as const;

export function renderLocation(root: HTMLElement, data: ReadApiResponse, query: URLSearchParams, notice?: string): void {
  const shell = pageShell(root, 'location-page', 'Location coverage', {
    notice,
    admitted: data.access === 'reviewer_internal',
  });
  if (data.access !== 'reviewer_internal') {
    shell.append(el('section', { class: 'gw-state', 'data-test': 'state-reviewer-gated', role: 'status' }, [
      el('h2', {}, ['Reviewer-internal only']),
      el('p', {}, ['The Location page renders no coverage details outside the reviewer-internal lane.']),
    ]));
    return;
  }
  const state = query.get('state') || COVERAGE.state;
  const county = query.get('county') || COVERAGE.county;
  const town = query.get('town') || COVERAGE.town;
  const covered = state === COVERAGE.state && county === COVERAGE.county && town === COVERAGE.town;
  const records = data.records ?? [];
  shell.append(el('section', { class: 'gw-state', 'data-test': 'location-scope-note', role: 'note' }, [
    el('p', {}, ['Static Alpine coverage picker. No geographic analysis map, waitlist form, or notification signup is wired.']),
  ]));
  shell.append(el('nav', { class: 'gw-view-toggle', 'data-test': 'location-picker', 'aria-label': 'Coverage picker' }, [
    el('a', { class: 'gw-view-tab', href: '#/location?state=Wyoming&county=Lincoln%20County&town=Alpine', 'data-test': 'location-alpine-link' }, ['Wyoming → Lincoln County → Alpine']),
    el('a', { class: 'gw-view-tab', href: '#/location?state=Wyoming&county=Teton%20County&town=Jackson', 'data-test': 'location-uncovered-link' }, ['Other Wyoming town']),
  ]));
  shell.append(el('section', { class: 'gw-card', 'data-test': covered ? 'location-covered' : 'location-not-covered' }, [
    el('h2', {}, [covered ? 'Alpine is covered in this reviewer build' : 'Not covered yet']),
    el('p', { class: 'gw-muted' }, [`Selected: ${state} → ${county} → ${town}`]),
    el('p', {}, [covered ? `This page can show ${records.length} reviewed Alpine record(s) from the existing projection.` : 'No records are shown for this location until reviewed coverage exists.']),
  ]));
  if (covered) {
    shell.append(el('div', { class: 'gw-board', 'data-test': 'location-records' }, records.map((record) =>
      el('article', { class: 'gw-card', 'data-test': 'location-record', 'data-id': record.statement_id }, [
        el('h3', {}, [statementTitle(record)]),
        el('p', { class: 'gw-muted' }, [recordSourceSummary(record)]),
        el('a', { href: `#/issue?id=${encodeURIComponent(record.statement_id)}`, 'data-test': 'location-record-link' }, ['Open record']),
      ]),
    )));
  }
}
function renderIssueDossierCard(record: StatementRecord): HTMLElement {
  const provenance = provenanceBadge(record);
  const confidenceClass = confidenceLabel(record);
  const trustBadges: HTMLElement[] = [
    el('span', { class: 'gw-badge gw-tone-neutral', 'data-test': 'issue-status' }, [`Status: ${trustLabel(record)}`]),
    el('span', { class: 'gw-badge gw-tone-caution', 'data-test': 'issue-verification' }, [`Verification: ${verificationStatusLabel(record.verification_status) ?? 'unavailable'}`]),
    el('span', { class: 'gw-badge gw-tone-caution', 'data-test': 'issue-publication' }, [`Publication: ${record.publication_state?.replace(/_/g, ' ') ?? 'unavailable'}`]),
    el('span', { class: 'gw-badge gw-tone-neutral', 'data-test': 'issue-correction' }, [`Correction: ${correctionStatusLabel(record.correction_status) ?? 'unavailable'}`]),
    el('span', { class: 'gw-badge gw-tone-caution', 'data-test': 'issue-source-changed' }, [`Source changed: ${record.source_changed == null ? 'unavailable' : record.source_changed ? 'yes' : 'no'}`]),
    el('span', {
      class: `gw-badge gw-tone-${provenance.tone}`,
      'data-test': 'issue-provenance',
      title: provenance.description,
    }, [`${provenance.icon} Provenance: ${provenance.label}`]),
    el('span', { class: 'gw-badge gw-tone-neutral', 'data-test': 'issue-produced-by' }, [`Produced by: ${record.produced_by ?? 'unavailable'}`]),
  ];
  if (record.confidence != null && record.confidence !== '') {
    trustBadges.push(el('span', { class: 'gw-badge gw-tone-neutral', 'data-test': 'issue-confidence' }, [`Confidence: ${record.confidence}`]));
  }
  if (confidenceClass) {
    trustBadges.push(el('span', { class: 'gw-badge gw-tone-neutral', 'data-test': 'issue-confidence-label' }, [`Confidence class: ${confidenceClass}`]));
  }
  if (record.confidence == null && !confidenceClass) {
    trustBadges.push(el('span', { class: 'gw-badge gw-tone-caution', 'data-test': 'issue-confidence-gap' }, ['Confidence: unavailable']));
  }
  return el('article', { class: 'gw-card', 'data-test': 'issue-dossier-card', 'data-id': record.statement_id }, [
    el('p', { class: 'gw-muted' }, [`Record ${record.statement_id}`]),
    headingWithInfo(
      el('h2', { 'data-test': 'issue-title' }, [statementTitle(record)]),
      'issue-trust',
      'issue-trust-info',
    ),
    el('div', { class: 'gw-badges', 'data-test': 'issue-trust-bundle' }, trustBadges),
    el('p', { class: 'gw-muted', 'data-test': 'issue-speaker' }, [record.speaker_label ?? 'Speaker label not present']),
    el('p', { 'data-test': 'issue-statement' }, [record.statement_text ?? 'Statement text not present in reviewed projection.']),
  ]);
}

function evidenceMetaRows(evidence: EvidenceLink[]): HTMLElement {
  if (!evidence.length) {
    return el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'issue-proof-empty', role: 'status' }, [
      el('h2', {}, ['No source trail in this record']),
      el('p', {}, ['The reviewed projection did not include source metadata for this record.']),
    ]);
  }
  return el('div', { class: 'gw-board', 'data-test': 'issue-proof-rail' }, evidence.map((entry, index) => {
    const locator = [
      entry.locator_kind,
      entry.page == null ? '' : `page ${entry.page}`,
      entry.section,
      entry.paragraph,
      entry.timestamp_human,
    ].filter(Boolean).join(' · ');
    const labels = [
      entry.relation ? `Relation: ${entry.relation}` : '',
      entry.verification_status ? `Verification: ${verificationStatusLabel(entry.verification_status)}` : '',
      entry.correction_status ? `Correction: ${correctionStatusLabel(entry.correction_status)}` : '',
      entry.confidence ? `Confidence: ${entry.confidence}` : '',
      entry.archive_status ? `Archive: ${entry.archive_status}` : '',
      entry.layer ? `Layer: ${entry.layer}` : '',
    ].filter(Boolean);
    const links = [
      ['original', 'Open original', entry.original_url],
      ['archive', 'Open archive', entry.archive_url],
      ['final', 'Open final source', entry.final_url],
      ['source', 'Open supplied source', entry.url],
    ].filter((item): item is [string, string, string] => Boolean(item[2]))
      .filter((item, itemIndex, items) => items.findIndex((candidate) => candidate[2] === item[2]) === itemIndex);
    return el('article', { class: 'gw-card', 'data-test': 'proof-source', 'data-source-id': entry.to_source_id ?? `source-${index + 1}` }, [
      el('h3', {}, [entry.to_source_id ?? `Source ${index + 1}`]),
      el('p', { class: 'gw-muted' }, [[entry.source_type, entry.published_by, entry.jurisdiction].filter(Boolean).join(' · ') || 'Source metadata not present']),
      el('p', { class: 'gw-muted' }, [`Source date: ${entry.source_date ?? 'not present'}${locator ? ` · ${locator}` : ''}`]),
      ...(labels.length ? [el('p', { class: 'gw-muted', 'data-test': 'proof-source-labels' }, [labels.join(' · ')])] : []),
      ...links.map(([kind, label, url]) => el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'proof-source-link', 'data-link-kind': kind }, [label])),
    ]);
  }));
}

export function renderIssueDetail(root: HTMLElement, data: ReadApiResponse, query: URLSearchParams, notice?: string): void {
  const shell = pageShell(root, 'issue-detail-page', 'Issue detail', {
    notice,
    admitted: data.access === 'reviewer_internal',
    noteId: 'issue-overview',
  });
  if (data.access !== 'reviewer_internal') {
    shell.append(el('section', { class: 'gw-state', 'data-test': 'state-reviewer-gated', role: 'status' }, [
      el('h2', {}, ['Reviewer-internal only']),
      el('p', {}, ['The issue detail page renders no record outside the reviewer-internal lane.']),
    ]));
    return;
  }
  const records = data.records ?? [];
  const id = query.get('id') ?? records[0]?.statement_id;
  const record = records.find((r) => r.statement_id === id);
  if (!record) {
    shell.append(el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'issue-missing', role: 'status' }, [
      headingWithInfo(
        el('h2', {}, ['Reviewed record not found']),
        'issue-missing',
        'issue-missing-info',
      ),
      el('p', {}, ['No dossier was fabricated for the requested id.']),
    ]));
    return;
  }
  const mount = el('div', { 'data-test': 'issue-mode-mount' });
  ((mode: PageMode) => {
    mount.setAttribute('data-mode', mode);
    mount.replaceChildren(
      renderIssueDossierCard(record),
      noteRow(
        'About Issue evidence and source locators',
        ['issue-proof'],
        'issue-proof-info',
      ),
      evidenceMetaRows(record.evidence ?? []),
    );
  })(readPageMode());
  shell.append(mount);
}

function collectSources(data: ReadApiResponse): EvidenceLink[] {
  const byKey = new Map<string, EvidenceLink>();
  for (const record of data.records ?? []) {
    for (const source of record.evidence ?? []) {
      const key = source.to_source_id ?? source.original_url ?? source.archive_url ?? `${record.statement_id}:${byKey.size}`;
      if (!byKey.has(key)) byKey.set(key, source);
    }
  }
  return [...byKey.values()];
}

/**
 * GOV-1566 F2 — reviewed supplied-file source drawer. Consumes the B6 web-safe
 * projection ONLY. Renders an honest empty state when B6 is not wired (no
 * projection), the reviewed files grouped by their meeting tie when present, and
 * a content-free "N pending review" notice — pending/held files never render any
 * content. Every file here is `web_safe` by construction (B6 filters server-side).
 */
export function renderSuppliedFiles(
  projection: SuppliedFilesProjection | null | undefined,
  query: URLSearchParams,
): HTMLElement {
  const section = el('section', {
    class: 'gw-vault-contract-panel',
    'data-test': 'supplied-files',
    'aria-label': 'Reviewed supplied source files',
  }, [
    el('p', { class: 'gw-muted' }, ['SUPPLIED SOURCE FILES · REVIEWED ONLY']),
  ]);

  // B6 not wired yet ⇒ honest empty panel, consistent with the page's other
  // not-yet-connected contract slots. No file rows are ever invented.
  if (!projection) {
    section.append(
      el('h2', {}, ['Supplied-file intake not wired yet']),
      el('p', {}, ['Reviewed supplied files will appear here, tied to their meeting, once the web-safe intake projection is connected. No file rows are shown until then.']),
    );
    section.setAttribute('data-state', 'empty');
    return section;
  }

  const groups = groupSuppliedFilesByMeeting(projection);
  const pending = pendingReviewNotice(projection);

  if (!groups.length) {
    section.append(
      el('h2', {}, ['No reviewed supplied files yet']),
      el('p', {}, ['No reviewed files are tied to a meeting yet. Nothing is invented for this slot.']),
    );
    section.setAttribute('data-state', 'empty');
  } else {
    section.append(el('h2', {}, ['Reviewed files by meeting']));
    for (const group of groups) {
      section.append(el('div', {
        class: 'gw-supplied-files-group',
        'data-test': 'supplied-files-group',
        'data-meeting-id': group.meetingId ?? 'untied',
      }, [
        el('p', { class: 'gw-muted' }, [group.meetingId ? `Meeting ${group.meetingId}` : 'Not tied to a meeting']),
        ...group.files.map((file) => suppliedFileCard(file)),
      ]));
    }
  }

  // Content-free pending placeholder — count only, never a filename/uploader.
  if (pending) {
    section.append(el('p', {
      class: 'gw-muted',
      'data-test': 'supplied-files-pending',
      role: 'status',
    }, [pending]));
  }

  if (query.get('demo') === 'sample') {
    section.setAttribute('data-demo', 'sample');
  }
  return section;
}

/** One reviewed file rendered as a source-drawer card (present-only metadata). */
function suppliedFileCard(file: SuppliedSourceFile): HTMLElement {
  const meta = suppliedFileMeta(file);
  // GOV-1609 §4.2 — display-safety: only auto-linkify a provenance URL that
  // actually parses as http(s). Prose that landed in a URL-named field renders
  // as no link, never a bare/broken hyperlink.
  const originalHref = safeHttpUrl(file.original_url);
  const archiveHref = safeHttpUrl(file.archive_url);
  return el('article', {
    class: 'gw-card',
    'data-test': 'supplied-file-row',
    'data-file-id': file.file_id,
    ...(file.agenda_item_id ? { 'data-agenda-item-id': file.agenda_item_id } : {}),
  }, [
    el('h3', {}, [file.title]),
    ...meta.map((row) => el('p', { class: 'gw-muted', 'data-test': `supplied-file-${row.key}` }, [`${row.label}: ${row.value}`])),
    ...(originalHref ? [el('a', { href: originalHref, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'supplied-file-original' }, ['View reviewed file ↗'])] : []),
    ...(archiveHref ? [el('a', { href: archiveHref, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'supplied-file-archive' }, ['Archived copy ↗'])] : []),
  ]);
}

/**
 * GOV-1566 F3 — before/after supersede view. Consumes the B6 web-safe supersede
 * projection ONLY (built from a B5 supersede mark). Reuses the vault's existing
 * two-pane comparison layout (`.gw-vault-contract-diff`) for the before/after
 * panes. Honest empty when the projection is not wired. Fail-closed on the
 * "after" side: while re-review is in flight the new version is NOT web_safe and
 * its content is absent, so we render the before pane + a content-free
 * reprocessing status instead of inventing the not-yet-reviewed new version.
 */
export function renderSupersedeView(
  projection: SupersedeProjection | null | undefined,
  query: URLSearchParams,
): HTMLElement {
  const section = el('section', {
    class: 'gw-vault-contract-panel',
    'data-test': 'supersede-view',
    'aria-label': 'Superseded source files — before / after',
  }, [
    el('p', { class: 'gw-muted' }, ['SUPERSEDED FILES · BEFORE / AFTER · REVIEWED ONLY']),
  ]);

  // B6 not wired yet ⇒ honest empty panel. No supersede rows are ever invented.
  if (!projection) {
    section.append(
      el('h2', {}, ['Supersede intake not wired yet']),
      el('p', {}, ['When a supplied file is superseded, the before/after comparison and reprocessing status will appear here once the web-safe supersede projection is connected. Nothing is shown until then.']),
    );
    section.setAttribute('data-state', 'empty');
    return section;
  }

  const events = projection.events ?? [];
  if (!events.length) {
    section.append(
      el('h2', {}, ['No superseded files yet']),
      el('p', {}, ['No supplied file has been superseded. Nothing is invented for this slot.']),
    );
    section.setAttribute('data-state', 'empty');
  } else {
    section.append(el('h2', {}, ['Superseded files']));
    for (const event of events) {
      section.append(supersedeCard(event));
    }
  }

  if (query.get('demo') === 'sample') {
    section.setAttribute('data-demo', 'sample');
  }
  return section;
}

/** One supersede event as a red-flag before/after card + reprocessing status. */
function supersedeCard(event: SupersedeEvent): HTMLElement {
  const flag = supersedeFlagLabel(event);
  const reprocessing = reprocessingNotice(event);
  const cleared = hasClearedAfter(event);

  const beforePane = el('article', {
    class: 'gw-vault-contract-diff-pane',
    'data-test': 'supersede-before',
  }, [
    el('p', { class: 'gw-muted' }, ['BEFORE · SUPERSEDED']),
    el('h3', {}, [event.before?.title ?? 'Superseded file']),
    ...supersedeSideRows(event.before).map((row) =>
      el('p', { class: 'gw-muted', 'data-test': `supersede-before-${row.key}` }, [`${row.label}: ${row.value}`])),
    ...(event.before?.original_url
      ? [el('a', { href: event.before.original_url, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'supersede-before-link' }, ['View superseded file ↗'])]
      : []),
  ]);

  // Fail-closed after pane: only render the new version's content when it is
  // itself web_safe (present in the projection). Otherwise an honest hold note.
  const afterPane = cleared
    ? el('article', {
        class: 'gw-vault-contract-diff-pane',
        'data-test': 'supersede-after',
        'data-state': 'cleared',
      }, [
        el('p', { class: 'gw-muted' }, ['AFTER · CURRENT REVIEWED VERSION']),
        el('h3', {}, [event.after?.title ?? 'Current reviewed version']),
        ...supersedeSideRows(event.after).map((row) =>
          el('p', { class: 'gw-muted', 'data-test': `supersede-after-${row.key}` }, [`${row.label}: ${row.value}`])),
        ...(event.after?.original_url
          ? [el('a', { href: event.after.original_url, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'supersede-after-link' }, ['View current file ↗'])]
          : []),
      ])
    : el('article', {
        class: 'gw-vault-contract-diff-pane',
        'data-test': 'supersede-after',
        'data-state': 'pending',
      }, [
        el('p', { class: 'gw-muted' }, ['AFTER · IN RE-REVIEW']),
        el('h3', {}, ['New version not shown until re-review completes']),
        el('p', {}, ['The superseding version is preserved but is not yet independently reviewed, so its content is not shown here.']),
      ]);

  return el('article', {
    class: 'gw-card gw-supersede-card',
    'data-test': 'supersede-row',
    'data-supersede-id': event.supersede_id,
    'data-version-group-id': event.version_group_id,
    ...(event.flagged ? { 'data-flagged': 'true' } : {}),
    ...(event.before?.agenda_item_id ? { 'data-agenda-item-id': event.before.agenda_item_id } : {}),
  }, [
    ...(flag ? [el('p', { class: 'gw-supersede-flag', 'data-test': 'supersede-flag', role: 'alert' }, [`⚑ ${flag}`])] : []),
    el('div', { class: 'gw-vault-contract-diff', 'data-test': 'supersede-panes' }, [beforePane, afterPane]),
    ...(reprocessing ? [el('p', { class: 'gw-muted', 'data-test': 'supersede-reprocessing', role: 'status' }, [reprocessing])] : []),
  ]);
}

export function renderSourceVault(root: HTMLElement, data: ReadApiResponse, query: URLSearchParams, notice?: string, suppliedFiles?: SuppliedFilesProjection | null, supersedes?: SupersedeProjection | null): void {
  const shell = pageShell(root, 'source-vault-page', 'Source vault', {
    notice,
    fixture: query.get('demo') === 'sample',
    admitted: data.access === 'reviewer_internal',
    noteId: 'vault-overview',
  });
  if (data.access !== 'reviewer_internal') {
    shell.append(el('section', { class: 'gw-state', 'data-test': 'state-reviewer-gated', role: 'status' }, [
      el('h2', {}, ['Reviewer-internal only']),
      el('p', {}, ['The Source Vault renders no source rows outside the reviewer-internal lane.']),
    ]));
    return;
  }
  const sources = collectSources(data);
  const originalLinkCount = sources.filter((source) => Boolean(source.original_url)).length;
  const archiveLinkCount = sources.filter((source) => Boolean(source.archive_url)).length;
  const statExplainer = (body: string): HTMLElement => el('details', {
    class: 'gw-vault-contract-stat-explainer',
    'data-test': 'source-stat-explainer',
  }, [
    el('summary', {}, ['What this stat means']),
    el('p', {}, [body]),
  ]);
  const overview = (): HTMLElement => el('section', { class: 'gw-board', 'data-test': 'source-vault-overview', 'aria-label': 'Source Vault overview' }, [
      el('article', { class: 'gw-card', 'data-test': 'source-reviewed-count' }, [
        el('p', { class: 'gw-muted' }, ['REVIEWED SOURCE METADATA']),
        headingWithInfo(
          el('h2', {}, [String(sources.length)]),
          'vault-source-count',
          'source-count-info',
        ),
        el('p', {}, [`Unique source row${sources.length === 1 ? '' : 's'} exposed by the current reviewed statement receipts.`]),
        statExplainer('This is a deduplicated count of source metadata linked by the reviewed statement receipts on this page. It is not a count of every file in a full source registry.'),
      ]),
      el('article', { class: 'gw-card', 'data-test': 'source-hash-gap' }, [
        el('p', { class: 'gw-muted' }, ['HASH VERIFICATION']),
        el('h2', {}, ['Unavailable']),
        el('p', {}, ['The web-safe payload supplies no source-registry hash status or reviewed verification percentage.']),
        statExplainer('A reviewed registry would need to supply both the manifest population and verification results before a percentage could be shown.'),
      ]),
      el('article', { class: 'gw-card', 'data-test': 'source-flags-gap' }, [
        el('p', { class: 'gw-muted' }, ['OPEN TRANSPARENCY FLAGS']),
        el('h2', {}, ['Unavailable']),
        el('p', {}, ['No transparency-alert projection is connected, so no flag count is inferred from statement status.']),
        statExplainer('This slot counts only policy-cleared transparency flags when an alert projection is connected; statement status is not used as a substitute.'),
      ]),
    ]);

  const vaultToolbar = (): HTMLElement => el('section', {
    class: 'gw-vault-contract-toolbar',
    'data-test': 'source-vault-tools',
    'aria-label': 'Source Vault search and filters',
  }, [
    noteRow(
      'About Source Vault search and filters',
      ['vault-filters'],
      'source-vault-filter-info',
    ),
    el('label', { class: 'gw-vault-contract-field' }, [
      'Search vault',
      el('input', {
        type: 'search',
        placeholder: 'Search reviewed source registry',
        'data-test': 'source-vault-search',
        disabled: '',
      }),
    ]),
    el('label', { class: 'gw-vault-contract-field' }, [
      'Source type',
      el('select', { 'data-test': 'source-vault-type-filter', disabled: '' }, [
        el('option', { value: '' }, ['All source types']),
      ]),
    ]),
    el('label', { class: 'gw-vault-contract-field' }, [
      'Government level',
      el('select', { 'data-test': 'source-vault-level-filter', disabled: '' }, [
        el('option', { value: '' }, ['Town · County · State']),
      ]),
    ]),
    el('p', { class: 'gw-vault-contract-toolbar-note', 'data-test': 'source-vault-filter-gap', role: 'status' }, [
      'Full-vault search and registry filters stay disabled until a reviewed source-registry index defines the searchable population and filter facets.',
    ]),
  ]);

  const sourceContent = (): HTMLElement => {
    if (!sources.length) {
      return el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'source-vault-empty', role: 'status' }, [
        headingWithInfo(
          el('h2', {}, ['No reviewed source metadata yet']),
          'vault-source-rows',
          'source-vault-row-info',
        ),
        el('p', {}, ['No rows were invented for the vault.']),
      ]);
    }
    return el('section', { class: 'gw-vault-contract-stack', 'data-test': 'source-vault-content' }, [
      noteRow(
        'About Source Vault receipt rows',
        ['vault-source-rows'],
        'source-vault-row-info',
      ),
      el('div', { class: 'gw-board gw-vault-contract-receipts', 'data-test': 'source-vault-list' }, sources.map((source, index) =>
        el('article', { class: 'gw-card', 'data-test': 'source-vault-row', 'data-source-id': source.to_source_id ?? `source-${index + 1}` }, [
          el('h2', {}, [source.to_source_id ?? `Source ${index + 1}`]),
          el('p', { class: 'gw-muted' }, [[source.source_type, source.published_by, source.jurisdiction].filter(Boolean).join(' · ') || 'Metadata not present']),
          el('p', { class: 'gw-muted' }, [`Date: ${source.source_date ?? 'not present'}`]),
          el('p', { class: 'gw-muted' }, [`Validation: ${source.last_validated_utc ?? source.scan_date ?? 'not present'}`]),
          ...(source.original_url ? [el('a', { href: source.original_url, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'vault-original' }, ['Original'])] : []),
          ...(source.archive_url ? [el('a', { href: source.archive_url, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'vault-archive' }, ['Archive'])] : []),
        ]),
      )),
    ]);
  };

  const versionCompare = (): HTMLElement => el('section', {
    class: 'gw-vault-contract-panel',
    'data-state': 'empty',
    'data-test': 'source-version-compare-empty',
  }, [
    el('header', {}, [
      el('p', { class: 'gw-muted' }, ['DOCUMENT VERSION COMPARE · DETERMINISTIC DIFF SLOT']),
      headingWithInfo(
        el('h2', {}, ['Document version compare not wired yet']),
        'vault-diff',
        'source-vault-diff-info',
      ),
      el('p', {}, ['The baseline deterministic v1/v2 comparison stays unavailable until a reviewed source-versions projection supplies both document versions and a web-safe diff.']),
    ]),
    el('div', { class: 'gw-vault-contract-version-controls', 'data-test': 'source-version-selectors' }, [
      el('label', { class: 'gw-vault-contract-field' }, [
        'First reviewed version',
        el('select', { 'data-test': 'source-version-select-first', disabled: '' }, [
          el('option', { value: '' }, ['No reviewed version supplied']),
        ]),
      ]),
      el('strong', { class: 'gw-muted' }, ['vs']),
      el('label', { class: 'gw-vault-contract-field' }, [
        'Second reviewed version',
        el('select', { 'data-test': 'source-version-select-second', disabled: '' }, [
          el('option', { value: '' }, ['No reviewed version supplied']),
        ]),
      ]),
    ]),
    el('div', { class: 'gw-vault-contract-diff-summary', 'data-test': 'source-diff-summary-gap' }, [
      el('strong', {}, ['DIFF SUMMARY']),
      el('span', { class: 'gw-muted' }, ['Added text: unavailable']),
      el('span', { class: 'gw-muted' }, ['Updated tables: unavailable']),
      el('button', {
        type: 'button',
        class: 'gw-vault-contract-tool',
        'data-test': 'source-word-diff-tool',
        'aria-pressed': 'false',
        disabled: '',
      }, ['Word-level diff']),
    ]),
    el('div', { class: 'gw-vault-contract-diff', 'data-test': 'source-diff-panes' }, [
      el('article', { class: 'gw-vault-contract-diff-pane', 'data-test': 'source-version-pane-first' }, [
        el('p', { class: 'gw-muted' }, ['VERSION 1 · AS FIRST POSTED']),
        el('h3', {}, ['Reviewed document copy unavailable']),
        el('p', {}, ['No first-version document text or page locator is supplied.']),
      ]),
      el('article', { class: 'gw-vault-contract-diff-pane', 'data-test': 'source-version-pane-second' }, [
        el('p', { class: 'gw-muted' }, ['VERSION 2 · CURRENT']),
        el('h3', {}, ['Reviewed document copy unavailable']),
        el('p', {}, ['No second-version document text or page locator is supplied.']),
      ]),
    ]),
    el('div', { class: 'gw-vault-contract-tools', 'data-test': 'source-diff-tools' }, [
      el('button', { type: 'button', class: 'gw-vault-contract-tool', disabled: '' }, ['View copy · v1 ↗']),
      el('button', { type: 'button', class: 'gw-vault-contract-tool', disabled: '' }, ['View copy · v2 ↗']),
      el('button', { type: 'button', class: 'gw-vault-contract-tool', disabled: '' }, ['View change log']),
    ]),
  ]);

  const ledgerPanel = (): HTMLElement => el('section', {
    class: 'gw-vault-contract-panel',
    'data-state': 'empty',
    'data-test': 'source-ledger-empty',
  }, [
    el('p', { class: 'gw-muted' }, ['VAULT LEDGER · LATEST']),
    headingWithInfo(
      el('h2', {}, ['Ledger history not wired yet']),
      'vault-ledger',
      'source-vault-ledger-info',
    ),
    el('p', {}, ['The current reviewed payload has source metadata, but no ledger-change projection.']),
    el('div', { 'data-test': 'source-ledger-geometry' }, [
      el('div', { class: 'gw-vault-contract-ledger-row' }, [el('strong', {}, ['First seen']), el('span', {}, ['Not supplied'])]),
      el('div', { class: 'gw-vault-contract-ledger-row' }, [el('strong', {}, ['Version history']), el('span', {}, ['Not supplied'])]),
      el('div', { class: 'gw-vault-contract-ledger-row' }, [el('strong', {}, ['Manifest hash']), el('span', {}, ['Not supplied'])]),
    ]),
    el('button', { type: 'button', class: 'gw-vault-contract-tool', 'data-test': 'source-ledger-tool', disabled: '' }, ['Browse full ledger']),
  ]);

  const videoPanel = (): HTMLElement => el('section', {
    class: 'gw-vault-contract-panel',
    'data-state': 'empty',
    'data-test': 'source-video-status-empty',
  }, [
    el('p', { class: 'gw-muted' }, ['VIDEO RELEASE · TRANSCRIPT STATUS']),
    headingWithInfo(
      el('h2', {}, ['Video release and transcript status not wired yet']),
      'vault-video',
      'source-vault-video-info',
    ),
    el('div', { class: 'gw-vault-contract-video-ladder', 'data-test': 'source-video-ladder' }, [
      el('span', {}, ['Pending release']),
      el('span', {}, ['Pending transcript']),
      el('span', {}, ['Missing video']),
    ]),
    el('p', {}, ['No reviewed video-status ladder is supplied. These states are geometry only and are not inferred from a source date.']),
  ]);

  const alertsPanel = (): HTMLElement => el('section', {
    class: 'gw-vault-contract-panel',
    'data-state': 'empty',
    'data-test': 'source-alerts-empty',
  }, [
    el('p', { class: 'gw-muted' }, ['TRANSPARENCY ALERTS']),
    headingWithInfo(
      el('h2', {}, ['Transparency alerts not wired yet']),
      'vault-transparency',
      'source-vault-transparency-info',
    ),
    el('p', {}, ['No live alert generation is performed on this page.']),
    el('button', { type: 'button', class: 'gw-vault-contract-tool', 'data-test': 'source-alerts-tool', disabled: '' }, ['Browse open and cleared flags']),
  ]);

  const verificationDetails = (): HTMLElement => el('section', { class: 'gw-vault-contract-panel', 'data-test': 'source-verification-details' }, [
      el('p', { class: 'gw-muted' }, ['VERIFICATION DETAILS']),
      headingWithInfo(
        el('h2', {}, ['Verification details']),
        'vault-verification',
        'source-vault-verification-info',
      ),
      el('p', {}, [
        `${originalLinkCount} original link${originalLinkCount === 1 ? '' : 's'} and ${archiveLinkCount} archive link${archiveLinkCount === 1 ? '' : 's'} are present in the reviewed receipt metadata. Link presence alone does not establish freshness, third-party preservation, or hash verification.`,
      ]),
      el('div', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'source-third-party-verification-empty', role: 'status' }, [
        el('h3', {}, ['Third-party verification unavailable']),
        el('p', {}, ['A source-registry verification contract must supply archive-provider and validation results before this slot can make a verification claim.']),
      ]),
      el('div', { class: 'gw-vault-contract-manifest', 'data-state': 'empty', 'data-test': 'source-manifest-empty' }, [
        el('strong', {}, ['MANIFEST HASH · SHA-256']),
        el('code', {}, ['Unavailable — no reviewed manifest hash is supplied']),
        el('p', {}, ['A full manifest cannot be offered until its reviewed file population and hashes are present in the source-registry contract.']),
      ]),
      el('div', { class: 'gw-vault-contract-tools', 'data-test': 'source-verification-tools' }, [
        el('button', { type: 'button', class: 'gw-vault-contract-tool', disabled: '' }, ['Verify archive snapshot']),
        el('button', { type: 'button', class: 'gw-vault-contract-tool', disabled: '' }, ['Recompute SHA-256']),
        el('button', { type: 'button', class: 'gw-vault-contract-tool', 'data-test': 'source-manifest-tool', disabled: '' }, ['View full manifest ↗']),
      ]),
    ]);

  const packetDiff = (): HTMLElement | null => query.get('demo') === 'sample'
    ? el('section', { class: 'gw-state', 'data-test': 'packet-diff-demo', role: 'note' }, [
        el('h2', {}, ['Packet diff demo fixture']),
        el('p', {}, ['Sample-only packet-diff placeholder for visual review; not real Alpine data.']),
      ])
    : null;

  const suppliedFilesSection = (): HTMLElement => renderSuppliedFiles(suppliedFiles, query);

  const supersedeSection = (): HTMLElement => renderSupersedeView(supersedes, query);

  ensureBaselinePageStyle();
  ensureBoardsVaultFidelityStyle();
  const mount = el('div', { class: 'gw-baseline-mode-mount', 'data-test': 'source-vault-mode-mount' });
  ((mode: PageMode) => {
    mount.setAttribute('data-mode', mode);
    const demo = packetDiff();
    if (mode === 'simple') {
      mount.replaceChildren(el('section', { class: 'gw-baseline-simple-sheet', 'data-test': 'source-vault-simple-edition' }, [
        el('header', { class: 'gw-baseline-simple-head' }, [
          el('p', {}, ['SOURCE VAULT · REVIEWED RECEIPTS']),
          el('h2', {}, ['What the reviewed record can prove—and what still needs a source contract']),
          el('p', {}, ['Source rows and honest verification gaps in a single reading column.']),
        ]),
        vaultToolbar(),
        overview(),
        sourceContent(),
        suppliedFilesSection(),
        supersedeSection(),
        versionCompare(),
        ledgerPanel(),
        videoPanel(),
        alertsPanel(),
        verificationDetails(),
        ...(demo ? [demo] : []),
      ]));
      return;
    }
    mount.replaceChildren(el('section', { class: 'gw-baseline-advanced-workbench', 'data-test': 'source-vault-advanced-workbench' }, [
      el('header', { class: 'gw-baseline-workbench-head' }, [
        el('p', {}, ['SOURCE VAULT · EVIDENCE WORKBENCH']),
        el('h2', {}, ['Reviewed receipt inventory with contract gaps kept separate']),
      ]),
      vaultToolbar(),
      overview(),
      el('div', { class: 'gw-vault-contract-advanced-layout' }, [
        el('aside', { class: 'gw-vault-contract-stack', 'aria-label': 'Transparency and video status gaps' }, [
          alertsPanel(),
          videoPanel(),
        ]),
        el('div', { class: 'gw-vault-contract-stack' }, [
          sourceContent(),
          suppliedFilesSection(),
          supersedeSection(),
          versionCompare(),
        ]),
        el('aside', { class: 'gw-vault-contract-stack', 'aria-label': 'Ledger and verification gaps' }, [
          ledgerPanel(),
          verificationDetails(),
        ]),
      ]),
      ...(demo ? [demo] : []),
    ]));
  })(readPageMode());
  shell.append(mount);
}
