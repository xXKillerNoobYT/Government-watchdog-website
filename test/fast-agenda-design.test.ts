// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import agendaBoardData from '../src/fixtures/agenda-board-projection.json';
import sampleAgendaBoardData from '../src/fixtures/agenda-board-projection.sample.dev.json';
import type { AgendaBoard } from '../src/types/agenda-board';
import { FAST_AGENDA_DESIGN_STYLE, renderFastAgendaDesign } from '../src/ui/fast-agenda-design';

let root: HTMLElement;
const REVIEWED_BOARD = agendaBoardData as unknown as AgendaBoard;
const POPULATED_REVIEWED_BOARD = sampleAgendaBoardData as unknown as AgendaBoard;

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

function renderReviewed(board: AgendaBoard = REVIEWED_BOARD, access = 'reviewer_internal'): void {
  renderFastAgendaDesign(root, {
    access,
    fixture: false,
    board,
    notice: 'Reviewed projection test notice',
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

    // The tracker renders through the shared kanban primitive, not a second
    // hand-rolled board — so lane geometry, the level colour bar, the empty
    // state, and print behaviour cannot drift from every other board.
    const tracker = root.querySelector('[data-test="issue-tracker"]');
    expect(tracker?.getAttribute('tabindex')).toBe('0');
    expect(tracker?.querySelector('[data-test="kanban-board"]')).not.toBeNull();
    expect(tracker?.querySelectorAll('[data-test="kanban-lane"]')).toHaveLength(7);
    expect(tracker?.querySelectorAll('[data-test="kanban-card"]').length).toBe(15);

    // Every card still carries its track toggle and its synthetic-receipt
    // disclosure; moving to the primitive must not drop either.
    expect(tracker?.querySelectorAll('[data-test="track-toggle"]').length).toBe(15);
    for (const card of tracker?.querySelectorAll('[data-test="kanban-card"]') ?? []) {
      expect(card.textContent).toContain('synthetic references only');
    }
  });
});

describe('Fast Agenda reviewed projection baseline', () => {
  it('uses the reviewed board access when no route-level override is supplied', () => {
    renderFastAgendaDesign(root, {
      fixture: false,
      board: REVIEWED_BOARD,
      notice: 'Board access test',
    });

    expect(root.querySelector('[data-test="fast-agenda-reviewed-advanced"]')).not.toBeNull();
    expect(root.querySelector('[data-test="reviewed-banner"]')?.textContent).toContain('Board access test');
  });

  it.each(['advanced', 'simple'] as const)(
    'keeps the %s baseline slots while showing only honest reviewed gaps',
    (mode) => {
      localStorage.setItem('gw_home_mode', mode);
      renderReviewed();

      expect(root.querySelector(`[data-test="fast-agenda-reviewed-${mode}"]`)).not.toBeNull();
      expect(root.querySelector('[data-test="reviewed-banner"]')?.textContent).toContain(
        'REVIEWED AGENDA PROJECTION — not a live read',
      );
      expect(root.querySelector('[data-test="reviewed-banner"]')?.textContent).toContain(
        'Reviewed projection test notice',
      );
      expect(root.querySelector('[data-test="reviewed-meeting-readiness"]')).not.toBeNull();
      expect(root.querySelector('[data-test="reviewed-agenda-area"]')).not.toBeNull();
      expect(root.querySelector('[data-test="reviewed-analysis-slot"]')?.textContent).toContain('unavailable');
      expect(root.querySelector('[data-test="reviewed-language-slot"]')?.textContent).toContain('unavailable');
      expect(root.querySelector('[data-test="reviewed-process-slot"]')?.textContent).toContain('unavailable');
      expect(root.querySelector('[data-test="reviewed-receipts-slot"]')?.textContent).toContain('unavailable');
      expect(root.querySelector('[data-test="reviewed-decision-context-slot"]')?.textContent).toContain('unavailable');
      expect(root.querySelector('[data-test="reviewed-meeting-logistics-gap"]')).not.toBeNull();
      expect(root.querySelector('[data-test="reviewed-posting-version-gap"]')).not.toBeNull();
      expect(root.querySelector('[data-test="reviewed-agenda-counts-gap"]')).not.toBeNull();
      expect(root.querySelector('[data-test="reviewed-nearby-meetings-gap"]')).not.toBeNull();
      expect(root.querySelector('[data-test="reviewed-public-comment-gap"]')).not.toBeNull();
      expect(root.querySelectorAll('[data-test="reviewed-meeting-tools"] button:disabled')).toHaveLength(3);
      expect(root.querySelector('[data-test="reviewed-agenda-stage-area"]')).not.toBeNull();
      expect(root.querySelectorAll('[data-test="reviewed-issue-stage"]')).toHaveLength(REVIEWED_BOARD.lanes.length);
      expect(root.querySelector('[data-test="reviewed-issue-tracker-gap"]')?.textContent).toContain(
        'not substituted for the baseline issue-thread stages',
      );

      expect(root.querySelector('[data-test="fixture-banner"]')).toBeNull();
      expect(root.querySelectorAll('[data-test="agenda-row"]')).toHaveLength(0);
      expect(root.querySelectorAll('[data-test="simple-agenda-item"]')).toHaveLength(0);
      expect(root.textContent).not.toContain('SYNTHETIC DESIGN FIXTURE');
      expect(root.textContent).not.toContain('July 21');
      expect(root.textContent).not.toContain('Jul 21');
      expect(root.textContent).not.toContain('Alpine Apex annexation');
      expect(root.textContent).not.toContain('$667,067.91');
      expect([...Array(localStorage.length)].map((_, index) => localStorage.key(index))).toEqual(['gw_home_mode']);
    },
  );

  it('renders unanchored counts and board disclosures without replacing their supplied values', () => {
    const board: AgendaBoard = {
      ...REVIEWED_BOARD,
      unanchoredStatementCount: 37,
      disclosures: {
        ...REVIEWED_BOARD.disclosures,
        decisions: 'DECISIONS DISCLOSURE — verbatim sentinel.',
        categories: 'CATEGORIES DISCLOSURE — verbatim sentinel.',
        scope: 'SCOPE DISCLOSURE — verbatim sentinel.',
        unanchoredStatementCount: 37,
      },
    };

    renderReviewed(board);

    expect(root.querySelector('[data-test="reviewed-unanchored-disclosure"]')?.textContent).toBe(
      'Unanchored statements: 37',
    );
    expect(root.querySelector('[data-test="reviewed-agenda-empty"]')?.textContent).toContain(
      '37 reviewed statement(s) are not yet anchored to an agenda item.',
    );
    expect(root.querySelector('[data-test="reviewed-disclosure-decisions"]')?.textContent).toBe(
      board.disclosures.decisions,
    );
    expect(root.querySelector('[data-test="reviewed-disclosure-categories"]')?.textContent).toBe(
      board.disclosures.categories,
    );
    expect(root.querySelector('[data-test="reviewed-disclosure-scope"]')?.textContent).toBe(
      board.disclosures.scope,
    );
  });

  it('preserves every supplied populated-card trust, meeting, evidence, video, and gap field', () => {
    renderReviewed(POPULATED_REVIEWED_BOARD);

    expect(root.querySelectorAll('[data-test="reviewed-agenda-row"]')).toHaveLength(2);
    expect([...root.querySelectorAll('[data-test="reviewed-status-badge"]')].map((node) => node.textContent)).toEqual([
      'Unverified',
      'Unverified',
    ]);
    expect([...root.querySelectorAll('[data-test="reviewed-confidence-badge"]')].map((node) => node.textContent)).toEqual([
      'auto_caption_untimed',
      'auto_caption_untimed',
    ]);
    expect(root.querySelector('[data-test="reviewed-confidence-gap"]')).toBeNull();

    const meetingContext = root.querySelector('[data-test="reviewed-meeting-context"]')?.textContent ?? '';
    expect(meetingContext).toContain('Meeting 1');
    expect(meetingContext).toContain('2026-04-13');
    expect(meetingContext).toContain('Town Council');
    expect(meetingContext).toContain('Regular Meeting');
    const meetingSources = [...root.querySelectorAll<HTMLAnchorElement>('[data-test="reviewed-meeting-source"]')];
    expect(meetingSources).toHaveLength(2);
    expect(meetingSources[0]?.href).toBe('https://www.alpinewy.gov/meetings/2026-04-13');
    expect(root.querySelector<HTMLAnchorElement>('[data-test="reviewed-video-ref"]')?.href).toBe(
      'https://www.youtube.com/watch?v=alpine0413',
    );
    expect(root.querySelector('[data-test="reviewed-video-ref"]')?.textContent).toBe('Watch from 45s');

    expect(root.querySelectorAll('[data-test="reviewed-source-original"]')).toHaveLength(2);
    expect(root.querySelector('[data-test="reviewed-receipts-slot"]')?.textContent).toContain('alpine_minutes');
    expect(root.querySelector('[data-test="reviewed-lineage"]')?.textContent).toContain('agenda_item_supersedes');
    expect(root.querySelector('[data-test="reviewed-category-anchor"]')?.textContent).toContain('agenda_thread');
    expect(root.querySelector('[data-test="reviewed-statement-ids"]')?.textContent).toContain('s-zoning-1');
    expect(root.querySelectorAll('[data-test="reviewed-gap-badge"]')).toHaveLength(4);
    expect(root.querySelector('[data-test="reviewed-gap-badges"]')?.textContent).toContain('Low source confidence');
    expect(root.textContent).not.toContain('SYNTHETIC DESIGN FIXTURE');
  });

  it.each([
    ['public route override', 'public', REVIEWED_BOARD],
    ['non-reviewer board', 'reviewer_internal', { ...REVIEWED_BOARD, access: 'public' } as AgendaBoard],
  ])('fails closed for %s', (_label, access, board) => {
    renderReviewed(board, access);

    expect(root.querySelector('[data-test="fast-agenda-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="reviewed-banner"]')).toBeNull();
    expect(root.querySelector('[data-test="reviewed-agenda-area"]')).toBeNull();
    expect(root.querySelector('[data-test="reviewed-unanchored-disclosure"]')).toBeNull();
    expect(root.textContent).not.toContain(board.generatedFrom);
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
