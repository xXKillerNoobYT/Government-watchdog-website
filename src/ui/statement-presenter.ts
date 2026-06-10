/**
 * Pure presenters for the statement card + source drawer + typed related-links
 * (GOV-100, Slice 4·B). DOM-free so the field selection, label text, and
 * link-typing stay unit-testable and restyle-safe; render.ts consumes these and
 * only builds nodes.
 *
 * Two hard rules carried from GOV-99 hold here verbatim:
 *  1. No trust is recomputed — backend `ui_status` / `verification_status` /
 *     `correction_status` / `produced_by` are mapped to copy 1:1, never derived.
 *  2. No raw paths, reviewer notes, or hashes are ever projected. The web-safe
 *     type surface (read-api.ts) cannot name them, and the drawer field list
 *     intentionally has NO reviewer-note accessor (field 12 is stripped at
 *     transport — see assertWebSafe / RAW_PATH_FORBIDDEN_KEYS).
 */

import type {
  StatementRecord,
  EvidenceLink,
  ConceptEdge,
  ConceptEdgeType,
  AgendaItemMember,
  VerificationStatus,
} from '../types/read-api';

// --- Typed related-links (BEH-AGENDA-2) ------------------------------------

/**
 * Explicit, human label for a typed concept edge. The label is derived from the
 * backend `edge_type` ONLY — never inferred from proximity — and is NEVER the
 * untyped word "related" (BEH-AGENDA-2). Unknown future edge types fall back to
 * a title-cased form of the type itself, which still reflects the backend type.
 */
export function edgeTypeLabel(edgeType: ConceptEdgeType): string {
  switch (edgeType) {
    case 'agenda_item_supersedes':
      return 'Supersedes';
    case 'agenda_item_amends':
      return 'Amends';
    case 'agenda_item_revisits':
      return 'Revisits';
    case 'agenda_item_in_thread':
      return 'In thread';
    case 'topic_rollup':
      return 'Rolls up to';
    default:
      // Typed fallback: strip a known node prefix, title-case the rest. Still
      // backend-driven — we never collapse an unknown edge to "related".
      return (edgeType as string)
        .replace(/^agenda_item_/, '')
        .replace(/_/g, ' ')
        .replace(/^\w/, (c) => c.toUpperCase());
  }
}

export interface RelatedLink {
  /** Typed label from the backend edge_type (e.g. "Supersedes"). */
  label: string;
  /** 'out' = this item → target; 'in' = target → this item. */
  direction: 'out' | 'in';
  /** Safe target identifier (agenda item id — never a raw/local path). */
  targetId: string;
  /** Human title of the target agenda item when known, else the safe id. */
  targetTitle: string;
}

/**
 * Typed links for one statement card, matched by the card's `agenda_item_id`
 * against the thread's lifecycle edges. Only edges that actually touch this
 * item are returned, each labeled from its backend `edge_type`. `members` is
 * used purely to resolve a human title for the target (falls back to the id).
 */
export function relatedLinksFor(
  record: StatementRecord,
  lifecycleEdges: ConceptEdge[] | undefined,
  members: AgendaItemMember[] | undefined,
): RelatedLink[] {
  const itemId = record.agenda_item_id;
  if (!itemId || !lifecycleEdges?.length) return [];
  const titleOf = (id: string): string =>
    members?.find((m) => m.agenda_item_id === id)?.title ?? id;

  const links: RelatedLink[] = [];
  for (const edge of lifecycleEdges) {
    if (edge.from_node_id === itemId) {
      links.push({ label: edgeTypeLabel(edge.edge_type), direction: 'out', targetId: edge.to_node_id, targetTitle: titleOf(edge.to_node_id) });
    } else if (edge.to_node_id === itemId) {
      links.push({ label: edgeTypeLabel(edge.edge_type), direction: 'in', targetId: edge.from_node_id, targetTitle: titleOf(edge.from_node_id) });
    }
  }
  return links;
}

// --- Verbatim status labels (never recomputed) -----------------------------

export function verificationStatusLabel(status: VerificationStatus | null | undefined): string | undefined {
  if (!status) return undefined;
  switch (status) {
    case 'source_recorded':
      return 'Source recorded';
    case 'machine_extracted_unreviewed':
      return 'Machine-extracted — unreviewed';
    case 'reviewed_source_linked':
      return 'Reviewed — source-linked';
    case 'human_verified':
      return 'Human-verified';
    case 'disputed':
      return 'Disputed';
    case 'do_not_publish':
      return 'Do not publish';
    default:
      return status;
  }
}

export function correctionStatusLabel(status: string | null | undefined): string | undefined {
  if (status == null || status === '') return undefined;
  if (status === 'none') return 'No corrections';
  return status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** Compose the public-citable locator (NO raw/vault path — allowlisted parts only). */
export function locatorText(e: EvidenceLink): string | undefined {
  const parts = [
    e.page != null ? `p.${e.page}` : '',
    e.section ?? '',
    e.paragraph ? `¶ ${e.paragraph}` : '',
    e.timestamp_human ?? '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

// --- Source drawer: the 13 required fields (1.06 §6) ------------------------

export type DrawerFieldKind = 'text' | 'link';

export interface DrawerField {
  key: string;
  label: string;
  value: string;
  /** Present for 'link' fields; the public URL to open in a new tab. */
  href?: string;
  kind: DrawerFieldKind;
}

/**
 * Ordered, present-only projection of the 1.06 §6 drawer fields for one
 * evidence row. Notes:
 *  - The archive row (field 6) is ALWAYS emitted — link when present, else the
 *    visible "Archive not available" row (broken-archive must stay visible).
 *  - Field 12 (reviewer note) has NO accessor by design: it is a private field
 *    stripped at transport and on the web-safe denylist, so it can never render.
 *  - All other fields render only when the web-safe payload carries them.
 */
export function drawerFields(e: EvidenceLink): DrawerField[] {
  const fields: DrawerField[] = [];
  const text = (key: string, label: string, value: string | number | null | undefined): void => {
    if (value != null && String(value).trim() !== '') fields.push({ key, label, value: String(value), kind: 'text' });
  };

  text('source_type', 'Source type', e.source_type);            // 1
  text('published_by', 'Published by', e.published_by);          // 2
  text('jurisdiction', 'Jurisdiction', e.jurisdiction);          // 3
  text('source_date', 'Date', e.source_date);                    // 4
  if (e.original_url) fields.push({ key: 'original_url', label: 'Original source', value: 'View original', href: e.original_url, kind: 'link' }); // 5
  // 6 — archive: always visible (link or the explicit unavailable row).
  if (e.archive_url) fields.push({ key: 'archive_url', label: 'Archived copy', value: 'View archive', href: e.archive_url, kind: 'link' });
  else fields.push({ key: 'archive_url', label: 'Archived copy', value: 'Archive not available', kind: 'text' });
  text('scan_date', 'Captured', e.scan_date);                    // 7
  text('to_source_id', 'Source registry ID', e.to_source_id);    // 8
  text('locator', 'Locator', locatorText(e));                    // 9
  text('verification_status', 'Verification', verificationStatusLabel(e.verification_status)); // 10
  text('correction_status', 'Correction', correctionStatusLabel(e.correction_status));         // 11
  // 12 — reviewer note: intentionally never rendered (stripped at transport).
  if (e.related_concepts?.length) text('related_concepts', 'Related concepts', e.related_concepts.join(', ')); // 13
  return fields;
}

/** Verbatim/paraphrased provenance line for the card (fact vs AI handoff). */
export function verbatimLabel(record: StatementRecord): string {
  const verbatim = record.is_verbatim === 1 || record.is_verbatim === true;
  if (record.produced_by === 'ai') return verbatim ? 'AI — verbatim quote' : 'AI — paraphrased';
  return verbatim ? 'Verbatim quote' : 'Paraphrased summary';
}
