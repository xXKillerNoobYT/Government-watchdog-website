// @vitest-environment jsdom
//
// GOV-153 — Isaac's two GOV-129-review enhancements:
//   #1 side year/month/day time-bar that snaps to active days, and
//   #2 click-to-reveal blur over the record info.
// The pure navigator logic is asserted DOM-free; the render assertions lock the
// trust/AI-label integrity rule (badges must stay OUTSIDE the blur).

import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildTimeNavigator,
  dayAnchorId,
  orderedTimeline,
} from '../src/ui/timeline';
import { render } from '../src/ui/render';
import { resolved } from '../src/state/async-state';
import { isEmptyResponse } from '../src/data/client';
import { AI_LABEL_TEXT } from '../src/ui/state-view';
import type { ReadApiResponse, StatementRecord } from '../src/types/read-api';

function rec(partial: Partial<StatementRecord> & { statement_id: string }): StatementRecord {
  return { evidence: [], ...partial };
}

/** A record dated purely by its alpine agenda-item id (web-safe ordering date). */
function dated(id: string, date: string, extra: Partial<StatementRecord> = {}): StatementRecord {
  return rec({ statement_id: id, agenda_item_id: `alpine:${date}:item-1`, statement_text: `text ${id}`, ...extra });
}

// --- #1 navigator logic ------------------------------------------------------

describe('buildTimeNavigator — year/month/active-day index', () => {
  it('groups dated records newest-first across all three levels', () => {
    const ordered = orderedTimeline([
      dated('a', '2021-03-05'),
      dated('b', '2020-11-20'),
      dated('c', '2021-03-12'),
      dated('d', '2021-01-02'),
    ]);
    const nav = buildTimeNavigator(ordered);

    expect(nav.years.map((y) => y.year)).toEqual(['2021', '2020']); // newest year first
    const y2021 = nav.years[0];
    expect(y2021.count).toBe(3);
    expect(y2021.months.map((m) => m.month)).toEqual(['03', '01']); // newest month first
    const mar = y2021.months[0];
    expect(mar.label).toBe('Mar');
    expect(mar.days.map((d) => d.date)).toEqual(['2021-03-12', '2021-03-05']); // newest day first
  });

  it('emits ONLY active days and counts per day (Isaac 1.3 — skip empty days)', () => {
    const ordered = orderedTimeline([
      dated('a', '2022-06-10'),
      dated('b', '2022-06-10'), // same active day → count 2, one entry
      dated('c', '2022-06-15'),
    ]);
    const nav = buildTimeNavigator(ordered);
    const june = nav.years[0].months[0];
    expect(june.days.map((d) => d.date)).toEqual(['2022-06-15', '2022-06-10']);
    expect(june.days.map((d) => d.count)).toEqual([1, 2]);
    // No empty days between the 10th and 15th are ever emitted.
    expect(june.days).toHaveLength(2);
  });

  it('counts dateless records separately and never places them on a bar', () => {
    const ordered = orderedTimeline([dated('a', '2020-01-01'), rec({ statement_id: 'z' })]);
    const nav = buildTimeNavigator(ordered);
    expect(nav.undatedCount).toBe(1);
    expect(nav.years).toHaveLength(1);
    expect(nav.years[0].count).toBe(1);
  });

  it('day anchor ids match the dayAnchorId convention', () => {
    const nav = buildTimeNavigator(orderedTimeline([dated('a', '2023-09-09')]));
    expect(nav.years[0].months[0].days[0].anchorId).toBe(dayAnchorId('2023-09-09'));
    expect(dayAnchorId('2023-09-09')).toBe('gw-day-2023-09-09');
  });

  it('returns an empty navigator (no throw) for an all-dateless set', () => {
    const nav = buildTimeNavigator(orderedTimeline([rec({ statement_id: 'z' })]));
    expect(nav.years).toEqual([]);
    expect(nav.undatedCount).toBe(1);
  });
});

// --- render: side time-bar + click-to-reveal blur ----------------------------

let root: HTMLElement;
beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
});

const data: ReadApiResponse = {
  scope: 'alpine',
  access: 'reviewer_internal',
  records: [
    dated('a', '2021-03-05', { ui_status: 'source-backed' }),
    dated('b', '2020-11-20', { produced_by: 'ai', ui_status: 'unverified' }),
  ],
};

describe('render — #1 side time-bar', () => {
  it('renders the three coordinated bars with year/month/day buttons', () => {
    render(root, resolved(data, 'fixture', isEmptyResponse));
    expect(root.querySelector('[data-test="time-navigator"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="tn-year"]').length).toBe(2); // 2021, 2020
    expect(root.querySelectorAll('[data-test="tn-month"]').length).toBeGreaterThanOrEqual(1);
    expect(root.querySelectorAll('[data-test="tn-day"]').length).toBeGreaterThanOrEqual(1);
  });

  it('the first card of each day carries the matching scroll anchor', () => {
    render(root, resolved(data, 'fixture', isEmptyResponse));
    expect(document.getElementById(dayAnchorId('2021-03-05'))).not.toBeNull();
    expect(document.getElementById(dayAnchorId('2020-11-20'))).not.toBeNull();
  });

  it('selecting a different year repopulates the month bar', () => {
    render(root, resolved(data, 'fixture', isEmptyResponse));
    const years = root.querySelectorAll<HTMLButtonElement>('[data-test="tn-year"]');
    // Default selects newest year (2021 → March). Click 2020 → month bar shows Nov.
    years[1].click();
    const months = [...root.querySelectorAll('[data-test="tn-month"] .gw-tn-label')].map((n) => n.textContent);
    expect(months).toContain('Nov');
    expect(months).not.toContain('Mar');
  });
});

describe('render — #2 click-to-reveal blur (trust/AI integrity)', () => {
  it('blurs the record info by default and reveals it on button click', () => {
    render(root, resolved(data, 'fixture', isEmptyResponse));
    const card = root.querySelector('[data-test="record-card"]')!;
    const info = card.querySelector('[data-test="card-info"]')!;
    const btn = card.querySelector<HTMLButtonElement>('[data-test="reveal-btn"]')!;

    expect(card.classList.contains('gw-revealed')).toBe(false);
    expect(info.getAttribute('aria-hidden')).toBe('true');
    expect(btn.getAttribute('aria-expanded')).toBe('false');

    btn.click();
    expect(card.classList.contains('gw-revealed')).toBe(true);
    expect(info.getAttribute('aria-hidden')).toBe('false');
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.textContent).toBe('Hide details');

    btn.click();
    expect(card.classList.contains('gw-revealed')).toBe(false);
    expect(btn.textContent).toBe('Reveal details');
  });

  it('keeps the trust badge and locked AI label OUTSIDE the blurred region', () => {
    render(root, resolved(data, 'fixture', isEmptyResponse));
    // The AI-produced card (record b) must show its locked label regardless of blur.
    const aiLabel = root.querySelector('[data-test="ai-label"]')!;
    expect(aiLabel.textContent).toBe(AI_LABEL_TEXT);
    // Neither the trust badge nor the AI label may live inside .gw-card-info.
    expect(aiLabel.closest('[data-test="card-info"]')).toBeNull();
    for (const badge of root.querySelectorAll('[data-test="trust-badge"]')) {
      expect(badge.closest('[data-test="card-info"]')).toBeNull();
    }
    // The AI analysis text + its "not verified" caption DO travel inside the info,
    // so they are never shown stripped of context once revealed.
    const analysis = root.querySelector('[data-test="ai-analysis"]')!;
    expect(analysis.closest('[data-test="card-info"]')).not.toBeNull();
  });
});
