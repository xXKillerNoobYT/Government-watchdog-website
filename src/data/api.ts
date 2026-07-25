/**
 * Same-origin `/api/*` client (GOV-1527 §5).
 *
 * The browser talks ONLY to the website origin. Every dynamic call is a
 * same-origin `/api/*` request that the hosting layer forwards to the loopback
 * auth/notification service (`Docs/gov1523-artifact-contract-spec.md` §5). There
 * is no second hostname and no CORS surface, so this client never sets an
 * absolute URL or an `Origin`/`mode:'cors'` — a relative `/api/...` path is the
 * whole contract.
 *
 * It stays a thin transport: it re-sweeps every wire payload through
 * {@link assertWebSafe} (defense in depth) and adapts the service's gated lane
 * shape (`{reviewer_internal_records:[...]}`) into the `ReadApiResponse` the UI
 * already consumes — it never recomputes trust or invents rows.
 */

import type { ReadApiResponse } from '../types/read-api';
import {
  normalizeReviewerInternalEnvelope,
  ReviewerNormalizationError,
} from './reviewer-normalize';
import { findRawPathLeaksInText, RawPathLeak } from './web-safe';

export {
  isReviewerInternalEnvelope,
  normalizeReviewerInternalEnvelope,
  toReadModel,
} from './reviewer-normalize';
export type { ReviewerInternalEnvelope } from './reviewer-normalize';

type EnvLike = Record<string, unknown>;

/** Same-origin base for every dynamic call. Overridable only for tests. */
export function apiBase(env: EnvLike = import.meta.env as unknown as EnvLike): string {
  const raw = String(env.VITE_API_BASE ?? '/api').trim();
  return safeApiBase(raw);
}

const ENCODED_PATH_SEPARATOR = /%(?:25)*(?:2f|5c)/i;

/**
 * A base must be one root-relative path. Encoded slash/backslash sequences are
 * rejected before URL resolution so `%2f%2fevil.example` can never become a
 * browser-interpreted network-path reference after a decode/rewrite layer.
 */
function safeApiBase(raw: string): string {
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
    return '/api';
  }
  return value || '/api';
}

/**
 * LANDING_ONLY (§6): an explicit, build-time choice to ship the public landing
 * with ZERO `/api` surface — never an automatic degrade. When set, the app must
 * not attempt any dynamic call.
 */
export function isLandingOnly(env: EnvLike = import.meta.env as unknown as EnvLike): boolean {
  return ['1', 'true', 'yes'].includes(String(env.VITE_LANDING_ONLY ?? '').trim().toLowerCase());
}

export type ReviewerRequestFailureKind = 'denied' | 'unavailable' | 'invalid';

export class ReviewerRequestError extends Error {
  readonly kind: ReviewerRequestFailureKind;
  readonly status?: number;

  constructor(
    kind: ReviewerRequestFailureKind,
    message: string,
    options: ErrorOptions & { status?: number } = {},
  ) {
    super(message, options);
    this.name = 'ReviewerRequestError';
    this.kind = kind;
    this.status = options.status;
  }
}

/** Eight seconds keeps a route bounded while allowing ordinary beta latency. */
export const REVIEWER_REQUEST_TIMEOUT_MS = 8_000;

export interface ApiOptions {
  /** Injectable fetch (tests / non-browser runtimes). */
  fetchImpl?: typeof fetch;
  /**
   * Session bearer token for the gated lane. The service authorizes via
   * `Authorization: Bearer <token>` (accounts.gate.guard_civic_request). In the
   * browser this comes from the issued session; absent → the service answers 403
   * and the UI shows its existing gated states (never civic data).
   */
  token?: string;
  base?: string;
  /** Positive finite test override; production uses the fixed eight-second cap. */
  timeoutMs?: number;
}

function resolveFetch(opts: ApiOptions): typeof fetch {
  const impl = opts.fetchImpl ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);
  if (!impl) {
    throw new ReviewerRequestError('unavailable', 'no fetch implementation available');
  }
  return impl;
}

function authHeaders(opts: ApiOptions): Record<string, string> {
  const h: Record<string, string> = { accept: 'application/json' };
  if (opts.token) h.authorization = `Bearer ${opts.token}`;
  return h;
}

function timeoutFor(opts: ApiOptions): number {
  const timeoutMs = opts.timeoutMs ?? REVIEWER_REQUEST_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new ReviewerRequestError('invalid', 'timeoutMs must be a positive finite number');
  }
  return timeoutMs;
}

async function boundedRequest<T>(
  opts: ApiOptions,
  operation: (fetchImpl: typeof fetch, signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = timeoutFor(opts);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ReviewerRequestError(
        'unavailable',
        `reviewer request timed out after ${timeoutMs}ms`,
      ));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      operation(resolveFetch(opts), controller.signal),
      timeout,
    ]);
  } catch (error) {
    if (error instanceof ReviewerRequestError) throw error;
    throw new ReviewerRequestError('unavailable', 'reviewer request failed', {
      cause: error,
    });
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** GET /api/health — zero-civic-data liveness (backend_commit + schema_version). */
export async function fetchHealth(opts: ApiOptions = {}): Promise<{ status: number; body: unknown }> {
  const base = safeApiBase(opts.base ?? apiBase());
  return boundedRequest(opts, async (fetchImpl, signal) => {
    const res = await fetchImpl(`${base}/health`, {
      credentials: 'same-origin',
      headers: authHeaders(opts),
      redirect: 'error',
      signal,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  });
}

/**
 * GET /api/reviewer-internal — the gated lane, session-authorized only. Returns
 * the adapted read model on 200; throws on any non-200 (fail closed — the caller
 * renders gated states, never partial civic data).
 */
export async function fetchReviewerInternal(opts: ApiOptions = {}): Promise<ReadApiResponse> {
  const base = safeApiBase(opts.base ?? apiBase());
  return boundedRequest(opts, async (fetchImpl, signal) => {
    const res = await fetchImpl(`${base}/reviewer-internal`, {
      credentials: 'same-origin',
      headers: authHeaders(opts),
      redirect: 'error',
      signal,
    });
    if (!res.ok) {
      const kind: ReviewerRequestFailureKind =
        res.status === 401 || res.status === 403 ? 'denied' : 'unavailable';
      throw new ReviewerRequestError(
        kind,
        `/api/reviewer-internal responded ${res.status} ${res.statusText}`.trim(),
        { status: res.status },
      );
    }

    let text: string;
    try {
      text = await res.text();
    } catch (error) {
      throw new ReviewerRequestError('unavailable', 'could not read reviewer response body', {
        cause: error,
      });
    }

    const rawLeaks = findRawPathLeaksInText(text);
    if (rawLeaks.length > 0) {
      throw new ReviewerRequestError(
        'invalid',
        `reviewer response failed raw web-safe sweep: ${rawLeaks.join('; ')}`,
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(text) as unknown;
    } catch (error) {
      throw new ReviewerRequestError('invalid', 'reviewer response was not valid JSON', {
        cause: error,
      });
    }

    try {
      return normalizeReviewerInternalEnvelope(body);
    } catch (error) {
      if (error instanceof ReviewerNormalizationError || error instanceof RawPathLeak) {
        throw new ReviewerRequestError('invalid', 'reviewer response failed validation', {
          cause: error,
        });
      }
      throw error;
    }
  });
}
