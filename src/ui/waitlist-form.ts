/**
 * Waitlist intake form (GOV-758 / GOV-721 leg 3/5).
 *
 * Minimal by design (deliverable #2 + GATED_BETA_ACCESS_WORKFLOW): it collects
 * ONLY an email and a free-text area-of-interest. No name, phone, address, or
 * any other PII — the less we hold, the less there is to leak, and civic
 * standing is never asked about. It renders inside the `anonymous` gate panel on
 * the preview landing.
 *
 * SCOPE GUARD: there is no waitlist backend merged into THIS leg (backend leg-2
 * GOV-754 runs in parallel). Submission is therefore a client-only demo flow: a
 * valid submit shows an inline confirmation and (for the walkthrough) advances
 * the gate to `waitlisted` via the hash route. The form is pure DOM + a pure
 * {@link validateWaitlist} helper so the validation branches are unit-testable
 * without a browser, mirroring the `gate/access.ts` pure-core pattern.
 *
 * When leg-2's intake endpoint lands, {@link WaitlistFormOptions.onSubmit} is the
 * single seam to wire the real POST — the DOM/validation/ARIA stay unchanged.
 */
import { safeExternalHref } from '../data/web-safe';

/** The only two fields we collect. No other PII (workflow: email + interest only). */
export interface WaitlistSubmission {
  email: string;
  /** Free-text "what civic area are you interested in" — optional. */
  areaInterest: string;
}

export interface WaitlistValidation {
  ok: boolean;
  /** Field-scoped error message, shown under the email input + announced. */
  emailError?: string;
}

/**
 * Pure, framework-free email validation. Deliberately permissive (a single `@`
 * with a dotted domain) — the backend is the real authority; the client just
 * blocks the obvious empties/typos before a request is spent. No network, no
 * DOM: trivially unit-testable.
 */
export function validateWaitlist(input: Partial<WaitlistSubmission>): WaitlistValidation {
  const email = (input.email ?? '').trim();
  if (!email) return { ok: false, emailError: 'Enter your email so a reviewer can follow up.' };
  // One @, non-empty local part, a dotted domain. Good enough for a pre-check.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, emailError: "That email doesn't look right — check for a typo." };
  }
  return { ok: true };
}

export interface WaitlistFormOptions {
  /**
   * Called with the validated submission on a successful submit. Defaults to the
   * demo flow (advance the hash to the `waitlisted` gate state). Real leg-2 wiring
   * replaces this with the intake POST.
   */
  onSubmit?: (submission: WaitlistSubmission) => void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    // C8: a supplied URL is untrusted input. An unsafe scheme is REFUSED, not rendered —
    // the anchor keeps its text and simply has no href, so nothing is clickable and no
    // dead affordance is presented. See safeExternalHref in src/data/web-safe.ts.
    if (k === 'href' && safeExternalHref(v) === null) {
      node.setAttribute('data-href-refused', 'unsafe-scheme');
      continue;
    }
    node.setAttribute(k, v);
  }
  for (const c of children) node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

/** Default demo submit: advance the local walkthrough to the waitlisted state. */
function demoSubmit(): void {
  try {
    window.location.hash = '#/?gate=waitlisted';
  } catch {
    /* non-browser / storage-less runtime — inline confirmation still shows */
  }
}

/**
 * Build the waitlist intake form element. Every interactive control carries an
 * accessible name (AC-7): the two inputs use `<label for>` + `aria-describedby`,
 * the email error is an `aria-live` region tied to the input via
 * `aria-describedby`, and the submit button has explicit text. The form itself
 * is a labelled `<form>` region.
 */
export function renderWaitlistForm(opts: WaitlistFormOptions = {}): HTMLFormElement {
  const onSubmit = opts.onSubmit ?? demoSubmit;

  const emailInput = el('input', {
    type: 'email',
    id: 'gw-waitlist-email',
    name: 'email',
    class: 'gw-waitlist-input',
    autocomplete: 'email',
    inputmode: 'email',
    required: 'required',
    'aria-describedby': 'gw-waitlist-email-hint gw-waitlist-email-error',
    'data-test': 'waitlist-email',
  });

  const areaInput = el('input', {
    type: 'text',
    id: 'gw-waitlist-area',
    name: 'areaInterest',
    class: 'gw-waitlist-input',
    maxlength: '120',
    'aria-describedby': 'gw-waitlist-area-hint',
    'data-test': 'waitlist-area',
    placeholder: 'e.g. town budget, planning, schools',
  });

  const emailError = el(
    'p',
    {
      id: 'gw-waitlist-email-error',
      class: 'gw-waitlist-error',
      'data-test': 'waitlist-email-error',
      role: 'alert',
      'aria-live': 'assertive',
      hidden: 'hidden',
    },
    [],
  );

  const confirmation = el(
    'p',
    {
      class: 'gw-waitlist-confirm',
      'data-test': 'waitlist-confirmation',
      role: 'status',
      'aria-live': 'polite',
      hidden: 'hidden',
    },
    [],
  );

  const submit = el(
    'button',
    { type: 'submit', class: 'gw-gate-action gw-waitlist-submit', 'data-test': 'waitlist-submit' },
    ['Join the waitlist'],
  );

  const form = el(
    'form',
    {
      class: 'gw-waitlist-form',
      'data-test': 'waitlist-form',
      'aria-label': 'Request beta access — join the waitlist',
      novalidate: 'novalidate',
    },
    [
      el('div', { class: 'gw-waitlist-field' }, [
        el('label', { for: 'gw-waitlist-email', class: 'gw-waitlist-label' }, ['Email address']),
        el('p', { id: 'gw-waitlist-email-hint', class: 'gw-waitlist-hint gw-muted' }, [
          'We use this only to reach you about beta access. Nothing else.',
        ]),
        emailInput,
        emailError,
      ]),
      el('div', { class: 'gw-waitlist-field' }, [
        el('label', { for: 'gw-waitlist-area', class: 'gw-waitlist-label' }, [
          'What are you interested in? ',
          el('span', { class: 'gw-muted' }, ['(optional)']),
        ]),
        el('p', { id: 'gw-waitlist-area-hint', class: 'gw-waitlist-hint gw-muted' }, [
          'A civic area you want to follow. Optional and free-text — no account details.',
        ]),
        areaInput,
      ]),
      el('p', { class: 'gw-waitlist-privacy gw-muted', 'data-test': 'waitlist-privacy' }, [
        'We ask for email and interest only — no name, address, or other personal details. ' +
          'Joining the waitlist says nothing about your civic standing.',
      ]),
      submit,
      confirmation,
    ],
  );

  form.addEventListener('submit', (evt) => {
    evt.preventDefault();
    const submission: WaitlistSubmission = {
      email: emailInput.value.trim(),
      areaInterest: areaInput.value.trim(),
    };
    const result = validateWaitlist(submission);
    if (!result.ok) {
      emailError.textContent = result.emailError ?? 'Please check the form and try again.';
      emailError.removeAttribute('hidden');
      emailInput.setAttribute('aria-invalid', 'true');
      emailInput.focus();
      return;
    }
    emailError.setAttribute('hidden', 'hidden');
    emailInput.removeAttribute('aria-invalid');
    confirmation.textContent =
      "Thanks — you're on the waitlist. A reviewer will follow up by email.";
    confirmation.removeAttribute('hidden');
    onSubmit(submission);
  });

  return form;
}

/** Styles for the waitlist form, appended to the landing stylesheet (token-driven). */
export const WAITLIST_STYLE = `
.gw-waitlist-form{margin:var(--gw-space-4) 0 0;border-top:var(--gw-border-w) dashed var(--gw-border);padding-top:var(--gw-space-4)}
.gw-waitlist-field{margin:0 0 var(--gw-space-4)}
.gw-waitlist-label{display:block;font-size:var(--gw-text-body);font-weight:700;margin:0 0 var(--gw-space-1)}
.gw-waitlist-hint{font-size:var(--gw-text-sm);margin:0 0 var(--gw-space-2)}
.gw-waitlist-input{display:block;width:100%;box-sizing:border-box;min-height:var(--gw-tap-min);padding:var(--gw-space-2) var(--gw-space-3);font:var(--gw-text-body)/1.4 var(--gw-font);color:var(--gw-text);background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius)}
.gw-waitlist-input:focus-visible{outline:2px solid var(--gw-accent);outline-offset:1px;border-color:var(--gw-accent)}
.gw-waitlist-input[aria-invalid="true"]{border-color:var(--gw-stop-border)}
.gw-waitlist-error{font-size:var(--gw-text-sm);color:var(--gw-stop-text);margin:var(--gw-space-2) 0 0}
.gw-waitlist-error[hidden]{display:none}
.gw-waitlist-privacy{font-size:var(--gw-text-sm);margin:0 0 var(--gw-space-4)}
.gw-waitlist-submit{border:0;cursor:pointer}
.gw-waitlist-confirm{font-size:var(--gw-text-body);color:var(--gw-ok-text);background:var(--gw-ok-bg);border:var(--gw-border-w) solid var(--gw-ok-text);border-radius:var(--gw-radius);padding:var(--gw-space-3);margin:var(--gw-space-3) 0 0}
.gw-waitlist-confirm[hidden]{display:none}
`;
