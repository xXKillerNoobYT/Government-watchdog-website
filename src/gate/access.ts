/**
 * Gated-beta access model (GOV-419) — implements GATED_BETA_ACCESS_WORKFLOW.
 *
 * This is the SINGLE source of truth for the four beta access states and the
 * copy each one shows. It is intentionally PURE (no DOM, no storage, no env): the
 * resolver takes plain inputs and returns a state, so screenshot overrides, the
 * reviewer bypass, and the default are all trivially testable. The impure bits
 * (reading `import.meta.env` / `sessionStorage` / the URL) live in `main.ts`.
 *
 * SCOPE GUARD: there is NO real auth backend in this slice. Every state here is
 * non-functional UI scaffolding — see {@link SCAFFOLDING_NOTE}. The waitlist /
 * denial copy must never imply anything about a person's civic standing
 * (GATED_BETA_ACCESS_WORKFLOW: "Do not imply waitlist denial means anything
 * about civic standing").
 */

/**
 * Beta access states, ordered least → most trust. Mirrors the workflow's public
 * states: not-signed-in (`anonymous`), waitlisted/pending (`pending`),
 * denied/needs-info (`denied`), approved (`approved`). Revoked/disabled is a
 * backend concern deferred to the real-auth slice (out of scope here).
 */
export type AccessState = 'anonymous' | 'pending' | 'denied' | 'approved';

export const ACCESS_STATES = [
  'anonymous',
  'pending',
  'denied',
  'approved',
] as const satisfies readonly AccessState[];

export function isAccessState(value: unknown): value is AccessState {
  return typeof value === 'string' && (ACCESS_STATES as readonly string[]).includes(value);
}

/** A forward affordance on a gate panel (stub link — no real backend behind it). */
export interface GateAction {
  label: string;
  /** Hash target. Anonymous → the (stub) waitlist state; approved → the full app. */
  href: string;
  test: string;
}

/** The rendered content for one access state. Pure data — the DOM lives in landing.ts. */
export interface GatePanel {
  state: AccessState;
  /** Short status chip text, e.g. "Waitlisted". */
  badge: string;
  title: string;
  message: string;
  action?: GateAction;
}

/**
 * Resolve the active access state.
 *
 * Precedence (deliberate):
 *   1. An explicit, valid `?gate=` value ALWAYS wins — this is the screenshot /
 *      review override (mirrors the timeline's `?state=` pattern) so any gate
 *      state can be captured, including while the reviewer bypass is on.
 *   2. Otherwise the reviewer bypass grants `approved` (local walkthrough only).
 *   3. Otherwise the public default is `anonymous` (not signed in).
 */
export function resolveAccess(
  gateParam: string | null | undefined,
  reviewerBypass: boolean,
): AccessState {
  if (isAccessState(gateParam)) return gateParam;
  if (reviewerBypass) return 'approved';
  return 'anonymous';
}

/** Whether the full reviewer-internal app may render for this state. */
export function isApproved(state: AccessState): boolean {
  return state === 'approved';
}

/**
 * Shown under every gate control. Acceptance #4: placeholder/stub states are
 * acceptable this slice but MUST be clearly labeled as non-functional scaffolding.
 */
export const SCAFFOLDING_NOTE =
  'Non-functional beta scaffolding — these access controls are a UI placeholder. ' +
  'No real accounts, sign-in, or waitlist backend exist yet (real auth is a separate backend slice).';

/** Per-state panel copy. The single place gate wording is defined. */
export function gatePanelContent(state: AccessState): GatePanel {
  switch (state) {
    case 'pending':
      return {
        state,
        badge: 'Waitlisted',
        title: "You're on the waitlist",
        message:
          'Your request is pending review. We approve beta access in batches to keep ' +
          'source-review quality and moderation manageable. A reviewer will follow up — ' +
          'nothing more is needed from you right now.',
      };
    case 'denied':
      return {
        state,
        badge: 'Needs more info',
        title: 'We need a bit more before we can grant access',
        // AC#5 — denial copy must NOT imply anything about civic standing. This
        // is framed strictly around beta capacity / process, with an explicit
        // reassurance that it reflects nothing about the person or their community.
        message:
          "We couldn't approve this beta request yet. This is only about beta capacity and " +
          'our access-review process — it does not reflect anything about you, your community, ' +
          'or your standing as a resident or citizen. You can request access again later.',
      };
    case 'approved':
      return {
        state,
        badge: 'Approved',
        title: 'Access approved',
        message: "You're approved for the gated beta. Open the full Government Watchdog app.",
        action: { label: 'Open the full app', href: '#/app', test: 'gate-enter' },
      };
    case 'anonymous':
    default:
      return {
        state: 'anonymous',
        badge: 'Not signed in',
        title: 'Request beta access',
        message:
          'The full Government Watchdog app is in gated beta. Access is controlled to protect ' +
          'quality, safety, moderation, and source-review integrity. Join the waitlist and a ' +
          'reviewer will follow up.',
        // Stub: routes to the (non-functional) waitlisted state for the demo flow.
        action: { label: 'Request beta access', href: '#/?gate=pending', test: 'gate-request' },
      };
  }
}
