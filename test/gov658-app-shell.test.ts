// @vitest-environment jsdom
//
// GOV-658 (GOV-654 leg 2/5) — persistent app shell + navigation (spec §5).
// Proves the §5/§11 acceptance for the shell sub-leg:
//
//   - the shell wraps a surface and returns an inner content slot the surface
//     renders into (§5 — "everything inherits"; surfaces stay untouched, §7),
//   - the tab row lists ONLY shipped routes — no dead nav (§5.1 / §10 failure
//     list): Home is present with the shipped dashboard; Fast Agenda / Power
//     Power Tracker / Watchlist are NOT rendered as tabs,
//   - the active tab (incl. `/boards` alias + `/body`,`/meeting` context pages)
//     highlights via aria-current (§5.1),
//   - NO fake controls: no Search, no Alerts, and the jurisdiction pill is a
//     STATIC `Alpine, WY` label with no dropdown affordance (§5.1),
//   - the Simple|Advanced mode control drives the ONE palette authority
//     (advanced→dark / simple→light via `data-theme`) and persists `gw_home_mode`
//     (§1 / §1.4),
//   - the footer carries the tagline and OMITS the `data refreshed` stamp unless
//     a real timestamp is supplied — never a fake clock (§5.2).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  renderShell,
  readMode,
  applyMode,
  NAV_TABS,
  type ShellMode,
} from '../src/ui/shell';

// Hermetic in-memory localStorage. The CI runner launches vitest with a broken
// `--localstorage-file` stub where `localStorage.getItem` is not a function;
// these tests assert persistence, so they must own their storage rather than
// borrow the ambient (environment-flaky) one. Production code wraps every
// localStorage access in try/catch, so this only affects the tests.
function installMemoryLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  });
}

let root: HTMLElement;
beforeEach(() => {
  installMemoryLocalStorage();
  document.head.replaceChildren();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
  root = document.createElement('div');
  document.body.append(root);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GOV-658 shell — content slot (surfaces inherit, stay untouched)', () => {
  it('returns an inner content slot and lets the surface render into it', () => {
    const slot = renderShell(root, { active: '/app' });
    expect(slot.getAttribute('data-test')).toBe('shell-content');
    // A surface renderer may freely reset the slot — the shell layout survives.
    slot.className = 'gw-root';
    slot.replaceChildren(document.createElement('section'));
    expect(root.querySelector('.gw-shell-content')).not.toBeNull();
    expect(root.querySelector('[data-test="app-shell"]')).not.toBeNull();
  });

  it('re-rendering the shell replaces prior chrome (no duplicate headers)', () => {
    renderShell(root, { active: '/app' });
    renderShell(root, { active: '/timeline' });
    expect(root.querySelectorAll('[data-test="app-shell"]').length).toBe(1);
    expect(root.querySelectorAll('[data-test="shell-tabs"]').length).toBe(1);
  });
});

describe('GOV-658 shell — tab row lists ONLY shipped routes (no dead nav §5.1/§10)', () => {
  it('renders exactly the shipped tabs, in order', () => {
    renderShell(root, { active: '/app' });
    const labels = [...root.querySelectorAll('[data-test="shell-tabs"] .gw-shell-tab')].map(
      (a) => a.textContent,
    );
    expect(labels).toEqual(['Home', 'Boards', 'Timeline', 'Cards', 'Power', 'Watchlist', 'Location', 'Topics', 'Source Vault', 'Newsletter']);
  });

  it('does NOT render tabs for unshipped surfaces', () => {
    renderShell(root, { active: '/app' });
    const labels = [...root.querySelectorAll('.gw-shell-tab')].map((a) => a.textContent);
    for (const dead of ['Fast Agenda', 'Search', 'Alerts']) {
      expect(labels, `${dead} must not be a dead nav tab this sub-leg`).not.toContain(dead);
    }
  });

  it('every tab points at a real hash route', () => {
    renderShell(root, { active: '/app' });
    for (const a of root.querySelectorAll('.gw-shell-tab')) {
      expect(a.getAttribute('href')).toMatch(/^#\/[a-z]+$/);
    }
    // The NAV_TABS contract routes are the shipped, registered ones.
    expect(NAV_TABS.map((t) => t.route)).toEqual(['/home', '/app', '/timeline', '/cards', '/power', '/watchlist', '/location', '/topics', '/vault', '/newsletter']);
  });
});

describe('GOV-658 shell — active tab highlighting (§5.1)', () => {
  const cases: { path: string; expected: string }[] = [
    { path: '/app', expected: 'Boards' },
    { path: '/home', expected: 'Home' },
    { path: '/boards', expected: 'Boards' }, // alias
    { path: '/timeline', expected: 'Timeline' },
    { path: '/cards', expected: 'Cards' },
    { path: '/power', expected: 'Power' },
    { path: '/watchlist', expected: 'Watchlist' },
    { path: '/location', expected: 'Location' },
    { path: '/topics', expected: 'Topics' },
    { path: '/vault', expected: 'Source Vault' },
    { path: '/sources', expected: 'Source Vault' }, // legacy alias
    { path: '/newsletter', expected: 'Newsletter' },
    { path: '/body', expected: 'Boards' }, // context page → parent tab
    { path: '/meeting', expected: 'Boards' }, // context page → parent tab
  ];
  for (const { path, expected } of cases) {
    it(`highlights ${expected} for ${path}`, () => {
      renderShell(root, { active: path });
      const current = root.querySelector('.gw-shell-tab[aria-current="page"]');
      expect(current?.textContent).toBe(expected);
      // Exactly one tab is current.
      expect(root.querySelectorAll('.gw-shell-tab[aria-current="page"]').length).toBe(1);
    });
  }

  it('marks no tab current for an unknown route (no false highlight)', () => {
    renderShell(root, { active: '/unknown' });
    expect(root.querySelectorAll('.gw-shell-tab[aria-current="page"]').length).toBe(0);
  });
});

describe('GOV-658 shell — no fake controls, static jurisdiction (§5.1)', () => {
  it('renders a static Alpine, WY pill with no dropdown affordance', () => {
    renderShell(root, { active: '/app' });
    const pill = root.querySelector('[data-test="shell-jurisdiction"]');
    expect(pill?.textContent).toContain('Alpine, WY');
    // No dropdown chevron / no interactive control inside the pill (Alpine-only stage).
    expect(pill?.textContent).not.toContain('▾');
    expect(pill?.tagName).toBe('SPAN');
    expect(pill?.querySelector('button, select, [role="button"]')).toBeNull();
  });

  it('renders NO search and NO alerts controls (no honest surface exists yet)', () => {
    renderShell(root, { active: '/app' });
    expect(root.querySelector('[data-test="shell-search"]')).toBeNull();
    expect(root.querySelector('[data-test="shell-alerts"]')).toBeNull();
    expect(root.textContent).not.toContain('⌘K');
  });
});

describe('GOV-658 shell — mode control drives the one palette authority (§1/§1.4)', () => {
  it('renders Simple + Advanced buttons with the active one pressed', () => {
    renderShell(root, { active: '/app', mode: 'advanced' });
    const simple = root.querySelector('[data-test="mode-simple"]');
    const advanced = root.querySelector('[data-test="mode-advanced"]');
    expect(simple?.getAttribute('aria-pressed')).toBe('false');
    expect(advanced?.getAttribute('aria-pressed')).toBe('true');
  });

  it('applyMode persists gw_home_mode and sets the palette (advanced→dark, simple→light)', () => {
    applyMode('advanced');
    expect(readMode()).toBe('advanced');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    applyMode('simple');
    expect(readMode()).toBe('simple');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('clicking a mode button applies + persists that mode', () => {
    renderShell(root, { active: '/app', mode: 'advanced' });
    const simpleBtn = root.querySelector('[data-test="mode-simple"]') as HTMLButtonElement;
    simpleBtn.click();
    expect(readMode()).toBe('simple');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('defaults to Advanced when nothing is persisted (§1)', () => {
    expect(readMode()).toBe('advanced');
    renderShell(root, { active: '/app' });
    expect(
      (root.querySelector('[data-test="mode-advanced"]') as HTMLElement).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('renderShell syncs palette to the default mode when no theme is pinned (§1/§10)', () => {
    // No explicit theme pin → Advanced default drives the palette to dark.
    expect(localStorage.getItem('gw-theme')).toBeNull();
    renderShell(root, { active: '/app' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('an explicit theme pin WINS over the mode auto-sync (§1.4)', () => {
    // User explicitly pins light via the standalone control...
    localStorage.setItem('gw-theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
    // ...rendering the shell in Advanced must NOT override that pin.
    renderShell(root, { active: '/app', mode: 'advanced' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

describe('GOV-658 shell — footer honesty (§5.2)', () => {
  it('carries the brand tagline', () => {
    renderShell(root, { active: '/app' });
    expect(root.querySelector('[data-test="shell-tagline"]')?.textContent).toMatch(
      /Holding power accountable/i,
    );
  });

  it('OMITS the data-refreshed stamp when no real timestamp is supplied (never faked)', () => {
    renderShell(root, { active: '/app' });
    expect(root.querySelector('[data-test="shell-refreshed"]')).toBeNull();
  });

  it('renders the data-refreshed stamp verbatim when a real timestamp is supplied', () => {
    renderShell(root, { active: '/app', refreshedAt: '2026-07-07T22:00:00Z' });
    const stamp = root.querySelector('[data-test="shell-refreshed"]');
    expect(stamp?.textContent).toBe('data refreshed 2026-07-07T22:00:00Z');
  });
});

describe('GOV-658 shell — brand links to the primary route', () => {
  it('brand href targets the first shipped tab', () => {
    renderShell(root, { active: '/timeline' });
    const brand = root.querySelector('[data-test="shell-brand"]');
    expect(brand?.getAttribute('href')).toBe(`#${NAV_TABS[0].route}`);
  });
});

// Type-level guard: ShellMode stays the two-value union the palette mapping assumes.
const _modes: ShellMode[] = ['simple', 'advanced'];
void _modes;
