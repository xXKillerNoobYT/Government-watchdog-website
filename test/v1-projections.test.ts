/**
 * GOV-2180 — served `/v1` projection client (consumer for backend GOV-1816 /
 * GOV-1817 envelope).
 *
 * The suite proves: (1) the client accepts the exact reviewed projection shapes
 * the checked-in fixtures carry, wrapped in the mandatory envelope — so the
 * served path is demonstrably equivalent to the fixture path; (2) it fails CLOSED
 * on every envelope/transport deviation; (3) the reversible flip defaults to the
 * fixture path this slice; (4) the empty `sourceFreshness` map is reported as
 * absent (a Designed Gap) rather than invented.
 */

import { describe, expect, it } from 'vitest';
import {
  PROJECTION_ORIGINS,
  PROJECTION_SCOPE,
  fetchAgendaBoard,
  fetchCardFeed,
  fetchNewsletterDigest,
  hasSourceFreshness,
  useServedProjections,
  v1Base,
  type ProjectionEnvelope,
} from '../src/data/v1-projections';
import { ReviewerRequestError } from '../src/data/api';
import cardFeedData from '../src/fixtures/alpine-card-feed.json';
import agendaBoardData from '../src/fixtures/agenda-board-projection.json';
import newsletterDigestData from '../src/fixtures/alpine-newsletter-digest.json';

/** Envelope-wrap a projection `data` body the way `view_api.py` does on the wire. */
function envelope(
  projection: string,
  data: unknown,
  overrides: Partial<ProjectionEnvelope> & { projection?: string } = {},
): Record<string, unknown> {
  return {
    scope: PROJECTION_SCOPE,
    access: 'reviewer_internal',
    origin: 'live',
    generatedAt: '2026-08-21T00:00:00Z',
    sourceFreshness: {},
    projection,
    data,
    ...overrides,
  };
}

/** Fetch stub returning one JSON response. */
function stubFetch(
  status: number,
  body: unknown,
  headers: Record<string, string> = { 'content-type': 'application/json' },
): typeof fetch {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return (async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 403 ? 'Forbidden' : 'OK',
    headers: new Headers(headers),
    text: async () => text,
    json: async () => JSON.parse(text) as unknown,
  })) as unknown as typeof fetch;
}

describe('GOV-2180 served /v1 projection client', () => {
  describe('reviewed shapes are accepted verbatim (fixture <-> served equivalence)', () => {
    it('card-feed: served envelope yields the same body the fixture carries', async () => {
      const res = await fetchCardFeed({
        fetchImpl: stubFetch(200, envelope('card-feed', cardFeedData)),
      });
      expect(res.data).toEqual(cardFeedData);
      expect(res.envelope.origin).toBe('live');
      expect(res.envelope.scope).toBe('alpine');
    });

    it('agenda-board: served envelope yields the same body the fixture carries', async () => {
      const res = await fetchAgendaBoard({
        fetchImpl: stubFetch(200, envelope('agenda-board', agendaBoardData)),
      });
      expect(res.data).toEqual(agendaBoardData);
    });

    it('newsletter-digest: served envelope yields the same body the fixture carries', async () => {
      const res = await fetchNewsletterDigest({
        fetchImpl: stubFetch(200, envelope('newsletter-digest', newsletterDigestData)),
      });
      expect(res.data).toEqual(newsletterDigestData);
    });
  });

  describe('envelope contract is enforced (fail closed as invalid)', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['wrong scope', envelope('card-feed', cardFeedData, { scope: 'wyoming' })],
      ['unknown origin', envelope('card-feed', cardFeedData, { origin: 'made_up' as never })],
      ['missing access tier', envelope('card-feed', cardFeedData, { access: '' })],
      ['missing generatedAt', envelope('card-feed', cardFeedData, { generatedAt: '' })],
      ['wrong projection name', envelope('agenda-board', cardFeedData)],
      ['non-object sourceFreshness', envelope('card-feed', cardFeedData, { sourceFreshness: [] as never })],
    ];
    for (const [label, body] of cases) {
      it(`rejects ${label}`, async () => {
        await expect(
          fetchCardFeed({ fetchImpl: stubFetch(200, body) }),
        ).rejects.toMatchObject({ kind: 'invalid' });
      });
    }

    it('rejects a missing data body', async () => {
      const body = envelope('card-feed', null);
      delete body.data;
      await expect(fetchCardFeed({ fetchImpl: stubFetch(200, body) })).rejects.toBeInstanceOf(
        ReviewerRequestError,
      );
    });
  });

  describe('transport fails closed', () => {
    it('maps 403 (the constant gate denial) to denied', async () => {
      await expect(
        fetchCardFeed({ fetchImpl: stubFetch(403, { error: 'access_denied' }) }),
      ).rejects.toMatchObject({ kind: 'denied', status: 403 });
    });

    it('maps 500 to unavailable', async () => {
      await expect(
        fetchCardFeed({ fetchImpl: stubFetch(500, { error: 'boom' }) }),
      ).rejects.toMatchObject({ kind: 'unavailable' });
    });

    it('rejects a non-JSON content-type', async () => {
      await expect(
        fetchCardFeed({
          fetchImpl: stubFetch(200, '<html>nope</html>', { 'content-type': 'text/html' }),
        }),
      ).rejects.toMatchObject({ kind: 'invalid' });
    });

    it('rejects a raw-path leak in the wire text before parsing', async () => {
      const leaky = JSON.stringify(envelope('card-feed', cardFeedData)).replace(
        '"data":',
        '"leak":"/Users/isaac/vault/x.md","data":',
      );
      await expect(
        fetchCardFeed({ fetchImpl: stubFetch(200, leaky) }),
      ).rejects.toMatchObject({ kind: 'invalid' });
    });

    it('rejects invalid JSON', async () => {
      await expect(
        fetchCardFeed({ fetchImpl: stubFetch(200, '{not json') }),
      ).rejects.toMatchObject({ kind: 'invalid' });
    });
  });

  describe('sourceFreshness Designed-Gap signal', () => {
    it('reports an empty freshness map as absent (do not invent freshness)', () => {
      const env: ProjectionEnvelope = {
        scope: 'alpine',
        access: 'reviewer_internal',
        origin: 'live',
        generatedAt: '2026-08-21T00:00:00Z',
        sourceFreshness: {},
      };
      expect(hasSourceFreshness(env)).toBe(false);
    });

    it('reports a populated freshness map as present', () => {
      const env: ProjectionEnvelope = {
        scope: 'alpine',
        access: 'reviewer_internal',
        origin: 'live',
        generatedAt: '2026-08-21T00:00:00Z',
        sourceFreshness: { 'src:1': '2026-08-20T00:00:00Z' },
      };
      expect(hasSourceFreshness(env)).toBe(true);
    });
  });

  describe('reversible flip + base', () => {
    it('defaults to the fixture path this slice', () => {
      expect(useServedProjections({})).toBe(false);
      expect(useServedProjections({ VITE_SERVED_PROJECTIONS: 'false' })).toBe(false);
    });

    it('selects the served path when explicitly enabled', () => {
      for (const on of ['1', 'true', 'yes', 'TRUE']) {
        expect(useServedProjections({ VITE_SERVED_PROJECTIONS: on })).toBe(true);
      }
    });

    it('defaults the base to same-origin /v1 and rejects a non-root-relative override', () => {
      expect(v1Base({})).toBe('/v1');
      expect(v1Base({ VITE_V1_BASE: 'https://evil.example/v1' })).toBe('/v1');
      expect(v1Base({ VITE_V1_BASE: '//evil.example' })).toBe('/v1');
      expect(v1Base({ VITE_V1_BASE: '/v1/beta' })).toBe('/v1/beta');
    });

    it('origins mirror the backend closed set', () => {
      expect([...PROJECTION_ORIGINS]).toEqual([
        'live',
        'reviewed_snapshot',
        'backend_test_seed',
        'synthetic_design_fixture',
      ]);
    });
  });
});
