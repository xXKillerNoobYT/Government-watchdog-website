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
 *    server/fixture response contract without recomputing unread state.
 *  - AI analysis is disclosed as machine-generated and source-verification is
 *    repeated in the footer.
 *  - a refreshed timestamp is shown only when the caller supplies a real one.
 */

import { GW_TOKENS } from './tokens';
import { setThemePref, applyThemePref, hasExplicitThemePref } from './theme-toggle';
import { mountNotificationPanel } from './notification-panel';

export type ShellMode = 'simple' | 'advanced';

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
const FOOTER_TAGLINE = '◆ Holding power accountable. Amplifying transparency.';
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

/** Read the persisted reading mode, defaulting to the dense Advanced view. */
export function readMode(): ShellMode {
  try {
    const value = localStorage.getItem(MODE_KEY);
    if (value === 'simple' || value === 'advanced') return value;
  } catch {
    /* Storage can be unavailable in private/non-browser contexts. */
  }
  return 'advanced';
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
    'aria-label': 'Government Watchdog home',
    'data-test': 'shell-brand',
  }, [
    el('span', { class: 'gw-shell-logo', 'aria-hidden': 'true' }, ['GW']),
    el('span', { class: 'gw-shell-wordmark', 'aria-hidden': 'true' }, [
      el('b', {}, ['GOVERNMENT']),
      el('span', {}, ['WATCHDOG']),
    ]),
  ]);
}

/** Disclosure, not a certification or a claim that a human reviewed the output. */
function aiDisclosure(): HTMLSpanElement {
  return el('span', {
    class: 'gw-shell-ai',
    'data-test': 'shell-ai-disclosure',
    title: AI_DISCLOSURE,
    'aria-label': `AI analysis disclosure. ${AI_DISCLOSURE}`,
  }, ['AI ANALYSIS']);
}

/** A real route link; the location screen owns any later picker behavior. */
function locationLink(): HTMLAnchorElement {
  let locationLabel = 'Alpine, WY';
  try {
    const stored = JSON.parse(localStorage.getItem('gw_location') ?? 'null') as {
      town?: unknown;
      state?: unknown;
    } | null;
    const town = typeof stored?.town === 'string' ? stored.town.trim() : '';
    const state = typeof stored?.state === 'string' ? stored.state.trim() : '';
    if (town && state) locationLabel = `${town}, ${state}`;
    else if (state) locationLabel = state;
  } catch {
    /* Invalid preview storage falls back to the known Alpine design location. */
  }
  return el('a', {
    class: 'gw-shell-location',
    href: '#/location',
    title: 'Change your place',
    'aria-label': `Change location. Current preview location: ${locationLabel}.`,
    'data-test': 'shell-jurisdiction',
  }, [
    el('span', { class: 'gw-shell-location-dot', 'aria-hidden': 'true' }, []),
    el('span', {}, [locationLabel]),
    el('span', { class: 'gw-shell-location-arrow', 'aria-hidden': 'true' }, ['›']),
  ]);
}

function timelineSearchHash(query: string): string {
  return `#/timeline?search=${encodeURIComponent(query.trim())}&reviewer=1`;
}

function searchControl(): HTMLFormElement {
  const form = el('form', {
    class: 'gw-shell-search',
    role: 'search',
    'aria-label': 'Search Government Watchdog',
    'data-test': 'shell-search-form',
  });
  const label = el('label', { class: 'gw-shell-sr-only', for: 'gw-shell-search-input' }, [
    'Search agendas, meetings, documents, officials, and issues',
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
    placeholder: 'Search agendas, meetings, documents, officials, issues…',
    'data-test': 'shell-search',
  });
  const shortcut = el('kbd', {
    class: 'gw-shell-search-shortcut',
    'aria-hidden': 'true',
  }, ['⌘K']);

  form.append(label, submit, input, shortcut);
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

/** Preview identity label only; no auth, verification, or security claim. */
function accountChip(): HTMLSpanElement {
  return el('span', {
    class: 'gw-shell-account',
    'data-test': 'shell-account',
    title: 'Interface preview only. No verified identity is represented.',
    'aria-label': 'Preview account. Interface demo only; no verified identity is represented.',
  }, [
    el('span', { class: 'gw-shell-account-dot', 'aria-hidden': 'true' }, []),
    el('span', { class: 'gw-shell-account-copy' }, [
      el('b', {}, ['PREVIEW ACCOUNT']),
      el('small', {}, ['demo only']),
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
  return nav;
}

function simpleMasthead(): HTMLDivElement {
  return el('div', { class: 'gw-shell-simple-masthead', 'data-test': 'shell-simple-masthead' }, [
    el('div', { class: 'gw-shell-simple-title' }, ['Government Watchdog Updates']),
    el('div', { class: 'gw-shell-simple-deck' }, [
      'TOWN  /  COUNTY  /  STATE · A nonpartisan guide to what your government is doing',
    ]),
  ]);
}

function footer(refreshedAt?: string): HTMLElement {
  const children: (Node | string)[] = [
    el('span', { class: 'gw-shell-tagline', 'data-test': 'shell-tagline' }, [FOOTER_TAGLINE]),
    el('span', { class: 'gw-shell-preview-note', 'data-test': 'shell-preview-note' }, [
      'Preview interface · verify AI analysis against primary records.',
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

export interface ShellOptions {
  /** Current hash path without `#`; used only for primary-nav highlighting. */
  active: string;
  /** Current reading mode; defaults to the persisted `gw_home_mode` value. */
  mode?: ShellMode;
  /** Real projection-generation timestamp. Omitted means no stamp is rendered. */
  refreshedAt?: string;
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
  root.replaceChildren();

  const slot = el('div', { class: 'gw-shell-slot', 'data-test': 'shell-content' });
  // The server-authoritative notification panel replaces the handoff's synthetic
  // alert count while keeping the Account → Alerts → Mode action order.
  const actions = el('div', { class: 'gw-shell-actions' }, [accountChip()]);
  mountNotificationPanel(actions);
  actions.append(modeToggle(mode));

  root.append(
    el('div', { class: 'gw-shell-banner-slot', 'data-test': 'shell-banner-slot' }, []),
    el('header', { class: 'gw-shell-header', 'data-test': 'app-shell', 'data-mode': mode }, [
      el('div', { class: 'gw-shell-bar' }, [
        brand(),
        aiDisclosure(),
        locationLink(),
        searchControl(),
        actions,
      ]),
      simpleMasthead(),
      tabRow(opts.active),
    ]),
    el('main', { class: 'gw-shell-content' }, [slot]),
    footer(opts.refreshedAt),
  );

  return slot;
}

/** Token-mapped recreation of the handoff's Advanced and Simple shared chrome. */
export const SHELL_STYLE = `${GW_TOKENS}
.gw-shell-root,.gw-shell-root *{box-sizing:border-box}
.gw-shell-root{font-family:var(--gw-font);font-size:14px;line-height:var(--gw-leading);color:var(--gw-text);background:var(--gw-page-bg);min-height:100vh;display:flex;flex-direction:column;margin:0}
.gw-shell-root[data-mode="simple"]{font-family:var(--gw-font-serif);font-size:16px}
.gw-shell-banner-slot:empty{display:none}
.gw-shell-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.gw-shell-header{position:sticky;top:0;z-index:20;background:var(--gw-header-bg);border-bottom:var(--gw-border-w) solid var(--gw-border-subtle)}
.gw-shell-bar{display:flex;align-items:center;gap:18px;max-width:1460px;margin:0 auto;padding:14px 28px}
.gw-shell-brand{display:inline-flex;align-items:center;gap:11px;flex:none;text-decoration:none;color:var(--gw-text)}
.gw-shell-logo{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:var(--gw-text);color:var(--gw-page-bg);font-weight:800;font-size:15px;letter-spacing:-.5px;flex:none}
.gw-shell-wordmark{display:flex;flex-direction:column;line-height:1.05}
.gw-shell-wordmark b{font-size:16.5px;font-weight:800;letter-spacing:.2px}
.gw-shell-wordmark span{font-size:11px;color:var(--gw-text-muted);font-weight:600;letter-spacing:3.4px}
.gw-shell-ai{flex:none;font:800 11px/1 var(--gw-font);letter-spacing:.8px;color:var(--gw-info-text);border:var(--gw-border-w) solid var(--gw-tone-info-line);background:var(--gw-tone-info-well);border-radius:5px;padding:5px 8px;cursor:help}
.gw-shell-location{display:inline-flex;align-items:center;gap:8px;flex:none;min-height:var(--gw-tap-min);padding:7px 14px;color:var(--gw-text-secondary);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);font:700 var(--gw-text-badge)/1 var(--gw-font);text-decoration:none}
.gw-shell-location:hover{border-color:var(--gw-accent);color:var(--gw-text)}
.gw-shell-location-dot{width:8px;height:8px;border-radius:50%;background:var(--gw-level-town);flex:none}
.gw-shell-location-arrow{color:var(--gw-text-muted);font-size:18px;line-height:1}
.gw-shell-search{position:relative;display:flex;align-items:center;gap:10px;flex:1 1 280px;max-width:560px;min-width:220px;min-height:var(--gw-tap-min);padding:0 10px;background:var(--gw-surface-subtle);border:var(--gw-border-w) solid var(--gw-border);border-radius:10px;color:var(--gw-text-muted)}
.gw-shell-search:focus-within{border-color:var(--gw-accent);outline:2px solid var(--gw-accent);outline-offset:1px}
.gw-shell-search-submit{appearance:none;border:0;background:transparent;color:var(--gw-text-muted);font:700 18px/1 var(--gw-font);padding:6px;cursor:pointer}
.gw-shell-search-submit:hover{color:var(--gw-accent)}
.gw-shell-search-submit:focus-visible{outline:2px solid var(--gw-accent);outline-offset:1px;border-radius:var(--gw-radius-sm)}
.gw-shell-search-input{flex:1;min-width:0;width:100%;border:0;outline:0;background:transparent;color:var(--gw-text);font:500 var(--gw-text-badge)/1.3 var(--gw-font)}
.gw-shell-search-input::placeholder{color:var(--gw-text-muted);opacity:1}
.gw-shell-search-input::-webkit-search-cancel-button{cursor:pointer}
.gw-shell-search-shortcut{flex:none;border:var(--gw-border-w) solid var(--gw-border);border-radius:5px;padding:2px 6px;background:transparent;color:var(--gw-text-muted);font:500 10.5px/1.2 var(--gw-font-mono)}
.gw-shell-actions{margin-left:auto;display:flex;align-items:center;gap:10px;flex:none}
.gw-shell-account{display:inline-flex;align-items:center;gap:8px;min-height:var(--gw-tap-min);padding:5px 10px;border:var(--gw-border-w) solid var(--gw-border);border-radius:9px;color:var(--gw-text-secondary);font-family:var(--gw-font);cursor:help}
.gw-shell-account-dot{width:8px;height:8px;border-radius:50%;background:var(--gw-caution-text);flex:none}
.gw-shell-account-copy{display:flex;flex-direction:column;line-height:1.1}
.gw-shell-account-copy b{font-size:11px;letter-spacing:.65px}
.gw-shell-account-copy small{margin-top:2px;color:var(--gw-text-muted);font-size:10.5px}
.gw-shell-mode{display:inline-flex;flex:none;background:var(--gw-surface-well);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);padding:2px}
.gw-shell-mode-btn{appearance:none;border:0;background:transparent;color:var(--gw-text-muted);font:700 var(--gw-text-badge)/1 var(--gw-font);min-height:calc(var(--gw-tap-min) - 4px);padding:7px 15px;border-radius:var(--gw-radius-pill);cursor:pointer}
.gw-shell-mode-btn:hover{color:var(--gw-text)}
.gw-shell-mode-btn[aria-pressed="true"]{background:var(--gw-accent);color:var(--gw-accent-text-on)}
.gw-shell-mode-btn:focus-visible,.gw-shell-location:focus-visible,.gw-shell-brand:focus-visible,.gw-shell-tab:focus-visible{outline:2px solid var(--gw-accent);outline-offset:2px}
.gw-shell-simple-masthead{display:none}
.gw-shell-tabs{display:flex;align-items:stretch;gap:30px;max-width:1460px;margin:0 auto;padding:0 28px;overflow-x:auto;scrollbar-width:none;font-family:var(--gw-font)}
.gw-shell-tabs::-webkit-scrollbar{display:none}
.gw-shell-tab{display:inline-flex;align-items:center;flex:none;min-height:var(--gw-tap-min);padding:4px 2px 9px;color:var(--gw-text-muted);border-bottom:2px solid transparent;font-size:13.5px;font-weight:600;text-decoration:none;white-space:nowrap}
.gw-shell-tab:hover{color:var(--gw-text)}
.gw-shell-tab[aria-current="page"]{color:var(--gw-accent);border-bottom-color:var(--gw-accent)}
.gw-shell-content{flex:1 0 auto;width:100%;max-width:1460px;margin:0 auto;padding:18px 28px 34px}
.gw-shell-footer{width:calc(100% - 56px);max-width:1404px;margin:0 auto;padding:14px 0;border-top:var(--gw-border-w) solid var(--gw-border-subtle);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px;color:var(--gw-text-muted);font-size:12px}
.gw-shell-tagline{color:var(--gw-text-secondary)}
.gw-shell-preview-note{font-style:italic}
.gw-shell-refreshed{font-family:var(--gw-font-mono);font-size:11px;color:var(--gw-text-muted)}
.gw-shell-root[data-mode="simple"] .gw-shell-header{position:relative;border-top:2px solid var(--gw-rule-strong);border-bottom:2px solid var(--gw-rule-strong)}
.gw-shell-root[data-mode="simple"] .gw-shell-bar{padding-top:10px;padding-bottom:10px;border-bottom:var(--gw-border-w) solid var(--gw-border)}
.gw-shell-root[data-mode="simple"] .gw-shell-logo{background:var(--gw-accent);color:var(--gw-accent-text-on)}
.gw-shell-root[data-mode="simple"] .gw-shell-ai,.gw-shell-root[data-mode="simple"] .gw-shell-location,.gw-shell-root[data-mode="simple"] .gw-shell-search,.gw-shell-root[data-mode="simple"] .gw-shell-account,.gw-shell-root[data-mode="simple"] .gw-shell-mode{font-family:var(--gw-font)}
.gw-shell-root[data-mode="simple"] .gw-shell-simple-masthead{display:block;max-width:1404px;margin:0 auto;padding:12px 0 10px;text-align:center;border-bottom:var(--gw-border-w) solid var(--gw-rule-strong)}
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
  .gw-shell-root[data-mode="simple"] .gw-shell-simple-masthead,.gw-shell-root[data-mode="simple"] .gw-shell-tabs{margin-left:28px;margin-right:28px}
}
@media (max-width:760px){
  .gw-shell-bar{padding:10px 14px;gap:10px}
  .gw-shell-wordmark b{font-size:14px}
  .gw-shell-wordmark span{font-size:10px;letter-spacing:2.6px}
  .gw-shell-ai{margin-left:auto}
  .gw-shell-location{order:2;padding:6px 10px}
  .gw-shell-search{order:4;flex-basis:100%;min-width:0}
  .gw-shell-actions{order:3;width:100%;margin-left:0;justify-content:space-between;gap:6px}
  .gw-shell-account{padding:4px 8px}
  .gw-shell-account-copy small{display:none}
  .gw-shell-mode-btn{padding-left:10px;padding-right:10px}
  .gw-shell-simple-masthead{display:none!important}
  .gw-shell-tabs,.gw-shell-root[data-mode="simple"] .gw-shell-tabs{position:fixed;bottom:0;left:0;right:0;z-index:60;justify-content:flex-start;max-width:none;margin:0;padding:0 8px env(safe-area-inset-bottom);gap:0;background:var(--gw-header-bg);border-top:var(--gw-border-w) solid var(--gw-border);border-bottom:0;overflow-x:auto}
  .gw-shell-tab,.gw-shell-root[data-mode="simple"] .gw-shell-tab{flex:0 0 auto;justify-content:center;min-width:96px;min-height:var(--gw-tap-min);padding:4px 10px;border-top:2px solid transparent;border-bottom:0;font-size:12px;letter-spacing:0;text-transform:none}
  .gw-shell-tab[aria-current="page"],.gw-shell-root[data-mode="simple"] .gw-shell-tab[aria-current="page"]{border-top-color:var(--gw-accent);border-bottom-color:transparent;color:var(--gw-accent)}
  .gw-shell-content,.gw-shell-root[data-mode="simple"] .gw-shell-content{padding:14px 14px calc(var(--gw-tap-min) + 28px);border:0}
  .gw-shell-footer,.gw-shell-root[data-mode="simple"] .gw-shell-footer{width:calc(100% - 28px);padding-bottom:calc(var(--gw-tap-min) + 14px)}
  .gw-theme-toggle{bottom:calc(var(--gw-tap-min) + var(--gw-space-4))!important}
}
@media (max-width:430px){
  .gw-shell-logo{width:34px;height:34px}
  .gw-shell-ai{font-size:10px;padding:4px 6px}
  .gw-shell-location{font-size:12px}
  .gw-shell-account-copy b{font-size:10px}
  .gw-shell-search-shortcut{display:none}
}
`;

const SHELL_STYLE_ID = 'gw-shell-style';
function ensureShellStyle(): void {
  if (document.getElementById(SHELL_STYLE_ID)) return;
  document.head.append(el('style', { id: SHELL_STYLE_ID }, [SHELL_STYLE]));
}
