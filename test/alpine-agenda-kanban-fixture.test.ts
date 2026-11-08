// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ALPINE_AGENDA_LANES,
  renderAlpineAgendaKanbanFixture,
} from '../src/ui/alpine-agenda-kanban-fixture';

let root: HTMLElement;

beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
});

describe('Alpine agenda Kanban fixture', () => {
  it.each([
    {},
    { access: 'reviewer_internal', fixture: false },
    { access: 'public', fixture: true },
  ])('fails closed without both grants: %o', (options) => {
    renderAlpineAgendaKanbanFixture(root, options);

    expect(root.querySelector('[data-test="alpine-agenda-kanban-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="alpine-agenda-kanban-page"]')).toBeNull();
    expect(root.querySelector('[data-test="alpine-agenda-kanban-banner"]')).toBeNull();
    expect(root.querySelectorAll('[data-test="kanban-card"]')).toHaveLength(0);
  });

  it('renders exactly the four lifecycle lanes with admitted fixture access', () => {
    renderAlpineAgendaKanbanFixture(root, { access: 'reviewer_internal', fixture: true });

    const lanes = [...root.querySelectorAll('[data-test="kanban-lane"]')];
    expect(lanes).toHaveLength(4);
    expect(lanes.map((lane) => lane.getAttribute('data-lane-id')))
      .toEqual(['posted', 'packet', 'hearing', 'voted']);
    expect(lanes.map((lane) => lane.textContent)).toEqual([
      expect.stringMatching(/Posted/i),
      expect.stringMatching(/Packet/i),
      expect.stringMatching(/Hearing|On agenda/i),
      expect.stringMatching(/Voted|Done/i),
    ]);
  });

  it('labels the fixture honestly and stamps its synthetic origin', () => {
    renderAlpineAgendaKanbanFixture(root, { access: 'reviewer_internal', fixture: true });

    const banner = root.querySelector('[data-test="alpine-agenda-kanban-banner"]');
    expect(banner?.textContent).toContain('SYNTHETIC DESIGN FIXTURE');
    expect(banner?.textContent).toContain('not a live read');
    const page = root.querySelector('[data-test="alpine-agenda-kanban-page"]');
    expect(page?.getAttribute('data-origin')).toBe('synthetic-design-fixture');
    expect(page?.getAttribute('data-fixture')).toBe('synthetic');
  });

  it('renders synthetic cards in every lane', () => {
    renderAlpineAgendaKanbanFixture(root, { access: 'reviewer_internal', fixture: true });

    const cards = [...root.querySelectorAll('[data-test="kanban-card"]')];
    expect(cards.length).toBeGreaterThanOrEqual(6);
    expect(ALPINE_AGENDA_LANES.every((lane) => lane.cards.length > 0)).toBe(true);
    expect(root.querySelectorAll('[data-test="kanban-lane"] [data-test="kanban-card"]')).toHaveLength(cards.length);
    for (const card of cards) expect(card.getAttribute('data-origin')).toBe('fixture');
  });
});
