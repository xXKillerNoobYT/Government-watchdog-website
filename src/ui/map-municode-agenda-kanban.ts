import { safeExternalHref } from '../data/web-safe';
import type { MunicodeAgenda } from '../types/municode-agenda';
import type { KanbanCardSpec, KanbanLaneSpec } from './kanban';
import {
  SOURCE_SNAPSHOT_CARD_LABEL,
  formatSourceSnapshotWhen,
} from './source-snapshot';

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

function sourceAction(sourceUrl: string): HTMLElement {
  const href = safeExternalHref(sourceUrl);
  return el('a', {
    class: 'gw-kanban-open',
    'data-test': 'kanban-card-source',
    ...(href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {}),
  }, ['Official agenda source']);
}

function snapshotWhenAction(snapshotWhen: string | undefined): HTMLElement | null {
  if (!snapshotWhen) return null;
  return el('span', {
    class: 'gw-kanban-snapshot-when',
    'data-test': 'kanban-card-snapshot-when',
  }, [`Snapshot: ${snapshotWhen}`]);
}

const LANE_DEFS: Array<{ id: string; label: string; note?: string }> = [
  { id: 'posted', label: 'Posted', note: 'Agenda posted' },
  { id: 'packet', label: 'Packet', note: 'Packet available' },
  { id: 'hearing', label: 'Hearing / On agenda' },
  { id: 'voted', label: 'Voted / Done' },
];

function cardClock(agenda: MunicodeAgenda, sectionTitle: string): string | null {
  if (sectionTitle.trim().toUpperCase() === 'EXECUTIVE SESSION' && agenda.executiveSessionTime) {
    return agenda.executiveSessionTime;
  }
  return agenda.meetingTime;
}

/** Map a parsed Municode agenda onto the four Alpine lifecycle Kanban lanes. */
export function mapMunicodeAgendaToKanbanLanes(agenda: MunicodeAgenda): KanbanLaneSpec[] {
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
      const snapshotWhen = formatSourceSnapshotWhen(agenda.meetingDate, cardClock(agenda, section.title));
      const whenAction = snapshotWhenAction(snapshotWhen);
      const card: KanbanCardSpec = {
        id: `alpine-${datePart}-s${section.number}-${item.letter}`,
        title: item.title,
        ...(item.description ? { detail: item.description } : {}),
        level: 'town',
        board,
        area: `${section.number}. ${section.title}`,
        when: snapshotWhen,
        flags: [
          SOURCE_SNAPSHOT_CARD_LABEL,
          ...(item.attachments.length
            ? [`${item.attachments.length} attachment${item.attachments.length === 1 ? '' : 's'}`]
            : []),
        ],
        actions: [
          sourceAction(agenda.sourceUrl),
          ...(whenAction ? [whenAction] : []),
        ],
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
