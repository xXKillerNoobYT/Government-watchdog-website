/**
 * GOV-1566 F1 — Gated upload surface (implements F0 `docs/gov1568-upload-ux-spec.md`
 * against Backend **B3 GOV-1576**).
 *
 * Two layers live here, mirroring the `landing.ts` precedent (pure content +
 * render + style in one surface module):
 *
 *  1. A PURE core (copy, constraints, validation, status projection) with NO DOM
 *     or File-API dependency, so every honesty rule (never-verified, fail-closed,
 *     web-safe) is unit-testable and restyle-safe. Copy strings live in ONE place
 *     ({@link UPLOAD_COPY}) so the UXR leg and Isaac review wording in one spot
 *     (F0 §9.5) — exactly like `gatePanelContent`.
 *  2. A thin DOM renderer (`renderGatedUpload`) that maps the pure state machine
 *     to nodes. It NEVER derives trust: a receipt's status is projected 1:1 by
 *     {@link projectReviewState} (fail-closed), and there is no verified/published
 *     value it can render.
 *
 * The intake backend (B3 GOV-1576) is now `done`, so `main.ts` injects the real
 * {@link createHttpIntakeTransport} (`wired: true`) — an authenticated POST to
 * `/api/beta/intake/upload`. The raw backend `review_state` it returns is
 * PROJECTED to the coarse web-safe bucket inside the transport
 * ({@link projectBackendReviewState}) and never crosses into the receipt DOM. The
 * fail-closed {@link scaffoldIntakeTransport} (`wired: false`) is retained for
 * tests and any deliberately non-functional surface; swapping the two changes no
 * DOM, validation, ARIA, or copy.
 */

import type {
  IntakeBytesSource,
  IntakeConstraints,
  IntakeOutcome,
  IntakeReceipt,
  IntakeRejectionReason,
  StagedUpload,
  UploadIntakeTransport,
  UploadReviewState,
} from '../types/upload-intake';
import {
  CONSERVATIVE_UPLOAD_REVIEW_STATE,
  isUploadReviewState,
} from '../types/upload-intake';
import { GW_TOKENS } from './tokens';
import { safeExternalHref } from '../data/web-safe';

// ---------------------------------------------------------------------------
// Pure core — copy, constraints, validation, projection
// ---------------------------------------------------------------------------

/**
 * The one place upload wording is defined (C1–C7 from F0 §5). Kept as data so a
 * copy review touches strings, not DOM. Every string here obeys: transfer ≠
 * processing, receipt ≠ verification, no content before review, files-not-people,
 * fail-closed wording, no internal leakage.
 */
export const UPLOAD_COPY = {
  heading: 'Upload a source file',
  /** C1 — pre-submission honesty: uploading ≠ publishing. */
  purposeNote:
    'Files are reviewed before anything from them is shown or used. Uploading a file ' +
    'here does not publish it, verify it, or add it as a source — it queues it for review.',
  fileLabel: 'Choose a file',
  originLabel: 'Where did this file come from?',
  originHint: 'e.g. “Town of Alpine clerk, emailed 2026-06-09”',
  /** GOV-1609 §3.2 — the kind picker replaces the old free-text "What is this file?". */
  descriptionLabel: 'What kind of file is this?',
  /** GOV-1609 §3.1 — non-value placeholder option; no kind is preselected (W1). */
  descriptionPlaceholderOption: 'Choose a kind…',
  submitLabel: 'Upload for review',
  /** C2 — transfer only; never "processing/analyzing/verifying". */
  uploadingStatus: 'Uploading… please don’t close this tab.',
  cancelLabel: 'Cancel',
  cancelledMessage:
    'Upload canceled. We couldn’t confirm it was received, so this page will not show a receipt. You can try again.',
  /** C3 — a queue receipt, not a verification. */
  successHeading: 'Received — queued for review.',
  /** C5 — held is a file state, never a judgement about the person. */
  heldHeading: 'Received. Held for additional review.',
  /** C4 — no content before review. Same placeholder for pending and held. */
  pendingPlaceholder:
    'This file hasn’t been reviewed yet. Nothing from it is shown or used until a reviewer checks it.',
  uploadAnother: 'Upload another file',
  retry: 'Try again',
  provenanceEchoHeading: 'What you told us about this file',
} as const;

/**
 * GOV-1609 §3.1 — the closed document-kind taxonomy for `source_type`.
 *
 * Each entry is a claim the **uploader** makes about their OWN file — like
 * choosing the file itself — and asserts NOTHING about the document's content
 * truth (W1-safe: none of these are values lifted from a fixture or `.dc.html`
 * reference). The list is deliberately short with an always-available escape
 * hatch (`Other document`) so no upload is ever blocked by taxonomy. The chosen
 * label is sent to B3 as `source_type` **verbatim** — a taxonomy value, never
 * prose — so files can be grouped/filtered by kind. There is no preselected
 * default (that would fabricate an assertion about the file), and `Other
 * document` does NOT open a secondary free-text field (prose belongs in the
 * free-text origin field, never back in this taxonomy column).
 */
export const UPLOAD_KIND_OPTIONS = [
  'Meeting minutes',
  'Agenda or meeting packet',
  'Ordinance or resolution',
  'Notice or public announcement',
  'Correspondence (letter or email)',
  'Financial or budget document',
  'Report or study',
  'Other document',
] as const;

export type UploadKind = (typeof UPLOAD_KIND_OPTIONS)[number];

/**
 * Client mirror of B3's mime allow-list + size cap. PLACEHOLDER values until B3
 * publishes the authoritative constraints; the server remains the real gate.
 * Chosen conservatively (documents + images + plain text, 25 MB) so the client
 * pre-check never *accepts* something the server would reject on a stricter list
 * — a client that is stricter-or-equal can only spare a wasted request, never
 * wave through a bad one.
 */
export const DEFAULT_INTAKE_CONSTRAINTS: IntakeConstraints = {
  acceptedMimeTypes: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/plain',
  ],
  acceptedLabel: 'PDF, PNG or JPEG image, or plain text',
  maxBytes: 25 * 1024 * 1024,
};

/** Human file size for constraint copy / error messages. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

/** Per-field validation result (mechanical, pre-transfer — never a truth claim). */
export interface UploadValidation {
  ok: boolean;
  fileError?: string;
  originError?: string;
  descriptionError?: string;
}

/**
 * Pure, DOM-free, mechanical validation (F0 §3.2). Checks ONLY format, size, and
 * required-provenance presence — it says NOTHING about the file's content or
 * truth. Errors are specific and actionable, never a bare "invalid".
 */
export function validateStagedUpload(
  staged: StagedUpload,
  constraints: IntakeConstraints = DEFAULT_INTAKE_CONSTRAINTS,
): UploadValidation {
  const result: UploadValidation = { ok: true };
  const file = staged.file;

  if (!file || !file.name || file.sizeBytes <= 0) {
    result.ok = false;
    result.fileError = 'Choose a file to upload.';
  } else if (!constraints.acceptedMimeTypes.includes(file.mimeType)) {
    result.ok = false;
    result.fileError = `That file type isn’t accepted here. Accepted: ${constraints.acceptedLabel}.`;
  } else if (file.sizeBytes > constraints.maxBytes) {
    result.ok = false;
    result.fileError =
      `That file is ${formatBytes(file.sizeBytes)} — larger than the ` +
      `${formatBytes(constraints.maxBytes)} limit.`;
  }

  if (!staged.provenance.sourceOrigin.trim()) {
    result.ok = false;
    result.originError = 'Say where this file came from before uploading.';
  }
  if (!staged.provenance.description.trim()) {
    result.ok = false;
    // GOV-1609 §3.2 — the description is now a bounded kind selection.
    result.descriptionError = 'Pick what kind of file this is before uploading.';
  }
  return result;
}

/**
 * Project a backend-supplied status to the coarse web-safe bucket, VERBATIM and
 * FAIL-CLOSED — the client never derives, upgrades, or invents trust (mirrors
 * `verificationStatusLabel()`). Accepts either a raw status string or a receipt.
 * Anything not exactly on the {@link UploadReviewState} vocabulary — absent,
 * null, unknown, or an off-list string — collapses to the most conservative
 * bucket (`review_pending`). It can NEVER return a verified/published value
 * because none exists in the vocabulary.
 */
export function projectReviewState(raw: unknown): UploadReviewState {
  if (isUploadReviewState(raw)) return raw;
  if (raw && typeof raw === 'object' && 'status' in raw) {
    const status = (raw as IntakeReceipt).status;
    if (isUploadReviewState(status)) return status;
  }
  return CONSERVATIVE_UPLOAD_REVIEW_STATE;
}

/** The honest chip shown for a projected status. Verbatim label + a tone token
 *  that is ALWAYS the not-yet-trusted end of the legend — never `source-backed`. */
export function reviewStateChip(status: UploadReviewState): { label: string; tone: string } {
  switch (status) {
    case 'received':
      return { label: 'Received', tone: 'pending' };
    case 'held':
      return { label: 'Held for review', tone: 'held' };
    case 'review_pending':
    default:
      return { label: 'Review pending', tone: 'pending' };
  }
}

/**
 * Resident-readable, fail-closed message for a rejection reason (C5/C6: no
 * blame, no server internals, unconfirmed ⇒ "nothing was saved"). An unknown
 * reason collapses to the generic fail-closed line.
 */
export function rejectionMessage(
  reason: IntakeRejectionReason,
  constraints: IntakeConstraints = DEFAULT_INTAKE_CONSTRAINTS,
): string {
  switch (reason) {
    case 'unauthorized':
      return 'This upload area isn’t open for your account right now. Nothing was sent.';
    case 'unsupported_type':
      return `That file type isn’t accepted here. Accepted: ${constraints.acceptedLabel}. Nothing was sent.`;
    case 'too_large':
      return `That file is larger than the ${formatBytes(constraints.maxBytes)} limit. Nothing was sent.`;
    case 'missing_provenance':
      return 'Add where the file came from and what it is, then upload again.';
    case 'quota':
      return 'You’ve reached the upload limit for now. Nothing was sent — please try again later.';
    case 'backend_unavailable':
      return 'The upload service isn’t available right now. Nothing was saved. Please try again.';
    case 'unknown':
    default:
      return 'We couldn’t confirm your upload — nothing was saved. Please try again.';
  }
}

/**
 * A note shown when the surface is running against a non-wired transport. Honest
 * scaffolding label (F0 §9.6), the upload analogue of the beta gate's
 * `SCAFFOLDING_NOTE`.
 */
export const UPLOAD_SCAFFOLDING_NOTE =
  'Non-functional scaffolding — the gated intake backend (B3) is not wired yet, so ' +
  'this form cannot actually send a file. The states below are the real UI; when the ' +
  'intake API lands, submitting will transfer for review with no other changes.';

/**
 * The fail-closed scaffold transport. It NEVER reports success — every submit
 * resolves to a `backend_unavailable` rejection, so the surface can only ever
 * reach its honest error state, never a fake receipt. Retained for tests and any
 * surface deliberately kept non-functional; the live route uses
 * {@link createHttpIntakeTransport}. The `source` arg is ignored (no bytes are
 * ever sent).
 */
export const scaffoldIntakeTransport: UploadIntakeTransport = {
  wired: false,
  async submit(): Promise<IntakeOutcome> {
    return { ok: false, rejection: { reason: 'backend_unavailable' } };
  },
};

/** B3's intake route (GOV-1576). Same-origin so the beta session cookie rides. */
export const INTAKE_UPLOAD_ROUTE = '/api/beta/intake/upload';

/**
 * The `area` (jurisdiction scope) tag sent with every intake. Alpine-first
 * (expansion is gated), so this is a fixed deployment scope, NOT a civic value
 * derived from the file — it never implies anything about the document's content.
 */
export const INTAKE_AREA = 'alpine';

/**
 * Project B3's RAW internal `review_state` (`pending | reviewing | web_safe |
 * held | rejected`, per `0028_supplied_file_records.sql`) to the coarse web-safe
 * bucket the uploader may see — VERBATIM and FAIL-CLOSED, exactly like
 * {@link projectReviewState} but for the write-side receipt. The raw string is
 * consumed here and NEVER returned, so it cannot reach the DOM (it is on
 * `RAW_PATH_FORBIDDEN_KEYS`). A fresh accept is always `pending` ⇒ `received`;
 * anything not explicitly mapped collapses to the conservative `review_pending`
 * and can NEVER be upgraded toward a verified/published value (none exists here).
 */
export function projectBackendReviewState(raw: unknown): UploadReviewState {
  switch (raw) {
    case 'pending':
      return 'received';
    case 'held':
      return 'held';
    // 'reviewing' / 'web_safe' / 'rejected' / unknown / absent: never surface an
    // upgraded value on the upload receipt — fail closed to the conservative bucket.
    default:
      return CONSERVATIVE_UPLOAD_REVIEW_STATE;
  }
}

/** Chunked base64 of raw bytes — safe for the 25 MiB cap (no stack blow-up). */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000; // 32 KiB argument-count-safe window
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

/** Map a B3 HTTP status to a fail-closed rejection reason. */
function statusToRejectionReason(status: number): IntakeRejectionReason {
  switch (status) {
    case 401:
    case 403:
    case 404: // flag-off ⇒ 404, or the surface isn't open here: not authorized.
      return 'unauthorized';
    case 413:
      return 'too_large';
    case 415:
      return 'unsupported_type';
    case 503:
      return 'backend_unavailable';
    // 400 (bad body) and 422 (known-bad) and any other non-2xx: unconfirmed ⇒
    // the generic "nothing was saved" line; never blame, never leak the denylist.
    default:
      return 'unknown';
  }
}

/** Options for {@link createHttpIntakeTransport} (all injectable for tests). */
export interface HttpIntakeTransportOptions {
  /** Intake endpoint. Default {@link INTAKE_UPLOAD_ROUTE} (same-origin). */
  endpoint?: string;
  /** Jurisdiction scope tag. Default {@link INTAKE_AREA}. */
  area?: string;
  /** Injected `fetch` (tests). Default `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * The real, authenticated B3 intake transport (GOV-1576). It streams the staged
 * file to `/api/beta/intake/upload` with the beta session cookie
 * (`credentials: 'include'`) and returns a coarse, web-safe {@link IntakeOutcome}.
 *
 * Honesty invariants enforced here (F0 §6, parent plan):
 *  - The request body carries ONLY what B3 requires plus the uploader's own
 *    words; `supplied_by` is NEVER sent (B3 derives it from the session — a
 *    caller cannot forge who supplied a file).
 *  - The 201 `review_state` is projected to a coarse bucket
 *    ({@link projectBackendReviewState}); the raw value is dropped, so no internal
 *    state, path, hash, or `file_id` can reach the receipt DOM.
 *  - Every failure — non-2xx, network error, malformed body, or a success with no
 *    bytes to send — resolves to a rejection, never an optimistic receipt.
 */
export function createHttpIntakeTransport(
  options: HttpIntakeTransportOptions = {},
): UploadIntakeTransport {
  const endpoint = options.endpoint ?? INTAKE_UPLOAD_ROUTE;
  const area = options.area ?? INTAKE_AREA;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  return {
    wired: true,
    async submit(
      staged: StagedUpload,
      source?: IntakeBytesSource,
      signal?: AbortSignal,
    ): Promise<IntakeOutcome> {
      const file = staged.file;
      // Defensive: the renderer validates before calling, but never send a claim
      // we can't back with bytes.
      if (!file || !source) {
        return { ok: false, rejection: { reason: 'unknown' } };
      }
      if (signal?.aborted) {
        return { ok: false, rejection: { reason: 'unknown' } };
      }

      let contentBase64: string;
      try {
        const buffer = await source.arrayBuffer();
        if (signal?.aborted) {
          return { ok: false, rejection: { reason: 'unknown' } };
        }
        contentBase64 = bytesToBase64(new Uint8Array(buffer));
      } catch {
        return { ok: false, rejection: { reason: 'unknown' } };
      }

      // B3's required body (scripts/beta/intake_api.py). `source_type` and
      // `origin_url` carry the uploader's OWN words verbatim — user-supplied
      // input, never a derived or invented civic value. `supplied_by` is omitted
      // deliberately (server-derived from the session).
      const originText = staged.provenance.sourceOrigin.trim();
      const body: Record<string, string> = {
        area,
        source_type: staged.provenance.description.trim(),
        original_filename: file.name,
        mime: file.mimeType,
        content_base64: contentBase64,
      };
      if (originText) body.origin_url = originText;

      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        });
      } catch {
        // Network failure / offline / DNS: the service isn't reachable.
        return { ok: false, rejection: { reason: 'backend_unavailable' } };
      }

      if (!response.ok) {
        return { ok: false, rejection: { reason: statusToRejectionReason(response.status) } };
      }
      if (signal?.aborted) {
        return { ok: false, rejection: { reason: 'unknown' } };
      }

      // Parse the receipt defensively; a malformed 2xx body is still a success
      // (bytes were accepted) but projects fail-closed to the conservative bucket.
      let rawStatus: unknown;
      try {
        const json = (await response.json()) as { review_state?: unknown };
        rawStatus = json?.review_state;
      } catch {
        rawStatus = undefined;
      }
      if (signal?.aborted) {
        return { ok: false, rejection: { reason: 'unknown' } };
      }
      const receipt: IntakeReceipt = { status: projectBackendReviewState(rawStatus) };
      return { ok: true, receipt };
    },
  };
}

// ---------------------------------------------------------------------------
// DOM renderer
// ---------------------------------------------------------------------------

/** The visible phases of the surface (one at a time). */
export type UploadPhase =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'received'
  | 'held'
  | 'error';

export interface GatedUploadOptions {
  transport?: UploadIntakeTransport;
  constraints?: IntakeConstraints;
  /**
   * Force a phase for screenshots / review (like the timeline's `?state=`). When
   * set, the surface renders that phase statically instead of the interactive
   * idle form. `receiptStatus`/`rejectionReason` seed the forced success/error.
   */
  forcedPhase?: UploadPhase;
  forcedReceiptStatus?: UploadReviewState;
  forcedRejectionReason?: IntakeRejectionReason;
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

/** Read-only echo of the uploader's own provenance (safe — it's their input). */
function provenanceEcho(provenance: StagedUpload['provenance']): HTMLElement {
  return el('dl', { class: 'gw-up-echo', 'data-test': 'upload-provenance-echo' }, [
    el('dt', {}, [UPLOAD_COPY.originLabel]),
    el('dd', {}, [provenance.sourceOrigin || '—']),
    el('dt', {}, [UPLOAD_COPY.descriptionLabel]),
    el('dd', {}, [provenance.description || '—']),
  ]);
}

/** The honest pending/held receipt body: chip + content-free placeholder. */
function receiptEl(
  status: UploadReviewState,
  provenance: StagedUpload['provenance'],
  onAnother: () => void,
): HTMLElement {
  const chip = reviewStateChip(status);
  const heldLike = status === 'held';
  const wrap = el(
    'section',
    {
      class: 'gw-up-receipt',
      'data-test': heldLike ? 'upload-held' : 'upload-success-pending',
      'data-phase': heldLike ? 'held' : 'received',
    },
    [
      el('div', { class: 'gw-up-receipt-head' }, [
        el('h3', { class: 'gw-up-receipt-title' }, [
          heldLike ? UPLOAD_COPY.heldHeading : UPLOAD_COPY.successHeading,
        ]),
        // Chip carries a TEXT label (not colour alone) — WCAG, §7.
        el(
          'span',
          { class: `gw-up-chip gw-up-chip-${chip.tone}`, 'data-test': 'review-state-chip', 'data-status': status },
          [chip.label],
        ),
      ]),
      // C4 — placeholder where content WOULD later appear, empty of content.
      el('p', { class: 'gw-up-placeholder', 'data-test': 'review-pending-placeholder' }, [
        UPLOAD_COPY.pendingPlaceholder,
      ]),
      el('h4', { class: 'gw-up-echo-title' }, [UPLOAD_COPY.provenanceEchoHeading]),
      provenanceEcho(provenance),
    ],
  );
  const again = el('button', { type: 'button', class: 'gw-up-btn-ghost', 'data-test': 'upload-another' }, [
    UPLOAD_COPY.uploadAnother,
  ]);
  again.addEventListener('click', onAnother);
  wrap.append(again);
  return wrap;
}

/** The error body: fail-closed, specific, recoverable — never a server internal. */
function errorEl(message: string, onRetry: () => void): HTMLElement {
  const wrap = el(
    'section',
    { class: 'gw-up-error', 'data-test': 'upload-error', 'data-phase': 'error', role: 'alert' },
    [el('p', { class: 'gw-up-error-msg' }, [message])],
  );
  const retry = el('button', { type: 'button', class: 'gw-up-btn', 'data-test': 'upload-retry' }, [
    UPLOAD_COPY.retry,
  ]);
  retry.addEventListener('click', onRetry);
  wrap.append(retry);
  return wrap;
}

/** The in-progress body: transfer-only status + cancel; inputs are locked. */
function uploadingEl(onCancel: () => void): HTMLElement {
  const wrap = el(
    'section',
    { class: 'gw-up-progress', 'data-test': 'upload-inprogress', 'data-phase': 'uploading' },
    [
      el('div', { class: 'gw-up-spinner', 'aria-hidden': 'true' }),
      el('p', { class: 'gw-up-progress-msg' }, [UPLOAD_COPY.uploadingStatus]),
    ],
  );
  const cancel = el('button', { type: 'button', class: 'gw-up-btn-ghost', 'data-test': 'upload-cancel' }, [
    UPLOAD_COPY.cancelLabel,
  ]);
  cancel.addEventListener('click', onCancel);
  wrap.append(cancel);
  return wrap;
}

/**
 * Render the interactive gated upload surface into `mount`. Assumes the caller
 * has ALREADY gated on `approved` (the route wrapper does this); this body never
 * renders for a non-authorized state.
 */
export function renderGatedUpload(mount: HTMLElement, options: GatedUploadOptions = {}): void {
  ensureUploadStyle();
  const transport = options.transport ?? scaffoldIntakeTransport;
  const constraints = options.constraints ?? DEFAULT_INTAKE_CONSTRAINTS;

  mount.replaceChildren();
  const surface = el('section', {
    class: 'gw-up-surface',
    'data-test': 'upload-surface',
  });
  mount.append(surface);

  surface.append(
    el('h2', { class: 'gw-up-heading' }, [UPLOAD_COPY.heading]),
    el('p', { class: 'gw-up-purpose', 'data-test': 'upload-purpose' }, [UPLOAD_COPY.purposeNote]),
  );
  if (!transport.wired) {
    surface.append(
      el('p', { class: 'gw-up-scaffold gw-muted', 'data-test': 'upload-scaffold-note' }, [
        UPLOAD_SCAFFOLDING_NOTE,
      ]),
    );
  }

  // The swappable body region + a polite live region announcing phase changes.
  const body = el('div', { class: 'gw-up-body' });
  const live = el('div', { class: 'gw-up-live', 'aria-live': 'polite', 'data-test': 'upload-live' });
  surface.append(body, live);

  // Mutable staged state (only the metadata the pure validator needs).
  const staged: StagedUpload = { file: null, provenance: { sourceOrigin: '', description: '' } };
  // The real File is held OFF the pure `staged` type — only the transport reads
  // its bytes. Persists across validation re-renders (the <input type=file> is
  // recreated empty by the browser, but the retained handle keeps the choice).
  let rawFile: File | null = null;
  let operationGeneration = 0;
  let activeOperation: { id: number; controller: AbortController } | null = null;

  const announce = (msg: string): void => {
    live.textContent = msg;
  };

  const showForm = (validation?: UploadValidation): void => {
    body.replaceChildren();
    const phase: UploadPhase = validation ? 'validating' : 'idle';

    const form = el('form', {
      class: 'gw-up-form',
      'data-test': 'upload-form',
      'data-phase': phase,
      novalidate: 'novalidate',
    });

    // File field — real keyboard-reachable <input type=file>; drag-drop would be
    // an enhancement layered on top, never the only path (§7).
    const fileInput = el('input', {
      type: 'file',
      id: 'gw-up-file',
      class: 'gw-up-file',
      'data-test': 'upload-file-input',
      accept: constraints.acceptedMimeTypes.join(','),
    }) as HTMLInputElement;
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      rawFile = f ?? null;
      staged.file = f ? { name: f.name, sizeBytes: f.size, mimeType: f.type } : null;
      // GOV-1609 §3.1 — submit stays disabled until BOTH a file and a kind exist.
      submitBtn.disabled = !staged.file || !staged.provenance.description;
    });

    const originInput = el('input', {
      type: 'text',
      id: 'gw-up-origin',
      class: 'gw-up-input',
      'data-test': 'upload-provenance-origin',
      placeholder: UPLOAD_COPY.originHint,
    }) as HTMLInputElement;
    originInput.value = staged.provenance.sourceOrigin;
    originInput.addEventListener('input', () => {
      staged.provenance.sourceOrigin = originInput.value;
    });

    // GOV-1609 §3 — bounded document-kind picker (was a free-text input). A
    // taxonomy field fed prose can never group/filter; a `<select>` keeps
    // `source_type` a real kind. No kind is preselected (W1): the first option is
    // a valueless placeholder, so `staged.provenance.description` stays '' — which
    // the pure validator already treats as "missing provenance".
    const descSelect = el('select', {
      id: 'gw-up-desc',
      class: 'gw-up-select',
      'data-test': 'upload-provenance-description',
    }) as HTMLSelectElement;
    const placeholderOpt = el('option', { value: '', disabled: 'disabled' }, [
      UPLOAD_COPY.descriptionPlaceholderOption,
    ]) as HTMLOptionElement;
    descSelect.append(placeholderOpt);
    for (const kind of UPLOAD_KIND_OPTIONS) {
      descSelect.append(el('option', { value: kind }, [kind]));
    }
    // Reflect any retained selection across a validation re-render; '' ⇒ the
    // placeholder is shown and nothing is chosen.
    descSelect.value = staged.provenance.description;
    if (validation?.descriptionError) {
      descSelect.setAttribute('aria-invalid', 'true');
      descSelect.setAttribute('aria-describedby', 'upload-error-description');
    }
    descSelect.addEventListener('change', () => {
      staged.provenance.description = descSelect.value;
      submitBtn.disabled = !staged.file || !staged.provenance.description;
    });

    const submitBtn = el(
      'button',
      { type: 'submit', class: 'gw-up-btn', 'data-test': 'upload-submit' },
      [UPLOAD_COPY.submitLabel],
    ) as HTMLButtonElement;
    submitBtn.disabled = !staged.file || !staged.provenance.description;

    // Inline field error: icon + text + colour (colour is never the sole error
    // carrier — W6/A4). The icon is `aria-hidden` so a screen reader announces
    // only the message; `id === data-test` so a control can `aria-describedby` it.
    const fieldErr = (test: string, msg?: string): HTMLElement | null =>
      msg
        ? el('p', { class: 'gw-up-field-err', id: test, 'data-test': test, role: 'alert' }, [
            el('span', { class: 'gw-up-err-icon', 'aria-hidden': 'true' }, ['⚠']),
            msg,
          ])
        : null;

    form.append(
      el('label', { class: 'gw-up-label', for: 'gw-up-file' }, [UPLOAD_COPY.fileLabel]),
      el('p', { class: 'gw-up-constraints gw-muted', 'data-test': 'upload-constraints' }, [
        `Accepted: ${constraints.acceptedLabel}. Max size ${formatBytes(constraints.maxBytes)}.`,
      ]),
      fileInput,
    );
    const fe = fieldErr('upload-error-file', validation?.fileError);
    if (fe) form.append(fe);

    form.append(el('label', { class: 'gw-up-label', for: 'gw-up-origin' }, [UPLOAD_COPY.originLabel]), originInput);
    const oe = fieldErr('upload-error-origin', validation?.originError);
    if (oe) form.append(oe);

    form.append(el('label', { class: 'gw-up-label', for: 'gw-up-desc' }, [UPLOAD_COPY.descriptionLabel]), descSelect);
    const de = fieldErr('upload-error-description', validation?.descriptionError);
    if (de) form.append(de);

    form.append(submitBtn);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void handleSubmit();
    });

    body.append(form);
  };

  const handleSubmit = async (): Promise<void> => {
    const validation = validateStagedUpload(staged, constraints);
    if (!validation.ok) {
      showForm(validation); // validating → inline errors, file NOT sent
      announce('Please fix the highlighted fields before uploading.');
      return;
    }
    const operation = {
      id: ++operationGeneration,
      controller: new AbortController(),
    };
    activeOperation = operation;
    // The form model is mutable and reset on retry/cancel. Each operation owns
    // an immutable snapshot so later UI activity cannot rewrite its request.
    const submission: StagedUpload = {
      file: staged.file ? { ...staged.file } : null,
      provenance: { ...staged.provenance },
    };
    const bytesSource = rawFile ?? undefined;

    showUploading();
    announce(UPLOAD_COPY.uploadingStatus);
    let outcome: IntakeOutcome;
    try {
      outcome = await transport.submit(submission, bytesSource, operation.controller.signal);
    } catch {
      // Any thrown/unknown failure is fail-closed: nothing was saved.
      outcome = { ok: false, rejection: { reason: 'unknown' } };
    }
    // Abort is only best-effort. Operation identity is the rendering boundary:
    // a retired completion cannot replace cancel/error/form/newer-operation UI.
    if (activeOperation?.id !== operation.id) return;
    activeOperation = null;
    if (outcome.ok) {
      const status = projectReviewState(outcome.receipt);
      showReceipt(status, submission.provenance);
    } else {
      showError(rejectionMessage(outcome.rejection.reason, constraints), true);
    }
  };

  const resetToForm = (focusFile = false): void => {
    staged.file = null;
    staged.provenance = { sourceOrigin: '', description: '' };
    rawFile = null;
    showForm();
    announce('');
    if (focusFile) {
      (body.querySelector('[data-test="upload-file-input"]') as HTMLInputElement | null)?.focus();
    }
  };

  const cancelActiveUpload = (): void => {
    const operation = activeOperation;
    activeOperation = null;
    operation?.controller.abort();
    showError(UPLOAD_COPY.cancelledMessage, true);
  };

  const showUploading = (): void => {
    body.replaceChildren();
    body.append(uploadingEl(cancelActiveUpload));
  };
  const showReceipt = (
    status: UploadReviewState,
    provenance: StagedUpload['provenance'] = staged.provenance,
  ): void => {
    body.replaceChildren();
    body.append(receiptEl(status, provenance, () => resetToForm(true)));
    const chip = reviewStateChip(status);
    announce(`${chip.label}. ${UPLOAD_COPY.pendingPlaceholder}`);
  };
  const showError = (message: string, focusRetry = false): void => {
    body.replaceChildren();
    const error = errorEl(message, () => resetToForm(true));
    body.append(error);
    announce(message);
    if (focusRetry) {
      (error.querySelector('[data-test="upload-retry"]') as HTMLButtonElement | null)?.focus();
    }
  };

  // Forced-phase (screenshot / review) path renders a static snapshot.
  switch (options.forcedPhase) {
    case 'uploading':
      showUploading();
      return;
    case 'received':
      showReceipt(options.forcedReceiptStatus ?? 'received');
      return;
    case 'held':
      showReceipt('held');
      return;
    case 'error':
      showError(rejectionMessage(options.forcedRejectionReason ?? 'backend_unavailable', constraints));
      return;
    case 'validating':
      showForm(validateStagedUpload(staged, constraints));
      return;
    case 'idle':
    default:
      showForm();
  }
}

// ---------------------------------------------------------------------------
// Style (tokens only — restyle-safe, colour never the sole signal)
// ---------------------------------------------------------------------------

export const GATED_UPLOAD_STYLE = `${GW_TOKENS}
.gw-up-surface{font-family:var(--gw-font);color:var(--gw-text);max-width:44rem;margin:0 auto}
.gw-up-heading{font-size:var(--gw-text-xl);margin:0 0 var(--gw-space-2);line-height:var(--gw-leading-tight)}
.gw-up-purpose{margin:0 0 var(--gw-space-4);color:var(--gw-text-secondary)}
.gw-up-scaffold{font-size:.8rem;margin:0 0 var(--gw-space-4);border:var(--gw-border-w) dashed var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-3)}
.gw-muted{color:var(--gw-text-muted)}
.gw-up-form{display:flex;flex-direction:column;gap:var(--gw-space-2);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-5);background:var(--gw-surface)}
.gw-up-label{font-weight:600;margin-top:var(--gw-space-3)}
.gw-up-constraints{font-size:.82rem;margin:0}
.gw-up-file,.gw-up-input,.gw-up-select{font:inherit;padding:var(--gw-space-2) var(--gw-space-3);border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius);background:var(--gw-page-bg);color:var(--gw-text);min-height:var(--gw-tap-min);box-sizing:border-box}
.gw-up-select{align-self:flex-start;max-width:100%}
.gw-up-input:focus-visible,.gw-up-file:focus-visible,.gw-up-select:focus-visible{outline:2px solid var(--gw-accent);outline-offset:2px}
.gw-up-field-err{display:flex;align-items:center;gap:var(--gw-space-1);color:var(--gw-stop-text);font-size:.85rem;margin:0}
.gw-up-err-icon{font-size:.9rem;line-height:1}
.gw-up-btn{align-self:flex-start;margin-top:var(--gw-space-4);min-height:var(--gw-tap-min);padding:var(--gw-space-2) var(--gw-space-5);font:600 1rem/1 var(--gw-font);color:var(--gw-accent-text-on);background:var(--gw-accent);border:var(--gw-border-w) solid var(--gw-accent);border-radius:var(--gw-radius);cursor:pointer}
.gw-up-btn:disabled{opacity:.5;cursor:not-allowed}
.gw-up-btn:focus-visible,.gw-up-btn-ghost:focus-visible{outline:2px solid var(--gw-accent);outline-offset:2px}
.gw-up-btn-ghost{align-self:flex-start;margin-top:var(--gw-space-4);min-height:var(--gw-tap-min);padding:var(--gw-space-2) var(--gw-space-5);font:600 1rem/1 var(--gw-font);color:var(--gw-accent);background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-accent);border-radius:var(--gw-radius);cursor:pointer}
.gw-up-receipt,.gw-up-error,.gw-up-progress{border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-5);background:var(--gw-surface)}
.gw-up-receipt-head{display:flex;align-items:center;gap:var(--gw-space-3);flex-wrap:wrap}
.gw-up-receipt-title{font-size:var(--gw-text-lg);margin:0}
.gw-up-chip{display:inline-block;font-size:var(--gw-text-badge);font-weight:700;border-radius:var(--gw-radius-pill);padding:.15rem var(--gw-space-3);border:var(--gw-border-w) solid;white-space:nowrap}
.gw-up-chip-pending{background:var(--gw-caution-bg);color:var(--gw-caution-text);border-color:var(--gw-caution-text)}
.gw-up-chip-held{background:var(--gw-surface-well);color:var(--gw-text-secondary);border-color:var(--gw-border-strong)}
.gw-up-placeholder{margin:var(--gw-space-3) 0;color:var(--gw-text-secondary);border-left:3px solid var(--gw-border-strong);padding-left:var(--gw-space-3)}
.gw-up-echo-title{font-size:var(--gw-text-sm);margin:var(--gw-space-4) 0 var(--gw-space-1);text-transform:uppercase;letter-spacing:.06em;color:var(--gw-text-muted)}
.gw-up-echo{display:grid;grid-template-columns:auto 1fr;gap:var(--gw-space-1) var(--gw-space-4);margin:0}
.gw-up-echo dt{font-weight:600;color:var(--gw-text-muted)}
.gw-up-echo dd{margin:0}
.gw-up-error-msg{margin:0 0 var(--gw-space-2);color:var(--gw-stop-text)}
.gw-up-progress-msg{margin:var(--gw-space-2) 0}
.gw-up-spinner{width:1.4rem;height:1.4rem;border:3px solid var(--gw-border);border-top-color:var(--gw-accent);border-radius:50%;animation:gw-up-spin 1s linear infinite}
@keyframes gw-up-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.gw-up-spinner{animation:none}}
.gw-up-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`;

let styleInjected = false;
function ensureUploadStyle(): void {
  if (styleInjected) return;
  try {
    document.head.append(el('style', {}, [GATED_UPLOAD_STYLE]));
    styleInjected = true;
  } catch {
    /* non-browser runtime — pure core still works */
  }
}
