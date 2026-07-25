import { describe, it, expect, vi } from 'vitest';
import { loadReadModel, readConfig, isEmptyResponse, FIXTURE } from '../src/data/client';
import { assertWebSafe, RAW_PATH_FORBIDDEN_KEYS } from '../src/data/web-safe';
import type { ReadApiResponse } from '../src/types/read-api';
// REAL reviewed backend output, captured from `read_api.reviewer_internal_records(...)`
// at backend origin/main 235bba6 (GOV-146 Option-A owner-authorized 6-row promotion
// seed). This is the contract the adapter must read — 6 real reviewed Alpine records,
// all source-backed / reviewed_source_linked, no concept-graph (none exists over the
// real corpus yet). The synthetic concept-graph demo covers thread/tree logic.
import realSample from './read-api-sample.json';
// Labeled SYNTHETIC graph demo — exercises the agenda_thread / topic_tree shapes the
// real reviewed corpus cannot produce yet.
import graphDemo from '../src/fixtures/concept-graph-demo.json';

const sample = realSample as unknown as ReadApiResponse;
const demo = graphDemo as unknown as ReadApiResponse;

function mockFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return vi.fn(async () => ({
    ok,
    status,
    statusText: ok ? 'OK' : 'Service Unavailable',
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe('readConfig', () => {
  it('defaults to the live same-origin reviewer endpoint', () => {
    expect(readConfig({})).toEqual({
      useFixtures: false,
      readApiUrl: '/api/reviewer-internal',
    });
  });
  it('enables fixture mode only when explicit and never accepts a cross-origin read URL', () => {
    expect(readConfig({
      VITE_USE_FIXTURES: 'true',
      VITE_API_BASE: 'https://evil.example/api',
      VITE_READ_API_URL: 'https://evil.example/read',
    })).toEqual({
      useFixtures: true,
      readApiUrl: '/api/reviewer-internal',
    });
  });
});

describe('loadReadModel — adapter reads the read-API sample', () => {
  it('parses the REAL reviewed read-API sample into typed shapes (live mode)', async () => {
    const { state } = await loadReadModel({
      config: { useFixtures: false, readApiUrl: 'http://127.0.0.1:8787/read' },
      fetchImpl: mockFetch(sample),
    });
    expect(state.status).toBe('ready');
    expect(state.mode).toBe('live');
    const data = state.data!;
    // Exactly the 6 owner-authorized reviewed rows (GOV-146 Option-A seed) — no more.
    expect(data.records?.length).toBe(6);
    // Eligibility/labels travel: every served record carries verbatim trust labels,
    // and ONLY eligible reviewed rows are served (all source-backed / reviewed).
    for (const r of data.records!) {
      expect(r.ui_status).toBe('source-backed');
      expect(r.verification_status).toBe('reviewed_source_linked');
      expect(r.publication_state).toBe('not_publishable'); // reviewer-internal, never published
      expect(r.evidence.length).toBeGreaterThan(0); // no orphan served
    }
    // First real row is the Oct-9-2024 special-meeting statement.
    expect(data.records?.[0]?.statement_id).toBe('alpine_local_corpus:ai:00000064:0021');
    // The real reviewed corpus has NO concept graph yet — these surfaces are honestly
    // empty (fail-closed: the frontend never invents a thread/tree that isn't served).
    expect(data.agenda_thread ?? null).toBeNull();
    expect(data.topic_tree ?? null).toBeNull();
  });

  it('parses the synthetic concept-graph demo (thread/tree shapes the real corpus lacks)', async () => {
    const { state } = await loadReadModel({
      config: { useFixtures: false, readApiUrl: 'http://127.0.0.1:8787/read' },
      fetchImpl: mockFetch(demo),
    });
    const data = state.data!;
    expect(data.agenda_thread?.members.length).toBe(3);
    expect(data.agenda_thread?.lifecycle_edges[0]?.edge_type).toBe('agenda_item_supersedes');
    expect(data.topic_tree?.root.canonicalHumanLabel).toBe('general safety');
    const gov = data.topic_tree?.root.sourceAliases.find((a) => a.aliasType === 'government_term');
    expect(gov?.term).toBe('public safety');
    expect(gov?.sourceRef.sourceId).toBeTruthy();
  });

  it('the real reviewed sample is web-safe (no raw paths / forbidden keys)', () => {
    expect(() => assertWebSafe(sample)).not.toThrow();
    const blob = JSON.stringify(sample);
    for (const key of RAW_PATH_FORBIDDEN_KEYS) {
      expect(blob.includes(`"${key}"`)).toBe(false);
    }
  });

  it('keeps a live-read failure fail-closed and never substitutes a fixture', async () => {
    const { state, notice } = await loadReadModel({
      config: { useFixtures: false, readApiUrl: 'http://127.0.0.1:8787/read' },
      fetchImpl: mockFetch(null, false, 503),
    });
    expect(state.mode).toBe('live');
    expect(state.status).toBe('error');
    expect(state.data).toBeUndefined();
    expect(notice).toMatch(/Live read-API unavailable/);
    expect(notice).toMatch(/No private capture or synthetic sample was substituted/);
  });

  it('uses the labeled fixture in fixture mode (default)', async () => {
    const { state } = await loadReadModel({ config: { useFixtures: true, readApiUrl: '' } });
    expect(state.mode).toBe('fixture');
    expect(state.data).toBe(FIXTURE);
  });

  it('fails closed when live mode is selected without an API URL', async () => {
    const { state, notice } = await loadReadModel({
      config: { useFixtures: false, readApiUrl: '' },
      fetchImpl: mockFetch(sample),
    });
    expect(state.mode).toBe('live');
    expect(state.status).toBe('error');
    expect(state.data).toBeUndefined();
    expect(state.error).toContain('same-origin reviewer endpoint is not configured');
    expect(notice).toContain('No private capture or synthetic sample was substituted');
  });

  it('fails closed when live mode has no fetch implementation', async () => {
    const { state, notice } = await loadReadModel({
      config: { useFixtures: false, readApiUrl: '/api/reviewer-internal' },
      fetchImpl: null,
    });
    expect(state.mode).toBe('live');
    expect(state.status).toBe('error');
    expect(state.data).toBeUndefined();
    expect(state.error).toContain('fetch is not available');
    expect(notice).toContain('No private capture or synthetic sample was substituted');
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
