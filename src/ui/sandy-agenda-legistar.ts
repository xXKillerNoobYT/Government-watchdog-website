import { safeExternalHref } from '../data/web-safe';
import parsedAgenda from '../fixtures/legistar/sandy-city-council-2026-09-29.parsed.json';
import type { LegistarAgenda } from '../types/legistar-agenda';
import { kanbanBoard } from './kanban';
import { mapLegistarAgendaToKanbanLanes } from './map-legistar-agenda-kanban';
import {
  SOURCE_SNAPSHOT_BINDING,
  SOURCE_SNAPSHOT_INFORMATION_CLASS,
} from './source-snapshot';
import { GW_TOKENS } from './tokens';

export const LEGISTAR_SNAPSHOT_PAGE_NOTICE =
  'SOURCE SNAPSHOT — parser-extracted official agenda items; not reviewed (class SS)';

export interface SandyAgendaLegistarOptions {
  access?: string;
  source?: string;
}

const STYLE = `${GW_TOKENS}
.gw-sandy-agenda{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-4);max-width:1200px;margin:0 auto;padding:var(--gw-space-5) var(--gw-space-4);color:var(--gw-text);font-family:var(--gw-font)}
.gw-sandy-agenda a[href]{display:inline-flex;align-items:center;min-height:var(--gw-tap-min)}
.gw-sandy-agenda-banner{margin:0;border:var(--gw-border-w) solid var(--gw-tone-caution-line);border-radius:var(--gw-radius-sm);background:var(--gw-tone-caution-well);color:var(--gw-caution-text);padding:var(--gw-space-2) var(--gw-space-3);font:700 var(--gw-text-badge)/1.4 var(--gw-font-mono)}
.gw-sandy-agenda-head{display:grid;gap:var(--gw-space-2)}
.gw-sandy-agenda-head h1,.gw-sandy-agenda-head p{margin:0}
.gw-sandy-agenda-meta,.gw-sandy-agenda-gaps{font-size:var(--gw-text-sm);color:var(--gw-text-secondary)}
.gw-sandy-agenda-gaps{margin:0;padding-left:var(--gw-space-5)}
.gw-sandy-agenda-gate{max-width:52rem;margin:var(--gw-space-6) auto;padding:var(--gw-space-6);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);color:var(--gw-text);font-family:var(--gw-font)}
`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'href' && safeExternalHref(value) === null) {
      node.setAttribute('data-href-refused', 'unsafe-scheme');
      continue;
    }
    node.setAttribute(key, value);
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function ensureStyle(): void {
  if (document.getElementById('gw-sandy-agenda-style')) return;
  document.head.append(el('style', { id: 'gw-sandy-agenda-style' }, [STYLE]));
}

export function renderSandyAgendaLegistar(
  root: HTMLElement,
  options: SandyAgendaLegistarOptions = {},
): void {
  ensureStyle();
  root.replaceChildren();

  if (options.access !== 'reviewer_internal' || options.source !== 'legistar') {
    root.className = 'gw-sandy-agenda-gate';
    root.append(el('section', { 'data-test': 'sandy-agenda-legistar-unavailable' }, [
      el('h1', {}, ['Sandy agenda snapshot unavailable']),
      el('p', {}, ['Reviewer-internal access and `?source=legistar` are required.']),
    ]));
    return;
  }

  const agenda: LegistarAgenda = parsedAgenda;
  const page = el('section', {
    'data-test': 'sandy-agenda-legistar-page',
    'data-origin': 'legistar-snapshot',
    'data-binding': SOURCE_SNAPSHOT_BINDING,
    'data-information-class': SOURCE_SNAPSHOT_INFORMATION_CLASS,
  });
  const header = el('header', { class: 'gw-sandy-agenda-head' }, [
    el('h1', {}, [`Sandy ${agenda.bodyName}`]),
    el('p', { class: 'gw-sandy-agenda-meta', 'data-test': 'sandy-agenda-legistar-meta' }, [
      [agenda.meetingDate, agenda.meetingTime, agenda.location].filter(Boolean).join(' · '),
    ]),
  ]);
  if (agenda.agendaPdfUrl) {
    header.append(el('a', {
      'data-test': 'sandy-agenda-legistar-agenda-pdf',
      href: agenda.agendaPdfUrl,
      target: '_blank',
      rel: 'noopener noreferrer',
    }, ['Official agenda PDF']));
  }

  page.append(
    el('p', {
      class: 'gw-sandy-agenda-banner',
      role: 'status',
      'data-test': 'sandy-agenda-legistar-banner',
    }, [LEGISTAR_SNAPSHOT_PAGE_NOTICE]),
    header,
  );
  if (agenda.gaps.length > 0) {
    page.append(el('ul', {
      class: 'gw-sandy-agenda-gaps',
      'data-test': 'sandy-agenda-legistar-gaps',
    }, agenda.gaps.map((gap) => el('li', {}, [gap]))));
  }

  const board = kanbanBoard(
    mapLegistarAgendaToKanbanLanes(agenda),
    `Sandy ${agenda.bodyName}`,
  );
  board.querySelectorAll('[data-test="kanban-card"]').forEach((card) => {
    card.setAttribute('data-origin', 'legistar-snapshot');
    card.setAttribute('data-binding', SOURCE_SNAPSHOT_BINDING);
    card.setAttribute('data-information-class', SOURCE_SNAPSHOT_INFORMATION_CLASS);
  });
  page.append(board);
  root.className = 'gw-sandy-agenda';
  root.append(page);
}
