/**
 * Pure presenter for the loading / empty / error / ready states (BEH-STATE).
 *
 * Kept free of the DOM so the state→copy mapping is unit-testable in node and
 * the rendering layer (render.ts) stays thin. Exact label TEXT lives here so a
 * later visual slice can restyle without changing wording, and so tests pin the
 * copy. No trust is computed here — backend labels are passed through verbatim.
 */

import type { AsyncState } from '../state/async-state';
import type { ReadApiResponse, StatementRecord, UiStatus } from '../types/read-api';

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
      return {
        kind: 'ready',
        heading: 'Alpine timeline (reviewer-internal)',
        message: readyHeaderMessage(state.data?.records ?? []),
        ...base,
      };
    }
  }
}

/**
 * Ready-state header copy (GOV-100 done-bar criterion, from UXProductDesigner).
 *
 * The old copy said "{n} reviewed records" — a blanket trust word over the whole
 * set, which contradicts a mixed set containing any unverified / AI / pending /
 * disputed row (BEH-LABEL). This counts by the ACTUAL backend trust label each
 * record already carries (verbatim `trustLabel`, no recompute) and surfaces an
 * explicit AI-produced count, so no trust word is ever applied to records that
 * did not earn it. Pass-up boundary respected: only grouping/counting fields the
 * read-API already sent — never deriving publication state on the client.
 */
export function readyHeaderMessage(records: StatementRecord[]): string {
  const n = records.length;
  if (n === 0) return 'No records in this view.';
  const groups = summarizeRecords(records);
  const breakdown = groups.map((g) => `${g.count} ${g.label}`).join(' · ');
  const aiCount = records.filter(isAiProduced).length;
  const aiSuffix = aiCount > 0 ? ` · ${aiCount} AI-produced` : '';
  return `${n} record${n === 1 ? '' : 's'} · ${breakdown}${aiSuffix}`;
}

export interface TrustGroup {
  label: string;
  count: number;
}

/**
 * Count records by their verbatim backend trust label, preserving first-seen
 * order. Pure counting of `ui_status` (via {@link trustLabel}) — no derivation,
 * no upgrade, no invented publication state.
 */
export function summarizeRecords(records: StatementRecord[]): TrustGroup[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const r of records) {
    const label = trustLabel(r);
    if (!counts.has(label)) order.push(label);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return order.map((label) => ({ label, count: counts.get(label)! }));
}

/**
 * Visual tone for a trust state — drives the badge colour ONLY, never a trust
 * decision. The backend's `ui_status` is the source of truth; this is a pure
 * presentation mapping kept here so render.ts and the legend agree on colour.
 *  - `ok`      backend says it is source-backed/eligible,
 *  - `caution` provisional/unreviewed (not yet trustable, not yet a hard stop),
 *  - `stop`    a hard "do not treat as fact" state (disputed / do-not-publish / source problems),
 *  - `neutral` corrected (kept neutral — a correction is informative, not alarming).
 */
export type TrustTone = 'ok' | 'caution' | 'stop' | 'neutral';

export function statusTone(status: UiStatus): TrustTone {
  switch (status) {
    case 'source-backed':
    case 'archived-source-backed':
      return 'ok';
    case 'corrected':
      return 'neutral';
    case 'pending-review':
    case 'unverified':
    case 'needs-clarification':
      return 'caution';
    case 'source-changed':
    case 'source-missing':
    case 'disputed':
    case 'do-not-publish':
      return 'stop';
    default:
      return 'caution';
  }
}

/**
 * Verbatim, human-readable label for a single backend `ui_status` value. Covers
 * all 10 states of the trust vocabulary (uiStatus-map.v1) so no served status
 * ever falls through to its raw kebab-case wire form on a card or in the legend.
 * Pure mapping — never a trust derivation.
 */
export function uiStatusLabel(status: UiStatus): string {
  switch (status) {
    case 'source-backed':
      return 'Source-backed';
    case 'archived-source-backed':
      return 'Source-backed (archived)';
    case 'corrected':
      return 'Corrected';
    case 'pending-review':
      return 'Pending review';
    case 'unverified':
      return 'Unverified';
    case 'needs-clarification':
      return 'Needs clarification';
    case 'source-changed':
      return 'Source changed';
    case 'source-missing':
      return 'Source missing';
    case 'disputed':
      return 'Disputed';
    case 'do-not-publish':
      return 'Do not publish';
    default:
      return status;
  }
}

/** Verbatim, human-readable label for a record's backend trust state. */
export function trustLabel(record: StatementRecord): string {
  return uiStatusLabel(record.ui_status ?? 'unverified');
}

/** The tone for a record's badge (colour only — defaults to `caution`). */
export function recordTone(record: StatementRecord): TrustTone {
  return statusTone(record.ui_status ?? 'unverified');
}

/**
 * Whether a record must carry the locked/visible AI label (standing gate). True
 * when the backend says it was AI-produced — the frontend never hides this.
 */
export function isAiProduced(record: StatementRecord): boolean {
  return record.produced_by === 'ai';
}

export const AI_LABEL_TEXT = 'AI — not independently verified';
