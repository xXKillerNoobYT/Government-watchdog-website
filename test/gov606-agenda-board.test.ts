// @vitest-environment jsdom
//
// GOV-606 (GOV-599 real-data) — the agenda Kanban board, now wired to the REAL
// reviewed-Alpine projection (GOV-605, backend PR #96) instead of fixtures. This
// SUPERSEDES the GOV-600 fixture-era board test: Board A no longer reuses the
// per-statement `recordCard`, and Board B no longer runs on a synthetic thread +
// scrubber. Both views now render the same GOV-605 board projection.
//
// Proves:
//   - the GOV-599 shipped UX is preserved: DEFAULT view = "Agendas by meeting",
//     toggle order [Agendas by meeting] [Agenda tracking], true-dark elevation
//     ladder (board < lane < card) via the shared board-chrome tokens;
//   - Board A groups the projection's cards by MEETING (newest-first);
//   - Board B lays the projection's cards across the six frozen lifecycle lanes;
//   - every card renders VERBATIM: statusBadge (toned, never recomputed), AI +
//     confidence labels, videoRef / typed lineage / source drawer, disclosed gap
//     badges, and disclosed-empty `decisions` + `categoryAnchor` latents;
//   - empty-state honesty: the REAL empty projection shows a disclosed empty board
//     (six lanes, unanchored-statement disclosure) — never a fabricated card;
//   - the reviewer-internal lane is the SOLE gate: the public lane renders ZERO
//     board content and leaks no card leaf.
import { describe, it, expect, beforeEach } from 'vitest';
import { renderBoards, readBoardView, DEFAULT_VIEW } from '../src/ui/board';
import { GW_TOKENS } from '../src/ui/tokens';
import { STYLE } from '../src/ui/render';
import type { AgendaBoard } from '../src/types/agenda-board';
import realBoardData from '../src/fixtures/agenda-board-projection.json';
import sampleBoardData from '../src/fixtures/agenda-board-projection.sample.dev.json';

const REAL = realBoardData as unknown as AgendaBoard;
const SAMPLE = sampleBoardData as unknown as AgendaBoard;

/** A deep clone so a per-test access override never mutates the shared fixture. */
function clone(b: AgendaBoard): AgendaBoard {
  return JSON.parse(JSON.stringify(b)) as AgendaBoard;
}

let root: HTMLElement;
beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  try { localStorage.clear(); } catch { /* ignore */ }
  root = document.createElement('div');
  document.body.append(root);
});

describe('GOV-606 default view — Agendas by meeting (owner confirmation)', () => {
  it('opens by default to Board A with the meeting tab selected', () => {
    renderBoards(root, { board: SAMPLE });
    expect(DEFAULT_VIEW).toBe('meeting');
    expect(readBoardView()).toBe('meeting'); // no persisted choice yet → default
    const mount = root.querySelector('[data-test="board-mount"]')!;
    expect(mount.querySelector('[data-test="board-meeting"]')).not.toBeNull();
    expect(mount.querySelector('[data-test="board-tracking"]')).toBeNull();
    expect(root.querySelector('[data-test="tab-meeting"]')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('[data-test="tab-tracking"]')?.getAttribute('aria-selected')).toBe('false');
  });

  it('toggle order is [Agendas by meeting] [Agenda tracking]', () => {
    renderBoards(root, { board: SAMPLE });
    const tabs = [...root.querySelectorAll('[role="tab"]')].map((t) => t.textContent);
    expect(tabs).toEqual(['Agendas by meeting', 'Agenda tracking']);
  });
});

describe('GOV-606 Board A — projection cards grouped by meeting', () => {
  it('renders a meeting lane and every card carries its verbatim status badge', () => {
    renderBoards(root, { board: SAMPLE });
    const lanes = [...root.querySelectorAll('[data-test="meeting-lane"]')];
    expect(lanes.length).toBe(1); // both sample cards sit at 2026-04-13
    expect(lanes[0].getAttribute('data-meeting-date')).toBe('2026-04-13');
    const cards = [...root.querySelectorAll('[data-test="agenda-card"]')];
    expect(cards.length).toBe(2);
    for (const c of cards) {
      expect(c.querySelector('[data-test="card-status"]')?.textContent).toBe('Unverified');
    }
  });

  it('renders confidence label, lane badge, videoRef, lineage, and a source drawer', () => {
    renderBoards(root, { board: SAMPLE });
    const budget = root.querySelector('[data-agenda-item="alpine:2026-04-13:item-budget"]')!;
    // confidence label preserved (verbatim mapping), lane badge present
    expect(budget.querySelector('[data-test="card-confidence"]')?.textContent).toContain('Auto-caption');
    expect(budget.querySelector('[data-test="card-lane"]')?.textContent).toBe('Decided');
    // videoRef deep-link (public URL + integer offset only)
    const video = budget.querySelector('[data-test="card-video"] a') as HTMLAnchorElement;
    expect(video?.getAttribute('href')).toBe('https://www.youtube.com/watch?v=alpine0413');
    expect(video?.textContent).toContain('45s');
    // typed lineage (never untyped) + source drawer
    expect(budget.querySelector('[data-test="card-lineage"] [data-test="lineage-edge"]')).not.toBeNull();
    expect(budget.querySelector('[data-test="card-sources"]')).not.toBeNull();
  });

  it('surfaces disclosed gap badges and renders disclosed-empty latents (never faked)', () => {
    renderBoards(root, { board: SAMPLE });
    const zoning = root.querySelector('[data-agenda-item="alpine:2026-04-13:item-zoning"]')!;
    // the zoning card discloses three gaps verbatim
    const gaps = [...zoning.querySelectorAll('[data-test="gap-badge"]')].map((g) => g.textContent);
    expect(gaps.length).toBe(3);
    expect(gaps.some((g) => g?.includes('Agenda thread not yet linked'))).toBe(true);
    // decisions:[] rendered as disclosed-empty, categoryAnchor disclosed — not hidden
    expect(zoning.querySelector('[data-test="card-decisions-empty"]')?.textContent).toContain('disclosed-empty');
    expect(zoning.querySelector('[data-test="card-category-anchor"]')?.textContent).toContain('agenda_thread');
  });

  it('AI-presented status also renders the locked AI label', () => {
    const board = clone(SAMPLE);
    board.lanes[0].cards[0].statusBadge = 'AI-presented — not independently verified';
    renderBoards(root, { board });
    expect(root.querySelector('[data-test="card-ai-label"]')).not.toBeNull();
  });
});

describe('GOV-606 Board B — the projection lifecycle lanes', () => {
  function openTracking(board: AgendaBoard): void {
    renderBoards(root, { board });
    (root.querySelector('[data-test="tab-tracking"]') as HTMLButtonElement).click();
  }

  it('mounts Board B with all six frozen lanes, empties included', () => {
    openTracking(SAMPLE);
    const mount = root.querySelector('[data-test="board-mount"]')!;
    expect(mount.querySelector('[data-test="board-tracking"]')).not.toBeNull();
    expect(mount.querySelector('[data-test="board-meeting"]')).toBeNull();
    const lanes = [...mount.querySelectorAll('[data-test="tracking-lane"]')].map((l) => l.getAttribute('data-lane'));
    expect(lanes).toEqual(['upcoming', 'active', 'pending-decision', 'decided', 'follow-up', 'correction']);
  });

  it('places each card in its backend-assigned lane (never re-derived)', () => {
    openTracking(SAMPLE);
    const decided = root.querySelector('[data-test="tracking-lane"][data-lane="decided"]')!;
    expect(decided.querySelector('[data-agenda-item="alpine:2026-04-13:item-budget"]')).not.toBeNull();
    const upcoming = root.querySelector('[data-test="tracking-lane"][data-lane="upcoming"]')!;
    expect(upcoming.querySelector('[data-agenda-item="alpine:2026-04-13:item-zoning"]')).not.toBeNull();
    // an empty lifecycle lane shows the em-dash marker, never a fabricated card
    const active = root.querySelector('[data-test="tracking-lane"][data-lane="active"]')!;
    expect(active.querySelector('[data-test="lane-empty"]')?.textContent).toBe('—');
    expect(active.querySelector('[data-test="agenda-card"]')).toBeNull();
  });
});

describe('GOV-606 empty-state honesty (the REAL reviewed-Alpine projection)', () => {
  it('Board A shows a disclosed empty-state naming the unanchored statements — no fabricated card', () => {
    renderBoards(root, { board: REAL });
    expect(REAL.cardCount).toBe(0);
    expect(root.querySelectorAll('[data-test="agenda-card"]').length).toBe(0);
    const empty = root.querySelector('[data-test="state-empty"]')!;
    expect(empty).not.toBeNull();
    expect(empty.textContent).toContain('not yet anchored');
    // the disclosure footer surfaces decisions/categories/unanchored/scope limits
    const footer = root.querySelector('[data-test="board-disclosures"]')!;
    expect(footer.querySelector('[data-test="disclosure-unanchored"]')).not.toBeNull();
  });

  it('Board B still shows all six empty lanes for the empty projection', () => {
    renderBoards(root, { board: REAL });
    (root.querySelector('[data-test="tab-tracking"]') as HTMLButtonElement).click();
    const lanes = [...root.querySelectorAll('[data-test="tracking-lane"]')];
    expect(lanes.length).toBe(6);
    for (const l of lanes) {
      expect(l.querySelector('[data-test="lane-empty"]')?.textContent).toBe('—');
    }
  });
});

describe('GOV-606 reviewer-internal is the SOLE gate', () => {
  it('public lane renders zero board content and no cards', () => {
    renderBoards(root, { board: SAMPLE, access: 'public', notice: 'x' });
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="agenda-boards"]')).toBeNull();
    expect(root.querySelectorAll('[data-test="agenda-card"]').length).toBe(0);
    expect(root.querySelector('[data-test="board-mount"]')).toBeNull();
  });

  it('public lane leaks no reviewer-internal card leaf into the DOM', () => {
    renderBoards(root, { board: SAMPLE, access: 'public' });
    // No agenda item title, thread label, or video URL from the projection leaks.
    expect(root.innerHTML).not.toContain('FY27 Budget');
    expect(root.innerHTML).not.toContain('Town budget');
    expect(root.innerHTML).not.toContain('youtube.com');
  });

  it('a projection whose own access is not reviewer_internal renders no content', () => {
    const board = clone(SAMPLE);
    board.access = 'public';
    renderBoards(root, { board });
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="agenda-card"]').length).toBe(0);
  });
});

describe('GOV-606 true-dark board chrome tokens (UX invariant preserved)', () => {
  it('defines the board-chrome elevation tokens in BOTH themes', () => {
    for (const t of ['--gw-board-bg', '--gw-lane-bg', '--gw-lane-header-bg', '--gw-card-bg']) {
      const count = GW_TOKENS.split(t).length - 1;
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  it('dark values form a real elevation ladder board < lane < card (deeper = darker)', () => {
    const dark = GW_TOKENS.slice(GW_TOKENS.indexOf('[data-theme="dark"]'));
    const val = (name: string): number => {
      // case-insensitive: GOV-657 re-pointed these to uppercase hex (#0B0F14…)
      const m = new RegExp(`${name}:#([0-9a-f]{6})`, 'i').exec(dark)!;
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
  });
});
