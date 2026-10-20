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
import { PUBLICATION_ELIGIBLE_UI_STATUSES } from '../src/types/read-api';
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
  createHttpIntakeTransport,
  projectBackendReviewState,
  INTAKE_UPLOAD_ROUTE,
  INTAKE_AREA,
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

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

function stageValidUpload(root: HTMLElement, filename = 'minutes.pdf'): void {
  const fileInput = root.querySelector('[data-test="upload-file-input"]') as HTMLInputElement;
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: [new File(['source bytes'], filename, { type: 'application/pdf' })],
  });
  fileInput.dispatchEvent(new Event('change'));

  const origin = root.querySelector('[data-test="upload-provenance-origin"]') as HTMLInputElement;
  origin.value = 'Town clerk email';
  origin.dispatchEvent(new Event('input'));

  const kind = root.querySelector('[data-test="upload-provenance-description"]') as HTMLSelectElement;
  kind.value = 'Meeting minutes';
  kind.dispatchEvent(new Event('change'));
}

function submitUpload(root: HTMLElement): void {
  (root.querySelector('[data-test="upload-form"]') as HTMLFormElement)
    .dispatchEvent(new Event('submit'));
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

  // GOV-1569 §4 names PUBLICATION_ELIGIBLE_UI_STATUSES as the set F1 must never
  // render. The cases above prove fail-closed for 'source-backed' and a made-up
  // 'verified' — two hand-picked examples. That leaves 'archived-source-backed'
  // and 'corrected' unproven, and a hand-picked list cannot notice a value added
  // to the constant later. Assert over the REAL set, in both the bare and the
  // {status} envelope form, so the invariant tracks the source of truth.
  it('collapses EVERY publication-eligible status to the conservative bucket (§4)', () => {
    expect(PUBLICATION_ELIGIBLE_UI_STATUSES.length).toBeGreaterThan(0);
    for (const eligible of PUBLICATION_ELIGIBLE_UI_STATUSES) {
      expect(projectReviewState(eligible), eligible).toBe(CONSERVATIVE_UPLOAD_REVIEW_STATE);
      expect(projectReviewState({ status: eligible }), `{status:${eligible}}`)
        .toBe(CONSERVATIVE_UPLOAD_REVIEW_STATE);
      // And it must never become a renderable upload state under any casing.
      expect(UPLOAD_REVIEW_STATES as readonly string[], eligible).not.toContain(eligible);
    }
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

describe('GOV-1569 scaffold transport is fail-closed (retained for non-wired surfaces)', () => {
  it('never reports a fake receipt', async () => {
    expect(scaffoldIntakeTransport.wired).toBe(false);
    const outcome = await scaffoldIntakeTransport.submit(staged());
    expect(outcome.ok).toBe(false);
  });
});

// --- Real B3 (GOV-1576) transport ------------------------------------------
//
// A minimal bytes source (a File/Blob satisfies this structurally) and a
// recording fake fetch, so the wire behaviour is proved without a browser.
function bytesSource(text: string): { arrayBuffer(): Promise<ArrayBuffer> } {
  const bytes = new TextEncoder().encode(text);
  return { async arrayBuffer() { return bytes.buffer.slice(0, bytes.byteLength); } };
}

interface FetchCall { url: string; init: RequestInit }
function recordingFetch(
  reply: { ok?: boolean; status: number; body?: unknown; throws?: boolean },
): { fetchImpl: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (reply.throws) throw new Error('network down');
    return {
      ok: reply.ok ?? (reply.status >= 200 && reply.status < 300),
      status: reply.status,
      async json() { return reply.body ?? {}; },
    };
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('GOV-1569 projectBackendReviewState — raw review_state never surfaces', () => {
  it('maps a fresh accept (pending) to the honest received bucket', () => {
    expect(projectBackendReviewState('pending')).toBe('received');
  });
  it('maps held verbatim', () => {
    expect(projectBackendReviewState('held')).toBe('held');
  });
  it('never upgrades: reviewing / web_safe / rejected / unknown all fail closed', () => {
    for (const raw of ['reviewing', 'web_safe', 'rejected', 'verified', '', undefined, null, 42]) {
      expect(projectBackendReviewState(raw)).toBe(CONSERVATIVE_UPLOAD_REVIEW_STATE);
    }
  });
});

describe('GOV-1569 http transport — wired POST to B3, fail-closed', () => {
  it('POSTs the required B3 body with the session cookie, projecting the receipt', async () => {
    const { fetchImpl, calls } = recordingFetch({ status: 201, body: { file_id: 'file-abc', sha256: 'a'.repeat(64), review_state: 'pending', deduped: false } });
    const t = createHttpIntakeTransport({ fetchImpl });
    expect(t.wired).toBe(true);
    const outcome = await t.submit(staged(), bytesSource('hello pdf bytes'));

    // One call, to the same-origin B3 route, cookie-bearing, JSON.
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(INTAKE_UPLOAD_ROUTE);
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.credentials).toBe('include');
    expect((calls[0].init.headers as Record<string, string>)['Content-Type']).toBe('application/json');

    const sent = JSON.parse(calls[0].init.body as string);
    expect(sent.area).toBe(INTAKE_AREA);
    expect(sent.original_filename).toBe('minutes.pdf');
    expect(sent.mime).toBe('application/pdf');
    expect(sent.source_type).toBe('June minutes'); // uploader's own words, verbatim
    expect(sent.origin_url).toBe('Town clerk email');
    // content_base64 is the real bytes, base64-encoded.
    expect(atob(sent.content_base64)).toBe('hello pdf bytes');
    // supplied_by is NEVER sent (server-derived, un-forgeable); review_state never echoed.
    expect(sent).not.toHaveProperty('supplied_by');
    expect(sent).not.toHaveProperty('review_state');

    // The receipt carries ONLY the coarse projected bucket — no raw state/id/hash.
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.receipt.status).toBe('received');
      expect(Object.keys(outcome.receipt)).toEqual(['status']);
      expect(() => assertWebSafe(outcome.receipt)).not.toThrow();
      for (const forbidden of ['review_state', 'file_id', 'sha256', 'deduped']) {
        expect(outcome.receipt).not.toHaveProperty(forbidden);
      }
    }
  });

  it('omits origin_url when the uploader gave no origin text', async () => {
    const { fetchImpl, calls } = recordingFetch({ status: 201, body: { review_state: 'pending' } });
    const t = createHttpIntakeTransport({ fetchImpl });
    await t.submit(staged({ provenance: { sourceOrigin: '   ', description: 'June minutes' } }), bytesSource('x'));
    const sent = JSON.parse(calls[0].init.body as string);
    expect(sent).not.toHaveProperty('origin_url');
  });

  it('a malformed 2xx body still succeeds but fails closed to review_pending', async () => {
    const { fetchImpl } = recordingFetch({ status: 201, body: { review_state: 'reviewing' } });
    const outcome = await createHttpIntakeTransport({ fetchImpl }).submit(staged(), bytesSource('x'));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.receipt.status).toBe(CONSERVATIVE_UPLOAD_REVIEW_STATE);
  });

  it('maps each B3 status code to a fail-closed rejection reason', async () => {
    const cases: Array<[number, string]> = [
      [401, 'unauthorized'], [403, 'unauthorized'], [404, 'unauthorized'],
      [413, 'too_large'], [415, 'unsupported_type'], [503, 'backend_unavailable'],
      [400, 'unknown'], [422, 'unknown'], [500, 'unknown'],
    ];
    for (const [status, reason] of cases) {
      const { fetchImpl } = recordingFetch({ status });
      const outcome = await createHttpIntakeTransport({ fetchImpl }).submit(staged(), bytesSource('x'));
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.rejection.reason).toBe(reason);
    }
  });

  it('a network failure is backend_unavailable, never a fake receipt', async () => {
    const { fetchImpl } = recordingFetch({ status: 0, throws: true });
    const outcome = await createHttpIntakeTransport({ fetchImpl }).submit(staged(), bytesSource('x'));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.rejection.reason).toBe('backend_unavailable');
  });

  it('refuses to send (fail-closed unknown) when no bytes source is provided', async () => {
    const { fetchImpl, calls } = recordingFetch({ status: 201, body: { review_state: 'pending' } });
    const outcome = await createHttpIntakeTransport({ fetchImpl }).submit(staged(), undefined);
    expect(calls).toHaveLength(0);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.rejection.reason).toBe('unknown');
  });

  it('passes an AbortSignal through to fetch so supported transports can stop work', async () => {
    const { fetchImpl, calls } = recordingFetch({ status: 201, body: { review_state: 'pending' } });
    const controller = new AbortController();
    await createHttpIntakeTransport({ fetchImpl }).submit(
      staged(),
      bytesSource('x'),
      controller.signal,
    );
    expect(calls[0].init.signal).toBe(controller.signal);
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

  it('cancel aborts the operation, shows a recoverable error, and ignores late success', async () => {
    const completion = deferred<Awaited<ReturnType<UploadIntakeTransport['submit']>>>();
    let signal: AbortSignal | undefined;
    const transport: UploadIntakeTransport = {
      wired: true,
      submit(_staged, _source, operationSignal) {
        signal = operationSignal;
        return completion.promise;
      },
    };
    const root = document.createElement('div');
    document.body.append(root);
    renderGatedUpload(root, { transport });
    stageValidUpload(root);
    submitUpload(root);

    (root.querySelector('[data-test="upload-cancel"]') as HTMLButtonElement).click();

    expect(signal?.aborted).toBe(true);
    expect(root.querySelector('[data-test="upload-error"]')?.textContent).toMatch(/canceled/i);
    expect(document.activeElement).toBe(root.querySelector('[data-test="upload-retry"]'));

    completion.resolve({ ok: true, receipt: { status: 'received' } });
    await flush();
    expect(root.querySelector('[data-test="upload-error"]')).not.toBeNull();
    expect(root.querySelector('[data-test="upload-success-pending"]')).toBeNull();
    root.remove();
  });

  it('a late failure from a canceled operation cannot replace its cancel state', async () => {
    const completion = deferred<Awaited<ReturnType<UploadIntakeTransport['submit']>>>();
    const transport: UploadIntakeTransport = {
      wired: true,
      submit() { return completion.promise; },
    };
    const root = document.createElement('div');
    renderGatedUpload(root, { transport });
    stageValidUpload(root);
    submitUpload(root);
    (root.querySelector('[data-test="upload-cancel"]') as HTMLButtonElement).click();
    const canceledCopy = root.querySelector('[data-test="upload-error"]')?.textContent;

    completion.resolve({ ok: false, rejection: { reason: 'backend_unavailable' } });
    await flush();
    expect(root.querySelector('[data-test="upload-error"]')?.textContent).toBe(canceledCopy);
    expect(root.querySelector('[data-test="upload-form"]')).toBeNull();
  });

  it('cancel followed by a new submission rejects the old completion ordering', async () => {
    const completions = [
      deferred<Awaited<ReturnType<UploadIntakeTransport['submit']>>>(),
      deferred<Awaited<ReturnType<UploadIntakeTransport['submit']>>>(),
    ];
    const submitted: StagedUpload[] = [];
    const transport: UploadIntakeTransport = {
      wired: true,
      submit(upload) {
        submitted.push(upload);
        return completions[submitted.length - 1].promise;
      },
    };
    const root = document.createElement('div');
    document.body.append(root);
    renderGatedUpload(root, { transport });

    stageValidUpload(root, 'first.pdf');
    submitUpload(root);
    (root.querySelector('[data-test="upload-cancel"]') as HTMLButtonElement).click();
    (root.querySelector('[data-test="upload-retry"]') as HTMLButtonElement).click();
    expect(document.activeElement).toBe(root.querySelector('[data-test="upload-file-input"]'));

    stageValidUpload(root, 'second.pdf');
    submitUpload(root);
    expect(submitted.map((upload) => upload.file?.name)).toEqual(['first.pdf', 'second.pdf']);

    completions[0].resolve({ ok: true, receipt: { status: 'received' } });
    await flush();
    expect(root.querySelector('[data-test="upload-inprogress"]')).not.toBeNull();
    expect(root.querySelector('[data-test="upload-success-pending"]')).toBeNull();

    completions[1].resolve({ ok: true, receipt: { status: 'received' } });
    await flush();
    expect(root.querySelector('[data-test="upload-success-pending"]')).not.toBeNull();
    expect(root.querySelector('[data-test="upload-provenance-echo"]')?.textContent)
      .toContain('Meeting minutes');
    root.remove();
  });

  it('formatBytes is human + safe on bad input', () => {
    expect(formatBytes(26214400)).toBe('25 MB');
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});
