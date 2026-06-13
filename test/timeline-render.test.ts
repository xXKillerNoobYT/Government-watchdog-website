// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '../src/ui/render';
import { resolved } from '../src/state/async-state';
import { isEmptyResponse } from '../src/data/client';
import type { ReadApiResponse, StatementRecord } from '../src/types/read-api';
// Thread / completeness / typed-link / chronology rendering runs on the labeled
// SYNTHETIC concept-graph demo — the real reviewed corpus has 0 threads and its
// records carry no agenda_item_id, so it cannot exercise these surfaces yet.
import demoData from '../src/fixtures/concept-graph-demo.json';

const FIXTURE = demoData as unknown as ReadApiResponse;

let root: HTMLElement;
beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
});

function ready(data: ReadApiResponse): void {
  render(root, resolved(data, 'fixture', isEmptyResponse));
}

describe('timeline render — chronology, thread surface, completeness', () => {
  it('renders cards newest-first by timelineDate', () => {
    ready(FIXTURE);
    const cards = [...root.querySelectorAll('[data-test="timeline"] [data-test="record-card"]')];
    // Newest meeting (2019-07-09) statements must come before the oldest (2019-06-11).
    const text = cards.map((c) => c.textContent ?? '');
    const firstCorrection = text.findIndex((t) => t.includes('later correction') || t.includes('follow-up fireworks'));
    const firstAdoptionReading = text.findIndex((t) => t.includes('adopted a seasonal fireworks'));
    expect(firstCorrection).toBeGreaterThanOrEqual(0);
    expect(firstCorrection).toBeLessThan(firstAdoptionReading);
  });

  it('renders the assembled thread with instances in known-then order', () => {
    ready(FIXTURE);
    const instances = [...root.querySelectorAll('[data-test="thread-instance"]')];
    expect(instances.length).toBe(3);
    const dates = [...root.querySelectorAll('[data-test="instance-date"]')].map((n) => n.textContent);
    expect(dates).toEqual(['2019-06-11', '2019-06-25', '2019-07-09']); // earliest first
  });

  it('renders a typed lifecycle link (Supersedes/Amends/Revisits), never untyped "related"', () => {
    ready(FIXTURE);
    const types = [...root.querySelectorAll('[data-test="instance-links"] [data-test="related-type"]')].map((n) => n.textContent);
    expect(types).toContain('Supersedes');
    expect(types.every((t) => (t ?? '').toLowerCase() !== 'related')).toBe(true);
  });

  it('shows "no linked prior/next item recorded" when an instance has no edge', () => {
    const lonely: ReadApiResponse = {
      scope: 'alpine',
      access: 'reviewer_internal',
      records: [],
      agenda_thread: {
        thread: { agenda_thread_id: 'alpine:thread:x', title: 'X', canonicalHumanLabel: 'x', sourceAliases: [] },
        members: [{ agenda_item_id: 'alpine:2022-01-01:item-1', title: 'Solo', item_order: 1 }],
        lifecycle_edges: [],
      },
    };
    render(root, resolved(lonely, 'fixture', isEmptyResponse));
    expect(root.querySelector('[data-test="no-link"]')?.textContent).toBe('no linked prior/next item recorded');
  });

  it('renders the gaps completeness state from the fixture (never complete)', () => {
    ready(FIXTURE);
    const badge = root.querySelector('[data-test="completeness-badge"]');
    expect(badge?.textContent).toContain('gaps');
    expect(badge?.classList.contains('gw-completeness-gaps')).toBe(true);
    expect(root.querySelectorAll('[data-test="completeness-gaps"] li').length).toBe(2);
  });

  it('renders the complete completeness state only when backend asserts it', () => {
    const completeData: ReadApiResponse = {
      ...FIXTURE,
      agenda_thread: { ...FIXTURE.agenda_thread!, completeness: { state: 'complete' } },
    };
    ready(completeData);
    const badge = root.querySelector('[data-test="completeness-badge"]');
    expect(badge?.textContent).toBe('complete');
    expect(badge?.classList.contains('gw-completeness-complete')).toBe(true);
  });

  it('falls to "completeness unknown" when the backend omits completeness', () => {
    const noCompleteness: ReadApiResponse = {
      ...FIXTURE,
      agenda_thread: { ...FIXTURE.agenda_thread!, completeness: undefined },
    };
    ready(noCompleteness);
    expect(root.querySelector('[data-test="completeness-badge"]')?.textContent).toBe('completeness unknown');
  });

  it('drops + logs a non-Alpine record instead of rendering it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mixed: ReadApiResponse = {
      scope: 'alpine',
      access: 'reviewer_internal',
      records: [
        { statement_id: 'keep', statement_text: 'Alpine row', agenda_item_id: 'alpine:2020-01-01:item-1', evidence: [] } as StatementRecord,
        { statement_id: 'leak', statement_text: 'Other jurisdiction row', agenda_item_id: 'jackson:2020-01-01:item-1', evidence: [] } as StatementRecord,
      ],
    };
    ready(mixed);
    const cards = [...root.querySelectorAll('[data-test="record-card"]')].map((c) => c.textContent ?? '');
    expect(cards.some((t) => t.includes('Alpine row'))).toBe(true);
    expect(cards.some((t) => t.includes('Other jurisdiction row'))).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('dropped non-Alpine record leak'));
    warn.mockRestore();
  });
});
