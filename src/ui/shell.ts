/**
 * GOV-658 (GOV-654 leg 2/5) — persistent app shell + navigation (spec §5).
 *
 * Today each gated surface renders its own ad-hoc header and navigation is by
 * in-page hash links. This module wraps every gated surface in ONE persistent
 * chrome: a header (GW brand → home, static Alpine jurisdiction pill, a
 * Simple|Advanced reading-mode control), a data-driven tab row over the shipped
 * routes, and a footer. The surface itself renders unchanged into an inner
 * content slot returned by {@link renderShell} — so §7's "intentionally untouched"
 * surface internals stay byte-identical; only their container is new.
 *
 * Hard invariants preserved (spec §3 / §5.2):
 *  - The shell renders ONLY inside the gate — `main.ts`'s `gated()` calls this
 *    exclusively in the approved branch. The `#/` gated landing keeps its own
 *    standalone layout and NEVER shows app nav to unauthenticated visitors.
 *  - No dead nav: the tab row lists ONLY shipped routes (spec §5.1 "built
 *    data-driven so follow-up chains add tabs without shell rework"; §10 failure
 *    list bans dead nav tabs). The Home tab lands with the Home dashboard (§6),
 *    while future IA pages stay absent until their routes exist.
 *  - No fake controls: Search (§5.1.3) and Alerts (§5.1.4) are NOT rendered (no
 *    index / no alert pipeline exists — a disabled fake violates honesty). The
 *    jurisdiction pill is a STATIC label (Alpine-only stage; no dropdown, no `▾`).
 *  - Footer `data refreshed` stamp renders ONLY when a real projection timestamp
 *    is supplied — never a fake clock (spec §5.2 / §6.3).
 *
 * Reading mode (spec §1): Simple|Advanced is an audience/density axis that, in
 * this chain, drives the palette — Advanced→dark, Simple→light — by routing
 * through the ONE palette authority ({@link setThemePref}), so it shares the
 * stored theme value with the standalone System/Dark/Light override (which still
 * wins as the explicit control, §1.4). Per-page Simple *layouts* are follow-up
 * work (§9); here the mode control sets the palette and records the mode.
 */

import { GW_TOKENS } from './tokens';
import { setThemePref, applyThemePref, hasExplicitThemePref } from './theme-toggle';

export type ShellMode = 'simple' | 'advanced';

/** Shared per-user reading mode (spec §1 — persisted, shell-wide). */
const MODE_KEY = 'gw_home_mode';

/** One shipped nav tab. `route` is the hash path (without `#`). */
interface NavTab {
  /** hash route without the leading `#`, e.g. `/app` */
  route: string;
  label: string;
  /** other routes that should highlight this tab (context/alias pages, §5.1). */
  also?: string[];
}

/**
 * The tab row — SHIPPED surfaces only, in wireframe order where they exist
 * (spec §5.1). Home ships in this sub-leg; wireframe tabs Fast Agenda / Power
 * Tracker / Source Vault / Watchlist remain absent (their pages don't exist —
 * dead nav is dishonest UI).
 * `#/body` + `#/meeting` are context pages that highlight their parent tab.
 */
export const NAV_TABS: readonly NavTab[] = [
  { route: '/home', label: 'Home' },
  { route: '/app', label: 'Boards', also: ['/boards', '/body', '/meeting'] },
  { route: '/timeline', label: 'Timeline' },
  { route: '/cards', label: 'Cards' },
  { route: '/topics', label: 'Topics' },
  { route: '/newsletter', label: 'Newsletter' },
];

/** Brand click target: the first shipped tab (→ `#/home` once Home ships). */
const BRAND_ROUTE = NAV_TABS[0].route;

/** Editorial brand copy (spec §2.5 — treated as brand copy, not restyled away). */
const FOOTER_TAGLINE = '◆ Holding power accountable. Amplifying transparency.';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

/** Read the persisted reading mode, defaulting to Advanced (spec §1). */
export function readMode(): ShellMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === 'simple' || v === 'advanced') return v;
  } catch {
    /* storage unavailable (private mode / non-browser) — fall back to default */
  }
  return 'advanced';
}

function persistMode(mode: ShellMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* non-fatal: the in-session shell state still reflects the choice */
  }
}

/**
 * Apply a reading mode: record it and drive the palette through the single theme
 * authority (advanced→dark, simple→light). Called on explicit mode clicks — an
 * explicit user action, so it wins over a prior OS/theme preference (§1.4), while
 * the standalone System/Dark/Light toggle remains available to re-override.
 */
export function applyMode(mode: ShellMode): void {
  persistMode(mode);
  setThemePref(mode === 'advanced' ? 'dark' : 'light');
}

/**
 * Keep the palette coherent with the reading mode WITHOUT overriding an explicit
 * theme pin. On shell render, if the user has never used the standalone
 * System/Dark/Light control, the reading mode drives the palette (Advanced→dark
 * is the default look Isaac drew, §1/§10) — applied but NOT persisted, so an
 * OS-dark user who later picks "System" is still respected. Once any explicit
 * theme is pinned (§1.4), this is a no-op and the pin wins.
 */
function syncPaletteToMode(mode: ShellMode): void {
  if (hasExplicitThemePref()) return;
  applyThemePref(mode === 'advanced' ? 'dark' : 'light');
}

/** True when `path` should light up `tab` (its own route or a context alias). */
function isActive(tab: NavTab, path: string): boolean {
  return tab.route === path || (tab.also?.includes(path) ?? false);
}

function brand(): HTMLElement {
  return el('a', { class: 'gw-shell-brand', href: `#${BRAND_ROUTE}`, 'data-test': 'shell-brand' }, [
    el('span', { class: 'gw-shell-logo', 'aria-hidden': 'true' }, ['GW']),
    el('span', { class: 'gw-shell-wordmark' }, [
      el('b', {}, ['Government']),
      el('span', {}, ['Watchdog']),
    ]),
  ]);
}

/** Static jurisdiction label — no dropdown affordance (Alpine-only stage, §5.1). */
function jurisdictionPill(): HTMLElement {
  return el('span', { class: 'gw-shell-juris', 'data-test': 'shell-jurisdiction' }, [
    el('span', { class: 'gw-shell-juris-dot', 'aria-hidden': 'true' }, []),
    'Alpine, WY',
  ]);
}

function modeToggle(mode: ShellMode): HTMLElement {
  const group = el('div', {
    class: 'gw-shell-mode',
    role: 'group',
    'aria-label': 'Reading mode',
    'data-test': 'mode-toggle',
    'data-mode': mode,
  });
  const opts: { val: ShellMode; label: string }[] = [
    { val: 'simple', label: 'Simple' },
    { val: 'advanced', label: 'Advanced' },
  ];
  for (const { val, label } of opts) {
    const selected = val === mode;
    const btn = el(
      'button',
      {
        type: 'button',
        class: 'gw-shell-mode-btn',
        'data-mode-val': val,
        'data-test': `mode-${val}`,
        'aria-pressed': selected ? 'true' : 'false',
      },
      [label],
    );
    btn.addEventListener('click', () => {
      // Always apply: a click is an explicit choice (it pins the palette even when
      // the mode label already matched but the palette was only mode-synced).
      applyMode(val);
      // Re-dispatch the current route so the shell (and, later, Home's layout)
      // re-renders under the new mode without a full reload.
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    group.append(btn);
  }
  return group;
}

function tabRow(path: string): HTMLElement {
  const nav = el('nav', { class: 'gw-shell-tabs', 'aria-label': 'Primary', 'data-test': 'shell-tabs' });
  for (const tab of NAV_TABS) {
    const active = isActive(tab, path);
    const attrs: Record<string, string> = {
      class: 'gw-shell-tab',
      href: `#${tab.route}`,
      'data-test': `tab-${tab.label.toLowerCase()}`,
    };
    if (active) attrs['aria-current'] = 'page';
    nav.append(el('a', attrs, [tab.label]));
  }
  return nav;
}

function footer(refreshedAt?: string): HTMLElement {
  const children: (Node | string)[] = [
    el('span', { class: 'gw-shell-tagline', 'data-test': 'shell-tagline' }, [FOOTER_TAGLINE]),
  ];
  // Real projection timestamp only — omitted entirely when absent (never faked).
  if (refreshedAt) {
    children.push(
      el('span', { class: 'gw-shell-refreshed', 'data-test': 'shell-refreshed' }, [`data refreshed ${refreshedAt}`]),
    );
  }
  return el('footer', { class: 'gw-shell-footer', 'data-test': 'shell-footer' }, children);
}

export interface ShellOptions {
  /** current route path (without `#`) — drives the active tab. */
  active: string;
  /** current reading mode; defaults to {@link readMode}. */
  mode?: ShellMode;
  /** real projection-generation timestamp for the footer stamp (never faked). */
  refreshedAt?: string;
}

/**
 * Render the persistent shell into `root` (replacing its contents) and return the
 * inner content slot the surface should render into. The surface's own renderer
 * (`render`, `renderBoards`, …) may freely `replaceChildren`/reset the slot's
 * className — the styled `<main>` container around it keeps the shell layout.
 *
 * A topmost banner slot sits ABOVE the header (spec §5.2) for surfaces that carry
 * a fixture/DEV banner; it is left empty here (surfaces still render their own
 * in-content notices this slice — no duplicate, no fake banner).
 */
export function renderShell(root: HTMLElement, opts: ShellOptions): HTMLElement {
  ensureShellStyle();
  const mode = opts.mode ?? readMode();
  // Coherent default: reading mode drives the palette unless a theme is pinned.
  syncPaletteToMode(mode);

  root.className = 'gw-shell-root';
  root.replaceChildren();

  const slot = el('div', { class: 'gw-shell-slot', 'data-test': 'shell-content' });

  root.append(
    el('div', { class: 'gw-shell-banner-slot', 'data-test': 'shell-banner-slot' }, []),
    el('header', { class: 'gw-shell-header', 'data-test': 'app-shell', 'data-mode': mode }, [
      el('div', { class: 'gw-shell-bar' }, [brand(), jurisdictionPill(), modeToggle(mode)]),
      tabRow(opts.active),
    ]),
    el('main', { class: 'gw-shell-content' }, [slot]),
    footer(opts.refreshedAt),
  );

  return slot;
}

/**
 * Shell styles — token-driven (inherits the §2 palette + §2.3 font stack), so the
 * shell adopts Advanced (dark) / Simple (light) with the rest of the app. No raw
 * hex; every colour is a `var(--gw-*)`. Elevation is shadow-free (surface steps +
 * border ladder, spec §2.4). Responsive collapse per §4: the top tab row becomes
 * a fixed bottom tab bar on mobile (≤640px), 5 equal ≥44px slots (the shipped tab
 * count fits without a "More" overflow until Home makes it 6, §5.1).
 */
export const SHELL_STYLE = `${GW_TOKENS}
.gw-shell-root{font-family:var(--gw-font);color:var(--gw-text);background:var(--gw-page-bg);min-height:100vh;display:flex;flex-direction:column;margin:0}
.gw-shell-banner-slot:empty{display:none}
.gw-shell-header{position:sticky;top:0;z-index:20;background:var(--gw-header-bg);border-bottom:var(--gw-border-w) solid var(--gw-border)}
.gw-shell-bar{display:flex;align-items:center;gap:var(--gw-space-5);max-width:1460px;margin:0 auto;padding:var(--gw-space-3) var(--gw-space-5)}
.gw-shell-brand{display:inline-flex;align-items:center;gap:var(--gw-space-3);text-decoration:none;color:var(--gw-text)}
.gw-shell-logo{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:var(--gw-accent);color:var(--gw-accent-text-on);font-weight:800;font-size:15px;letter-spacing:.5px;flex:0 0 auto}
.gw-shell-wordmark{display:flex;flex-direction:column;line-height:1.05}
.gw-shell-wordmark b{font-size:var(--gw-text-body);font-weight:800}
.gw-shell-wordmark span{font-size:var(--gw-text-sm);color:var(--gw-text-secondary);text-transform:uppercase;letter-spacing:1px}
.gw-shell-juris{display:inline-flex;align-items:center;gap:var(--gw-space-2);font-size:var(--gw-text-badge);font-weight:600;color:var(--gw-text-secondary);background:var(--gw-surface-subtle);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);padding:.3rem var(--gw-space-4)}
.gw-shell-juris-dot{width:8px;height:8px;border-radius:50%;background:var(--gw-level-town)}
.gw-shell-mode{margin-left:auto;display:inline-flex;background:var(--gw-surface-well);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);padding:2px}
.gw-shell-mode-btn{appearance:none;border:0;background:transparent;color:var(--gw-text-secondary);font:600 var(--gw-text-badge)/1 var(--gw-font);min-height:calc(var(--gw-tap-min) - 8px);padding:.35rem var(--gw-space-4);border-radius:var(--gw-radius-pill);cursor:pointer}
.gw-shell-mode-btn[aria-pressed="true"]{background:var(--gw-accent);color:var(--gw-accent-text-on)}
.gw-shell-mode-btn:focus-visible{outline:2px solid var(--gw-accent);outline-offset:2px}
.gw-shell-tabs{display:flex;gap:var(--gw-space-2);max-width:1460px;margin:0 auto;padding:0 var(--gw-space-5);overflow-x:auto;scrollbar-width:none}
.gw-shell-tabs::-webkit-scrollbar{display:none}
.gw-shell-tab{display:inline-flex;align-items:center;min-height:var(--gw-tap-min);padding:0 var(--gw-space-4);font-size:var(--gw-text-body);font-weight:600;color:var(--gw-text-secondary);text-decoration:none;border-bottom:2px solid transparent;white-space:nowrap}
.gw-shell-tab:hover{color:var(--gw-text)}
.gw-shell-tab[aria-current="page"]{color:var(--gw-accent);border-bottom-color:var(--gw-accent)}
.gw-shell-tab:focus-visible{outline:2px solid var(--gw-accent);outline-offset:-2px}
.gw-shell-content{flex:1 0 auto;width:100%;max-width:1460px;margin:0 auto;padding:var(--gw-space-5)}
.gw-shell-footer{border-top:var(--gw-border-w) solid var(--gw-border);background:var(--gw-header-bg);color:var(--gw-text-secondary);max-width:1460px;margin:0 auto;width:100%;box-sizing:border-box;padding:var(--gw-space-4) var(--gw-space-5);display:flex;flex-wrap:wrap;gap:var(--gw-space-4);align-items:center;justify-content:space-between}
.gw-shell-tagline{font-size:var(--gw-text-sm)}
.gw-shell-refreshed{font-family:var(--gw-font-mono);font-size:var(--gw-text-xs);color:var(--gw-text-muted)}
@media (max-width:640px){
  .gw-shell-bar{flex-wrap:wrap;gap:var(--gw-space-3)}
  .gw-shell-mode{margin-left:auto}
  /* z-index above the standalone theme toggle (z-50) so the primary bottom nav is
     never obscured on mobile. Reconciling that toggle's placement into a shell
     settings row is follow-up polish (spec §5.1 — mode toggle is the primary
     affordance; explicit System/Dark/Light override relocates later). */
  .gw-shell-tabs{position:fixed;bottom:0;left:0;right:0;z-index:60;max-width:none;margin:0;padding:0;background:var(--gw-header-bg);border-top:var(--gw-border-w) solid var(--gw-border);gap:0}
  .gw-shell-tab{flex:1 1 0;justify-content:center;min-width:0;padding:0 var(--gw-space-1);font-size:var(--gw-text-sm);border-bottom:0;border-top:2px solid transparent}
  .gw-shell-tab[aria-current="page"]{border-bottom-color:transparent;border-top-color:var(--gw-accent)}
  .gw-shell-content{padding-bottom:calc(var(--gw-tap-min) + var(--gw-space-5))}
  /* Lift the standalone System/Dark/Light toggle clear of the fixed bottom nav so
     neither obscures the other on mobile (it inline-styles bottom:.75rem; the
     class rule + !important wins). Relocating it into a shell settings row is the
     follow-up (spec §5.1). */
  .gw-theme-toggle{bottom:calc(var(--gw-tap-min) + var(--gw-space-4)) !important}
}
`;

let styleInjected = false;
function ensureShellStyle(): void {
  if (styleInjected) return;
  document.head.append(el('style', {}, [SHELL_STYLE]));
  styleInjected = true;
}
