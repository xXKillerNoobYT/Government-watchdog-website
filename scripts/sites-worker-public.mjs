const IDENTITY_HEADER = 'oai-authenticated-user-email';
const PROJECTION_PREFIX = '/v1';

const ASSETS_UNAVAILABLE_BODY = 'Sites assets binding is unavailable.';
const PROJECTION_DENIED_BODY = 'Not found.';

function isProjectionPath(pathname) {
  try {
    const decodedPath = decodeURIComponent(pathname);
    return decodedPath === PROJECTION_PREFIX || decodedPath.startsWith(PROJECTION_PREFIX + '/');
  } catch {
    return pathname === PROJECTION_PREFIX || pathname.startsWith(PROJECTION_PREFIX + '/');
  }
}

function publicResponseHeaders(source) {
  const headers = new Headers(source);
  const vary = (headers.get('vary') || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value && value.toLowerCase() !== IDENTITY_HEADER);

  if (vary.length > 0) {
    headers.set('vary', vary.join(', '));
  } else {
    headers.delete('vary');
  }

  return headers;
}

function publicTextResponse(request, body, status) {
  return new Response(request.method === 'HEAD' ? null : body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow, noarchive',
    },
  });
}

function withPublicHeaders(response) {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: publicResponseHeaders(response.headers),
  });
}

async function withPublicHtml(response, request) {
  const contentType = response.headers.get('content-type') || '';
  if (request.method === 'HEAD' || !contentType.includes('text/html')) {
    return withPublicHeaders(response);
  }

  const body = (await response.text()).replaceAll(
    '__GW_ORIGIN__',
    new URL(request.url).origin,
  );
  const headers = publicResponseHeaders(response.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.delete('etag');

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isSpaNavigation(response, request) {
  const pathname = new URL(request.url).pathname;
  return (
    response.status === 404 &&
    request.method === 'GET' &&
    (request.headers.get('accept') || '').includes('text/html') &&
    !(pathname.split('/').pop() || '').includes('.')
  );
}

function withoutIdentityHeader(request, url = request.url) {
  const assetRequest = new Request(url, request);
  assetRequest.headers.delete(IDENTITY_HEADER);
  return assetRequest;
}

const worker = {
  async fetch(request, env) {
    if (isProjectionPath(new URL(request.url).pathname)) {
      return publicTextResponse(request, PROJECTION_DENIED_BODY, 404);
    }

    if (typeof env?.ASSETS?.fetch !== 'function') {
      return publicTextResponse(request, ASSETS_UNAVAILABLE_BODY, 503);
    }

    const assetRequest = withoutIdentityHeader(request);
    const response = await env.ASSETS.fetch(assetRequest);
    if (!isSpaNavigation(response, request)) {
      return withPublicHtml(response, request);
    }

    const indexUrl = new URL('/index.html', request.url);
    const indexResponse = await env.ASSETS.fetch(withoutIdentityHeader(assetRequest, indexUrl));
    return withPublicHtml(indexResponse, request);
  },
};

export default worker;
