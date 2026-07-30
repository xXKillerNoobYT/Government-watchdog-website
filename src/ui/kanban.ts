/**
 * Kanban lane/card primitives for the MOTY "Issue Tracker" board.
 *
 * Layout-only: the caller supplies lanes and cards. This module never derives a
 * stage, never invents a card, and never maps reviewed agenda-board lanes onto
 * the design's seven issue stages — those are different vocabularies, and the
 * binding ledger classifies the seven-stage tracker as a designed gap unless a
 * reviewed contract supplies it.
 *
 * The board scrolls horizontally once lanes exceed the viewport, mirroring the
 * reference pattern; lanes still grow via 1fr.
 */

import { GW_TOKENS } from './tokens';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export type KanbanLevel = 'town' | 'county' | 'state';

export interface KanbanCardSpec {
  /** Stable id used for the card's data-card-id hook. */
  id: string;
  title: string;
  /** Drives the left colour bar; omitted renders a neutral bar. */
  level?: KanbanLevel;
  /** Governing body or owner line. */
  board?: string;
  /** Topic/area chip. */
  area?: string;
  /** Timing line, e.g. "Tue Jul 21". */
  when?: string;
  /** Short flag chips (e.g. "▲ late change"). */
  flags?: string[];
  /** "What last happened" line. */
  last?: string;
  /** "What happens next" line. */
  next?: string;
  /** Optional controls appended to the card footer (track toggle, open button). */
  actions?: HTMLElement[];
}

export interface KanbanLaneSpec {
  id: string;
  label: string;
  cards: KanbanCardSpec[];
  /** Optional sub-label under the lane title. */
  note?: string;
}

export const KANBAN_STYLE = `${GW_TOKENS}
.gw-kanban{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(var(--gw-lane-min),1fr);gap:var(--gw-space-3);overflow-x:auto;padding:var(--gw-space-3);background:var(--gw-board-bg);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg)}
.gw-kanban-lane{display:flex;flex-direction:column;gap:var(--gw-space-3);background:var(--gw-lane-bg);border:var(--gw-border-w) solid var(--gw-border-subtle);border-radius:var(--gw-radius-md);padding:var(--gw-space-3);min-width:var(--gw-lane-min)}
.gw-kanban-lane-head{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-1);background:var(--gw-lane-header-bg);border-radius:var(--gw-radius-sm);padding:var(--gw-space-2) var(--gw-space-3)}
.gw-kanban-lane-title{display:flex;align-items:center;justify-content:space-between;gap:var(--gw-space-2)}
.gw-kanban-lane-name{font:800 var(--gw-text-kicker)/1.3 var(--gw-font);letter-spacing:.09em;color:var(--gw-text-secondary);text-transform:uppercase}
.gw-kanban-lane-count{font:700 var(--gw-text-badge)/1 var(--gw-font-mono);color:var(--gw-text-muted)}
.gw-kanban-lane-note{margin:0;font-size:var(--gw-text-badge);color:var(--gw-text-muted)}
.gw-kanban-lane-body{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-3);align-content:start}
.gw-kanban-card{position:relative;background:var(--gw-card-bg);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-md);padding:var(--gw-space-3) var(--gw-space-3) var(--gw-space-3) var(--gw-space-4);display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-2)}
.gw-kanban-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:var(--gw-radius-md) 0 0 var(--gw-radius-md);background:var(--gw-neutral-border)}
.gw-kanban-card[data-level="town"]::before{background:var(--gw-level-town)}
.gw-kanban-card[data-level="county"]::before{background:var(--gw-level-county)}
.gw-kanban-card[data-level="state"]::before{background:var(--gw-level-state)}
.gw-kanban-card h4{margin:0;font-size:var(--gw-text-md);line-height:var(--gw-leading-tight);color:var(--gw-text)}
.gw-kanban-meta{display:flex;flex-wrap:wrap;gap:var(--gw-space-2);font-size:var(--gw-text-badge);color:var(--gw-text-muted)}
.gw-kanban-meta span{display:inline-flex;align-items:center}
.gw-kanban-flags{display:flex;flex-wrap:wrap;gap:var(--gw-space-1);list-style:none;margin:0;padding:0}
.gw-kanban-flags li{border:var(--gw-border-w) solid var(--gw-caution-line);border-radius:var(--gw-radius-sm);background:var(--gw-caution-bg);color:var(--gw-caution-text);padding:0 var(--gw-space-2);font-size:var(--gw-text-badge)}
.gw-kanban-track{display:grid;grid-template-columns:minmax(0,1fr);gap:2px;font-size:var(--gw-text-badge);color:var(--gw-text-secondary)}
.gw-kanban-track b{font-weight:700;color:var(--gw-text-muted);letter-spacing:.04em}
.gw-kanban-actions{display:flex;flex-wrap:wrap;gap:var(--gw-space-2)}
.gw-kanban-empty{margin:0;padding:var(--gw-space-3);border:var(--gw-border-w) dashed var(--gw-border);border-radius:var(--gw-radius-sm);color:var(--gw-text-muted);font-size:var(--gw-text-sm)}
@media print{.gw-kanban{grid-auto-flow:row;grid-auto-columns:auto;overflow:visible}}
`;

export function ensureKanbanStyle(): void {
  if (document.getElementById('gw-kanban-style')) return;
  document.head.append(el('style', { id: 'gw-kanban-style' }, [KANBAN_STYLE]));
}

/** One card. Level drives only the colour bar — never a claim about the record. */
export function kanbanCard(spec: KanbanCardSpec): HTMLElement {
  ensureKanbanStyle();
  const attrs: Record<string, string> = {
    class: 'gw-kanban-card',
    'data-test': 'kanban-card',
    'data-card-id': spec.id,
  };
  if (spec.level) attrs['data-level'] = spec.level;

  const children: HTMLElement[] = [el('h4', {}, [spec.title])];

  const meta = [spec.board, spec.area, spec.when].filter((value): value is string => Boolean(value));
  if (meta.length) {
    children.push(el('div', { class: 'gw-kanban-meta', 'data-test': 'kanban-card-meta' },
      meta.map((value) => el('span', {}, [value]))));
  }

  if (spec.flags?.length) {
    children.push(el('ul', { class: 'gw-kanban-flags', 'data-test': 'kanban-card-flags' },
      spec.flags.map((flag) => el('li', {}, [flag]))));
  }

  if (spec.last || spec.next) {
    const track = el('div', { class: 'gw-kanban-track' });
    if (spec.last) track.append(el('span', {}, [el('b', {}, ['Last: ']), spec.last]));
    if (spec.next) track.append(el('span', {}, [el('b', {}, ['Next: ']), spec.next]));
    children.push(track);
  }

  if (spec.actions?.length) {
    children.push(el('div', { class: 'gw-kanban-actions' }, spec.actions));
  }

  return el('article', attrs, children);
}

/** One lane column with its header count. */
export function kanbanLane(spec: KanbanLaneSpec): HTMLElement {
  ensureKanbanStyle();
  const head = el('div', { class: 'gw-kanban-lane-head' }, [
    el('div', { class: 'gw-kanban-lane-title' }, [
      el('span', { class: 'gw-kanban-lane-name', 'data-test': 'kanban-lane-name' }, [spec.label]),
      el('span', { class: 'gw-kanban-lane-count', 'data-test': 'kanban-lane-count' }, [String(spec.cards.length)]),
    ]),
  ]);
  if (spec.note) {
    head.append(el('p', { class: 'gw-kanban-lane-note' }, [spec.note]));
  }

  const body = el('div', { class: 'gw-kanban-lane-body' },
    spec.cards.length
      ? spec.cards.map(kanbanCard)
      : [el('p', { class: 'gw-kanban-empty', 'data-test': 'kanban-lane-empty' }, ['No cards in this stage.'])]);

  return el('section', {
    class: 'gw-kanban-lane',
    'data-test': 'kanban-lane',
    'data-lane-id': spec.id,
    'aria-label': `${spec.label} — ${spec.cards.length} card${spec.cards.length === 1 ? '' : 's'}`,
  }, [head, body]);
}

/** The full horizontally-scrolling board. */
export function kanbanBoard(lanes: KanbanLaneSpec[], label = 'Issue tracker'): HTMLElement {
  ensureKanbanStyle();
  return el('div', {
    class: 'gw-kanban',
    role: 'group',
    'aria-label': label,
    'data-test': 'kanban-board',
  }, lanes.map(kanbanLane));
}
