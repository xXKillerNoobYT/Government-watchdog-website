// @vitest-environment jsdom
//
// GOV-665 — Wave 2 pages program: Fast Agenda, timeline levels/filters, and
// Boards directory/detail. These tests pin the public-lane 0-leak invariant, the
// shared `gw_home_mode` Simple/Advanced switch, and the no-score body detail rule.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderBoardsDirectory, renderFastAgenda, renderTimelineLevels, readPageMode } from '../src/ui/pages-program';
import type { AgendaBoard } from '../src/types/agenda-board';
import type { ReadApiResponse } from '../src/types/read-api';
import boardSampleData from '../src/fixtures/agenda-board-projection.sample.dev.json';
import boardRealData from '../src/fixtures/agenda-board-projection.json';
import graphRealData from '../src/fixtures/concept-graph-real.json';

const SAMPLE_BOARD = boardSampleData as unknown as AgendaBoard;
const REAL_BOARD = boardRealData as unknown as AgendaBoard;
const GRAPH_REAL = graphRealData as unknown as ReadApiResponse;

let root: HTMLElement;
let store: Record<string, string>;
beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
  store = {};
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      clear: () => { store = {}; },
    },
  });
  root = document.createElement('div');
  document.body.append(root);
});

describe('GOV-665 Fast Agenda page', () => {
  it('renders the honest empty next-meeting hero from the real projection', () => {
    renderFastAgenda(root, REAL_BOARD, 'real');
    expect(root.querySelector('[data-test="fast-agenda-empty"]')?.textContent).toContain('No next agenda item is review-ready yet');
    expect(root.querySelector('[data-test="fast-agenda-card"]')).toBeNull();
    expect(root.querySelector('[data-test="fixture-banner"]')).toBeNull();
    expect(root.querySelector('[data-test="source-notice"]')?.textContent).toContain('real');
  });

  it('shows the sample banner only for explicit demo/sample fixture routes', () => {
    renderFastAgenda(root, SAMPLE_BOARD, 'sample', true);
    expect(root.querySelector('[data-test="fixture-banner"]')?.textContent).toContain('OFFLINE SAMPLE');
  });

  it('uses the shared mode preference to switch from Advanced list to one-card Simple', () => {
    renderFastAgenda(root, SAMPLE_BOARD, 'sample');
    expect(readPageMode()).toBe('advanced');
    expect(root.querySelectorAll('[data-test="fast-agenda-card"]')).toHaveLength(SAMPLE_BOARD.cardCount);
    const shellRerender = vi.fn();
    window.addEventListener('hashchange', shellRerender, { once: true });
    root.querySelector<HTMLButtonElement>('[data-test="mode-simple"]')!.click();
    expect(localStorage.getItem('gw_home_mode')).toBe('simple');
    expect(root.querySelectorAll('[data-test="fast-agenda-card"]')).toHaveLength(1);
    expect(shellRerender).toHaveBeenCalledOnce();
  });

  it('does not let Advanced mode override an explicit light theme choice', () => {
    localStorage.setItem('gw-theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
    renderFastAgenda(root, SAMPLE_BOARD, 'sample');
    root.querySelector<HTMLButtonElement>('[data-test="mode-advanced"]')!.click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('renders zero agenda card content for a public-lane projection', () => {
    renderFastAgenda(root, { ...SAMPLE_BOARD, access: 'public' }, 'sample');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="fast-agenda-card"]')).toBeNull();
  });
});

describe('GOV-665 Timeline levels and event filters', () => {
  it('renders advanced three-lane style buckets for reviewed source events', () => {
    localStorage.setItem('gw_home_mode', 'advanced');
    renderTimelineLevels(root, GRAPH_REAL, new URLSearchParams('level=day&type=source'), 'real');
    expect(root.querySelector('[data-test="timeline-filters"]')?.textContent).toContain('Level: day');
    expect(root.querySelector('[data-test="timeline-filters"]')?.textContent).toContain('Type: source');
    expect(root.querySelector('[data-test="timeline-advanced-lanes"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="record-card"]')).toHaveLength(GRAPH_REAL.records!.length);
    expect(root.querySelector('[data-test="timeline-hybrid-intro"]')?.textContent).toContain('existing fail-closed record cards');
    expect(root.querySelector('[data-test="timeline-filter-form"]')).not.toBeNull();
    expect(root.textContent).toContain('County and State lanes remain unavailable');
  });

  it('shows an honest empty state instead of inventing records for unmatched filters', () => {
    renderTimelineLevels(root, GRAPH_REAL, new URLSearchParams('type=agenda'), 'real');
    expect(root.querySelector('[data-test="timeline-empty"]')?.textContent).toContain('No reviewed records match');
    expect(root.querySelector('[data-test="record-card"]')).toBeNull();
  });

  it('applies the shared shell search query to reviewed fields only', () => {
    const needle = GRAPH_REAL.records![0].statement_id;
    renderTimelineLevels(root, GRAPH_REAL, new URLSearchParams(`search=${encodeURIComponent(needle)}`), 'real');
    expect(root.querySelector('[data-test="timeline-search-filter"]')?.textContent).toContain(needle.toLocaleLowerCase());
    expect(root.querySelectorAll('[data-test="record-card"]')).toHaveLength(1);
  });

  it('submits the hybrid filter controls as an encoded timeline route', () => {
    renderTimelineLevels(root, GRAPH_REAL, new URLSearchParams(), 'real');
    const search = root.querySelector<HTMLInputElement>('[data-test="timeline-search-input"]')!;
    const level = root.querySelector<HTMLSelectElement>('[data-test="timeline-level-select"]')!;
    search.value = 'water main';
    level.value = 'day';
    root.querySelector<HTMLFormElement>('[data-test="timeline-filter-form"]')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(window.location.hash).toBe('#/timeline?search=water+main&level=day&reviewer=1');
  });

  it('renders zero timeline cards outside reviewer-internal access', () => {
    renderTimelineLevels(root, { ...GRAPH_REAL, access: 'public' }, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="record-card"]')).toBeNull();
  });
});

describe('GOV-665 Boards directory and detail', () => {
  it('renders only real concept-graph body/topic nodes in the directory', () => {
    renderBoardsDirectory(root, GRAPH_REAL, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="boards-directory-note"]')?.textContent).toContain('No scores');
    expect(root.querySelectorAll('[data-test="board-directory-card"]').length).toBeGreaterThan(1);
  });

  it('renders detail without scores and with honest-empty member names/roles', () => {
    renderBoardsDirectory(root, GRAPH_REAL, new URLSearchParams('id=topic:alpine:budget-taxes'), 'real');
    expect(root.querySelector('[data-test="board-detail"]')?.textContent).toContain('Town budget and taxes');
    expect(root.querySelector('[data-test="board-no-scores"]')?.textContent).toContain('No scores');
    expect(root.querySelector('[data-test="board-members"]')?.textContent).toContain('No reviewed member-name/role rows');
  });

  it('renders zero directory cards outside reviewer-internal access', () => {
    renderBoardsDirectory(root, { ...GRAPH_REAL, access: 'public' }, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="board-directory-card"]')).toBeNull();
  });
});
