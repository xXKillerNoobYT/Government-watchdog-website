// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { renderFastAgendaDesign } from '../src/ui/fast-agenda-design';

let root: HTMLElement;

beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  localStorage.clear();
  root = document.createElement('main');
  document.body.append(root);
});

function renderFixture(): void {
  renderFastAgendaDesign(root, {
    access: 'reviewer_internal',
    fixture: true,
    notice: 'Design handoff review',
  });
}

describe('Fast Agenda design gate', () => {
  it.each([
    {},
    { access: 'public', fixture: true },
    { access: 'reviewer_internal', fixture: false },
    { access: 'reviewer_internal' },
  ])('fails closed without the exact reviewer fixture grant: %o', (options) => {
    renderFastAgendaDesign(root, options);

    expect(root.querySelector('[data-test="fast-agenda-gated"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="agenda-row"]')).toHaveLength(0);
    expect(root.querySelector('[data-test="meeting-board"]')).toBeNull();
    expect(root.textContent).not.toContain('SYNTHETIC DESIGN FIXTURE');
    expect(root.textContent).not.toContain('Alpine Town Council');
    expect(root.textContent).not.toContain('July 21, 2026');
  });
});

describe('Fast Agenda fixture content and disclosure', () => {
  it('labels the synthetic surface and every receipt disclaimer', () => {
    renderFixture();

    expect(root.querySelector('[data-test="fixture-banner"]')?.textContent).toContain(
      'SYNTHETIC DESIGN FIXTURE — not a live read',
    );
    expect(root.querySelector('[data-test="fixture-banner"]')?.textContent).toContain('Design handoff review');
    expect(root.textContent).toContain('Tuesday, July 21, 2026');
    const disclaimers = [...root.querySelectorAll('[data-test="receipts-disclaimer"]')];
    expect(disclaimers.length).toBeGreaterThanOrEqual(2);
    for (const disclaimer of disclaimers) {
      expect(disclaimer.textContent).toContain('synthetic design placeholders');
      expect(disclaimer.textContent).toContain('not a live read');
    }
  });

  it('renders a full meeting board, agenda rows, AI blocks, language watches, and process ladders', () => {
    renderFixture();

    expect(root.querySelectorAll('[data-test="meeting-status-tile"]')).toHaveLength(4);
    expect(root.querySelectorAll('[data-test="meeting-stat-tile"]')).toHaveLength(4);
    const rows = [...root.querySelectorAll('[data-test="agenda-row"]')];
    expect(rows.length).toBeGreaterThanOrEqual(6);
    for (const row of rows) {
      expect(row.querySelector('[data-test="ai-analysis"]')?.textContent).toContain('AI-PRESENTED ANALYSIS');
      expect(row.querySelector('[data-test="language-watch"]')?.textContent).toContain('AI-PRESENTED LANGUAGE WATCH');
      expect(row.querySelector('[data-test="process-ladder"]')).not.toBeNull();
      expect(row.querySelectorAll('[data-test="process-ladder"] li').length).toBeGreaterThanOrEqual(3);
    }

    expect(root.querySelectorAll('[data-test="issue-stage"]')).toHaveLength(7);
    expect(root.querySelector('[data-test="issue-tracker"]')?.getAttribute('tabindex')).toBe('0');
  });
});

describe('Fast Agenda interactions', () => {
  it('persists shared tracking state to gw_tracked and updates every matching toggle', () => {
    renderFixture();

    const matching = [...root.querySelectorAll<HTMLButtonElement>('[data-track-key="annexation"]')];
    expect(matching.length).toBeGreaterThanOrEqual(3);
    matching[0]?.click();

    expect(JSON.parse(localStorage.getItem('gw_tracked') ?? '{}')).toMatchObject({ annexation: true });
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-track-key="annexation"]')) {
      expect(button.getAttribute('aria-pressed')).toBe('true');
      expect(button.textContent).toContain('Tracking');
    }

    renderFixture();
    expect(root.querySelector<HTMLButtonElement>('[data-track-key="annexation"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('closes the accessible detail modal with Escape, the backdrop, and either close button', () => {
    renderFixture();
    const open = root.querySelector<HTMLButtonElement>('[data-test="open-details"]')!;

    open.click();
    expect(root.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(root.querySelector('[data-test="agenda-modal"]')).toBeNull();

    open.click();
    root.querySelector<HTMLElement>('[data-test="agenda-modal-backdrop"]')?.click();
    expect(root.querySelector('[data-test="agenda-modal"]')).toBeNull();

    open.click();
    root.querySelector<HTMLButtonElement>('[data-test="modal-close"]')?.click();
    expect(root.querySelector('[data-test="agenda-modal"]')).toBeNull();

    open.click();
    root.querySelector<HTMLButtonElement>('[data-test="modal-footer-close"]')?.click();
    expect(root.querySelector('[data-test="agenda-modal"]')).toBeNull();
  });
});

describe('Fast Agenda reading mode', () => {
  it('reads the existing gw_home_mode key and renders the Simple broadsheet without a second mode key', () => {
    localStorage.setItem('gw_home_mode', 'simple');
    renderFixture();

    expect(root.querySelector('[data-test="fast-agenda-simple"]')?.getAttribute('data-mode')).toBe('simple');
    expect(root.querySelector('[data-test="fast-agenda-advanced"]')).toBeNull();
    expect(root.querySelector('[data-test="reading-mode"]')?.textContent).toContain('Simple');
    expect(root.querySelectorAll('[data-test="agenda-row"]').length).toBeGreaterThanOrEqual(6);
    expect([...Array(localStorage.length)].map((_, index) => localStorage.key(index))).toEqual(['gw_home_mode']);
  });
});
