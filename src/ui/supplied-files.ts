/**
 * GOV-1566 F2 — Supplied source-file presenter (consumes the B6 web-safe
 * projection ONLY).
 *
 * Pure / DOM-free so the meeting↔file tie, the honest pending placeholder, and
 * the fail-closed rules stay unit-testable and restyle-safe; pages-program.ts
 * consumes these and only builds nodes.
 *
 * Two invariants carried from the intake plan (§2 "review before display",
 * §5 "web-safe transport only") hold here verbatim:
 *  1. Presence in `projection.files` IS the web-safe verdict. B6 returns only
 *     `web_safe` files, so this module NEVER re-derives a review state (there is
 *     no `review_state` on the wire to read — it is denylisted) and NEVER
 *     invents a file. Pending/held files are simply absent.
 *  2. The pending count is a bare integer. We surface "N pending" as a
 *     content-free placeholder — never a filename, uploader, version, or any
 *     byte of a not-yet-reviewed file.
 */

import type { SuppliedSourceFile, SuppliedFilesProjection } from '../types/read-api';

const UNTIED_MEETING_GROUP = '__untied_reviewed_file__';

/** The meeting / agenda-item a drawer is asking supplied files for. */
export interface SuppliedFilesContext {
  meetingId?: number | string | null;
  agendaItemId?: string | null;
}

/** Loose-equality on a meeting id that may arrive as number OR string. */
function sameMeeting(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
): boolean {
  if (a == null || a === '' || b == null || b === '') return false;
  return String(a) === String(b);
}

function present(value: string | null | undefined): boolean {
  return value != null && String(value).trim() !== '';
}

/**
 * GOV-1609 §4.2 — provenance URL display-safety. A field named like a URL may
 * hold prose in the beta, so only a parsed http(s) value may become an anchor.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!present(value)) return null;
  const trimmed = String(value).trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? trimmed : null;
}

/**
 * Return reviewed files tied to one agenda item or meeting. With no tie context
 * this fails closed and returns nothing instead of dumping unrelated files.
 */
export function suppliedFilesForItem(
  projection: SuppliedFilesProjection | null | undefined,
  ctx: SuppliedFilesContext,
): SuppliedSourceFile[] {
  const files = projection?.files ?? [];
  if (present(ctx.agendaItemId)) {
    return files.filter((file) => file.agenda_item_id === ctx.agendaItemId);
  }
  if (ctx.meetingId != null && ctx.meetingId !== '') {
    return files.filter((file) => sameMeeting(file.meeting_id, ctx.meetingId));
  }
  return [];
}

/** One meeting's reviewed files, for the vault overview grouping. */
export interface SuppliedFilesMeetingGroup {
  /** Web-safe meeting id (string-normalized), or `null` for files with no tie. */
  meetingId: string | null;
  files: SuppliedSourceFile[];
}

/**
 * Group all reviewed supplied files by meeting in first-seen order. Untied
 * reviewed files remain visible under a null meeting id.
 */
export function groupSuppliedFilesByMeeting(
  projection: SuppliedFilesProjection | null | undefined,
): SuppliedFilesMeetingGroup[] {
  const groups: SuppliedFilesMeetingGroup[] = [];
  const index = new Map<string, SuppliedFilesMeetingGroup>();
  for (const file of projection?.files ?? []) {
    const key = file.meeting_id != null && file.meeting_id !== ''
      ? String(file.meeting_id)
      : UNTIED_MEETING_GROUP;
    let group = index.get(key);
    if (!group) {
      group = {
        meetingId: key === UNTIED_MEETING_GROUP ? null : key,
        files: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    group.files.push(file);
  }
  return groups;
}

/**
 * Honest, content-free placeholder copy for files still in review.
 */
export function pendingReviewNotice(
  projection: SuppliedFilesProjection | null | undefined,
): string | undefined {
  const raw = projection?.pending_review_count;
  if (raw == null || !Number.isFinite(raw)) return undefined;
  const count = Math.floor(raw);
  if (count <= 0) return undefined;
  return `${count} supplied file${count === 1 ? '' : 's'} pending review — not shown until independently reviewed.`;
}

/** Ordered, present-only metadata rows for one reviewed file. */
export interface SuppliedFileMetaRow {
  key: string;
  label: string;
  value: string;
}

/** Build the web-safe, present-only metadata rows shown under a reviewed file. */
export function suppliedFileMeta(file: SuppliedSourceFile): SuppliedFileMetaRow[] {
  const rows: SuppliedFileMetaRow[] = [];
  const push = (
    key: string,
    label: string,
    value: string | number | null | undefined,
  ): void => {
    if (value != null && String(value).trim() !== '') {
      rows.push({ key, label, value: String(value) });
    }
  };
  push('source_type', 'Type', humanType(file.source_type));
  push('published_by', 'Supplied by', file.published_by);
  push('source_date', 'Date', file.source_date);
  push('agenda_item', 'Agenda item', present(file.agenda_item_id) ? file.agenda_item_id : undefined);
  if (file.version != null) push('version', 'Version', `v${file.version}`);
  return rows;
}

/** Title-case a snake_case source type for display; verbatim fallback. */
function humanType(type: string | null | undefined): string | undefined {
  if (!present(type)) return undefined;
  return String(type).replace(/_/g, ' ').replace(/^\w/, (character) => character.toUpperCase());
}

/**
 * GOV-1634 (GOV-1566 F2 follow-up; consumes the B6 `provenance_note` field added
 * by GOV-1625). The reviewed file's free-text provenance line, present-only:
 * the trimmed note, or `undefined` when absent/blank.
 *
 * This is prose the backend emits VERBATIM (e.g. "Handed to the Watchdog by the
 * Town Clerk"). It is deliberately kept OUT of {@link suppliedFileMeta} and OUT
 * of {@link safeHttpUrl}: unlike `original_url` a provenance note is NOT a
 * locator and must NEVER be auto-linkified, even if the prose happens to contain
 * a URL-shaped substring (GOV-1609 §4.2 display-safety — only a validated
 * http(s) `original_url` is a clickable link). Callers render the returned
 * string as a plain text node, never as an anchor. Pinned by test (gov1634).
 */
export function suppliedFileProvenanceNote(file: SuppliedSourceFile): string | undefined {
  return present(file.provenance_note) ? String(file.provenance_note).trim() : undefined;
}
