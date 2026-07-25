// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { kanbanBoard, kanbanCard, kanbanLane, type KanbanLaneSpec } from '../src/ui/kanban';

const LANES: KanbanLaneSpec[] = [
  {
    id: 'captured',
    label: 'Captured',
    cards: [
      { id: 'c1', title: 'Building moratorium', level: 'town', board: 'Town Council', when: 'Tue Jul 21' },
      { id: 'c2', title: 'Road bids', level: 'county', flags: ['▲ late change'] },
    ],
  },
  { id: 'voted', label: 'Voted', cards: [] },
];

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('kanban primitives', () => {
  it('renders one lane per spec with its card count', () => {
    const board = kanbanBoard(LANES);
    expect(board.getAttribute('data-test')).toBe('kanban-board');
    const lanes = board.querySelectorAll('[data-test="kanban-lane"]');
    expect(lanes).toHaveLength(2);
    const counts = [...board.querySelectorAll('[data-test="kanban-lane-count"]')].map((n) => n.textContent);
    expect(counts).toEqual(['2', '0']);
  });

  it('shows an explicit empty state rather than inventing cards', () => {
    const lane = kanbanLane({ id: 'voted', label: 'Voted', cards: [] });
    expect(lane.querySelector('[data-test="kanban-lane-empty"]')?.textContent).toContain('No cards');
    expect(lane.querySelectorAll('[data-test="kanban-card"]')).toHaveLength(0);
  });

  it('exposes the level only as a colour-bar hook', () => {
    const card = kanbanCard({ id: 'c1', title: 'Annexation', level: 'state' });
    expect(card.getAttribute('data-level')).toBe('state');
    expect(card.getAttribute('data-card-id')).toBe('c1');
  });

  it('omits the level attribute when none is supplied', () => {
    const card = kanbanCard({ id: 'c9', title: 'Unscoped item' });
    expect(card.hasAttribute('data-level')).toBe(false);
  });

  it('renders meta, flags, and last/next tracking lines only when provided', () => {
    const full = kanbanCard({
      id: 'c1',
      title: 'Fees',
      board: 'P&Z',
      area: 'Land use',
      when: 'Aug 4',
      flags: ['▲ late change'],
      last: 'Packet posted',
      next: 'Vote Aug 18',
    });
    expect(full.querySelector('[data-test="kanban-card-meta"]')?.textContent).toContain('P&Z');
    expect(full.querySelector('[data-test="kanban-card-flags"]')?.textContent).toContain('late change');
    expect(full.textContent).toContain('Packet posted');
    expect(full.textContent).toContain('Vote Aug 18');

    const bare = kanbanCard({ id: 'c2', title: 'Bare' });
    expect(bare.querySelector('[data-test="kanban-card-meta"]')).toBeNull();
    expect(bare.querySelector('[data-test="kanban-card-flags"]')).toBeNull();
  });

  it('mounts caller-supplied action controls', () => {
    const button = document.createElement('button');
    button.dataset.test = 'track-toggle';
    const card = kanbanCard({ id: 'c1', title: 'Fees', actions: [button] });
    expect(card.querySelector('[data-test="track-toggle"]')).not.toBeNull();
  });

  it('labels each lane for assistive technology', () => {
    const board = kanbanBoard(LANES);
    const first = board.querySelector('[data-test="kanban-lane"]');
    expect(first?.getAttribute('aria-label')).toBe('Captured — 2 cards');
  });

  it('injects its stylesheet once', () => {
    kanbanBoard(LANES);
    kanbanBoard(LANES);
    expect(document.querySelectorAll('#gw-kanban-style')).toHaveLength(1);
  });
});
