// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { renderAlpineAgendaMunicode } from '../src/ui/alpine-agenda-municode';
import {
  SOURCE_SNAPSHOT_BINDING,
  SOURCE_SNAPSHOT_CARD_LABEL,
  SOURCE_SNAPSHOT_INFORMATION_CLASS,
} from '../src/ui/source-snapshot';
import { ALPINE_APR21_2026_MUNICODE_URL } from '../src/data/municode-alpine-fixture';

let root: HTMLElement;

beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
});

describe('Alpine agenda Municode source snapshot (SS)', () => {
  it('fails closed without reviewer access and source=municode', () => {
    renderAlpineAgendaMunicode(root, { access: 'public', source: 'municode' });
    expect(root.querySelector('[data-test="alpine-agenda-kanban-unavailable"]')).not.toBeNull();
  });

  it('renders SS binding stamps and does not use the synthetic fixture banner', () => {
    renderAlpineAgendaMunicode(root, { access: 'reviewer_internal', source: 'municode' });

    const page = root.querySelector('[data-test="alpine-agenda-kanban-page"]');
    expect(page?.getAttribute('data-binding')).toBe(SOURCE_SNAPSHOT_BINDING);
    expect(page?.getAttribute('data-information-class')).toBe(SOURCE_SNAPSHOT_INFORMATION_CLASS);
    expect(root.querySelector('[data-test="alpine-agenda-kanban-banner"]')).toBeNull();

    const banner = root.querySelector('[data-test="alpine-agenda-municode-banner"]');
    expect(banner?.textContent).toContain('SOURCE SNAPSHOT');
    expect(banner?.textContent).not.toContain('SYNTHETIC DESIGN FIXTURE');
  });

  it('stamps every card with SS rules: label, source URL, snapshot date/time, parser-only copy', () => {
    renderAlpineAgendaMunicode(root, { access: 'reviewer_internal', source: 'municode' });

    const cards = [...root.querySelectorAll('[data-test="kanban-card"]')];
    expect(cards.length).toBe(39);

    for (const card of cards) {
      expect(card.getAttribute('data-binding')).toBe(SOURCE_SNAPSHOT_BINDING);
      expect(card.getAttribute('data-information-class')).toBe(SOURCE_SNAPSHOT_INFORMATION_CLASS);
      expect(card.getAttribute('data-origin')).toBe('municode-snapshot');
      expect(card.textContent).toContain(SOURCE_SNAPSHOT_CARD_LABEL);
      expect(card.textContent).not.toContain('Listed on the published agenda');
      expect(card.querySelector('[data-test="kanban-card-source"]')?.getAttribute('href'))
        .toBe(ALPINE_APR21_2026_MUNICODE_URL);
      expect(card.querySelector('[data-test="kanban-card-snapshot-when"]')?.textContent)
        .toMatch(/Snapshot:.*2026.*06:00 PM/);
      expect(card.querySelector('.gw-kanban-track')).toBeNull();
    }
  });
});
