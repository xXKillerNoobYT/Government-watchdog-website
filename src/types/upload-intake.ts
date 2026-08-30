/**
 * GOV-1566 F1 — client→backend upload INTAKE contract (consumes Backend **B3
 * "Gated intake API, fail-closed"**, GOV-1576). Spec: `docs/gov1568-upload-ux-spec.md`.
 *
 * This is the WRITE-side boundary and is deliberately SEPARATE from the B6 read
 * projection (`read-api.ts`): the read types describe what the reviewer-internal
 * app is allowed to *display*; these describe the tiny, coarse shape the browser
 * may *send* to intake and the even tinier receipt it gets back. Keeping them
 * apart stops a write-only receipt from leaking into the read allowlist.
 *
 * Three hard rules from the parent plan (§ "web-safe transport only",
 * "review-before-display", "fail-closed & private-by-default") are encoded here:
 *
 *  1. **The uploader-facing status is a coarse, web-safe PROJECTION, never the
 *     internal `review_state`.** `review_state` is on `RAW_PATH_FORBIDDEN_KEYS`
 *     and must never cross the wire. The receipt below carries only
 *     {@link UploadReviewState} — three honest public buckets, no verified value.
 *  2. **A receipt is NOT a verification.** The most-optimistic value an upload
 *     can ever reach on this surface is `review_pending`/`held`. There is no
 *     `verified`/`published`/`source_backed` member — that display is a different
 *     downstream surface with its own gates, never the upload receipt.
 *  3. **Fail closed.** Any unknown/absent status projects to the most
 *     conservative bucket (`review_pending`); any unconfirmed outcome is a
 *     rejection, never a success (see the presenter's `projectReviewState`).
 */

/**
 * The coarse, web-safe uploader-facing review vocabulary (F0 §6). DELIBERATELY
 * NOT the internal backend `review_state` (denylisted). It collapses many
 * internal states into three honest public buckets so no reviewer-internal
 * nuance leaks — and it has NO verified/published member by construction.
 *
 *  - `received`        — bytes stored, entering the review queue.
 *  - `review_pending`  — waiting on / under reviewer review (the conservative default).
 *  - `held`            — accepted but flagged; still no content shown.
 */
export type UploadReviewState = 'received' | 'review_pending' | 'held';

export const UPLOAD_REVIEW_STATES = [
  'received',
  'review_pending',
  'held',
] as const satisfies readonly UploadReviewState[];

/**
 * The fail-closed default. Any missing/unknown/off-vocabulary projected status
 * collapses here — never a blank, and never an upgrade toward "verified".
 */
export const CONSERVATIVE_UPLOAD_REVIEW_STATE = 'review_pending' satisfies UploadReviewState;

export function isUploadReviewState(value: unknown): value is UploadReviewState {
  return typeof value === 'string' && (UPLOAD_REVIEW_STATES as readonly string[]).includes(value);
}

/**
 * Client-side intake constraints. The AUTHORITATIVE values are owned by B3
 * (mime allow-list + max size); the client mirrors them only to give fast,
 * pre-transfer, actionable errors (a spent request is worse UX than a local
 * check). The server remains the real gate — the client check is never the
 * security boundary (F0 §2 backend note).
 */
export interface IntakeConstraints {
  /** Allow-listed MIME types (mirror of B3's server allow-list). */
  acceptedMimeTypes: string[];
  /** Human, resident-readable summary of the accepted kinds (for the form). */
  acceptedLabel: string;
  /** Max bytes accepted (mirror of B3's server cap). */
  maxBytes: number;
}

/**
 * Mandatory provenance the uploader supplies ("preserve versions; provenance
 * mandatory"). B2 (GOV-1575) owns the durable record schema; F0 mandates only
 * that these two fields EXIST and are REQUIRED, not their storage shape. No PII
 * is asked for — the less we hold, the less there is to leak (mirrors the
 * waitlist form's data-minimisation posture).
 */
export interface UploadProvenance {
  /** Where the file came from (e.g. "Town of Alpine clerk email, 2026-06-09"). */
  sourceOrigin: string;
  /** What the file is (e.g. "Signed minutes for the June regular meeting"). */
  description: string;
}

/**
 * A file STAGED in the browser — metadata only. The raw bytes never appear on
 * this type; the transport streams them. Modelling only metadata keeps the pure
 * validator/presenter DOM- and File-API-free and trivially unit-testable.
 */
export interface StagedFileMeta {
  name: string;
  sizeBytes: number;
  mimeType: string;
}

/** Everything the uploader has staged, ready for validation + submit. */
export interface StagedUpload {
  file: StagedFileMeta | null;
  provenance: UploadProvenance;
}

/**
 * The receipt B3 returns on ACCEPT — coarse + web-safe ONLY. No raw path, no
 * hash, no reviewer note, no internal `review_state`, no filename echo. Just the
 * honest projected bucket. `status` absent/unknown ⇒ presenter fails closed to
 * `review_pending`.
 */
export interface IntakeReceipt {
  status?: UploadReviewState | null;
}

/**
 * Why an intake attempt did not become a receipt. A CLOSED enum (no open tail):
 * an unrecognised reason collapses to `unknown` in the presenter, which reads as
 * the generic fail-closed "nothing was saved" copy — never an optimistic result.
 * `unauthorized` covers B3's flag-off→404 and cohort rejection (fail-closed).
 */
export type IntakeRejectionReason =
  | 'unauthorized'
  | 'unsupported_type'
  | 'too_large'
  | 'missing_provenance'
  | 'quota'
  | 'backend_unavailable'
  | 'unknown';

export interface IntakeRejection {
  reason: IntakeRejectionReason;
}

/**
 * The outcome of a submit. A discriminated union so the presenter must handle
 * BOTH arms — there is no ambiguous "maybe saved" third state (C6 fail-closed).
 */
export type IntakeOutcome =
  | { ok: true; receipt: IntakeReceipt }
  | { ok: false; rejection: IntakeRejection };

/**
 * A minimal, structural reader for the raw file bytes. A browser `File`/`Blob`
 * satisfies it as-is, but the interface is DOM-free so the transport stays
 * unit-testable with a plain stub. Kept OFF {@link StagedUpload} on purpose: the
 * pure validator/presenter never touch bytes — only the transport does, and only
 * to stream them (never to inspect, hash, or derive anything from them).
 */
export interface IntakeBytesSource {
  /** Resolve the file's raw bytes for transfer. */
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * The injectable B3 client — the SINGLE live-swap seam. As of GOV-1576 (B3,
 * `done`), `main.ts` injects the real authenticated transport
 * ({@link IntakeBytesSource}-backed POST to `/api/beta/intake/upload`). The
 * fail-closed scaffold transport (`wired: false`) remains for tests and for any
 * surface deliberately kept non-functional; swapping between them changes no DOM,
 * validation, ARIA, or copy.
 */
export interface UploadIntakeTransport {
  /** True ONLY when a real, authorized intake backend is wired. */
  readonly wired: boolean;
  /**
   * Attempt an authenticated intake. Always resolves to an {@link IntakeOutcome}
   * (never rejects — a thrown/unknown failure is caught as fail-closed). `source`
   * carries the raw bytes to stream; it is absent only for the scaffold path,
   * which ignores it and always fails closed. `signal` lets an interactive
   * caller retire an in-flight transfer. Transport abortion is best-effort;
   * callers must still reject completion from a retired operation.
   */
  submit(
    staged: StagedUpload,
    source?: IntakeBytesSource,
    signal?: AbortSignal,
  ): Promise<IntakeOutcome>;
}
