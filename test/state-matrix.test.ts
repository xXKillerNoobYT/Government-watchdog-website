// @vitest-environment jsdom
/**
 * GOV-104 · Slice 4·E — full state matrix renders from a fixture.
 *
 * The async states (loading / empty / error) are covered in render.test.ts.
 * This pins the four RECORD-LEVEL trust states the matrix must show end-to-end —
 * pending-review, disputed, corrected, do-not-publish — each from the labeled
 * `state-matrix.json` fixture, with the correct verbatim badge and tone.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '../src/ui/render';
import { resolved } from '../src/state/async-state';
import { assertWebSafe } from '../src/data/web-safe';
import { isEmptyResponse } from '../src/data/client';
import type { ReadApiResponse } from '../src/types/read-api';
import matrixData from '../src/fixtures/state-matrix.json';

const MATRIX = assertWebSafe(matrixData as ReadApiResponse);

let root: HTMLElement;
beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
});

/**
 * Locate a card by its statement TEXT, not by fixture index — the timeline
 * renders newest-first, so rendered card order ≠ the fixture array order.
 */
function cardFor(statementId: string): HTMLElement {
  render(root, resolved(MATRIX, 'fixture', isEmptyResponse));
  const record = MATRIX.records!.find((r) => r.statement_id === statementId);
  expect(record, `fixture must contain ${statementId}`).toBeTruthy();
  const cards = Array.from(root.querySelectorAll('[data-test="record-card"]')) as HTMLElement[];
  const match = cards.find((c) => (c.textContent ?? '').includes(record!.statement_text ?? ''));
  expect(match, `a rendered card for ${statementId}`).toBeTruthy();
  return match!;
}

describe('state matrix — record-level trust states render labeled from a fixture', () => {
  it('the matrix fixture is web-safe (no raw paths / forbidden keys)', () => {
    expect(() => assertWebSafe(MATRIX)).not.toThrow();
  });

  it('renders one card per matrix record, each with a non-empty badge', () => {
    render(root, resolved(MATRIX, 'fixture', isEmptyResponse));
    const cards = root.querySelectorAll('[data-test="record-card"]');
    expect(cards.length).toBe(MATRIX.records!.length);
    for (const c of Array.from(cards)) {
      const badge = c.querySelector('[data-test="trust-badge"]');
      expect((badge?.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  const cases: Array<{ id: string; label: string; tone: string }> = [
    { id: 'stmt-pending', label: 'Pending review', tone: 'caution' },
    { id: 'stmt-disputed', label: 'Disputed', tone: 'stop' },
    { id: 'stmt-corrected', label: 'Corrected', tone: 'neutral' },
    { id: 'stmt-do-not-publish', label: 'Do not publish', tone: 'stop' },
  ];

  for (const { id, label, tone } of cases) {
    it(`renders "${label}" (tone ${tone}) for ${id}`, () => {
      const badge = cardFor(id).querySelector('[data-test="trust-badge"]')!;
      expect(badge.textContent).toBe(label);
      expect(badge.getAttribute('data-tone')).toBe(tone);
    });
  }

  it('the disputed card shows both conflicting sources in its drawer', () => {
    const drawer = cardFor('stmt-disputed').querySelector('[data-test="source-drawer"]')!;
    const entries = drawer.querySelectorAll('[data-test="source-entry"]');
    expect(entries.length).toBe(2);
  });

  it('the trust legend is present and tap-reachable above the matrix', () => {
    render(root, resolved(MATRIX, 'fixture', isEmptyResponse));
    const legend = root.querySelector('[data-test="trust-legend"]');
    expect(legend?.tagName).toBe('DETAILS');
    // Every status row the cards can show is explained in the legend.
    expect(root.querySelector('[data-test="legend-status-do-not-publish"]')).not.toBeNull();
    expect(root.querySelector('[data-test="legend-ai"]')).not.toBeNull();
  });
});
