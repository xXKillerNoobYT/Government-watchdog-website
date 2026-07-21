/**
 * GOV-665 — Wave 2 pages: Fast Agenda, advanced Timeline, and Boards directory.
 *
 * These surfaces consume only the committed web-safe GOV-605/GOV-149 captures.
 * They do not derive trust, counts, scores, verdicts, or publication state. Demo
 * data is allowed only behind `?demo=sample` and is visibly labeled by callers.
 */

import type { AgendaBoard, AgendaBoardCard, AgendaLane } from '../types/agenda-board';
import type { EvidenceLink, ReadApiResponse, StatementRecord, TopicTreeNode } from '../types/read-api';
import { ensureStyle, recordCard } from './render';
import { FIXTURE_BANNER_TEXT, trustLabel } from './state-view';
import { applyThemePref, readThemePref } from './theme-toggle';
import { buildTimeline, recordTimelineDate } from './timeline';
import {
  confidenceLabel,
  correctionStatusLabel,
  provenanceBadge,
  verificationStatusLabel,
} from './statement-presenter';

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
  return 'advanced';
}

function persistPageMode(mode: PageMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* non-fatal */
  }
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
}

function pageShell(root: HTMLElement, testId: string, title: string, options: PageShellOptions = {}): HTMLElement {
  ensureStyle();
  root.className = 'gw-root gw-boards-root';
  root.replaceChildren();
  if (options.admitted !== false) {
    if (options.fixture) root.append(fixtureBanner(options.notice));
    else if (options.notice) root.append(sourceNotice(options.notice));
  }
  const shell = el('main', { class: 'gw-boards', 'data-test': testId }, [el('h1', { class: 'gw-h1' }, [title])]);
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
.gw-source-vault-advanced-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:var(--gw-space-5);align-items:start}
.gw-source-vault-gap-stack{display:grid;gap:var(--gw-space-4)}
@media(max-width:800px){.gw-baseline-simple-sheet{padding:var(--gw-space-4)}.gw-baseline-workbench-head{align-items:start;flex-direction:column}.gw-baseline-workbench-head h2{text-align:left}.gw-source-vault-advanced-grid{grid-template-columns:1fr}}
`;

let baselinePageStyleInjected = false;

function ensureBaselinePageStyle(): void {
  if (baselinePageStyleInjected) return;
  document.head.append(el('style', { 'data-test': 'baseline-page-style' }, [BASELINE_PAGE_STYLE]));
  baselinePageStyleInjected = true;
}

function applyModeThemeDefault(mode: PageMode): void {
  if (readThemePref() !== 'system') return;
  applyThemePref(mode === 'advanced' ? 'dark' : 'system');
}

function modeToggle(onChange: (mode: PageMode) => void): HTMLElement {
  const mount = el('div', { 'data-test': 'mode-mount' });
  const simple = el('button', { type: 'button', class: 'gw-view-tab', 'data-test': 'mode-simple', role: 'tab' }, ['Simple']);
  const advanced = el('button', { type: 'button', class: 'gw-view-tab', 'data-test': 'mode-advanced', role: 'tab' }, ['Advanced']);
  const show = (mode: PageMode) => {
    simple.setAttribute('aria-selected', String(mode === 'simple'));
    advanced.setAttribute('aria-selected', String(mode === 'advanced'));
    persistPageMode(mode);
    applyModeThemeDefault(mode);
    onChange(mode);
  };
  const choose = (mode: PageMode): void => {
    show(mode);
    // The persistent shell owns the same gw_home_mode preference. Re-route so
    // its chrome changes with this in-page control instead of leaving (for
    // example) an Advanced timeline inside a Simple newspaper shell.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  simple.addEventListener('click', () => choose('simple'));
  advanced.addEventListener('click', () => choose('advanced'));
  mount.append(el('div', { class: 'gw-view-toggle', role: 'tablist', 'aria-label': 'Page mode', 'data-test': 'mode-toggle' }, [simple, advanced]));
  show(readPageMode());
  return mount;
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
  });
  if (board.access !== 'reviewer_internal') {
    shell.append(el('section', { class: 'gw-state', 'data-test': 'state-reviewer-gated', role: 'status' }, [
      el('h2', {}, ['Reviewer-internal only']),
      el('p', {}, ['The Fast Agenda page renders no cards outside the reviewer-internal lane.']),
    ]));
    return;
  }

  const mount = el('div', { 'data-test': 'fast-agenda-mount' });
  shell.append(modeToggle((mode) => {
    mount.replaceChildren();
    const cards = allCards(board);
    if (!cards.length) {
      mount.append(honestAgendaEmpty(board));
    } else if (mode === 'simple') {
      mount.append(fastAgendaCard(cards[0]));
    } else {
      mount.append(el('div', { class: 'gw-board', 'data-test': 'fast-agenda-list' }, cards.map(fastAgendaCard)));
    }
    mount.append(el('section', { class: 'gw-state', 'data-test': 'fast-agenda-disclosures', role: 'note' }, [
      el('p', { class: 'gw-muted' }, ['Agenda projection limits, rendered verbatim:']),
      el('ul', { class: 'gw-muted' }, [
        el('li', {}, [board.disclosures.decisions]),
        el('li', {}, [board.disclosures.categories]),
        ...board.lanes.map(agendaLaneSummary),
      ]),
    ]));
  }), mount);
}

export type TimelineLevel = 'year' | 'month' | 'day';
export type TimelineEventType = 'all' | 'agenda' | 'source' | 'undated';

function eventType(record: StatementRecord): Exclude<TimelineEventType, 'all'> {
  if (record.agenda_item_id) return 'agenda';
  if (recordTimelineDate(record)) return 'source';
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
    filterOption('agenda', 'Agenda-linked', type),
    filterOption('source', 'Source-dated', type),
    filterOption('undated', 'Undated', type),
  ]);
  const submit = el('button', { type: 'submit', class: 'gw-timeline-filter-submit' }, ['Apply filters']);
  const reset = el('a', {
    class: 'gw-timeline-filter-reset',
    href: '#/timeline?reviewer=1',
    'data-test': 'timeline-filter-reset',
  }, ['Clear']);
  form.append(
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
    next.set('reviewer', '1');
    window.location.hash = `/timeline?${next.toString()}`;
  });
  return form;
}

/**
 * Preserve the handoff's issue-run and archive-window tools as visible,
 * non-operational slots. The current admitted response has neither typed issue
 * edges nor archive completeness metadata, so enabling these controls would
 * manufacture both relationship and coverage claims.
 */
function timelineUnavailableTools(): HTMLElement {
  return el('section', {
    class: 'gw-timeline-tool-gaps',
    role: 'note',
    'data-test': 'timeline-tools-unavailable',
    'data-state': 'unavailable',
  }, [
    el('div', {}, [
      el('p', { class: 'gw-timeline-kicker' }, ['DESIGNED TIMELINE TOOLS']),
      el('strong', {}, ['Issue runs and complete archive windows are not connected']),
      el('p', {}, ['These controls stay visible for the baseline layout but remain disabled until typed issue edges and archive-completeness metadata are supplied.']),
    ]),
    el('div', { class: 'gw-timeline-tool-gap-controls', role: 'group', 'aria-label': 'Unavailable timeline tools' }, [
      el('button', { type: 'button', disabled: '', 'aria-disabled': 'true', 'data-test': 'timeline-issue-preset-unavailable' }, ['Issue preset · unavailable']),
      el('button', { type: 'button', disabled: '', 'aria-disabled': 'true', 'data-test': 'timeline-window-90-unavailable' }, ['Past 90 days · unavailable']),
      el('button', { type: 'button', disabled: '', 'aria-disabled': 'true', 'data-test': 'timeline-window-year-unavailable' }, ['Past year · unavailable']),
      el('button', { type: 'button', disabled: '', 'aria-disabled': 'true', 'data-test': 'timeline-window-all-unavailable' }, ['Complete archive · unavailable']),
    ]),
  ]);
}

interface TimelineMapRecord {
  record: StatementRecord;
  timelineDate?: string;
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
 * current Alpine statement projection contains County/State events or typed
 * issue-run edges. Town markers use only the same web-safe ordering date as the
 * record list; unavailable lanes and connector behavior remain visible gaps.
 */
function timelineMap(records: readonly TimelineMapRecord[], mode: PageMode): HTMLElement {
  const dated = records
    .map((entry, index) => ({ ...entry, index }))
    .filter((entry): entry is TimelineMapRecord & { timelineDate: string; index: number } => Boolean(entry.timelineDate))
    .sort((a, b) => a.timelineDate.localeCompare(b.timelineDate) || a.index - b.index);
  const dates = [...new Set(dated.map((entry) => entry.timelineDate))].sort();
  const firstDate = dates[0];
  const lastDate = dates.at(-1);
  const undatedCount = records.length - dated.length;

  const townEvents = dated.length
    ? el('ol', { class: 'gw-timeline-map-events', 'data-test': 'timeline-map-town-events' }, dated.map((entry) => {
      const targetId = timelineRecordAnchor(entry.index);
      const marker = el('button', {
          type: 'button',
          class: `gw-timeline-map-event gw-timeline-map-event-${eventType(entry.record)}`,
          title: timelineMapLabel(entry.record),
          'data-test': 'timeline-map-event',
          'data-date': entry.timelineDate,
        }, [
          el('span', { class: 'gw-timeline-map-dot', 'aria-hidden': 'true' }, []),
          el('time', { datetime: entry.timelineDate }, [entry.timelineDate]),
          el('span', { class: 'gw-timeline-map-event-copy' }, [timelineMapLabel(entry.record)]),
          el('span', { class: 'gw-timeline-map-status' }, [entry.record.ui_status ?? 'status unavailable']),
        ]);
      marker.addEventListener('click', () => {
        const target = document.getElementById(targetId);
        if (!target) return;
        target.focus({ preventScroll: true });
        if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'start' });
      });
      return el('li', {}, [marker]);
    }))
    : el('div', { class: 'gw-timeline-map-gap', role: 'status', 'data-test': 'timeline-map-date-gap' }, [
      el('strong', {}, ['No web-safe timeline date available']),
      el('span', {}, [`${records.length} reviewed Town row${records.length === 1 ? '' : 's'} remain in the undated record list below.`]),
    ]);

  const unavailableLane = (level: string, testId: string): HTMLElement => el('div', {
    class: 'gw-timeline-map-gap',
    role: 'status',
    'data-test': testId,
  }, [
    el('strong', {}, [`${level} projection unavailable`]),
    el('span', {}, [`No reviewed ${level.toLocaleLowerCase()} events are supplied to this route; no markers were invented.`]),
  ]);

  return el('section', {
    class: `gw-timeline-map gw-timeline-map-${mode}`,
    'data-test': 'timeline-map',
    'data-mode': mode,
  }, [
    el('header', { class: 'gw-timeline-map-head' }, [
      el('div', {}, [
        el('p', { class: 'gw-timeline-kicker' }, ['CROSS-GOVERNMENT EVENT BAR']),
        el('h2', {}, ['Town, County, and State in one view']),
      ]),
      el('div', { class: 'gw-timeline-map-legend', 'aria-label': 'Timeline marker legend' }, [
        el('span', { class: 'is-agenda' }, ['● Agenda-linked']),
        el('span', { class: 'is-source' }, ['● Source-dated']),
        el('span', { class: 'is-undated' }, ['● Undated below']),
      ]),
    ]),
    el('div', { class: 'gw-timeline-map-axis', 'aria-label': 'Timeline date range' }, [
      el('span', {}, [firstDate ?? 'No dated start']),
      el('i', { 'aria-hidden': 'true' }, []),
      el('span', {}, [lastDate ?? 'No dated end']),
    ]),
    el('div', { class: 'gw-timeline-map-lanes' }, [
      el('section', { class: 'gw-timeline-map-lane gw-timeline-map-town', 'data-test': 'timeline-map-town' }, [
        el('h3', {}, ['TOWN', el('small', {}, ['Alpine'])]),
        townEvents,
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
      el('p', {}, [
        'Date basis: agenda-item date or latest web-safe source/scan/validation date. It is a display-order date, not an inferred event date.',
      ]),
      el('p', { 'data-test': 'timeline-connector-gap' }, [
        'Issue-run highlighting and connector lines are unavailable until the backend supplies typed cross-record issue edges.',
      ]),
      ...(undatedCount ? [el('p', {}, [`${undatedCount} undated reviewed row${undatedCount === 1 ? '' : 's'} appear below and are not placed on the bar.`])] : []),
    ]),
  ]);
}

export function renderTimelineLevels(root: HTMLElement, data: ReadApiResponse, query: URLSearchParams, notice?: string): void {
  ensureTimelineHybridStyle();
  const shell = pageShell(root, 'timeline-levels-page', 'Timeline');
  shell.classList.add('gw-timeline-hybrid');
  if (data.access !== 'reviewer_internal') {
    shell.append(el('section', { class: 'gw-state', 'data-test': 'state-reviewer-gated', role: 'status' }, [
      el('h2', {}, ['Reviewer-internal only']),
      el('p', {}, ['The timeline renders no cards outside the reviewer-internal lane.']),
    ]));
    return;
  }

  const level = selectValue(query, 'level', 'month', ['year', 'month', 'day']) as TimelineLevel;
  const type = selectValue(query, 'type', 'all', ['all', 'agenda', 'source', 'undated']) as TimelineEventType;
  const search = (query.get('search') ?? '').trim().toLocaleLowerCase();
  const timeline = buildTimeline(data);
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
          'The handoff’s cleaner timeline framing, backed by the existing fail-closed record cards and source-reveal behavior.',
        ]),
      ]),
      el('aside', { class: 'gw-timeline-scope', role: 'note' }, [
        el('strong', {}, ['TOWN · ALPINE']),
        el('span', {}, ['County and State lanes remain unavailable until reviewed backend projections exist.']),
      ]),
    ]),
    ...(notice ? [el('div', { class: 'gw-timeline-origin', role: 'status', 'data-test': 'source-notice' }, [notice])] : []),
    el('div', { class: 'gw-timeline-filter-meta', 'data-test': 'timeline-filters', 'aria-label': 'Applied timeline filters' }, [
      el('span', {}, [`Level: ${level}`]),
      el('span', {}, [`Type: ${type}`]),
      ...(search ? [el('span', { 'data-test': 'timeline-search-filter' }, [`Search: ${search}`])] : []),
    ]),
    timelineFilterBar(query, level, type, filtered.length),
    timelineUnavailableTools(),
  );

  const mount = el('div', { 'data-test': 'timeline-mode-mount' });
  shell.append(modeToggle((mode) => {
    mount.replaceChildren();
    if (filtered.length === 0) {
      mount.append(el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'timeline-empty', role: 'status' }, [
        el('h2', {}, ['No reviewed records match this timeline filter']),
        el('p', {}, ['No records were invented to fill this filter.']),
      ]));
      return;
    }
    mount.append(timelineMap(filtered, mode));
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
  }), mount);
}

export const TIMELINE_HYBRID_STYLE = `
.gw-timeline-hybrid{max-width:none;display:flex;flex-direction:column;gap:14px}
.gw-timeline-hybrid>.gw-h1{font-size:clamp(1.8rem,3vw,2.7rem);margin:0;line-height:1.05}
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
.gw-timeline-field{display:flex;flex-direction:column;gap:5px;color:var(--gw-text-muted);font-size:11px;font-weight:800;letter-spacing:.45px;text-transform:uppercase}
.gw-timeline-field input,.gw-timeline-field select{width:100%;min-height:var(--gw-tap-min);border:var(--gw-border-w) solid var(--gw-border);border-radius:8px;background:var(--gw-surface-subtle);color:var(--gw-text);padding:8px 10px;font:500 var(--gw-text-badge)/1.2 var(--gw-font)}
.gw-timeline-field input:focus-visible,.gw-timeline-field select:focus-visible{outline:2px solid var(--gw-accent);outline-offset:1px;border-color:var(--gw-accent)}
.gw-timeline-filter-submit,.gw-timeline-filter-reset{display:inline-flex;align-items:center;justify-content:center;min-height:var(--gw-tap-min);border-radius:8px;padding:8px 13px;font:700 var(--gw-text-badge)/1 var(--gw-font);cursor:pointer}
.gw-timeline-filter-submit{border:var(--gw-border-w) solid var(--gw-accent);background:var(--gw-accent);color:var(--gw-accent-text-on)}
.gw-timeline-filter-reset{border:var(--gw-border-w) solid var(--gw-border);background:transparent;color:var(--gw-text-secondary);text-decoration:none}
.gw-timeline-result-count{align-self:center;color:var(--gw-text-muted);font:600 11px/1.25 var(--gw-font-mono);white-space:nowrap}
.gw-timeline-tool-gaps{display:flex;align-items:center;justify-content:space-between;gap:16px;background:var(--gw-surface-well);border:var(--gw-border-w) dashed var(--gw-border);border-radius:var(--gw-radius-lg);padding:12px 14px;color:var(--gw-text-secondary)}
.gw-timeline-tool-gaps p{margin:3px 0 0;font-size:var(--gw-text-sm)}.gw-timeline-tool-gaps strong{color:var(--gw-text)}
.gw-timeline-tool-gap-controls{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px}.gw-timeline-tool-gap-controls button{min-height:var(--gw-tap-min);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);background:var(--gw-surface);color:var(--gw-text-muted);padding:7px 11px;font:700 var(--gw-text-badge)/1 var(--gw-font);cursor:not-allowed}
.gw-timeline-hybrid>[data-test="mode-mount"]{margin:0}
.gw-timeline-hybrid .gw-view-toggle{width:max-content;background:var(--gw-surface-well);border-radius:var(--gw-radius-pill)}
.gw-timeline-map{display:grid;gap:12px;margin:14px 0;background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);padding:16px;overflow:hidden}
.gw-timeline-map-head{display:flex;align-items:end;justify-content:space-between;gap:16px}
.gw-timeline-map-head h2{margin:3px 0 0;font-size:var(--gw-text-lg)}
.gw-timeline-map-legend{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px 12px;color:var(--gw-text-muted);font:600 11px/1.3 var(--gw-font-mono)}
.gw-timeline-map-legend .is-agenda{color:var(--gw-caution-text)}.gw-timeline-map-legend .is-source{color:var(--gw-ok-text)}
.gw-timeline-map-axis{display:grid;grid-template-columns:auto minmax(40px,1fr) auto;gap:10px;align-items:center;color:var(--gw-text-muted);font:600 11px/1.2 var(--gw-font-mono)}
.gw-timeline-map-axis i{height:1px;background:var(--gw-border-strong)}
.gw-timeline-map-lanes{display:grid;gap:8px}
.gw-timeline-map-lane{display:grid;grid-template-columns:90px minmax(0,1fr);gap:10px;align-items:stretch;min-height:64px;border:var(--gw-border-w) solid var(--gw-border);border-left-width:4px;border-radius:10px;background:var(--gw-surface-well);padding:8px}
.gw-timeline-map-lane h3{display:flex;flex-direction:column;justify-content:center;gap:3px;margin:0;font:800 11px/1.2 var(--gw-font);letter-spacing:1px}.gw-timeline-map-lane h3 small{color:var(--gw-text-muted);font-size:10px;letter-spacing:0}
.gw-timeline-map-town{border-left-color:var(--gw-level-town)}.gw-timeline-map-county{border-left-color:var(--gw-level-county)}.gw-timeline-map-state{border-left-color:var(--gw-level-state)}
.gw-timeline-map-events{display:flex;gap:8px;align-items:stretch;margin:0;padding:0;list-style:none;overflow-x:auto;scroll-snap-type:x proximity}
.gw-timeline-map-events li{display:flex;min-width:min(280px,76vw);scroll-snap-align:start}
.gw-timeline-map-event{display:grid;grid-template-columns:auto 1fr auto;gap:3px 8px;align-items:center;width:100%;min-height:var(--gw-tap-min);padding:8px 10px;border:var(--gw-border-w) solid var(--gw-border);border-radius:8px;background:var(--gw-surface);color:var(--gw-text);font:inherit;text-align:left;cursor:pointer}
.gw-timeline-map-event:hover,.gw-timeline-map-event:focus-visible{border-color:var(--gw-accent);outline:2px solid var(--gw-accent);outline-offset:1px}
.gw-timeline-map-dot{grid-row:1/3;width:11px;height:11px;border-radius:50%;background:var(--gw-ok-text);box-shadow:0 0 0 3px var(--gw-tone-ok-well)}
.gw-timeline-map-event-agenda .gw-timeline-map-dot{background:var(--gw-caution-text);box-shadow:0 0 0 3px var(--gw-tone-caution-well)}
.gw-timeline-map-event time{font:600 10px/1.2 var(--gw-font-mono);color:var(--gw-text-muted)}
.gw-timeline-map-event-copy{grid-column:2/4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700}
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
  .gw-timeline-tool-gaps{align-items:stretch;flex-direction:column}.gw-timeline-tool-gap-controls{justify-content:flex-start}
}
@media (max-width:640px){
  .gw-timeline-filterbar{grid-template-columns:1fr}
  .gw-timeline-search-field,.gw-timeline-result-count{grid-column:auto}
  .gw-timeline-map-head{align-items:start;flex-direction:column}.gw-timeline-map-legend{justify-content:flex-start}
  .gw-timeline-map-lane{grid-template-columns:1fr}.gw-timeline-map-lane h3{display:block}
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
    el('a', { href: `#/timeline?search=${encodeURIComponent(topicLabel(node))}&reviewer=1`, 'data-test': 'boards-topic-timeline-link' }, ['Find reviewed records in Timeline']),
  ]);
}

function boardContractGap(title: string, body: string, testId: string): HTMLElement {
  return el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': testId, role: 'status' }, [
    el('h2', {}, [title]),
    el('p', {}, [body]),
  ]);
}

export function renderBoardsDirectory(root: HTMLElement, data: ReadApiResponse, query: URLSearchParams, notice?: string): void {
  const shell = pageShell(root, 'boards-directory-page', 'Boards directory', {
    notice,
    admitted: data.access === 'reviewer_internal',
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
  const baselineSlots = (): HTMLElement => el('div', { class: 'gw-board', 'data-test': 'boards-baseline-slots' }, [
      boardContractGap(
        'Tracked government bodies unavailable',
        'A dedicated bodies projection must supply each policy-cleared body name before directory cards can be populated.',
        'boards-bodies-gap',
      ),
      boardContractGap(
        'Meeting cadence unavailable',
        'No schedule or cadence fields are present in the reviewed concept graph.',
        'boards-cadence-gap',
      ),
      boardContractGap(
        'Members and roles unavailable',
        'No policy-cleared member-name or role rows are present in the reviewed payload.',
        'boards-members-gap',
      ),
      boardContractGap(
        'Official links unavailable',
        'No body-level official URL or meeting-calendar URL is supplied by the current contract.',
        'boards-links-gap',
      ),
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
        href: `#/timeline?search=${encodeURIComponent(topicLabel(selected))}&reviewer=1`,
      }, ['Open this topic in Timeline'])] : []),
    ]);
  };

  const topicContext = (): HTMLElement => el('section', { 'data-test': 'boards-topic-context' }, [
    el('h2', {}, ['Reviewed topic context']),
    el('p', { class: 'gw-muted' }, [
      'These source-backed topic labels help navigate reviewed records; they do not satisfy or replace the Boards directory contract.',
    ]),
    ...(nodes.length
      ? [el('div', { class: 'gw-board' }, nodes.map(topicContextCard))]
      : [boardContractGap('No reviewed topic context', 'The current projection supplied neither body records nor topic context.', 'boards-topic-context-gap')]),
  ]);

  ensureBaselinePageStyle();
  const mount = el('div', { class: 'gw-baseline-mode-mount', 'data-test': 'boards-mode-mount' });
  shell.append(modeToggle((mode) => {
    mount.setAttribute('data-mode', mode);
    const selectedNotice = requestedTopicNotice();
    const content: HTMLElement[] = [directoryNote(), baselineSlots()];
    if (selectedNotice) content.push(selectedNotice);
    content.push(topicContext());
    if (mode === 'simple') {
      mount.replaceChildren(el('section', { class: 'gw-baseline-simple-sheet', 'data-test': 'boards-simple-edition' }, [
        el('header', { class: 'gw-baseline-simple-head' }, [
          el('p', {}, ['BOARDS · REVIEWED ALPINE EDITION']),
          el('h2', {}, ['Who meets, what is missing, and where topic records live']),
          el('p', {}, ['Plain-English directory status first; reviewed topic context follows without being relabelled as a government body.']),
        ]),
        ...content,
      ]));
      return;
    }
    mount.replaceChildren(el('section', { class: 'gw-baseline-advanced-workbench', 'data-test': 'boards-advanced-workbench' }, [
      el('header', { class: 'gw-baseline-workbench-head' }, [
        el('p', {}, ['BOARDS DIRECTORY · EVIDENCE WORKBENCH']),
        el('h2', {}, ['Body-contract gaps beside reviewed civic-topic context']),
      ]),
      ...content,
    ]));
  }), mount);
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
  shell.append(modeToggle((mode) => {
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
      el('a', { href: `#/issue?id=${encodeURIComponent(record.statement_id)}&reviewer=1`, 'data-test': 'power-record-link' }, ['Open record']),
      watchToggle(record),
      ...(mode === 'advanced' ? [evidenceMetaRows(record.evidence ?? [])] : []),
    ]));
    mount.append(el('div', { class: 'gw-board', 'data-test': mode === 'advanced' ? 'power-advanced-list' : 'power-simple-list' }, cards));
  }), mount);
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
          el('a', { href: `#/issue?id=${encodeURIComponent(record.statement_id)}&reviewer=1`, 'data-test': 'watchlist-record-link' }, ['Open record']),
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
  shell.append(modeToggle((mode) => {
    mount.setAttribute('data-mode', mode);
    renderList();
  }), mount);
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
    el('a', { class: 'gw-view-tab', href: '#/location?state=Wyoming&county=Lincoln%20County&town=Alpine&reviewer=1', 'data-test': 'location-alpine-link' }, ['Wyoming → Lincoln County → Alpine']),
    el('a', { class: 'gw-view-tab', href: '#/location?state=Wyoming&county=Teton%20County&town=Jackson&reviewer=1', 'data-test': 'location-uncovered-link' }, ['Other Wyoming town']),
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
        el('a', { href: `#/issue?id=${encodeURIComponent(record.statement_id)}&reviewer=1`, 'data-test': 'location-record-link' }, ['Open record']),
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
    el('h2', { 'data-test': 'issue-title' }, [statementTitle(record)]),
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
      el('h2', {}, ['Reviewed record not found']),
      el('p', {}, ['No dossier was fabricated for the requested id.']),
    ]));
    return;
  }
  const mount = el('div', { 'data-test': 'issue-mode-mount' });
  shell.append(modeToggle((mode) => {
    mount.setAttribute('data-mode', mode);
    mount.replaceChildren(
      renderIssueDossierCard(record),
      evidenceMetaRows(record.evidence ?? []),
    );
  }), mount);
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

export function renderSourceVault(root: HTMLElement, data: ReadApiResponse, query: URLSearchParams, notice?: string): void {
  const shell = pageShell(root, 'source-vault-page', 'Source vault', {
    notice,
    fixture: query.get('demo') === 'sample',
    admitted: data.access === 'reviewer_internal',
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
  const overview = (): HTMLElement => el('section', { class: 'gw-board', 'data-test': 'source-vault-overview', 'aria-label': 'Source Vault overview' }, [
      el('article', { class: 'gw-card', 'data-test': 'source-reviewed-count' }, [
        el('p', { class: 'gw-muted' }, ['REVIEWED SOURCE METADATA']),
        el('h2', {}, [String(sources.length)]),
        el('p', {}, [`Unique source row${sources.length === 1 ? '' : 's'} exposed by the current reviewed statement receipts.`]),
      ]),
      el('article', { class: 'gw-card', 'data-test': 'source-hash-gap' }, [
        el('p', { class: 'gw-muted' }, ['HASH VERIFICATION']),
        el('h2', {}, ['Unavailable']),
        el('p', {}, ['The web-safe payload supplies no source-registry hash status or reviewed verification percentage.']),
      ]),
      el('article', { class: 'gw-card', 'data-test': 'source-flags-gap' }, [
        el('p', { class: 'gw-muted' }, ['OPEN TRANSPARENCY FLAGS']),
        el('h2', {}, ['Unavailable']),
        el('p', {}, ['No transparency-alert projection is connected, so no flag count is inferred from statement status.']),
      ]),
    ]);

  const sourceContent = (): HTMLElement => {
    if (!sources.length) {
      return el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'source-vault-empty', role: 'status' }, [
        el('h2', {}, ['No reviewed source metadata yet']),
        el('p', {}, ['No rows were invented for the vault.']),
      ]);
    }
    return el('div', { class: 'gw-board', 'data-test': 'source-vault-list' }, sources.map((source, index) =>
      el('article', { class: 'gw-card', 'data-test': 'source-vault-row', 'data-source-id': source.to_source_id ?? `source-${index + 1}` }, [
        el('h2', {}, [source.to_source_id ?? `Source ${index + 1}`]),
        el('p', { class: 'gw-muted' }, [[source.source_type, source.published_by, source.jurisdiction].filter(Boolean).join(' · ') || 'Metadata not present']),
        el('p', { class: 'gw-muted' }, [`Date: ${source.source_date ?? 'not present'}`]),
        el('p', { class: 'gw-muted' }, [`Validation: ${source.last_validated_utc ?? source.scan_date ?? 'not present'}`]),
        ...(source.original_url ? [el('a', { href: source.original_url, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'vault-original' }, ['Original'])] : []),
        ...(source.archive_url ? [el('a', { href: source.archive_url, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'vault-archive' }, ['Archive'])] : []),
      ]),
    ));
  };

  const gapCards = (): HTMLElement[] => [
    el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'source-version-compare-empty', role: 'status' }, [
      el('h2', {}, ['Document version compare not wired yet']),
      el('p', {}, ['The baseline deterministic v1/v2 comparison stays unavailable until a reviewed source-versions projection supplies both document versions and a web-safe diff.']),
    ]),
    el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'source-ledger-empty', role: 'status' }, [
      el('h2', {}, ['Ledger history not wired yet']),
      el('p', {}, ['The current reviewed payload has source metadata, but no ledger-change projection.']),
    ]),
    el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'source-video-status-empty', role: 'status' }, [
      el('h2', {}, ['Video release and transcript status not wired yet']),
      el('p', {}, ['No reviewed video-status ladder is supplied. Pending release, pending transcript, and missing-video states are not inferred from a source date.']),
    ]),
    el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'source-alerts-empty', role: 'status' }, [
      el('h2', {}, ['Transparency alerts not wired yet']),
      el('p', {}, ['No live alert generation is performed on this page.']),
    ]),
  ];

  const verificationDetails = (): HTMLElement => el('section', { class: 'gw-card', 'data-test': 'source-verification-details' }, [
      el('h2', {}, ['Verification details']),
      el('p', {}, [
        `${originalLinkCount} original link${originalLinkCount === 1 ? '' : 's'} and ${archiveLinkCount} archive link${archiveLinkCount === 1 ? '' : 's'} are present in the reviewed receipt metadata. Link presence alone does not establish freshness, third-party preservation, or hash verification.`,
      ]),
      el('div', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'source-third-party-verification-empty', role: 'status' }, [
        el('h3', {}, ['Third-party verification unavailable']),
        el('p', {}, ['A source-registry verification contract must supply archive-provider and validation results before this slot can make a verification claim.']),
      ]),
    ]);

  const packetDiff = (): HTMLElement | null => query.get('demo') === 'sample'
    ? el('section', { class: 'gw-state', 'data-test': 'packet-diff-demo', role: 'note' }, [
        el('h2', {}, ['Packet diff demo fixture']),
        el('p', {}, ['Sample-only packet-diff placeholder for visual review; not real Alpine data.']),
      ])
    : null;

  ensureBaselinePageStyle();
  const mount = el('div', { class: 'gw-baseline-mode-mount', 'data-test': 'source-vault-mode-mount' });
  shell.append(modeToggle((mode) => {
    mount.setAttribute('data-mode', mode);
    const demo = packetDiff();
    if (mode === 'simple') {
      mount.replaceChildren(el('section', { class: 'gw-baseline-simple-sheet', 'data-test': 'source-vault-simple-edition' }, [
        el('header', { class: 'gw-baseline-simple-head' }, [
          el('p', {}, ['SOURCE VAULT · REVIEWED RECEIPTS']),
          el('h2', {}, ['What the reviewed record can prove—and what still needs a source contract']),
          el('p', {}, ['Source rows and honest verification gaps in a single reading column.']),
        ]),
        overview(),
        sourceContent(),
        ...gapCards(),
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
      overview(),
      el('div', { class: 'gw-source-vault-advanced-grid' }, [
        sourceContent(),
        el('div', { class: 'gw-source-vault-gap-stack' }, gapCards()),
      ]),
      verificationDetails(),
      ...(demo ? [demo] : []),
    ]));
  }), mount);
}
