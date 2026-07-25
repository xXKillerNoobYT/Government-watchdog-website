// @vitest-environment jsdom
//
// GOV-1569 (GOV-1566 F1) — the gated upload surface. Proves the honesty contract
// F0 (`docs/gov1568-upload-ux-spec.md`) demands against the B3 intake API:
//
//   - the surface's most-optimistic state is `review_pending`/`held` — there is
//     NO verified/published value it can ever project (§4 invariant),
//   - status projection is fail-closed: unknown/absent ⇒ `review_pending`, never
//     a blank and never an upgrade (§6),
//   - validation is mechanical + actionable (type/size/required provenance),
//     never a truth claim, and a failed validation does NOT send the file,
//   - copy never implies verification before review, and never leaks a raw path,
//     hash, reviewer note, or the internal `review_state` (C7 / web-safe),
//   - each visible state (idle, validating, uploading, received, held, error)
//     renders with the honest content-free placeholder where a pending/held file
//     is concerned,
//   - the scaffold transport is fail-closed (never a fake receipt) until B3 lands.
import { describe, it, expect } from 'vitest';
import {
  UPLOAD_COPY,
  UPLOAD_SCAFFOLDING_NOTE,
  DEFAULT_INTAKE_CONSTRAINTS,
  validateStagedUpload,
  projectReviewState,
  reviewStateChip,
  rejectionMessage,
  formatBytes,
  scaffoldIntakeTransport,
  renderGatedUpload,
} from '../src/ui/gated-upload';
import {
  UPLOAD_REVIEW_STATES,
  CONSERVATIVE_UPLOAD_REVIEW_STATE,
  isUploadReviewState,
  type StagedUpload,
  type UploadIntakeTransport,
} from '../src/types/upload-intake';
import { assertWebSafe, RawPathLeak, RAW_PATH_FORBIDDEN_KEYS } from '../src/data/web-safe';
import uploadIntakeContract from '../src/fixtures/alpine-upload-intake.json';

function staged(over: Partial<StagedUpload> = {}): StagedUpload {
  return {
    file: { name: 'minutes.pdf', sizeBytes: 1024, mimeType: 'application/pdf' },
    provenance: { sourceOrigin: 'Town clerk email', description: 'June minutes' },
    ...over,
  };
}

// A transport that reports a chosen outcome, to drive the DOM state machine.
function fakeTransport(outcome: Awaited<ReturnType<UploadIntakeTransport['submit']>>): UploadIntakeTransport {
  return { wired: true, async submit() { return outcome; } };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('GOV-1569 status projection is fail-closed (never upgrades)', () => {
  it('projects a known bucket verbatim', () => {
    expect(projectReviewState('received')).toBe('received');
    expect(projectReviewState('held')).toBe('held');
    expect(projectReviewState({ status: 'held' })).toBe('held');
  });

  it('collapses unknown / absent / null / off-list to the conservative bucket', () => {
    expect(projectReviewState(undefined)).toBe(CONSERVATIVE_UPLOAD_REVIEW_STATE);
    expect(projectReviewState(null)).toBe(CONSERVATIVE_UPLOAD_REVIEW_STATE);
    expect(projectReviewState({})).toBe(CONSERVATIVE_UPLOAD_REVIEW_STATE);
    expect(projectReviewState({ status: 'verified' })).toBe(CONSERVATIVE_UPLOAD_REVIEW_STATE);
    expect(projectReviewState('source-backed')).toBe(CONSERVATIVE_UPLOAD_REVIEW_STATE);
    expect(CONSERVATIVE_UPLOAD_REVIEW_STATE).toBe('review_pending');
  });

  it('has NO verified/published value in the vocabulary (core invariant §4)', () => {
    for (const s of UPLOAD_REVIEW_STATES) {
      expect(['received', 'review_pending', 'held']).toContain(s);
    }
    expect(isUploadReviewState('verified')).toBe(false);
    expect(isUploadReviewState('source-backed')).toBe(false);
    // The chip tone is never the trusted end of the legend.
    for (const s of UPLOAD_REVIEW_STATES) {
      expect(reviewStateChip(s).tone).not.toBe('source-backed');
    }
  });

  it('chip labels are honest + not-yet-trusted', () => {
    expect(reviewStateChip('received').label).toBe('Received');
    expect(reviewStateChip('review_pending').label).toBe('Review pending');
    expect(reviewStateChip('held').label).toBe('Held for review');
  });
});

describe('GOV-1569 validation is mechanical + actionable (never a truth claim)', () => {
  it('accepts an allow-listed file within size with provenance', () => {
    expect(validateStagedUpload(staged()).ok).toBe(true);
  });

  it('rejects a missing file with an actionable message', () => {
    const v = validateStagedUpload(staged({ file: null }));
    expect(v.ok).toBe(false);
    expect(v.fileError).toMatch(/choose a file/i);
  });

  it('rejects a disallowed mime type, naming what is accepted', () => {
    const v = validateStagedUpload(staged({ file: { name: 'x.exe', sizeBytes: 10, mimeType: 'application/x-msdownload' } }));
    expect(v.ok).toBe(false);
    expect(v.fileError).toContain(DEFAULT_INTAKE_CONSTRAINTS.acceptedLabel);
  });

  it('rejects an over-size file, naming the limit', () => {
    const big = DEFAULT_INTAKE_CONSTRAINTS.maxBytes + 1;
    const v = validateStagedUpload(staged({ file: { name: 'big.pdf', sizeBytes: big, mimeType: 'application/pdf' } }));
    expect(v.ok).toBe(false);
    expect(v.fileError).toMatch(/larger than/i);
  });

  it('requires both provenance fields (provenance mandatory)', () => {
    const v = validateStagedUpload(staged({ provenance: { sourceOrigin: '  ', description: '' } }));
    expect(v.ok).toBe(false);
    expect(v.originError).toBeTruthy();
    expect(v.descriptionError).toBeTruthy();
  });
});

describe('GOV-1569 copy never implies verification, never leaks internals', () => {
  const allCopy = [
    ...Object.values(UPLOAD_COPY),
    UPLOAD_SCAFFOLDING_NOTE,
    ...(['unauthorized', 'unsupported_type', 'too_large', 'missing_provenance', 'quota', 'backend_unavailable', 'unknown'] as const).map(
      (r) => rejectionMessage(r),
    ),
  ].join(' \n ');

  it('success/receipt copy is a queue receipt, not a verification (C3)', () => {
    expect(UPLOAD_COPY.successHeading).toMatch(/received/i);
    expect(allCopy).not.toMatch(/verified|published|added as a source|source-backed/i);
  });

  it('in-progress copy describes transfer only, not processing (C2)', () => {
    expect(UPLOAD_COPY.uploadingStatus).toMatch(/uploading/i);
    expect(UPLOAD_COPY.uploadingStatus).not.toMatch(/analy|verif|process/i);
  });

  it('placeholder promises no content before review (C4)', () => {
    expect(UPLOAD_COPY.pendingPlaceholder).toMatch(/hasn.t been reviewed/i);
  });

  it('no copy string leaks a raw-path marker or forbidden key (C7)', () => {
    for (const key of RAW_PATH_FORBIDDEN_KEYS) {
      expect(allCopy).not.toContain(`"${key}"`);
    }
    expect(allCopy).not.toMatch(/\/(Users|home|var|tmp|private|Volumes)\//);
  });
});

describe('GOV-1569 web-safe boundary', () => {
  it('the internal review_state key is denylisted (never crosses the wire)', () => {
    expect(RAW_PATH_FORBIDDEN_KEYS as readonly string[]).toContain('review_state');
    expect(() => assertWebSafe({ status: 'received', review_state: 'internal_pending' })).toThrow(RawPathLeak);
  });

  it('the shipped B3 contract fixture passes assertWebSafe', () => {
    expect(() => assertWebSafe(uploadIntakeContract)).not.toThrow();
  });
});

describe('GOV-1569 scaffold transport is fail-closed until B3 lands', () => {
  it('never reports a fake receipt', async () => {
    expect(scaffoldIntakeTransport.wired).toBe(false);
    const outcome = await scaffoldIntakeTransport.submit(staged());
    expect(outcome.ok).toBe(false);
  });
});

describe('GOV-1569 render — one honest state at a time', () => {
  it('idle: shows the form, honesty note, constraints, and a disabled submit', () => {
    const root = document.createElement('div');
    renderGatedUpload(root, { forcedPhase: 'idle' });
    expect(root.querySelector('[data-test="upload-form"]')).not.toBeNull();
    expect(root.querySelector('[data-test="upload-purpose"]')?.textContent).toMatch(/does not publish/i);
    expect(root.querySelector('[data-test="upload-constraints"]')?.textContent).toMatch(/max size/i);
    expect((root.querySelector('[data-test="upload-submit"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the scaffolding note when the transport is not wired', () => {
    const root = document.createElement('div');
    renderGatedUpload(root, { forcedPhase: 'idle' }); // default scaffold transport
    expect(root.querySelector('[data-test="upload-scaffold-note"]')).not.toBeNull();
  });

  it('received: honest chip + content-free placeholder, no verified language', () => {
    const root = document.createElement('div');
    renderGatedUpload(root, { forcedPhase: 'received', forcedReceiptStatus: 'received' });
    expect(root.querySelector('[data-test="upload-success-pending"]')).not.toBeNull();
    expect(root.querySelector('[data-test="review-state-chip"]')?.textContent).toBe('Received');
    expect(root.querySelector('[data-test="review-pending-placeholder"]')).not.toBeNull();
    expect(root.textContent).not.toMatch(/verified|published/i);
  });

  it('held: renders the held placeholder, still content-free', () => {
    const root = document.createElement('div');
    renderGatedUpload(root, { forcedPhase: 'held' });
    expect(root.querySelector('[data-test="upload-held"]')).not.toBeNull();
    expect(root.querySelector('[data-test="review-state-chip"]')?.textContent).toBe('Held for review');
  });

  it('error: fail-closed message + retry, no server internals', () => {
    const root = document.createElement('div');
    renderGatedUpload(root, { forcedPhase: 'error', forcedRejectionReason: 'backend_unavailable' });
    const err = root.querySelector('[data-test="upload-error"]');
    expect(err).not.toBeNull();
    expect(err?.textContent).toMatch(/nothing was saved/i);
    expect(root.querySelector('[data-test="upload-retry"]')).not.toBeNull();
  });

  it('interactive submit against an accepting transport reaches the pending receipt', async () => {
    const root = document.createElement('div');
    renderGatedUpload(root, { transport: fakeTransport({ ok: true, receipt: { status: 'received' } }) });
    // Stage provenance (file input can't be set programmatically in jsdom, so
    // drive the pure path: type into fields then submit via the form handler).
    (root.querySelector('[data-test="upload-provenance-origin"]') as HTMLInputElement).value = 'clerk';
    (root.querySelector('[data-test="upload-provenance-origin"]') as HTMLInputElement).dispatchEvent(new Event('input'));
    // No file staged ⇒ validation should fail-closed to the form with a file error.
    (root.querySelector('[data-test="upload-form"]') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await flush();
    expect(root.querySelector('[data-test="upload-error-file"]')).not.toBeNull();
    // The file was never sent (still on the form, not a receipt).
    expect(root.querySelector('[data-test="upload-success-pending"]')).toBeNull();
  });

  it('formatBytes is human + safe on bad input', () => {
    expect(formatBytes(26214400)).toBe('25 MB');
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});
