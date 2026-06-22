/**
 * GOV-440 — explicit theme toggle (GOV-438 §11.4 trigger model).
 *
 * Light is the default; `@media (prefers-color-scheme: dark)` auto-darkens for
 * OS-dark users (handled entirely in the CSS token layer, `tokens.ts`). This
 * control adds the EXPLICIT override: it sets `data-theme` on the root element,
 * and because `:root[data-theme="…"]` outranks the `@media` block, the toggle
 * always wins over the OS preference (§11.4).
 *
 * Three logical preferences, cycled in order:
 *   - `system` — no `data-theme` attribute; `prefers-color-scheme` governs.
 *   - `dark`   — `data-theme="dark"` pins dark regardless of OS.
 *   - `light`  — `data-theme="light"` pins light regardless of OS.
 *
 * The choice persists in `localStorage` so a reviewer's pick survives reloads.
 * The control is purely presentational — it sets a CSS hook and touches no civic
 * data, no markup semantics, and no trust label (the dark theme is a color-value
 * swap only; trust meaning stays backend-driven, icon+text — §11.3/§11.5).
 */

export type ThemePref = 'system' | 'dark' | 'light';

const STORAGE_KEY = 'gw-theme';
const CYCLE: ThemePref[] = ['system', 'dark', 'light'];

const LABEL: Record<ThemePref, string> = {
  system: 'Theme: System',
  dark: 'Theme: Dark',
  light: 'Theme: Light',
};

/** Read the persisted preference, defaulting to `system` (let the OS decide). */
export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light' || v === 'system') return v;
  } catch {
    /* localStorage unavailable (private mode / blocked) — fall back to system */
  }
  return 'system';
}

/**
 * Apply a preference to the document root. `system` removes the attribute so the
 * `@media (prefers-color-scheme)` rule governs; `dark`/`light` pin via the
 * attribute selector that outranks the media query.
 */
export function applyThemePref(pref: ThemePref): void {
  const el = document.documentElement;
  if (pref === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', pref);
}

function persist(pref: ThemePref): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* non-fatal: the in-memory + attribute state still works for this session */
  }
}

/**
 * Self-contained inline style referencing the design tokens, so the control
 * adapts to whichever theme is active (surface/text/border/accent all swap with
 * the rest of the page). Fixed bottom-right; honours the ≥44px touch floor
 * (`--gw-tap-min`) and the ≥13px badge font floor (`--gw-text-badge`).
 */
const TOGGLE_STYLE = [
  'position:fixed',
  'right:.75rem',
  'bottom:.75rem',
  'z-index:50',
  'min-height:var(--gw-tap-min)',
  'min-width:var(--gw-tap-min)',
  'display:inline-flex',
  'align-items:center',
  'gap:.4rem',
  'padding:.45rem .8rem',
  'font:600 var(--gw-text-badge)/1.2 var(--gw-font)',
  'color:var(--gw-text)',
  'background:var(--gw-surface-subtle)',
  'border:var(--gw-border-w) solid var(--gw-border-strong)',
  'border-radius:var(--gw-radius-pill)',
  'cursor:pointer',
].join(';');

/**
 * Boot the theme system and mount the toggle control.
 *
 * Mounted on `document.body` (NOT inside `#app`) so it survives the route
 * re-renders that call `root.replaceChildren()`. Applies the stored preference
 * first (no flash), then renders the cycling button. Returns the button for tests.
 */
export function mountThemeToggle(parent: HTMLElement = document.body): HTMLButtonElement {
  let pref = readThemePref();
  applyThemePref(pref);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gw-theme-toggle';
  btn.setAttribute('data-test', 'theme-toggle');
  btn.setAttribute('style', TOGGLE_STYLE);

  const sync = (): void => {
    btn.textContent = LABEL[pref];
    btn.setAttribute('aria-label', `${LABEL[pref]}. Activate to change theme.`);
    btn.setAttribute('data-theme-pref', pref);
  };
  sync();

  btn.addEventListener('click', () => {
    pref = CYCLE[(CYCLE.indexOf(pref) + 1) % CYCLE.length];
    applyThemePref(pref);
    persist(pref);
    sync();
  });

  parent.append(btn);
  return btn;
}
