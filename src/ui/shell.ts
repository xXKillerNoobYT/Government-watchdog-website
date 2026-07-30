/**
 * GOV-658 — persistent gated-app shell.
 *
 * The shell is intentionally an imperative DOM module because every shipped
 * surface already renders into a caller-owned element. `renderShell` replaces
 * only the shared chrome and returns a fresh content slot, preserving that
 * contract while recreating the approved Government Watchdog design handoff.
 *
 * Trust boundaries stay explicit:
 *  - `main.ts` remains the beta-gate authority; this module never authenticates.
 *  - the account chrome is visibly labelled as a preview.
 *  - notifications mount only inside the approved gated shell and consume the
 *    typed same-origin response contract without recomputing unread state.
 *  - AI analysis is disclosed as machine-generated and source-verification is
 *    repeated in the footer.
 *  - a refreshed timestamp is shown only when the caller supplies a real one.
 */

import { GW_TOKENS } from './tokens';
import { setThemePref, applyThemePref, hasExplicitThemePref } from './theme-toggle';
import { countUnreadFixtureAlerts } from './alerts-fixture';
import { mountNotificationPanel } from './notification-panel';
import { renderInfoNote } from './info-note';
import { renderPrivateInfoNote } from './private-info-note';

export type ShellMode = 'simple' | 'advanced';
export type ShellOrigin = 'fixture' | 'reviewed_snapshot' | 'live_server';

/** Shared per-user reading mode used by the approved page designs. */
const MODE_KEY = 'gw_home_mode';

/** One primary navigation destination. `route` omits the leading hash. */
interface NavTab {
  route: string;
  label: string;
  /** Context and legacy routes which should highlight this information parent. */
  also?: string[];
}

/**
 * Approved information architecture, in its exact handoff order.
 *
 * Eight primary tabs. Alerts and Location are deliberately NOT tabs: the
 * handoff reaches both from persistent header controls — the Alerts chip and
 * the location pill — which keeps the tab row to the eight surfaces a reader
 * moves between while leaving the two personal surfaces one tap away from
 * anywhere.
 *
 * Older reviewer routes remain reachable and highlight the closest canonical
 * parent. This keeps the active-state useful during the route migration without
 * promoting legacy implementation names into the primary navigation.
 */
export const NAV_TABS: readonly NavTab[] = [
  { route: '/home', label: 'Home' },
  { route: '/agenda', label: 'Fast Agenda', also: ['/app', '/agenda-boards', '/meeting'] },
  { route: '/timeline', label: 'Timeline', also: ['/timeline-legacy', '/cards', '/topics', '/issue'] },
  { route: '/boards', label: 'Boards', also: ['/body'] },
  { route: '/power', label: 'Power Tracker' },
  { route: '/vault', label: 'Source Vault', also: ['/sources'] },
  { route: '/newsletter', label: 'Newsletter' },
  { route: '/watchlist', label: 'Watchlist' },
];

const BRAND_ROUTE = NAV_TABS[0].route;
const ADVANCED_MOTTO = '◆ Holding power accountable. Amplifying transparency.';
const SIMPLE_MOTTO = '★ We Watch. We Report. You Decide.';
const AI_DISCLOSURE =
  'AI-generated summaries and flags can be wrong. Verify every conclusion against the linked primary records.';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

/** Read the persisted reading mode, defaulting new visitors to the quick Simple view. */
export function readMode(): ShellMode {
  try {
    const value = localStorage.getItem(MODE_KEY);
    if (value === 'simple' || value === 'advanced') return value;
  } catch {
    /* Storage can be unavailable in private/non-browser contexts. */
  }
  return 'simple';
}

function persistMode(mode: ShellMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* Non-fatal: the current render still reflects the explicit choice. */
  }
}

/** Persist the reading mode and route its palette through the single authority. */
export function applyMode(mode: ShellMode): void {
  persistMode(mode);
  setThemePref(mode === 'advanced' ? 'dark' : 'light');
}

/** Let mode pick the initial palette without overriding a standalone theme pin. */
function syncPaletteToMode(mode: ShellMode): void {
  if (hasExplicitThemePref()) return;
  applyThemePref(mode === 'advanced' ? 'dark' : 'light');
}

function isActive(tab: NavTab, path: string): boolean {
  return tab.route === path || (tab.also?.includes(path) ?? false);
}

function testSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function brand(): HTMLAnchorElement {
  return el('a', {
    class: 'gw-shell-brand',
    href: `#${BRAND_ROUTE}`,
    'aria-label': `Government Watchdog home. AI-powered analysis. ${AI_DISCLOSURE}`,
    'data-test': 'shell-brand',
  }, [
    el('span', { class: 'gw-shell-logo', 'aria-hidden': 'true' }, ['GW']),
    el('span', { class: 'gw-shell-wordmark' }, [
      el('b', {}, ['GOVERNMENT']),
      el('span', {}, ['WATCHDOG']),
      aiDisclosure(),
    ]),
  ]);
}

function brandWithAiNote(): HTMLDivElement {
  return el('div', { class: 'gw-shell-brand-group' }, [
    brand(),
    renderPrivateInfoNote('shell-ai'),
  ]);
}

/** Disclosure, not a certification or a claim that a human reviewed the output. */
function aiDisclosure(): HTMLElement {
  return el('small', {
    class: 'gw-shell-ai',
    'data-test': 'shell-ai-disclosure',
    title: AI_DISCLOSURE,
    'aria-label': `AI analysis disclosure. ${AI_DISCLOSURE}`,
  }, ['AI-POWERED ANALYSIS']);
}

/**
 * A real route link; the location screen owns any later picker behavior.
 *
 * A saved place is only a device preference. Live server routes therefore keep
 * the Alpine endpoint context primary and disclose a non-Alpine saved view
 * separately instead of letting it visually relabel authorized civic rows.
 */
function locationLink(origin?: ShellOrigin): HTMLAnchorElement {
  let savedLocationLabel = '';
  try {
    const stored = JSON.parse(localStorage.getItem('gw_location') ?? 'null') as {
      town?: unknown;
      state?: unknown;
    } | null;
    const town = typeof stored?.town === 'string' ? stored.town.trim() : '';
    const state = typeof stored?.state === 'string' ? stored.state.trim() : '';
    if (town && state) savedLocationLabel = `${town}, ${state}`;
    else if (town) savedLocationLabel = town;
    else if (state) savedLocationLabel = state;
  } catch {
    /* Invalid preview storage falls back to the known Alpine design location. */
  }
  const live = origin === 'live_server';
  const locationLabel = live ? 'Alpine endpoint' : (savedLocationLabel || 'Alpine, WY');
  const nonAlpineSavedView = live
    && savedLocationLabel.length > 0
    && !savedLocationLabel.toLocaleLowerCase().startsWith('alpine');
  const ariaLabel = nonAlpineSavedView
    ? `Open location settings. Live records remain in the Alpine endpoint context. Saved view: ${savedLocationLabel}; it does not change authorized records.`
    : live
      ? 'Open location settings. Live records are in the Alpine endpoint context.'
      : `Change location. Current preview location: ${locationLabel}.`;
  const attrs: Record<string, string> = {
    class: 'gw-shell-location',
    href: '#/location',
    title: live ? 'Live context and saved location view' : 'Change your place',
    'aria-label': ariaLabel,
    'data-test': 'shell-jurisdiction',
  };
  if (live) attrs['data-authoritative-context'] = 'alpine';
  if (nonAlpineSavedView) attrs['data-saved-location'] = savedLocationLabel;

  return el('a', {
    ...attrs,
  }, [
    el('span', { class: 'gw-shell-location-dot', 'aria-hidden': 'true' }, []),
    el('span', { class: 'gw-shell-location-copy' }, [
      el('span', { class: 'gw-shell-location-primary' }, [locationLabel]),
      ...(nonAlpineSavedView
        ? [el('small', { class: 'gw-shell-location-saved' }, [`Saved view: ${savedLocationLabel}`])]
        : []),
    ]),
    el('span', { class: 'gw-shell-location-arrow', 'aria-hidden': 'true' }, ['›']),
  ]);
}

function locationControl(origin?: ShellOrigin): HTMLDivElement {
  return el('div', { class: 'gw-shell-location-control' }, [
    locationLink(origin),
    renderPrivateInfoNote('shell-location'),
  ]);
}

function timelineSearchHash(query: string): string {
  return `#/timeline?search=${encodeURIComponent(query.trim())}`;
}

function searchControl(): HTMLFormElement {
  const form = el('form', {
    class: 'gw-shell-search',
    role: 'search',
    'aria-label': 'Search Government Watchdog',
    'data-test': 'shell-search-form',
  });
  // Names only what is actually searched. Submitting filters the reviewed timeline
  // records already admitted to this app — there is no officials index, no document
  // index, and no archive behind this field. Advertising those would let an empty
  // result read as "Alpine has no such official" instead of "this response has no
  // matching row".
  const label = el('label', { class: 'gw-shell-sr-only', for: 'gw-shell-search-input' }, [
    'Filter the reviewed timeline records already admitted to this app. This is not an archive search.',
  ]);
  const submit = el('button', {
    class: 'gw-shell-search-submit',
    type: 'submit',
    'aria-label': 'Submit search',
    title: 'Search',
  }, ['⌕']);
  const input = el('input', {
    id: 'gw-shell-search-input',
    class: 'gw-shell-search-input',
    type: 'search',
    name: 'search',
    autocomplete: 'off',
    placeholder: 'Filter reviewed timeline records…',
    // The shortcut focuses this field; it does not open a command palette.
    title: 'Filters reviewed timeline records already loaded — not an archive search. ⌘K or Ctrl-K focuses this field.',
    'data-test': 'shell-search',
  });
  const shortcut = el('kbd', {
    class: 'gw-shell-search-shortcut',
    'aria-hidden': 'true',
  }, ['⌘K']);

  form.append(label, submit, input, shortcut, renderPrivateInfoNote('shell-search'));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    window.location.hash = timelineSearchHash(input.value);
  });
  return form;
}

/**
 * The shell re-renders on every route change. Install one shortcut listener and
 * resolve the current input at keypress time so old inputs are never retained.
 */
let searchShortcutInstalled = false;
function installSearchShortcut(): void {
  if (searchShortcutInstalled) return;
  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'k' || (!event.metaKey && !event.ctrlKey) || event.altKey) return;
    const input = document.querySelector('[data-test="shell-search"]');
    if (!(input instanceof HTMLInputElement)) return;
    event.preventDefault();
    input.focus();
    input.select();
  });
  searchShortcutInstalled = true;
}

/** Reviewer-lane label only; no person, email, or identity verification claim. */
function accountChip(): HTMLSpanElement {
  const descriptionId = 'gw-reviewer-access-description';
  return el('span', {
    class: 'gw-shell-account',
    'data-test': 'shell-account',
    role: 'note',
    tabindex: '0',
    title: 'Private reviewer beta access. No person, email address, or verified identity is represented in the browser.',
    'aria-describedby': descriptionId,
  }, [
    el('span', { class: 'gw-shell-account-dot', 'aria-hidden': 'true' }, []),
    el('span', { class: 'gw-shell-account-copy' }, [
      el('b', {}, ['REVIEWER ACCESS']),
      el('small', {}, ['private beta']),
    ]),
    el('span', { id: descriptionId, class: 'gw-shell-sr-only' }, [
      'Private reviewer beta access. This browser chip does not expose or verify a person, email address, or identity.',
    ]),
  ]);
}

function modeToggle(mode: ShellMode): HTMLDivElement {
  const group = el('div', {
    class: 'gw-shell-mode',
    role: 'group',
    'aria-label': 'Reading mode',
    'data-test': 'mode-toggle',
    'data-mode': mode,
  });
  const options: { value: ShellMode; label: string }[] = [
    { value: 'simple', label: 'Simple' },
    { value: 'advanced', label: 'Advanced' },
  ];
  for (const { value, label } of options) {
    const button = el('button', {
      type: 'button',
      class: 'gw-shell-mode-btn',
      'data-mode-val': value,
      'data-test': `mode-${value}`,
      'aria-pressed': value === mode ? 'true' : 'false',
    }, [label]);
    button.addEventListener('click', () => {
      applyMode(value);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    group.append(button);
  }
  return group;
}

function printControl(): HTMLButtonElement {
  const button = el('button', {
    type: 'button',
    class: 'gw-shell-print',
    'data-test': 'shell-print',
    'aria-label': 'Print or save this page as a PDF',
  }, ['Print']);
  button.addEventListener('click', () => window.print());
  return button;
}

/**
 * Alerts is a header control rather than a tab.
 *
 * The count badge appears only in fixture mode. Outside it the chip is a plain
 * link: a number rendered against reviewed data would assert a civic-alert
 * volume the client cannot know, and an empty badge would assert zero.
 */
function alertsChip(path: string, fixture: boolean): HTMLAnchorElement {
  const active = path === '/alerts';
  const attrs: Record<string, string> = {
    class: 'gw-shell-alerts',
    href: '#/alerts',
    'data-test': 'shell-alerts-chip',
  };
  if (active) attrs['aria-current'] = 'page';

  const children: (Node | string)[] = [el('span', {}, ['Alerts'])];
  if (fixture) {
    const unread = countUnreadFixtureAlerts();
    if (unread > 0) {
      children.push(el('span', {
        class: 'gw-shell-alerts-badge',
        'data-test': 'shell-alerts-badge',
      }, [String(unread)]));
      attrs['aria-label'] = `Alerts — ${unread} unread fixture card${unread === 1 ? '' : 's'}`;
    }
  }
  return el('a', attrs, children);
}

/** Opens the explainer walkthrough; the handoff places it beside the tools. */
function demoButton(): HTMLAnchorElement {
  return el('a', {
    class: 'gw-shell-demo',
    href: '#/explainer',
    'data-test': 'shell-demo',
  }, ['▶ Demo']);
}

/** Keep the server-authoritative notification panel in both reading modes. */
function shellActions(mode: ShellMode, includePrint = false, nav: NavContext = {}): HTMLDivElement {
  const actions = el('div', { class: 'gw-shell-actions', 'data-test': 'shell-actions' }, [
    accountChip(),
    renderPrivateInfoNote('shell-account'),
  ]);
  actions.append(demoButton());
  actions.append(alertsChip(nav.active ?? '', nav.fixture === true));
  mountNotificationPanel(actions);
  actions.append(
    renderPrivateInfoNote('shell-notifications'),
    modeToggle(mode),
    renderInfoNote('shell-mode'),
  );
  if (includePrint) {
    actions.append(
      printControl(),
      renderPrivateInfoNote('shell-print'),
    );
  }
  return actions;
}

function tabRow(path: string): HTMLElement {
  const nav = el('nav', {
    class: 'gw-shell-tabs',
    'aria-label': 'Primary',
    'data-test': 'shell-tabs',
  });
  for (const tab of NAV_TABS) {
    const attrs: Record<string, string> = {
      class: 'gw-shell-tab',
      href: `#${tab.route}`,
      'data-test': `tab-${testSlug(tab.label)}`,
      'data-route': tab.route,
    };
    if (isActive(tab, path)) attrs['aria-current'] = 'page';
    nav.append(el('a', attrs, [tab.label]));
  }
  nav.append(renderPrivateInfoNote('shell-navigation'));
  return nav;
}

function simpleMasthead(): HTMLDivElement {
  return el('div', { class: 'gw-shell-simple-masthead', 'data-test': 'shell-simple-masthead' }, [
    brandWithAiNote(),
    el('div', { class: 'gw-shell-simple-headline' }, [
      el('div', { class: 'gw-shell-simple-title' }, ['Government Watchdog Updates']),
      el('div', { class: 'gw-shell-simple-deck' }, [
        'TOWN  /  COUNTY  /  STATE · A nonpartisan guide to what your government is doing',
      ]),
    ]),
    el('blockquote', { class: 'gw-shell-simple-quote' }, ['“We Watch. We Report. You Decide.”']),
  ]);
}

function localDateLabel(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  } catch {
    return 'Today';
  }
}

function localDateIso(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function advancedBar(mode: ShellMode, origin: ShellOrigin | undefined, nav: NavContext): HTMLElement {
  return el('div', { class: 'gw-shell-bar gw-shell-advanced-bar' }, [
    brandWithAiNote(),
    locationControl(origin),
    searchControl(),
    shellActions(mode, false, nav),
  ]);
}

function simpleUtilityBar(mode: ShellMode, origin: ShellOrigin | undefined, nav: NavContext): HTMLElement {
  const today = new Date();
  return el('div', { class: 'gw-shell-simple-utility', 'data-test': 'shell-simple-utility' }, [
    el('div', { class: 'gw-shell-simple-place' }, [
      locationControl(origin),
      el('time', {
        datetime: localDateIso(today),
        'data-test': 'shell-local-date',
      }, [localDateLabel(today)]),
    ]),
    shellActions(mode, true, nav),
  ]);
}

function simpleTools(): HTMLElement {
  return el('div', { class: 'gw-shell-simple-tools', 'data-test': 'shell-simple-tools' }, [
    el('span', { class: 'gw-shell-simple-tools-label' }, [
      'Plain English first · official records one tap away',
    ]),
    searchControl(),
  ]);
}

function originBanner(origin: ShellOrigin, refreshedAt?: string): HTMLElement {
  const fixture = origin === 'fixture';
  const live = origin === 'live_server';
  const children: (Node | string)[] = [
    el('strong', {}, [
      fixture ? 'SYNTHETIC DESIGN FIXTURE' : live ? 'LIVE SERVER CONTEXT' : 'REVIEWED SNAPSHOT',
    ]),
    el('span', {}, [
      fixture
        ? 'visual-review sample · not a live read'
        : live
          ? 'same-origin authorization and reviewed records · no captured fallback'
          : 'reviewer-internal archived projection · not a live read',
    ]),
  ];
  if (refreshedAt) {
    children.push(el('time', { datetime: refreshedAt }, [`snapshot generated ${refreshedAt}`]));
  }
  const status = el('div', {
    class: `gw-shell-origin gw-shell-origin-${fixture ? 'fixture' : live ? 'live' : 'reviewed'}`,
    role: 'status',
    'data-test': 'shell-origin-banner',
    'data-origin': origin,
  }, children);
  return el('div', { class: 'gw-shell-origin-wrap' }, [
    status,
    renderPrivateInfoNote('shell-origin'),
  ]);
}

function footer(mode: ShellMode, refreshedAt?: string): HTMLElement {
  const children: (Node | string)[] = [
    el('div', { class: 'gw-shell-footer-brand' }, [
      el('strong', { class: 'gw-shell-tagline', 'data-test': 'shell-tagline' }, [
        mode === 'simple' ? SIMPLE_MOTTO : ADVANCED_MOTTO,
      ]),
      el('span', { class: 'gw-shell-preview-note', 'data-test': 'shell-preview-note' }, [
        'Beta interface · verify AI analysis against primary records.',
      ]),
    ]),
    el('nav', {
      class: 'gw-shell-footer-links',
      'aria-label': 'Footer navigation',
      'data-test': 'shell-footer-links',
    }, [
      el('a', { href: '#/vault' }, ['Source Vault']),
      el('a', { href: '#/newsletter' }, ['Newsletter']),
      el('a', { href: '#/watchlist' }, ['Watchlist']),
    ]),
  ];
  if (refreshedAt) {
    children.push(
      el('span', { class: 'gw-shell-refreshed', 'data-test': 'shell-refreshed' }, [
        `data refreshed ${refreshedAt}`,
      ]),
    );
  }
  return el('footer', { class: 'gw-shell-footer', 'data-test': 'shell-footer' }, children);
}

/** Nav-state the header controls need, threaded without widening every helper. */
interface NavContext {
  /** Current hash path without `#`. */
  active?: string;
  /** True only on a route already admitted to design-fixture mode. */
  fixture?: boolean;
}

export interface ShellOptions {
  /** Current hash path without `#`; used only for primary-nav highlighting. */
  active: string;
  /**
   * True when the caller has already resolved this route to design-fixture
   * mode. Gates the Alerts badge; the shell performs no access check itself.
   */
  fixture?: boolean;
  /** Current reading mode; defaults to the persisted `gw_home_mode` value. */
  mode?: ShellMode;
  /** Real projection-generation timestamp. Omitted means no stamp is rendered. */
  refreshedAt?: string;
  /** Explicit shell-wide data origin. Omitted when a page owns its own origin notice. */
  origin?: ShellOrigin;
}

/**
 * Render shared gated-app chrome and return the route surface's content slot.
 * The beta gate remains outside this function and is therefore impossible to
 * bypass by rendering or interacting with shell controls alone.
 */
export function renderShell(root: HTMLElement, opts: ShellOptions): HTMLElement {
  ensureShellStyle();
  installSearchShortcut();
  const mode = opts.mode ?? readMode();
  syncPaletteToMode(mode);

  root.className = 'gw-shell-root';
  root.setAttribute('data-mode', mode);
  if (opts.origin) root.setAttribute('data-origin', opts.origin);
  else root.removeAttribute('data-origin');
  root.replaceChildren();

  const slot = el('div', { class: 'gw-shell-slot', 'data-test': 'shell-content' });
  const bannerSlot = el('div', { class: 'gw-shell-banner-slot', 'data-test': 'shell-banner-slot' });
  if (opts.origin) bannerSlot.append(originBanner(opts.origin, opts.refreshedAt));
  const nav: NavContext = { active: opts.active, fixture: opts.fixture === true };
  const headerChildren = mode === 'simple'
    ? [simpleUtilityBar(mode, opts.origin, nav), simpleMasthead(), simpleTools(), tabRow(opts.active)]
    : [advancedBar(mode, opts.origin, nav), tabRow(opts.active)];

  root.append(
    bannerSlot,
    el('header', { class: 'gw-shell-header', 'data-test': 'app-shell', 'data-mode': mode }, headerChildren),
    el('main', { class: 'gw-shell-content' }, [slot]),
    footer(mode, opts.refreshedAt),
  );

  const activeTab = root.querySelector<HTMLElement>('.gw-shell-tab[aria-current="page"]');
  if (activeTab && typeof activeTab.scrollIntoView === 'function') {
    activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  return slot;
}

/** Token-mapped recreation of the handoff's Advanced and Simple shared chrome. */
export const SHELL_STYLE = `${GW_TOKENS}
/* GOV-1645: zero the default UA <body> margin. The shell mounts on #app (a direct
   <body> child) and is designed full-bleed — the 8px UA gutter both inset the
   sticky header/footer off the viewport edges and is the offset any future
   body-level element would turn into horizontal body scroll. Reset, don't mask:
   no overflow-x:hidden that would hide a real blowout. */
html,body{margin:0}
.gw-shell-root,.gw-shell-root *{box-sizing:border-box}
.gw-shell-root{font-family:var(--gw-font);font-size:14px;line-height:var(--gw-leading);color:var(--gw-text);background:var(--gw-page-bg);min-height:100vh;display:flex;flex-direction:column;margin:0}
.gw-shell-root[data-mode="simple"]{font-family:var(--gw-font-serif);font-size:16px}
.gw-shell-banner-slot:empty{display:none}
.gw-shell-banner-slot{width:100%;position:relative;z-index:30}
.gw-shell-origin-wrap{position:relative;width:100%}
.gw-shell-origin-wrap>.gw-info-note{position:absolute;right:10px;top:50%;transform:translateY(-50%)}
.gw-shell-origin{width:100%;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px 12px;padding:5px 16px;border-bottom:var(--gw-border-w) solid var(--gw-tone-info-line);background:var(--gw-tone-info-well);color:var(--gw-info-text);font:500 11.5px/1.35 var(--gw-font-mono);letter-spacing:.03em;text-align:center}
.gw-shell-origin-wrap .gw-shell-origin{padding-right:58px}
.gw-shell-origin strong{font-weight:800;letter-spacing:.06em}
.gw-shell-origin time{color:var(--gw-text-muted)}
.gw-shell-origin-fixture{border-bottom-color:var(--gw-tone-caution-line);background:var(--gw-tone-caution-well);color:var(--gw-caution-text)}
.gw-shell-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.gw-shell-header{position:sticky;top:0;z-index:20;background:var(--gw-header-bg);border-bottom:var(--gw-border-w) solid var(--gw-border-subtle)}
.gw-shell-bar{display:flex;align-items:center;gap:18px;max-width:1460px;margin:0 auto;padding:14px 28px}
.gw-shell-brand-group,.gw-shell-location-control{display:inline-flex;align-items:center;gap:6px;flex:none}
.gw-shell-brand{display:inline-flex;align-items:center;gap:11px;flex:none;min-height:var(--gw-tap-min);text-decoration:none;color:var(--gw-text)}
.gw-shell-logo{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:var(--gw-text);color:var(--gw-page-bg);font-weight:800;font-size:15px;letter-spacing:-.5px;flex:none}
.gw-shell-wordmark{display:flex;flex-direction:column;line-height:1.05}
.gw-shell-wordmark b{font-size:16.5px;font-weight:800;letter-spacing:.2px}
.gw-shell-wordmark span{font-size:11px;color:var(--gw-text-muted);font-weight:600;letter-spacing:3.4px}
.gw-shell-wordmark .gw-shell-ai{display:block;margin-top:3px;color:var(--gw-accent);font:800 9px/1.05 var(--gw-font);letter-spacing:1.35px;white-space:nowrap;cursor:help}
.gw-shell-location{display:inline-flex;align-items:center;gap:8px;flex:none;min-height:var(--gw-tap-min);padding:7px 14px;color:var(--gw-text-secondary);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);font:700 var(--gw-text-badge)/1 var(--gw-font);text-decoration:none}
.gw-shell-location:hover{border-color:var(--gw-accent);color:var(--gw-text)}
.gw-shell-location-dot{width:8px;height:8px;border-radius:50%;background:var(--gw-level-town);flex:none}
.gw-shell-location-copy{display:grid;gap:1px;min-width:0}
.gw-shell-location-primary{white-space:nowrap}
.gw-shell-location-saved{display:block;max-width:190px;overflow:hidden;color:var(--gw-text-muted);font-size:10px;font-weight:600;line-height:1.15;text-overflow:ellipsis;white-space:nowrap}
.gw-shell-location-arrow{color:var(--gw-text-muted);font-size:18px;line-height:1}
.gw-shell-search{position:relative;display:flex;align-items:center;gap:10px;flex:1 1 280px;max-width:560px;min-width:220px;min-height:var(--gw-tap-min);padding:0 10px;background:var(--gw-surface-subtle);border:var(--gw-border-w) solid var(--gw-border);border-radius:10px;color:var(--gw-text-muted)}
.gw-shell-search>.gw-info-note{margin-left:auto}
.gw-shell-search:focus-within{border-color:var(--gw-accent);outline:2px solid var(--gw-accent);outline-offset:1px}
.gw-shell-search-submit{appearance:none;display:inline-flex;align-items:center;justify-content:center;min-width:var(--gw-tap-min);min-height:var(--gw-tap-min);border:0;background:transparent;color:var(--gw-text-muted);font:700 18px/1 var(--gw-font);padding:6px;cursor:pointer}
.gw-shell-search-submit:hover{color:var(--gw-accent)}
.gw-shell-search-submit:focus-visible{outline:2px solid var(--gw-accent);outline-offset:1px;border-radius:var(--gw-radius-sm)}
.gw-shell-search-input{flex:1;min-width:0;width:100%;border:0;outline:0;background:transparent;color:var(--gw-text);font:500 var(--gw-text-badge)/1.3 var(--gw-font)}
.gw-shell-search-input::placeholder{color:var(--gw-text-muted);opacity:1}
.gw-shell-search-input::-webkit-search-cancel-button{cursor:pointer}
.gw-shell-search-shortcut{flex:none;border:var(--gw-border-w) solid var(--gw-border);border-radius:5px;padding:2px 6px;background:transparent;color:var(--gw-text-muted);font:500 10.5px/1.2 var(--gw-font-mono)}
.gw-shell-actions{margin-left:auto;display:flex;align-items:center;gap:10px;flex:none}
/* Header controls for the two non-tab surfaces (GOV-1520 MOTY eight-tab IA). */
.gw-shell-demo{display:inline-flex;align-items:center;flex:none;min-height:var(--gw-tap-min);padding:5px 12px;border:var(--gw-border-w) solid var(--gw-accent);border-radius:var(--gw-radius-pill);color:var(--gw-accent);font:700 var(--gw-text-badge)/1 var(--gw-font);text-decoration:none;white-space:nowrap}
.gw-shell-demo:hover{background:var(--gw-surface-accent-tint)}
.gw-shell-demo:focus-visible{outline:3px solid var(--gw-accent);outline-offset:3px}
.gw-shell-alerts{position:relative;display:inline-flex;align-items:center;flex:none;min-height:var(--gw-tap-min);padding:5px 12px;border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);color:var(--gw-text-secondary);font:700 var(--gw-text-badge)/1 var(--gw-font);text-decoration:none;white-space:nowrap}
.gw-shell-alerts:hover{border-color:var(--gw-accent);color:var(--gw-text)}
.gw-shell-alerts:focus-visible{outline:3px solid var(--gw-accent);outline-offset:3px}
.gw-shell-alerts[aria-current="page"]{border-color:var(--gw-accent);color:var(--gw-text);background:var(--gw-surface-accent-tint)}
.gw-shell-alerts-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;padding:0 5px;border-radius:var(--gw-radius-pill);background:var(--gw-stop-text);color:var(--gw-page-bg);font:800 var(--gw-text-badge)/1 var(--gw-font)}
.gw-shell-account{display:inline-flex;align-items:center;gap:8px;min-height:var(--gw-tap-min);padding:5px 10px;border:var(--gw-border-w) solid var(--gw-border);border-radius:9px;color:var(--gw-text-secondary);font-family:var(--gw-font);cursor:help}
.gw-shell-account:focus-visible{outline:3px solid var(--gw-accent);outline-offset:3px}
.gw-shell-account-dot{width:8px;height:8px;border-radius:50%;background:var(--gw-accent);flex:none}
.gw-shell-account-copy{display:flex;flex-direction:column;line-height:1.1}
.gw-shell-account-copy b{font-size:11px;letter-spacing:.65px}
.gw-shell-account-copy small{margin-top:2px;color:var(--gw-text-muted);font-size:10.5px}
.gw-shell-mode{display:inline-flex;flex:none;background:var(--gw-surface-well);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);padding:2px}
.gw-shell-mode-btn{appearance:none;border:0;background:transparent;color:var(--gw-text-muted);font:700 var(--gw-text-badge)/1 var(--gw-font);min-height:var(--gw-tap-min);padding:7px 15px;border-radius:var(--gw-radius-pill);cursor:pointer}
.gw-shell-mode-btn:hover{color:var(--gw-text)}
.gw-shell-mode-btn[aria-pressed="true"]{background:var(--gw-accent);color:var(--gw-accent-text-on)}
.gw-shell-print{appearance:none;min-height:var(--gw-tap-min);padding:6px 13px;border:1.5px solid var(--gw-rule-strong);border-radius:8px;background:transparent;color:var(--gw-text);font:700 var(--gw-text-badge)/1 var(--gw-font);cursor:pointer}
.gw-shell-print:hover{background:var(--gw-surface-well)}
.gw-shell-mode-btn:focus-visible,.gw-shell-location:focus-visible,.gw-shell-brand:focus-visible,.gw-shell-tab:focus-visible,.gw-shell-print:focus-visible,.gw-shell-footer-links a:focus-visible{outline:2px solid var(--gw-accent);outline-offset:2px}
.gw-shell-simple-utility,.gw-shell-simple-masthead,.gw-shell-simple-tools{width:calc(100% - 56px);max-width:1404px;margin:0 auto}
.gw-shell-simple-utility{display:flex;align-items:center;justify-content:space-between;gap:12px 20px;padding:8px 0;border-bottom:var(--gw-border-w) solid var(--gw-border);font-family:var(--gw-font)}
.gw-shell-simple-place{display:flex;align-items:center;gap:12px;min-width:0}
.gw-shell-simple-place time{color:var(--gw-text-secondary);font-size:12px;font-weight:600;white-space:nowrap}
.gw-shell-simple-utility .gw-shell-location{min-height:var(--gw-tap-min);padding:4px 0;border:0;border-radius:0;color:var(--gw-text-secondary)}
.gw-shell-simple-utility .gw-shell-location:hover{text-decoration:underline;text-underline-offset:3px}
.gw-shell-simple-utility .gw-shell-actions{justify-content:flex-end}
.gw-shell-simple-masthead{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(180px,.36fr);align-items:center;gap:24px;padding:13px 0 12px;text-align:center;border-bottom:3px double var(--gw-rule-strong)}
.gw-shell-simple-masthead .gw-shell-brand{text-align:left}
.gw-shell-simple-masthead .gw-shell-logo{background:var(--gw-accent);color:var(--gw-accent-text-on)}
.gw-shell-simple-headline{min-width:0}
.gw-shell-simple-quote{margin:0;color:var(--gw-text-secondary);font:italic 500 14px/1.35 var(--gw-font-serif);text-align:right}
.gw-shell-simple-tools{display:flex;align-items:center;gap:18px;padding:8px 0;border-bottom:var(--gw-border-w) solid var(--gw-rule-strong);font-family:var(--gw-font)}
.gw-shell-simple-tools-label{flex:none;color:var(--gw-text-secondary);font-size:12px;font-weight:700;letter-spacing:.25px}
.gw-shell-simple-tools .gw-shell-search{margin-left:auto;max-width:520px;background:var(--gw-surface-subtle)}
.gw-shell-tabs{display:flex;align-items:stretch;gap:30px;max-width:1460px;margin:0 auto;padding:0 28px;overflow-x:auto;scrollbar-width:none;font-family:var(--gw-font)}
.gw-shell-tabs>.gw-info-note{align-self:center;margin-left:auto}
.gw-shell-tabs::-webkit-scrollbar{display:none}
.gw-shell-tab{display:inline-flex;align-items:center;flex:none;min-height:var(--gw-tap-min);padding:4px 2px 9px;color:var(--gw-text-muted);border-bottom:2px solid transparent;font-size:13.5px;font-weight:600;text-decoration:none;white-space:nowrap}
.gw-shell-tab:hover{color:var(--gw-text)}
.gw-shell-tab[aria-current="page"]{color:var(--gw-accent);border-bottom-color:var(--gw-accent)}
.gw-shell-content{flex:1 0 auto;width:100%;max-width:1460px;margin:0 auto;padding:18px 28px 34px}
.gw-shell-footer{width:calc(100% - 56px);max-width:1404px;margin:0 auto;padding:14px 0;border-top:var(--gw-border-w) solid var(--gw-border-subtle);display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px 24px;color:var(--gw-text-muted);font-size:12px}
.gw-shell-footer-brand{display:flex;align-items:baseline;flex-wrap:wrap;gap:5px 14px}
.gw-shell-tagline{color:var(--gw-text-secondary)}
.gw-shell-preview-note{font-style:italic}
.gw-shell-refreshed{grid-column:1/-1;font-family:var(--gw-font-mono);font-size:11px;color:var(--gw-text-muted)}
.gw-shell-footer-links{display:flex;align-items:center;justify-content:flex-end;gap:16px;font-family:var(--gw-font)}
.gw-shell-footer-links a{display:inline-flex;align-items:center;min-height:var(--gw-tap-min);color:var(--gw-text-secondary);font-weight:600;text-decoration:none}
.gw-shell-footer-links a:hover{text-decoration:underline;text-underline-offset:3px}
.gw-shell-root[data-mode="simple"] .gw-shell-header{position:relative;border-top:2px solid var(--gw-rule-strong);border-bottom:2px solid var(--gw-rule-strong)}
.gw-shell-simple-title{font:600 var(--gw-text-display)/1 var(--gw-font-serif);letter-spacing:-.5px}
.gw-shell-simple-deck{margin-top:8px;color:var(--gw-text-secondary);font:700 12px/1.4 var(--gw-font);letter-spacing:1.2px}
.gw-shell-root[data-mode="simple"] .gw-shell-tabs{justify-content:center;gap:24px;max-width:1404px;padding:0;border-bottom:var(--gw-border-w) solid var(--gw-rule-strong)}
.gw-shell-root[data-mode="simple"] .gw-shell-tab{padding:5px 0 6px;color:var(--gw-text-secondary);font-size:12.5px;font-weight:700;letter-spacing:.45px;text-transform:uppercase;border-bottom-width:2px}
.gw-shell-root[data-mode="simple"] .gw-shell-tab[aria-current="page"]{color:var(--gw-text);border-bottom-color:var(--gw-rule-strong)}
.gw-shell-root[data-mode="simple"] .gw-shell-content{max-width:1218px;background:var(--gw-header-bg);border-left:var(--gw-border-w) solid var(--gw-border-subtle);border-right:var(--gw-border-w) solid var(--gw-border-subtle);padding-left:38px;padding-right:38px}
.gw-shell-root[data-mode="simple"] .gw-shell-footer{max-width:1142px;border-top:3px double var(--gw-rule-strong);font-family:var(--gw-font-serif);font-size:13px}
@media (max-width:1240px){
  .gw-shell-bar{flex-wrap:wrap}
  .gw-shell-search{order:3;max-width:none;flex-basis:100%}
  .gw-shell-actions{margin-left:auto}
  .gw-shell-root[data-mode="simple"] .gw-shell-tabs{margin-left:28px;margin-right:28px}
  .gw-shell-simple-masthead{grid-template-columns:auto minmax(0,1fr)}
  .gw-shell-simple-quote{display:none}
}
@media (max-width:900px){
  .gw-shell-simple-utility{align-items:stretch;flex-direction:column}
  .gw-shell-simple-place,.gw-shell-simple-utility .gw-shell-actions{justify-content:space-between}
  .gw-shell-simple-utility .gw-shell-actions{margin-left:0;overflow-x:auto;padding-bottom:2px}
  .gw-shell-simple-tools{display:block}
  .gw-shell-simple-tools-label{display:block;margin-bottom:7px}
  .gw-shell-simple-tools .gw-shell-search{margin:0;max-width:none}
  .gw-shell-root[data-mode="simple"] .gw-shell-tabs{justify-content:flex-start}
}
@media (max-width:760px){
  .gw-shell-bar{padding:10px 14px;gap:10px}
  .gw-shell-wordmark b{font-size:14px}
  .gw-shell-wordmark span{font-size:10px;letter-spacing:2.6px}
  .gw-shell-location-control{order:2}
  .gw-shell-location{padding:6px 10px}
  .gw-shell-search{order:4;flex-basis:100%;min-width:0}
  .gw-shell-actions{order:3;width:100%;max-width:100%;margin-left:0;justify-content:space-between;gap:6px;overflow-x:auto;overflow-y:hidden}
  .gw-shell-account{padding:4px 8px}
  .gw-shell-account-copy small{display:none}
  .gw-shell-mode-btn{padding-left:10px;padding-right:10px}
  .gw-shell-simple-utility,.gw-shell-simple-masthead,.gw-shell-simple-tools{width:calc(100% - 28px)}
  .gw-shell-simple-utility{align-items:stretch;flex-direction:column;padding:7px 0}
  .gw-shell-simple-place,.gw-shell-simple-utility .gw-shell-actions{justify-content:space-between;gap:8px}
  .gw-shell-simple-utility .gw-shell-actions{overflow-x:auto;padding-bottom:2px}
  .gw-shell-simple-masthead{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;padding:10px 0;text-align:left}
  .gw-shell-simple-headline{text-align:left}
  .gw-shell-simple-title{font-size:clamp(1.45rem,7vw,2.1rem)}
  .gw-shell-simple-deck{font-size:10px;letter-spacing:.75px}
  .gw-shell-simple-tools{display:block;padding:8px 0}
  .gw-shell-simple-tools-label{display:block;margin-bottom:7px}
  .gw-shell-simple-tools .gw-shell-search{margin:0;max-width:none}
  .gw-shell-tabs,.gw-shell-root[data-mode="simple"] .gw-shell-tabs{position:fixed;bottom:0;left:0;right:0;z-index:60;justify-content:flex-start;max-width:none;margin:0;padding:0 8px env(safe-area-inset-bottom);gap:0;background:var(--gw-header-bg);border-top:var(--gw-border-w) solid var(--gw-border);border-bottom:0;overflow-x:auto}
  .gw-shell-tabs>.gw-info-note{margin-left:0;min-width:var(--gw-tap-min);justify-content:center}
  .gw-shell-tab,.gw-shell-root[data-mode="simple"] .gw-shell-tab{flex:0 0 auto;justify-content:center;min-width:96px;min-height:var(--gw-tap-min);padding:4px 10px;border-top:2px solid transparent;border-bottom:0;font-size:12px;letter-spacing:0;text-transform:none}
  .gw-shell-tab[aria-current="page"],.gw-shell-root[data-mode="simple"] .gw-shell-tab[aria-current="page"]{border-top-color:var(--gw-accent);border-bottom-color:transparent;color:var(--gw-accent)}
  .gw-shell-content,.gw-shell-root[data-mode="simple"] .gw-shell-content{padding:14px 14px calc(var(--gw-tap-min) + 28px);border:0}
  .gw-shell-footer,.gw-shell-root[data-mode="simple"] .gw-shell-footer{width:calc(100% - 28px);grid-template-columns:1fr;padding-bottom:calc(var(--gw-tap-min) + 14px)}
  .gw-shell-footer-links{justify-content:flex-start}
  .gw-shell-refreshed{grid-column:auto}
  .gw-theme-toggle{bottom:calc(var(--gw-tap-min) + var(--gw-space-4))!important}
}
@media (max-width:430px){
  .gw-shell-logo{width:34px;height:34px}
  .gw-shell-wordmark .gw-shell-ai{font-size:8px;letter-spacing:1px}
  .gw-shell-location{font-size:12px}
  .gw-shell-account-copy b{font-size:10px}
  .gw-shell-search-shortcut{display:none}
  .gw-shell-simple-place time{font-size:10.5px}
  .gw-shell-actions,.gw-shell-simple-utility .gw-shell-actions{justify-content:flex-start;flex-wrap:wrap;overflow:visible}
  .gw-shell-simple-masthead{grid-template-columns:1fr;align-items:start}
  .gw-shell-simple-headline{width:100%}
}
`;

const SHELL_STYLE_ID = 'gw-shell-style';
function ensureShellStyle(): void {
  if (document.getElementById(SHELL_STYLE_ID)) return;
  document.head.append(el('style', { id: SHELL_STYLE_ID }, [SHELL_STYLE]));
}
