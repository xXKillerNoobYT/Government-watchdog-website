// @vitest-environment jsdom
//
// GOV-658 — persistent gated-app shell contract. These tests deliberately guard
// the approved high-fidelity IA and functional shared controls while preserving
// the original slot, mode, active-parent, and honest-timestamp invariants.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  renderShell,
  readMode,
  applyMode,
  NAV_TABS,
  type ShellMode,
} from '../src/ui/shell';

/** Hermetic storage because shell mode persistence is part of the contract. */
function installMemoryLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  });
}

let root: HTMLElement;
beforeEach(() => {
  installMemoryLocalStorage();
  window.history.replaceState({}, '', '/');
  document.head.replaceChildren();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
  root = document.createElement('div');
  document.body.append(root);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GOV-658 shell — content slot and persistent chrome', () => {
  it('returns an inner content slot and lets a surface render without replacing the shell', () => {
    const slot = renderShell(root, { active: '/agenda' });
    expect(slot.getAttribute('data-test')).toBe('shell-content');
    slot.className = 'gw-root';
    slot.replaceChildren(document.createElement('section'));
    expect(root.querySelector('.gw-shell-content')).not.toBeNull();
    expect(root.querySelector('[data-test="app-shell"]')).not.toBeNull();
  });

  it('re-rendering replaces prior chrome rather than duplicating it', () => {
    renderShell(root, { active: '/agenda' });
    renderShell(root, { active: '/timeline' });
    expect(root.querySelectorAll('[data-test="app-shell"]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-test="shell-tabs"]')).toHaveLength(1);
  });
});

describe('GOV-658 shell — approved primary navigation', () => {
  const approvedLabels = [
    'Home',
    'Fast Agenda',
    'Timeline',
    'Boards',
    'Power Tracker',
    'Source Vault',
    'Newsletter',
    'Watchlist',
  ];
  const approvedRoutes = [
    '/home',
    '/agenda',
    '/timeline',
    '/boards',
    '/power',
    '/vault',
    '/newsletter',
    '/watchlist',
  ];

  it('renders the eight approved tabs in exact design order', () => {
    renderShell(root, { active: '/agenda' });
    const labels = [...root.querySelectorAll('[data-test="shell-tabs"] .gw-shell-tab')].map(
      (anchor) => anchor.textContent,
    );
    expect(labels).toEqual(approvedLabels);
  });

  it('exports canonical routes and every rendered href matches them', () => {
    renderShell(root, { active: '/agenda' });
    expect(NAV_TABS.map((tab) => tab.route)).toEqual(approvedRoutes);
    expect([...root.querySelectorAll('.gw-shell-tab')].map((anchor) => anchor.getAttribute('href')))
      .toEqual(approvedRoutes.map((route) => `#${route}`));
  });
});

describe('GOV-658 shell — active tab highlights canonical and contextual routes', () => {
  const cases: { path: string; expected: string }[] = [
    { path: '/home', expected: 'Home' },
    { path: '/agenda', expected: 'Fast Agenda' },
    { path: '/app', expected: 'Fast Agenda' },
    { path: '/agenda-boards', expected: 'Fast Agenda' },
    { path: '/meeting', expected: 'Fast Agenda' },
    { path: '/timeline', expected: 'Timeline' },
    { path: '/timeline-legacy', expected: 'Timeline' },
    { path: '/cards', expected: 'Timeline' },
    { path: '/topics', expected: 'Timeline' },
    { path: '/issue', expected: 'Timeline' },
    { path: '/boards', expected: 'Boards' },
    { path: '/body', expected: 'Boards' },
    { path: '/power', expected: 'Power Tracker' },
    { path: '/vault', expected: 'Source Vault' },
    { path: '/sources', expected: 'Source Vault' },
    { path: '/newsletter', expected: 'Newsletter' },
    { path: '/watchlist', expected: 'Watchlist' },
  ];

  for (const { path, expected } of cases) {
    it(`highlights ${expected} for ${path}`, () => {
      renderShell(root, { active: path });
      const current = root.querySelector('.gw-shell-tab[aria-current="page"]');
      expect(current?.textContent).toBe(expected);
      expect(root.querySelectorAll('.gw-shell-tab[aria-current="page"]')).toHaveLength(1);
    });
  }

  it('marks no tab current for an unknown route', () => {
    renderShell(root, { active: '/unknown' });
    expect(root.querySelectorAll('.gw-shell-tab[aria-current="page"]')).toHaveLength(0);
  });
});

describe('GOV-658 shell — functional shared controls with honest preview labels', () => {
  it('links the current location to the location route', () => {
    renderShell(root, { active: '/home' });
    const location = root.querySelector('[data-test="shell-jurisdiction"]');
    expect(location?.tagName).toBe('A');
    expect(location?.getAttribute('href')).toBe('#/location');
    expect(location?.textContent).toContain('Alpine, WY');
    expect(location?.getAttribute('aria-label')).toMatch(/change location/i);
  });

  it('renders an accessible search input and submits an encoded timeline search', () => {
    renderShell(root, { active: '/home' });
    const input = root.querySelector('[data-test="shell-search"]') as HTMLInputElement;
    const form = root.querySelector('[data-test="shell-search-form"]') as HTMLFormElement;
    expect(input.tagName).toBe('INPUT');
    expect(input.type).toBe('search');
    expect(input.labels?.[0]?.textContent).toMatch(/search agendas/i);

    input.value = 'water rates & fees';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    expect(window.location.hash).toBe('#/timeline?search=water%20rates%20%26%20fees&reviewer=1');
  });

  it('focuses the current search input with Meta+K or Ctrl+K', () => {
    renderShell(root, { active: '/home' });
    const input = root.querySelector('[data-test="shell-search"]') as HTMLInputElement;

    const metaEvent = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(metaEvent);
    expect(metaEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);

    input.blur();
    const ctrlEvent = new KeyboardEvent('keydown', {
      key: 'K',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(ctrlEvent);
    expect(ctrlEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);
  });

  it('shows preview account and preview alerts without claiming verified identity or live data', () => {
    renderShell(root, { active: '/home' });
    const account = root.querySelector('[data-test="shell-account"]');
    const alerts = root.querySelector('[data-test="shell-alerts"]');
    expect(account?.textContent).toContain('PREVIEW ACCOUNT');
    expect(account?.textContent).not.toMatch(/✓\s*ID|ID-verified/i);
    expect(alerts?.getAttribute('href')).toBe('#/alerts');
    expect(root.querySelector('[data-test="shell-alert-count"]')?.textContent).toBe('3 preview');
    expect(alerts?.getAttribute('aria-label')).toMatch(/not a live count/i);
  });

  it('discloses the limitations of AI analysis', () => {
    renderShell(root, { active: '/home' });
    const chip = root.querySelector('[data-test="shell-ai-disclosure"]');
    expect(chip?.textContent).toBe('AI ANALYSIS');
    expect(chip?.getAttribute('title')).toMatch(/can be wrong/i);
    expect(chip?.getAttribute('title')).toMatch(/primary records/i);
  });
});

describe('GOV-658 shell — mode control and the single palette authority', () => {
  it('renders Simple and Advanced buttons with the active one pressed', () => {
    renderShell(root, { active: '/agenda', mode: 'advanced' });
    expect(root.querySelector('[data-test="mode-simple"]')?.getAttribute('aria-pressed')).toBe('false');
    expect(root.querySelector('[data-test="mode-advanced"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('applyMode persists gw_home_mode and maps Advanced to dark, Simple to light', () => {
    applyMode('advanced');
    expect(localStorage.getItem('gw_home_mode')).toBe('advanced');
    expect(readMode()).toBe('advanced');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    applyMode('simple');
    expect(localStorage.getItem('gw_home_mode')).toBe('simple');
    expect(readMode()).toBe('simple');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('clicking a mode applies and persists it', () => {
    renderShell(root, { active: '/agenda', mode: 'advanced' });
    (root.querySelector('[data-test="mode-simple"]') as HTMLButtonElement).click();
    expect(readMode()).toBe('simple');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('defaults to Advanced and syncs its dark palette when no theme is pinned', () => {
    expect(readMode()).toBe('advanced');
    expect(localStorage.getItem('gw-theme')).toBeNull();
    renderShell(root, { active: '/agenda' });
    expect(root.getAttribute('data-mode')).toBe('advanced');
    expect(root.querySelector('[data-test="mode-advanced"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('does not override an explicit standalone theme pin', () => {
    localStorage.setItem('gw-theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
    renderShell(root, { active: '/agenda', mode: 'advanced' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

describe('GOV-658 shell — footer honesty', () => {
  it('carries the brand tagline and source-verification reminder', () => {
    renderShell(root, { active: '/home' });
    expect(root.querySelector('[data-test="shell-tagline"]')?.textContent).toMatch(
      /Holding power accountable/i,
    );
    expect(root.querySelector('[data-test="shell-preview-note"]')?.textContent).toMatch(
      /verify AI analysis against primary records/i,
    );
  });

  it('omits a refreshed stamp when the caller has no real timestamp', () => {
    renderShell(root, { active: '/home' });
    expect(root.querySelector('[data-test="shell-refreshed"]')).toBeNull();
  });

  it('renders a supplied real timestamp verbatim', () => {
    renderShell(root, { active: '/home', refreshedAt: '2026-07-07T22:00:00Z' });
    expect(root.querySelector('[data-test="shell-refreshed"]')?.textContent)
      .toBe('data refreshed 2026-07-07T22:00:00Z');
  });
});

describe('GOV-658 shell — brand route', () => {
  it('targets the first approved primary tab', () => {
    renderShell(root, { active: '/timeline' });
    expect(root.querySelector('[data-test="shell-brand"]')?.getAttribute('href'))
      .toBe(`#${NAV_TABS[0].route}`);
  });
});

// Type-level guard: the palette mapping assumes exactly these two values.
const _modes: ShellMode[] = ['simple', 'advanced'];
void _modes;
