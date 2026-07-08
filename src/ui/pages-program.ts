/**
 * GOV-665 — Wave 2 pages: Fast Agenda, advanced Timeline, and Boards directory.
 *
 * These surfaces consume only the committed web-safe GOV-605/GOV-149 captures.
 * They do not derive trust, counts, scores, verdicts, or publication state. Demo
 * data is allowed only behind `?demo=sample` and is visibly labeled by callers.
 */

import type { AgendaBoard, AgendaBoardCard, AgendaLane } from '../types/agenda-board';
import type { ReadApiResponse, StatementRecord, TopicTreeNode } from '../types/read-api';
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
const MODE_KEY = 'gw-mode';

export function readPageMode(): PageMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === 'simple' || v === 'advanced') return v;
  } catch {
    /* storage unavailable */
  }
  return 'simple';
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

export function renderTimelineLevels(root: HTMLElement, data: ReadApiResponse, query: URLSearchParams, notice?: string): void {
  const shell = pageShell(root, 'timeline-levels-page', 'Timeline', { notice, fixture: query.get('demo') === 'sample' });
  if (data.access !== 'reviewer_internal') {
    shell.append(el('section', { class: 'gw-state', 'data-test': 'state-reviewer-gated', role: 'status' }, [
      el('h2', {}, ['Reviewer-internal only']),
      el('p', {}, ['The timeline renders no cards outside the reviewer-internal lane.']),
    ]));
    return;
  }

  const level = selectValue(query, 'level', 'month', ['year', 'month', 'day']) as TimelineLevel;
  const type = selectValue(query, 'type', 'all', ['all', 'agenda', 'source', 'undated']) as TimelineEventType;
  const timeline = buildTimeline(data);
  const filtered = timeline.ordered.filter(({ record }) => type === 'all' || eventType(record) === type);
  const byBucket = new Map<string, StatementRecord[]>();
  for (const { record, timelineDate } of filtered) {
    const bucket = dateBucket(timelineDate, level);
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), record]);
  }

  shell.append(el('nav', { class: 'gw-view-toggle', 'data-test': 'timeline-filters', 'aria-label': 'Timeline filters' }, [
    el('span', { class: 'gw-muted' }, [`Level: ${level}`]),
    el('span', { class: 'gw-muted' }, [`Type: ${type}`]),
  ]));

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
      mount.append(el('div', { 'data-test': 'timeline-simple' }, filtered.map(({ record }) => recordCard(record, undefined, undefined, { reviewerInternal: true }))));
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
    mount.append(el('div', { class: 'gw-board', 'data-test': 'timeline-advanced-lanes' }, lanes));
  }), mount);
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
