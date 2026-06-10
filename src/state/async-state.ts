/**
 * Shared loading / empty / error state primitives (1.06 §9 / BEH-STATE-1,2,5,7).
 *
 * Every data-backed surface in the timeline app moves through this one state
 * machine so empty, loading, and error are first-class, consistent, and
 * impossible to forget — a blank screen never silently stands in for "loaded
 * but empty" or "failed". `fixture` rides alongside `mode` so a labeled-sample
 * banner can always be shown when data is not live.
 */

export type AsyncStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

/** Where the data came from. Drives the "FIXTURE MODE — Not real data" banner. */
export type DataMode = 'live' | 'fixture';

export interface AsyncState<T> {
  status: AsyncStatus;
  /** Present only when status === 'ready'. */
  data?: T;
  /** Human-readable error summary; present only when status === 'error'. */
  error?: string;
  /** Source of the data, when known (set as soon as a load attempt resolves). */
  mode?: DataMode;
}

export const idle = <T>(): AsyncState<T> => ({ status: 'idle' });

export const loading = <T>(mode?: DataMode): AsyncState<T> => ({ status: 'loading', mode });

/**
 * Resolve a successful load into `ready` or `empty`. `isEmpty` decides whether
 * the payload counts as "nothing to show" (e.g. zero records) — BEH-STATE-2.
 */
export function resolved<T>(data: T, mode: DataMode, isEmpty: (data: T) => boolean): AsyncState<T> {
  return isEmpty(data) ? { status: 'empty', mode } : { status: 'ready', data, mode };
}

export const failed = <T>(error: unknown, mode?: DataMode): AsyncState<T> => ({
  status: 'error',
  error: error instanceof Error ? error.message : String(error),
  mode,
});

export const isFixture = (state: AsyncState<unknown>): boolean => state.mode === 'fixture';
