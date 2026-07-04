// @vitest-environment jsdom
//
// GOV-600 (GOV-599 Child 1) — the agenda Kanban board surface. Proves the
// owner-confirmed redesign against `renderBoards`:
//
//   - DEFAULT view is "Agendas by meeting" (Board A) — owner confirmation;
//   - the top toggle order is [Agendas by meeting] [Agenda tracking] and switching
//     mounts Board B;
//   - Board A groups already-reviewed cards by MEETING DATE, newest-first, and
//     reuses the existing recordCard trust surface (status badge + click-to-reveal
//     blur + sources drawer) — no trust is recomputed;
//   - the reviewer-internal lane is the SOLE gate: the public lane renders ZERO
//     board content and leaks no reviewer-internal-only field;
//   - Board B (SYNTHETIC thread) places the card in the backend's VERBATIM terminal
//     status lane at the newest cursor, and the as-of scrubber moves it to
//     Upcoming/Noticed before the first meeting — never inventing a status;
//   - the true-dark board-chrome tokens exist in BOTH themes with a real elevation
//     ladder (board < lane < card), fixing "light-with-dark-patches".
import { describe, it, expect, beforeEach } from 'vitest';
import { renderBoards, readBoardView, DEFAULT_VIEW } from '../src/ui/board';
import { GW_TOKENS } from '../src/ui/tokens';
import { STYLE } from '../src/ui/render';
import type { CardFeed, PresentCard } from '../src/ui/card-feed';
import type { AgendaThreadResponse } from '../src/types/read-api';
import conceptGraphDemo from '../src/fixtures/concept-graph-demo.json';

const THREAD = (conceptGraphDemo as { agenda_thread: AgendaThreadResponse }).agenda_thread;

function present(p: Partial<PresentCard> & { handle: string; type: PresentCard['type']; status: PresentCard['status'] }): PresentCard {
  return { evidence: [], ...p };
}

/** A multi-meeting reviewer-internal feed so Board A shows > 1 column. */
function multiDayFeed(): CardFeed {
  return {
    scope: 'alpine',
    access: 'reviewer_internal',
    cards: [
      present({ handle: 's-old', type: 'statement', status: 'verified', date: '2024-01-10', reviewed_summary: 'older item' }),
      present({ handle: 'm-new', type: 'meeting', status: 'verified', date: '2024-03-05', title: 'March 5 council meeting' }),
      present({ handle: 's-new', type: 'statement', status: 'verified', date: '2024-03-05', reviewed_summary: 'newer item' }),
      present({ handle: 'ai-1', type: 'ai_presented', status: 'ai_presented', date: '2024-03-05', reviewed_summary: 'ai note' }),
    ],
  };
}

let root: HTMLElement;
beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  try { localStorage.clear(); } catch { /* ignore */ }
  root = document.createElement('div');
  document.body.append(root);
});

describe('GOV-600 default view — Agendas by meeting (owner confirmation)', () => {
  it('opens by default to Board A with the meeting tab selected', () => {
    renderBoards(root, { feed: multiDayFeed(), thread: THREAD });
    expect(DEFAULT_VIEW).toBe('meeting');
    expect(readBoardView()).toBe('meeting'); // no persisted choice yet → default
    const mount = root.querySelector('[data-test="board-mount"]')!;
    expect(mount.querySelector('[data-test="board-meeting"]')).not.toBeNull();
    expect(mount.querySelector('[data-test="board-tracking"]')).toBeNull();
    expect(root.querySelector('[data-test="tab-meeting"]')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('[data-test="tab-tracking"]')?.getAttribute('aria-selected')).toBe('false');
  });

  it('toggle order is [Agendas by meeting] [Agenda tracking]', () => {
    renderBoards(root, { feed: multiDayFeed(), thread: THREAD });
    const tabs = [...root.querySelectorAll('[role="tab"]')].map((t) => t.textContent);
    expect(tabs).toEqual(['Agendas by meeting', 'Agenda tracking']);
  });
});

describe('GOV-600 Board A — group by meeting date, newest-first, trust reused', () => {
  it('renders one lane per meeting date, ordered newest-first', () => {
    renderBoards(root, { feed: multiDayFeed(), thread: THREAD });
    const lanes = [...root.querySelectorAll('[data-test="meeting-lane"]')];
    expect(lanes.map((l) => l.getAttribute('data-meeting-date'))).toEqual(['2024-03-05', '2024-01-10']);
  });

  it('lane count reflects the number of cards at that meeting date', () => {
    renderBoards(root, { feed: multiDayFeed(), thread: THREAD });
    const first = root.querySelector('[data-test="meeting-lane"]')!;
    expect(first.querySelector('[data-test="lane-count"]')?.textContent).toBe('3'); // 2024-03-05 has 3
  });

  it('a meeting-type card supplies the lane subtitle', () => {
    renderBoards(root, { feed: multiDayFeed(), thread: THREAD });
    const first = root.querySelector('[data-test="meeting-lane"]')!;
    expect(first.querySelector('[data-test="lane-sub"]')?.textContent).toContain('March 5 council meeting');
  });

  it('reuses recordCard: every board card keeps a trust badge, reveal blur, and sources drawer', () => {
    renderBoards(root, { feed: multiDayFeed(), thread: THREAD });
    const cards = [...root.querySelectorAll('[data-test="record-card"]')];
    expect(cards.length).toBe(4);
    for (const c of cards) {
      expect(c.querySelector('[data-test="trust-badge"]')).not.toBeNull();
      expect(c.querySelector('[data-test="reveal-btn"]')).not.toBeNull();
      expect(c.querySelector('[data-test="card-info"]')?.getAttribute('aria-hidden')).toBe('true');
      expect(c.querySelector('[data-test="source-drawer"]')).not.toBeNull();
    }
  });

  it('AI-presented cards keep the locked AI label', () => {
    renderBoards(root, { feed: multiDayFeed(), thread: THREAD });
    expect(root.querySelector('[data-test="ai-label"]')).not.toBeNull();
  });
});

describe('GOV-600 reviewer-internal is the SOLE gate', () => {
  it('public lane renders zero board content and no cards', () => {
    const feed = { ...multiDayFeed(), access: 'public' } as CardFeed;
    renderBoards(root, { feed, thread: THREAD, notice: 'x' });
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="agenda-boards"]')).toBeNull();
    expect(root.querySelectorAll('[data-test="record-card"]').length).toBe(0);
    expect(root.querySelector('[data-test="board-mount"]')).toBeNull();
  });

  it('public lane leaks no reviewer-internal-only field into the DOM', () => {
    const feed = {
      scope: 'alpine',
      access: 'public',
      cards: [present({ handle: 'secret', type: 'statement', status: 'verified', date: '2024-03-05', reviewed_summary: 'TOP-SECRET-SUMMARY', speaker_label: 'SECRET-SPEAKER' })],
    } as CardFeed;
    renderBoards(root, { feed, thread: THREAD });
    expect(root.innerHTML).not.toContain('TOP-SECRET-SUMMARY');
    expect(root.innerHTML).not.toContain('SECRET-SPEAKER');
  });
});

describe('GOV-600 Board B — agenda tracking with an as-of scrubber (synthetic)', () => {
  function openTracking(): void {
    renderBoards(root, { feed: multiDayFeed(), thread: THREAD });
    (root.querySelector('[data-test="tab-tracking"]') as HTMLButtonElement).click();
  }

  it('switching to Agenda tracking mounts Board B with lifecycle lanes and a synthetic banner', () => {
    openTracking();
    const mount = root.querySelector('[data-test="board-mount"]')!;
    expect(mount.querySelector('[data-test="board-tracking"]')).not.toBeNull();
    expect(mount.querySelector('[data-test="board-meeting"]')).toBeNull();
    expect(mount.querySelector('[data-test="synthetic-banner"]')).not.toBeNull();
    expect(mount.querySelectorAll('[data-test="tracking-lane"]').length).toBe(5);
  });

  it('at the newest cursor the thread sits in its VERBATIM backend terminal status lane (decided)', () => {
    openTracking();
    const board = root.querySelector('[data-test="board-tracking-lanes"]')!;
    expect(board.getAttribute('data-active-lane')).toBe('decided'); // THREAD.status === 'decided'
    const decidedLane = root.querySelector('[data-lane="decided"]')!;
    expect(decidedLane.querySelector('[data-test="thread-card"]')).not.toBeNull();
    // backend status is shown verbatim, never re-derived
    expect(decidedLane.querySelector('[data-test="thread-backend-status"]')?.textContent).toContain('decided');
  });

  it('scrubbing back to "before first meeting" moves the card to Upcoming/Noticed', () => {
    openTracking();
    const prev = root.querySelector('[data-test="scrub-prev"]') as HTMLButtonElement;
    // 3 member dates → steps = [before, d1, d2, d3]; default idx=3. Step back 3×.
    prev.click(); prev.click(); prev.click();
    expect(root.querySelector('[data-test="scrub-asof"]')?.textContent).toBe('before first meeting');
    const board = root.querySelector('[data-test="board-tracking-lanes"]')!;
    expect(board.getAttribute('data-active-lane')).toBe('upcoming');
    expect(prev.hasAttribute('disabled')).toBe(true); // clamped at the earliest step
  });

  it('mid-life cursor places the thread in Open (in progress), not a terminal lane', () => {
    openTracking();
    const prev = root.querySelector('[data-test="scrub-prev"]') as HTMLButtonElement;
    // steps = [before, 2019-06-11, 2019-06-25(=last_seen), 2019-07-09]; default idx=3.
    // Only 2019-06-11 (idx 1) is strictly before last_seen → the sole mid-life "open".
    prev.click(); prev.click(); // idx 3 → 1
    expect(root.querySelector('[data-test="scrub-asof"]')?.textContent).toBe('2019-06-11');
    const board = root.querySelector('[data-test="board-tracking-lanes"]')!;
    expect(board.getAttribute('data-active-lane')).toBe('open');
  });
});

describe('GOV-600 true-dark board chrome tokens', () => {
  it('defines the board-chrome elevation tokens in BOTH themes', () => {
    for (const t of ['--gw-board-bg', '--gw-lane-bg', '--gw-lane-header-bg', '--gw-card-bg']) {
      // light (base :root) + dark (media + [data-theme="dark"]) all declare it
      const count = GW_TOKENS.split(t).length - 1;
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  it('dark values form a real elevation ladder board < lane < card (deeper = darker)', () => {
    // Pull the dark block (inside :root[data-theme="dark"]).
    const dark = GW_TOKENS.slice(GW_TOKENS.indexOf('[data-theme="dark"]'));
    const val = (name: string): number => {
      const m = new RegExp(`${name}:#([0-9a-f]{6})`).exec(dark)!;
      return parseInt(m[1], 16);
    };
    expect(val('--gw-board-bg')).toBeLessThan(val('--gw-lane-bg'));
    expect(val('--gw-lane-bg')).toBeLessThan(val('--gw-card-bg'));
  });

  it('the shared stylesheet themes the board chrome via the tokens (no light fallback)', () => {
    expect(STYLE).toContain('.gw-board{');
    expect(STYLE).toContain('background:var(--gw-board-bg)');
    expect(STYLE).toContain('.gw-lane{');
    expect(STYLE).toContain('.gw-view-toggle');
    expect(STYLE).toContain('.gw-scrubber');
  });
});
