// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { SANDY_SEP29_2026_LEGISTAR_EVENT_URL } from '../src/data/legistar-sandy-fixture';
import {
  SOURCE_SNAPSHOT_BINDING,
  SOURCE_SNAPSHOT_CARD_LABEL,
  SOURCE_SNAPSHOT_INFORMATION_CLASS,
} from '../src/ui/source-snapshot';
import { renderSandyAgendaLegistar } from '../src/ui/sandy-agenda-legistar';

let root: HTMLElement;

beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
});

describe('Sandy agenda Legistar source snapshot (SS)', () => {
  it('renders only the unavailable state for public access', () => {
    renderSandyAgendaLegistar(root, { access: 'public', source: 'legistar' });
    expect(root.querySelector('[data-test="sandy-agenda-legistar-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="sandy-agenda-legistar-page"]')).toBeNull();
    expect(root.querySelectorAll('[data-test="kanban-card"]')).toHaveLength(0);
  });

  it('renders seven parser-only SS cards for reviewer access and source=legistar', () => {
    renderSandyAgendaLegistar(root, { access: 'reviewer_internal', source: 'legistar' });

    const page = root.querySelector('[data-test="sandy-agenda-legistar-page"]');
    expect(page?.getAttribute('data-origin')).toBe('legistar-snapshot');
    expect(page?.getAttribute('data-binding')).toBe(SOURCE_SNAPSHOT_BINDING);
    expect(page?.getAttribute('data-information-class')).toBe(SOURCE_SNAPSHOT_INFORMATION_CLASS);
    expect(root.textContent).toContain('Minutes not yet published in the capture');
    expect(root.textContent).not.toContain('SYNTHETIC DESIGN FIXTURE');

    const cards = [...root.querySelectorAll('[data-test="kanban-card"]')];
    expect(cards).toHaveLength(7);
    for (const card of cards) {
      expect(card.getAttribute('data-origin')).toBe('legistar-snapshot');
      expect(card.getAttribute('data-binding')).toBe(SOURCE_SNAPSHOT_BINDING);
      expect(card.getAttribute('data-information-class')).toBe(SOURCE_SNAPSHOT_INFORMATION_CLASS);
      expect(card.textContent).toContain(SOURCE_SNAPSHOT_CARD_LABEL);
      expect(card.querySelector('[data-test="kanban-card-source"]')?.getAttribute('href'))
        .toBe(SANDY_SEP29_2026_LEGISTAR_EVENT_URL);
      expect(card.querySelector('[data-test="kanban-card-snapshot-when"]')?.textContent)
        .toMatch(/Snapshot:.*Sep 29, 2026.*5:15 PM/);
      expect(card.querySelector('[data-test="kanban-card-captured-at"]')?.textContent)
        .toMatch(/Captured:.*Oct 1, 2026.*8:21 AM.*MDT/);
      expect(card.querySelector('[data-test="kanban-card-detail"]')).toBeNull();
      expect(card.querySelector('.gw-kanban-track')).toBeNull();
    }
  });
});
