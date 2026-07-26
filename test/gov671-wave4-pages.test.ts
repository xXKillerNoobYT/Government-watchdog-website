// @vitest-environment jsdom
//
// GOV-671 — Wave 4 pages: Power Tracker, Watchlist, and Location coverage.
// Pins reviewer-internal gating, local-only watch storage, honest-empty roster,
// and the no unsupported ranking/map/notification path rules.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderLocation, renderPowerTracker, renderWatchlist } from '../src/ui/pages-program';
import type { ReadApiResponse } from '../src/types/read-api';
import graphRealData from '../src/fixtures/concept-graph-real.json';

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

describe('GOV-671 Power Tracker', () => {
  it('renders reviewed records with an honest-empty roster and no unsupported ranking copy', () => {
    renderPowerTracker(root, GRAPH_REAL, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="power-roster-empty"]')?.textContent).toContain('No reviewed person or role roster yet');
    expect(root.querySelectorAll('[data-test="power-record"]')).toHaveLength(GRAPH_REAL.records!.length);
    expect(root.querySelector('[data-test="power-record-link"]')?.getAttribute('href')).toContain('#/issue?id=');
    expect(root.textContent).not.toMatch(/score|verdict|influence|pledge/i);
  });

  it('uses gw_home_mode for an advanced source trail without inventing roster data', () => {
    localStorage.setItem('gw_home_mode', 'advanced');
    renderPowerTracker(root, GRAPH_REAL, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="power-advanced-list"]')).not.toBeNull();
    expect(root.querySelector('[data-test="issue-proof-rail"]')).not.toBeNull();
    expect(root.querySelector('[data-test="power-roster-empty"]')).not.toBeNull();
  });

  it('renders zero tracker records outside reviewer-internal access', () => {
    renderPowerTracker(root, { ...GRAPH_REAL, access: 'public' }, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="power-record"]')).toBeNull();
  });
});

describe('GOV-671 Watchlist', () => {
  it('starts honest-empty and stores watch toggles only in localStorage', () => {
    renderWatchlist(root, GRAPH_REAL, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="watchlist-empty"]')?.textContent).toContain('No local watch items yet');
    root.querySelector<HTMLButtonElement>('[data-test="watch-toggle"]')!.click();
    expect(JSON.parse(localStorage.getItem('gw-watchlist') ?? '[]')).toContain(GRAPH_REAL.records![0].statement_id);
    expect(root.querySelectorAll('[data-test="watchlist-item"]')).toHaveLength(1);
    expect(root.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(root.querySelector('input[type="email"]')).toBeNull();
  });

  it('renders zero local selections outside reviewer-internal access', () => {
    localStorage.setItem('gw-watchlist', JSON.stringify([GRAPH_REAL.records![0].statement_id]));
    renderWatchlist(root, { ...GRAPH_REAL, access: 'public' }, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="watchlist-item"]')).toBeNull();
  });
});

describe('GOV-671 Location coverage', () => {
  it('shows Alpine coverage and reviewed records for the static covered picker path', () => {
    renderLocation(root, GRAPH_REAL, new URLSearchParams('state=Wyoming&county=Lincoln%20County&town=Alpine'), 'real');
    expect(root.querySelector('[data-test="location-covered"]')?.textContent).toContain('Alpine is covered');
    expect(root.querySelectorAll('[data-test="location-record"]')).toHaveLength(GRAPH_REAL.records!.length);
    expect(root.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(root.querySelector('input[type="email"]')).toBeNull();
    expect(root.querySelector('[data-test="location-map"]')).toBeNull();
  });

  it('shows not covered yet without leaking Alpine records for other places', () => {
    renderLocation(root, GRAPH_REAL, new URLSearchParams('state=Wyoming&county=Teton%20County&town=Jackson'), 'real');
    expect(root.querySelector('[data-test="location-not-covered"]')?.textContent).toContain('Not covered yet');
    expect(root.querySelector('[data-test="location-record"]')).toBeNull();
  });

  it('renders zero coverage detail outside reviewer-internal access', () => {
    renderLocation(root, { ...GRAPH_REAL, access: 'public' }, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="location-covered"]')).toBeNull();
  });

  it('keeps all three routes reachable through the gated shell navigation', async () => {
    vi.resetModules();
    document.body.replaceChildren();
    const app = document.createElement('div');
    app.id = 'app';
    document.body.append(app);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({
        reviewer_internal_records: [{
          statement_id: 'wave4-live-sentinel',
          statement_text: 'Live Wave 4 route sentinel',
          ui_status: 'source-backed',
          verification_status: 'reviewed_source_linked',
          provenance_status: 'grounded',
          publication_state: 'publishable',
          produced_by: 'human',
          evidence: [{
            to_source_id: 'wave4-live-source',
            verification_status: 'human_verified',
            original_url: 'https://www.alpinewy.gov/wave4-live-source',
          }],
        }],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    window.location.hash = '#/power?reviewer=1';
    await import('../src/main');
    await vi.waitFor(() => {
      expect(
        app.querySelector('[data-test="power-real-record"][data-record-id="wave4-live-sentinel"]'),
      ).not.toBeNull();
    });
    expect(app.querySelector('[data-test="tab-power-tracker"]')?.getAttribute('aria-current')).toBe('page');
    expect(fetchMock.mock.calls.filter(
      (call) => (call as unknown[])[0] === '/api/reviewer-internal',
    ))
      .toHaveLength(1);

    window.location.hash = '#/watchlist?reviewer=1';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => {
      expect(
        app.querySelector('[data-test="watchlist-real-candidate"][data-record-id="wave4-live-sentinel"]'),
      ).not.toBeNull();
    });
    expect(app.querySelector('[data-test="tab-watchlist"]')?.getAttribute('aria-current')).toBe('page');
    expect(fetchMock.mock.calls.filter(
      (call) => (call as unknown[])[0] === '/api/reviewer-internal',
    ))
      .toHaveLength(1);

    window.location.hash = '#/location?reviewer=1';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => {
      expect(
        app.querySelector('[data-test="location-real-record"][data-record-id="wave4-live-sentinel"]'),
      ).not.toBeNull();
    });
    expect(app.querySelector('[data-test="shell-jurisdiction"]')?.getAttribute('href')).toBe('#/location');
    expect(app.querySelector('.gw-shell-tab[aria-current="page"]')).toBeNull();
    expect(fetchMock.mock.calls.filter(
      (call) => (call as unknown[])[0] === '/api/reviewer-internal',
    ))
      .toHaveLength(1);
  });
});
