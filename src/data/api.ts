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

import type { ReadApiResponse, StatementRecord } from '../types/read-api';
import { assertWebSafe } from './web-safe';

type EnvLike = Record<string, unknown>;

/** Same-origin base for every dynamic call. Overridable only for tests. */
export function apiBase(env: EnvLike = import.meta.env as unknown as EnvLike): string {
  const raw = String(env.VITE_API_BASE ?? '/api').trim();
  // Never allow an absolute/cross-origin base to sneak in — same-origin only.
  if (/^https?:\/\//i.test(raw)) return '/api';
  return raw.replace(/\/$/, '') || '/api';
}

/**
 * LANDING_ONLY (§6): an explicit, build-time choice to ship the public landing
 * with ZERO `/api` surface — never an automatic degrade. When set, the app must
 * not attempt any dynamic call.
 */
export function isLandingOnly(env: EnvLike = import.meta.env as unknown as EnvLike): boolean {
  return ['1', 'true', 'yes'].includes(String(env.VITE_LANDING_ONLY ?? '').trim().toLowerCase());
}

/** The gated lane envelope the artifact service returns from /api/reviewer-internal. */
interface ReviewerInternalEnvelope {
  reviewer_internal_records?: StatementRecord[];
}

/** True when a wire body is the gated-lane envelope (vs. a full read model). */
export function isReviewerInternalEnvelope(body: unknown): body is ReviewerInternalEnvelope {
  return !!body && typeof body === 'object' && Array.isArray((body as ReviewerInternalEnvelope).reviewer_internal_records);
}

/**
 * Adapt the service's flat gated-lane list into the `ReadApiResponse` the UI
 * renders. The records are the SAME web-safe statement shape the read model
 * already carries; we only wrap them with the scope + access markers. Trust
 * fields (`ui_status`, `verification_status`, …) are passed up verbatim.
 */
export function toReadModel(envelope: ReviewerInternalEnvelope): ReadApiResponse {
  return {
    scope: 'alpine',
    access: 'reviewer_internal',
    records: envelope.reviewer_internal_records ?? [],
  };
}

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
}

function resolveFetch(opts: ApiOptions): typeof fetch {
  const impl = opts.fetchImpl ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);
  if (!impl) throw new Error('no fetch implementation available');
  return impl;
}

function authHeaders(opts: ApiOptions): Record<string, string> {
  const h: Record<string, string> = { accept: 'application/json' };
  if (opts.token) h.authorization = `Bearer ${opts.token}`;
  return h;
}

/** GET /api/health — zero-civic-data liveness (backend_commit + schema_version). */
export async function fetchHealth(opts: ApiOptions = {}): Promise<{ status: number; body: unknown }> {
  const base = opts.base ?? apiBase();
  const res = await resolveFetch(opts)(`${base}/health`, { headers: authHeaders(opts) });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/**
 * GET /api/reviewer-internal — the gated lane, session-authorized only. Returns
 * the adapted read model on 200; throws on any non-200 (fail closed — the caller
 * renders gated states, never partial civic data).
 */
export async function fetchReviewerInternal(opts: ApiOptions = {}): Promise<ReadApiResponse> {
  const base = opts.base ?? apiBase();
  const res = await resolveFetch(opts)(`${base}/reviewer-internal`, { headers: authHeaders(opts) });
  if (!res.ok) throw new Error(`/api/reviewer-internal responded ${res.status} ${res.statusText}`.trim());
  const body = (await res.json()) as unknown;
  if (!isReviewerInternalEnvelope(body)) throw new Error('unexpected /api/reviewer-internal body shape');
  // Trust nothing on the wire: re-sweep, then adapt.
  return assertWebSafe(toReadModel(body));
}
