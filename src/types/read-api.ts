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

/**
 * The full 10-state trust vocabulary as a runtime array, in display order
 * (most-trusted → least / hardest-stop last). The compile-time `satisfies`
 * guard makes the array exhaustive: if a `UiStatus` member is ever added to the
 * type and omitted here, this fails to type-check — so the trust legend
 * (legend.ts) can never silently drop a status it must explain.
 */
export const ALL_UI_STATUSES = [
  'source-backed',
  'archived-source-backed',
  'corrected',
  'pending-review',
  'unverified',
  'needs-clarification',
  'source-changed',
  'source-missing',
  'disputed',
  'do-not-publish',
] as const satisfies readonly UiStatus[];

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

/**
 * Read-time confidence label (GOV-283), derived fail-closed by the backend from
 * the source transcript class (`transcript_class.CONFIDENCE_LABEL_BY_CLASS`).
 * Mirrored here as the 5-value SSOT vocabulary, NOT re-derived: the frontend
 * consumes it VERBATIM exactly like `ui_status` (pass-up trigger if you ever
 * feel you must recompute it). The open `string & {}` tail keeps an unforeseen
 * future label from being silently dropped — it still renders, just title-cased.
 *
 * The backend attaches this as an API-envelope key AFTER `to_web_safe`, so the
 * raw `transcript_class` it is derived from never crosses the web-safe boundary.
 */
export type ConfidenceLabel =
  | 'source_anchored_timed'
  | 'auto_caption_timed'
  | 'auto_caption_untimed'
  | 'minutes_summary'
  | 'derived_summary'
  | (string & {});

/**
 * The lowest-confidence label the backend fails closed to (the
 * `auto_caption_untimed` mapping). Recorded here so a test can pin that the
 * frontend never displays a *higher* confidence than the backend sent.
 */
export const CONSERVATIVE_CONFIDENCE_LABEL = 'auto_caption_untimed' satisfies ConfidenceLabel;

/**
 * Read-time per-record provenance / audit-passed trust indicator (GOV-311),
 * the serving-lane projection of the GOV-306 whole-DB traceability auditor. The
 * backend recomputes it fail-closed from the canonical columns (full grounding
 * chain ∧ raw-preserved predecessor ∧ AI-run ok) and attaches it as an envelope
 * key ONLY on the reviewer-internal lane (never publicly). The vocabulary is a
 * FROZEN 2-value SSOT — deliberately CLOSED (no `string & {}` tail): any value
 * that is not exactly `grounded` is treated as `unverified` (fail-closed). The
 * frontend consumes it VERBATIM and NEVER recomputes grounding (pass-up trigger
 * if you ever feel you must — escalate to CTO/CEO/Isaac).
 */
export type ProvenanceStatus = 'grounded' | 'unverified';

/** The audit-passed (affirmative) SSOT value — the ONLY value that reads grounded. */
export const PROVENANCE_GROUNDED = 'grounded' satisfies ProvenanceStatus;

/** The fail-closed default: any missing/unknown/non-grounded value collapses here. */
export const PROVENANCE_UNVERIFIED = 'unverified' satisfies ProvenanceStatus;

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
  /**
   * Char-span offsets into the source text (GOV-149 migration 0017). Integer
   * offsets only — projected web-safe by the backend `read_api._safe_alias`
   * positionally like `page`; carries no raw/vault path. Present on aliases
   * grounded in untimed AI extractions (the GOV-137 `char_span` locator kind).
   */
  charStart?: number;
  charEnd?: number;
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
  /**
   * Read-time confidence label (GOV-283) — backend API-envelope key, fail-closed,
   * consumed verbatim. Absent only on a pre-GOV-283 captured fixture; the live
   * backend always sends it. Never derived/upgraded on the client.
   */
  confidence_label?: ConfidenceLabel | null;
  /**
   * Read-time SAFE speaker label (GOV-290) — backend API-envelope key, fail-closed
   * and provably name-free unless the attribution cleared the write+read naming
   * gate (then it is the approved "Name, Role"). Rendered VERBATIM — the frontend
   * never resolves, infers, or upgrades a speaker (pass-up trigger if tempted).
   */
  speaker_label?: string | null;
  /**
   * Read-time provenance / audit-passed trust indicator (GOV-311) — backend
   * API-envelope key, present ONLY on the reviewer-internal lane (the backend
   * never emits it publicly). Consumed VERBATIM and fail-closed: only the exact
   * value `grounded` reads as audit-passed; ANY other value — including absent,
   * null, or an unknown string — collapses to `unverified`. NEVER recomputed,
   * re-derived, or synthesized on the client.
   */
  provenance_status?: ProvenanceStatus | null;
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

// --- Thread completeness (GOV-101, Slice 4·C — BEH-COMPLETE-1..3) -----------

/**
 * The four backend-named gap kinds. A gap is a thing the backend can SEE is
 * missing for a thread — never an inference the frontend makes. The frontend
 * renders these verbatim; it never invents a kind not on this list.
 */
export type CompletenessGapKind =
  | 'missing_meeting_instance'
  | 'missing_agenda_packet'
  | 'missing_minutes_transcript'
  | 'unreviewed_instance';

/** One backend-asserted gap in a thread (no raw path — safe ids/notes only). */
export interface CompletenessGap {
  kind: CompletenessGapKind;
  /** Web-safe id of the affected member, when the backend names one. */
  agenda_item_id?: string | null;
  meeting_id?: number | string | null;
  /** Short backend note (NEVER a raw/local path — web-safe only). */
  detail?: string | null;
}

/**
 * Backend-computed completeness for a thread (BEH-COMPLETE). Consumed VERBATIM —
 * the frontend never derives `complete`. Three states: `complete` (backend
 * asserts nothing is missing), `gaps` (backend lists what is missing), or
 * `unknown` (backend has not assessed it). When this field is ABSENT from the
 * payload the frontend treats it as `unknown` — it never fills the silence with
 * `complete` (pass-up trigger if you ever feel you must recompute this).
 */
export interface ThreadCompleteness {
  state: 'complete' | 'gaps' | 'unknown';
  gaps?: CompletenessGap[];
}

/** `agenda_thread(...)`: node + chronological members + typed lifecycle edges. */
export interface AgendaThreadResponse {
  thread: AgendaThreadNode;
  members: AgendaItemMember[];
  /** Typed Supersedes / Amends / Revisits among members — never an untyped "related". */
  lifecycle_edges: ConceptEdge[];
  /** Backend-asserted completeness. Absent → treated as `unknown`, never `complete`. */
  completeness?: ThreadCompleteness | null;
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

// --- Completeness-gap cards (GOV-298, Stage 2 top-level read surface) --------
//
// DISTINCT from the thread-scoped `CompletenessGap` / `ThreadCompleteness` above
// (BEH-COMPLETE — the `agenda_thread.completeness` field). These are the
// read-time, web-safe gap CARDS the backend projects from the first-class
// `completeness_gaps` table (migration 0015, GOV-125) onto the top-level
// `completeness_gaps` response key (`read_api.completeness_gap_cards`, GOV-298).
// The ~90 `no_primary_source` Alpine meetings live here.
//
// Mirrored, NEVER re-derived: `gap_type` / `severity` / `resolved_status` are the
// SSOT vocabularies the backend fails closed against (`completeness.GAP_TYPES` /
// `SEVERITIES` / `RESOLVED_STATUSES`). The frontend consumes them VERBATIM and
// never re-classifies a gap, upgrades a severity, or marks one resolved (pass-up
// trigger if you ever feel you must). The internal-provenance columns
// (`source_id` / `detected_run_id` / `detected_utc`) are NEVER SELECTed by the
// backend projection, so they cannot be named on this type by construction.

/**
 * SSOT gap-type vocabulary (`completeness.GAP_TYPES`). `unknown` is the backend's
 * fail-closed placeholder for an off-SSOT row (drift past the 0015 CHECK) — the
 * row is still served, just clearly flagged. The open `string & {}` tail keeps an
 * unforeseen future kind rendering (title-cased) instead of being silently dropped.
 */
export type GapType =
  | 'missing_transcript'
  | 'missing_timestamps'
  | 'partial_agenda'
  | 'unresolved_thread'
  | 'no_primary_source'
  | 'pdf_text_unextracted'
  | 'untimed_segment'
  | 'speaker_unattributable'
  | 'unknown'
  | (string & {});

/** The gap type this slice surfaces as its headline count (GOV-301). */
export const NO_PRIMARY_SOURCE_GAP = 'no_primary_source' satisfies GapType;

/** SSOT severity (`completeness.SEVERITIES`); backend fails closed to `warn`. */
export type GapSeverity = 'info' | 'warn' | 'blocking' | (string & {});

/** SSOT resolution status (`completeness.RESOLVED_STATUSES`); fail-closed `open`. */
export type GapResolvedStatus =
  | 'open'
  | 'acknowledged'
  | 'resolved'
  | 'wontfix'
  | (string & {});

/**
 * One web-safe completeness-gap card (`read_api.GAP_CARD_FIELDS`). `detail` is
 * present ONLY when it cleared the backend's read-time raw-path + structured-PII
 * guards — its ABSENCE means "omitted for safety", never "no gap": the row is
 * always served so the ~90 `no_primary_source` meetings stay countable.
 */
export interface CompletenessGapCard {
  gap_id: string;
  /** Stable web-safe node id of the subject (e.g. a meeting date `2023-04-26`). */
  subject_id: string;
  subject_node_type: string;
  gap_type: GapType;
  severity: GapSeverity;
  resolved_status: GapResolvedStatus;
  /** Web-safe note — present only when it cleared the backend leak guards. */
  detail?: string | null;
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
  /**
   * Web-safe completeness-gap cards (GOV-298) — the ~90 `no_primary_source`
   * Alpine meetings plus other backend-asserted gap kinds. Opt-in on the backend
   * (`include_completeness_gaps`); absent when not requested. Consumed verbatim;
   * gap rows are NEVER hidden (countability is the entire point of the surface).
   */
  completeness_gaps?: CompletenessGapCard[];
}

// --- Supplied source files (GOV-1566 F2, consumes the B6 web-safe projection) -

/**
 * One reviewed supplied source file, as projected by the Backend **B6 web-safe
 * read endpoint** (GOV-1566 §7). B6 is the ONLY thing that crosses the
 * Backend→Website boundary for the file-intake feature, and it returns ONLY
 * files whose backend `review_state` is `web_safe`. Consequences baked into
 * this type:
 *
 *  - Pending / reviewing / held / rejected files NEVER appear here — they are
 *    absent from the projection, not hidden by the client. So there is no
 *    per-file review flag to read: presence in `files` *is* the web-safe verdict.
 *  - The raw `review_state` key must never cross the wire — it is on the
 *    frontend `RAW_PATH_FORBIDDEN_KEYS` denylist and would trip `assertWebSafe`.
 *    Deliberately un-modeled so a fixture/live payload carrying it fails loud.
 *  - No raw bytes, no absolute/vault path, no uploader PII, no sha of the raw
 *    file. Only the public, review-cleared metadata below — every URL is a
 *    hosted http(s) link to the reviewed projection, never a local path.
 */
export interface SuppliedSourceFile {
  /** Stable web-safe id for the reviewed file (NOT a raw path or raw-bytes sha). */
  file_id: string;
  /** Review-cleared display title (sanitized of any private original filename). */
  title: string;
  /** Public file kind, e.g. `agenda_packet` | `minutes` | `transcript` | `pdf`. */
  source_type?: string | null;
  /** Tie to the meeting this file documents (matches the timeline meeting id). */
  meeting_id?: number | string | null;
  /** Tie to a specific agenda item when the file documents one (else null). */
  agenda_item_id?: string | null;
  /** Public, review-cleared date the source was produced/published. */
  source_date?: string | null;
  /** Review-cleared supplier/publisher label (never raw uploader identity/PII). */
  published_by?: string | null;
  /** Preserved-version grouping (B5): web-safe id + ordinal only, no raw diff. */
  version_group_id?: string | null;
  version?: number | null;
  /** Hosted URL for the reviewed projection of the file (never a raw/vault path). */
  original_url?: string | null;
  /** Hosted archived copy, when captured (never a raw/vault path). */
  archive_url?: string | null;
}

/**
 * The B6 web-safe read projection consumed by F2. `files` are ALL already
 * `web_safe` (B6 filters server-side; the client never re-filters by a review
 * flag it cannot see). `pending_review_count` is the SOLE signal about
 * not-yet-web-safe files: a bare non-negative integer so the UI can show an
 * honest "N file(s) pending review" placeholder WITHOUT leaking any content,
 * filename, uploader, version, or `review_state` of the pending items.
 */
export interface SuppliedFilesProjection {
  /** Same gate as the read API — supplied files render only reviewer-internal. */
  access?: AccessState | null;
  /** Reviewed (web_safe) files only. Empty array = honestly nothing reviewed yet. */
  files: SuppliedSourceFile[];
  /** Count of files still in review; content of those files is never projected. */
  pending_review_count?: number | null;
}

// --- Supersede before/after (GOV-1566 F3, consumes the B6 web-safe projection) -

/**
 * Coarse, web-safe reprocessing lane for the records being re-reviewed after a
 * supersede. This is DELIBERATELY NOT the backend `review_state` (which is on
 * `RAW_PATH_FORBIDDEN_KEYS` and must never cross the wire). It is a separate
 * public status the reviewer can honestly show:
 *  - `queued`    — the new version is preserved; re-review has not started.
 *  - `reviewing` — records are being re-reviewed; the new version is NOT yet
 *                  web-safe, so its content is absent from `after`.
 *  - `complete`  — re-review finished; `after` is the web-safe new version.
 */
export type SupersedeReprocessingStatus = 'queued' | 'reviewing' | 'complete';

/**
 * One supersede event, as projected by the Backend **B6 web-safe read endpoint**
 * from a **B5 supersede mark** (GOV-1566 §7). B5 preserves every version and
 * marks which one supersedes which; B6 projects only the web-safe shape below.
 * Invariants baked into the type (mirroring {@link SuppliedSourceFile}):
 *
 *  - `before` is the previously-shown reviewed file — it was already web-safe,
 *    so showing it again on supersede is honest. `after` is present ONLY when
 *    the new version is itself `web_safe`; while re-review is in flight it is
 *    absent (never the not-yet-reviewed content). Presence of `after` IS the
 *    "new version cleared" verdict — there is no per-file review flag to read.
 *  - `reprocessing_record_count` is a bare integer: how many records are being
 *    re-reviewed. Content-free by construction — never a record's text.
 *  - No raw diff, no `review_state`, no raw/vault path, no uploader PII. The
 *    "red flag" is a coarse boolean + short enum reason, never free-text detail.
 */
export interface SupersedeEvent {
  /** Stable web-safe id for the supersede event (NOT a raw path or raw sha). */
  supersede_id: string;
  /** Preserved-version group these files belong to (matches SuppliedSourceFile). */
  version_group_id: string;
  /** The previously-shown reviewed file, now superseded (web-safe ref). */
  before: SuppliedSourceFile;
  /** The new reviewed file that supersedes it — present ONLY when itself web_safe. */
  after?: SuppliedSourceFile | null;
  /** Coarse web-safe reprocessing lane (see {@link SupersedeReprocessingStatus}). */
  reprocessing_status?: SupersedeReprocessingStatus | null;
  /** Count of records being re-reviewed because of this supersede; content-free. */
  reprocessing_record_count?: number | null;
  /** Whether this supersede materially changed previously-shown info (red flag). */
  flagged?: boolean | null;
  /** Coarse reason label, e.g. `source_replaced` | `content_changed`; never prose. */
  flag_reason?: string | null;
  /** Public date the supersede was recorded (never a raw timestamp of raw bytes). */
  superseded_at?: string | null;
}

/**
 * The B6 web-safe supersede projection consumed by F3. `events` are already
 * web-safe (B6 filters server-side); the client never re-derives a review state
 * it cannot see. An empty array is the honest "nothing superseded yet" state.
 */
export interface SupersedeProjection {
  /** Same gate as the read API — supersede rows render only reviewer-internal. */
  access?: AccessState | null;
  /** Web-safe supersede events only. Empty array = honestly nothing superseded. */
  events: SupersedeEvent[];
}
