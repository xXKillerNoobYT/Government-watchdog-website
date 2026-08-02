/**
 * Typed data-access client for the reviewer-internal read-API (GOV-99 Part A/C).
 *
 * Reads ONLY the GOV-98 read-API (web-safe JSON) or a clearly-labeled local
 * fixture — it never invents data and never recomputes publication/trust state.
 * Fixture mode must be selected explicitly. A failed live read stays an error;
 * it never silently becomes a captured private snapshot. Everything returned
 * from a successful read has passed {@link assertWebSafe} (defense-in-depth
 * raw-path sweep).
 */

import type { ReadApiResponse } from '../types/read-api';
import { assertWebSafe } from './web-safe';
import { apiBase, isLandingOnly, isReviewerInternalEnvelope, toReadModel } from './api';
import { type AsyncState, failed, resolved } from '../state/async-state';

export interface ClientConfig {
  /** When true, read the labeled fixture instead of the live API. */
  useFixtures: boolean;
  /** Same-origin reviewer endpoint used when fixture mode is disabled. */
  readApiUrl: string;
}

type EnvLike = Record<string, unknown>;

/** Resolve client config from Vite env (overridable for tests). */
export function readConfig(env: EnvLike = import.meta.env as unknown as EnvLike): ClientConfig {
  const rawUseFixtures = String(env.VITE_USE_FIXTURES ?? 'false').trim().toLowerCase();
  const useFixtures = ['1', 'true', 'yes'].includes(rawUseFixtures);
  const readApiUrl = `${apiBase(env)}/reviewer-internal`;
  return { useFixtures, readApiUrl };
}

/**
 * Load the labeled sample. Deliberately a dynamic import with NO static counterpart
 * (GOV-49 step 1b).
 *
 * Measured, not assumed: a module reachable through a static import cannot move to a lazy
 * chunk — Rollup keeps it in the static graph and a dynamic import merely references the copy
 * already there. The previous `export const FIXTURE = assertWebSafe(fixtureData)` against a
 * static import therefore pinned **198.4 KB** into the entry of every build and spent ~3.7 ms
 * sweeping it on every page load.
 *
 * Tests import the sample from `test/sample-fixture.ts`. **Do not re-add a static import
 * here** — one static reference anywhere in `src/` re-pins the bytes.
 *
 * The web-safe proof is preserved: swept below before the value escapes this function, and
 * asserted in CI by `test/client-fixture-web-safe.test.ts`.
 */
async function loadSampleFixture(): Promise<ReadApiResponse> {
  const loaded = await import('../fixtures/alpine-sample.json');
  return assertWebSafe(loaded.default as unknown as ReadApiResponse);
}

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
  fetchImpl?: typeof fetch | null;
}

/** An honest-empty read model — the landing-only surface (§6) shows zero civic data. */
const LANDING_ONLY_EMPTY: ReadApiResponse = { scope: 'alpine', access: 'public', records: [] };

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
 * Load the read model. Explicit fixture mode → labeled fixture. Live mode
 * requires both an API URL and fetch implementation and remains fail-closed on
 * any missing configuration or request failure.
 */
export async function loadReadModel(opts: LoadOptions = {}): Promise<LoadResult> {
  const config = opts.config ?? readConfig();
  const fetchImpl =
    opts.fetchImpl === null
      ? undefined
      : opts.fetchImpl ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);

  // LANDING_ONLY (§6): an explicit, fail-closed build with zero /api surface —
  // never touch the network, render honest-empty civic data.
  if (isLandingOnly()) {
    return {
      state: resolved(LANDING_ONLY_EMPTY, 'live', isEmptyResponse),
      notice: 'LANDING_ONLY build — public landing only, no gated data surface.',
    };
  }

  if (config.useFixtures) {
    const sample = await loadSampleFixture();
    return { state: resolved(sample, 'fixture', isEmptyResponse), notice: FIXTURE_NOTICE };
  }

  const liveUnavailable = (reason: string): LoadResult => ({
    state: failed<ReadApiResponse>(
      new Error(`Live read-API unavailable (${reason}). No captured snapshot was substituted.`),
      'live',
    ),
    notice: 'Live read-API unavailable. No private capture or synthetic sample was substituted.',
  });
  if (!config.readApiUrl) return liveUnavailable('same-origin reviewer endpoint is not configured');
  if (!fetchImpl) return liveUnavailable('fetch is not available in this runtime');

  try {
    const data = await fetchReadApi(config.readApiUrl, fetchImpl);
    return { state: resolved(data, 'live', isEmptyResponse) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return liveUnavailable(reason);
  }
}
