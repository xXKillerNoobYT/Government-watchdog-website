// @vitest-environment jsdom
//
// GOV-767 — landing dark-token washout after visiting the gated app.
//
// Repro chain being guarded: the shell's Advanced reading-mode default applies
// `data-theme="dark"` via `applyThemePref` WITHOUT persisting (GOV-658 §1.4
// mode-palette sync), the user hash-navigates back to `#/`, and the landing —
// which painted no page background — showed the dark light-text token
// (#ECF1F7) over the white default canvas: a nearly invisible hero.
//
// Two defenses, both asserted here:
//  1. `renderLanding` re-arbitrates the palette: with NO explicit theme pin it
//     restores `system` (removes the leaked attribute); an explicit pin via the
//     standalone System/Dark/Light control is never overridden (GOV-654 §1.4).
//  2. The landing style paints the page canvas from the active token set
//     (`html{background:var(--gw-page-bg)}`), so a REAL dark palette (explicit
//     pin, or OS-dark under `system`) is fully dark and stays AA-readable.

import { describe, it, expect, beforeEach } from 'vitest';
import { renderLanding, LANDING_STYLE } from '../src/ui/landing';
import { applyThemePref, setThemePref } from '../src/ui/theme-toggle';

// ── WCAG 2.1 relative-luminance contrast (same formula as gov440 / spec §11.2) ──
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`bad hex ${hex}`);
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Pull a token's value out of a declaration block of GW_TOKENS/LANDING_STYLE. */
function token(block: string, name: string): string {
  const m = new RegExp(`${name}:(#[0-9a-fA-F]{6})`).exec(block);
  if (!m) throw new Error(`token ${name} not found`);
  return m[1];
}

describe('GOV-767 — landing palette arbitration (leak undone, pin respected)', () => {
  let root: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
  });

  it('removes a leaked (unpersisted) dark attribute — the GOV-760 repro path', () => {
    // Shell's Advanced default: applied, NOT persisted (syncPaletteToMode).
    applyThemePref('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    renderLanding(root, 'anonymous');

    // No explicit pin exists → landing restores `system` (attribute removed);
    // the broadsheet-light base (or honest OS-dark media query) governs.
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    expect(root.querySelector('[data-test="landing"]')).toBeTruthy();
  });

  it('never overrides an explicit dark pin (GOV-654 §1.4)', () => {
    setThemePref('dark'); // standalone toggle: applied AND persisted
    renderLanding(root, 'anonymous');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('never overrides an explicit light pin', () => {
    setThemePref('light');
    renderLanding(root, 'anonymous');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('restores an explicit system pin over an unpersisted mode leak', () => {
    setThemePref('system'); // explicit "System" — stored, reads as system
    applyThemePref('dark'); // a later unpersisted mode-default leak…
    renderLanding(root, 'anonymous');
    // …is undone: the stored pin IS `system`, and system === no attribute.
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });
});

describe('GOV-767 — landing paints the page canvas from tokens', () => {
  it('sets the html background to the active page token', () => {
    expect(LANDING_STYLE).toContain('html{background:var(--gw-page-bg)}');
  });

  it('hero text is AA-readable on the painted canvas in BOTH palettes', () => {
    // Light (base :root) pairing — broadsheet ink on paper.
    const light = { text: token(LANDING_STYLE, '--gw-text'), bg: token(LANDING_STYLE, '--gw-page-bg') };
    expect(contrast(light.text, light.bg)).toBeGreaterThanOrEqual(4.5);

    // Dark override pairing — off-white on near-black slate.
    const darkBlock = LANDING_STYLE.slice(LANDING_STYLE.indexOf(':root[data-theme="dark"]'));
    const dark = { text: token(darkBlock, '--gw-text'), bg: token(darkBlock, '--gw-page-bg') };
    expect(contrast(dark.text, dark.bg)).toBeGreaterThanOrEqual(4.5);
  });
});
