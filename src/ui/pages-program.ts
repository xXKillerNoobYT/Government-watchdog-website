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
import { FIXTURE_BANNER_TEXT } from './state-view';
import { applyThemePref, readThemePref } from './theme-toggle';
import { buildTimeline, recordTimelineDate } from './timeline';

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
}

function pageShell(root: HTMLElement, testId: string, title: string, options: PageShellOptions = {}): HTMLElement {
  ensureStyle();
  root.className = 'gw-root gw-boards-root';
  root.replaceChildren();
  if (options.fixture) root.append(fixtureBanner(options.notice));
  else if (options.notice) root.append(sourceNotice(options.notice));
  const shell = el('main', { class: 'gw-boards', 'data-test': testId }, [el('h1', { class: 'gw-h1' }, [title])]);
  root.append(shell);
  return shell;
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
  simple.addEventListener('click', () => show('simple'));
  advanced.addEventListener('click', () => show('advanced'));
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
  const shell = pageShell(root, 'fast-agenda-page', 'Fast Agenda', { notice, fixture });
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

export function renderTimelineLevels(root: HTMLElement, data: ReadApiResponse, query: URLSearchParams, notice?: string): void {
  ensureTimelineHybridStyle();
  const shell = pageShell(root, 'timeline-levels-page', 'Timeline', { fixture: query.get('demo') === 'sample' });
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
  const byBucket = new Map<string, StatementRecord[]>();
  for (const { record, timelineDate } of filtered) {
    const bucket = dateBucket(timelineDate, level);
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), record]);
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
    if (mode === 'simple') {
      mount.append(el('div', { class: 'gw-timeline-simple-list', 'data-test': 'timeline-simple' }, filtered.map(({ record }) => recordCard(record, undefined, undefined, { reviewerInternal: true }))));
      return;
    }
    const lanes = [...byBucket.entries()].map(([bucket, records]) =>
      el('section', { class: 'gw-lane', 'data-test': 'timeline-bucket', 'data-bucket': bucket }, [
        el('div', { class: 'gw-lane-header' }, [
          el('span', { class: 'gw-lane-name' }, [bucket]),
          el('span', { class: 'gw-lane-count' }, [String(records.length)]),
        ]),
        el('div', { class: 'gw-lane-body' }, records.map((record) => recordCard(record, undefined, undefined, { reviewerInternal: true }))),
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
.gw-timeline-hybrid>[data-test="mode-mount"]{margin:0}
.gw-timeline-hybrid .gw-view-toggle{width:max-content;background:var(--gw-surface-well);border-radius:var(--gw-radius-pill)}
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
}
@media (max-width:640px){
  .gw-timeline-filterbar{grid-template-columns:1fr}
  .gw-timeline-search-field,.gw-timeline-result-count{grid-column:auto}
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

function bodyCard(node: TopicTreeNode): HTMLElement {
  const aliases = node.topic.sourceAliases ?? [];
  return el('article', { class: 'gw-card', 'data-test': 'board-directory-card', 'data-body-id': node.topic.topic_id }, [
    el('h2', {}, [topicLabel(node)]),
    el('p', { class: 'gw-muted' }, [`Jurisdiction: ${node.topic.jurisdiction_id ?? 'not present'}`]),
    el('p', { class: 'gw-muted' }, [`Source aliases: ${aliases.length}`]),
    el('a', { href: `#/boards?id=${encodeURIComponent(node.topic.topic_id)}&reviewer=1`, 'data-test': 'board-detail-link' }, ['Open detail']),
  ]);
}

export function renderBoardsDirectory(root: HTMLElement, data: ReadApiResponse, query: URLSearchParams, notice?: string): void {
  const shell = pageShell(root, 'boards-directory-page', 'Boards directory', { notice, fixture: query.get('demo') === 'sample' });
  if (data.access !== 'reviewer_internal') {
    shell.append(el('section', { class: 'gw-state', 'data-test': 'state-reviewer-gated', role: 'status' }, [
      el('h2', {}, ['Reviewer-internal only']),
      el('p', {}, ['The Boards directory renders no body detail outside the reviewer-internal lane.']),
    ]));
    return;
  }
  const tree = data.topic_tree?.tree;
  if (!tree) {
    shell.append(el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'boards-empty', role: 'status' }, [
      el('h2', {}, ['No reviewed concept-graph bodies yet']),
      el('p', {}, ['The real concept graph did not include a body directory payload.']),
    ]));
    return;
  }
  const nodes = flattenTopics(tree);
  const id = query.get('id');
  const selected = id ? nodes.find((n) => n.topic.topic_id === id) : undefined;
  if (!selected) {
    shell.append(el('p', { class: 'gw-muted', 'data-test': 'boards-directory-note' }, [
      'Real concept-graph nodes only. No scores, verdicts, or influence rankings are rendered.',
    ]));
    shell.append(el('div', { class: 'gw-board', 'data-test': 'boards-directory-list' }, nodes.map(bodyCard)));
    return;
  }

  const aliases = selected.topic.sourceAliases ?? [];
  shell.append(el('article', { class: 'gw-card', 'data-test': 'board-detail', 'data-body-id': selected.topic.topic_id }, [
    el('a', { href: '#/boards?reviewer=1', 'data-test': 'boards-back-link' }, ['Back to Boards directory']),
    el('h2', {}, [topicLabel(selected)]),
    el('p', { class: 'gw-muted' }, [`Body id: ${selected.topic.topic_id}`]),
    el('p', { class: 'gw-muted', 'data-test': 'board-no-scores' }, ['No scores, verdicts, or rankings are shown.']),
    el('details', { class: 'gw-drawer', open: '', 'data-test': 'board-members' }, [
      el('summary', {}, ['Members']),
      el('p', { class: 'gw-muted' }, ['No reviewed member-name/role rows are present in this web-safe concept-graph capture.']),
    ]),
    el('details', { class: 'gw-drawer', 'data-test': 'board-aliases' }, [
      el('summary', {}, [`Source aliases (${aliases.length})`]),
      el('ul', { class: 'gw-related-list' }, aliases.map((a) =>
        el('li', { class: 'gw-related', 'data-test': 'board-alias' }, [
          el('span', { class: 'gw-related-type' }, [a.aliasType]),
          ` ${a.term}`,
        ]),
      )),
    ]),
  ]));
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

export function renderPowerTracker(root: HTMLElement, data: ReadApiResponse, query: URLSearchParams, notice?: string): void {
  const shell = pageShell(root, 'power-tracker-page', 'Power Tracker', { notice, fixture: query.get('demo') === 'sample' });
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

export function renderWatchlist(root: HTMLElement, data: ReadApiResponse, query: URLSearchParams, notice?: string): void {
  const shell = pageShell(root, 'watchlist-page', 'Watchlist', { notice, fixture: query.get('demo') === 'sample' });
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
  const shell = pageShell(root, 'location-page', 'Location coverage', { notice, fixture: query.get('demo') === 'sample' });
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
  return el('article', { class: 'gw-card', 'data-test': 'issue-dossier-card', 'data-id': record.statement_id }, [
    el('p', { class: 'gw-muted' }, [`Record ${record.statement_id}`]),
    el('h2', { 'data-test': 'issue-title' }, [statementTitle(record)]),
    el('div', { class: 'gw-badges' }, [
      el('span', { class: 'gw-badge gw-tone-neutral', 'data-test': 'issue-status' }, [record.ui_status ?? 'status not present']),
      el('span', { class: 'gw-badge gw-tone-caution', 'data-test': 'issue-verification' }, [record.verification_status ?? 'verification not present']),
    ]),
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
  return el('div', { class: 'gw-board', 'data-test': 'issue-proof-rail' }, evidence.map((entry, index) =>
    el('article', { class: 'gw-card', 'data-test': 'proof-source', 'data-source-id': entry.to_source_id ?? `source-${index + 1}` }, [
      el('h3', {}, [entry.to_source_id ?? `Source ${index + 1}`]),
      el('p', { class: 'gw-muted' }, [[entry.source_type, entry.published_by, entry.jurisdiction].filter(Boolean).join(' · ') || 'Source metadata not present']),
      el('p', { class: 'gw-muted' }, [entry.source_date ?? 'Source date not present']),
      ...(entry.original_url ? [el('a', { href: entry.original_url, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'source-original' }, ['Open original'])] : []),
      ...(entry.archive_url ? [el('a', { href: entry.archive_url, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'source-archive' }, ['Open archive'])] : []),
    ]),
  ));
}

export function renderIssueDetail(root: HTMLElement, data: ReadApiResponse, query: URLSearchParams, notice?: string): void {
  const shell = pageShell(root, 'issue-detail-page', 'Issue detail', { notice, fixture: query.get('demo') === 'sample' });
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
    mount.replaceChildren(renderIssueDossierCard(record));
    if (mode === 'advanced') mount.append(evidenceMetaRows(record.evidence ?? []));
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
  const shell = pageShell(root, 'source-vault-page', 'Source vault', { notice, fixture: query.get('demo') === 'sample' });
  if (data.access !== 'reviewer_internal') {
    shell.append(el('section', { class: 'gw-state', 'data-test': 'state-reviewer-gated', role: 'status' }, [
      el('h2', {}, ['Reviewer-internal only']),
      el('p', {}, ['The Source Vault renders no source rows outside the reviewer-internal lane.']),
    ]));
    return;
  }
  const sources = collectSources(data);
  if (!sources.length) {
    shell.append(el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'source-vault-empty', role: 'status' }, [
      el('h2', {}, ['No reviewed source metadata yet']),
      el('p', {}, ['No rows were invented for the vault.']),
    ]));
  } else {
    shell.append(el('div', { class: 'gw-board', 'data-test': 'source-vault-list' }, sources.map((source, index) =>
      el('article', { class: 'gw-card', 'data-test': 'source-vault-row', 'data-source-id': source.to_source_id ?? `source-${index + 1}` }, [
        el('h2', {}, [source.to_source_id ?? `Source ${index + 1}`]),
        el('p', { class: 'gw-muted' }, [[source.source_type, source.published_by, source.jurisdiction].filter(Boolean).join(' · ') || 'Metadata not present']),
        el('p', { class: 'gw-muted' }, [`Date: ${source.source_date ?? 'not present'}`]),
        el('p', { class: 'gw-muted' }, [`Validation: ${source.last_validated_utc ?? source.scan_date ?? 'not present'}`]),
        ...(source.original_url ? [el('a', { href: source.original_url, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'vault-original' }, ['Original'])] : []),
        ...(source.archive_url ? [el('a', { href: source.archive_url, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'vault-archive' }, ['Archive'])] : []),
      ]),
    )));
  }
  shell.append(el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'source-ledger-empty', role: 'status' }, [
    el('h2', {}, ['Ledger history not wired yet']),
    el('p', {}, ['The current reviewed payload has source metadata, but no ledger-change projection.']),
  ]));
  shell.append(el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'source-alerts-empty', role: 'status' }, [
    el('h2', {}, ['Transparency alerts not wired yet']),
    el('p', {}, ['No live alert generation is performed on this page.']),
  ]));
  if (query.get('demo') === 'sample') {
    shell.append(el('section', { class: 'gw-state', 'data-test': 'packet-diff-demo', role: 'note' }, [
      el('h2', {}, ['Packet diff demo fixture']),
      el('p', {}, ['Sample-only packet-diff placeholder for visual review; not real Alpine data.']),
    ]));
  }
}
