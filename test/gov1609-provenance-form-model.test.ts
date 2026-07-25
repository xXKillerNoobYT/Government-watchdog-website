// @vitest-environment jsdom
//
// GOV-1623 (GOV-1566 F1 follow-up) — the upload provenance form model decided in
// GOV-1609 (`docs/gov1609-upload-provenance-form-model.md`). Proves §7:
//
//   1. the `source_type` control is a bounded kind `<select>` with NO preselected
//      kind (a valueless placeholder is active) and submit is disabled while it is,
//   2. submitting with the placeholder still active surfaces the
//      `upload-error-description` message and does NOT call the transport,
//   3. the closed kind list is exactly the eight kinds of §3.1 (guards list drift),
//   4. a chosen kind is sent as `source_type` VERBATIM (no transformation), and a
//      staged file + chosen kind + origin validates (submit would proceed),
//   5. `origin_url` display-safety (§4.2): a non-http(s) provenance value is NOT
//      auto-linkified on the read path; an http(s) value may be.
//
// Honesty guardrails checked: the chosen kind is uploader-*selected* input, never
// a civic value, and it never upgrades the receipt's review ceiling.
import { describe, it, expect } from 'vitest';
import {
  UPLOAD_COPY,
  UPLOAD_KIND_OPTIONS,
  validateStagedUpload,
  renderGatedUpload,
  createHttpIntakeTransport,
  INTAKE_AREA,
} from '../src/ui/gated-upload';
import { safeHttpUrl } from '../src/ui/supplied-files';
import { renderSuppliedFiles } from '../src/ui/pages-program';
import type { StagedUpload, UploadIntakeTransport } from '../src/types/upload-intake';
import type { SuppliedFilesProjection, SuppliedSourceFile } from '../src/types/read-api';

function staged(over: Partial<StagedUpload> = {}): StagedUpload {
  return {
    file: { name: 'minutes.pdf', sizeBytes: 1024, mimeType: 'application/pdf' },
    provenance: { sourceOrigin: 'Town clerk email', description: 'Meeting minutes' },
    ...over,
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function bytesSource(text: string): { arrayBuffer(): Promise<ArrayBuffer> } {
  const bytes = new TextEncoder().encode(text);
  return { async arrayBuffer() { return bytes.buffer.slice(0, bytes.byteLength); } };
}

interface FetchCall { url: string; init: RequestInit }
function recordingFetch(reply: { status: number; body?: unknown }): { fetchImpl: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok: reply.status >= 200 && reply.status < 300, status: reply.status, async json() { return reply.body ?? {}; } };
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function file(p: Partial<SuppliedSourceFile> & { file_id: string; title: string }): SuppliedSourceFile {
  return { ...p };
}
function projection(files: SuppliedSourceFile[]): SuppliedFilesProjection {
  return { access: 'reviewer_internal', files };
}
const query = new URLSearchParams();

// --- §7.3 the closed kind list ---------------------------------------------
describe('GOV-1609 §3.1 — the kind list is exactly the eight decided kinds', () => {
  it('carries the eight kinds in order, no more, no invented civic value', () => {
    expect([...UPLOAD_KIND_OPTIONS]).toEqual([
      'Meeting minutes',
      'Agenda or meeting packet',
      'Ordinance or resolution',
      'Notice or public announcement',
      'Correspondence (letter or email)',
      'Financial or budget document',
      'Report or study',
      'Other document',
    ]);
  });

  it('has no free-text escape that reintroduces prose into the taxonomy', () => {
    // `Other document` is a terminal choice — it is a plain kind, not a prompt to
    // type prose. (The list is closed; a stray "Other: ____" label would fail here.)
    for (const kind of UPLOAD_KIND_OPTIONS) {
      expect(kind).not.toMatch(/:|specify|describe|other\.\.\./i);
    }
  });
});

// --- §7.1 the picker renders with no preselected kind, submit disabled ------
describe('GOV-1609 §3 — the source_type control is a bounded kind picker', () => {
  it('renders a <select> labelled "What kind of file is this?"', () => {
    const root = document.createElement('div');
    renderGatedUpload(root, { forcedPhase: 'idle' });
    const control = root.querySelector('[data-test="upload-provenance-description"]');
    expect(control).not.toBeNull();
    expect(control?.tagName).toBe('SELECT');
    const label = root.querySelector('label[for="gw-up-desc"]');
    expect(label?.textContent).toBe('What kind of file is this?');
    expect(UPLOAD_COPY.descriptionLabel).toBe('What kind of file is this?');
  });

  it('shows a valueless placeholder, NO kind preselected, submit disabled', () => {
    const root = document.createElement('div');
    renderGatedUpload(root, { forcedPhase: 'idle' });
    const select = root.querySelector('[data-test="upload-provenance-description"]') as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll('option'));
    // Placeholder first, valueless; then exactly the eight kinds.
    expect(options[0].value).toBe('');
    expect(options[0].textContent).toBe(UPLOAD_COPY.descriptionPlaceholderOption);
    expect(options.slice(1).map((o) => o.value)).toEqual([...UPLOAD_KIND_OPTIONS]);
    // Nothing chosen: the control's value is empty (no fabricated default — W1).
    expect(select.value).toBe('');
    // Submit is disabled while unselected.
    expect((root.querySelector('[data-test="upload-submit"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('invalid state: error carries text + icon (not colour alone) + aria wiring', () => {
    const root = document.createElement('div');
    // Force the validating phase with an empty staged form ⇒ the description error renders.
    renderGatedUpload(root, { forcedPhase: 'validating' });
    const err = root.querySelector('[data-test="upload-error-description"]');
    expect(err).not.toBeNull();
    expect(err?.textContent).toContain('Pick what kind of file this is before uploading.');
    // Icon present (aria-hidden so a screen reader still gets clean message text).
    const icon = err?.querySelector('.gw-up-err-icon');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    // The error is addressable and the select points at it.
    expect(err?.getAttribute('id')).toBe('upload-error-description');
    const select = root.querySelector('[data-test="upload-provenance-description"]') as HTMLSelectElement;
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(select.getAttribute('aria-describedby')).toBe('upload-error-description');
  });
});

// --- §7.2 placeholder-active submit does not send ---------------------------
describe('GOV-1609 §3.3 — submit with the placeholder active errors, never sends', () => {
  it('shows upload-error-description and does NOT call the transport', async () => {
    let submitCalls = 0;
    const spy: UploadIntakeTransport = {
      wired: true,
      async submit() { submitCalls += 1; return { ok: true, receipt: { status: 'received' } }; },
    };
    const root = document.createElement('div');
    renderGatedUpload(root, { transport: spy });
    // Leave the kind on the placeholder; attempt to submit.
    (root.querySelector('[data-test="upload-form"]') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await flush();
    expect(root.querySelector('[data-test="upload-error-description"]')).not.toBeNull();
    expect(submitCalls).toBe(0);
    // No receipt was reached — nothing was sent.
    expect(root.querySelector('[data-test="upload-success-pending"]')).toBeNull();
  });
});

// --- §7.4 chosen kind is sent verbatim as source_type ----------------------
describe('GOV-1609 §3 — the chosen kind is source_type, verbatim', () => {
  it('sends the chosen kind label as source_type with no transformation', async () => {
    const { fetchImpl, calls } = recordingFetch({ status: 201, body: { review_state: 'pending' } });
    const t = createHttpIntakeTransport({ fetchImpl });
    await t.submit(staged({ provenance: { sourceOrigin: 'clerk', description: 'Agenda or meeting packet' } }), bytesSource('x'));
    const sent = JSON.parse(calls[0].init.body as string);
    expect(sent.source_type).toBe('Agenda or meeting packet'); // verbatim kind label
    expect(sent.area).toBe(INTAKE_AREA); // other wiring unchanged
  });

  it('a staged file + chosen kind + origin validates (submit would proceed)', () => {
    expect(validateStagedUpload(staged({ provenance: { sourceOrigin: 'clerk', description: 'Report or study' } })).ok).toBe(true);
  });

  it('an unselected kind (empty description) fails with the §3.2 copy', () => {
    const v = validateStagedUpload(staged({ provenance: { sourceOrigin: 'clerk', description: '' } }));
    expect(v.ok).toBe(false);
    expect(v.descriptionError).toBe('Pick what kind of file this is before uploading.');
  });
});

// --- §7.5 origin_url display-safety -----------------------------------------
describe('GOV-1609 §4.2 — provenance URL is only linkified when it is http(s)', () => {
  it('safeHttpUrl returns the URL for http(s), null for prose / non-http schemes', () => {
    expect(safeHttpUrl('https://alpinewy.gov/minutes.pdf')).toBe('https://alpinewy.gov/minutes.pdf');
    expect(safeHttpUrl('http://example.com/x')).toBe('http://example.com/x');
    expect(safeHttpUrl('Town of Alpine clerk, emailed 2026-06-09')).toBeNull();
    expect(safeHttpUrl('file:///Users/vault/minutes.pdf')).toBeNull();
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('')).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
  });

  it('a non-URL original_url renders NO anchor on the read path', () => {
    const root = renderSuppliedFiles(
      projection([file({ file_id: 'f1', title: 'Minutes', meeting_id: 148, original_url: 'Town clerk, emailed 2026-06-09' })]),
      query,
    );
    expect(root.querySelector('[data-test="supplied-file-original"]')).toBeNull();
  });

  it('an http(s) original_url renders an anchor to that URL', () => {
    const root = renderSuppliedFiles(
      projection([file({ file_id: 'f2', title: 'Minutes', meeting_id: 148, original_url: 'https://alpinewy.gov/minutes.pdf' })]),
      query,
    );
    const a = root.querySelector('[data-test="supplied-file-original"]') as HTMLAnchorElement | null;
    expect(a).not.toBeNull();
    expect(a?.getAttribute('href')).toBe('https://alpinewy.gov/minutes.pdf');
  });

  it('a prose archive_url is likewise not linkified (fail-closed both anchors)', () => {
    const root = renderSuppliedFiles(
      projection([file({ file_id: 'f3', title: 'Minutes', meeting_id: 148, archive_url: 'handed to reviewer in person' })]),
      query,
    );
    expect(root.querySelector('[data-test="supplied-file-archive"]')).toBeNull();
  });
});
