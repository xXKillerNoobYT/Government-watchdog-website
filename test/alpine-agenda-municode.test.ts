// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { renderAlpineAgendaMunicode } from '../src/ui/alpine-agenda-municode';
import {
  SOURCE_SNAPSHOT_BINDING,
  SOURCE_SNAPSHOT_CARD_LABEL,
  SOURCE_SNAPSHOT_INFORMATION_CLASS,
} from '../src/ui/source-snapshot';
import { ALPINE_OCT6_2026_MUNICODE_URL } from '../src/data/municode-alpine-fixture';
import parsedAgenda from '../src/fixtures/municode/alpine-town-council-2026-10-06.parsed.json';
import type { MunicodeAgenda } from '../src/types/municode-agenda';

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
    expect(cards.length).toBe(14);
    const agenda = parsedAgenda as MunicodeAgenda;
    const described = new Map(
      agenda.sections.flatMap((section) => section.items)
        .filter((item) => item.description)
        .map((item) => [item.title, item.description]),
    );
    expect(described.size).toBe(4);

    for (const card of cards) {
      expect(card.getAttribute('data-binding')).toBe(SOURCE_SNAPSHOT_BINDING);
      expect(card.getAttribute('data-information-class')).toBe(SOURCE_SNAPSHOT_INFORMATION_CLASS);
      expect(card.getAttribute('data-origin')).toBe('municode-snapshot');
      expect(card.textContent).toContain(SOURCE_SNAPSHOT_CARD_LABEL);
      expect(card.textContent).not.toContain('Listed on the published agenda');
      const href = card.querySelector('[data-test="kanban-card-source"]')?.getAttribute('href');
      expect(href).toBe(ALPINE_OCT6_2026_MUNICODE_URL);
      expect(href).not.toContain('#');
      const when = card.querySelector('[data-test="kanban-card-snapshot-when"]')?.textContent;
      if (card.getAttribute('data-card-id') === 'alpine-2026-10-06-s2-a') {
        expect(when).toBe('Snapshot: Tue, Oct 6, 2026 · 6:00 PM');
      } else {
        expect(when).toBe('Snapshot: Tue, Oct 6, 2026 · 7:00 PM');
      }
      expect(card.querySelector('.gw-kanban-track')).toBeNull();
      const title = card.querySelector('h4')?.textContent ?? '';
      const detail = card.querySelector('[data-test="kanban-card-detail"]')?.textContent;
      if (described.has(title)) {
        expect(detail).toBe(described.get(title));
      } else {
        expect(detail).toBeUndefined();
      }
    }
  });
});
