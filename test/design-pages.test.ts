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

const ALLOWED: DesignPageOptions = { access: 'reviewer_internal', fixture: true };
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
    expect(root.querySelector('[data-test="power-tracker-gated"]')?.getAttribute('data-mode')).toBe('simple');
    expect(root.querySelector('.gw-dp-title')?.textContent).toBe('Power Tracker');
    expect(root.textContent).toContain('reviewed backend projection');
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
