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
  SHELL_STYLE,
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
    expect(root.querySelectorAll('[data-test="notification-panel"]')).toHaveLength(1);
  });

  it('renders distinct Advanced application chrome and Simple newspaper chrome', () => {
    renderShell(root, { active: '/home', mode: 'advanced' });
    expect(root.querySelector('.gw-shell-advanced-bar')).not.toBeNull();
    expect(root.querySelector('[data-test="shell-simple-utility"]')).toBeNull();
    expect(root.querySelector('[data-test="shell-simple-masthead"]')).toBeNull();
    expect(root.querySelector('[data-test="shell-simple-tools"]')).toBeNull();
    expect(root.querySelector('[data-test="shell-print"]')).toBeNull();

    renderShell(root, { active: '/home', mode: 'simple' });
    expect(root.querySelector('.gw-shell-advanced-bar')).toBeNull();
    expect(root.querySelector('[data-test="shell-simple-utility"]')).not.toBeNull();
    expect(root.querySelector('[data-test="shell-simple-masthead"]')).not.toBeNull();
    expect(root.querySelector('[data-test="shell-simple-tools"]')).not.toBeNull();
    expect(root.querySelector('[data-test="shell-print"]')).not.toBeNull();
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

  it('reaches Alerts and the explainer from header controls rather than tabs', () => {
    renderShell(root, { active: '/home' });
    const tabHrefs = [...root.querySelectorAll('.gw-shell-tab')].map((a) => a.getAttribute('href'));
    expect(tabHrefs).not.toContain('#/alerts');
    expect(tabHrefs).not.toContain('#/explainer');

    expect(root.querySelector('[data-test="shell-alerts-chip"]')?.getAttribute('href')).toBe('#/alerts');
    expect(root.querySelector('[data-test="shell-demo"]')?.getAttribute('href')).toBe('#/explainer');
    expect(root.querySelector('[data-test="shell-jurisdiction"]')?.getAttribute('href')).toBe('#/location');
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

  it('keeps live Alpine context authoritative while labeling a different saved view', () => {
    localStorage.setItem('gw_location', JSON.stringify({
      town: 'Jackson',
      state: 'Wyoming',
    }));
    renderShell(root, { active: '/home', origin: 'live_server' });
    const location = root.querySelector<HTMLElement>('[data-test="shell-jurisdiction"]');

    expect(location?.dataset.authoritativeContext).toBe('alpine');
    expect(location?.dataset.savedLocation).toBe('Jackson, Wyoming');
    expect(location?.querySelector('.gw-shell-location-primary')?.textContent)
      .toBe('Alpine endpoint');
    expect(location?.querySelector('.gw-shell-location-saved')?.textContent)
      .toBe('Saved view: Jackson, Wyoming');
    expect(location?.getAttribute('aria-label')).toContain(
      'Live records remain in the Alpine endpoint context',
    );
  });

  it('renders an accessible search input and submits an encoded timeline search', () => {
    renderShell(root, { active: '/home' });
    const input = root.querySelector('[data-test="shell-search"]') as HTMLInputElement;
    const form = root.querySelector('[data-test="shell-search-form"]') as HTMLFormElement;
    expect(input.tagName).toBe('INPUT');
    expect(input.type).toBe('search');
    // The field must not advertise a population it cannot search. There is no
    // officials index, no document index, and no archive behind it.
    expect(input.labels?.[0]?.textContent).toMatch(/reviewed timeline records/i);
    expect(input.labels?.[0]?.textContent).toMatch(/not an archive search/i);
    for (const claim of [input.placeholder, input.labels?.[0]?.textContent ?? '']) {
      expect(claim).not.toMatch(/officials|documents/i);
    }
    // ⌘K focuses this field; it must not imply a command palette that does not exist.
    expect(input.title).toMatch(/focuses this field/i);

    input.value = 'water rates & fees';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    expect(window.location.hash).toBe('#/timeline?search=water%20rates%20%26%20fees');
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

  for (const mode of ['advanced', 'simple'] as const) {
    it(`shows the honest preview account and gated notification panel in ${mode} mode`, () => {
      renderShell(root, { active: '/home', mode });
      const account = root.querySelector('[data-test="shell-account"]');
      const bell = root.querySelector('[data-test="notification-bell"]');
      expect(account?.textContent).toContain('REVIEWER ACCESS');
      expect(account?.textContent).toContain('private beta');
      expect(account?.textContent).not.toMatch(/✓\s*ID|ID-verified/i);
      expect(account?.getAttribute('role')).toBe('note');
      expect(account?.getAttribute('tabindex')).toBe('0');
      const descriptionId = account?.getAttribute('aria-describedby');
      expect(descriptionId).toBe('gw-reviewer-access-description');
      expect(root.querySelector(`#${descriptionId}`)?.textContent).toMatch(/does not expose or verify/i);
      expect(root.querySelectorAll('[data-test="notification-panel"]')).toHaveLength(1);
      expect(bell?.getAttribute('aria-haspopup')).toBe('dialog');
      expect(bell?.getAttribute('aria-expanded')).toBe('false');
      const notificationNote = root.querySelector<HTMLButtonElement>(
        '[data-info-note="shell-notifications"]',
      );
      expect(notificationNote).not.toBeNull();
      notificationNote?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      const notePanelId = notificationNote?.getAttribute('aria-controls');
      const noteText = notePanelId
        ? document.querySelector(`#${notePanelId}`)?.textContent
        : '';
      expect(noteText).toMatch(/Account workflow/);
      expect(noteText).toMatch(/not civic Alerts/i);
      expect(noteText).toMatch(/unavailable—not proof/i);
      expect(root.querySelector('[data-test="shell-alerts"]')).toBeNull();
      expect(root.querySelector('[data-test="shell-alert-count"]')).toBeNull();
    });
  }

  it('reveals the active final navigation tab when Watchlist is selected', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    renderShell(root, { active: '/watchlist' });

    expect(root.querySelector('.gw-shell-tab[aria-current="page"]')?.textContent).toBe('Watchlist');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  });

  it('marks the Alerts chip current on /alerts, leaving no tab selected', () => {
    renderShell(root, { active: '/alerts' });

    expect(root.querySelector('.gw-shell-tab[aria-current="page"]')).toBeNull();
    expect(root.querySelector('[data-test="shell-alerts-chip"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('counts unread Alerts only in fixture mode, never against reviewed data', () => {
    localStorage.removeItem('gw_alerts_read');

    renderShell(root, { active: '/home', fixture: true });
    expect(root.querySelector('[data-test="shell-alerts-badge"]')?.textContent).toBe('3');

    renderShell(root, { active: '/home' });
    expect(root.querySelector('[data-test="shell-alerts-badge"]')).toBeNull();
    expect(root.querySelector('[data-test="shell-alerts-chip"]')).not.toBeNull();
  });

  it('drops the badge once every fixture card is read', () => {
    localStorage.setItem(
      'gw_alerts_read',
      JSON.stringify(['fixture-attachment-replaced', 'fixture-meeting-eve', 'fixture-agenda-posted']),
    );

    renderShell(root, { active: '/home', fixture: true });
    expect(root.querySelector('[data-test="shell-alerts-badge"]')).toBeNull();
    localStorage.removeItem('gw_alerts_read');
  });

  for (const mode of ['advanced', 'simple'] as const) {
    it(`keeps the shared logo and AI limitation line visible in ${mode} mode`, () => {
      renderShell(root, { active: '/home', mode });
      const brand = root.querySelector('[data-test="shell-brand"]');
      const disclosure = root.querySelector('[data-test="shell-ai-disclosure"]');
      expect(root.querySelectorAll('[data-test="shell-brand"]')).toHaveLength(1);
      expect(root.querySelectorAll('[data-test="shell-ai-disclosure"]')).toHaveLength(1);
      expect(brand?.textContent).toContain('GOVERNMENTWATCHDOG');
      expect(disclosure?.textContent).toBe('AI-POWERED ANALYSIS');
      expect(disclosure?.getAttribute('title')).toMatch(/can be wrong/i);
      expect(disclosure?.getAttribute('title')).toMatch(/primary records/i);
    });
  }

  it('offers a functional print-or-PDF control in Simple mode', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    renderShell(root, { active: '/home', mode: 'simple' });
    const button = root.querySelector('[data-test="shell-print"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toMatch(/print or save/i);
    button.click();
    expect(print).toHaveBeenCalledOnce();
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

  it('defaults new visitors to Simple and syncs its light palette when no theme is pinned', () => {
    expect(readMode()).toBe('simple');
    expect(localStorage.getItem('gw-theme')).toBeNull();
    renderShell(root, { active: '/agenda' });
    expect(root.getAttribute('data-mode')).toBe('simple');
    expect(root.querySelector('[data-test="mode-simple"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('does not override an explicit standalone theme pin', () => {
    localStorage.setItem('gw-theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
    renderShell(root, { active: '/agenda', mode: 'advanced' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

describe('GOV-658 shell — responsive Simple chrome', () => {
  it('stacks Simple utility and search rows before the 768px tablet collision', () => {
    const tabletRule = SHELL_STYLE.match(
      /@media \(max-width:900px\)\{(?<rule>[\s\S]*?)\n\}/,
    )?.groups?.rule;

    expect(tabletRule).toBeTruthy();
    expect(tabletRule).toContain(
      '.gw-shell-simple-utility{align-items:stretch;flex-direction:column}',
    );
    expect(tabletRule).toContain(
      '.gw-shell-simple-utility .gw-shell-actions{margin-left:0;overflow-x:auto',
    );
    expect(tabletRule).toContain(
      '.gw-shell-simple-tools .gw-shell-search{margin:0;max-width:none}',
    );
    expect(tabletRule).toContain(
      '.gw-shell-root[data-mode="simple"] .gw-shell-tabs{justify-content:flex-start}',
    );
  });

  it('contains the full mobile action rail without widening the page', () => {
    const mobileRule = SHELL_STYLE.match(
      /@media \(max-width:760px\)\{(?<rule>[\s\S]*?)\n\}/,
    )?.groups?.rule;

    expect(mobileRule).toBeTruthy();
    expect(mobileRule).toContain(
      '.gw-shell-actions{order:3;width:100%;max-width:100%',
    );
    expect(mobileRule).toContain('overflow-x:auto;overflow-y:hidden');
  });

  it('wraps phone actions and stacks the Simple masthead instead of clipping controls or words', () => {
    const phoneRule = SHELL_STYLE.match(
      /@media \(max-width:430px\)\{(?<rule>[\s\S]*?)\n\}/,
    )?.groups?.rule;

    expect(phoneRule).toBeTruthy();
    expect(phoneRule).toContain(
      '.gw-shell-actions,.gw-shell-simple-utility .gw-shell-actions{justify-content:flex-start;flex-wrap:wrap;overflow:visible}',
    );
    expect(phoneRule).toContain(
      '.gw-shell-simple-masthead{grid-template-columns:1fr;align-items:start}',
    );
  });
});

describe('GOV-658 shell — footer honesty', () => {
  it('carries mode-specific mottos, source verification, and real footer routes', () => {
    renderShell(root, { active: '/home', mode: 'advanced' });
    expect(root.querySelector('[data-test="shell-tagline"]')?.textContent).toMatch(
      /Holding power accountable/i,
    );
    expect(root.querySelector('[data-test="shell-preview-note"]')?.textContent).toMatch(
      /verify AI analysis against primary records/i,
    );
    expect([...root.querySelectorAll('[data-test="shell-footer-links"] a')].map((link) => (
      link.getAttribute('href')
    ))).toEqual(['#/vault', '#/newsletter', '#/watchlist']);

    renderShell(root, { active: '/home', mode: 'simple' });
    expect(root.querySelector('[data-test="shell-tagline"]')?.textContent).toMatch(
      /We Watch\. We Report\. You Decide/i,
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

  it('renders only an explicitly supplied truthful origin banner', () => {
    renderShell(root, { active: '/home' });
    expect(root.querySelector('[data-test="shell-origin-banner"]')).toBeNull();

    renderShell(root, { active: '/home', origin: 'fixture' });
    const fixture = root.querySelector('[data-test="shell-origin-banner"]');
    expect(root.getAttribute('data-origin')).toBe('fixture');
    expect(fixture?.getAttribute('data-origin')).toBe('fixture');
    expect(fixture?.textContent).toMatch(/SYNTHETIC DESIGN FIXTURE/i);
    expect(fixture?.textContent).toMatch(/not a live read/i);

    renderShell(root, {
      active: '/home',
      origin: 'reviewed_snapshot',
      refreshedAt: '2026-07-07T22:00:00Z',
    });
    const reviewed = root.querySelector('[data-test="shell-origin-banner"]');
    expect(reviewed?.getAttribute('data-origin')).toBe('reviewed_snapshot');
    expect(reviewed?.textContent).toMatch(/REVIEWED SNAPSHOT/i);
    expect(reviewed?.textContent).toMatch(/reviewer-internal archived projection/i);
    expect(reviewed?.querySelector('time')?.getAttribute('datetime'))
      .toBe('2026-07-07T22:00:00Z');

    renderShell(root, { active: '/home', origin: 'live_server' });
    const live = root.querySelector('[data-test="shell-origin-banner"]');
    expect(root.getAttribute('data-origin')).toBe('live_server');
    expect(live?.getAttribute('data-origin')).toBe('live_server');
    expect(live?.textContent).toMatch(/LIVE SERVER CONTEXT/i);
    expect(live?.textContent).toMatch(/no captured fallback/i);
    expect(live?.textContent).not.toMatch(/REVIEWED SNAPSHOT/i);
  });
});

describe('GOV-658 shell — brand route', () => {
  it('targets the first approved primary tab', () => {
    renderShell(root, { active: '/timeline' });
    expect(root.querySelector('[data-test="shell-brand"]')?.getAttribute('href'))
      .toBe(`#${NAV_TABS[0].route}`);
  });
});

describe('GOV-658 shell — contextual information notes', () => {
  const commonNoteIds = [
    'shell-location',
    'shell-search',
    'shell-account',
    'shell-navigation',
    'shell-ai',
    'shell-origin',
  ] as const;

  for (const mode of ['advanced', 'simple'] as const) {
    it(`connects each ${mode} chrome note to one complete accessible panel`, () => {
      renderShell(root, { active: '/home', mode, origin: 'live_server' });
      const required = mode === 'simple'
        ? [...commonNoteIds, 'shell-print'] as const
        : commonNoteIds;

      for (const id of required) {
        const trigger = root.querySelector<HTMLButtonElement>(`[data-info-note="${id}"]`);
        expect(trigger, `${id} trigger`).not.toBeNull();
        expect(trigger?.type).toBe('button');
        expect(trigger?.getAttribute('aria-label')).toBeTruthy();
        expect(trigger?.getAttribute('aria-expanded')).toBe('false');

        const panelId = trigger?.getAttribute('aria-controls');
        expect(panelId, `${id} panel id`).toBeTruthy();
        const panel = panelId ? root.querySelector<HTMLElement>(`#${panelId}`) : null;
        expect(panel, `${id} panel`).not.toBeNull();
        expect(panel?.hasAttribute('hidden')).toBe(true);
        expect(panel?.getAttribute('aria-label')).toBe(trigger?.getAttribute('aria-label'));
        expect(panel?.textContent).toMatch(/What this is/);
        expect(panel?.textContent).toMatch(/Filled from/);
        expect(panel?.textContent).toMatch(/Filed under/);
        expect(panel?.textContent).toMatch(/Review and updates/);
        expect(panel?.textContent).toMatch(/Current state/);
        expect(panel?.textContent).toMatch(/Limits/);
        expect(panel?.textContent).toMatch(/Expected result/);
      }

      const labels = [...root.querySelectorAll<HTMLButtonElement>('[data-info-note]')]
        .map((trigger) => trigger.getAttribute('aria-label'));
      expect(new Set(labels).size).toBe(labels.length);
      expect(root.querySelectorAll('[data-info-note="shell-print"]'))
        .toHaveLength(mode === 'simple' ? 1 : 0);
    });
  }

  it('keeps each explanation adjacent to the control or status it describes', () => {
    renderShell(root, { active: '/home', mode: 'simple', origin: 'live_server' });

    expect(root.querySelector('.gw-shell-location-control [data-info-note="shell-location"]'))
      .not.toBeNull();
    expect(root.querySelector('[data-test="shell-search-form"] [data-info-note="shell-search"]'))
      .not.toBeNull();
    expect(root.querySelector('[data-test="shell-actions"] [data-info-note="shell-account"]'))
      .not.toBeNull();
    expect(root.querySelector('[data-test="shell-actions"] [data-info-note="shell-print"]'))
      .not.toBeNull();
    expect(root.querySelector('[data-test="shell-tabs"] [data-info-note="shell-navigation"]'))
      .not.toBeNull();
    expect(root.querySelector('.gw-shell-brand-group [data-info-note="shell-ai"]'))
      .not.toBeNull();
    expect(root.querySelector('.gw-shell-origin-wrap [data-info-note="shell-origin"]'))
      .not.toBeNull();
  });

  it('explains scope and origin without changing their authoritative values', () => {
    localStorage.setItem('gw_location', JSON.stringify({
      town: 'Jackson',
      state: 'Wyoming',
    }));
    renderShell(root, { active: '/home', origin: 'live_server' });

    const locationTrigger = root.querySelector<HTMLButtonElement>(
      '[data-info-note="shell-location"]',
    );
    locationTrigger?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    const locationPanelId = locationTrigger?.getAttribute('aria-controls');
    const locationText = locationPanelId
      ? document.querySelector(`#${locationPanelId}`)?.textContent
      : '';
    expect(locationText).toMatch(/cannot widen records/i);
    expect(locationText).toMatch(/not residence, identity, coverage, entitlement/i);

    const originTrigger = root.querySelector<HTMLButtonElement>(
      '[data-info-note="shell-origin"]',
    );
    originTrigger?.click();
    const originPanelId = originTrigger?.getAttribute('aria-controls');
    const originText = originPanelId
      ? document.querySelector(`#${originPanelId}`)?.textContent
      : '';
    expect(originText).toMatch(/live server data, a reviewed archived snapshot, or a synthetic design fixture/i);
    expect(root.getAttribute('data-origin')).toBe('live_server');
    expect(root.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'))
      .toBe('live_server');
  });

  it('does not render an origin explanation when no origin claim is supplied', () => {
    renderShell(root, { active: '/home' });
    expect(root.querySelector('[data-info-note="shell-origin"]')).toBeNull();
    expect(root.querySelector('[data-test="shell-origin-banner"]')).toBeNull();
  });
});

// Type-level guard: the palette mapping assumes exactly these two values.
const _modes: ShellMode[] = ['simple', 'advanced'];
void _modes;


// GOV-73: a printed civic page is an evidence artifact. The two halves of this
// rule fail in OPPOSITE directions, so both are asserted: too little hiding puts
// fixed chrome over the content, and too much hiding strips the provenance that
// makes the printout trustworthy. A broad "hide the chrome" sweep added later
// would pass the first assertion and break the second.
describe('GOV-73 print stylesheet', () => {
  const printBlock = (): string => {
    const at = SHELL_STYLE.indexOf('@media print');
    expect(at, 'SHELL_STYLE has an @media print block').toBeGreaterThan(-1);
    return SHELL_STYLE.slice(at);
  };

  it('hides every piece of fixed or interactive chrome', () => {
    const block = printBlock();
    for (const sel of [
      '.gw-shell-tabs', '.gw-shell-search', '.gw-shell-mode', '.gw-shell-print',
      '.gw-theme-toggle', '.gw-ntf-drawer', '.gw-ntf-bell',
    ]) {
      expect(block, sel).toContain(sel);
    }
    expect(block).toContain('display: none');
  });

  /** Selector lists of every rule in the print block whose body hides something.
   *  Parsed as rules, NOT sliced by character offset: the first version of this
   *  helper used `block.slice(i - 400, i)`, and because that index was 231 the
   *  negative start made String.slice count from the END — the window was always
   *  the empty string, so the assertion could never fail. It passed a red proof
   *  only because the mutation was also silently a no-op. */
  const hidingSelectorLists = (): string[] => {
    const block = printBlock();
    // Strip the `@media print {` wrapper before parsing rules. Without this the
    // first match treats `@media print ` as a selector list and swallows the
    // whole first rule as its body — the assertion then reads a selector list of
    // "@media print" and passes no matter what is hidden.
    const open = block.indexOf('{');
    const inner = block.slice(open + 1, block.lastIndexOf('}'));
    return [...inner.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => /display\s*:\s*none/.test(m[2]))
      .map((m) => m[1]);
  };

  it('never hides a provenance surface — banner, origin, fixture label, footer', () => {
    const hiding = hidingSelectorLists();
    // Guard the parse itself: zero hiding rules would make the loop vacuous.
    expect(hiding.length, 'found at least one display:none rule').toBeGreaterThan(0);
    const hidden = hiding.join(' ');
    for (const sel of [
      '.gw-shell-banner-slot', '.gw-shell-origin', '.gw-shell-origin-fixture', '.gw-shell-footer',
    ]) {
      expect(printBlock(), `${sel} present`).toContain(sel);
      expect(hidden, `${sel} must NOT be in a display:none rule`).not.toContain(sel);
    }
  });

  it('forces a print-safe palette so Advanced does not print full-bleed dark', () => {
    const block = printBlock();
    expect(block).toContain('background: #fff');
    expect(block).toContain('color: #000');
  });

  it('un-pins fixed positioning so nothing overlays the first page', () => {
    expect(printBlock()).toContain('position: static');
  });
});


// GOV-71: the baseline's account chip is `J. Citizen ✓ ID · manage`. The identity
// half must never be reproduced; the `manage` half must not vanish. Both halves
// are asserted because they fail in opposite directions — reproducing identity
// would be an invented claim, and dropping the slot is the disappearing-slot
// failure the handoff forbids.
describe('GOV-71 account chip manage affordance', () => {
  const chip = (): HTMLElement => {
    const root = document.createElement('div');
    document.body.append(root);
    renderShell(root, { active: '/home', origin: 'live_server', fixture: false });
    const el = root.querySelector<HTMLElement>('[data-test="shell-account"]');
    expect(el, 'account chip renders').not.toBeNull();
    return el!;
  };

  it('renders a manage affordance that is present but non-actionable', () => {
    const manage = chip().querySelector<HTMLButtonElement>('[data-test="shell-account-manage"]');
    expect(manage, 'manage affordance exists').not.toBeNull();
    expect(manage!.disabled).toBe(true);
    expect(manage!.getAttribute('aria-disabled')).toBe('true');
    // Navigates nowhere: not a link, no href anywhere in the slot.
    expect(manage!.tagName).toBe('BUTTON');
    expect(manage!.querySelector('a,[href]')).toBeNull();
  });

  it('names the absent contract rather than asserting an identity', () => {
    const manage = chip().querySelector('[data-test="shell-account-manage"]')!;
    const title = manage.getAttribute('title') ?? '';
    expect(title).toContain('/v1/session');
    expect(title).toContain('access-request');
    expect(title.toLowerCase()).not.toContain('signed in as');
  });

  it('exposes no person, email, or verified-ID glyph anywhere in the chip', () => {
    const c = chip();
    const surface = `${c.textContent ?? ''} ${c.getAttribute('title') ?? ''} ${c.innerHTML}`;
    expect(surface).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);   // no email
    expect(surface).not.toContain('✓');                        // no verified glyph
    expect(surface).not.toMatch(/\bJ\.\s?Citizen\b/);          // no baseline persona
  });
});
