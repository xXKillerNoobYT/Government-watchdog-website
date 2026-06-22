/**
 * Preview-launch LANDING + gated-beta entry (GOV-419).
 *
 * This is the DEFAULT public face. It deliberately exposes NO civic evidence:
 * no timeline, no cards, no source drawers, no trust labels, no fixture data.
 * Everything here is neutral marketing-teaser + the four gated-beta access
 * states. The full reviewer-internal app renders ONLY past the gate (approved),
 * via {@link renderGatedApp}.
 *
 * NEUTRAL visuals only (acceptance #6) — no brand/voice commitment. Isaac refines
 * branding in a later design slice; this just proves the preview-vs-gated
 * structure and that the four states are visibly distinct.
 */

import type { AccessState, GatePanel } from '../gate/access';
import { gatePanelContent, SCAFFOLDING_NOTE } from '../gate/access';

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

/** Neutral mission teaser — no claims, no civic data, just what the product is. */
export const MISSION_TEASER =
  'Government Watchdog turns public government records, meeting videos, and official documents ' +
  'into a traceable civic timeline — so you can see what happened and the source behind every claim.';

/** Alpine-first scope statement (COMPANY.md scope gate). */
export const SCOPE_NOTE =
  'Preview scope: Town of Alpine, Wyoming. We start with one town and grow only where the work holds up.';

export const GATED_BETA_NOTE =
  'The full app is in gated beta. Access is controlled to protect quality, safety, moderation, ' +
  'and source-review integrity.';

/** A reviewer-only hint shown on the gated app block (local walkthrough path). */
const REVIEWER_HINT =
  'Reviewer / local walkthrough: open the full app with the reviewer bypass ' +
  '(VITE_REVIEWER_BYPASS=true or #/app?reviewer=1). See README → "Preview launch vs full app".';

/** One gate-state panel: distinct badge + title + message (+ optional stub action). */
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
  // Always label the controls as non-functional scaffolding (acceptance #4).
  children.push(el('p', { class: 'gw-gate-scaffold gw-muted', 'data-test': 'scaffolding-note' }, [SCAFFOLDING_NOTE]));
  return el('section', { class: 'gw-gate-panel', 'data-test': 'gate-panel', 'data-state': panel.state }, children);
}

/**
 * Render the preview-launch landing for the given access state.
 *
 * Hard invariant (acceptance #1): NO civic evidence is rendered here. The DOM
 * carries the teaser + scope + gated messaging + the gate panel only — verified
 * by the gov419 test asserting zero record-cards / timeline / source-drawer nodes.
 */
export function renderLanding(root: HTMLElement, access: AccessState): void {
  ensureLandingStyle();
  root.className = 'gw-landing-root';
  root.replaceChildren();

  const hero = el('section', { class: 'gw-landing-hero', 'data-test': 'landing' }, [
    el('p', { class: 'gw-landing-kicker' }, ['Preview launch · gated beta']),
    el('h1', { class: 'gw-landing-h1' }, ['Government Watchdog']),
    el('p', { class: 'gw-landing-mission', 'data-test': 'landing-mission' }, [MISSION_TEASER]),
    el('p', { class: 'gw-landing-scope', 'data-test': 'landing-scope' }, [SCOPE_NOTE]),
    el('p', { class: 'gw-landing-gated', 'data-test': 'landing-gated' }, [GATED_BETA_NOTE]),
  ]);

  root.append(hero, gatePanelEl(gatePanelContent(access)));
}

/**
 * Gate the full reviewer-internal app. When `access` is approved (reviewer
 * bypass on, or `?gate=approved`), `renderApp` runs and draws the real surface.
 * Otherwise NO civic data is rendered — only the gate panel for the current
 * state plus a local-walkthrough hint (acceptance #2: the full surfaces are not
 * reachable from the landing until approved).
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
      'The full Government Watchdog app (timeline, card feed, trust matrix) is reachable only ' +
        'once your beta access is approved.',
    ]),
  ]);
  root.append(
    block,
    gatePanelEl(gatePanelContent(access)),
    el('p', { class: 'gw-reviewer-hint gw-muted', 'data-test': 'reviewer-hint' }, [REVIEWER_HINT]),
    el('p', {}, [el('a', { class: 'gw-gate-action gw-gate-action-ghost', href: '#/', 'data-test': 'back-to-preview' }, ['← Back to preview'])]),
  );
}

/**
 * Neutral landing styles — distinct from the app's `gw-root` styles so the
 * preview surface stands apart. Plain system font, no brand commitment. Each
 * gate state gets a distinct tone (acceptance #4: visibly distinct states).
 */
export const LANDING_STYLE = `
.gw-landing-root{font-family:system-ui,sans-serif;line-height:1.55;color:#1a1a1a;max-width:42rem;margin:0 auto;padding:2rem 1rem}
.gw-landing-kicker{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;font-weight:700;color:#5a6b82;margin:0 0 .4rem}
.gw-landing-h1{font-size:1.8rem;margin:0 0 .6rem;line-height:1.2}
.gw-landing-mission{font-size:1.05rem;margin:.4rem 0}
.gw-landing-scope{font-size:.95rem;color:#33415c;background:#eef2f8;border:1px solid #c2cedd;border-radius:8px;padding:.5rem .7rem;margin:.8rem 0}
.gw-landing-gated{font-size:.92rem;color:#5c4500;background:#fff3cd;border:1px solid #d9a400;border-radius:8px;padding:.5rem .7rem;margin:.8rem 0}
.gw-muted{color:#666}
.gw-gate-panel,.gw-gated-app{border:1px solid #ddd;border-radius:10px;padding:1rem 1.1rem;margin:1.1rem 0;background:#fff}
.gw-gate-badge{display:inline-block;font-size:13px;font-weight:700;border-radius:999px;padding:.15rem .6rem;border:1px solid;white-space:nowrap}
/* Distinct tone per access state (colour + the badge word together). */
.gw-gate-anonymous{background:#eef2f8;color:#1a4d8f;border-color:#1a4d8f}
.gw-gate-pending{background:#fff3cd;color:#7a5b00;border-color:#7a5b00}
.gw-gate-denied{background:#fdecea;color:#7b241c;border-color:#c0392b}
.gw-gate-approved{background:#e8f0e8;color:#1e4620;border-color:#1e4620}
.gw-gate-title{font-size:1.15rem;margin:.5rem 0 .3rem}
.gw-gate-message{margin:.3rem 0 .7rem}
.gw-gate-action{display:inline-flex;align-items:center;min-height:44px;box-sizing:border-box;cursor:pointer;font-size:.92rem;font-weight:600;color:#fff;background:#1a4d8f;border:1px solid #1a4d8f;border-radius:8px;padding:.3rem 1rem;text-decoration:none}
.gw-gate-action:focus-visible{outline:2px solid #1a4d8f;outline-offset:2px}
.gw-gate-action-ghost{color:#1a4d8f;background:#fff}
.gw-gate-scaffold{font-size:.78rem;margin:.7rem 0 0;border-top:1px dashed #ccc;padding-top:.5rem}
.gw-reviewer-hint{font-size:.8rem;margin:.8rem 0 0}
`;

let styleInjected = false;
function ensureLandingStyle(): void {
  if (styleInjected) return;
  document.head.append(el('style', {}, [LANDING_STYLE]));
  styleInjected = true;
}
