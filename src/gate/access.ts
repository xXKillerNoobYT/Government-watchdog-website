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
 * Beta access states. GOV-758 (GOV-721 leg 3/5) expands the original 4-state
 * scaffold to the full SIX gated-beta states the GATED_BETA_ACCESS_WORKFLOW
 * enumerates — now backed (in later legs) by the real accounts/cohorts backend
 * (GOV-753 schema / GOV-754 service), not just placeholder UI:
 *
 *   - `anonymous`   — not signed in (public visitor).
 *   - `waitlisted`  — request received, sitting in the intake queue.
 *   - `pending`     — pending review: a reviewer is actively evaluating.
 *   - `approved`    — approved for the gated beta (full app unlocks).
 *   - `denied`      — denied / needs more info (capacity/process only).
 *   - `revoked`     — access previously granted, now revoked/disabled/paused.
 *
 * Ordered as the workflow lists them (not-signed-in → waitlisted → pending-review
 * → approved → denied → revoked). Every non-`approved` state renders ZERO civic
 * data (AC-1/AC-7). The `?gate=` screenshot override accepts any of these keys.
 */
export type AccessState =
  | 'anonymous'
  | 'waitlisted'
  | 'pending'
  | 'approved'
  | 'denied'
  | 'revoked';

export const ACCESS_STATES = [
  'anonymous',
  'waitlisted',
  'pending',
  'approved',
  'denied',
  'revoked',
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
    case 'waitlisted':
      return {
        state,
        badge: 'Waitlisted',
        title: "You're on the waitlist",
        message:
          "Thanks — your request is in the queue. We admit beta access in small batches to keep " +
          'source-review quality and moderation manageable, so there may be a wait. A reviewer ' +
          'will follow up by email; nothing more is needed from you right now.',
      };
    case 'pending':
      return {
        state,
        badge: 'In review',
        title: 'Your request is being reviewed',
        message:
          'A reviewer is looking at your beta request now. This is a routine capacity and ' +
          "access-review step — we'll email you the moment there's a decision. You don't need " +
          'to do anything else.',
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
    case 'revoked':
      return {
        state,
        badge: 'Access ended',
        title: 'Your beta access has ended',
        // AC#5 (extended to revoked) — like denial, revocation copy must NOT
        // imply anything about the person's civic standing. Beta access is a
        // capacity/quality/moderation control, and can be paused for operational
        // reasons (e.g. a cohort reset); it says nothing about the individual.
        message:
          'Your gated-beta access has been turned off. Beta access is a controlled, revocable ' +
          'preview managed for capacity, quality, and moderation — it does not reflect anything ' +
          'about you, your community, or your standing as a resident or citizen. You can request ' +
          'access again.',
        action: { label: 'Request access again', href: '#/?gate=anonymous', test: 'gate-rerequest' },
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
          'quality, safety, moderation, and source-review integrity. Join the waitlist below and ' +
          'a reviewer will follow up.',
        // The waitlist intake form renders alongside this panel (landing.ts); the
        // action doubles as the form's submit affordance / demo route to `waitlisted`.
        action: { label: 'Join the waitlist', href: '#/?gate=waitlisted', test: 'gate-request' },
      };
  }
}
