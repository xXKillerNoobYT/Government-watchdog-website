// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALERTS_READ_STORAGE_KEY,
  DELIVERY_PREVIEW_STORAGE_KEY,
  DESIGN_FIXTURE_LABEL,
  DESIGN_PAGES_STYLE,
  LOCATION_STORAGE_KEY,
  TRACKED_STORAGE_KEY,
  renderAlerts,
  renderLocation,
  renderPowerTracker,
  renderWatchlist,
  type DesignPageOptions,
} from '../src/ui/design-pages';
import type { ReadApiResponse } from '../src/types/read-api';

const ALLOWED: DesignPageOptions = { access: 'reviewer_internal', fixture: true };
const REVIEWED_OPTIONS: DesignPageOptions = { access: 'reviewer_internal', fixture: false };
const REVIEWED_NOTICE = 'Captured reviewed Alpine projection — not a live read.';
const REVIEWED_DATA: ReadApiResponse = {
  scope: 'alpine',
  access: 'reviewer_internal',
  records: [
    {
      statement_id: 'reviewed-record-17',
      statement_text: 'Reviewed statement supplied by the backend projection.',
      ui_status: 'source-backed',
      verification_status: 'reviewed_source_linked',
      produced_by: 'human',
      evidence: [
        {
          to_source_id: 'reviewed-source-9',
          published_by: 'Reviewed publisher',
          source_date: '2026-07-20',
          page: 7,
          original_url: 'https://example.gov/reviewed-source-9',
        },
      ],
    },
  ],
};
const MATERIAL_STATUS_DATA: ReadApiResponse = {
  ...REVIEWED_DATA,
  records: [
    {
      statement_id: 'reviewed-material-status',
      statement_text: 'Material trust labels supplied by the reviewed projection.',
      ui_status: 'source-changed',
      verification_status: 'do_not_publish',
      publication_state: 'not_publishable',
      correction_status: 'corrected',
      source_changed: 1,
      confidence: 'low',
      confidence_label: 'derived_summary',
      provenance_status: 'unverified',
      produced_by: 'ai',
      evidence: [
        {
          to_source_id: 'material-source',
          relation: 'supports',
          source_type: 'minutes',
          verification_status: 'source_recorded',
          correction_status: 'corrected',
          confidence: 'low',
          original_url: 'https://example.gov/material-source',
          archive_url: 'https://archive.example.gov/material-source',
          final_url: 'https://example.gov/material-source-final',
          url: 'https://cdn.example.gov/material-source',
        },
      ],
    },
  ],
};
const renderers = [renderPowerTracker, renderWatchlist, renderLocation, renderAlerts] as const;

let root: HTMLElement;
let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  });
  document.documentElement.removeAttribute('data-theme');
  document.head.replaceChildren();
  document.body.replaceChildren();
  document.body.style.removeProperty('overflow');
  root = document.createElement('div');
  document.body.append(root);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('synthetic design pages — hard fixture gate', () => {
  for (const renderer of renderers) {
    it(`${renderer.name} requires both reviewer access and explicit fixture mode`, () => {
      renderer(root, { access: 'public', fixture: true });
      expect(root.querySelector('[data-fixture]')).toBeNull();
      expect(root.querySelector('[data-test="design-fixture-banner"]')).toBeNull();

      renderer(root, { access: 'reviewer_internal', fixture: false });
      expect(root.querySelector('[data-fixture]')).toBeNull();
      expect(root.querySelector('[data-test="design-fixture-banner"]')).toBeNull();

      renderer(root, ALLOWED);
      expect(root.querySelector('[data-fixture]')).not.toBeNull();
      expect(root.querySelector('[data-test="design-fixture-banner"]')?.textContent).toBe(DESIGN_FIXTURE_LABEL);
    });
  }

  it('reads the shell-owned gw_home_mode without rendering a duplicate page toggle', () => {
    localStorage.setItem('gw_home_mode', 'simple');
    renderWatchlist(root, ALLOWED);
    expect(root.querySelector('[data-test="watchlist-page"]')?.getAttribute('data-mode')).toBe('simple');
    expect(root.querySelector('[data-test="design-mode-toggle"]')).toBeNull();
    expect(localStorage.getItem('gw_home_mode')).toBe('simple');
  });

  it('keeps the complete baseline page frame when reviewed backend data is unavailable', () => {
    localStorage.setItem('gw_home_mode', 'simple');
    renderPowerTracker(root, { access: 'reviewer_internal', fixture: false });
    expect(root.querySelector('[data-test="power-tracker-page"]')?.getAttribute('data-mode')).toBe('simple');
    expect(root.querySelector('[data-test="power-real-simple-edition"]')).not.toBeNull();
    expect(root.querySelector('.gw-dp-title')?.textContent).toBe('Power Tracker');
    expect(root.querySelector('[data-test="power-records-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-fixture]')).toBeNull();
  });

  it('keeps Simple editorial and Advanced workbench surfaces meaningfully distinct', () => {
    const cases = [
      [renderPowerTracker, 'power-simple-edition', 'power-level-tools'],
      [renderWatchlist, 'watchlist-simple-edition', 'watchlist-advanced-workbench'],
      [renderLocation, 'location-simple-edition', 'location-coverage-disclaimer'],
      [renderAlerts, 'alerts-simple-edition', 'alerts-advanced-workbench'],
    ] as const;

    for (const [renderer, simpleTestId, advancedTestId] of cases) {
      localStorage.setItem('gw_home_mode', 'simple');
      renderer(root, ALLOWED);
      expect(root.querySelector(`[data-test="${simpleTestId}"]`)).not.toBeNull();
      expect(root.querySelector(`[data-test="${advancedTestId}"]`)).toBeNull();

      localStorage.setItem('gw_home_mode', 'advanced');
      renderer(root, ALLOWED);
      expect(root.querySelector(`[data-test="${simpleTestId}"]`)).toBeNull();
      expect(root.querySelector(`[data-test="${advancedTestId}"]`)).not.toBeNull();
    }

    renderWatchlist(root, ALLOWED);
    const unavailableTools = root.querySelectorAll('[data-test="watchlist-advanced-workbench"] button:disabled');
    expect(unavailableTools).toHaveLength(3);
    expect(root.textContent).toContain('unsupported record types stay disabled');
  });
});

describe('reviewed baseline pages — real path', () => {
  it('keeps public access gated and renders zero reviewed or fixture rows', () => {
    const cases = [
      [renderPowerTracker, 'power-tracker-gated'],
      [renderWatchlist, 'watchlist-gated'],
      [renderLocation, 'location-gated'],
      [renderAlerts, 'alerts-gated'],
    ] as const;

    for (const [renderer, gateId] of cases) {
      renderer(root, { access: 'public', fixture: false }, REVIEWED_DATA, REVIEWED_NOTICE);
      expect(root.querySelector(`[data-test="${gateId}"]`)).not.toBeNull();
      expect(root.querySelector('[data-origin="reviewed-projection"]')).toBeNull();
      expect(root.textContent).not.toContain('Reviewed statement supplied by the backend projection.');
      expect(root.querySelector('[data-fixture]')).toBeNull();
    }
  });

  it('fails closed when the supplied response is not reviewer-internal', () => {
    renderPowerTracker(root, REVIEWED_OPTIONS, { ...REVIEWED_DATA, access: 'public' }, REVIEWED_NOTICE);
    expect(root.querySelector('[data-test="power-real-record"]')).toBeNull();
    expect(root.querySelector('[data-test="power-tracker-gated"]')).not.toBeNull();
    expect(root.textContent).not.toContain('Reviewed statement supplied by the backend projection.');
  });

  it('derives admission from each response when caller options omit access', () => {
    const cases = [
      [renderPowerTracker, 'power-tracker-page', 'power-tracker-gated'],
      [renderWatchlist, 'watchlist-page', 'watchlist-gated'],
      [renderLocation, 'location-page', 'location-gated'],
      [renderAlerts, 'alerts-page', 'alerts-gated'],
    ] as const;

    for (const [renderer, pageId, gateId] of cases) {
      renderer(root, {}, REVIEWED_DATA, REVIEWED_NOTICE);
      expect(root.querySelector(`[data-test="${pageId}"]`), renderer.name).not.toBeNull();
      expect(root.querySelector(`[data-test="${gateId}"]`), renderer.name).toBeNull();

      renderer(root, {}, { ...REVIEWED_DATA, access: 'public' }, REVIEWED_NOTICE);
      expect(root.querySelector(`[data-test="${gateId}"]`), renderer.name).not.toBeNull();
      expect(root.querySelector('[data-test="design-reviewed-banner"]'), renderer.name).toBeNull();
      expect(root.textContent, renderer.name).not.toContain('Reviewed statement supplied by the backend projection.');
    }
  });

  it('never renders synthetic fixture rows on any reviewed path', () => {
    for (const renderer of renderers) {
      renderer(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
      expect(root.querySelector('[data-fixture]')).toBeNull();
      expect(root.querySelector('[data-test="design-fixture-banner"]')).toBeNull();
      expect(root.querySelector('[data-test="power-official"]')).toBeNull();
      expect(root.querySelector('[data-test="location-coverage-figure"]')).toBeNull();
      expect(root.querySelector('[data-test="alerts-unread-item"]')).toBeNull();
      expect(root.textContent).not.toMatch(/Placeholder Official|Fixture estimate|Fixture packet attachment replaced/);
    }
  });

  it('renders Power Tracker in both baseline modes with reviewed IDs and receipts but no people, scores, or verdicts', () => {
    localStorage.setItem('gw_home_mode', 'simple');
    renderPowerTracker(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
    expect(root.querySelector('[data-test="design-reviewed-banner"]')?.textContent).toBe(REVIEWED_NOTICE);
    expect(root.querySelector('[data-test="power-real-simple-edition"]')).not.toBeNull();
    expect(root.querySelector('[data-test="power-real-record"][data-record-id="reviewed-record-17"]')).not.toBeNull();
    expect(root.querySelector('[data-test="power-receipt"][data-source-id="reviewed-source-9"]')).not.toBeNull();
    expect(root.querySelector('[data-test="power-score-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="power-verdict-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="power-quote-ledger-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="power-vote-action-unavailable"]')).not.toBeNull();
    expect(root.textContent).not.toContain('Placeholder Official');
    expect(root.textContent).not.toMatch(/\b\d+%/);

    localStorage.setItem('gw_home_mode', 'advanced');
    renderPowerTracker(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
    expect(root.querySelector('[data-test="power-real-advanced-workbench"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="power-real-advanced-workbench"] button:disabled')).toHaveLength(3);
    expect(root.querySelector('[data-test="power-quote-ledger-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="power-vote-action-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="power-open-detail"]')).toBeNull();
    expect(root.querySelector('[data-fixture]')).toBeNull();
  });

  it('surfaces every supplied material trust label and receipt metadata without treating a link as verification', () => {
    renderPowerTracker(root, REVIEWED_OPTIONS, MATERIAL_STATUS_DATA, REVIEWED_NOTICE);

    expect(root.querySelector('[data-test="reviewed-ui-status"]')?.textContent).toBe('Status: Source changed');
    expect(root.querySelector('[data-test="reviewed-verification-status"]')?.textContent).toBe('Verification: Do not publish');
    expect(root.querySelector('[data-test="reviewed-publication-state"]')?.textContent).toBe('Publication: not publishable');
    expect(root.querySelector('[data-test="reviewed-correction-status"]')?.textContent).toBe('Correction: Corrected');
    expect(root.querySelector('[data-test="reviewed-source-changed"]')?.textContent).toBe('Source changed: yes');
    expect(root.querySelector('[data-test="reviewed-confidence"]')?.textContent).toBe('Confidence: low');
    expect(root.querySelector('[data-test="reviewed-confidence-label"]')?.textContent).toBe('Confidence class: Derived summary');
    expect(root.querySelector('[data-test="reviewed-provenance-status"]')?.textContent).toContain('Unverified provenance');
    expect(root.querySelector('[data-test="reviewed-provenance-status"]')?.getAttribute('data-provenance')).toBe('unverified');
    expect(root.querySelector('[data-test="reviewed-produced-by"]')?.textContent).toBe('Produced by: ai');
    expect(root.querySelector('[data-test="power-receipt-labels"]')?.textContent).toContain('Verification: Source recorded');
    expect(root.querySelector('[data-test="power-receipt-labels"]')?.textContent).toContain('Correction: Corrected');
    const receiptLinks = [...root.querySelectorAll<HTMLAnchorElement>('[data-test="power-receipt-link"]')];
    expect(receiptLinks.map((link) => link.textContent)).toEqual([
      'Open original source',
      'Open archived source',
      'Open final source',
      'Open supplied source',
    ]);
    expect(receiptLinks.map((link) => link.getAttribute('data-link-kind'))).toEqual([
      'original',
      'archive',
      'final',
      'source',
    ]);
    expect(root.querySelector('[data-test="power-real-record"]')?.textContent).not.toMatch(/link (?:is )?verified|verified link/i);
  });

  it('resolves Watchlist rows only from reviewed records and preserves unmatched local keys as a gap', () => {
    localStorage.setItem('gw_home_mode', 'simple');
    localStorage.setItem(TRACKED_STORAGE_KEY, JSON.stringify({ 'reviewed-record-17': true, moratorium: true }));
    renderWatchlist(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
    expect(root.querySelector('[data-test="watchlist-real-simple-edition"]')).not.toBeNull();
    expect(root.querySelector('[data-test="watchlist-real-item"][data-record-id="reviewed-record-17"]')).not.toBeNull();
    expect(root.querySelector('[data-test="watchlist-receipt"][data-source-id="reviewed-source-9"]')).not.toBeNull();
    expect(root.querySelector('[data-test="watchlist-unresolved-local"]')?.textContent).toContain('1 device-local key');
    expect(root.querySelector('[data-test="watchlist-history-unavailable"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="watchlist-real-simple-edition"] button:disabled')).toHaveLength(3);
    expect(root.textContent).not.toContain('Building and annexation moratorium');

    localStorage.setItem('gw_home_mode', 'advanced');
    renderWatchlist(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
    expect(root.querySelector('[data-test="watchlist-real-advanced-workbench"]')).not.toBeNull();
    expect(root.querySelector('[data-test="watchlist-history-unavailable"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="watchlist-advanced-workbench"]')).toHaveLength(0);
  });

  it('keeps Location slots and reviewed receipts without fixture coverage percentages', () => {
    localStorage.setItem('gw_home_mode', 'simple');
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({ state: 'WY', county: 'Lincoln', region: 'Star Valley', town: 'Alpine' }));
    renderLocation(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
    expect(root.querySelector('[data-test="location-real-simple-edition"]')).not.toBeNull();
    expect(root.querySelector('[data-test="location-real-record"][data-record-id="reviewed-record-17"]')).not.toBeNull();
    expect(root.querySelector('[data-test="location-receipt"][data-source-id="reviewed-source-9"]')).not.toBeNull();
    expect(root.querySelector('[data-test="location-coverage-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="location-identity-policy-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="location-history-unavailable"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="location-real-simple-edition"] select:disabled')).toHaveLength(3);
    expect(root.querySelector('[data-test="location-coverage-figure"]')).toBeNull();
    expect(root.textContent).not.toMatch(/\b\d+%/);

    localStorage.setItem('gw_home_mode', 'advanced');
    renderLocation(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
    expect(root.querySelector('[data-test="location-real-advanced-workbench"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="location-real-advanced-workbench"] select:disabled')).toHaveLength(3);
    expect(root.querySelector('[data-test="location-history-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="location-identity-policy-unavailable"]')).not.toBeNull();

    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({ state: 'WY', county: 'Teton', region: '', town: 'Jackson' }));
    renderLocation(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
    expect(root.querySelector('[data-test="location-real-record"]')).toBeNull();
    expect(root.querySelector('[data-test="location-records-unavailable"]')?.textContent).toContain('does not match');
  });

  it('keeps Alerts feed, history, trigger, and delivery slots unavailable instead of converting statements into alerts', () => {
    localStorage.setItem(TRACKED_STORAGE_KEY, JSON.stringify({ 'reviewed-record-17': true }));
    localStorage.setItem('gw_home_mode', 'simple');
    renderAlerts(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
    expect(root.querySelector('[data-test="alerts-real-simple-edition"]')).not.toBeNull();
    expect(root.querySelector('[data-test="alerts-feed-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="alerts-delivery-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="alerts-triggers-unavailable"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="alerts-real-simple-edition"] [data-test="alerts-real-delivery-controls"] button:disabled')).toHaveLength(4);
    expect(root.querySelector('[data-test="alerts-real-tracked-count"]')?.textContent).toContain('1 locally stored key');
    expect(root.querySelector('[data-test="alerts-unread-item"]')).toBeNull();
    expect(root.textContent).not.toContain('Fixture packet attachment replaced');

    localStorage.setItem('gw_home_mode', 'advanced');
    renderAlerts(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
    expect(root.querySelector('[data-test="alerts-real-advanced-workbench"]')).not.toBeNull();
    expect(root.querySelector('[data-test="alerts-history-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="alerts-delivery-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="alerts-triggers-unavailable"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="alerts-real-delivery-controls"] button:disabled')).toHaveLength(4);
    expect(root.querySelector('[data-fixture]')).toBeNull();
  });
});

describe('Power Tracker synthetic consent flow', () => {
  it('uses placeholder people, claims no score, and withholds detail before consent', () => {
    renderPowerTracker(root, ALLOWED);
    expect(root.textContent).toContain('Placeholder Official A');
    expect(root.textContent).toContain('No real people, scores, or verdicts');
    expect(root.textContent).not.toMatch(/\b\d+%/);
    expect(root.querySelector('[data-test="power-verdict-detail"]')).toBeNull();

    root.querySelector<HTMLButtonElement>('[data-test="power-open-detail"]')!.click();
    expect(root.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    expect(root.querySelector('[data-test="power-ai-gate"]')?.textContent).toContain('AI-GENERATED ANALYSIS — READ FIRST');
    expect(root.querySelector('[data-test="power-verdict-detail"]')).toBeNull();

    root.querySelector<HTMLButtonElement>('[data-test="power-ai-consent"]')!.click();
    expect(root.querySelector('[data-test="power-verdict-detail"]')).not.toBeNull();
    expect(root.querySelector('[data-test="power-receipt-disclaimer"]')?.textContent).toMatch(/receipt.*not.*verified/i);
    expect(root.querySelector('[data-test="power-receipt-disclaimer"]')?.textContent).toMatch(/challenge/i);
  });

  it('closes the modal with Escape and a backdrop click', () => {
    renderPowerTracker(root, ALLOWED);
    const open = root.querySelector<HTMLButtonElement>('[data-test="power-open-detail"]')!;
    open.click();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(root.querySelector('[data-test="power-modal"]')).toBeNull();

    open.click();
    root.querySelector<HTMLElement>('[data-test="power-modal"]')!.click();
    expect(root.querySelector('[data-test="power-modal"]')).toBeNull();
  });

  it('locks background interaction and restores focus and scrolling when the modal closes', () => {
    renderPowerTracker(root, ALLOWED);
    const open = root.querySelector<HTMLButtonElement>('[data-test="power-open-detail"]')!;
    open.focus();
    open.click();
    expect(document.body.style.overflow).toBe('hidden');
    expect(root.querySelector('.gw-dp-inner')?.getAttribute('aria-hidden')).toBe('true');

    root.querySelector<HTMLButtonElement>('[data-test="power-modal-close"]')!.click();
    expect(document.body.style.overflow).toBe('');
    expect(root.querySelector('.gw-dp-inner')?.hasAttribute('aria-hidden')).toBe(false);
    expect(document.activeElement).toBe(open);
  });
});

describe('Watchlist shared device-local state', () => {
  it('reads gw_tracked and removes an issue persistently', () => {
    localStorage.setItem(TRACKED_STORAGE_KEY, JSON.stringify({ moratorium: true, str: true, ignored: false }));
    renderWatchlist(root, ALLOWED);
    expect(root.querySelectorAll('[data-test="watchlist-item"]')).toHaveLength(2);
    expect(root.querySelector('[data-test="watchlist-count"]')?.textContent).toBe('2 issues');

    root.querySelector<HTMLButtonElement>('[data-test="watchlist-remove"][data-tracked-key="moratorium"]')!.click();
    expect(JSON.parse(localStorage.getItem(TRACKED_STORAGE_KEY)!)).toEqual({ str: true });
    expect(root.querySelectorAll('[data-test="watchlist-item"]')).toHaveLength(1);
  });

  it('renders an honest empty state and makes no real-alert promise', () => {
    renderWatchlist(root, ALLOWED);
    expect(root.querySelector('[data-test="watchlist-empty"]')?.textContent).toContain('Nothing is tracked');
    expect(root.querySelector('[data-test="watchlist-local-notice"]')?.textContent).toContain('does not subscribe');
    expect(root.textContent).not.toMatch(/within (one|1) day|we(?:'|’)ll (?:alert|tell)|alerts? (?:will|land)/i);
  });
});

describe('Location hierarchy and persistence', () => {
  it('normalizes an invalid non-Wyoming combination and clears WY descendants on state change', () => {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({
      state: 'CO', county: 'Lincoln', region: 'Star Valley', town: 'Alpine',
    }));
    renderLocation(root, ALLOWED);
    expect(root.querySelector<HTMLSelectElement>('[data-test="location-state"]')!.value).toBe('CO');
    expect(root.querySelector<HTMLSelectElement>('[data-test="location-county"]')!.value).toBe('');
    expect(root.querySelector<HTMLSelectElement>('[data-test="location-town"]')!.value).toBe('');
    expect(root.querySelector('[data-test="location-breadcrumbs"]')?.textContent).toBe('Colorado');

    root.querySelector<HTMLButtonElement>('[data-state="WY"]')!.click();
    const state = root.querySelector<HTMLSelectElement>('[data-test="location-state"]')!;
    state.value = 'UT';
    state.dispatchEvent(new Event('change'));
    expect(JSON.parse(localStorage.getItem(LOCATION_STORAGE_KEY)!)).toEqual({
      state: 'UT', county: '', region: '', town: '',
    });
  });

  it('labels every coverage percentage as a fixture estimate', () => {
    renderLocation(root, ALLOWED);
    const figures = [...root.querySelectorAll('[data-test="location-coverage-figure"]')];
    expect(figures).toHaveLength(3);
    for (const figure of figures) expect(figure.textContent).toContain('Fixture estimate');
    expect(root.querySelector('[data-test="location-coverage-disclaimer"]')?.textContent).toContain('synthetic design fixture');
  });
});

describe('Alerts read-state, tracked count, and device-only delivery preview', () => {
  it('marks one/all fixture alerts read in gw_alerts_read', () => {
    renderAlerts(root, ALLOWED);
    expect(root.querySelectorAll('[data-test="alerts-unread-item"]')).toHaveLength(3);

    root.querySelector<HTMLButtonElement>('[data-test="alerts-mark-read"]')!.click();
    expect(JSON.parse(localStorage.getItem(ALERTS_READ_STORAGE_KEY)!)).toHaveLength(1);
    expect(root.querySelectorAll('[data-test="alerts-unread-item"]')).toHaveLength(2);

    root.querySelector<HTMLButtonElement>('[data-test="alerts-mark-all"]')!.click();
    expect(JSON.parse(localStorage.getItem(ALERTS_READ_STORAGE_KEY)!)).toHaveLength(3);
    expect(root.querySelector('[data-test="alerts-empty"]')).not.toBeNull();
  });

  it('shows gw_tracked count and persists delivery toggles without claiming a subscription', () => {
    localStorage.setItem(TRACKED_STORAGE_KEY, JSON.stringify({ water: true, str: true }));
    renderAlerts(root, ALLOWED);
    expect(root.querySelector('[data-test="alerts-tracked-count"]')?.textContent).toBe('2');
    expect(root.querySelector('[data-test="alerts-device-only-notice"]')?.textContent).toContain('not subscribed');

    const email = root.querySelector<HTMLButtonElement>('[data-delivery-key="email"]')!;
    expect(email.getAttribute('role')).toBe('switch');
    expect(email.getAttribute('aria-checked')).toBe('true');
    email.click();
    expect(JSON.parse(localStorage.getItem(DELIVERY_PREVIEW_STORAGE_KEY)!).email).toBe(false);
    expect(root.querySelector('[data-test="alerts-delivery-status"]')?.textContent).toContain('No subscription was created');
  });
});

describe('accessibility and claim-safety invariants', () => {
  it('pins keyboard focus styling and the shared 44px target floor', () => {
    expect(DESIGN_PAGES_STYLE).toContain('min-height:var(--gw-tap-min)');
    expect(DESIGN_PAGES_STYLE).toContain(':focus-visible');
    renderAlerts(root, ALLOWED);
    for (const button of root.querySelectorAll('button')) {
      expect(button.getAttribute('type')).toBe('button');
    }
  });

  it('does not assert live monitoring, security, identity, or delivery guarantees', () => {
    for (const renderer of renderers) {
      renderer(root, ALLOWED);
      const text = root.textContent ?? '';
      expect(text).not.toMatch(/encrypted|secure account|verified identity|real-time monitoring|guaranteed delivery/i);
    }
  });
});
