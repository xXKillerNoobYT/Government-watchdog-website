/**
 * Served `/v1` projection client (GOV-2180 — consumer for backend GOV-1816 / the
 * GOV-1817 view-API envelope).
 *
 * GOV-1816 makes the reviewer-internal RV projections reachable over `/v1`
 * (`agenda-board`, `card-feed`, `newsletter-feed`, `newsletter-digest`,
 * `source-inventory`, `completeness-gaps`, `topic-tree`), each served VERBATIM
 * from the reviewed registry (`origin` = `live`) nested under `data` inside the
 * mandatory GOV-1817 envelope, behind the civic gate (approved tier). Until the
 * website consumes them, the MOTY RV screens render checked-in fixtures that can
 * silently drift from the registry — the exact defect BE#144 exists to close on
 * the consumer side.
 *
 * This module is that consumer. It is a THIN transport, mirroring
 * `src/data/api.ts`:
 *
 *  - The browser talks ONLY to the website origin. Every call is a same-origin
 *    `/v1/...` GET; the hosting/dev layer forwards it to the loopback view-API
 *    service (`scripts/view_api.py`). There is no second hostname and no CORS
 *    surface — a root-relative `/v1/...` path is the whole contract.
 *  - It re-sweeps the wire text through the raw-path gate ({@link
 *    findRawPathLeaksInText}) and the unwrapped `data` through the appropriate
 *    web-safe walk (defence in depth over the backend's own transport sweep).
 *  - It NEVER recomputes trust, rounds a count, invents a row, or synthesizes
 *    freshness. It returns the served `data` verbatim and the envelope's
 *    `sourceFreshness` map as-is so the UI can render its absence as a Designed
 *    Gap rather than a fabricated value.
 *  - It fails CLOSED: any non-200, a bad envelope, a raw-path leak, or a
 *    validation failure throws a {@link ReviewerRequestError}; the caller renders
 *    its existing gated / gap states, never partial civic data.
 *
 * The reversible env flip {@link useServedProjections} selects this served path
 * over the checked-in `src/fixtures/*.json`. It defaults to the fixture path this
 * slice: the served path is proven equivalent and the default flips to served in
 * the cutover follow-up, once the same-origin `/v1` bridge and an authorized
 * reviewer session are reachable (the transport half is tracked separately).
 */

import type { CardFeed } from '../ui/card-feed';
import type { AgendaBoard } from '../types/agenda-board';
import type { NewsletterDigestResponse } from '../types/newsletter-digest';
import { ReviewerRequestError, REVIEWER_REQUEST_TIMEOUT_MS, REVIEWER_BODY_LIMIT_BYTES } from './api';
import type { ReviewerRequestFailureKind } from './api';
import {
  assertWebSafe,
  assertDigestWebSafe,
  findRawPathLeaksInText,
  RawPathLeak,
} from './web-safe';

type EnvLike = Record<string, unknown>;

/**
 * The closed set of data-origin values the website contract recognizes. Mirrors
 * `scripts/view_api.py:ORIGINS` exactly — an `origin` outside this set is a
 * contract violation, not a value to display.
 */
export const PROJECTION_ORIGINS = [
  'live',
  'reviewed_snapshot',
  'backend_test_seed',
  'synthetic_design_fixture',
] as const;
export type ProjectionOrigin = (typeof PROJECTION_ORIGINS)[number];

/** Standing scope gate — Alpine only. Mirrors `view_api.py:SCOPE`. */
export const PROJECTION_SCOPE = 'alpine';

/**
 * The mandatory GOV-1817 response envelope, stamped by the running view-API
 * service around every `/v1` body. `origin` is a property of the service, never
 * caller-settable; `sourceFreshness` is an honest per-source map (empty this
 * slice — its absence renders as a Designed Gap, never invented freshness).
 */
export interface ProjectionEnvelope {
  scope: string;
  access: string;
  origin: ProjectionOrigin;
  generatedAt: string;
  sourceFreshness: Record<string, unknown>;
}

/** A validated projection: the verbatim served `data` plus its envelope. */
export interface ProjectionResult<T> {
  data: T;
  envelope: ProjectionEnvelope;
}

/** Injectable options, mirroring {@link import('./api').ApiOptions}. */
export interface ProjectionOptions {
  /** Injectable fetch (tests / non-browser runtimes). */
  fetchImpl?: typeof fetch;
  /** Session bearer for the gated lane; absent → the service answers 403. */
  token?: string;
  /** Root-relative base override (tests). Production uses {@link v1Base}. */
  base?: string;
  /** Positive finite test override; production uses the fixed timeout. */
  timeoutMs?: number;
  /** Positive test-only cap that may narrow, never raise, the body limit. */
  bodyLimitBytes?: number;
}

const ENCODED_PATH_SEPARATOR = /%(?:25)*(?:2f|5c)/i;

/**
 * A base must be one root-relative path. Encoded slash/backslash sequences are
 * rejected before URL resolution so a decoded/rewritten value can never become a
 * browser-interpreted network-path reference. Mirrors `api.ts:safeApiBase`.
 */
function safeV1Base(raw: string): string {
  const value = raw.trim().replace(/\/+$/, '');
  if (
    !value.startsWith('/')
    || value.startsWith('//')
    || value.includes('\\')
    || value.includes('?')
    || value.includes('#')
    || /[\u0000-\u001f\u007f]/.test(value)
    || ENCODED_PATH_SEPARATOR.test(value)
  ) {
    return '/v1';
  }
  return value || '/v1';
}

/** Same-origin base for every `/v1` call. Overridable only for tests. */
export function v1Base(env: EnvLike = import.meta.env as unknown as EnvLike): string {
  const raw = String(env.VITE_V1_BASE ?? '/v1').trim();
  return safeV1Base(raw);
}

/**
 * The reversible flip (GOV-2180 AC). When set, the RV screens render from the
 * served `/v1` response instead of `src/fixtures/*.json`. Defaults to the fixture
 * path this slice; the cutover follow-up flips the default to served once the
 * served path is proven equivalent against the live `/v1` bridge.
 */
export function useServedProjections(
  env: EnvLike = import.meta.env as unknown as EnvLike,
): boolean {
  return ['1', 'true', 'yes'].includes(
    String(env.VITE_SERVED_PROJECTIONS ?? '').trim().toLowerCase(),
  );
}

/**
 * `true` when the envelope carries at least one per-source freshness entry. This
 * slice the backend sends an honest empty map, so the RV screens render a
 * Designed Gap for freshness rather than inventing an `as-of`. The consumer only
 * REPORTS presence; it never fabricates a freshness value.
 */
export function hasSourceFreshness(envelope: ProjectionEnvelope): boolean {
  return Object.keys(envelope.sourceFreshness).length > 0;
}

function isProjectionOrigin(value: unknown): value is ProjectionOrigin {
  return typeof value === 'string' && (PROJECTION_ORIGINS as readonly string[]).includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function timeoutFor(opts: ProjectionOptions): number {
  const timeoutMs = opts.timeoutMs ?? REVIEWER_REQUEST_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new ReviewerRequestError('invalid', 'timeoutMs must be a positive finite number');
  }
  return timeoutMs;
}

function bodyLimitFor(opts: ProjectionOptions): number {
  const limit = opts.bodyLimitBytes ?? REVIEWER_BODY_LIMIT_BYTES;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > REVIEWER_BODY_LIMIT_BYTES) {
    throw new ReviewerRequestError(
      'invalid',
      `bodyLimitBytes must be a positive safe integer no greater than ${REVIEWER_BODY_LIMIT_BYTES}`,
    );
  }
  return limit;
}

function resolveFetch(opts: ProjectionOptions): typeof fetch {
  const impl = opts.fetchImpl ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);
  if (!impl) {
    throw new ReviewerRequestError('unavailable', 'no fetch implementation available');
  }
  return impl;
}

function authHeaders(opts: ProjectionOptions): Record<string, string> {
  const h: Record<string, string> = { accept: 'application/json' };
  if (opts.token) h.authorization = `Bearer ${opts.token}`;
  return h;
}

/**
 * Validate the mandatory envelope and unwrap the verbatim `data`. Throws
 * (fail-closed) on any deviation from the GOV-1817 contract: a smuggled or
 * caller-chosen origin, a wrong scope or projection name, a non-object freshness
 * map, or a missing `data` slot are all bugs, not values to render.
 */
function unwrapEnvelope(body: unknown, expectedProjection: string): { data: unknown; envelope: ProjectionEnvelope } {
  if (!isPlainObject(body)) {
    throw new ReviewerRequestError('invalid', 'projection response is not a JSON object');
  }
  if (body.scope !== PROJECTION_SCOPE) {
    throw new ReviewerRequestError('invalid', `projection scope ${JSON.stringify(body.scope)} is not ${PROJECTION_SCOPE}`);
  }
  if (typeof body.access !== 'string' || body.access.trim() === '') {
    throw new ReviewerRequestError('invalid', 'projection envelope is missing a resolved access tier');
  }
  if (!isProjectionOrigin(body.origin)) {
    throw new ReviewerRequestError('invalid', `projection origin ${JSON.stringify(body.origin)} is not a recognized data-origin`);
  }
  if (typeof body.generatedAt !== 'string' || body.generatedAt.trim() === '') {
    throw new ReviewerRequestError('invalid', 'projection envelope is missing generatedAt');
  }
  if (!isPlainObject(body.sourceFreshness)) {
    throw new ReviewerRequestError('invalid', 'projection envelope sourceFreshness must be an object');
  }
  if (body.projection !== expectedProjection) {
    throw new ReviewerRequestError('invalid', `projection ${JSON.stringify(body.projection)} does not match expected ${JSON.stringify(expectedProjection)}`);
  }
  if (!('data' in body)) {
    throw new ReviewerRequestError('invalid', 'projection envelope is missing its data body');
  }
  const envelope: ProjectionEnvelope = {
    scope: body.scope,
    access: body.access,
    origin: body.origin,
    generatedAt: body.generatedAt,
    sourceFreshness: body.sourceFreshness,
  };
  return { data: body.data, envelope };
}

/**
 * GET `<base>/<route>` and return the validated projection. `expectedProjection`
 * is the backend's `Projection.name`; `validateData` is the web-safe walk for the
 * unwrapped body (route-aware — the digest exempts `/alpine/` links). Non-200
 * fails closed: 401/403 (the constant gate denial) → `denied`, otherwise
 * `unavailable`.
 */
async function fetchProjection<T>(
  route: string,
  expectedProjection: string,
  validateData: (data: unknown) => T,
  opts: ProjectionOptions = {},
): Promise<ProjectionResult<T>> {
  const base = safeV1Base(opts.base ?? v1Base());
  const bodyLimitBytes = bodyLimitFor(opts);
  const timeoutMs = timeoutFor(opts);
  const fetchImpl = resolveFetch(opts);

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ReviewerRequestError('unavailable', `projection request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  const request = (async (): Promise<ProjectionResult<T>> => {
    const res = await fetchImpl(`${base}/${route}`, {
      credentials: 'same-origin',
      headers: authHeaders(opts),
      redirect: 'error',
      signal: controller.signal,
    });
    if (!res.ok) {
      const kind: ReviewerRequestFailureKind =
        res.status === 401 || res.status === 403 ? 'denied' : 'unavailable';
      throw new ReviewerRequestError(
        kind,
        `/v1/${route} responded ${res.status} ${res.statusText}`.trim(),
        { status: res.status },
      );
    }

    const contentType = res.headers.get('content-type')?.toLowerCase() ?? '';
    if (contentType.split(';', 1)[0]?.trim() !== 'application/json') {
      throw new ReviewerRequestError('invalid', 'projection response is not JSON');
    }

    const text = await res.text();
    if (new TextEncoder().encode(text).byteLength > bodyLimitBytes) {
      throw new ReviewerRequestError('invalid', 'projection response body is too large');
    }
    if (!text.trim()) {
      throw new ReviewerRequestError('invalid', 'projection response body is empty');
    }

    const rawLeaks = findRawPathLeaksInText(text);
    if (rawLeaks.length > 0) {
      throw new ReviewerRequestError('invalid', `projection response failed raw web-safe sweep: ${rawLeaks.join('; ')}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch (error) {
      throw new ReviewerRequestError('invalid', 'projection response was not valid JSON', { cause: error });
    }

    const { data, envelope } = unwrapEnvelope(parsed, expectedProjection);
    try {
      return { data: validateData(data), envelope };
    } catch (error) {
      if (error instanceof RawPathLeak) {
        throw new ReviewerRequestError('invalid', 'projection data failed web-safe validation', { cause: error });
      }
      throw error;
    }
  })();

  try {
    return await Promise.race([request, timeout]);
  } catch (error) {
    if (error instanceof ReviewerRequestError) throw error;
    throw new ReviewerRequestError('unavailable', 'projection request failed', { cause: error });
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** GET /v1/card-feed — the reviewer-internal Alpine timeline card feed (RV). */
export function fetchCardFeed(opts: ProjectionOptions = {}): Promise<ProjectionResult<CardFeed>> {
  return fetchProjection('card-feed', 'card-feed', (data) => assertWebSafe(data as CardFeed), opts);
}

/** GET /v1/agenda-board — the reviewed Alpine agenda-board projection (RV). */
export function fetchAgendaBoard(opts: ProjectionOptions = {}): Promise<ProjectionResult<AgendaBoard>> {
  return fetchProjection('agenda-board', 'agenda-board', (data) => assertWebSafe(data as AgendaBoard), opts);
}

/**
 * GET /v1/newsletter-digest — the reviewer-internal Alpine digest (RV). Uses the
 * route-aware digest sweep: `/alpine/` reviewer-internal links are exempt from
 * the absolute-path rule exactly as `loadDigestResponse` treats the fixture.
 */
export function fetchNewsletterDigest(opts: ProjectionOptions = {}): Promise<ProjectionResult<NewsletterDigestResponse>> {
  return fetchProjection(
    'newsletter-digest',
    'newsletter-digest',
    (data) => assertDigestWebSafe(data as NewsletterDigestResponse),
    opts,
  );
}
