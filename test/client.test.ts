import { describe, it, expect, vi } from 'vitest';
import { loadReadModel, readConfig, isEmptyResponse, FIXTURE } from '../src/data/client';
import { assertWebSafe, RAW_PATH_FORBIDDEN_KEYS } from '../src/data/web-safe';
import type { ReadApiResponse } from '../src/types/read-api';
// Real backend output, captured from `read_api.build_response(...)` at origin/main
// (GOV-98 merge ea4e065). This is the contract the adapter must read.
import realSample from './read-api-sample.json';

const sample = realSample as unknown as ReadApiResponse;

function mockFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return vi.fn(async () => ({
    ok,
    status,
    statusText: ok ? 'OK' : 'Service Unavailable',
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe('readConfig', () => {
  it('defaults to fixture mode', () => {
    expect(readConfig({})).toEqual({ useFixtures: true, readApiUrl: '' });
  });
  it('enables live mode only when explicitly false + URL present', () => {
    expect(readConfig({ VITE_USE_FIXTURES: 'false', VITE_READ_API_URL: 'http://127.0.0.1:8787/read' })).toEqual({
      useFixtures: false,
      readApiUrl: 'http://127.0.0.1:8787/read',
    });
  });
});

describe('loadReadModel — adapter reads the read-API sample', () => {
  it('parses the REAL captured read-API sample into typed shapes (live mode)', async () => {
    const { state } = await loadReadModel({
      config: { useFixtures: false, readApiUrl: 'http://127.0.0.1:8787/read' },
      fetchImpl: mockFetch(sample),
    });
    expect(state.status).toBe('ready');
    expect(state.mode).toBe('live');
    const data = state.data!;
    // Eligibility/labels travel: served record carries verbatim labels.
    expect(data.records?.[0]?.statement_id).toBe('stmt-eligible');
    expect(data.records?.[0]?.ui_status).toBe('source-backed');
    expect(data.records?.[0]?.evidence.length).toBeGreaterThan(0);
    // thread/tree shapes present.
    expect(data.agenda_thread?.members.length).toBe(2);
    expect(data.agenda_thread?.lifecycle_edges[0]?.edge_type).toBe('agenda_item_supersedes');
    expect(data.topic_tree?.root.canonicalHumanLabel).toBe('general safety');
    const gov = data.topic_tree?.root.sourceAliases.find((a) => a.aliasType === 'government_term');
    expect(gov?.term).toBe('public safety');
    expect(gov?.sourceRef.sourceId).toBeTruthy();
  });

  it('the captured sample is web-safe (no raw paths / forbidden keys)', () => {
    expect(() => assertWebSafe(sample)).not.toThrow();
    const blob = JSON.stringify(sample);
    for (const key of RAW_PATH_FORBIDDEN_KEYS) {
      expect(blob.includes(`"${key}"`)).toBe(false);
    }
  });

  it('falls back to the labeled fixture on a live-read failure (visible notice)', async () => {
    const { state, notice } = await loadReadModel({
      config: { useFixtures: false, readApiUrl: 'http://127.0.0.1:8787/read' },
      fetchImpl: mockFetch(null, false, 503),
    });
    expect(state.mode).toBe('fixture');
    expect(state.status).toBe('ready');
    expect(notice).toMatch(/Live read-API unavailable/);
  });

  it('uses the labeled fixture in fixture mode (default)', async () => {
    const { state } = await loadReadModel({ config: { useFixtures: true, readApiUrl: '' } });
    expect(state.mode).toBe('fixture');
    expect(state.data).toBe(FIXTURE);
  });
});

describe('isEmptyResponse (BEH-STATE-2)', () => {
  it('treats no records/thread/tree as empty', () => {
    expect(isEmptyResponse({ scope: 'alpine', access: 'reviewer_internal', records: [] })).toBe(true);
  });
  it('treats any records as non-empty', () => {
    expect(isEmptyResponse(sample)).toBe(false);
  });
});
