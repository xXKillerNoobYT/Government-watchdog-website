export const IDENTITY_HEADER = 'oai-authenticated-user-email';
export const APPROVED_EMAILS_BINDING = 'GW_APPROVED_REVIEWER_EMAILS';
export const APPROVED_ACCESS_META = '<meta name="gw-sites-access" content="approved">';

const ACCESS_DENIED_BODY = 'Reviewer access denied.';
const ACCESS_NOT_CONFIGURED_BODY = 'Reviewer access is not configured.';
const PROJECTION_NOT_CONFIGURED_BODY =
  'The same-origin projection bridge is not configured at this origin.';

/**
 * The served-projection namespace (GOV-2180 / issue #233). `src/data/v1-projections.ts`
 * calls `/v1/<projection>` on THIS origin and nowhere else — that root-relative path is
 * the whole same-origin contract, and there is no second hostname and no CORS surface.
 *
 * Nothing forwards it yet: the view API is a loopback service and where it runs in
 * production is an open hosting decision. Until that lands the origin still owes an
 * honest answer, and the two answers it gave before this reservation were both wrong.
 * Measured against this worker:
 *
 *   /v1/agenda-board, approved reviewer, accept: text/html  -> 200 + the SPA index.html
 *   /v1/agenda-board, approved reviewer, accept: json       -> 404 text/plain asset miss
 *
 * The first is an API path serving the application shell, because `isSpaNavigation`
 * treats any extension-less 404 as a client route. The second says "nothing here" when
 * the truth is "the bridge is not configured." So the namespace is reserved and answers
 * a stated 503 — the transport-layer form of a designed gap, naming the missing
 * capability instead of inventing or impersonating a response. `fetchProjection` maps a
 * non-401/403 to `unavailable`, so the UI renders its existing gap state.
 *
 * This is a RESERVATION, not a bridge. Wiring the forward is deliberately left to the
 * change that also brings the upstream, so no binding shape is guessed here.
 *
 * Ordering matters and is asserted in the tests: the reservation sits AFTER the reviewer
 * identity gate. Answering it earlier would give an anonymous caller a different response
 * for `/v1/...` than for any other path, turning the origin into a route oracle — the
 * exact leak #233 requires proving absent.
 */
export const PROJECTION_PREFIX = '/v1';

function isProjectionPath(pathname) {
  return pathname === PROJECTION_PREFIX || pathname.startsWith(`${PROJECTION_PREFIX}/`);
}

export function parseApprovedReviewerEmails(value) {
  if (typeof value !== 'string') return [];

  return [
    ...new Set(
      value
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function privateResponseHeaders(source) {
  const headers = new Headers(source);
  const existingVary = (headers.get('vary') || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value && value !== '*');

  if (!existingVary.some((value) => value.toLowerCase() === IDENTITY_HEADER)) {
    existingVary.push(IDENTITY_HEADER);
  }

  headers.set('cache-control', 'private, no-store');
  headers.set('vary', existingVary.join(', '));
  headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
  return headers;
}

function privateTextResponse(body, status) {
  const headers = privateResponseHeaders({ 'content-type': 'text/plain; charset=utf-8' });
  return new Response(body, { status, headers });
}

function withPrivateHeaders(response) {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: privateResponseHeaders(response.headers),
  });
}

export function injectApprovedAccessMeta(html) {
  if (html.includes(APPROVED_ACCESS_META)) return html;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `  ${APPROVED_ACCESS_META}\n</head>`);
  }
  return `${APPROVED_ACCESS_META}\n${html}`;
}

async function withApprovedHtml(response, request) {
  const contentType = response.headers.get('content-type') || '';
  if (request.method === 'HEAD' || !contentType.includes('text/html')) {
    return withPrivateHeaders(response);
  }

  const runtimeHtml = (await response.text()).replaceAll(
    '__GW_ORIGIN__',
    new URL(request.url).origin,
  );
  const body = injectApprovedAccessMeta(runtimeHtml);
  const headers = privateResponseHeaders(response.headers);
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
    const approvedEmails = parseApprovedReviewerEmails(env?.[APPROVED_EMAILS_BINDING]);
    if (approvedEmails.length === 0) {
      return privateTextResponse(ACCESS_NOT_CONFIGURED_BODY, 503);
    }

    const reviewerEmail = (request.headers.get(IDENTITY_HEADER) || '').trim().toLowerCase();
    if (!reviewerEmail || !approvedEmails.includes(reviewerEmail)) {
      return privateTextResponse(ACCESS_DENIED_BODY, 403);
    }

    // After the identity gate, before assets: see PROJECTION_PREFIX above.
    if (isProjectionPath(new URL(request.url).pathname)) {
      return privateTextResponse(PROJECTION_NOT_CONFIGURED_BODY, 503);
    }

    if (!env?.ASSETS?.fetch) {
      return privateTextResponse('Sites assets binding is unavailable.', 503);
    }

    const assetRequest = withoutIdentityHeader(request);
    const response = await env.ASSETS.fetch(assetRequest);
    if (!isSpaNavigation(response, request)) {
      return withApprovedHtml(response, request);
    }

    const indexUrl = new URL('/index.html', request.url);
    const indexResponse = await env.ASSETS.fetch(withoutIdentityHeader(assetRequest, indexUrl));
    return withApprovedHtml(indexResponse, request);
  },
};

export default worker;
