import { safeExternalHref } from '../data/web-safe';
import type { LegistarAgenda } from '../types/legistar-agenda';
import type { KanbanCardSpec, KanbanLaneSpec } from './kanban';
import {
  SOURCE_SNAPSHOT_CARD_LABEL,
  formatSourceSnapshotCapturedAt,
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
  }, ['Official meeting source']);
}

function textAction(testId: string, prefix: string, value: string | undefined): HTMLElement | null {
  if (!value) return null;
  return el('span', {
    class: `gw-${testId}`,
    'data-test': testId,
  }, [`${prefix}: ${value}`]);
}

const LANE_DEFS: Array<{ id: string; label: string; note?: string }> = [
  { id: 'posted', label: 'Posted', note: 'Agenda posted' },
  { id: 'packet', label: 'Packet', note: 'Packet available' },
  { id: 'hearing', label: 'Hearing / On agenda' },
  { id: 'voted', label: 'Voted / Done' },
];

export function mapLegistarAgendaToKanbanLanes(
  agenda: LegistarAgenda,
): KanbanLaneSpec[] {
  const cardsByLane: Record<string, KanbanCardSpec[]> = {
    posted: [],
    packet: [],
    hearing: [],
    voted: [],
  };
  const snapshotWhen = formatSourceSnapshotWhen(agenda.meetingDate, agenda.meetingTime);
  const capturedAt = formatSourceSnapshotCapturedAt(agenda.capturedAtUtc);

  for (const item of agenda.items) {
    const laneId = item.attachments.length > 0 ? 'packet' : 'posted';
    const whenAction = textAction('kanban-card-snapshot-when', 'Snapshot', snapshotWhen);
    const captureAction = textAction('kanban-card-captured-at', 'Captured', capturedAt);
    const card: KanbanCardSpec = {
      id: `sandy-2026-09-29-i${item.eventItemId}`,
      title: item.title,
      level: 'town',
      board: `Sandy ${agenda.bodyName}`,
      area: `${item.agendaNumber} ${item.section}`.trim(),
      when: snapshotWhen,
      flags: [
        SOURCE_SNAPSHOT_CARD_LABEL,
        ...(item.attachments.length > 0
          ? [`${item.attachments.length} attachment${item.attachments.length === 1 ? '' : 's'}`]
          : []),
        ...(item.matterFile ? [`File ${item.matterFile}`] : []),
      ],
      actions: [
        sourceAction(agenda.sourceUrl),
        ...(whenAction ? [whenAction] : []),
        ...(captureAction ? [captureAction] : []),
      ],
    };
    cardsByLane[laneId].push(card);
  }

  return LANE_DEFS.map((lane) => ({
    id: lane.id,
    label: lane.label,
    note: lane.note,
    cards: cardsByLane[lane.id] ?? [],
  }));
}
