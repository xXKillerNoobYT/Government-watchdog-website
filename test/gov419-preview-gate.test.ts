// @vitest-environment jsdom
//
// GOV-419 — preview-launch landing + gated-beta entry in front of the full
// reviewer-internal app. Proves the acceptance criteria end to end:
//
//   - resolveAccess precedence: explicit ?gate= override > reviewer bypass >
//     anonymous default (AC#1/#3),
//   - the landing exposes the mission teaser + Alpine scope + gated messaging
//     and ZERO civic evidence (no record-card / timeline / source-drawer /
//     trust-badge) at any gate state (AC#1),
//   - the four gate states are visibly distinct (distinct badge + data-state) (AC#4),
//   - denial copy reassures and does NOT imply anything about civic standing (AC#5),
//   - renderGatedApp runs the full app ONLY when approved, else shows the gate
//     with no civic data (AC#2),
//   - the reviewer bypass (approved) reveals the full app (AC#3).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveAccess,
  gatePanelContent,
  ACCESS_STATES,
  isAccessState,
  type AccessState,
} from '../src/gate/access';
import { renderLanding, renderGatedApp } from '../src/ui/landing';

let root: HTMLElement;
beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
});

/** Selectors for any civic-evidence surface that must NEVER appear pre-gate. */
const CIVIC_SELECTORS = [
  '[data-test="record-card"]',
  '[data-test="timeline"]',
  '[data-test="source-drawer"]',
  '[data-test="trust-badge"]',
  '[data-test="card-feed"]',
  '[data-test="completeness-gap-card"]',
];
function assertNoCivicData(el: HTMLElement): void {
  for (const sel of CIVIC_SELECTORS) {
    expect(el.querySelector(sel), `pre-gate surface must not expose ${sel}`).toBeNull();
  }
}

describe('GOV-419 resolveAccess — override > bypass > default', () => {
  it('defaults to anonymous with no override and no bypass', () => {
    expect(resolveAccess(null, false)).toBe('anonymous');
    expect(resolveAccess(undefined, false)).toBe('anonymous');
  });

  it('reviewer bypass grants approved when no override is present', () => {
    expect(resolveAccess(null, true)).toBe('approved');
  });

  it('an explicit ?gate= override always wins, even with the bypass on', () => {
    for (const state of ACCESS_STATES) {
      expect(resolveAccess(state, false)).toBe(state);
      expect(resolveAccess(state, true)).toBe(state);
    }
  });

  it('ignores an invalid ?gate= value and falls through to the bypass/default', () => {
    expect(resolveAccess('garbage', false)).toBe('anonymous');
    expect(resolveAccess('garbage', true)).toBe('approved');
    expect(isAccessState('garbage')).toBe(false);
    expect(isAccessState('approved')).toBe(true);
  });
});

describe('GOV-419 gatePanelContent — four distinct, correctly-framed states', () => {
  it('gives every state a distinct, non-empty badge + title', () => {
    const badges = ACCESS_STATES.map((s) => gatePanelContent(s).badge);
    expect(new Set(badges).size).toBe(ACCESS_STATES.length);
    for (const s of ACCESS_STATES) {
      const p = gatePanelContent(s);
      expect(p.state).toBe(s);
      expect(p.badge.length).toBeGreaterThan(0);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.message.length).toBeGreaterThan(0);
    }
  });

  it('only anonymous offers request-access and only approved offers enter-app', () => {
    expect(gatePanelContent('anonymous').action?.test).toBe('gate-request');
    expect(gatePanelContent('approved').action?.test).toBe('gate-enter');
    expect(gatePanelContent('approved').action?.href).toBe('#/app');
    expect(gatePanelContent('pending').action).toBeUndefined();
    expect(gatePanelContent('denied').action).toBeUndefined();
  });

  it('denial copy reassures and does NOT imply anything about civic standing (AC#5)', () => {
    const msg = gatePanelContent('denied').message.toLowerCase();
    // Explicit reassurance that denial is process/capacity-only.
    expect(msg).toContain('does not reflect anything about you');
    expect(msg).toContain('standing');
    // Must not accuse or imply wrongdoing / bad standing.
    for (const banned of ['untrustworthy', 'suspicious', 'not a real', 'fake', 'ineligible citizen']) {
      expect(msg).not.toContain(banned);
    }
  });
});

describe('GOV-419 renderLanding — preview teaser, no civic evidence (AC#1)', () => {
  it('renders mission teaser + Alpine scope + gated messaging, and zero civic data', () => {
    renderLanding(root, 'anonymous');
    expect(root.querySelector('[data-test="landing"]')).not.toBeNull();
    expect(root.querySelector('[data-test="landing-mission"]')?.textContent).toMatch(/traceable civic timeline/i);
    expect(root.querySelector('[data-test="landing-scope"]')?.textContent).toMatch(/Town of Alpine/i);
    expect(root.querySelector('[data-test="landing-gated"]')?.textContent).toMatch(/gated beta/i);
    // The request-access affordance is present (AC#2: a clear access affordance).
    expect(root.querySelector('[data-test="gate-request"]')).not.toBeNull();
    // Scaffolding is clearly labeled non-functional (AC#4).
    expect(root.querySelector('[data-test="scaffolding-note"]')?.textContent).toMatch(/non-functional beta scaffolding/i);
    assertNoCivicData(root);
  });

  it('shows a visibly distinct panel for each access state and never leaks civic data', () => {
    for (const state of ACCESS_STATES) {
      renderLanding(root, state);
      const badge = root.querySelector('[data-test="gate-badge"]');
      expect(badge?.getAttribute('data-state'), `badge tagged for ${state}`).toBe(state);
      const panel = root.querySelector('[data-test="gate-panel"]');
      expect(panel?.getAttribute('data-state')).toBe(state);
      assertNoCivicData(root);
    }
  });
});

describe('GOV-419 renderGatedApp — full app only past the gate (AC#2/#3)', () => {
  it('does NOT run the full app and shows zero civic data when not approved', () => {
    for (const state of ['anonymous', 'pending', 'denied'] as AccessState[]) {
      let ran = false;
      renderGatedApp(root, state, () => {
        ran = true;
        const leak = document.createElement('div');
        leak.setAttribute('data-test', 'timeline');
        root.append(leak);
      });
      expect(ran, `full app must not render for ${state}`).toBe(false);
      expect(root.querySelector('[data-test="gated-app"]')).not.toBeNull();
      expect(root.querySelector('[data-test="back-to-preview"]')).not.toBeNull();
      assertNoCivicData(root);
    }
  });

  it('runs the full app when approved (reviewer bypass / ?gate=approved)', () => {
    let ran = false;
    renderGatedApp(root, 'approved', () => {
      ran = true;
    });
    expect(ran).toBe(true);
    // The gate block is NOT shown once approved — the app owns the surface.
    expect(root.querySelector('[data-test="gated-app"]')).toBeNull();
  });
});
