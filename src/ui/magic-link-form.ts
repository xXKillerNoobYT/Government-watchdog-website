/**
 * Magic-link login form (GOV-799).
 *
 * Passwordless beta login: approved users enter their email, receive a one-time
 * magic link. Non-approved and unknown emails get the SAME neutral response —
 * no leakage of who is on the allowlist (GATED_BETA_ACCESS_WORKFLOW privacy rule).
 *
 * Pattern mirrors waitlist-form.ts: pure validate function (no DOM), render
 * function returns a DOM element, onSubmit seam for backend wiring.
 *
 * SCOPE GUARD: no real backend in this leg. The default onSubmit shows the
 * neutral "check your inbox" confirmation; real wiring connects
 * POST /api/beta/magic-link/request in GOV-800 (backend child issue).
 */

export interface MagicLinkSubmission {
  email: string;
}

export interface MagicLinkValidation {
  ok: boolean;
  emailError?: string;
}

/** Pure email pre-check — backend is the real authority. */
export function validateMagicLink(input: Partial<MagicLinkSubmission>): MagicLinkValidation {
  const email = (input.email ?? '').trim();
  if (!email) return { ok: false, emailError: 'Enter your email address.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, emailError: "That email doesn't look right — check for a typo." };
  return { ok: true };
}

export interface MagicLinkFormOptions {
  /**
   * Called with the validated email on submit.
   * Default: show neutral confirmation (no hash change — magic link needs real backend).
   * GOV-800 wires this to POST /api/beta/magic-link/request.
   */
  onSubmit?: (submission: MagicLinkSubmission) => void;
}

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

/** Default demo submit: show neutral confirmation, no hash advance (real backend required). */
function demoSubmit(form: HTMLFormElement, confirmation: HTMLElement): void {
  confirmation.textContent =
    "If your email is approved for beta, check your inbox — a magic link is on its way. " +
    "It expires in 15 minutes.";
  confirmation.removeAttribute('hidden');
  form.querySelectorAll('input, button').forEach((el) => (el as HTMLInputElement).setAttribute('disabled', ''));
}

export function renderMagicLinkForm(opts: MagicLinkFormOptions = {}): HTMLFormElement {
  const emailInput = el('input', {
    type: 'email',
    id: 'gw-ml-email',
    name: 'email',
    class: 'gw-ml-input',
    autocomplete: 'email',
    inputmode: 'email',
    required: 'required',
    placeholder: 'you@example.com',
    'aria-describedby': 'gw-ml-email-error',
    'data-test': 'ml-email',
  });

  const emailError = el('p', {
    id: 'gw-ml-email-error',
    class: 'gw-ml-error',
    'data-test': 'ml-email-error',
    role: 'alert',
    'aria-live': 'assertive',
    hidden: 'hidden',
  });

  const confirmation = el('p', {
    class: 'gw-ml-confirm',
    'data-test': 'ml-confirmation',
    role: 'status',
    'aria-live': 'polite',
    hidden: 'hidden',
  });

  const submitBtn = el(
    'button',
    { type: 'submit', class: 'gw-gate-action gw-ml-submit', 'data-test': 'ml-submit' },
    ['Send magic link'],
  );

  const form = el(
    'form',
    {
      class: 'gw-ml-form',
      'data-test': 'ml-form',
      'aria-label': 'Login with a magic link',
      novalidate: 'novalidate',
    },
    [
      el('label', { for: 'gw-ml-email', class: 'gw-ml-label' }, ['Email address']),
      emailInput,
      emailError,
      submitBtn,
      confirmation,
    ],
  );

  form.addEventListener('submit', (evt) => {
    evt.preventDefault();
    const submission: MagicLinkSubmission = { email: emailInput.value.trim() };
    const result = validateMagicLink(submission);
    if (!result.ok) {
      emailError.textContent = result.emailError ?? 'Check the form and try again.';
      emailError.removeAttribute('hidden');
      emailInput.setAttribute('aria-invalid', 'true');
      emailInput.focus();
      return;
    }
    emailError.setAttribute('hidden', 'hidden');
    emailInput.removeAttribute('aria-invalid');
    if (opts.onSubmit) {
      opts.onSubmit(submission);
    } else {
      demoSubmit(form, confirmation);
    }
  });

  return form;
}

export const MAGIC_LINK_STYLE = `
.gw-ml-form{margin:var(--gw-space-3) 0 0}
.gw-ml-label{display:block;font-size:var(--gw-text-sm);font-weight:600;margin:0 0 var(--gw-space-2);color:var(--gw-text-secondary)}
.gw-ml-input{display:block;width:100%;box-sizing:border-box;min-height:var(--gw-tap-min);padding:var(--gw-space-2) var(--gw-space-3);font:var(--gw-text-body)/1.4 var(--gw-font);color:var(--gw-text);background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);margin-bottom:var(--gw-space-3)}
.gw-ml-input:focus-visible{outline:2px solid var(--gw-accent);outline-offset:1px;border-color:var(--gw-accent)}
.gw-ml-input[aria-invalid="true"]{border-color:var(--gw-stop-border)}
.gw-ml-error{font-size:var(--gw-text-sm);color:var(--gw-stop-text);margin:calc(-1 * var(--gw-space-2)) 0 var(--gw-space-3)}
.gw-ml-error[hidden]{display:none}
.gw-ml-submit{border:0;cursor:pointer}
.gw-ml-confirm{font-size:var(--gw-text-body);color:var(--gw-ok-text);background:var(--gw-ok-bg);border:var(--gw-border-w) solid var(--gw-ok-text);border-radius:var(--gw-radius);padding:var(--gw-space-3);margin:var(--gw-space-3) 0 0}
.gw-ml-confirm[hidden]{display:none}
`;
