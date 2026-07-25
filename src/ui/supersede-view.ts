/**
 * GOV-1566 F3 — Before/after supersede presenter (consumes the B6 web-safe
 * projection ONLY).
 *
 * Pure / DOM-free so the before↔after pairing, the honest "records being
 * re-reviewed" placeholder, and the fail-closed rules stay unit-testable and
 * restyle-safe; pages-program.ts consumes these and only builds nodes.
 *
 * Invariants carried from the intake plan (§2 "review before display", §5
 * "web-safe transport only", "preserve versions"):
 *  1. `before` was already shown web-safe, so re-showing it on supersede is
 *     honest. `after` is present ONLY when the NEW version is itself web_safe —
 *     while re-review is in flight it is absent, and we NEVER invent it. So the
 *     presence of `after` IS the "new version cleared" verdict; there is no
 *     per-file review flag to read (it would be denylisted).
 *  2. The reprocessing signal is a bare count + a coarse lane. We surface
 *     "N record(s) being re-reviewed" as a content-free placeholder — never a
 *     record's text, a filename, an uploader, or a `review_state`.
 */

import type {
  SupersedeEvent,
  SupersedeProjection,
  SupersedeReprocessingStatus,
} from '../types/read-api';
import type { SuppliedFilesContext } from './supplied-files';

function present(value: string | null | undefined): boolean {
  return value != null && String(value).trim() !== '';
}

function sameMeeting(a: number | string | null | undefined, b: number | string | null | undefined): boolean {
  if (a == null || a === '' || b == null || b === '') return false;
  return String(a) === String(b);
}

/**
 * Supersede events tied to ONE meeting / agenda item, for the before/after view.
 * The tie is taken from the `before` (previously-shown) file — that is the file
 * the reader already knows and the anchor the supersede is "about". Fail-closed:
 * with no tie context we return NOTHING (never dump every supersede into an
 * unrelated drawer). Agenda-item context is the tightest tie and wins; otherwise
 * we fall back to the meeting tie. Every returned event is already web-safe by
 * construction — this function's only job is the TIE, never a review filter.
 */
export function supersedeEventsForItem(
  projection: SupersedeProjection | null | undefined,
  ctx: SuppliedFilesContext,
): SupersedeEvent[] {
  const events = projection?.events ?? [];
  if (present(ctx.agendaItemId)) {
    return events.filter((e) => e.before?.agenda_item_id === ctx.agendaItemId);
  }
  if (ctx.meetingId != null && ctx.meetingId !== '') {
    return events.filter((e) => sameMeeting(e.before?.meeting_id, ctx.meetingId));
  }
  return [];
}

/**
 * Whether the NEW version has itself cleared review. `true` ⇒ `after` is a
 * web-safe file we may show side-by-side; `false` ⇒ the new version is still in
 * re-review and its content must NOT be rendered (show `before` + status only).
 */
export function hasClearedAfter(event: SupersedeEvent): boolean {
  return event.after != null && present(event.after.file_id);
}

/** Human label for the coarse reprocessing lane; verbatim fallback for unknowns. */
export function reprocessingStatusLabel(status: SupersedeReprocessingStatus | null | undefined): string {
  switch (status) {
    case 'queued':
      return 'Re-review queued';
    case 'reviewing':
      return 'Records being re-reviewed';
    case 'complete':
      return 'Re-review complete';
    default:
      return 'Reprocessing status unavailable';
  }
}

/**
 * Honest, content-free notice for the records being re-reviewed after a
 * supersede, or `undefined` when there is nothing to say. It can only ever be a
 * count + lane, because that is the only thing B6 projects about the re-review —
 * never a record's text. A negative / NaN / absent count still reports the lane
 * when the status is known (a supersede with an unknown record count is honest).
 */
export function reprocessingNotice(event: SupersedeEvent): string | undefined {
  const raw = event.reprocessing_record_count;
  const hasCount = raw != null && Number.isFinite(raw) && Math.floor(raw) > 0;
  const hasStatus = event.reprocessing_status != null;
  if (!hasCount && !hasStatus) return undefined;
  const lane = reprocessingStatusLabel(event.reprocessing_status);
  if (!hasCount) return `${lane}.`;
  const n = Math.floor(raw as number);
  const records = `${n} record${n === 1 ? '' : 's'}`;
  // Tense follows the lane so the notice never contradicts itself: a completed
  // re-review is past-tense and drops the "until review completes" hold clause.
  if (event.reprocessing_status === 'complete') {
    return `${lane} — ${records} re-reviewed.`;
  }
  return `${lane} — ${records} being re-reviewed; not re-shown as verified until review completes.`;
}

/** A coarse red-flag banner label for a supersede, or `undefined` when unflagged. */
export function supersedeFlagLabel(event: SupersedeEvent): string | undefined {
  if (!event.flagged) return undefined;
  const reason = present(event.flag_reason)
    ? String(event.flag_reason).replace(/_/g, ' ')
    : undefined;
  return reason
    ? `Superseded — previously-shown information changed (${reason}).`
    : 'Superseded — previously-shown information changed.';
}

/** Ordered, present-only metadata rows for one side (before/after) of a compare. */
export interface SupersedeSideRow {
  key: string;
  label: string;
  value: string;
}

/**
 * The web-safe rows to show for one side of a before/after comparison,
 * present-only. NONE is a raw/local path; version is shown as "v{n}". Title and
 * links are rendered by the caller, so they are intentionally not in this list.
 */
export function supersedeSideRows(file: SupersedeEvent['before'] | null | undefined): SupersedeSideRow[] {
  const rows: SupersedeSideRow[] = [];
  if (!file) return rows;
  const push = (key: string, label: string, value: string | number | null | undefined): void => {
    if (value != null && String(value).trim() !== '') rows.push({ key, label, value: String(value) });
  };
  if (file.version != null) push('version', 'Version', `v${file.version}`);
  push('source_date', 'Date', file.source_date);
  push('published_by', 'Supplied by', file.published_by);
  return rows;
}
