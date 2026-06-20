/**
 * GOV-347 card-feed adapter (Stage 3.06, GOV-354) — the thin layer that lets the
 * EXISTING reviewer-internal Alpine timeline render the GOV-347 `{scope, access,
 * cards[]}` envelope. It is a *consume-the-new-envelope* adapter over the
 * GOV-153/205/257/293/301/314 timeline (`render.ts`, `timeline.ts`,
 * `statement-presenter.ts`): it adds no new trust logic and re-derives no backend
 * field. Every visible field rides straight from a named GOV-347 envelope key.
 *
 * Four hard rules carried verbatim from the GOV-353 contract
 * (`docs/stage3-06-card-feed-frontend-contract.md`):
 *
 *  1. **Reviewer-internal is the SOLE gate (§5).** When `access !==
 *     'reviewer_internal'` the model returns ZERO cards and reads NONE of the
 *     reviewer-internal-only fields (`reviewed_summary`, `speaker_label`,
 *     `provenance_status`) into its output — they are absent from the public lane
 *     by construction, not merely hidden.
 *  2. **No trust is recomputed (§3).** `status` is mapped 1:1 to the existing
 *     `ui_status` vocabulary, fail-closed to the least-trusted `unverified` for an
 *     unforeseen value (never dropped). `confidence_label` / `speaker_label` /
 *     `provenance_status` ride through verbatim.
 *  3. **No fabricated dispute/correction (§3).** A `disputed` / `source_changed`
 *     present card is a bounded gap not surfaceable today — it is dropped from the
 *     present lane (and logged), never rendered as a fabricated second side.
 *  4. **Gaps stay countable (§2.3).** `source_missing` cards route to the
 *     completeness-gap lane (GOV-301) verbatim — never shown as present records,
 *     never hidden.
 */

import type {
  ReadApiResponse,
  StatementRecord,
  EvidenceLink,
  CompletenessGapCard,
  UiStatus,
  ConfidenceLabel,
  ProvenanceStatus,
  GapType,
  GapSeverity,
  GapResolvedStatus,
  AccessState,
} from '../types/read-api';
import { assertWebSafe } from '../data/web-safe';

// --- Envelope types (mirror the GOV-347 shipped shape; never re-derived) ------

/** The eight present-card `type` values (carry content + evidence). */
export type PresentCardType =
  | 'statement'
  | 'meeting'
  | 'decision'
  | 'source'
  | 'correction'
  | 'ai_presented'
  | 'info'
  | (string & {});

/** Backend §2 status vocab (`stage3_card_feed._compose_record_status`). */
export type CardStatus =
  | 'verified'
  | 'corrected'
  | 'ai_presented'
  | 'unverified'
  | 'source_missing'
  | (string & {});

/** The reviewer-internal lane marker the whole feed is gated behind. */
export const REVIEWER_INTERNAL: AccessState = 'reviewer_internal';

/** A present card: eight `type` values that carry content + evidence. */
export interface PresentCard {
  handle: string;
  type: PresentCardType;
  jurisdiction?: string;
  /** Present only when the envelope ships it (HEAD 6d65bd3 omits it). */
  title?: string;
  date?: string;
  /** Reviewer-internal-only free text (§5). */
  reviewed_summary?: string;
  status: CardStatus;
  confidence_label?: ConfidenceLabel | null;
  /** Reviewer-internal-only (§5). */
  speaker_label?: string | null;
  /** Reviewer-internal-only (§5). */
  provenance_status?: ProvenanceStatus | null;
  evidence?: EvidenceLink[];
}

/** A gap-only card: no evidence, routed to the completeness-gap lane (§2.3). */
export interface SourceMissingCard {
  handle: string;
  type: 'source_missing';
  jurisdiction?: string;
  status: 'source_missing';
  gap_type: GapType;
  severity: GapSeverity;
  resolved_status: GapResolvedStatus;
  detail?: string | null;
}

export type CardFeedCard = PresentCard | SourceMissingCard;

/** The GOV-347 `{scope, access, cards[]}` envelope (consumed exactly as shipped). */
export interface CardFeed {
  scope: 'alpine' | (string & {});
  access: AccessState;
  cards: CardFeedCard[];
}

function isSourceMissing(card: CardFeedCard): card is SourceMissingCard {
  return card.type === 'source_missing';
}

// --- Status → UiStatus pin (§3, fail-closed, verbatim) ------------------------

/**
 * Map a GOV-347 card `status` to the existing 10-state `ui_status` vocabulary.
 * 1:1, fail-closed: an unforeseen value collapses to the least-trusted
 * `unverified` (caution) — it still renders (never dropped), it just never reads
 * as trusted. Mirrors how `confidenceLabel` keeps unforeseen values visible.
 */
export function statusToUiStatus(status: string): UiStatus {
  switch (status) {
    case 'verified':
      return 'source-backed';
    case 'corrected':
      return 'corrected';
    case 'ai_presented':
      return 'unverified';
    case 'unverified':
      return 'unverified';
    case 'source_missing':
      return 'source-missing';
    default:
      return 'unverified'; // fail-closed least-trusted; never dropped
  }
}

/**
 * Whether a present card is AI-origin and must render in the gated AI region
 * with the locked "AI — not independently verified" label (§3). True ONLY for a
 * genuinely AI card (`type`/`status` of `ai_presented`) — a non-AI `unverified`
 * card is still gated by the universal click-to-reveal blur + its "Unverified"
 * trust badge, but is NOT mislabeled as AI-origin.
 */
export function isAiPresented(card: PresentCard): boolean {
  return card.type === 'ai_presented' || card.status === 'ai_presented';
}

/**
 * A bounded-gap status the surface must NOT render today (§3): `disputed` /
 * `source_changed`. Such a present card is dropped from the present lane (and
 * logged) — never rendered as a fabricated dispute/correction. (The current
 * backend never emits these; this is a defensive guard.)
 */
export function isBoundedGapStatus(status: string): boolean {
  return status === 'disputed' || status === 'source_changed';
}

// --- Card type glyph (icon + text, never colour alone — mirrors GOV-314) ------

export interface CardTypeGlyph {
  emoji: string;
  label: string;
}

/** Per-`type` glyph + hover label. Icon + text together — never colour alone. */
export const CARD_TYPE_GLYPH: Record<string, CardTypeGlyph> = {
  statement: { emoji: '🗣', label: 'Statement' },
  meeting: { emoji: '🏛', label: 'Meeting' },
  decision: { emoji: '⚖', label: 'Decision' },
  source: { emoji: '📄', label: 'Source' },
  correction: { emoji: '✏️', label: 'Correction' },
  ai_presented: { emoji: '🤖', label: 'AI presented' },
  info: { emoji: 'ℹ️', label: 'Info' },
  source_missing: { emoji: '❓', label: 'Missing source' },
};

/** Glyph for a card `type`, with a title-cased fallback for an unforeseen type. */
export function cardTypeGlyph(type: string): CardTypeGlyph {
  return (
    CARD_TYPE_GLYPH[type] ?? {
      emoji: '•',
      label: type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
    }
  );
}

// --- Evidence normalization (final_url → the drawer's original-url slot) -------

/**
 * The GOV-347 evidence carries the public source as `final_url`; the existing
 * drawer renders the "View original" link from `original_url`. Project the
 * present-card URL into that slot WITHOUT inventing one (only when `original_url`
 * is absent). Every other key already matches the existing `EvidenceLink` shape.
 */
function normalizeEvidence(e: EvidenceLink): EvidenceLink {
  if (e.original_url) return e;
  const url = e.final_url ?? e.url ?? null;
  return url ? { ...e, original_url: url } : e;
}

// --- The render-ready model ---------------------------------------------------

/** The card-head view for one present card (sharp, outside the reveal blur). */
export interface CardHeadView {
  type: string;
  glyph: CardTypeGlyph;
  date?: string;
  title?: string;
}

export interface DroppedCard {
  handle: string;
  reason: string;
}

export interface CardFeedModel {
  /**
   * The existing-shape response the timeline renderer already consumes: present
   * cards → `records`, `source_missing` cards → `completeness_gaps`. On a
   * non-reviewer-internal lane this carries ZERO records and ZERO gaps.
   */
  response: ReadApiResponse;
  /** Per-present-card head (keyed by the card handle = `statement_id`). */
  heads: Map<string, CardHeadView>;
  /** Bounded-gap / out-of-lane cards dropped from the present lane, for logging. */
  dropped: DroppedCard[];
}

function presentToRecord(card: PresentCard): StatementRecord {
  const ai = isAiPresented(card);
  // Encode the verbatim card `date` into a web-safe Alpine-namespaced ordering id
  // so the EXISTING `recordTimelineDate` / day-anchor / Alpine-scope logic orders
  // by the card's own date (a display ordering key, never a trust signal).
  const agendaItemId = card.date
    ? `alpine:${card.date}:${card.handle}`
    : `alpine::${card.handle}`;
  return {
    statement_id: card.handle,
    statement_text: card.reviewed_summary ?? null,
    ui_status: statusToUiStatus(card.status),
    confidence_label: card.confidence_label ?? null,
    speaker_label: card.speaker_label ?? null,
    provenance_status: card.provenance_status ?? null,
    produced_by: ai ? 'ai' : 'human',
    agenda_item_id: agendaItemId,
    evidence: (card.evidence ?? []).map(normalizeEvidence),
  };
}

function gapToCard(card: SourceMissingCard): CompletenessGapCard {
  return {
    gap_id: card.handle,
    // The GOV-347 envelope carries the per-meeting subject as the stable `handle`
    // (§2.3) — no separate subject id is shipped, so the handle IS the subject.
    subject_id: card.handle,
    subject_node_type: 'meeting',
    gap_type: card.gap_type,
    severity: card.severity,
    resolved_status: card.resolved_status,
    ...(card.detail != null && String(card.detail).trim() !== ''
      ? { detail: card.detail }
      : {}),
  };
}

/**
 * Build the render-ready model from a GOV-347 card feed. Pure: same feed → same
 * model. Applies the reviewer-internal gate (§5) FIRST, partitions present vs
 * `source_missing` cards (§2.3), drops bounded-gap statuses (§3), and sweeps the
 * produced response through `assertWebSafe` (defense-in-depth, §5.4).
 */
export function buildCardFeedModel(feed: CardFeed): CardFeedModel {
  const scope = feed.scope;
  const access = feed.access;

  // §5.1 — public lane renders ZERO cards. Return before reading any
  // reviewer-internal-only field, so none can enter the output/DOM.
  if (access !== REVIEWER_INTERNAL) {
    const empty: ReadApiResponse = { scope, access, records: [], completeness_gaps: [] };
    return {
      response: assertWebSafe(empty),
      heads: new Map(),
      dropped: (feed.cards ?? []).map((c) => ({
        handle: c.handle,
        reason: `access "${access}" is not "${REVIEWER_INTERNAL}" — public lane renders 0 cards`,
      })),
    };
  }

  const records: StatementRecord[] = [];
  const gaps: CompletenessGapCard[] = [];
  const heads = new Map<string, CardHeadView>();
  const dropped: DroppedCard[] = [];

  for (const card of feed.cards ?? []) {
    if (isSourceMissing(card)) {
      gaps.push(gapToCard(card));
      continue;
    }
    if (isBoundedGapStatus(card.status)) {
      dropped.push({
        handle: card.handle,
        reason: `bounded-gap status "${card.status}" is not surfaceable (no fabricated dispute/correction — 3.07)`,
      });
      continue;
    }
    records.push(presentToRecord(card));
    heads.set(card.handle, {
      type: card.type,
      glyph: cardTypeGlyph(card.type),
      ...(card.date ? { date: card.date } : {}),
      ...(card.title ? { title: card.title } : {}),
    });
  }

  const response: ReadApiResponse = { scope, access, records, completeness_gaps: gaps };
  return { response: assertWebSafe(response), heads, dropped };
}
