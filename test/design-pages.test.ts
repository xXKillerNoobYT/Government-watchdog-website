// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALERTS_READ_STORAGE_KEY,
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
import { TRACKED_KEY, readTracked, writeTracked } from '../src/state/local-store';
import designPagesSource from '../src/ui/design-pages.ts?raw';
import {
  PRIVATE_INFO_NOTES,
  type PrivateInfoNoteId,
} from '../src/ui/private-info-note';
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
const NOTE_CASES = [
  {
    name: 'Power Tracker',
    renderer: renderPowerTracker,
    overview: 'power-overview',
    live: [
      'power-jurisdiction',
      'power-roster',
      'power-score',
      'power-match',
      'power-ledgers',
      'reviewed-record-trust',
      'reviewed-source-receipts',
    ],
    fixture: [
      'power-jurisdiction',
      'power-roster',
      'power-score',
      'power-match',
      'power-ledgers',
    ],
  },
  {
    name: 'Watchlist',
    renderer: renderWatchlist,
    overview: 'watchlist-overview',
    live: [
      'watchlist-local-state',
      'watchlist-add',
      'watchlist-timing',
      'watchlist-record-types',
      'watchlist-delivery',
      'reviewed-record-trust',
      'reviewed-source-receipts',
    ],
    fixture: [
      'watchlist-local-state',
      'watchlist-add',
      'watchlist-record-types',
      'watchlist-delivery',
    ],
  },
  {
    name: 'Location',
    renderer: renderLocation,
    overview: 'location-overview',
    live: [
      'location-saved-scope',
      'location-directory',
      'location-coverage',
      'location-change-policy',
      'location-history',
      'reviewed-record-trust',
      'reviewed-source-receipts',
    ],
    fixture: [
      'location-saved-scope',
      'location-directory',
      'location-coverage',
      'location-change-policy',
    ],
  },
  {
    name: 'Alerts',
    renderer: renderAlerts,
    overview: 'alerts-overview',
    live: [
      'alerts-feed',
      'alerts-read-state',
      'alerts-triggers',
      'alerts-delivery',
      'alerts-tracking',
      'alerts-freshness',
    ],
    fixture: [
      'alerts-feed',
      'alerts-read-state',
      'alerts-triggers',
      'alerts-delivery',
      'alerts-tracking',
    ],
  },
] as const satisfies readonly {
  name: string;
  renderer: typeof renderPowerTracker;
  overview: PrivateInfoNoteId;
  live: readonly PrivateInfoNoteId[];
  fixture: readonly PrivateInfoNoteId[];
}[];

let root: HTMLElement;
let store: Map<string, string>;

function infoNoteIds(): Set<string> {
  return new Set(
    [...root.querySelectorAll<HTMLElement>('[data-info-note]')]
      .map((node) => node.dataset.infoNote ?? ''),
  );
}

function infoNoteText(id: PrivateInfoNoteId): string {
  const trigger = root.querySelector<HTMLButtonElement>(`[data-info-note="${id}"]`);
  expect(trigger, id).not.toBeNull();
  const panelId = trigger!.getAttribute('aria-controls');
  expect(panelId, id).toBeTruthy();
  return root.querySelector(`#${panelId}`)?.textContent ?? '';
}

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
  localStorage.setItem('gw_home_mode', 'advanced');
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
      [renderLocation, 'location-simple-edition', 'location-advanced-workbench'],
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

describe('design page contextual information notes', () => {
  it('covers every major live and fixture group in both reading modes', () => {
    for (const mode of ['simple', 'advanced'] as const) {
      localStorage.setItem('gw_home_mode', mode);
      for (const definition of NOTE_CASES) {
        definition.renderer(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
        const liveIds = infoNoteIds();
        for (const id of [definition.overview, ...definition.live]) {
          expect(liveIds.has(id), `${definition.name} live ${mode}: ${id}`).toBe(true);
        }
        expect(
          root.querySelector(`.gw-dp-page-head [data-info-note="${definition.overview}"]`),
          `${definition.name} live ${mode} route header`,
        ).not.toBeNull();

        const liveTriggers = [...root.querySelectorAll<HTMLButtonElement>('[data-info-note]')];
        const livePanelIds = liveTriggers.map((trigger) => trigger.getAttribute('aria-controls'));
        const liveLabels = liveTriggers.map((trigger) => trigger.getAttribute('aria-label'));
        expect(new Set(livePanelIds).size, `${definition.name} live ${mode} panel ids`)
          .toBe(livePanelIds.length);
        expect(new Set(liveLabels).size, `${definition.name} live ${mode} accessible labels`)
          .toBe(liveLabels.length);
        for (const trigger of liveTriggers) {
          const panelId = trigger.getAttribute('aria-controls');
          const text = panelId ? root.querySelector(`#${panelId}`)?.textContent ?? '' : '';
          expect(text, `${definition.name} live ${mode}: ${trigger.dataset.infoNote}`)
            .toMatch(/What this is.*Filled from.*Filed under.*Review and updates.*Current state.*Limits.*Expected result/s);
        }

        definition.renderer(root, ALLOWED);
        const fixtureIds = infoNoteIds();
        for (const id of [definition.overview, ...definition.fixture]) {
          expect(fixtureIds.has(id), `${definition.name} fixture ${mode}: ${id}`).toBe(true);
        }
        expect(
          root.querySelector(`.gw-dp-page-head [data-info-note="${definition.overview}"]`),
          `${definition.name} fixture ${mode} route header`,
        ).not.toBeNull();
        const fixtureTriggers = [
          ...root.querySelectorAll<HTMLButtonElement>('[data-info-note]'),
        ];
        const fixtureLabels = fixtureTriggers.map((trigger) => trigger.getAttribute('aria-label'));
        expect(new Set(fixtureLabels).size, `${definition.name} fixture ${mode} accessible labels`)
          .toBe(fixtureLabels.length);
      }
    }
  });

  it('puts a structured registered explanation inside every unavailable slot', () => {
    for (const mode of ['simple', 'advanced'] as const) {
      localStorage.setItem('gw_home_mode', mode);
      for (const definition of NOTE_CASES) {
        definition.renderer(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
        const slots = [...root.querySelectorAll<HTMLElement>('.gw-dp-unavailable-slot')];
        expect(slots.length, `${definition.name} ${mode} unavailable slot count`).toBeGreaterThan(0);
        for (const slot of slots) {
          const trigger = slot.querySelector<HTMLButtonElement>('[data-info-note]');
          expect(trigger, `${definition.name} ${mode}: ${slot.dataset.test}`).not.toBeNull();
          const id = trigger?.dataset.infoNote as PrivateInfoNoteId | undefined;
          expect(id && PRIVATE_INFO_NOTES[id], `${definition.name} ${mode}: registered note`).toBeTruthy();
          const panelId = trigger?.getAttribute('aria-controls');
          const text = panelId ? slot.querySelector(`#${panelId}`)?.textContent ?? '' : '';
          expect(text, `${definition.name} ${mode}: ${slot.dataset.test}`)
            .toMatch(/Current state.*Expected result/s);
        }
      }
    }
  });

  it('visibly identifies every grouped fixture explanation beside its control', () => {
    for (const definition of NOTE_CASES) {
      definition.renderer(root, ALLOWED);
      for (const item of root.querySelectorAll<HTMLElement>('[data-info-note-item]')) {
        const id = item.dataset.infoNoteItem as PrivateInfoNoteId;
        expect(item.querySelector('.gw-dp-info-note-label')?.textContent, id)
          .toBe(PRIVATE_INFO_NOTES[id].label);
        expect(item.querySelector(`[data-info-note="${id}"]`), id).not.toBeNull();
      }
    }
  });

  it('explains score and coverage methods plus local monitoring and notification boundaries', () => {
    renderPowerTracker(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
    expect(infoNoteText('power-score')).toMatch(/Method version.*Inputs.*Exclusions.*Denominator.*Update cadence.*Missing data/s);
    expect(infoNoteText('power-score')).toMatch(/no live score or denominator/i);

    renderLocation(root, ALLOWED);
    expect(infoNoteText('location-coverage')).toMatch(/design-preview percentages are synthetic geometry only/i);
    expect(infoNoteText('location-coverage')).toMatch(/eligible source\/record population has not been supplied/i);

    renderWatchlist(root, ALLOWED);
    expect(infoNoteText('watchlist-overview')).toMatch(/does not create a subscription, alert, reminder, background monitor/i);
    expect(infoNoteText('watchlist-delivery')).toMatch(/Device-local keys are not monitored/i);

    renderAlerts(root, ALLOWED);
    expect(infoNoteText('alerts-overview')).toMatch(/separate from account-workflow notifications/i);
    expect(infoNoteText('alerts-feed')).toMatch(/no statement\/account notification becomes a civic alert/i);
  });

  it('renders no private trigger or registry copy for direct non-reviewer calls', () => {
    for (const definition of NOTE_CASES) {
      definition.renderer(
        root,
        { access: 'public', fixture: true },
        { ...REVIEWED_DATA, access: 'public' },
        REVIEWED_NOTICE,
      );
      expect(root.querySelector('[data-info-note]'), definition.name).toBeNull();
      expect(root.textContent, definition.name).not.toContain(
        PRIVATE_INFO_NOTES[definition.overview].what,
      );
      for (const id of [...definition.live, ...definition.fixture]) {
        expect(root.textContent, `${definition.name}: ${id}`).not.toContain(PRIVATE_INFO_NOTES[id].what);
      }
    }
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
    const gapIds = [
      'power-level-filter-unavailable',
      'power-roster-unavailable',
      'power-profile-unavailable',
      'power-score-unavailable',
      'power-promise-action-consent-unavailable',
      'power-verdict-unavailable',
      'power-quote-ledger-unavailable',
      'power-promise-ledger-unavailable',
      'power-vote-action-unavailable',
    ];

    for (const mode of ['simple', 'advanced'] as const) {
      localStorage.setItem('gw_home_mode', mode);
      renderPowerTracker(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
      expect(root.querySelector('[data-test="design-reviewed-banner"]')?.textContent, mode).toBe(REVIEWED_NOTICE);
      expect(root.querySelector(`[data-test="power-real-${mode === 'simple' ? 'simple-edition' : 'advanced-workbench'}"]`), mode).not.toBeNull();
      const realRecord = root.querySelector('[data-test="power-real-record"][data-record-id="reviewed-record-17"]');
      expect(realRecord, mode).not.toBeNull();
      expect(realRecord?.closest('[data-test="power-profile-unavailable"]'), mode).toBeNull();
      expect(root.querySelector('[data-test="power-receipt"][data-source-id="reviewed-source-9"]'), mode).not.toBeNull();
      for (const testId of gapIds) expect(root.querySelector(`[data-test="${testId}"]`), `${mode}: ${testId}`).not.toBeNull();
      const levelFilters = [...root.querySelectorAll<HTMLButtonElement>('[data-test="power-level-filter-option"]')];
      expect(levelFilters, mode).toHaveLength(4);
      expect(levelFilters.every((button) => button.disabled), mode).toBe(true);
      expect(root.querySelectorAll('[data-test="power-scorecard-stat"]'), mode).toHaveLength(4);
      expect(root.querySelector('[data-test="power-consent-control-unavailable"]:disabled'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="power-challenge-control-unavailable"]:disabled'), mode).not.toBeNull();
      expect(root.querySelectorAll('[data-test="power-quote-ledger-unavailable-columns"] th[scope="col"]'), mode).toHaveLength(4);
      expect(root.querySelectorAll('[data-test="power-promise-ledger-unavailable-columns"] th[scope="col"]'), mode).toHaveLength(4);
      expect(root.querySelectorAll('[data-test="power-vote-action-unavailable-columns"] th[scope="col"]'), mode).toHaveLength(5);
      expect(root.querySelector('[data-test="power-open-detail"]'), mode).toBeNull();
      expect(root.querySelector('[data-fixture]'), mode).toBeNull();
      expect(root.textContent, mode).not.toContain('Placeholder Official');
      expect(root.textContent, mode).not.toMatch(/\b\d+%/);
    }
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
    localStorage.setItem(TRACKED_STORAGE_KEY, JSON.stringify({ 'reviewed-record-17': true, moratorium: true }));
    for (const mode of ['simple', 'advanced'] as const) {
      localStorage.setItem('gw_home_mode', mode);
      renderWatchlist(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
      const editionId = mode === 'simple' ? 'watchlist-real-simple-edition' : 'watchlist-real-advanced-workbench';
      expect(root.querySelector(`[data-test="${editionId}"]`), mode).not.toBeNull();
      expect(root.querySelector('[data-test="watchlist-real-item"][data-record-id="reviewed-record-17"]'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="watchlist-receipt"][data-source-id="reviewed-source-9"]'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="watchlist-unresolved-local"]')?.textContent, mode).toContain('1 device-local key');
      expect(root.querySelector('[data-test="watchlist-item-status-geometry"]'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="watchlist-item-next-unavailable"]')?.textContent, mode).toContain('Unavailable');
      expect(root.querySelector('[data-test="watchlist-item-deadline-unavailable"]')?.textContent, mode).toContain('Unavailable');
      expect(root.querySelector('[data-test="watchlist-item-alert-control-unavailable"]:disabled'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="watchlist-history-unavailable"]'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="watchlist-recent-history-unavailable"]'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="watchlist-delivery-settings-unavailable"]'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="watchlist-deadlines-unavailable"]'), mode).not.toBeNull();
      const settingControls = [...root.querySelectorAll<HTMLButtonElement>('[data-test="watchlist-setting-control-unavailable"]')];
      expect(settingControls, mode).toHaveLength(4);
      expect(settingControls.every((button) => button.disabled), mode).toBe(true);
      expect(root.querySelector('[data-test="watchlist-deadlines-control-unavailable"]:disabled'), mode).not.toBeNull();
      expect(root.querySelectorAll(`[data-test="${editionId}"] .gw-dp-tool-pill:disabled`), mode).toHaveLength(3);
      expect(root.querySelectorAll('[data-test="watchlist-advanced-workbench"]'), mode).toHaveLength(0);
      expect(root.textContent, mode).not.toContain('Building and annexation moratorium');
      expect(root.textContent, mode).not.toMatch(/within one day|within 15 minutes|Monday 7 AM/i);
    }
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
    expect(root.querySelector('[data-test="location-real-directory-workbench"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="location-real-coverage-stat"]')).toHaveLength(3);
    expect(root.querySelectorAll('[data-test="location-real-directory-workbench"] button:disabled')).toHaveLength(25);
    expect(root.querySelector('[data-test="location-coverage-figure"]')).toBeNull();
    expect(root.textContent).not.toMatch(/\b\d+%/);
    for (const tile of root.querySelectorAll<HTMLButtonElement>('[data-test="location-real-directory-workbench"] button:disabled')) {
      expect(tile.getAttribute('aria-label')).toMatch(/unavailable/i);
    }

    localStorage.setItem('gw_home_mode', 'advanced');
    renderLocation(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
    expect(root.querySelector('[data-test="location-real-advanced-workbench"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="location-real-advanced-workbench"] select:disabled')).toHaveLength(3);
    expect(root.querySelector('[data-test="location-real-directory-workbench"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="location-real-coverage-stat"]')).toHaveLength(3);
    expect(root.querySelectorAll('[data-test="location-real-directory-workbench"] button:disabled')).toHaveLength(25);
    expect(root.querySelector('[data-test="location-history-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="location-identity-policy-unavailable"]')).not.toBeNull();
    expect(root.textContent).not.toMatch(/\b\d+%/);

    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({ state: 'WY', county: 'Teton', region: '', town: 'Jackson' }));
    renderLocation(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
    expect(root.querySelector('[data-test="location-real-record"]')).toBeNull();
    expect(root.querySelector('[data-test="location-records-unavailable"]')?.textContent).toContain('does not match');
  });

  it('keeps Alerts feed, history, trigger, and delivery slots unavailable instead of converting statements into alerts', () => {
    localStorage.setItem(TRACKED_STORAGE_KEY, JSON.stringify({ 'reviewed-record-17': true }));
    for (const mode of ['simple', 'advanced'] as const) {
      localStorage.setItem('gw_home_mode', mode);
      renderAlerts(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
      expect(root.querySelector(`[data-test="alerts-real-${mode === 'simple' ? 'simple-edition' : 'advanced-workbench'}"]`), mode).not.toBeNull();
      expect(root.querySelector('[data-test="alerts-delivery-unavailable"]'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="alerts-triggers-unavailable"]'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="alerts-freshness-unavailable"]'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="alerts-feed-unavailable"]'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="alerts-unread-unavailable"]'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="alerts-real-row-schema"]'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="alerts-real-receipt-policy"]'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="alerts-real-delivery-policy"]'), mode).not.toBeNull();
      expect(root.querySelectorAll('[data-test="alerts-real-trigger-checklist"] input:disabled'), mode).toHaveLength(8);
      expect(root.querySelectorAll('[data-test="alerts-real-delivery-controls"] button:disabled'), mode).toHaveLength(5);
      expect(root.querySelector('[data-test="alerts-real-tracked-count"]')?.textContent, mode).toContain('1 locally stored key');
      expect(root.querySelector('[data-test="alerts-unread-item"]'), mode).toBeNull();
      expect(root.textContent, mode).not.toMatch(/\bOFF\b|0 reviewed unread/i);
      expect(root.textContent, mode).not.toContain('Fixture packet attachment replaced');
      expect(root.querySelector('[data-fixture]'), mode).toBeNull();
    }
    localStorage.setItem('gw_home_mode', 'simple');
    renderAlerts(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
    expect(root.querySelector('[data-test="alerts-feed-unavailable"]')).not.toBeNull();

    localStorage.setItem('gw_home_mode', 'advanced');
    renderAlerts(root, REVIEWED_OPTIONS, REVIEWED_DATA, REVIEWED_NOTICE);
    expect(root.querySelector('[data-test="alerts-history-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="alerts-real-mark-all"]:disabled')).not.toBeNull();
    expect(root.querySelector('[data-test="alerts-real-unread-count"]')?.textContent).toContain('Unread count unavailable');
  });
});

describe('Power Tracker synthetic consent flow', () => {
  it('uses placeholder people, claims no score, and withholds detail before consent', () => {
    renderPowerTracker(root, ALLOWED);
    expect(root.textContent).toContain('Placeholder Official A');
    expect(root.textContent).toContain('No real people, scores, or verdicts');
    // GOV-83: this used to sweep the whole fixture page for /\b\d+%/ as a proxy for
    // "claims no score". The matrix §5 GS row explicitly authorises synthetic scores,
    // verdicts and votes in THIS mode, so the blanket sweep now tests the absence of an
    // authorised feature rather than an invariant. The invariant is narrower and is
    // asserted directly instead: no PRODUCTION score is claimed, and every synthetic
    // figure is declared fixture-origin and labelled synthetic where it is shown.
    expect(root.textContent).toContain('does not calculate or claim a production score');
    for (const id of ['power-score-donut', 'power-kept-broken-bars', 'power-vote-record']) {
      expect(root.querySelector(`[data-test="${id}"]`)?.getAttribute('data-origin'), id).toBe('fixture');
    }
    expect(root.querySelector('[data-test="power-score-donut"]')?.textContent)
      .toContain('SYNTHETIC SCORE — fixture value, not computed here');
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
    for (const mode of ['simple', 'advanced'] as const) {
      localStorage.setItem('gw_home_mode', mode);
      renderLocation(root, ALLOWED);
      const figures = [...root.querySelectorAll('[data-test="location-coverage-figure"]')];
      expect(figures, mode).toHaveLength(3);
      for (const figure of figures) expect(figure.textContent, mode).toContain('Fixture estimate');
      expect(root.querySelector('[data-test="location-coverage-disclaimer"]')?.textContent, mode).toContain('synthetic design fixture');
      expect(root.querySelector('[data-test="location-state-grid"]'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="location-county-grid"]'), mode).not.toBeNull();
      expect(root.querySelector('[data-test="location-town-grid"]'), mode).not.toBeNull();
    }
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

  // GOV-86: this test previously asserted the OPPOSITE — that clicking a delivery
  // switch persisted to localStorage. That behaviour was the defect: a switch reading
  // ON and surviving a reload is a configured setting to the person looking at it,
  // and no delivery channel exists in any lane. Delivery is now CS, not DL.
  it('shows gw_tracked count and offers no operable delivery control in the fixture lane', () => {
    localStorage.setItem(TRACKED_STORAGE_KEY, JSON.stringify({ water: true, str: true }));
    renderAlerts(root, ALLOWED);
    expect(root.querySelector('[data-test="alerts-tracked-count"]')?.textContent).toBe('2');
    expect(root.querySelector('[data-test="alerts-device-only-notice"]')?.textContent).toContain('not subscribed');

    // No switch, no persistence, no status line implying a change was recorded.
    expect(root.querySelector('[data-delivery-key]')).toBeNull();
    expect(root.querySelector('[data-test="alerts-delivery-toggle"]')).toBeNull();
    expect(root.querySelector('[data-test="alerts-delivery-status"]')).toBeNull();
    expect(localStorage.getItem('gw_alert_delivery_preview')).toBeNull();

    // The slot stays visible and says the feature is unbuilt — not that data is missing.
    const preview = root.querySelector('[data-test="alerts-delivery-preview"]');
    expect(preview?.textContent).toContain('COMING SOON');
    for (const channel of ['Email', 'text', 'push', 'meeting-eve', 'daily digest']) {
      expect(preview?.textContent?.toLowerCase(), channel).toContain(channel.toLowerCase());
    }
    // CS forbids naming a backend contract — that is DG's job, and this slot is not DG.
    expect(preview?.textContent).not.toContain('/v1/me/alert-preferences');
  });

  it('restores the Location funding slot as a Coming Soon marker with no funding claim', () => {
    // GOV-87: the baseline's fourth coverage-board tile vanished from both lanes.
    renderLocation(root, REVIEWED_OPTIONS, REVIEWED_DATA);
    const slot = root.querySelector('[data-test="location-funding-slot"]');
    expect(slot).not.toBeNull();
    expect(slot?.textContent).toContain('COMING SOON');
    expect(slot?.textContent).toContain('No payment, pledge, or funding capability exists');
    // No numeric coverage or funding value, and no causal speed claim from the baseline.
    expect(slot?.textContent).not.toMatch(/\d+\s?%/);
    expect(slot?.textContent).not.toContain('backlog moves fastest');
    // Inert: the baseline's "fund your area >" CTA must not become a payment path.
    expect(slot?.querySelectorAll('a, button, input, form, [href]')).toHaveLength(0);
  });

  it('leaves the reviewed lane unchanged: five disabled channels naming the awaited contract', () => {
    renderAlerts(root, REVIEWED_OPTIONS, REVIEWED_DATA);
    const controls = root.querySelector('[data-test="alerts-real-delivery-controls"]')!;
    const buttons = controls.querySelectorAll('button');
    expect(buttons).toHaveLength(5);
    for (const button of buttons) expect(button.hasAttribute('disabled')).toBe(true);
    for (const label of ['Email', 'Text', 'Push', 'Meeting-eve reminder', 'Daily digest']) {
      expect(controls.textContent, label).toContain(label);
    }
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
      const visibleCopy = root.cloneNode(true) as HTMLElement;
      for (const explanatoryPanel of visibleCopy.querySelectorAll('.gw-info-panel')) {
        explanatoryPanel.remove();
      }
      const text = visibleCopy.textContent ?? '';
      expect(text).not.toMatch(/encrypted|secure account|verified identity|real-time monitoring|guaranteed delivery/i);
    }
  });
});

// GOV-83 — the gated Power Tracker fixture: score donut, kept/broken/partial bars,
// promise ledger and vote/action record.
//
// Matrix §5 keeps every score, verdict, quote and vote DG on the reviewed lane and classes
// "placeholder officials, scores, verdicts, quotes, votes" GS — populated ONLY in explicit
// reviewer design-fixture mode behind the AI/disclaimer interstitial. These tests pin both
// halves: the figures exist in fixture mode, and nowhere else.
describe('GOV-83 Power Tracker fixture scorecard', () => {
  const FIGURES = [
    'power-score-donut',
    'power-kept-broken-bars',
    'power-promise-ledger',
    'power-vote-record',
  ] as const;

  it('renders every baseline figure in fixture mode', () => {
    renderPowerTracker(root, ALLOWED);
    for (const id of FIGURES) {
      expect(root.querySelectorAll(`[data-test="${id}"]`), id).toHaveLength(1);
    }
    // Three kept/broken/partial bars, each carrying its own supplied percentage.
    const bars = root.querySelectorAll('[data-test="power-kept-broken-bars"] .gw-dp-bar-row');
    expect(bars).toHaveLength(3);
    expect([...bars].map((b) => b.querySelector('.gw-dp-bar-label')?.textContent))
      .toEqual(['Kept · 5', 'Broken · 3', 'Partial · 2']);
    expect(root.querySelectorAll('[data-test="power-vote-row"]')).toHaveLength(3);
  });

  it('derives no figure in the browser — every number is supplied', () => {
    renderPowerTracker(root, ALLOWED);
    // The bar percentages are literals from the fixture, NOT count/total. 5/(5+3+2) would
    // also be 50%, so a sum check would pass on derived data; assert against the source
    // table instead, which is what "no score is computed in the browser" actually means.
    const pcts = [...root.querySelectorAll('[data-test="power-kept-broken-bars"] .gw-dp-bar-pct')]
      .map((n) => n.textContent);
    expect(pcts).toEqual(['50%', '30%', '20%']);
    const widths = [...root.querySelectorAll<HTMLElement>('[data-test="power-kept-broken-bars"] .gw-dp-bar-fill')]
      .map((n) => n.style.width);
    expect(widths).toEqual(['50%', '30%', '20%']);
    // The donut arc is drawn from the supplied score, not from the bars.
    expect(root.querySelector('[data-test="power-score-donut"] .gw-dp-donut-arc')?.getAttribute('stroke-dasharray'))
      .toBe('62 38');
  });

  it('routes every vote row through the AI-disclaimer interstitial before any conclusion', () => {
    renderPowerTracker(root, ALLOWED);
    const row = root.querySelector<HTMLButtonElement>('[data-test="power-vote-row"]')!;
    row.click();

    expect(root.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    // The disclaimer precedes the conclusion: the gate is up and the verdict is withheld.
    expect(root.querySelector('[data-test="power-ai-gate"]')?.textContent)
      .toContain('AI-GENERATED ANALYSIS — READ FIRST');
    expect(root.querySelector('[data-test="power-verdict-detail"]')).toBeNull();

    root.querySelector<HTMLButtonElement>('[data-test="power-ai-consent"]')!.click();
    expect(root.querySelector('[data-test="power-verdict-detail"]')).not.toBeNull();
  });

  it('names no real official and every vote row is synthetic', () => {
    renderPowerTracker(root, ALLOWED);
    for (const row of root.querySelectorAll('[data-test="power-vote-row"]')) {
      expect(row.textContent).toContain('SYNTHETIC AGENDA ITEM');
    }
    expect(root.textContent).toContain('Placeholder Official A');
    expect(root.textContent).not.toMatch(/Mayor|Councilmember|Trustee|Commissioner/);
  });

  it('reviewed lane carries no figure and keeps its designed gaps', () => {
    renderPowerTracker(root, { access: 'reviewer_internal', fixture: false });
    for (const id of FIGURES) {
      expect(root.querySelectorAll(`[data-test="${id}"]`), id).toHaveLength(0);
    }
    expect(root.textContent).not.toContain('SYNTHETIC SCORE');
    expect(root.textContent).not.toContain('SYNTHETIC AGENDA ITEM');
    // The DG states GOV-83 must not disturb.
    expect(root.querySelector('[data-test="power-score-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="power-roster-unavailable"]')).not.toBeNull();
  });

  it('public lane carries no figure and no fixture string', () => {
    renderPowerTracker(root, REVIEWED_OPTIONS, { ...REVIEWED_DATA, access: 'public' }, REVIEWED_NOTICE);
    for (const id of FIGURES) {
      expect(root.querySelectorAll(`[data-test="${id}"]`), id).toHaveLength(0);
    }
    expect(root.textContent).not.toContain('SYNTHETIC SCORE');
    expect(root.textContent).not.toContain('SYNTHETIC PROMISE');
    expect(root.textContent).not.toContain('SYNTHETIC AGENDA ITEM');
  });
});

// GOV-170 (iteration 48) — design-pages uses the shared localStorage contract.
//
// It carried a private readStoredJson/writeStoredJson pair and its OWN readTracked() on
// the same key as local-store's, so a future hardening of the storage contract would land
// in one copy and not the other. Deleted; these tests pin the behaviour that must survive.
describe('GOV-170 shared storage contract', () => {
  it('still round-trips a tracked record through the shared helpers', () => {
    localStorage.clear();
    writeTracked({ 'record-1': true });
    expect(readTracked()).toEqual({ 'record-1': true });
    // The key is the shared one, not a private duplicate.
    expect(localStorage.getItem(TRACKED_KEY)).toContain('record-1');
  });

  it('survives malformed stored JSON without throwing — the defensive behaviour kept', () => {
    localStorage.setItem(TRACKED_KEY, '{not json');
    expect(() => readTracked()).not.toThrow();
    expect(readTracked()).toEqual({});
  });

  it('drops non-true values, so a tampered store cannot mark records tracked', () => {
    localStorage.setItem(TRACKED_KEY, JSON.stringify({ a: true, b: 'yes', c: 1, d: false }));
    expect(readTracked()).toEqual({ a: true });
  });

  it('defines no private storage implementation — the whole point of GOV-170', () => {
    // Behaviour tests alone do NOT cover this: they exercise local-store's helpers, which
    // were always correct. Bypassing the shared writer with a direct localStorage call in
    // design-pages left all behaviour tests green (verified by red proof). The guarantee
    // is a SOURCE property — one implementation of the storage contract, not two — so it
    // is asserted as one.
    expect(designPagesSource).not.toMatch(/function\s+(read|write)StoredJson/);
    expect(designPagesSource, 'raw JSON.parse of a stored value').not.toMatch(/JSON\.parse\(\s*value\s*\)/);
    // No direct localStorage access at all: every read/write goes through local-store.
    expect(designPagesSource, 'direct localStorage use').not.toMatch(/localStorage\.(getItem|setItem|removeItem)/);
  });

  it('watchlist still renders tracked records after the consolidation', () => {
    localStorage.clear();
    // clear() also resets the mode, and the workbench is the ADVANCED surface.
    localStorage.setItem('gw_home_mode', 'advanced');
    renderWatchlist(root, ALLOWED);
    expect(root.querySelector('[data-test="watchlist-advanced-workbench"]')).not.toBeNull();
  });
});
