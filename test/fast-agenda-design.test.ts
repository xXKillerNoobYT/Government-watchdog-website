// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAST_AGENDA_DESIGN_STYLE, renderFastAgendaDesign } from '../src/ui/fast-agenda-design';

let root: HTMLElement;

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, String(value)),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('main');
  document.body.append(root);
});

afterEach(() => {
  vi.unstubAllGlobals();
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

  it('traps focus, isolates the background, locks scrolling, and restores state on Escape', () => {
    renderFixture();
    const open = root.querySelector<HTMLButtonElement>('[data-test="open-details"]')!;
    const surface = root.querySelector<HTMLElement>('[data-test="fast-agenda-advanced"]')!;
    document.body.style.overflow = 'clip';
    open.focus();

    open.click();
    expect(root.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    expect(surface.hasAttribute('inert')).toBe(true);
    expect(surface.getAttribute('aria-hidden')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');

    const first = root.querySelector<HTMLButtonElement>('[data-test="modal-close"]')!;
    const last = root.querySelector<HTMLButtonElement>('[data-test="modal-footer-close"]')!;
    expect(document.activeElement).toBe(first);
    last.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(root.querySelector('[data-test="agenda-modal"]')).toBeNull();
    expect(surface.hasAttribute('inert')).toBe(false);
    expect(surface.hasAttribute('aria-hidden')).toBe(false);
    expect(document.body.style.overflow).toBe('clip');
    expect(document.activeElement).toBe(open);
  });

  it('closes with the backdrop and either close button, including rerender cleanup', () => {
    renderFixture();
    const open = root.querySelector<HTMLButtonElement>('[data-test="open-details"]')!;

    open.click();
    root.querySelector<HTMLElement>('[data-test="agenda-modal-backdrop"]')?.click();
    expect(root.querySelector('[data-test="agenda-modal"]')).toBeNull();

    open.click();
    root.querySelector<HTMLButtonElement>('[data-test="modal-close"]')?.click();
    expect(root.querySelector('[data-test="agenda-modal"]')).toBeNull();

    open.click();
    root.querySelector<HTMLButtonElement>('[data-test="modal-footer-close"]')?.click();
    expect(root.querySelector('[data-test="agenda-modal"]')).toBeNull();

    document.body.style.overflow = 'auto';
    open.click();
    renderFixture();
    expect(root.querySelector('[data-test="agenda-modal"]')).toBeNull();
    expect(document.body.style.overflow).toBe('auto');
    const rerenderedSurface = root.querySelector<HTMLElement>('[data-test="fast-agenda-advanced"]')!;
    expect(rerenderedSurface.hasAttribute('inert')).toBe(false);
    expect(rerenderedSurface.hasAttribute('aria-hidden')).toBe(false);
  });
});

describe('Fast Agenda reading mode', () => {
  it('renders a reduced numbered Simple digest with honest receipt and unavailable-tool affordances', () => {
    localStorage.setItem('gw_home_mode', 'simple');
    renderFixture();

    expect(root.querySelector('[data-test="fast-agenda-simple"]')?.getAttribute('data-mode')).toBe('simple');
    expect(root.querySelector('[data-test="fast-agenda-advanced"]')).toBeNull();
    expect(root.querySelector('[data-test="reading-mode"]')?.textContent).toContain('Simple');
    expect(root.querySelector('[data-test="simple-meeting-digest"]')).not.toBeNull();
    expect(root.querySelector('[data-test="simple-agenda-digest"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="simple-agenda-item"]')).toHaveLength(8);
    expect(root.querySelectorAll('[data-test="open-receipts"]')).toHaveLength(8);
    expect(root.querySelectorAll('[data-test="agenda-row"]')).toHaveLength(0);
    expect(root.querySelector('[data-test="meeting-board"]')).toBeNull();
    expect(root.querySelector('[data-test="issue-tracker"]')).toBeNull();
    expect(root.querySelector('[data-test="language-watch"]')).toBeNull();
    expect(root.querySelector('[data-test="process-ladder"]')).toBeNull();

    const unavailable = [...root.querySelectorAll<HTMLButtonElement>('[data-test="unavailable-tool"]')];
    expect(unavailable).toHaveLength(3);
    for (const button of unavailable) {
      expect(button.disabled).toBe(true);
      expect(button.textContent).toContain('unavailable');
    }
    expect([...Array(localStorage.length)].map((_, index) => localStorage.key(index))).toEqual(['gw_home_mode']);

    root.querySelector<HTMLButtonElement>('[data-test="open-receipts"]')?.click();
    expect(root.querySelector('[data-test="agenda-modal"]')?.textContent).toContain('Receipts');
    expect(root.querySelector('[data-test="agenda-modal"]')?.textContent).toContain('synthetic design placeholders');
  });

  it('uses a contrast-safe AI badge pairing and collapses modal columns by 720px', () => {
    expect(FAST_AGENDA_DESIGN_STYLE).toContain(
      '.gw-fa-ai strong{background:var(--gw-caution-text-strong);color:var(--gw-caution-bg)}',
    );
    expect(FAST_AGENDA_DESIGN_STYLE).not.toContain(
      '.gw-fa-ai strong{background:var(--gw-caution-line);color:var(--gw-accent-text-on)}',
    );
    expect(FAST_AGENDA_DESIGN_STYLE).toMatch(
      /@media \(max-width:720px\)\{[\s\S]*?\.gw-fa-modal-grid\{grid-template-columns:1fr\}/,
    );
  });
});
