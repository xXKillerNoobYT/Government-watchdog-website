/** Alpine agenda board from a committed Municode HTML snapshot (issue #295). */
import parsedAgenda from '../fixtures/municode/alpine-town-council-2026-10-06.parsed.json';
import type { MunicodeAgenda } from '../types/municode-agenda';
import { safeExternalHref } from '../data/web-safe';
import { kanbanBoard } from './kanban';
import { mapMunicodeAgendaToKanbanLanes } from './map-municode-agenda-kanban';
import {
  SOURCE_SNAPSHOT_BINDING,
  SOURCE_SNAPSHOT_INFORMATION_CLASS,
} from './source-snapshot';
import { GW_TOKENS } from './tokens';

export const MUNICODE_SNAPSHOT_PAGE_NOTICE =
  'SOURCE SNAPSHOT — parser-extracted official agenda items; not reviewed (class SS)';

export interface AlpineAgendaMunicodeOptions {
  access?: string;
  source?: string;
}

const STYLE = `${GW_TOKENS}
.gw-alpine-agenda{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-4);max-width:1200px;margin:0 auto;padding:var(--gw-space-5) var(--gw-space-4);color:var(--gw-text);font-family:var(--gw-font)}
.gw-alpine-agenda-banner{margin:0;border:var(--gw-border-w) solid var(--gw-tone-caution-line);border-radius:var(--gw-radius-sm);background:var(--gw-tone-caution-well);color:var(--gw-caution-text);padding:var(--gw-space-2) var(--gw-space-3);font:700 var(--gw-text-badge)/1.4 var(--gw-font-mono)}
.gw-alpine-agenda-head{display:grid;gap:var(--gw-space-2)}
.gw-alpine-agenda-head h1,.gw-alpine-agenda-head p{margin:0}
.gw-alpine-agenda-head p{max-width:68ch;color:var(--gw-text-secondary)}
.gw-alpine-agenda-gate{max-width:52rem;margin:var(--gw-space-6) auto;padding:var(--gw-space-6);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);color:var(--gw-text);font-family:var(--gw-font)}
.gw-alpine-agenda-meta{font-size:var(--gw-text-sm);color:var(--gw-text-secondary)}
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

function buildLanes() {
  const agenda = parsedAgenda as MunicodeAgenda;
  return { agenda, lanes: mapMunicodeAgendaToKanbanLanes(agenda) };
}

export function renderAlpineAgendaMunicode(
  root: HTMLElement,
  options: AlpineAgendaMunicodeOptions = {},
): void {
  ensureStyle();
  root.replaceChildren();

  if (options.access !== 'reviewer_internal' || options.source !== 'municode') {
    root.className = 'gw-alpine-agenda-gate';
    root.append(el('section', { 'data-test': 'alpine-agenda-kanban-unavailable' }, [
      el('h1', {}, ['Alpine agenda snapshot unavailable']),
      el('p', {}, ['Reviewer-internal access and `?source=municode` are required.']),
    ]));
    return;
  }

  const { agenda, lanes } = buildLanes();
  root.className = 'gw-alpine-agenda';
  const page = el('section', {
    'data-test': 'alpine-agenda-kanban-page',
    'data-origin': 'municode-snapshot',
    'data-binding': SOURCE_SNAPSHOT_BINDING,
    'data-information-class': SOURCE_SNAPSHOT_INFORMATION_CLASS,
  });

  const metaParts = [
    agenda.meetingTitle,
    agenda.meetingDate ?? 'Date not parseable from capture',
    agenda.location ?? 'Location missing from capture',
  ];

  page.append(
    el('p', {
      class: 'gw-alpine-agenda-banner',
      role: 'status',
      'data-test': 'alpine-agenda-municode-banner',
    }, [MUNICODE_SNAPSHOT_PAGE_NOTICE]),
    el('header', { class: 'gw-alpine-agenda-head' }, [
      el('h1', {}, ['Alpine agenda lifecycle']),
      el('p', {}, [
        'Posted → Packet → Hearing → Voted. Cards are parsed from a committed Municode HTML capture only; hearing and voted stages stay empty until minutes and outcomes exist in a reviewed projection.',
      ]),
      el('p', { class: 'gw-alpine-agenda-meta', 'data-test': 'alpine-agenda-municode-meta' }, [metaParts.join(' · ')]),
    ]),
  );

  if (agenda.gaps.length) {
    page.append(el('p', {
      class: 'gw-alpine-agenda-meta',
      'data-test': 'alpine-agenda-municode-gaps',
    }, [agenda.gaps.join(' ')]));
  }

  const board = kanbanBoard(lanes, 'Alpine agenda lifecycle');
  board.querySelectorAll('[data-test="kanban-card"]')
    .forEach((card) => {
      card.setAttribute('data-origin', 'municode-snapshot');
      card.setAttribute('data-binding', SOURCE_SNAPSHOT_BINDING);
      card.setAttribute('data-information-class', SOURCE_SNAPSHOT_INFORMATION_CLASS);
    });
  page.append(board);
  root.append(page);
}
