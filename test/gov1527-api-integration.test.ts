/**
 * GOV-1527 §5/§6 — same-origin /api client + gated-lane adapter + LANDING_ONLY.
 *
 * These lock the contract-critical client behavior: the browser only ever hits
 * a same-origin `/api/*` path, the service's `{reviewer_internal_records}`
 * envelope adapts losslessly to the read model, a non-200 fails closed (no
 * partial civic data), and LANDING_ONLY parses as an explicit flag.
 */

import { describe, it, expect } from 'vitest';
import {
  apiBase, isLandingOnly, isReviewerInternalEnvelope, toReadModel, fetchReviewerInternal,
} from '../src/data/api';
import { loadReadModel } from '../src/data/client';

describe('apiBase — same-origin only (§5)', () => {
  it('defaults to /api', () => {
    expect(apiBase({})).toBe('/api');
  });
  it('honors a relative override and trims a trailing slash', () => {
    expect(apiBase({ VITE_API_BASE: '/svc/' })).toBe('/svc');
  });
  it('refuses an absolute/cross-origin base (falls back to /api)', () => {
    expect(apiBase({ VITE_API_BASE: 'https://evil.example/api' })).toBe('/api');
    expect(apiBase({ VITE_API_BASE: 'http://127.0.0.1:8791' })).toBe('/api');
  });
});

describe('isLandingOnly (§6)', () => {
  it('is true only for explicit truthy flags', () => {
    for (const v of ['1', 'true', 'YES', 'Yes']) expect(isLandingOnly({ VITE_LANDING_ONLY: v })).toBe(true);
    for (const v of ['', '0', 'false', undefined as unknown as string]) expect(isLandingOnly({ VITE_LANDING_ONLY: v })).toBe(false);
  });
});

describe('gated-lane adapter', () => {
  it('recognizes the reviewer-internal envelope only when the list is present', () => {
    expect(isReviewerInternalEnvelope({ reviewer_internal_records: [] })).toBe(true);
    expect(isReviewerInternalEnvelope({ records: [] })).toBe(false);
    expect(isReviewerInternalEnvelope(null)).toBe(false);
  });
  it('wraps the flat list into a read model with the scope + access markers', () => {
    const rec = { statement_id: 's1', statement_text: 'hi', ui_status: 'source-backed' } as never;
    const model = toReadModel({ reviewer_internal_records: [rec] });
    expect(model.scope).toBe('alpine');
    expect(model.access).toBe('reviewer_internal');
    expect(model.records).toEqual([rec]);
  });
});

/** A fetch stub returning a fixed JSON body + status. */
function stubFetch(status: number, body: unknown): typeof fetch {
  return (async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 403 ? 'Forbidden' : 'OK',
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe('fetchReviewerInternal — fail-closed', () => {
  const rec = { statement_id: 's1', statement_text: 'order', ui_status: 'source-backed' } as never;

  it('adapts a 200 envelope to the read model', async () => {
    const model = await fetchReviewerInternal({
      base: '/api', fetchImpl: stubFetch(200, { reviewer_internal_records: [rec] }),
    });
    expect(model.records).toHaveLength(1);
    expect(model.access).toBe('reviewer_internal');
  });

  it('throws on 403 (no civic data leaks to the UI)', async () => {
    await expect(fetchReviewerInternal({ base: '/api', fetchImpl: stubFetch(403, { error: 'access_denied' }) }))
      .rejects.toThrow(/403/);
  });

  it('throws on an unexpected body shape', async () => {
    await expect(fetchReviewerInternal({ base: '/api', fetchImpl: stubFetch(200, { totally: 'wrong' }) }))
      .rejects.toThrow(/unexpected/);
  });
});

describe('loadReadModel consumes the same-origin gated lane', () => {
  it('adapts the service envelope through the read-model client', async () => {
    const rec = { statement_id: 's9', statement_text: 'gated', ui_status: 'source-backed' } as never;
    const { state } = await loadReadModel({
      config: { useFixtures: false, readApiUrl: '/api/reviewer-internal' },
      fetchImpl: stubFetch(200, { reviewer_internal_records: [rec] }),
    });
    expect(state.status).toBe('ready');
    expect(state.mode).toBe('live');
    expect(state.data?.records).toHaveLength(1);
  });
});
