/**
 * Trust / AI legend data (GOV-104, Slice 4·E — 1.06 §3.5 / §4).
 *
 * Pure data layer for the reviewer-internal legend that explains EVERY trust
 * label a card can show, plus the locked AI label and the fixture-mode banner.
 * DOM-free so the wording is unit-testable and a later visual slice can restyle
 * the disclosure (render.ts builds the tap-reachable `<details>`).
 *
 * Two rules this encodes:
 *  1. **Exhaustive.** One entry per `UiStatus` is generated from
 *     {@link ALL_UI_STATUSES}; the exhaustiveness guard on that array means a new
 *     backend status cannot ship without a legend explanation (a card would
 *     otherwise show a label the legend never defines).
 *  2. **No trust invented.** The label text comes verbatim from
 *     {@link uiStatusLabel}; the legend only adds plain-English *meaning*, never a
 *     new status or an upgraded reading of one.
 */

import type { UiStatus } from '../types/read-api';
import { ALL_UI_STATUSES } from '../types/read-api';
import { uiStatusLabel, statusTone, AI_LABEL_TEXT, FIXTURE_BANNER_TEXT, type TrustTone } from './state-view';

export interface LegendEntry {
  /** Stable key for `data-test` / rendering (`status-…` or `ai` / `fixture`). */
  key: string;
  label: string;
  /** Plain-English meaning for a reviewer — never a trust upgrade. */
  meaning: string;
  tone: TrustTone;
  /** True for the locked AI label and the fixture banner (non-status entries). */
  meta?: boolean;
}

/** Plain-English meaning for each backend trust state (reviewer-facing copy). */
const STATUS_MEANING: Record<UiStatus, string> = {
  'source-backed': 'A reviewed claim backed by a linked original source.',
  'archived-source-backed': 'Source-backed, and the source also has a saved archive copy.',
  corrected: 'A later correction replaced or amended this; the earlier record is kept, not erased.',
  'pending-review': 'Captured but not yet reviewed by a person — do not treat as confirmed.',
  unverified: 'No source link confirmed yet — not independently verified.',
  'needs-clarification': 'The record is ambiguous and awaits official clarification.',
  'source-changed': 'The original source page changed since capture — re-verify before relying on it.',
  'source-missing': 'The original source could not be retrieved — the claim is unsupported right now.',
  disputed: 'Sources conflict; both sides are shown and no single version is asserted as fact.',
  'do-not-publish': 'Held back from any public-facing view — reviewer-internal only.',
};

/** The legend title (reviewer-internal). */
export const LEGEND_TITLE = 'What these labels mean';

/**
 * The full legend: one entry per trust state (in {@link ALL_UI_STATUSES} display
 * order), then the locked AI label, then the fixture-mode banner. Every label a
 * card or banner can show is explained exactly once.
 */
export function trustLegend(): LegendEntry[] {
  const statuses: LegendEntry[] = ALL_UI_STATUSES.map((status) => ({
    key: `status-${status}`,
    label: uiStatusLabel(status),
    meaning: STATUS_MEANING[status],
    tone: statusTone(status),
  }));
  return [
    ...statuses,
    {
      key: 'ai',
      label: AI_LABEL_TEXT,
      meaning: 'Produced by AI. Shown clearly labeled and separated from facts — never presented as an independently verified record.',
      tone: 'caution',
      meta: true,
    },
    {
      key: 'fixture',
      label: FIXTURE_BANNER_TEXT,
      meaning: 'The screen is showing an offline captured sample, not a live read from the read-API — the on-screen notice says whether it is a real reviewed snapshot or a synthetic demo.',
      tone: 'caution',
      meta: true,
    },
  ];
}
