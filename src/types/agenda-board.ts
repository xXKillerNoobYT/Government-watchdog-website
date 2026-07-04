/**
 * Web-safe TypeScript types for the GOV-605 agenda-board projection.
 *
 * These MIRROR the backend projection contract (GOV-601 §2), captured verbatim
 * from `scripts/stage5_agenda_board.py::agenda_board(conn)` over the reviewed
 * Alpine read-API (`read_api.reviewer_internal_records`). Spec:
 * backend `Docs/gov605-agenda-board-projection.md` (merge 655afba3, PR #96).
 *
 * The same two hard rules that govern `read-api.ts` apply here:
 *
 *  1. **No raw-path / private fields exist in the type surface.** The backend
 *     sweeps the whole board with `assert_no_raw_paths` before return, so a raw
 *     locator (`segment_id`, transcript path, …) can never even be *named* here.
 *     `videoRef` carries only a public URL + integer timestamp — never the
 *     web-UNSAFE `segment_id` it was composed from.
 *
 *  2. **The frontend never recomputes trust.** `statusBadge` / `confidenceBadge`
 *     / `lane` / `gapBadges` are produced fail-closed by the backend surface and
 *     consumed VERBATIM. The client never upgrades a status, invents a lane, or
 *     hides a disclosed gap. Latent fields (`decisions`, `categoryAnchor`) arrive
 *     empty + disclosed and are rendered as disclosed-empty, never faked.
 */

/** The six frozen lifecycle lanes (backend `stage5_frontend_surface.LANE_ORDER`). */
export type AgendaLaneKey =
  | 'upcoming'
  | 'active'
  | 'pending-decision'
  | 'decided'
  | 'follow-up'
  | 'correction';

/** A deep-link into the meeting video — public URL + integer offset only. */
export interface VideoRef {
  url: string;
  timestampSeconds: number;
}

/** A typed lineage edge (never an untyped "related" — GOV-601 §2 / BEH-AGENDA-2). */
export interface LineageEdge {
  /** e.g. `agenda_item_supersedes` / `agenda_item_amends` / `updates_statement`. */
  relation: string;
  /** The agenda-item id or statement id the relation points at. */
  ref: string;
}

/** A web-safe locator inside a source reference (page / section / timestamp / …). */
export interface SourceLocator {
  page?: number;
  section?: string;
  paragraph?: string;
  timestampHuman?: string;
  timestampSeconds?: number;
}

/** One web-safe source reference from a card's evidence drawer. */
export interface SourceRef {
  sourceId: string;
  originalUrl?: string;
  archiveUrl?: string;
  locator?: SourceLocator;
}

/** The disclosed-empty category anchor (topic layer is Isaac-scoped / latent). */
export interface CategoryAnchor {
  kind: string; // always `agenda_thread` today
  disclosure: string;
}

/**
 * One agenda-item card: the aggregation of a meeting's reviewed statements under
 * a single agenda item (keyed on `agendaItemId`), laid in exactly one lane.
 */
export interface AgendaBoardCard {
  cardId: string;
  agendaItemId: string;
  agendaItemTitle?: string;
  itemOrder?: number;

  meetingId?: number | null;
  meetingDate?: string;
  meetingBody?: string;
  meetingTitle?: string;
  /** Only present when the backend had a public http(s) meeting URL. */
  meetingSourceUrl?: string;

  /** Present only when the agenda item is linked to an agenda thread. */
  agendaThreadId?: string;
  threadLabel?: string;
  threadStatus?: string;

  lane: AgendaLaneKey | string;
  laneLabel: string;
  /** Verbatim backend badge string ("Verified" / "Unverified" / …). */
  statusBadge: string;
  /** Verbatim backend confidence label value ("auto_caption_untimed" / …). */
  confidenceBadge?: string;

  videoRef?: VideoRef;
  lineage: LineageEdge[];
  sourceRefs: SourceRef[];

  /** LATENT — always [] + disclosed at board level (never fabricated). */
  decisions: unknown[];
  /** LATENT — the honest agenda-thread anchor (no topic edge in data). */
  categoryAnchor: CategoryAnchor;

  /** Disclosed gaps, rendered visibly (unknown codes pass through verbatim). */
  gapBadges: string[];

  statementIds: string[];
  recordCount: number;
}

/** One lane column of the board (always present, empties included). */
export interface AgendaLane {
  lane: AgendaLaneKey | string;
  laneLabel: string;
  cardCount: number;
  cards: AgendaBoardCard[];
}

/** Board-level disclosures (never hidden — a watchdog surfaces its own limits). */
export interface AgendaBoardDisclosures {
  decisions: string;
  categories: string;
  scope: string;
  emptyState: boolean;
  unanchoredStatementCount: number;
  [key: string]: unknown;
}

/** The full GOV-605 agenda-board projection payload. */
export interface AgendaBoard {
  scope: string; // "alpine"
  access: string; // "reviewer_internal" — never "public"
  generatedFrom: string; // provenance: "read_api.reviewer_internal_records"
  lanes: AgendaLane[];
  cardCount: number;
  unanchoredStatementCount: number;
  disclosures: AgendaBoardDisclosures;
}
