// @vitest-environment jsdom
//
// GOV-665 — Wave 2 pages program: Fast Agenda, timeline levels/filters, and
// Boards directory/detail. These tests pin the public-lane 0-leak invariant, the
// `gw-mode` Simple/Advanced switch, and the no-score body detail rule.
import { beforeEach, describe, expect, it } from 'vitest';
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
  });

  it('uses gw-mode to switch from one-card Simple to list Advanced for the sample projection', () => {
    renderFastAgenda(root, SAMPLE_BOARD, 'sample');
    expect(readPageMode()).toBe('simple');
    expect(root.querySelectorAll('[data-test="fast-agenda-card"]')).toHaveLength(1);
    root.querySelector<HTMLButtonElement>('[data-test="mode-advanced"]')!.click();
    expect(localStorage.getItem('gw-mode')).toBe('advanced');
    expect(root.querySelectorAll('[data-test="fast-agenda-card"]')).toHaveLength(SAMPLE_BOARD.cardCount);
  });

  it('renders zero agenda card content for a public-lane projection', () => {
    renderFastAgenda(root, { ...SAMPLE_BOARD, access: 'public' }, 'sample');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="fast-agenda-card"]')).toBeNull();
  });
});

describe('GOV-665 Timeline levels and event filters', () => {
  it('renders advanced three-lane style buckets for reviewed source events', () => {
    localStorage.setItem('gw-mode', 'advanced');
    renderTimelineLevels(root, GRAPH_REAL, new URLSearchParams('level=day&type=source'), 'real');
    expect(root.querySelector('[data-test="timeline-filters"]')?.textContent).toContain('Level: day');
    expect(root.querySelector('[data-test="timeline-filters"]')?.textContent).toContain('Type: source');
    expect(root.querySelector('[data-test="timeline-advanced-lanes"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="record-card"]')).toHaveLength(GRAPH_REAL.records!.length);
  });

  it('shows an honest empty state instead of inventing records for unmatched filters', () => {
    renderTimelineLevels(root, GRAPH_REAL, new URLSearchParams('type=agenda'), 'real');
    expect(root.querySelector('[data-test="timeline-empty"]')?.textContent).toContain('No reviewed records match');
    expect(root.querySelector('[data-test="record-card"]')).toBeNull();
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
