/**
 * Typed data-access client for the reviewer-internal read-API (GOV-99 Part A/C).
 *
 * Reads ONLY the GOV-98 read-API (web-safe JSON) or a clearly-labeled local
 * fixture — it never invents data and never recomputes publication/trust state.
 * On any live-read failure it falls back to the labeled fixture with a visible
 * notice, per the static-fixture-mode workflow. Everything it returns has
 * passed {@link assertWebSafe} (defense-in-depth raw-path sweep).
 */

import type { ReadApiResponse } from '../types/read-api';
import { assertWebSafe } from './web-safe';
import { isLandingOnly, isReviewerInternalEnvelope, toReadModel } from './api';
import { type AsyncState, resolved } from '../state/async-state';
import fixtureData from '../fixtures/alpine-sample.json';

export interface ClientConfig {
  /** When true (default), read the labeled fixture instead of the live API. */
  useFixtures: boolean;
  /** Base URL of the local read-API; empty → fixture mode. */
  readApiUrl: string;
}

type EnvLike = Record<string, unknown>;

/** Resolve client config from Vite env (overridable for tests). */
export function readConfig(env: EnvLike = import.meta.env as unknown as EnvLike): ClientConfig {
  const rawUseFixtures = String(env.VITE_USE_FIXTURES ?? 'true').trim().toLowerCase();
  const useFixtures = rawUseFixtures !== 'false';
  const readApiUrl = String(env.VITE_READ_API_URL ?? '').trim();
  return { useFixtures, readApiUrl };
}

/**
 * The labeled fixture, swept for raw paths at module load. If a hand edit ever
 * paints a vault/absolute path into the sample, the app fails loud immediately.
 */
export const FIXTURE: ReadApiResponse = assertWebSafe(fixtureData as ReadApiResponse);

/** BEH-STATE-2: a response with no records, thread, tree, or gaps is "empty".
 *  Completeness-gap cards (GOV-298) count: a gaps-only response is a real,
 *  renderable surface (what is missing matters as much as what is present). */
export function isEmptyResponse(r: ReadApiResponse): boolean {
  const records = r.records?.length ?? 0;
  const hasThread = r.agenda_thread ? 1 : 0;
  const hasTree = r.topic_tree ? 1 : 0;
  const gaps = r.completeness_gaps?.length ?? 0;
  return records + hasThread + hasTree + gaps === 0;
}

export interface LoadResult {
  state: AsyncState<ReadApiResponse>;
  /** Surfaced near the fixture banner (e.g. why the live read fell back). */
  notice?: string;
}

export interface LoadOptions {
  config?: ClientConfig;
  /** Injectable fetch (tests / non-browser runtimes). */
  fetchImpl?: typeof fetch;
}

/** An honest-empty read model — the landing-only surface (§6) shows zero civic data. */
const LANDING_ONLY_EMPTY: ReadApiResponse = { scope: 'alpine', access: 'reviewer_internal', records: [] };

async function fetchReadApi(url: string, fetchImpl: typeof fetch): Promise<ReadApiResponse> {
  const res = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`read-API responded ${res.status} ${res.statusText}`.trim());
  const body = (await res.json()) as unknown;
  // The same-origin service (GOV-1527 §5) returns the gated lane as
  // `{reviewer_internal_records:[...]}`; adapt it to the read model the UI
  // consumes. A full read-model envelope passes through unchanged.
  const model = isReviewerInternalEnvelope(body) ? toReadModel(body) : (body as ReadApiResponse);
  // Trust nothing on the wire: re-sweep before it can reach the UI.
  return assertWebSafe(model);
}

const FIXTURE_NOTICE =
  'Showing a captured snapshot of real reviewed records (read_api reviewer-internal serve) — not a live read.';

/**
 * Load the read model. Fixture mode (or no API URL) → labeled fixture. Live
 * mode → fetch the read-API, falling back to the labeled fixture (with a
 * visible notice) on any failure.
 */
export async function loadReadModel(opts: LoadOptions = {}): Promise<LoadResult> {
  const config = opts.config ?? readConfig();
  const fetchImpl =
    opts.fetchImpl ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);

  // LANDING_ONLY (§6): an explicit, fail-closed build with zero /api surface —
  // never touch the network, render honest-empty civic data.
  if (isLandingOnly()) {
    return {
      state: resolved(LANDING_ONLY_EMPTY, 'live', isEmptyResponse),
      notice: 'LANDING_ONLY build — public landing only, no gated data surface.',
    };
  }

  if (config.useFixtures || !config.readApiUrl || !fetchImpl) {
    return { state: resolved(FIXTURE, 'fixture', isEmptyResponse), notice: FIXTURE_NOTICE };
  }

  try {
    const data = await fetchReadApi(config.readApiUrl, fetchImpl);
    return { state: resolved(data, 'live', isEmptyResponse) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      state: resolved(FIXTURE, 'fixture', isEmptyResponse),
      notice: `Live read-API unavailable (${reason}). ${FIXTURE_NOTICE}`,
    };
  }
}
