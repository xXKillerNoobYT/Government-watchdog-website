/**
 * Pure timeline + agenda-thread + completeness logic (GOV-101, Slice 4·C).
 *
 * DOM-free so chronology, Alpine-scope locking, thread assembly, and the
 * fail-closed completeness rule all stay unit-testable in node — render.ts
 * consumes this and only builds nodes. Mirrors the GOV-102 topic-tree.ts split.
 *
 * Three hard rules carried from GOV-99/100 hold here verbatim:
 *  1. **No trust / publication state is recomputed.** This module only ORDERS
 *     records and ARRANGES thread members by their backend-given dates and typed
 *     edges. It never reads/derives `ui_status` or `publication_state`. The one
 *     date it computes (`recordTimelineDate`) is a *display ordering key* parsed
 *     from web-safe fields — not a trust signal.
 *  2. **Completeness fails closed to `unknown`, never to `complete`.** The
 *     backend owns completeness; absent data renders as "completeness unknown",
 *     and an asserted `complete` carrying gaps is downgraded to `gaps`. The
 *     frontend never invents a missing item and never false-completes
 *     (BEH-COMPLETE-1..3; pass-up trigger if you ever feel you must derive it).
 *  3. **No link is inferred from title similarity** (BEH-AGENDA-3) — thread
 *     membership comes only from the backend `members[]` set and typed lifecycle
 *     edges, never from matching titles.
 */

import type {
  ReadApiResponse,
  StatementRecord,
  AgendaThreadResponse,
  AgendaItemMember,
  EvidenceLink,
  ThreadCompleteness,
  CompletenessGap,
  CompletenessGapKind,
} from '../types/read-api';
import { edgeTypeLabel } from './statement-presenter';

// --- Alpine scope lock (BEH-FILTER-1/2) -------------------------------------

/** The only jurisdiction namespace this slice serves. */
export const ALPINE_SCOPE = 'alpine';

/** Web-safe ids are namespaced `alpine:YYYY-MM-DD:item-N` — the prefix is scope. */
function idNamespace(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  const colon = id.indexOf(':');
  return colon === -1 ? undefined : id.slice(0, colon);
}

/**
 * Whether a record is in-scope for the Alpine timeline. A record is dropped only
 * when it is DEMONSTRABLY out of scope — its `agenda_item_id` carries a non-alpine
 * namespace. A record with no agenda id is kept (it cannot be proven non-Alpine,
 * and the backend already scopes the response); the top-level `scope` guard in
 * {@link partitionAlpine} handles a wholesale non-Alpine response.
 */
export function isAlpineRecord(record: StatementRecord): boolean {
  const ns = idNamespace(record.agenda_item_id);
  return ns === undefined || ns === ALPINE_SCOPE;
}

export interface DroppedRecord {
  statement_id: string;
  reason: string;
}

export interface ScopePartition {
  kept: StatementRecord[];
  dropped: DroppedRecord[];
  /** Human-readable lines for the caller to log (BEH-FILTER-2). */
  warnings: string[];
}

/**
 * Split records into Alpine-scoped (kept) and out-of-scope (dropped + logged).
 * If the whole response is not Alpine-scoped, EVERY record is dropped — the
 * frontend never silently shows another jurisdiction's data under an Alpine view.
 */
export function partitionAlpine(response: ReadApiResponse): ScopePartition {
  const records = response.records ?? [];
  const kept: StatementRecord[] = [];
  const dropped: DroppedRecord[] = [];
  const warnings: string[] = [];

  const responseAlpine = response.scope === ALPINE_SCOPE;
  for (const r of records) {
    if (!responseAlpine) {
      dropped.push({ statement_id: r.statement_id, reason: `response scope "${response.scope}" is not "${ALPINE_SCOPE}"` });
      continue;
    }
    if (!isAlpineRecord(r)) {
      dropped.push({ statement_id: r.statement_id, reason: `agenda_item_id namespace "${idNamespace(r.agenda_item_id)}" is not "${ALPINE_SCOPE}"` });
      continue;
    }
    kept.push(r);
  }
  for (const d of dropped) warnings.push(`[timeline] dropped non-Alpine record ${d.statement_id}: ${d.reason}`);
  return { kept, dropped, warnings };
}

// --- Chronology (newest-first by a derived, web-safe ordering date) ----------

const ISO_DATE_RE = /(\d{4}-\d{2}-\d{2})/;

/** First ISO `YYYY-MM-DD` embedded in a string, if any. */
function isoDateIn(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const m = ISO_DATE_RE.exec(value);
  return m ? m[1] : undefined;
}

/** Latest ISO date across an evidence row's web-safe date fields. */
function evidenceDate(e: EvidenceLink): string | undefined {
  const candidates = [e.source_date, e.scan_date, e.last_validated_utc].map(isoDateIn).filter(Boolean) as string[];
  return candidates.length ? candidates.sort().at(-1) : undefined;
}

/**
 * The display ordering date for a record (NOT a trust signal). Resolution order,
 * all from web-safe fields:
 *   1. the meeting date embedded in `agenda_item_id` (`alpine:YYYY-MM-DD:item-N`),
 *   2. else the latest evidence `source_date` / `scan_date` / `last_validated_utc`.
 * Returns `undefined` when no web-safe date is available; such records sort last
 * (and stably) rather than being invented a date.
 */
export function recordTimelineDate(record: StatementRecord): string | undefined {
  const fromId = isoDateIn(record.agenda_item_id);
  if (fromId) return fromId;
  const evidenceDates = (record.evidence ?? []).map(evidenceDate).filter(Boolean) as string[];
  return evidenceDates.length ? evidenceDates.sort().at(-1) : undefined;
}

export interface OrderedRecord {
  record: StatementRecord;
  /** The resolved ordering date, or undefined when none could be derived. */
  timelineDate?: string;
}

/**
 * Order records newest-first by {@link recordTimelineDate}. Dateless records
 * sort to the end. Ties (and dateless records) keep their original payload order
 * (stable) so ordering is deterministic and never invents a sequence.
 */
export function orderedTimeline(records: StatementRecord[]): OrderedRecord[] {
  const withIndex = records.map((record, index) => ({ record, index, timelineDate: recordTimelineDate(record) }));
  withIndex.sort((a, b) => {
    if (a.timelineDate && b.timelineDate) {
      if (a.timelineDate !== b.timelineDate) return a.timelineDate < b.timelineDate ? 1 : -1; // newest first
      return a.index - b.index;
    }
    if (a.timelineDate) return -1; // dated before dateless
    if (b.timelineDate) return 1;
    return a.index - b.index; // both dateless: stable
  });
  return withIndex.map(({ record, timelineDate }) => ({ record, timelineDate }));
}

export interface Timeline {
  ordered: OrderedRecord[];
  dropped: DroppedRecord[];
  warnings: string[];
}

/** Compose the scope lock + chronological ordering for a response. */
export function buildTimeline(response: ReadApiResponse): Timeline {
  const { kept, dropped, warnings } = partitionAlpine(response);
  return { ordered: orderedTimeline(kept), dropped, warnings };
}

// --- Agenda cross-meeting thread assembly (BEH-AGENDA-1..5) ------------------

export interface AssembledLink {
  /** Typed label from the backend edge_type (Supersedes / Amends / Revisits). */
  label: string;
  /** 'out' = this instance → an earlier one; 'in' = a later instance → this one. */
  direction: 'out' | 'in';
  targetId: string;
  targetTitle: string;
}

export interface ThreadInstance {
  member: AgendaItemMember;
  /** Meeting date parsed from the member id, for known-then ordering. */
  meetingDate?: string;
  /** Primary label for the instance (its own title — never another's). */
  title: string;
  /** Typed lifecycle links that touch this instance (no title-similarity links). */
  links: AssembledLink[];
  /** True when no lifecycle edge touches this instance (BEH-AGENDA edge absence). */
  hasNoLinks: boolean;
}

export interface AssembledThread {
  thread: AgendaThreadResponse['thread'];
  /** Instances in known-then order (earliest meeting first). */
  instances: ThreadInstance[];
  /** True when ≥2 instances are connected by ≥1 typed lifecycle edge. */
  hasLifecycleConnection: boolean;
}

/** "no linked prior/next item recorded" — shown when an instance has no edge. */
export const NO_LINK_TEXT = 'no linked prior/next item recorded';

function memberTitle(m: AgendaItemMember): string {
  return m.title?.trim() || m.agenda_item_id;
}

/**
 * Assemble a thread's per-meeting instances in known-then order and attach each
 * instance's TYPED lifecycle links. Order is by meeting date (parsed from the
 * member id), then `item_order`, then payload order — all backend-given, never
 * by title similarity (BEH-AGENDA-3). Each instance keeps its own title; earlier
 * instances are returned unchanged (BEH-AGENDA-4/5).
 */
export function assembleThread(response: AgendaThreadResponse): AssembledThread {
  const members = response.members ?? [];
  const edges = response.lifecycle_edges ?? [];
  const titleOf = (id: string): string => members.find((m) => m.agenda_item_id === id)?.title?.trim() || id;

  const ordered = members
    .map((member, index) => ({ member, index, meetingDate: isoDateIn(member.agenda_item_id) }))
    .sort((a, b) => {
      if (a.meetingDate && b.meetingDate && a.meetingDate !== b.meetingDate) return a.meetingDate < b.meetingDate ? -1 : 1; // known-then: earliest first
      if (a.meetingDate && !b.meetingDate) return -1;
      if (!a.meetingDate && b.meetingDate) return 1;
      const ao = a.member.item_order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.member.item_order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return a.index - b.index;
    });

  const instances: ThreadInstance[] = ordered.map(({ member, meetingDate }) => {
    const id = member.agenda_item_id;
    const links: AssembledLink[] = [];
    for (const edge of edges) {
      if (edge.from_node_id === id) links.push({ label: edgeTypeLabel(edge.edge_type), direction: 'out', targetId: edge.to_node_id, targetTitle: titleOf(edge.to_node_id) });
      else if (edge.to_node_id === id) links.push({ label: edgeTypeLabel(edge.edge_type), direction: 'in', targetId: edge.from_node_id, targetTitle: titleOf(edge.from_node_id) });
    }
    return { member, meetingDate, title: memberTitle(member), links, hasNoLinks: links.length === 0 };
  });

  const connectedNodes = new Set<string>();
  for (const edge of edges) {
    connectedNodes.add(edge.from_node_id);
    connectedNodes.add(edge.to_node_id);
  }
  const memberIds = new Set(members.map((m) => m.agenda_item_id));
  const connectedMembers = [...connectedNodes].filter((n) => memberIds.has(n));
  const hasLifecycleConnection = edges.length > 0 && connectedMembers.length >= 2;

  return { thread: response.thread, instances, hasLifecycleConnection };
}

// --- Completeness (BEH-COMPLETE-1..3, fail-closed) --------------------------

export type CompletenessState = 'complete' | 'gaps' | 'unknown';

export interface CompletenessGapView {
  kind: CompletenessGapKind;
  label: string;
  detail?: string;
}

export interface CompletenessView {
  state: CompletenessState;
  /** One-line summary text for the indicator. */
  summary: string;
  /** Present only in the `gaps` state — what the backend says is missing. */
  gaps: CompletenessGapView[];
}

const GAP_KIND_LABEL: Record<CompletenessGapKind, string> = {
  missing_meeting_instance: 'missing meeting instance',
  missing_agenda_packet: 'missing agenda packet',
  missing_minutes_transcript: 'missing minutes/transcript',
  unreviewed_instance: 'unreviewed instance',
};

function gapLabel(kind: CompletenessGapKind): string {
  return GAP_KIND_LABEL[kind] ?? String(kind).replace(/_/g, ' ');
}

const COMPLETE_TEXT = 'complete';
const UNKNOWN_TEXT = 'completeness unknown';

/**
 * Project backend completeness into a render-ready view, FAIL-CLOSED:
 *  - absent / `unknown` / unrecognised → `unknown` ("completeness unknown"),
 *  - `gaps` (or `complete` that nonetheless carries gaps) → `gaps`, listing each
 *    gap verbatim — an incomplete thread can NEVER read as complete,
 *  - `complete` with no gaps → `complete`.
 * Never invents a gap and never upgrades silence to `complete` (BEH-COMPLETE).
 */
export function completenessView(completeness: ThreadCompleteness | null | undefined): CompletenessView {
  const gaps = (completeness?.gaps ?? []).map((g: CompletenessGap) => ({
    kind: g.kind,
    label: gapLabel(g.kind),
    ...(g.detail && g.detail.trim() ? { detail: g.detail.trim() } : {}),
  }));

  if (gaps.length > 0) {
    const kinds = gaps.map((g) => g.label).join(', ');
    return { state: 'gaps', summary: `gaps (${kinds})`, gaps };
  }
  if (completeness?.state === 'complete') {
    return { state: 'complete', summary: COMPLETE_TEXT, gaps: [] };
  }
  return { state: 'unknown', summary: UNKNOWN_TEXT, gaps: [] };
}
