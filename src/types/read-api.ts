/**
 * Web-safe TypeScript types for the Government Watchdog reviewer-internal read-API.
 *
 * Stage 1 · Slice 4 · A (GOV-99). These types MIRROR the backend read-API
 * allowlist (GOV-98 `scripts/publication.py::WEB_SAFE_FIELD_ALLOWLIST` +
 * `scripts/read_api.py`), captured from the real `build_response(...)` output.
 * Spec: backend `Docs/stage1-slice4-prereq0-read-api-concept-map.md`.
 *
 * Two hard rules this file encodes:
 *
 *  1. **No raw-path / private fields exist in the type surface.** The backend
 *     strips them at two layers (allowlist + `assert_no_raw_paths`). Mirroring
 *     only the allowlist here means a raw locator can never even be *named* by
 *     frontend code. The raw-path/private-locator denylist (the leak-bearing
 *     SUBSET of the backend `WEB_UNSAFE_FIELDS`, not a 1:1 mirror) lives in
 *     `RAW_PATH_FORBIDDEN_KEYS` (src/data/web-safe.ts) and is asserted by tests.
 *     Never add any of:
 *       transcript_path, deep_link, raw_local_path, raw_sha256, segment_id,
 *       local_ref / localRef, owner_agent, created_by, notes, note,
 *       review_state, local_note_path.
 *
 *  2. **The frontend never recomputes trust.** `ui_status` /
 *     `verification_status` / `correction_status` / `produced_by` are produced
 *     fail-closed by the backend and consumed VERBATIM. Do not derive,
 *     upgrade, or infer a publication/trust state on the client (pass-up
 *     trigger if you ever feel you need to — escalate to CTO/CEO/Isaac).
 */

// --- Backend-canonical enums (mirrored, not re-derived) --------------------

/** uiStatus-map.v1: the 10-state trust vocabulary, kebab-case wire form. */
export type UiStatus =
  | 'do-not-publish'
  | 'disputed'
  | 'source-missing'
  | 'source-changed'
  | 'corrected'
  | 'needs-clarification'
  | 'unverified'
  | 'pending-review'
  | 'archived-source-backed'
  | 'source-backed';

/** The three uiStatus values the backend permits to publish (eligibility gate). */
export const PUBLICATION_ELIGIBLE_UI_STATUSES = [
  'source-backed',
  'archived-source-backed',
  'corrected',
] as const satisfies readonly UiStatus[];

/** The 6-value record verification status (web-safe form). */
export type VerificationStatus =
  | 'source_recorded'
  | 'machine_extracted_unreviewed'
  | 'reviewed_source_linked'
  | 'human_verified'
  | 'disputed'
  | 'do_not_publish';

export type ProducedBy = 'automation' | 'ai' | 'human';
export type PublicationState = 'not_publishable' | 'publishable';

/** Provenance of an event in the concept graph (1.07 layering). Open string —
 *  observed value `known_then`; backend may add `presented_then`, etc. */
export type Layer = 'known_then' | 'presented_then' | 'corrected_later' | (string & {});

// --- Plain-language label layer (owner addendum, GOV-97 §A.7) ---------------

export type AliasType =
  | 'government_term'
  | 'legal_term'
  | 'historical_term'
  | 'agenda_label';

/** Web-safe citation locator (NO raw/vault path — public-citable parts only). */
export interface SourceRefLocator {
  timestampHuman?: string;
  page?: number | string;
  section?: string;
  paragraph?: string;
}

/**
 * Mandatory provenance for a source alias. The backend builds this WITHOUT the
 * vault/local ref, so no `localRef` field exists here by construction.
 */
export interface SourceRef {
  sourceId: string | null;
  originalUrl?: string;
  archiveUrl?: string;
  locator?: SourceRefLocator;
}

/** A government/source term — NEVER the primary label; always carries a sourceRef. */
export interface SourceAlias {
  term: string;
  aliasType: AliasType;
  sourceRef: SourceRef;
  firstSeenMeetingId?: number | string;
  firstSeenDate?: string;
}

/** The label layer carried by every `topic` / `agenda_thread` node. */
export interface LabelLayer {
  /** Primary plain-English display label (the government string is never primary). */
  canonicalHumanLabel: string | null;
  sourceAliases: SourceAlias[];
}

// --- Statement record + evidence drawer ------------------------------------

/**
 * Web-safe evidence-drawer entry (one `evidence_links` row projected through
 * the allowlist). All fields optional/nullable: `to_web_safe` only emits keys
 * present on the row, and several locator fields are null when not applicable.
 */
export interface EvidenceLink {
  to_source_id?: string | null;
  relation?: string | null;
  locator_kind?: string | null;
  // Public source-registry metadata (1.06 §6 drawer fields 1–4 + 13). All
  // web-safe and optional — the backend joins them when available; the drawer
  // renders only those present. NONE of these is a raw/local path.
  source_type?: string | null;
  published_by?: string | null;
  jurisdiction?: string | null;
  source_date?: string | null;
  related_concepts?: string[] | null;
  timestamp_human?: string | null;
  timestamp_seconds?: number | null;
  page?: number | null;
  section?: string | null;
  paragraph?: string | null;
  original_url?: string | null;
  archive_url?: string | null;
  archive_status?: string | null;
  final_url?: string | null;
  url?: string | null;
  scan_date?: string | null;
  last_validated_utc?: string | null;
  confidence?: string | null;
  verification_status?: VerificationStatus | null;
  correction_status?: string | null;
  is_verbatim?: 0 | 1 | boolean | null;
  layer?: Layer | null;
  /** graph-edge identity present on evidence rows (statement → source). */
  from_node_id?: string | null;
  from_node_type?: string | null;
}

/** A served statement: eligibility-gated, orphan-dropped, labels attached. */
export interface StatementRecord {
  statement_id: string;
  statement_text?: string | null;
  layer?: Layer | null;
  is_verbatim?: 0 | 1 | boolean | null;
  confidence?: string | null;
  updates_statement_id?: string | null;
  agenda_item_id?: string | null;
  // Labels that travel — consumed verbatim, NEVER recomputed on the client.
  ui_status?: UiStatus | null;
  verification_status?: VerificationStatus | null;
  correction_status?: string | null;
  produced_by?: ProducedBy | null;
  source_changed?: 0 | 1 | boolean | null;
  publication_state?: PublicationState | null;
  /** Web-safe evidence drawer for this statement (≥1 entry — no orphan served). */
  evidence: EvidenceLink[];
}

// --- Concept-map node + edge shapes (GOV-98 additions) ----------------------

export interface TopicNode extends LabelLayer {
  topic_id: string;
  name?: string | null;
  jurisdiction_id?: string | null;
  topic_tags?: string[] | null;
}

export type AgendaThreadStatus = 'open' | 'decided' | 'dormant' | (string & {});

export interface AgendaThreadNode extends LabelLayer {
  agenda_thread_id: string;
  title?: string | null;
  jurisdiction_id?: string | null;
  status?: AgendaThreadStatus | null;
  first_seen_date?: string | null;
  last_seen_date?: string | null;
}

/** A per-meeting agenda item that is a member of a thread. */
export interface AgendaItemMember {
  agenda_item_id: string;
  item_order?: number | null;
  meeting_id?: number | string | null;
  title?: string | null;
}

export type ConceptEdgeType =
  | 'agenda_item_in_thread'
  | 'agenda_item_supersedes'
  | 'agenda_item_amends'
  | 'agenda_item_revisits'
  | 'topic_rollup'
  | (string & {});

/** A typed graph edge (web-safe projection of a `concept_edges` row). */
export interface ConceptEdge {
  edge_id?: string;
  edge_type: ConceptEdgeType;
  from_node_id: string;
  from_node_type?: string;
  to_node_id: string;
  to_node_type?: string;
}

/** `agenda_thread(...)`: node + chronological members + typed lifecycle edges. */
export interface AgendaThreadResponse {
  thread: AgendaThreadNode;
  members: AgendaItemMember[];
  /** Typed Supersedes / Amends / Revisits among members — never an untyped "related". */
  lifecycle_edges: ConceptEdge[];
}

/** A node in the `topic_rollup` tree (child → parent rollup, served top-down). */
export interface TopicTreeNode {
  topic: TopicNode;
  children: TopicTreeNode[];
}

/** `topic_tree(...)`: acyclicity-validated rollup subtree + breadcrumb path. */
export interface TopicTreeResponse {
  root: TopicNode;
  /** Top ancestor → this node (where it sits in the tree). */
  breadcrumb: TopicNode[];
  tree: TopicTreeNode;
}

// --- Top-level response -----------------------------------------------------

export type AccessState = 'reviewer_internal' | (string & {});

/** The reviewer-internal read-API response (`read_api.build_response`). */
export interface ReadApiResponse {
  /** Alpine-only scope marker. */
  scope: 'alpine' | (string & {});
  access: AccessState;
  records?: StatementRecord[];
  agenda_thread?: AgendaThreadResponse | null;
  topic_tree?: TopicTreeResponse | null;
}
