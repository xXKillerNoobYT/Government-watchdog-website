// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi , afterEach } from 'vitest';
import {
  AXIS_END,
  AXIS_START,
  DESIGN_FIXTURE_LABEL,
  THREAD_PRESET,
  eventsForSlug,
  normalizeIssueSlug,
  renderTimelineDesign,
} from '../src/ui/timeline-design';

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

afterEach(() => {
  vi.unstubAllGlobals();
});

let root: HTMLElement;
const REVIEWER = { access: 'reviewer_internal', fixture: true };

function q(search = ''): URLSearchParams {
  return new URLSearchParams(search);
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  localStorage.clear();
  root = document.createElement('div');
  document.body.append(root);
});

describe('issue slug handling', () => {
  it('accepts the design vocabulary', () => {
    expect(normalizeIssueSlug('moratorium')).toBe('moratorium');
    expect(normalizeIssueSlug('thread')).toBe('thread');
  });

  it('fails closed to all on an unknown or missing slug', () => {
    expect(normalizeIssueSlug('drop-table')).toBe('all');
    expect(normalizeIssueSlug('')).toBe('all');
    expect(normalizeIssueSlug(null)).toBe('all');
  });

  it('resolves the thread preset to its member issues only', () => {
    const events = eventsForSlug('thread');
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(THREAD_PRESET).toContain(event.issueKey);
    }
  });

  it('filters to a single issue run', () => {
    const events = eventsForSlug('moratorium');
    expect(events.every((e) => e.issueKey === 'moratorium')).toBe(true);
    expect(events.length).toBeGreaterThan(1);
  });
});

describe('renderTimelineDesign gating', () => {
  it('renders nothing but a gate without reviewer access', () => {
    renderTimelineDesign(root, q(), { access: 'public', fixture: true });
    expect(root.querySelector('[data-test="timeline-design-gate"]')).not.toBeNull();
    expect(root.querySelector('[data-test="timeline-lanes"]')).toBeNull();
    expect(root.textContent).not.toContain('Fixture council meeting');
  });

  it('renders nothing but a gate without explicit fixture consent', () => {
    renderTimelineDesign(root, q(), { access: 'reviewer_internal', fixture: false });
    expect(root.querySelector('[data-test="timeline-design-gate"]')).not.toBeNull();
    expect(root.querySelector('[data-test="timeline-dot"]')).toBeNull();
  });

  it('fails closed when no options are supplied at all', () => {
    renderTimelineDesign(root, q());
    expect(root.querySelector('[data-test="timeline-design-gate"]')).not.toBeNull();
  });
});

describe('renderTimelineDesign fixture lane', () => {
  it('labels itself a synthetic fixture', () => {
    renderTimelineDesign(root, q(), REVIEWER);
    expect(root.querySelector('[data-test="timeline-design-banner"]')?.textContent).toBe(DESIGN_FIXTURE_LABEL);
  });

  it('renders three lanes across the design axis window', () => {
    renderTimelineDesign(root, q(), REVIEWER);
    expect(root.querySelectorAll('[data-test="timeline-lane"]')).toHaveLength(3);
    expect(root.querySelector('[data-test="timeline-lanes"]')?.textContent).toContain(AXIS_START);
    expect(root.querySelector('[data-test="timeline-lanes"]')?.textContent).toContain(AXIS_END);
  });

  it('renders one dot and one list row per event', () => {
    renderTimelineDesign(root, q(), REVIEWER);
    const dots = root.querySelectorAll('[data-test="timeline-dot"]').length;
    const rows = root.querySelectorAll('[data-test="timeline-design-row"]').length;
    expect(dots).toBe(rows);
    expect(dots).toBeGreaterThan(10);
  });

  it('honours the issue deep link and reports the match count', () => {
    renderTimelineDesign(root, q('issue=moratorium'), REVIEWER);
    const rows = root.querySelectorAll('[data-test="timeline-design-row"]');
    expect(rows.length).toBe(eventsForSlug('moratorium').length);
    expect(root.textContent).toContain(`Event list — ${rows.length} matching`);
    expect(root.querySelector('[data-issue="moratorium"]')?.getAttribute('aria-current')).toBe('true');
  });

  it('fails closed to the unfiltered view on an unknown deep link', () => {
    renderTimelineDesign(root, q('issue=../../etc/passwd'), REVIEWER);
    expect(root.querySelector('[data-issue="all"]')?.getAttribute('aria-current')).toBe('true');
    expect(root.querySelectorAll('[data-test="timeline-design-row"]').length)
      .toBe(eventsForSlug('all').length);
  });

  it('marks unbuilt saved views as a Coming Soon feature, not a data gap', () => {
    renderTimelineDesign(root, q(), REVIEWER);
    const chip = root.querySelector('[data-test="coming-soon-chip"]');
    expect(chip?.textContent).toContain('Saved timeline views');
    expect(chip?.textContent).not.toMatch(/not wired yet|reviewed contract/i);
  });

  it('shows the reduced window control set in Simple mode', () => {
    localStorage.setItem('gw_home_mode', 'advanced');
    renderTimelineDesign(root, q(), REVIEWER);
    const advanced = root.querySelectorAll('[data-test="timeline-window-pill"]').length;

    localStorage.setItem('gw_home_mode', 'simple');
    renderTimelineDesign(root, q(), REVIEWER);
    const simple = root.querySelectorAll('[data-test="timeline-window-pill"]').length;

    expect(advanced).toBe(4);
    expect(simple).toBe(2);
  });

  it('keeps every fixture row visibly tagged as a fixture record', () => {
    renderTimelineDesign(root, q(), REVIEWER);
    for (const row of root.querySelectorAll('[data-test="timeline-design-row"]')) {
      expect(row.textContent).toContain('Fixture');
    }
  });
});
