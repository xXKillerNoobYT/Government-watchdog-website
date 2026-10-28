import { describe, expect, it, vi } from 'vitest';

import packageJson from '../package.json';
// @ts-expect-error Build preparation is executable runtime ESM without a declaration file.
import * as sitesBuildModule from '../scripts/prepare-sites-build.mjs';
// @ts-expect-error Deployed Sites Workers are intentionally authored as runtime ESM.
import * as privateWorkerModule from '../scripts/sites-worker.mjs';
// @ts-expect-error Deployed Sites Workers are intentionally authored as runtime ESM.
import * as publicWorkerModule from '../scripts/sites-worker-public.mjs';

const { parseSitesBuildOptions, sitesWorkerSource } = sitesBuildModule;
const { default: privateWorker } = privateWorkerModule;
const { default: publicWorker } = publicWorkerModule;

const IDENTITY_HEADER = 'oai-authenticated-user-email';
const REVIEWER_EMAIL = 'reviewer@example.test';

function request(pathname = '/', headers: Record<string, string> = {}, method = 'GET'): Request {
  return new Request('https://watchdog.example.test' + pathname, { method, headers });
}

describe('Sites Worker build profile selection', () => {
  it('keeps the default and explicit private profile on the gated worker', () => {
    const defaultOptions = parseSitesBuildOptions([]);
    const explicitOptions = parseSitesBuildOptions(['--profile', 'private']);

    expect(defaultOptions).toEqual({ clean: false, profile: 'private' });
    expect(explicitOptions).toEqual({ clean: false, profile: 'private' });
    expect(sitesWorkerSource(defaultOptions.profile)).toBe('scripts/sites-worker.mjs');
    expect(sitesWorkerSource(explicitOptions.profile)).toBe('scripts/sites-worker.mjs');
  });

  it('accepts only an explicit, known profile and known options', () => {
    expect(parseSitesBuildOptions(['--clean', '--profile', 'public'])).toEqual({
      clean: true,
      profile: 'public',
    });
    expect(sitesWorkerSource('public')).toBe('scripts/sites-worker-public.mjs');
    expect(() => parseSitesBuildOptions(['--profile'])).toThrow('--profile must be private or public.');
    expect(() => parseSitesBuildOptions(['--profile', 'publci'])).toThrow('--profile must be private or public.');
    expect(() => parseSitesBuildOptions(['--unknown'])).toThrow('Unknown argument: --unknown');
  });

  it('selects the public worker in both Sites preparation steps', () => {
    const sitesBuild = packageJson.scripts['build:sites-public'];

    expect(sitesBuild).toContain('prepare-sites-build.mjs --clean --profile public');
    expect(sitesBuild).toContain('prepare-sites-build.mjs --profile public');
  });

  it.each([
    { profileArguments: [] },
    { profileArguments: ['--profile', 'private'] },
  ])(
    'retains the private worker access gate for profile arguments $profileArguments',
    async ({ profileArguments }) => {
      const assetFetch = vi.fn();
      const options = parseSitesBuildOptions(profileArguments);
      const worker = options.profile === 'private' ? privateWorker : publicWorker;
      const response = await worker.fetch(request('/'), { ASSETS: { fetch: assetFetch } });

      expect(response.status).toBe(503);
      expect(await response.text()).toBe('Reviewer access is not configured.');
      expect(assetFetch).not.toHaveBeenCalled();
    },
  );
});

describe('public Sites Worker profile', () => {
  it('serves HTML anonymously, substitutes the runtime origin, and makes no reviewer claim', async () => {
    const assetFetch = vi.fn(async (_assetRequest: Request) =>
      new Response('<html><head><title>Watchdog</title></head><body>__GW_ORIGIN__</body></html>', {
        headers: {
          'cache-control': 'public, max-age=300',
          'content-type': 'text/html; charset=utf-8',
          etag: 'stale-after-transform',
        },
      }),
    );
    const response = await publicWorker.fetch(
      request('/', { accept: 'text/html' }),
      { ASSETS: { fetch: assetFetch } },
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(assetFetch).toHaveBeenCalledTimes(1);
    expect(body).toContain('https://watchdog.example.test');
    expect(body).not.toContain(REVIEWER_EMAIL);
    expect(body).not.toContain('gw-sites-access');
    expect(response.headers.get('etag')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(response.headers.get('cache-control')).not.toContain('private');
  });

  it('strips platform identity before Assets and removes it from the public cache key', async () => {
    const assetFetch = vi.fn(async (_assetRequest: Request) =>
      new Response('<html><head></head><body>Public page</body></html>', {
        headers: {
          'content-type': 'text/html',
          vary: 'accept-encoding, ' + IDENTITY_HEADER,
        },
      }),
    );
    const response = await publicWorker.fetch(
      request('/', { accept: 'text/html', [IDENTITY_HEADER]: REVIEWER_EMAIL }),
      {
        ASSETS: { fetch: assetFetch },
        GW_APPROVED_REVIEWER_EMAILS: REVIEWER_EMAIL,
      },
    );
    const forwardedRequest = assetFetch.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(forwardedRequest?.headers.get(IDENTITY_HEADER)).toBeNull();
    expect(response.headers.get('vary')).toBe('accept-encoding');
    expect(await response.text()).not.toContain(REVIEWER_EMAIL);
  });

  it('removes platform identity response headers from public assets', async () => {
    const assetFetch = vi.fn(async (_assetRequest: Request) =>
      new Response('public asset', {
        headers: {
          'content-type': 'text/plain',
          [IDENTITY_HEADER]: REVIEWER_EMAIL,
        },
      }),
    );
    const response = await publicWorker.fetch(request('/asset.txt'), { ASSETS: { fetch: assetFetch } });

    expect(response.status).toBe(200);
    expect(response.headers.get(IDENTITY_HEADER)).toBeNull();
    expect(await response.text()).toBe('public asset');
  });

  it('serves extensionless static assets without treating them as SPA routes', async () => {
    const assetFetch = vi.fn(async (_assetRequest: Request) =>
      new Response('extensionless static body', {
        headers: { 'content-type': 'text/javascript' },
      }),
    );
    const response = await publicWorker.fetch(
      request('/assets/runtime', { accept: 'text/html' }),
      { ASSETS: { fetch: assetFetch } },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('extensionless static body');
    expect(assetFetch).toHaveBeenCalledTimes(1);
  });

  it('uses the public index for extensionless SPA navigation and strips identity on both asset requests', async () => {
    const assetFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(
        new Response('<html><head></head><body>__GW_ORIGIN__</body></html>', {
          headers: {
            'content-type': 'text/html',
            vary: IDENTITY_HEADER,
          },
        }),
      );
    const response = await publicWorker.fetch(
      request('/timeline', { accept: 'text/html', [IDENTITY_HEADER]: REVIEWER_EMAIL }),
      { ASSETS: { fetch: assetFetch } },
    );
    const body = await response.text();
    const firstAssetRequest = assetFetch.mock.calls[0]?.[0];
    const indexAssetRequest = assetFetch.mock.calls[1]?.[0];

    expect(response.status).toBe(200);
    expect(assetFetch).toHaveBeenCalledTimes(2);
    expect(new URL(firstAssetRequest.url).pathname).toBe('/timeline');
    expect(new URL(indexAssetRequest.url).pathname).toBe('/index.html');
    expect(firstAssetRequest.headers.get(IDENTITY_HEADER)).toBeNull();
    expect(indexAssetRequest.headers.get(IDENTITY_HEADER)).toBeNull();
    expect(body).toContain('https://watchdog.example.test');
    expect(body).not.toContain('gw-sites-access');
    expect(response.headers.has('vary')).toBe(false);
  });

  it.each([
    '/v1',
    '/v1/',
    '/v1/agenda-board',
    '/v1/agenda-board?source=browser',
    '/v1%2Fagenda-board',
    '/v1%252Fagenda-board',
    '/v1%25252Fagenda-board',
    '/v1%5Cagenda-board',
    '/V1/agenda-board',
    '/%76%31/agenda-board',
  ])('denies the projection namespace %s before Assets', async (pathname) => {
    const assetFetch = vi.fn();
    const response = await publicWorker.fetch(
      request(pathname, { accept: 'text/html' }),
      { ASSETS: { fetch: assetFetch } },
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not found.');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(assetFetch).not.toHaveBeenCalled();
  });

  it('fails closed on malformed, over-limit, and still-encoded paths', async () => {
    const paths = ['/v1%2', '/' + 'a'.repeat(4096), '/%25252525252525252Fv1'];

    for (const pathname of paths) {
      const assetFetch = vi.fn();
      const response = await publicWorker.fetch(request(pathname), { ASSETS: { fetch: assetFetch } });

      expect(response.status, pathname).toBe(404);
      expect(response.headers.get('cache-control'), pathname).toBe('no-store');
      expect(assetFetch, pathname).not.toHaveBeenCalled();
    }
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])(
    'rejects %s before Assets with a no-store method response',
    async (method) => {
      const assetFetch = vi.fn();
      const response = await publicWorker.fetch(request('/asset.txt', {}, method), {
        ASSETS: { fetch: assetFetch },
      });

      expect(response.status).toBe(405);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('allow')).toBe('GET, HEAD');
      expect(assetFetch).not.toHaveBeenCalled();
    },
  );

  it.each(['GET', 'HEAD'])('forwards supported static method %s to Assets', async (method) => {
    const assetFetch = vi.fn(async (_assetRequest: Request) => new Response('static asset'));
    const response = await publicWorker.fetch(request('/assets/runtime', {}, method), {
      ASSETS: { fetch: assetFetch },
    });
    const forwardedRequest = assetFetch.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(forwardedRequest?.method).toBe(method);
    expect(assetFetch).toHaveBeenCalledTimes(1);
  });

  it.each(['GET', 'HEAD', 'POST', 'OPTIONS'])(
    'keeps the projection namespace denied before method checks for %s',
    async (method) => {
      const assetFetch = vi.fn();
      const response = await publicWorker.fetch(request('/v1%252Fagenda-board', {}, method), {
        ASSETS: { fetch: assetFetch },
      });

      expect(response.status).toBe(404);
      expect(response.headers.get('allow')).toBeNull();
      expect(assetFetch).not.toHaveBeenCalled();
    },
  );

  it('does not use SPA fallback for HEAD navigation', async () => {
    const assetFetch = vi.fn(async (_assetRequest: Request) => new Response('missing', { status: 404 }));
    const response = await publicWorker.fetch(request('/timeline', { accept: 'text/html' }, 'HEAD'), {
      ASSETS: { fetch: assetFetch },
    });

    expect(response.status).toBe(404);
    expect(assetFetch).toHaveBeenCalledTimes(1);
  });

  it.each(['/v1x/agenda-board', '/assets/v1/runtime'])(
    'does not reserve neighboring asset paths %s',
    async (pathname) => {
      const assetFetch = vi.fn(async (_assetRequest: Request) => new Response('public asset'));
      const response = await publicWorker.fetch(
        request(pathname, { accept: 'text/plain' }),
        { ASSETS: { fetch: assetFetch } },
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('public asset');
      expect(assetFetch).toHaveBeenCalledTimes(1);
    },
  );

  it('fails closed when the public Assets binding is unavailable', async () => {
    const response = await publicWorker.fetch(request('/'), {});

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('Sites assets binding is unavailable.');
  });
});
