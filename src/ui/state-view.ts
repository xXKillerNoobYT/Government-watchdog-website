/**
 * Pure presenter for the loading / empty / error / ready states (BEH-STATE).
 *
 * Kept free of the DOM so the state→copy mapping is unit-testable in node and
 * the rendering layer (render.ts) stays thin. Exact label TEXT lives here so a
 * later visual slice can restyle without changing wording, and so tests pin the
 * copy. No trust is computed here — backend labels are passed through verbatim.
 */

import type { AsyncState } from '../state/async-state';
import type { ReadApiResponse, StatementRecord } from '../types/read-api';

export interface StateView {
  kind: 'loading' | 'empty' | 'error' | 'ready';
  heading: string;
  message: string;
  /** Show the "FIXTURE MODE — Not real data" banner above the surface. */
  showFixtureBanner: boolean;
  /** Extra line under the banner (e.g. live-read fallback reason). */
  notice?: string;
}

export const FIXTURE_BANNER_TEXT = 'FIXTURE MODE — Not real data';

export function stateView(state: AsyncState<ReadApiResponse>, notice?: string): StateView {
  const showFixtureBanner = state.mode === 'fixture';
  const base = { showFixtureBanner, ...(notice ? { notice } : {}) };
  switch (state.status) {
    case 'idle':
    case 'loading':
      return { kind: 'loading', heading: 'Loading…', message: 'Fetching the reviewer-internal Alpine timeline.', ...base };
    case 'empty':
      return {
        kind: 'empty',
        heading: 'Nothing to show yet',
        message: 'No reviewed, source-backed records are available for this view.',
        ...base,
      };
    case 'error':
      return {
        kind: 'error',
        heading: 'Could not load the timeline',
        message: state.error ?? 'An unexpected error occurred.',
        ...base,
      };
    case 'ready': {
      const n = state.data?.records?.length ?? 0;
      return {
        kind: 'ready',
        heading: 'Alpine timeline (reviewer-internal)',
        message: `${n} reviewed record${n === 1 ? '' : 's'}.`,
        ...base,
      };
    }
  }
}

/** Verbatim, human-readable label for a record's backend trust state. */
export function trustLabel(record: StatementRecord): string {
  const ui = record.ui_status ?? 'unverified';
  switch (ui) {
    case 'source-backed':
      return 'Source-backed';
    case 'archived-source-backed':
      return 'Source-backed (archived)';
    case 'corrected':
      return 'Corrected';
    case 'disputed':
      return 'Disputed';
    case 'unverified':
      return 'Unverified';
    case 'pending-review':
      return 'Pending review';
    default:
      return ui;
  }
}

/**
 * Whether a record must carry the locked/visible AI label (standing gate). True
 * when the backend says it was AI-produced — the frontend never hides this.
 */
export function isAiProduced(record: StatementRecord): boolean {
  return record.produced_by === 'ai';
}

export const AI_LABEL_TEXT = 'AI — not independently verified';
