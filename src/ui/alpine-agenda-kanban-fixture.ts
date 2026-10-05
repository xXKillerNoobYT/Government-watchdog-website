/** Gated synthetic four-stage Alpine agenda lifecycle fixture. */
import { safeExternalHref } from '../data/web-safe';
import { kanbanBoard, type KanbanLaneSpec } from './kanban';
import { GW_TOKENS } from './tokens';

export interface AlpineAgendaKanbanFixtureOptions {
  access?: string;
  fixture?: boolean;
}

export const DESIGN_FIXTURE_LABEL = 'SYNTHETIC DESIGN FIXTURE — not a live read';

export const ALPINE_AGENDA_LANES: KanbanLaneSpec[] = [
  {
    id: 'posted',
    label: 'Posted',
    note: 'Agenda posted',
    cards: [
      {
        id: 'alpine-fx-posted-1',
        title: 'Sept 16 regular meeting agenda posted',
        level: 'town',
        board: 'Alpine Town Council',
        area: 'Synthetic sample',
        when: 'Fixture date',
        last: 'Sample agenda entered the fixture.',
        next: 'Wait for the sample packet.',
      },
      {
        id: 'alpine-fx-posted-2',
        title: 'Special session agenda posted',
        level: 'town',
        board: 'Alpine Town Council',
        area: 'Synthetic sample',
        when: 'Fixture date',
        last: 'Sample notice was added.',
        next: 'Attach the sample packet.',
      },
    ],
  },
  {
    id: 'packet',
    label: 'Packet',
    note: 'Packet available',
    cards: [
      {
        id: 'alpine-fx-packet-1',
        title: 'Packet PDF available — council chamber',
        level: 'town',
        board: 'Alpine Town Council',
        area: 'Synthetic sample',
        when: 'Fixture date',
        last: 'Sample packet was attached.',
        next: 'Review before the fixture hearing.',
      },
      {
        id: 'alpine-fx-packet-2',
        title: 'Work session packet available',
        level: 'town',
        board: 'Alpine Town Council',
        area: 'Synthetic sample',
        when: 'Fixture date',
        last: 'Sample supporting material was added.',
        next: 'Move to the sample agenda.',
      },
    ],
  },
  {
    id: 'hearing',
    label: 'Hearing / On agenda',
    cards: [
      {
        id: 'alpine-fx-hearing-1',
        title: 'Public hearing — short-term rental ordinance',
        level: 'town',
        board: 'Alpine Town Council',
        area: 'Synthetic sample',
        when: 'Fixture meeting',
        last: 'Sample packet review completed.',
        next: 'Record the fixture outcome.',
      },
      {
        id: 'alpine-fx-hearing-2',
        title: 'Budget workshop on agenda',
        level: 'town',
        board: 'Alpine Town Council',
        area: 'Synthetic sample',
        when: 'Fixture meeting',
        last: 'Sample item reached the agenda.',
        next: 'Await a sample vote.',
      },
    ],
  },
  {
    id: 'voted',
    label: 'Voted / Done',
    cards: [
      {
        id: 'alpine-fx-voted-1',
        title: 'Resolution 2026-018 adopted',
        level: 'town',
        board: 'Alpine Town Council',
        area: 'Synthetic sample',
        when: 'Fixture outcome',
        last: 'Sample vote was recorded.',
        next: 'Fixture lifecycle complete.',
      },
      {
        id: 'alpine-fx-voted-2',
        title: 'Sample consent item approved',
        level: 'town',
        board: 'Alpine Town Council',
        area: 'Synthetic sample',
        when: 'Fixture outcome',
        last: 'Sample action was marked done.',
        next: 'No live follow-up is represented.',
      },
    ],
  },
];

const STYLE = `${GW_TOKENS}
.gw-alpine-agenda{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-4);max-width:1200px;margin:0 auto;padding:var(--gw-space-5) var(--gw-space-4);color:var(--gw-text);font-family:var(--gw-font)}
.gw-alpine-agenda-banner{margin:0;border:var(--gw-border-w) solid var(--gw-tone-caution-line);border-radius:var(--gw-radius-sm);background:var(--gw-tone-caution-well);color:var(--gw-caution-text);padding:var(--gw-space-2) var(--gw-space-3);font:700 var(--gw-text-badge)/1.4 var(--gw-font-mono)}
.gw-alpine-agenda-head{display:grid;gap:var(--gw-space-2)}
.gw-alpine-agenda-head h1,.gw-alpine-agenda-head p{margin:0}
.gw-alpine-agenda-head p{max-width:68ch;color:var(--gw-text-secondary)}
.gw-alpine-agenda-gate{max-width:52rem;margin:var(--gw-space-6) auto;padding:var(--gw-space-6);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);color:var(--gw-text);font-family:var(--gw-font)}
`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'href' && safeExternalHref(value) === null) {
      node.setAttribute('data-href-refused', 'unsafe-scheme');
      return;
    }
    node.setAttribute(key, value);
  });
  children.forEach((child) => node.append(typeof child === 'string' ? document.createTextNode(child) : child));
  return node;
}

function ensureStyle(): void {
  if (document.getElementById('gw-alpine-agenda-style')) return;
  document.head.append(el('style', { id: 'gw-alpine-agenda-style' }, [STYLE]));
}

export function renderAlpineAgendaKanbanFixture(
  root: HTMLElement,
  options: AlpineAgendaKanbanFixtureOptions = {},
): void {
  ensureStyle();
  root.replaceChildren();

  if (options.access !== 'reviewer_internal' || options.fixture !== true) {
    root.className = 'gw-alpine-agenda-gate';
    root.append(el('section', { 'data-test': 'alpine-agenda-kanban-unavailable' }, [
      el('h1', {}, ['Alpine agenda fixture unavailable']),
      el('p', {}, ['Reviewer-internal access and explicit fixture mode are required.']),
    ]));
    return;
  }

  root.className = 'gw-alpine-agenda';
  const page = el('section', {
    'data-test': 'alpine-agenda-kanban-page',
    'data-origin': 'synthetic-design-fixture',
    'data-fixture': 'synthetic',
  });
  page.append(
    el('p', {
      class: 'gw-alpine-agenda-banner',
      role: 'status',
      'data-test': 'alpine-agenda-kanban-banner',
    }, [DESIGN_FIXTURE_LABEL]),
    el('header', { class: 'gw-alpine-agenda-head' }, [
      el('h1', {}, ['Alpine agenda lifecycle']),
      el('p', {}, [
        'Posted → Packet → Hearing → Voted. This synthetic board demonstrates the four-stage lifecycle only; it is not a live civic read.',
      ]),
    ]),
  );

  const board = kanbanBoard(ALPINE_AGENDA_LANES, 'Alpine agenda lifecycle');
  board.querySelectorAll('[data-test="kanban-card"]')
    .forEach((card) => card.setAttribute('data-origin', 'fixture'));
  page.append(board);
  root.append(page);
}
