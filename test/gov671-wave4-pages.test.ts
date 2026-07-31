// @vitest-environment jsdom
//
// GOV-671 — Wave 4 pages: Power Tracker, Watchlist, and Location coverage.
// Pins reviewer-internal gating, local-only watch storage, honest-empty roster,
// and the no unsupported ranking/map/notification path rules.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPowerTracker, renderWatchlist, type DesignPageOptions } from '../src/ui/design-pages';


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
describe('GOV-671 Wave-4 honesty guards (routed renderers)', () => {
  // Folded here when #85 deleted the orphan pages-program renderers these tests
  // used to target. Their DOM hooks no longer exist, but three assertions were
  // NOT covered anywhere else and are kept, retargeted at the routed
  // design-pages implementations.
  const REVIEWED: DesignPageOptions = { access: 'reviewer_internal', fixture: false };

  it('Power Tracker renders no numeric score, rank, or percentage', () => {
    renderPowerTracker(root, REVIEWED);
    const text = root.textContent ?? '';
    // NOTE: the original assertion banned the WORDS score/verdict/influence/pledge.
    // That was correct for the orphan renderer, which avoided the subject entirely.
    // The routed renderer legitimately uses those words to explain that no such
    // value exists — banning the vocabulary would forbid honest gap copy. What must
    // never appear is a numeric CLAIM, so that is what is asserted.
    expect(text).not.toMatch(/\d+\s?%/);
    expect(text).not.toMatch(/\brank(ed)?\s*#?\d/i);
    expect(text).not.toMatch(/\bscore\s*[:=]?\s*\d/i);
  });

  it('Watchlist exposes no delivery affordance — it is device-local only', () => {
    renderWatchlist(root, REVIEWED);
    expect(root.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(root.querySelector('input[type="email"]')).toBeNull();
  });

  it('Watchlist writes no second watch store', () => {
    renderWatchlist(root, REVIEWED);
    // #85: the orphan renderer persisted a sorted array under `gw-watchlist`,
    // a second device-local contract competing with `gw_tracked`. The routed
    // renderer must never resurrect it.
    expect(localStorage.getItem('gw-watchlist')).toBeNull();
  });
});

describe('GOV-671 route reachability', () => {
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
