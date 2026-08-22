import { describe, expect, it, vi } from 'vitest';

// @ts-expect-error The deployed Sites worker is intentionally authored as runtime ESM.
import * as sitesWorkerModule from '../scripts/sites-worker.mjs';

const {
  default: worker,
  APPROVED_ACCESS_META,
  IDENTITY_HEADER,
  injectApprovedAccessMeta,
  parseApprovedReviewerEmails,
  PROJECTION_PREFIX,
} = sitesWorkerModule;

const APPROVED_REVIEWER = 'reviewer@example.test';

function request(
  pathname = '/',
  headers: Record<string, string> = {},
  method = 'GET',
): Request {
  return new Request(`https://watchdog.example.test${pathname}`, { method, headers });
}

function environment(
  assetFetch: ReturnType<typeof vi.fn>,
  approvedEmails: string | undefined = APPROVED_REVIEWER,
) {
  return {
    ASSETS: { fetch: assetFetch },
    GW_APPROVED_REVIEWER_EMAILS: approvedEmails,
  };
}

function approvedHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    accept: 'text/html',
    [IDENTITY_HEADER]: APPROVED_REVIEWER,
    ...extra,
  };
}

describe('Sites worker reviewer identity boundary', () => {
  it('normalizes and de-duplicates the comma-separated reviewer allowlist', () => {
    expect(parseApprovedReviewerEmails(' REVIEWER@example.test,other@example.test,reviewer@example.test ')).toEqual([
      APPROVED_REVIEWER,
      'other@example.test',
    ]);
  });

  it('fails closed before asset access when the allowlist is missing', async () => {
    const assetFetch = vi.fn();
    const response = await worker.fetch(
      request('/', approvedHeaders()),
      { ASSETS: { fetch: assetFetch }, GW_APPROVED_REVIEWER_EMAILS: undefined },
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('Reviewer access is not configured.');
    expect(assetFetch).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toContain(IDENTITY_HEADER);
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
  });

  it('returns the same non-enumerating denial for missing and wrong identities', async () => {
    const assetFetch = vi.fn();
    const missing = await worker.fetch(request('/'), environment(assetFetch));
    const wrong = await worker.fetch(
      request('/', { [IDENTITY_HEADER]: 'wrong-person@example.test' }),
      environment(assetFetch),
    );

    expect(missing.status).toBe(403);
    expect(wrong.status).toBe(403);
    expect(await missing.text()).toBe('Reviewer access denied.');
    expect(await wrong.text()).toBe('Reviewer access denied.');
    expect(assetFetch).not.toHaveBeenCalled();
  });

  it('serves approved HTML with the runtime origin and access marker but no identity', async () => {
    const assetFetch = vi.fn(async (_input: Request) =>
      new Response('<html><head><title>Watchdog</title></head><body>__GW_ORIGIN__</body></html>', {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          etag: 'stale-after-transform',
          vary: 'accept-encoding',
        },
      }),
    );

    const response = await worker.fetch(
      request('/', approvedHeaders({ [IDENTITY_HEADER]: ' Reviewer@Example.Test ' })),
      environment(assetFetch),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(assetFetch).toHaveBeenCalledTimes(1);
    expect((assetFetch.mock.calls[0]?.[0] as Request).headers.get(IDENTITY_HEADER)).toBeNull();
    expect(body).toContain(APPROVED_ACCESS_META);
    expect(body).toContain('https://watchdog.example.test');
    expect(body).not.toContain(APPROVED_REVIEWER);
    expect(body).not.toContain('Reviewer@Example.Test');
    expect(response.headers.get('etag')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe(`accept-encoding, ${IDENTITY_HEADER}`);
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
  });

  it('preserves SPA fallback after authorization and marks the fallback document', async () => {
    const assetFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(
        new Response('<html><head></head><body>__GW_ORIGIN__</body></html>', {
          headers: { 'content-type': 'text/html' },
        }),
      );

    const response = await worker.fetch(
      request('/timeline', approvedHeaders()),
      environment(assetFetch),
    );
    const body = await response.text();

    expect(assetFetch).toHaveBeenCalledTimes(2);
    expect((assetFetch.mock.calls[1]?.[0] as Request).url).toBe(
      'https://watchdog.example.test/index.html',
    );
    expect(body).toContain(APPROVED_ACCESS_META);
    expect(body).toContain('https://watchdog.example.test');
  });

  it('protects approved non-HTML assets without changing their content', async () => {
    const assetFetch = vi.fn(async () =>
      new Response('export const ready = true;', {
        headers: { 'content-type': 'text/javascript' },
      }),
    );

    const response = await worker.fetch(
      request('/assets/app.js', {
        [IDENTITY_HEADER]: APPROVED_REVIEWER,
        accept: 'text/javascript',
      }),
      environment(assetFetch),
    );

    expect(await response.text()).toBe('export const ready = true;');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toContain(IDENTITY_HEADER);
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
  });

  it('never duplicates the approved marker', () => {
    const html = `<html><head>${APPROVED_ACCESS_META}</head><body></body></html>`;
    expect(injectApprovedAccessMeta(html)).toBe(html);
  });
});

/**
 * Issue #233 — the same-origin `/v1` projection namespace.
 *
 * The reservation exists because the SPA fallback used to swallow it: measured before
 * this landed, `/v1/agenda-board` with `accept: text/html` returned **200 and the
 * application shell**, and with `accept: application/json` returned a bare 404 asset
 * miss. Neither is an honest answer for an API path whose bridge is not configured.
 */
describe('Sites worker served-projection namespace (#233)', () => {
  const PROJECTION_503 = 'The same-origin projection bridge is not configured at this origin.';

  it('exports the prefix the website client actually calls', () => {
    // If these ever disagree, the reservation guards a namespace nobody uses while the
    // real one falls through to the SPA fallback again.
    expect(PROJECTION_PREFIX).toBe('/v1');
  });

  it.each([
    ['text/html', 'a browser navigation'],
    ['application/json', 'the v1-projections client'],
  ])('answers a stated 503 for %s (%s) instead of the app shell', async (accept) => {
    const assetFetch = vi.fn();
    const response = await worker.fetch(
      request('/v1/agenda-board', { [IDENTITY_HEADER]: APPROVED_REVIEWER, accept }),
      environment(assetFetch),
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe(PROJECTION_503);
    // The decisive assertion: assets are never consulted, so the extension-less 404 can
    // no longer be reinterpreted as a client route and rewritten into index.html.
    expect(assetFetch).not.toHaveBeenCalled();
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
  });

  it('reserves the bare prefix as well as its children', async () => {
    const assetFetch = vi.fn();
    const response = await worker.fetch(
      request('/v1', { [IDENTITY_HEADER]: APPROVED_REVIEWER, accept: 'application/json' }),
      environment(assetFetch),
    );

    expect(response.status).toBe(503);
    expect(assetFetch).not.toHaveBeenCalled();
  });

  it.each(['/v1x/agenda-board', '/version', '/assets/v1/app.js'])(
    'does not over-claim %s — only the exact segment is reserved',
    async (pathname) => {
      // A prefix test written as `startsWith('/v1')` would swallow all three of these
      // and take real asset paths off the origin.
      const assetFetch = vi.fn(async () =>
        new Response('asset body', { status: 200, headers: { 'content-type': 'text/plain' } }));
      const response = await worker.fetch(
        request(pathname, { [IDENTITY_HEADER]: APPROVED_REVIEWER, accept: 'text/plain' }),
        environment(assetFetch),
      );

      expect(response.status).toBe(200);
      expect(assetFetch).toHaveBeenCalled();
    },
  );

  it('gives an anonymous caller no route oracle — /v1 is byte-identical to any other path', async () => {
    // The reservation sits AFTER the identity gate for exactly this reason. If it ran
    // first, an unapproved caller could distinguish a configured API namespace from an
    // ordinary 404 and learn the origin's shape without ever being admitted.
    const assetFetch = vi.fn();
    const responses = await Promise.all(
      ['/v1/agenda-board', '/some/other/path'].map((pathname) =>
        worker.fetch(
          request(pathname, { accept: 'application/json' }),
          environment(assetFetch),
        )),
    );

    const [projection, ordinary] = responses;
    expect(projection.status).toBe(403);
    expect(projection.status).toBe(ordinary.status);
    expect(await projection.text()).toBe(await ordinary.text());
    expect(assetFetch).not.toHaveBeenCalled();
  });

  it('still refuses before the projection reservation when the allowlist is missing', async () => {
    // Fail-closed ordering holds all the way up: an unconfigured origin must not start
    // answering questions about its namespaces.
    const assetFetch = vi.fn();
    // Built inline, NOT via `environment(assetFetch, undefined)`: a JS default parameter
    // fires on an explicit `undefined`, so that helper would hand back the approved
    // allowlist and quietly test the opposite of what this case is named for.
    const response = await worker.fetch(
      request('/v1/agenda-board', { [IDENTITY_HEADER]: APPROVED_REVIEWER, accept: 'application/json' }),
      { ASSETS: { fetch: assetFetch }, GW_APPROVED_REVIEWER_EMAILS: undefined },
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('Reviewer access is not configured.');
  });
});
