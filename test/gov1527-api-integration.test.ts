/**
 * GOV-1527 §5/§6 — bounded same-origin reviewer client + LANDING_ONLY.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  apiBase,
  fetchReviewerInternal,
  isLandingOnly,
  isReviewerInternalEnvelope,
  REVIEWER_BODY_LIMIT_BYTES,
  ReviewerRequestError,
  toReadModel,
} from '../src/data/api';
import { loadReadModel } from '../src/data/client';

function record(statementId = 's1'): Record<string, unknown> {
  return {
    statement_id: statementId,
    statement_text: 'order',
    ui_status: 'source-backed',
    verification_status: 'reviewed_source_linked',
    provenance_status: 'grounded',
    publication_state: 'publishable',
    produced_by: 'human',
    evidence: [],
  };
}

/** Fetch stub that supports both the new raw-text client and legacy JSON client. */
function stubFetch(status: number, body: unknown, statusText?: string): typeof fetch {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return (async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: statusText ?? (status === 403 ? 'Forbidden' : 'OK'),
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => text,
    json: async () => JSON.parse(text) as unknown,
  })) as unknown as typeof fetch;
}

async function expectKind(promise: Promise<unknown>, kind: ReviewerRequestError['kind']): Promise<void> {
  try {
    await promise;
    throw new Error('expected reviewer request to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(ReviewerRequestError);
    expect((error as ReviewerRequestError).kind).toBe(kind);
  }
}

describe('apiBase — strict same-origin path (§5)', () => {
  it('defaults to /api and permits one root-relative override', () => {
    expect(apiBase({})).toBe('/api');
    expect(apiBase({ VITE_API_BASE: '/svc/' })).toBe('/svc');
  });

  it.each([
    'https://evil.example/api',
    'http://127.0.0.1:8791',
    '//evil.example/api',
    '\\\\evil.example\\api',
    '/%2f%2fevil.example/api',
    '/%5c%5cevil.example/api',
    '/%252f%252fevil.example/api',
    'api',
    '/api?next=//evil.example',
    '/api#//evil.example',
  ])('falls back to /api for unsafe base %s', (base) => {
    expect(apiBase({ VITE_API_BASE: base })).toBe('/api');
  });
});

describe('isLandingOnly (§6)', () => {
  it('is true only for explicit truthy flags', () => {
    for (const value of ['1', 'true', 'YES', 'Yes']) {
      expect(isLandingOnly({ VITE_LANDING_ONLY: value })).toBe(true);
    }
    for (const value of ['', '0', 'false', undefined as unknown as string]) {
      expect(isLandingOnly({ VITE_LANDING_ONLY: value })).toBe(false);
    }
  });
});

describe('gated-lane adapter', () => {
  it('recognizes only the exact reviewer-internal envelope', () => {
    expect(isReviewerInternalEnvelope({ reviewer_internal_records: [] })).toBe(true);
    expect(isReviewerInternalEnvelope({ reviewer_internal_records: [], extra: true })).toBe(false);
    expect(isReviewerInternalEnvelope({ records: [] })).toBe(false);
    expect(isReviewerInternalEnvelope(null)).toBe(false);
  });

  it('wraps the flat list without changing server records', () => {
    const rec = record();
    const model = toReadModel({ reviewer_internal_records: [rec] });
    expect(model.scope).toBe('alpine');
    expect(model.access).toBe('reviewer_internal');
    expect(model.records).toEqual([rec]);
  });
});

describe('fetchReviewerInternal — bounded, same-origin, fail-closed', () => {
  it('sends one credentialed same-origin request and returns a frozen model', async () => {
    const fetchImpl = vi.fn(stubFetch(200, { reviewer_internal_records: [record()] }));
    const model = await fetchReviewerInternal({ base: '/api/', fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/reviewer-internal');
    expect(init.credentials).toBe('same-origin');
    expect(init.redirect).toBe('error');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(model.records?.[0]?.statement_id).toBe('s1');
    expect(Object.isFrozen(model)).toBe(true);
  });

  it('never sends an unsafe explicit base to fetch', async () => {
    const fetchImpl = vi.fn(stubFetch(200, { reviewer_internal_records: [] }));
    await fetchReviewerInternal({ base: '//evil.example/api', fetchImpl });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/api/reviewer-internal');
  });

  it('rejects a redirect response instead of following it across origins', async () => {
    const redirectingFetch = vi.fn(async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      expect(init?.redirect).toBe('error');
      throw new TypeError('redirect mode blocked the cross-origin response');
    });

    await expectKind(fetchReviewerInternal({
      fetchImpl: redirectingFetch as typeof fetch,
    }), 'unavailable');
    expect(redirectingFetch).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403])('classifies HTTP %s as denied', async (status) => {
    await expectKind(fetchReviewerInternal({
      fetchImpl: stubFetch(status, { error: 'access_denied' }),
    }), 'denied');
  });

  it.each([404, 408, 429, 500, 503])('classifies HTTP %s as unavailable', async (status) => {
    await expectKind(fetchReviewerInternal({
      fetchImpl: stubFetch(status, { error: 'not_ready' }),
    }), 'unavailable');
  });

  it.each([
    ['malformed JSON', '{not json'],
    ['wrong envelope', JSON.stringify({ records: [] })],
    ['extra envelope field', JSON.stringify({ reviewer_internal_records: [], scope: 'alpine' })],
    ['unknown trust enum', JSON.stringify({
      reviewer_internal_records: [{ ...record(), ui_status: 'trusted' }],
    })],
  ])('classifies %s as invalid', async (_name, body) => {
    await expectKind(fetchReviewerInternal({
      fetchImpl: stubFetch(200, body),
    }), 'invalid');
  });

  it('uses the evidence-based 64 MiB production ceiling', () => {
    expect(REVIEWER_BODY_LIMIT_BYTES).toBe(64 * 1024 * 1024);
  });

  it.each(['', 'text/html', 'text/plain', 'application/octet-stream', 'application/problem+json'])(
    'rejects a successful %s response before parsing',
    async (contentType) => {
      const fetchImpl = (async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': contentType }),
        text: async () => JSON.stringify({ reviewer_internal_records: [] }),
      })) as unknown as typeof fetch;
      await expectKind(fetchReviewerInternal({ fetchImpl }), 'invalid');
    },
  );

  it('rejects an oversized declared body before reading it', async () => {
    const bodyLimitBytes = 128;
    const text = vi.fn(async () => JSON.stringify({ reviewer_internal_records: [] }));
    const fetchImpl = (async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'content-type': 'application/json',
        'content-length': String(bodyLimitBytes + 1),
      }),
      text,
    })) as unknown as typeof fetch;

    await expectKind(fetchReviewerInternal({ fetchImpl, bodyLimitBytes }), 'invalid');
    expect(text).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', '1.5', 'not-a-number', '9007199254740992'])(
    'rejects invalid declared body length %s',
    async (contentLength) => {
      const fetchImpl = (async () => new Response(
        JSON.stringify({ reviewer_internal_records: [] }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'content-length': contentLength,
          },
        },
      )) as unknown as typeof fetch;
      await expectKind(fetchReviewerInternal({ fetchImpl }), 'invalid');
    },
  );

  it('stops a streamed body that exceeds the actual byte limit despite an understated header', async () => {
    const bodyLimitBytes = 128;
    const oversized = `"${'é'.repeat(Math.floor(bodyLimitBytes / 2) + 1)}"`;
    const fetchImpl = (async () => new Response(oversized, {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-length': '1',
      },
    })) as unknown as typeof fetch;

    await expectKind(fetchReviewerInternal({ fetchImpl, bodyLimitBytes }), 'invalid');
  });

  it('rejects invalid UTF-8 from a successful JSON response as invalid', async () => {
    const fetchImpl = (async () => new Response(
      new Uint8Array([0xc3, 0x28]),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    )) as unknown as typeof fetch;
    await expectKind(fetchReviewerInternal({ fetchImpl }), 'invalid');
  });

  it('classifies a raw-path leak in the response bytes as invalid', async () => {
    const unsafe = record();
    unsafe.evidence = [{ original_url: '/Users/reviewer/private.pdf' }];
    await expectKind(fetchReviewerInternal({
      fetchImpl: stubFetch(200, { reviewer_internal_records: [unsafe] }),
    }), 'invalid');
  });

  it('aborts and classifies a timed-out request as unavailable', async () => {
    let requestSignal: AbortSignal | undefined;
    const neverFetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    }) as typeof fetch;

    await expectKind(fetchReviewerInternal({
      fetchImpl: neverFetch,
      timeoutMs: 5,
    }), 'unavailable');
    expect(requestSignal?.aborted).toBe(true);
  });

  it('keeps the timeout active while the successful response body is read', async () => {
    let requestSignal: AbortSignal | undefined;
    const stalledBodyFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => new Promise<string>(() => undefined),
      } as Response;
    }) as typeof fetch;

    await expectKind(fetchReviewerInternal({
      fetchImpl: stalledBodyFetch,
      timeoutMs: 5,
    }), 'unavailable');
    expect(requestSignal?.aborted).toBe(true);
  });

  it('rejects an invalid timeout before fetch', async () => {
    const fetchImpl = vi.fn(stubFetch(200, { reviewer_internal_records: [] }));
    await expectKind(fetchReviewerInternal({ fetchImpl, timeoutMs: 0 }), 'invalid');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('loadReadModel consumes the same-origin gated lane', () => {
  it('adapts the strict service envelope through the legacy read-model client', async () => {
    const { state } = await loadReadModel({
      config: { useFixtures: false, readApiUrl: '/api/reviewer-internal' },
      fetchImpl: stubFetch(200, { reviewer_internal_records: [record('s9')] }),
    });
    expect(state.status).toBe('ready');
    expect(state.mode).toBe('live');
    expect(state.data?.records?.[0]?.statement_id).toBe('s9');
  });
});
