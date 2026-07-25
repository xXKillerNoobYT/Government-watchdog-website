// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  axisPercent,
  connectorPoints,
  timelineLanes,
  type TimelineEventSpec,
  type TimelineLaneSpec,
} from '../src/ui/timeline-lanes';

const LANES: TimelineLaneSpec[] = [
  { level: 'town', label: 'Town' },
  { level: 'county', label: 'County', gapNote: 'County timeline not connected yet.' },
  { level: 'state', label: 'State', gapNote: 'State timeline not connected yet.' },
];

const EVENTS: TimelineEventSpec[] = [
  { id: 'e1', date: '2026-07-06', level: 'town', type: 'document', label: 'Agenda posted', issueKey: 'moratorium' },
  { id: 'e2', date: '2026-07-21', level: 'town', type: 'meeting', label: 'Council meeting', issueKey: 'moratorium' },
  { id: 'e3', date: '2026-07-28', level: 'town', type: 'change', label: 'Packet replaced', issueKey: 'fees' },
];

const SPEC = { start: '2026-07-06', end: '2026-08-05', lanes: LANES, events: EVENTS };

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('axisPercent', () => {
  it('maps the window endpoints to 0 and 100', () => {
    expect(axisPercent('2026-07-06', '2026-07-06', '2026-08-05')).toBe(0);
    expect(axisPercent('2026-08-05', '2026-07-06', '2026-08-05')).toBe(100);
  });

  it('places an interior date proportionally', () => {
    const mid = axisPercent('2026-07-21', '2026-07-06', '2026-08-05');
    expect(mid).toBeGreaterThan(45);
    expect(mid).toBeLessThan(55);
  });

  it('clamps out-of-window dates and fails closed on bad input', () => {
    expect(axisPercent('2026-06-01', '2026-07-06', '2026-08-05')).toBe(0);
    expect(axisPercent('2026-12-01', '2026-07-06', '2026-08-05')).toBe(100);
    expect(axisPercent('not-a-date', '2026-07-06', '2026-08-05')).toBe(0);
    expect(axisPercent('2026-07-21', '2026-08-05', '2026-07-06')).toBe(0);
  });
});

describe('connectorPoints', () => {
  it('orders points by date regardless of input order', () => {
    const reversed = [EVENTS[1], EVENTS[0]];
    expect(connectorPoints(reversed, SPEC)).toBe(connectorPoints([EVENTS[0], EVENTS[1]], SPEC));
  });

  it('places each point at its lane row centre', () => {
    const points = connectorPoints([
      { id: 'a', date: '2026-07-06', level: 'town', type: 'meeting', label: 'x' },
      { id: 'b', date: '2026-07-06', level: 'county', type: 'meeting', label: 'y' },
    ], SPEC);
    expect(points).toBe('0,5 0,15');
  });
});

describe('timelineLanes', () => {
  it('renders one lane per spec and a dot per event', () => {
    const view = timelineLanes(SPEC);
    expect(view.querySelectorAll('[data-test="timeline-lane"]')).toHaveLength(3);
    expect(view.querySelectorAll('[data-test="timeline-dot"]')).toHaveLength(3);
  });

  it('shows the gap note on lanes with no events instead of inventing dots', () => {
    const view = timelineLanes(SPEC);
    const gaps = [...view.querySelectorAll('[data-test="timeline-lane-gap"]')].map((n) => n.textContent);
    expect(gaps).toEqual(['County timeline not connected yet.', 'State timeline not connected yet.']);
  });

  it('labels every dot with date, lane, and event', () => {
    const view = timelineLanes(SPEC);
    const first = view.querySelector('[data-test="timeline-dot"]');
    expect(first?.getAttribute('aria-label')).toBe('2026-07-06 · Town · Agenda posted');
  });

  it('draws a dashed connector for a focused multi-event run and clears it after', () => {
    const view = timelineLanes(SPEC);
    const dot = view.querySelector<HTMLElement>('[data-test="timeline-dot"]');
    dot?.dispatchEvent(new MouseEvent('mouseenter'));
    expect(view.getAttribute('data-focus-run')).toBe('moratorium');
    expect(view.querySelectorAll('[data-test="timeline-connector"]')).toHaveLength(1);

    const active = [...view.querySelectorAll('[data-test="timeline-dot"]')]
      .filter((n) => n.getAttribute('data-run-active') === 'true');
    expect(active).toHaveLength(2);

    dot?.dispatchEvent(new MouseEvent('mouseleave'));
    expect(view.hasAttribute('data-focus-run')).toBe(false);
    expect(view.querySelectorAll('[data-test="timeline-connector"]')).toHaveLength(0);
  });

  it('does not draw a connector for a single-event run', () => {
    const view = timelineLanes(SPEC);
    const lone = [...view.querySelectorAll<HTMLElement>('[data-test="timeline-dot"]')]
      .find((n) => n.dataset.issueKey === 'fees');
    lone?.dispatchEvent(new MouseEvent('mouseenter'));
    expect(view.getAttribute('data-focus-run')).toBe('fees');
    expect(view.querySelectorAll('[data-test="timeline-connector"]')).toHaveLength(0);
  });

  it('reports the selected event to the caller', () => {
    const onSelect = vi.fn();
    const view = timelineLanes({ ...SPEC, onSelect });
    view.querySelector<HTMLElement>('[data-test="timeline-dot"]')?.click();
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });

  it('keeps the connector overlay hidden from assistive technology', () => {
    const view = timelineLanes(SPEC);
    expect(view.querySelector('[data-test="timeline-connectors"]')?.getAttribute('aria-hidden')).toBe('true');
  });
});
