// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReadApiResponse } from '../src/types/read-api';
import { renderHomeReadModel } from '../src/ui/home';
import {
  renderProjectionGap,
  renderReviewerContextState,
  type ProjectionGapDefinition,
  type ReviewerContextPanelStatus,
} from '../src/ui/reviewer-context-state';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, String(value)),
  };
}

const RESPONSE: ReadApiResponse = {
  scope: 'alpine',
  access: 'reviewer_internal',
  records: [
    {
      statement_id: 'record-alpha',
      statement_text: 'The council approved the published minutes.',
      ui_status: 'source-backed',
      confidence_label: 'source_anchored_timed',
      speaker_label: 'Town Council Member',
      provenance_status: 'grounded',
      verification_status: 'human_verified',
      correction_status: 'none',
      produced_by: 'human',
      evidence: [
        {
          to_source_id: 'source-alpha',
          relation: 'supports',
          published_by: 'Town of Alpine',
          original_url: 'https://www.alpinewy.gov/source-alpha',
          verification_status: 'human_verified',
        },
      ],
    },
    {
      statement_id: 'record-beta',
      statement_text: 'A reviewed extraction remains pending.',
      ui_status: 'pending-review',
      confidence_label: 'auto_caption_untimed',
      speaker_label: 'Meeting Attendee',
      provenance_status: 'unverified',
      verification_status: 'machine_extracted_unreviewed',
      correction_status: 'none',
      produced_by: 'ai',
      evidence: [
        {
          to_source_id: 'source-beta-1',
          relation: 'supports',
          archive_url: 'https://archive.example/source-beta-1',
          verification_status: 'machine_extracted_unreviewed',
        },
        {
          to_source_id: 'source-beta-2',
          relation: 'supports',
          original_url: 'https://www.alpinewy.gov/source-beta-2',
          verification_status: 'source_recorded',
        },
      ],
    },
  ],
};

const GAP: ProjectionGapDefinition = {
  id: 'meeting-calendar',
  kicker: 'MEETINGS',
  title: 'Meeting calendar not available yet',
  whatItDoes: 'Shows reviewed public meeting dates and official notices.',
  requiredProjection: 'An authorized calendar response with stable meeting IDs and source receipts.',
  howItWorks: 'The server files reviewed notices and returns only the already-authorized scope.',
  expectedResult: 'A dated meeting list where every row opens its official notice.',
  filedUnder: 'Civic records · Meetings',
};

let root: HTMLElement;

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('main');
  document.body.append(root);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('shared reviewer-context state panels', () => {
  it.each([
    ['loading', 'Loading the authorized Alpine record set', 'status'],
    ['denied', 'Reviewer access is not available', 'alert'],
    ['unavailable', 'record service is not available', 'alert'],
    ['invalid', 'could not be displayed safely', 'alert'],
  ] as const)(
    'renders %s with safe copy and removes every stale civic row',
    (status, expectedCopy, role) => {
      root.innerHTML = `
        <article data-test="record-card">stale captured civic row</article>
        <div data-record-id="stale-record">stale record id</div>
      `;

      renderReviewerContextState(root, status satisfies ReviewerContextPanelStatus);

      const panel = root.querySelector(`[data-test="reviewer-context-${status}"]`);
      expect(panel?.getAttribute('role')).toBe(role);
      expect(panel?.getAttribute('data-reviewer-context-status')).toBe(status);
      expect(panel?.textContent).toContain(expectedCopy);
      expect(panel?.textContent).toContain('Safety boundary');
      expect(root.querySelector('[data-test="record-card"]')).toBeNull();
      expect(root.querySelector('[data-record-id]')).toBeNull();
      expect(root.querySelector('.gw-info-trigger')).toBeNull();
      expect(root.textContent).not.toContain('Filed under');
      expect(root.textContent).not.toContain('stale captured civic row');
      expect(root.textContent).not.toContain('stack');
      expect(root.textContent).not.toContain('response body');
    },
  );

  it('marks only loading as busy and explains that fixtures never fill a failed live read', () => {
    renderReviewerContextState(root, 'loading');
    expect(root.querySelector('[data-test="reviewer-context-loading"]')?.getAttribute('aria-busy')).toBe('true');
    expect(root.textContent).toContain('No captured, sample, or previously rendered civic records');

    renderReviewerContextState(root, 'unavailable');
    expect(root.querySelector('[data-test="reviewer-context-unavailable"]')?.getAttribute('aria-busy')).toBe('false');
    expect(root.textContent).toContain('does not substitute a design sample');
  });
});

describe('detailed projection gaps', () => {
  it('shows what, required projection, workflow, result, and an accessible filing note', () => {
    const gap = renderProjectionGap(GAP);
    root.append(gap);

    expect(gap.getAttribute('data-projection')).toBe('meeting-calendar');
    expect(gap.getAttribute('data-origin')).toBe('designed-gap');
    expect(gap.textContent).toContain('Not available yet');
    expect(gap.textContent).toContain('What this will do');
    expect(gap.textContent).toContain(GAP.whatItDoes);
    expect(gap.textContent).toContain('Required backend projection');
    expect(gap.textContent).toContain(GAP.requiredProjection);
    expect(gap.textContent).toContain('How it will work');
    expect(gap.textContent).toContain(GAP.howItWorks);
    expect(gap.textContent).toContain('Expected result');
    expect(gap.textContent).toContain(GAP.expectedResult);

    const note = gap.querySelector<HTMLButtonElement>('.gw-info-trigger');
    const panel = document.getElementById(note?.getAttribute('aria-controls') ?? '');
    expect(note?.textContent).toBe('?');
    expect(note?.tagName).toBe('BUTTON');
    expect(note?.type).toBe('button');
    expect(note?.getAttribute('aria-label')).toContain(GAP.title);
    expect(note?.getAttribute('aria-expanded')).toBe('false');
    expect(panel?.hidden).toBe(true);
    expect(panel?.textContent).toContain('Filed under');
    expect(panel?.textContent).toContain(GAP.filedUnder);
    expect(panel?.textContent).toContain('Current state');
    expect(gap.textContent).toContain('not a record, result, entitlement, coverage claim');
  });

  it('opens on hover/focus, uses native button keyboard semantics, and pins or closes accessibly', () => {
    vi.useFakeTimers();
    const gap = renderProjectionGap(GAP);
    root.append(gap);
    const wrapper = gap.querySelector<HTMLElement>('.gw-info-note')!;
    const trigger = gap.querySelector<HTMLButtonElement>('.gw-info-trigger')!;
    const panel = document.getElementById(trigger.getAttribute('aria-controls') ?? '')!;
    const close = panel.querySelector<HTMLButtonElement>('.gw-info-close')!;
    expect(panel.hidden).toBe(true);

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
    wrapper.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(119);
    expect(panel.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(panel.hidden).toBe(true);

    trigger.focus();
    expect(panel.hidden).toBe(false);
    expect(trigger.type).toBe('button');
    expect(trigger.getAttribute('role')).toBeNull();

    trigger.click();
    expect(wrapper.hasAttribute('data-pinned')).toBe(true);
    expect(panel.hidden).toBe(false);
    wrapper.dispatchEvent(new MouseEvent('mouseleave'));
    expect(panel.hidden).toBe(false);

    close.click();
    expect(wrapper.hasAttribute('data-pinned')).toBe(false);
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    expect(panel.hidden).toBe(false);
    wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });
});

interface HomeSnapshot {
  ids: string[];
  receipts: string[];
  uiStatuses: string[];
  provenanceStatuses: string[];
  trustLabels: string[];
  provenanceLabels: string[];
  projectionIds: string[];
  text: string;
}

function homeSnapshot(mode: 'simple' | 'advanced'): HomeSnapshot {
  localStorage.setItem('gw_home_mode', mode);
  renderHomeReadModel(root, RESPONSE);
  return {
    ids: [...root.querySelectorAll<HTMLElement>('[data-test="home-live-record"]')]
      .map((node) => node.dataset.recordId ?? ''),
    receipts: [...root.querySelectorAll<HTMLElement>('[data-test="home-live-record"]')]
      .map((node) => node.dataset.receiptCount ?? ''),
    uiStatuses: [...root.querySelectorAll<HTMLElement>('[data-test="home-live-record"]')]
      .map((node) => node.dataset.uiStatus ?? ''),
    provenanceStatuses: [...root.querySelectorAll<HTMLElement>('[data-test="home-live-record"]')]
      .map((node) => node.dataset.provenanceStatus ?? ''),
    trustLabels: [...root.querySelectorAll<HTMLElement>('[data-test="trust-badge"]')]
      .map((node) => node.textContent ?? ''),
    provenanceLabels: [...root.querySelectorAll<HTMLElement>('[data-test="provenance-badge"]')]
      .map((node) => `${node.dataset.provenance}:${node.textContent?.trim() ?? ''}`),
    projectionIds: [...root.querySelectorAll<HTMLElement>('[data-test="reviewer-projection-gap"]')]
      .map((node) => node.dataset.projection ?? ''),
    text: root.textContent ?? '',
  };
}

describe('live Home reviewer read model', () => {
  it('renders the exact same authorized IDs, receipts, trust, provenance, and gaps in both modes', () => {
    const before = JSON.stringify(RESPONSE);
    const simple = homeSnapshot('simple');
    expect(root.querySelector('[data-test="home-live-simple"]')).not.toBeNull();
    const advanced = homeSnapshot('advanced');
    expect(root.querySelector('[data-test="home-live-advanced"]')).not.toBeNull();

    expect(simple.ids).toEqual(['record-alpha', 'record-beta']);
    expect(advanced.ids).toEqual(simple.ids);
    expect(advanced.receipts).toEqual(simple.receipts);
    expect(advanced.receipts).toEqual(['1', '2']);
    expect(advanced.uiStatuses).toEqual(simple.uiStatuses);
    expect(advanced.uiStatuses).toEqual(['source-backed', 'pending-review']);
    expect(advanced.provenanceStatuses).toEqual(simple.provenanceStatuses);
    expect(advanced.provenanceStatuses).toEqual(['grounded', 'unverified']);
    expect(advanced.trustLabels).toEqual(simple.trustLabels);
    expect(advanced.provenanceLabels).toEqual(simple.provenanceLabels);
    expect(advanced.projectionIds).toEqual(simple.projectionIds);
    expect(JSON.stringify(RESPONSE)).toBe(before);
  });

  it.each(['simple', 'advanced'] as const)(
    'renders only direct response records and exact aggregate counts in %s',
    (mode) => {
      const snapshot = homeSnapshot(mode);
      expect(snapshot.text).toContain('The council approved the published minutes.');
      expect(snapshot.text).toContain('A reviewed extraction remains pending.');
      expect(
        root.querySelector<HTMLAnchorElement>(
          '[data-test="drawer-link-original_url"][href="https://www.alpinewy.gov/source-alpha"]',
        ),
      ).not.toBeNull();
      expect(root.querySelector('[data-metric="reviewed-records"] strong')?.textContent).toBe('2');
      expect(root.querySelector('[data-metric="source-receipts"] strong')?.textContent).toBe('3');
      expect(root.querySelector('[data-metric="response-scope"] strong')?.textContent).toBe('alpine');
      expect(root.querySelector('[data-metric="access-lane"] strong')?.textContent).toBe('reviewer internal');
      expect(root.querySelectorAll('[data-test="record-card"]')).toHaveLength(2);
      expect(root.querySelectorAll('[data-test="source-entry"]')).toHaveLength(3);
    },
  );

  it.each(['simple', 'advanced'] as const)(
    'preserves every unsupported module as a detailed non-record placeholder in %s',
    (mode) => {
      const snapshot = homeSnapshot(mode);
      expect(snapshot.projectionIds).toEqual([
        'agenda-board',
        'newsletter-digest',
        'plan-entitlements',
        'geography-coverage',
        'transparency-alerts',
        'source-vault-stats',
      ]);
      for (const id of snapshot.projectionIds) {
        const gap = root.querySelector(`[data-projection="${id}"]`);
        expect(gap?.textContent, id).toContain('Required backend projection');
        expect(gap?.textContent, id).toContain('Expected result');
      }
      expect(snapshot.text).toContain('Captured and sample records are never substituted or added');
      expect(snapshot.text).not.toContain('Packet changed after posting');
      expect(snapshot.text).not.toContain('Zoning Variance');
      expect(snapshot.text).not.toContain('FY27 Budget');
      expect(snapshot.text).not.toContain('Councilor R. Roe');
    },
  );

  it('fails closed for a non-reviewer lane and removes previously rendered records', () => {
    localStorage.setItem('gw_home_mode', 'advanced');
    renderHomeReadModel(root, RESPONSE);
    expect(root.querySelectorAll('[data-test="record-card"]')).toHaveLength(2);

    renderHomeReadModel(root, { ...RESPONSE, access: 'public' });
    expect(root.querySelector('[data-test="reviewer-context-denied"]')).not.toBeNull();
    expect(root.querySelector('[data-test="record-card"]')).toBeNull();
    expect(root.querySelector('[data-record-id]')).toBeNull();
    expect(root.textContent).not.toContain('The council approved the published minutes.');
  });

  it.each(['simple', 'advanced'] as const)(
    'keeps an authorized empty response honest and fixture-free in %s',
    (mode) => {
      localStorage.setItem('gw_home_mode', mode);
      renderHomeReadModel(root, { scope: 'alpine', access: 'reviewer_internal', records: [] });

      expect(root.querySelector('[data-projection="reviewed-record-feed"]')?.textContent).toContain(
        'No reviewed records are available in this response',
      );
      expect(root.querySelector('[data-test="record-card"]')).toBeNull();
      expect(root.querySelector('[data-origin="fixture"]')).toBeNull();
      expect(root.querySelector('[data-metric="reviewed-records"] strong')?.textContent).toBe('0');
      expect(root.querySelector('[data-metric="source-receipts"] strong')?.textContent).toBe('0');
    },
  );
});
