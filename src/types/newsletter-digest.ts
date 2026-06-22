/**
 * Web-safe TypeScript types for the Stage 4.05 reviewer-internal Alpine
 * newsletter **digest object** (GOV-461 contract §1 / GOV-462 impl).
 *
 * These MIRROR the deterministic digest the backend assembler emits
 * (`scripts/stage4_newsletter_digest_assembler.py::assemble_digests`, backend
 * `origin/main` PR #79 / `cf61ea5`) — captured into
 * `src/fixtures/alpine-newsletter-digest.json`. The frontend **consumes this
 * verbatim and never recomputes**: it never re-partitions, re-sorts,
 * re-classifies a section, or rebuilds `sourceTrail` (a need to recompute trust
 * is a CTO pass-up trigger).
 *
 * Two hard rules this file encodes (mirrors `read-api.ts`):
 *  1. **No raw-path / private field is ever named on the type surface.**
 *     `localSourcePath` is the ONLY locator and is ALWAYS `null`; no
 *     `transcript_path` / `deep_link` / `raw_local_path` etc. can be named. The
 *     `assertDigestWebSafe` sweep (src/data/web-safe.ts) re-runs the leak guard
 *     over the fixture on load.
 *  2. **`ClaimStatus` / `NewsletterItemType` are the FROZEN Stage-3/4
 *     vocabularies** (`STAGE3_CLAIM_VOCAB` / `ALLOWED_ITEM_TYPES`). The
 *     zero-new-label gate (contract §6.4 / EG-7) diffs the rendered claim-label
 *     set against {@link STAGE3_CLAIM_VOCAB} — it must be `== 0`.
 */

// --- Frozen vocabularies (mirrored, never re-derived) -----------------------

/**
 * The frozen Stage-3/4 claim vocabulary (`STAGE3_CLAIM_VOCAB`). Closed set — the
 * §4 render map's domain is exactly this. A runtime value outside it is a drift
 * signal; the render layer fails CLOSED to the least-trusted reading, never
 * inventing a new label.
 */
export const STAGE3_CLAIM_VOCAB = [
  'verified',
  'unverified',
  'ai_presented',
  'disputed',
  'corrected',
  'source_changed',
  'source_missing',
  'speaker_unidentified',
  'needs_human_review',
] as const;

export type ClaimStatus = (typeof STAGE3_CLAIM_VOCAB)[number];

/** The frozen newsletter item-type vocabulary (`ALLOWED_ITEM_TYPES`). */
export const ALLOWED_ITEM_TYPES = [
  'processed_records',
  'timeline_chunk',
  'meeting',
  'document',
  'topic',
  'source_link',
  'correction',
  'conflict',
  'later_outcome',
  'unverified_item',
  'ai_presented_context',
] as const;

export type NewsletterItemType = (typeof ALLOWED_ITEM_TYPES)[number];

/** Whether a runtime string is a known frozen claim status (drift guard). */
export function isClaimStatus(value: unknown): value is ClaimStatus {
  return typeof value === 'string' && (STAGE3_CLAIM_VOCAB as readonly string[]).includes(value);
}

// --- Digest object (mirrors 4.05 contract §3 EXACTLY) -----------------------

export interface NewsletterDigestResponse {
  scope: 'alpine' | (string & {});
  access: 'reviewer_internal' | (string & {}); // NEVER 'public'
  digests: NewsletterDigest[];
}

export interface NewsletterDigest {
  newsletterId: string; // 'alpine-historical-YYYY-WW' | 'alpine-historical-undated'
  coveragePeriod: { startDate: string; endDate: string } | null;
  items: NewsletterItem[]; // carried verbatim from the feed
  sections: DigestSections;
}

export interface DigestSections {
  processedRecords: { count: number; itemIds: string[] };
  sourceSetProgress: {
    sourceCategoriesReviewed: string[];
    chronologicalRange: { oldest: string; newest: string } | null;
    orderingPreserved: string; // e.g. 'oldest_to_newest'
    knownGaps: unknown[]; // carried verbatim from build_readiness_record
    completionFraming: string;
  };
  timelineChunks: string[];
  keyMeetings: string[];
  keyDocuments: string[];
  topics: string[];
  corrections: string[];
  conflicts: string[];
  laterOutcomes: string[];
  unverifiedItems: string[];
  sourceTrail: SourceTrailEntry[]; // deduped by sourceId, carried unchanged
}

export interface NewsletterItem {
  id: string; // 'alpine-newsletter-item-NNN'
  itemType: NewsletterItemType | (string & {});
  jurisdiction: { state: string; county: string; town: string };
  recordDate: string;
  coveragePeriod: { startDate: string; endDate: string } | null;
  topicIds: string[];
  cardIds: string[];
  meetingIds: string[];
  sourceIds: string[];
  status: string;
  labels: ItemLabels;
  /** reviewer-internal '/alpine/...' routes only — never an external/public URL. */
  links: { timelineUrl: string; [k: string]: string };
  sourceTrail: SourceTrailEntry[];
  newsletterId: string;
  /** reviewer-internal free text (NOT editorial AI prose — 4.08 is separate). */
  summary?: string;
  title?: string;
}

export interface ItemLabels {
  claimStatus: ClaimStatus | (string & {}); // STAGE3_CLAIM_VOCAB — consumed verbatim
  aiPresented: boolean;
  speakerStatus: string; // e.g. 'speaker_unidentified'
  correctionStatus: string; // 'none' | ...
  publicationStatus: string; // e.g. 'draft' — NEVER rendered as "published"
}

export interface SourceTrailEntry {
  sourceId: string;
  sourceType?: string | null;
  authorityLevel?: string | null;
  originalUrl?: string | null;
  archiveUrl?: string | null;
  scanDate?: string | null;
  /** ALWAYS null — invariant, asserted by the web-safe sweep. */
  localSourcePath: null;
  timestampSeconds?: number | null;
  page?: number | null;
  section?: string | null;
  verificationStatus?: string | null;
}

/**
 * The required GOV-15 section keys, in render order (contract §3). A digest's
 * `sections` MUST carry every one; the detail renderer emits a node for each,
 * including the explicit "none in this digest" affordance for an empty list.
 */
export const REQUIRED_DIGEST_SECTIONS = [
  'processedRecords',
  'sourceSetProgress',
  'timelineChunks',
  'keyMeetings',
  'keyDocuments',
  'topics',
  'corrections',
  'conflicts',
  'laterOutcomes',
  'unverifiedItems',
  'sourceTrail',
] as const satisfies readonly (keyof DigestSections)[];
