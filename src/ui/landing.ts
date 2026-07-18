/**
 * Minimal public landing + gated-beta entry (GOV-799).
 *
 * Isaac directive 2026-07-18: "minimal is key... make it look good but dont
 * explain anything at all. Just a few buttons."
 *
 * Anonymous state renders: name + "In Beta" badge + Login + Sign up.
 * No mission copy, no scope explanation, no gated-beta note.
 *
 * Non-anonymous states still render their compact gate panel (waitlisted /
 * pending / approved / denied / revoked) as per GATED_BETA_ACCESS_WORKFLOW.
 *
 * NO civic evidence is rendered here — verified by gov419 test suite.
 */

import type { AccessState, GatePanel } from '../gate/access';
import { gatePanelContent, SCAFFOLDING_NOTE } from '../gate/access';
import { GW_TOKENS } from './tokens';
import { applyThemePref, readThemePref } from './theme-toggle';
import { renderWaitlistForm, WAITLIST_STYLE } from './waitlist-form';
import { renderMagicLinkForm, MAGIC_LINK_STYLE } from './magic-link-form';

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

/** A reviewer-only hint shown on the gated app block (local walkthrough path). */
const REVIEWER_HINT =
  'Reviewer / local walkthrough: open the full app with the reviewer bypass ' +
  '(VITE_REVIEWER_BYPASS=true or #/app?reviewer=1). See README → "Preview launch vs full app".';

/**
 * Anonymous landing: two CTA buttons that expand inline forms on click.
 * Login → magic-link form. Sign up → waitlist form.
 * Only one panel open at a time.
 */
function anonymousLandingEl(): HTMLElement {
  const mlForm = renderMagicLinkForm();
  const waitlistForm = renderWaitlistForm();

  const mlSection = el(
    'section',
    { class: 'gw-landing-expand', 'data-test': 'ml-section', hidden: 'hidden', 'aria-label': 'Login with a magic link' },
    [mlForm],
  );
  const waitlistSection = el(
    'section',
    { class: 'gw-landing-expand', 'data-test': 'waitlist-section', hidden: 'hidden', 'aria-label': 'Sign up for updates' },
    [waitlistForm],
  );

  const loginBtn = el(
    'button',
    { class: 'gw-cta-primary', 'data-test': 'login-btn', type: 'button' },
    ['Login'],
  );
  const signupBtn = el(
    'button',
    { class: 'gw-cta-secondary', 'data-test': 'signup-btn', type: 'button' },
    ['Sign up for updates'],
  );

  const ctaRow = el('div', { class: 'gw-cta-row' }, [loginBtn, signupBtn]);

  loginBtn.addEventListener('click', () => {
    const isOpen = !mlSection.hasAttribute('hidden');
    mlSection.toggleAttribute('hidden', isOpen);
    waitlistSection.setAttribute('hidden', '');
    if (!isOpen) (mlSection.querySelector('input') as HTMLInputElement | null)?.focus();
  });

  signupBtn.addEventListener('click', () => {
    const isOpen = !waitlistSection.hasAttribute('hidden');
    waitlistSection.toggleAttribute('hidden', isOpen);
    mlSection.setAttribute('hidden', '');
    if (!isOpen) (waitlistSection.querySelector('input') as HTMLInputElement | null)?.focus();
  });

  const scaffoldNote = el(
    'p',
    { class: 'gw-gate-scaffold gw-muted', 'data-test': 'scaffolding-note' },
    [SCAFFOLDING_NOTE],
  );

  return el(
    'section',
    { class: 'gw-gate-panel', 'data-test': 'gate-panel', 'data-state': 'anonymous' },
    [ctaRow, mlSection, waitlistSection, scaffoldNote],
  );
}

/** Compact gate panel for non-anonymous states (unchanged behavior). */
function gatePanelEl(panel: GatePanel): HTMLElement {
  const children: (Node | string)[] = [
    el('span', { class: `gw-gate-badge gw-gate-${panel.state}`, 'data-test': 'gate-badge', 'data-state': panel.state }, [
      panel.badge,
    ]),
    el('h2', { class: 'gw-gate-title', 'data-test': 'gate-title' }, [panel.title]),
    el('p', { class: 'gw-gate-message', 'data-test': 'gate-message' }, [panel.message]),
  ];
  if (panel.action) {
    children.push(
      el(
        'a',
        { class: 'gw-gate-action', href: panel.action.href, role: 'button', 'data-test': panel.action.test },
        [panel.action.label],
      ),
    );
  }
  children.push(el('p', { class: 'gw-gate-scaffold gw-muted', 'data-test': 'scaffolding-note' }, [SCAFFOLDING_NOTE]));
  return el('section', { class: 'gw-gate-panel', 'data-test': 'gate-panel', 'data-state': panel.state }, children);
}

/**
 * GOV-767 — sync stored theme preference to undo any unpersisted dark-token
 * leak from the shell's reading-mode default before rendering the landing.
 */
function syncLandingPalette(): void {
  applyThemePref(readThemePref());
}

/**
 * Render the minimal public landing.
 *
 * Anonymous: hero (name + badge) + two CTAs (Login / Sign up).
 * All other states: hero + compact gate panel.
 *
 * Hard invariant: NO civic evidence rendered here.
 */
export function renderLanding(root: HTMLElement, access: AccessState): void {
  syncLandingPalette();
  ensureLandingStyle();
  root.className = 'gw-landing-root';
  root.replaceChildren();

  const hero = el('section', { class: 'gw-landing-hero', 'data-test': 'landing' }, [
    el('div', { class: 'gw-landing-title-row' }, [
      el('h1', { class: 'gw-landing-h1' }, ['Government Watchdog']),
      el('span', { class: 'gw-beta-badge', 'data-test': 'beta-badge' }, ['In Beta']),
    ]),
  ]);

  const content =
    access === 'anonymous' ? anonymousLandingEl() : gatePanelEl(gatePanelContent(access));

  root.append(hero, content);
}

/**
 * Gate the full reviewer-internal app. When `access` is approved the real app
 * renders; otherwise only the gate panel for the current state is shown.
 */
export function renderGatedApp(
  root: HTMLElement,
  access: AccessState,
  renderApp: () => void,
): void {
  if (access === 'approved') {
    renderApp();
    return;
  }
  ensureLandingStyle();
  root.className = 'gw-landing-root';
  root.replaceChildren();

  const block = el('section', { class: 'gw-gated-app', 'data-test': 'gated-app', 'data-state': access }, [
    el('p', { class: 'gw-landing-kicker' }, ['Full app · gated']),
    el('h1', { class: 'gw-landing-h1' }, ['This area is behind the beta gate']),
    el('p', { class: 'gw-muted' }, [
      'The full Government Watchdog app is reachable only once your beta access is approved.',
    ]),
  ]);
  root.append(
    block,
    gatePanelEl(gatePanelContent(access)),
    el('p', { class: 'gw-reviewer-hint gw-muted', 'data-test': 'reviewer-hint' }, [REVIEWER_HINT]),
    el('p', {}, [el('a', { class: 'gw-gate-action gw-gate-action-ghost', href: '#/', 'data-test': 'back-to-preview' }, ['← Back to preview'])]),
  );
}

export const LANDING_STYLE = `${GW_TOKENS}
html{background:var(--gw-page-bg)}
.gw-landing-root{font-family:var(--gw-font);line-height:1.55;color:var(--gw-text);max-width:42rem;margin:0 auto;padding:3rem var(--gw-space-5)}
.gw-landing-kicker{text-transform:uppercase;letter-spacing:.08em;font-size:var(--gw-text-xs);font-weight:700;color:var(--gw-text-muted);margin:0 0 var(--gw-space-2)}
.gw-landing-title-row{display:flex;align-items:center;gap:var(--gw-space-3);flex-wrap:wrap;margin-bottom:var(--gw-space-2)}
.gw-landing-h1{font-size:var(--gw-text-xl);margin:0;line-height:var(--gw-leading-tight)}
.gw-landing-hero{margin-bottom:var(--gw-space-5)}
.gw-beta-badge{display:inline-block;font-size:var(--gw-text-badge);font-weight:700;border-radius:var(--gw-radius-pill);padding:.2rem var(--gw-space-3);background:var(--gw-caution-bg);color:var(--gw-caution-text);border:var(--gw-border-w) solid var(--gw-caution-text);white-space:nowrap;letter-spacing:.04em}
.gw-muted{color:var(--gw-text-muted)}
.gw-gate-panel,.gw-gated-app{border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-5) 1.1rem;margin:0;background:var(--gw-surface)}
.gw-gate-badge{display:inline-block;font-size:var(--gw-text-badge);font-weight:700;border-radius:var(--gw-radius-pill);padding:.15rem var(--gw-space-3);border:var(--gw-border-w) solid;white-space:nowrap}
.gw-gate-anonymous{background:var(--gw-surface-accent-tint);color:var(--gw-accent);border-color:var(--gw-accent)}
.gw-gate-waitlisted{background:var(--gw-tone-info-well);color:var(--gw-info-text);border-color:var(--gw-tone-info-line)}
.gw-gate-pending{background:var(--gw-caution-bg);color:var(--gw-caution-text);border-color:var(--gw-caution-text)}
.gw-gate-denied{background:var(--gw-stop-bg);color:var(--gw-stop-text);border-color:var(--gw-stop-border)}
.gw-gate-revoked{background:var(--gw-surface-well);color:var(--gw-text-secondary);border-color:var(--gw-border-strong)}
.gw-gate-approved{background:var(--gw-ok-bg);color:var(--gw-ok-text);border-color:var(--gw-ok-text)}
.gw-gate-title{font-size:var(--gw-text-lg);margin:var(--gw-space-3) 0 var(--gw-space-1)}
.gw-gate-message{margin:var(--gw-space-1) 0 .7rem}
.gw-gate-action{display:inline-flex;align-items:center;min-height:var(--gw-tap-min);box-sizing:border-box;cursor:pointer;font-size:.92rem;font-weight:600;color:var(--gw-accent-text-on);background:var(--gw-accent);border:var(--gw-border-w) solid var(--gw-accent);border-radius:var(--gw-radius);padding:var(--gw-space-1) var(--gw-space-5);text-decoration:none}
.gw-gate-action:focus-visible{outline:2px solid var(--gw-accent);outline-offset:2px}
.gw-gate-action-ghost{color:var(--gw-accent);background:var(--gw-surface)}
.gw-gate-scaffold{font-size:.78rem;margin:.7rem 0 0;border-top:var(--gw-border-w) dashed var(--gw-border);padding-top:var(--gw-space-3)}
.gw-reviewer-hint{font-size:var(--gw-text-sm);margin:var(--gw-space-4) 0 0}
/* CTA row — two buttons side by side */
.gw-cta-row{display:flex;gap:var(--gw-space-3);flex-wrap:wrap}
.gw-cta-primary{min-height:var(--gw-tap-min);padding:var(--gw-space-2) var(--gw-space-5);font:600 1rem/1 var(--gw-font);color:var(--gw-accent-text-on);background:var(--gw-accent);border:var(--gw-border-w) solid var(--gw-accent);border-radius:var(--gw-radius);cursor:pointer}
.gw-cta-primary:focus-visible{outline:2px solid var(--gw-accent);outline-offset:2px}
.gw-cta-secondary{min-height:var(--gw-tap-min);padding:var(--gw-space-2) var(--gw-space-5);font:600 1rem/1 var(--gw-font);color:var(--gw-accent);background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-accent);border-radius:var(--gw-radius);cursor:pointer}
.gw-cta-secondary:focus-visible{outline:2px solid var(--gw-accent);outline-offset:2px}
/* Expandable inline form sections */
.gw-landing-expand{margin:var(--gw-space-4) 0 0;padding-top:var(--gw-space-4);border-top:var(--gw-border-w) solid var(--gw-border)}
.gw-landing-expand[hidden]{display:none}
${WAITLIST_STYLE}
${MAGIC_LINK_STYLE}`;

let styleInjected = false;
function ensureLandingStyle(): void {
  if (styleInjected) return;
  document.head.append(el('style', {}, [LANDING_STYLE]));
  styleInjected = true;
}
