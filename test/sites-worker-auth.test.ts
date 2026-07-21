import { describe, expect, it, vi } from 'vitest';

// @ts-expect-error The deployed Sites worker is intentionally authored as runtime ESM.
import * as sitesWorkerModule from '../scripts/sites-worker.mjs';

const {
  default: worker,
  APPROVED_ACCESS_META,
  IDENTITY_HEADER,
  injectApprovedAccessMeta,
  parseApprovedReviewerEmails,
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
