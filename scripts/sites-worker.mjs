export const IDENTITY_HEADER = 'oai-authenticated-user-email';
export const APPROVED_EMAILS_BINDING = 'GW_APPROVED_REVIEWER_EMAILS';
export const APPROVED_ACCESS_META = '<meta name="gw-sites-access" content="approved">';

const ACCESS_DENIED_BODY = 'Reviewer access denied.';
const ACCESS_NOT_CONFIGURED_BODY = 'Reviewer access is not configured.';

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
