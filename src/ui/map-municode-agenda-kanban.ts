import { safeExternalHref } from '../data/web-safe';
import type { MunicodeAgenda } from '../types/municode-agenda';
import type { KanbanCardSpec, KanbanLaneSpec } from './kanban';

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

function formatWhen(isoDate: string | null): string | undefined {
  if (!isoDate) return undefined;
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function sourceAction(sourceUrl: string): HTMLElement {
  const href = safeExternalHref(sourceUrl);
  return el('a', {
    class: 'gw-kanban-open',
    'data-test': 'kanban-card-source',
    ...(href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {}),
  }, ['Municode agenda source']);
}

const LANE_DEFS: Array<{ id: string; label: string; note?: string }> = [
  { id: 'posted', label: 'Posted', note: 'Agenda posted' },
  { id: 'packet', label: 'Packet', note: 'Packet available' },
  { id: 'hearing', label: 'Hearing / On agenda' },
  { id: 'voted', label: 'Voted / Done' },
];

/** Map a parsed Municode agenda onto the four Alpine lifecycle Kanban lanes. */
export function mapMunicodeAgendaToKanbanLanes(agenda: MunicodeAgenda): KanbanLaneSpec[] {
  const when = formatWhen(agenda.meetingDate);
  const board = agenda.meetingTitle || 'Alpine Town Council';
  const cardsByLane: Record<string, KanbanCardSpec[]> = {
    posted: [],
    packet: [],
    hearing: [],
    voted: [],
  };

  for (const section of agenda.sections) {
    for (const item of section.items) {
      const laneId = item.attachments.length > 0 ? 'packet' : 'posted';
      const datePart = agenda.meetingDate ?? 'undated';
      const card: KanbanCardSpec = {
        id: `alpine-${datePart}-s${section.number}-${item.letter}`,
        title: item.title,
        level: 'town',
        board,
        area: `${section.number}. ${section.title}`,
        when,
        flags: item.attachments.length
          ? [`${item.attachments.length} attachment${item.attachments.length === 1 ? '' : 's'}`]
          : undefined,
        last: 'Listed on the published agenda.',
        actions: [sourceAction(agenda.sourceUrl)],
      };
      cardsByLane[laneId].push(card);
    }
  }

  return LANE_DEFS.map((lane) => ({
    id: lane.id,
    label: lane.label,
    note: lane.note,
    cards: cardsByLane[lane.id] ?? [],
  }));
}
