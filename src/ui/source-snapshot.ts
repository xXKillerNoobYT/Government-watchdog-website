/**
 * Source snapshot (SS) — parser-extracted official material, not reviewed.
 *
 * Binding rules live in docs/design-information-type-matrix.md (class **SS**).
 * Card copy here is authored literal text; never interpolate civic values into
 * the trust label.
 */

/** Visible on every SS card; must not be paraphrased in renderers. */
export const SOURCE_SNAPSHOT_CARD_LABEL =
  'Auto-extracted from the official agenda — not yet reviewed';

export const SOURCE_SNAPSHOT_BINDING = 'source-snapshot';

export const SOURCE_SNAPSHOT_INFORMATION_CLASS = 'SS';

function formatSnapshotDate(isoDate: string): string | undefined {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Meeting date/time from the captured official agenda header (parser output only). */
export function formatSourceSnapshotWhen(
  meetingDate: string | null,
  meetingTime: string | null,
): string | undefined {
  const datePart = meetingDate ? formatSnapshotDate(meetingDate) : undefined;
  if (datePart && meetingTime) return `${datePart} · ${meetingTime}`;
  return datePart ?? meetingTime ?? undefined;
}

/** UTC capture time rendered in the meeting jurisdiction's Mountain time. */
export function formatSourceSnapshotCapturedAt(
  capturedAtUtc: string,
): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(capturedAtUtc)) {
    return undefined;
  }
  const capturedAt = new Date(capturedAtUtc);
  if (Number.isNaN(capturedAt.getTime())) return undefined;
  if (capturedAt.toISOString().slice(0, 19) !== capturedAtUtc.slice(0, 19)) return undefined;

  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Denver',
      timeZoneName: 'short',
    }).formatToParts(capturedAt).map((part) => [part.type, part.value]),
  );
  return `${values.weekday}, ${values.month} ${values.day}, ${values.year} · ${values.hour}:${values.minute} ${values.dayPeriod} ${values.timeZoneName}`;
}
