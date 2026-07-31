/**
 * Stage 4.06 — gated reviewer-internal Alpine newsletter archive/detail surface
 * (GOV-462 impl of the GOV-461 contract
 * `docs/stage4-06-newsletter-archive-detail-frontend-contract.md`).
 *
 * Renders the Stage 4.05 deterministic digest object
 * (`src/fixtures/alpine-newsletter-digest.json`, captured from a real
 * `assemble_digests(...)` run) on two hash routes:
 *   - `#/newsletter`           archive list of digests by Alpine coverage period.
 *   - `#/newsletter?id=<id>`   one digest rendered as every required GOV-15 section.
 *
 * Hard rules carried from the contract:
 *  1. **Consume verbatim, never recompute (§0).** Sections are id-lists/aggregates
 *     produced by the backend; the frontend only resolves ids back to the embedded
 *     `items[]` and renders. It never re-partitions, re-sorts, re-classifies a
 *     section, or rebuilds `sourceTrail`.
 *  2. **Zero new labels (§4 / EG-7).** Claim state is rendered through the EXISTING
 *     presentation layer (`statusTone` / `uiStatusLabel` / `AI_LABEL_TEXT`) via the
 *     documented {@link CLAIM_STATUS_PRESENTATION} map — no new badge text, no new
 *     tone class. A claim value outside the frozen vocab fails CLOSED to the
 *     least-trusted reading; a value that would need a brand-new label is a CTO
 *     pass-up trigger, never invented here.
 *  3. **Non-verified is never styled as verified fact (§3/§4).** Every unverified /
 *     disputed / AI row carries its non-verified / locked-AI marker; only `verified`
 *     reads as the trusted (`ok`) tone.
 *  4. **Web-safe on load (§1).** {@link assertDigestWebSafe} re-sweeps the digest for
 *     raw paths / forbidden keys; `localSourcePath` is always null and never shown.
 *
 * The outer beta gate lives in `main.ts` via the existing `gated()` wrapper. This
 * module also checks the response access lane before resolving any row, so the
 * explicit public-lane leak-verification path remains fail-closed in isolation.
 */

import { GW_TOKENS } from './tokens';
import { statusTone, uiStatusLabel, AI_LABEL_TEXT } from './state-view';
import type { TrustTone } from './state-view';
import { readMode } from './shell';
import { DESIGN_FIXTURE_LABEL } from './design-pages';
import {
  meetingPairBoardFixture,
  roundtableFixture,
  agendaFeatureFixture,
  lensGridFixture,
  meetingLedgerFixture,
  NEWSLETTER_DESIGN_STYLE,
} from './newsletter-design';
import {
  renderPrivateInfoNote,
  renderPrivateUnavailableInfoNote,
  type PrivateInfoNoteId,
} from './private-info-note';
import { assertDigestWebSafe } from '../data/web-safe';
import type { UiStatus } from '../types/read-api';
import {
  type ClaimStatus,
  type DigestSections,
  type NewsletterDigest,
  type NewsletterDigestResponse,
  type NewsletterItem,
  type SourceTrailEntry,
} from '../types/newsletter-digest';

// ---------------------------------------------------------------------------
// DOM helper (self-contained, mirrors landing.ts)
// ---------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

// ---------------------------------------------------------------------------
// §1 — web-safe load
// ---------------------------------------------------------------------------

/**
 * Sweep + type a raw digest payload (the imported fixture, or a future live read).
 * Runs the route-aware {@link assertDigestWebSafe} so a hand-edited fixture or a
 * mis-allowlisted field carrying a raw/vault path fails LOUDLY at load — exactly
 * as the read-API payloads are swept. `localSourcePath` must stay null.
 */
export function loadDigestResponse(raw: unknown): NewsletterDigestResponse {
  return assertDigestWebSafe(raw) as NewsletterDigestResponse;
}

// ---------------------------------------------------------------------------
// §4 — claim-state → existing presentation (zero new labels)
// ---------------------------------------------------------------------------

/**
 * 1:1 bridge from the frozen `STAGE3_CLAIM_VOCAB` claim status to the existing
 * 10-state `ui_status` vocabulary, so the badge string ({@link uiStatusLabel}) and
 * tone ({@link statusTone}) are ALWAYS reused from the established timeline/card
 * layer — never re-invented (§0 "routes to existing tones"). `speaker_unidentified`
 * has no `ui_status` peer and is handled directly in {@link claimPresentation}.
 * Fail-closed: an unforeseen value collapses to the least-trusted `unverified`.
 */
export function claimStatusToUiStatus(claimStatus: string): UiStatus {
  switch (claimStatus) {
    case 'verified':
      return 'source-backed';
    case 'corrected':
      return 'corrected';
    case 'disputed':
      return 'disputed';
    case 'source_changed':
      return 'source-changed';
    case 'source_missing':
      return 'source-missing';
    case 'needs_human_review':
      return 'needs-clarification';
    case 'ai_presented': // label overridden to the locked AI label; trust reads unverified
    case 'unverified':
      return 'unverified';
    default:
      return 'unverified'; // fail-closed least-trusted; never dropped, never trusted
  }
}

/**
 * The §4-authored reading for a claim whose speaker is unidentified. Sourced from
 * the contract §4 table (not invented here); rendered with the existing neutral
 * tone. (`speaker_unidentified` is in practice an item `speakerStatus`, not a
 * `claimStatus` — but the map domain must cover the full frozen vocab.)
 */
export const SPEAKER_UNIDENTIFIED_LABEL = 'Speaker unidentified';

export interface ClaimPresentation {
  /** Existing badge string (from {@link uiStatusLabel}) — never a new label. */
  label: string;
  /** Existing tone class (`ok`/`caution`/`stop`/`neutral`) — never a new tone. */
  tone: TrustTone;
  /** Whether the locked AI label must ALSO be shown (per-record, never merged). */
  ai: boolean;
  claimStatus: string;
}

/**
 * Render-ready presentation for one item's claim state (§4). Pure mapping into the
 * EXISTING strings/tones; only `verified` reads as the trusted `ok` tone. The AI
 * flag is additive — an AI-presented row keeps its trust badge AND the locked AI
 * label (mirrors `render.ts`), never collapsed into a verified row.
 */
export function claimPresentation(claimStatus: string, aiPresented = false): ClaimPresentation {
  const ai = aiPresented || claimStatus === 'ai_presented';
  if (claimStatus === 'speaker_unidentified') {
    return { label: SPEAKER_UNIDENTIFIED_LABEL, tone: 'neutral', ai, claimStatus };
  }
  const ui = claimStatusToUiStatus(claimStatus);
  return { label: uiStatusLabel(ui), tone: statusTone(ui), ai, claimStatus };
}

/**
 * The documented §4 map domain — exactly the frozen `STAGE3_CLAIM_VOCAB`. The
 * zero-new-label gate (§6.4) diffs the set of rendered claim statuses against this
 * (`as Record` keys are exhaustive over the union, enforced by the compiler).
 */
export const CLAIM_STATUS_PRESENTATION: Record<ClaimStatus, ClaimPresentation> = {
  verified: claimPresentation('verified'),
  unverified: claimPresentation('unverified'),
  ai_presented: claimPresentation('ai_presented'),
  disputed: claimPresentation('disputed'),
  corrected: claimPresentation('corrected'),
  source_changed: claimPresentation('source_changed'),
  source_missing: claimPresentation('source_missing'),
  speaker_unidentified: claimPresentation('speaker_unidentified'),
  needs_human_review: claimPresentation('needs_human_review'),
};

// ---------------------------------------------------------------------------
// Pure model helpers (consume verbatim — no recompute)
// ---------------------------------------------------------------------------

/** A single archive-list row (newsletterId + period + count + label-state summary). */
export interface ArchiveRow {
  newsletterId: string;
  periodLabel: string;
  recordCount: number;
  /** Per-claim-state counts, in first-seen item order — reuses existing labels. */
  labelSummary: { label: string; tone: TrustTone; ai: boolean; count: number }[];
  href: string;
}

/** Human period label for a coverage period (never invents a non-Alpine range). */
export function coveragePeriodLabel(period: NewsletterDigest['coveragePeriod']): string {
  if (!period) return 'Undated batch';
  return `${period.startDate} – ${period.endDate}`;
}

/** Build the archive rows from the digests, in the assembler's order (verbatim). */
export function archiveRows(response: NewsletterDigestResponse): ArchiveRow[] {
  return (response.digests ?? []).map((d) => {
    const order: string[] = [];
    const seen = new Map<string, { label: string; tone: TrustTone; ai: boolean; count: number }>();
    for (const item of d.items ?? []) {
      const p = claimPresentation(item.labels?.claimStatus, item.labels?.aiPresented);
      const key = `${p.label}|${p.tone}|${p.ai}`;
      if (!seen.has(key)) {
        order.push(key);
        seen.set(key, { label: p.label, tone: p.tone, ai: p.ai, count: 0 });
      }
      seen.get(key)!.count += 1;
    }
    return {
      newsletterId: d.newsletterId,
      periodLabel: coveragePeriodLabel(d.coveragePeriod),
      recordCount: d.sections?.processedRecords?.count ?? d.items?.length ?? 0,
      labelSummary: order.map((k) => seen.get(k)!),
      href: `#/newsletter?id=${encodeURIComponent(d.newsletterId)}`,
    };
  });
}

/** Find a digest by id (verbatim lookup — no fabrication on miss). */
export function resolveDigest(
  response: NewsletterDigestResponse,
  newsletterId: string,
): NewsletterDigest | undefined {
  return (response.digests ?? []).find((d) => d.newsletterId === newsletterId);
}

/** Resolve a section's id list back to the digest's embedded items (an index, not a partition). */
export function resolveItems(digest: NewsletterDigest, ids: string[]): NewsletterItem[] {
  const byId = new Map((digest.items ?? []).map((i) => [i.id, i]));
  return ids.map((id) => byId.get(id)).filter((i): i is NewsletterItem => i != null);
}

// ---------------------------------------------------------------------------
// DOM — shared bits
// ---------------------------------------------------------------------------

/** The reviewer-internal / Alpine-only header (never implies other coverage). */
const ALPINE_KICKER = 'Reviewer-internal · Town of Alpine, Wyoming';

function headingWithInfo<K extends 'h1' | 'h2' | 'h3'>(
  tag: K,
  attrs: Record<string, string>,
  text: string,
  noteId: PrivateInfoNoteId,
): HTMLDivElement {
  return el('div', { class: 'gw-nl-heading-with-info' }, [
    el(tag, attrs, [text]),
    renderPrivateInfoNote(noteId),
  ]);
}

function claimBadges(p: ClaimPresentation): HTMLElement[] {
  const out: HTMLElement[] = [
    el(
      'span',
      { class: `gw-badge gw-tone-${p.tone}`, 'data-test': 'claim-label', 'data-tone': p.tone, 'data-claim': p.claimStatus },
      [p.label],
    ),
  ];
  if (p.ai) {
    out.push(el('span', { class: 'gw-badge gw-badge-ai', 'data-test': 'ai-label' }, [AI_LABEL_TEXT]));
  }
  return out;
}

/** A compact record row for one resolved item (carries its label state). */
function itemRow(item: NewsletterItem): HTMLElement {
  const p = claimPresentation(item.labels?.claimStatus, item.labels?.aiPresented);
  const head = el('div', { class: 'gw-nl-item-head' }, [
    el('span', { class: 'gw-nl-item-id', 'data-test': 'item-id' }, [item.title || item.id]),
    ...claimBadges(p),
  ]);
  const children: (Node | string)[] = [head];
  if (item.recordDate) {
    children.push(el('div', { class: 'gw-nl-item-date gw-muted' }, [item.recordDate]));
  }
  if (item.summary) {
    children.push(el('p', { class: 'gw-nl-item-summary', 'data-test': 'item-summary' }, [item.summary]));
  }
  // A reviewer-internal in-app deep link only (never an external/public URL).
  const timelineUrl = item.links?.timelineUrl;
  if (timelineUrl && timelineUrl.startsWith('/alpine/')) {
    children.push(
      el('a', { class: 'gw-nl-deeplink', href: `#${timelineUrl}`, 'data-test': 'item-deeplink' }, ['Open in timeline →']),
    );
  }
  return el('div', { class: 'gw-nl-item', 'data-test': 'item-row', 'data-claim': p.claimStatus }, children);
}

/** A bare id chip (for keyMeetings / keyDocuments / topics — ids, not items). */
function idChip(id: string): HTMLElement {
  return el('span', { class: 'gw-nl-chip', 'data-test': 'id-chip' }, [id]);
}

/** The explicit "none in this digest" affordance (§3 — countable, never omitted). */
function noneAffordance(sectionKey: string): HTMLElement {
  return el('p', { class: 'gw-nl-none gw-muted', 'data-test': `section-empty-${sectionKey}` }, ['None in this digest.']);
}

/** Wrap a section in a titled, testable container (always emitted, even when empty). */
function section(key: string, title: string, body: (Node | string)[], isEmpty: boolean): HTMLElement {
  return el('section', {
    class: 'gw-nl-section',
    'data-test': `section-${key}`,
    'data-empty': String(isEmpty),
    'aria-label': `${title} newsletter section`,
  }, [
    el('h3', { class: 'gw-nl-section-title' }, [title]),
    ...(isEmpty ? [noneAffordance(key)] : body),
  ]);
}

// ---------------------------------------------------------------------------
// §3 — digest-detail section renderers
// ---------------------------------------------------------------------------

function processedRecordsSection(digest: NewsletterDigest): HTMLElement {
  const s = digest.sections.processedRecords;
  const items = resolveItems(digest, s.itemIds ?? []);
  const body: (Node | string)[] = [
    el('p', { class: 'gw-nl-count', 'data-test': 'processed-count' }, [
      `${s.count} processed record${s.count === 1 ? '' : 's'} in coverage order`,
    ]),
    ...items.map(itemRow),
  ];
  return section('processedRecords', 'Processed records', body, (s.count ?? 0) === 0);
}

function sourceSetProgressSection(digest: NewsletterDigest): HTMLElement {
  const p = digest.sections.sourceSetProgress;
  const range = p.chronologicalRange;
  const gaps = p.knownGaps ?? [];
  const body: (Node | string)[] = [
    el('div', { class: 'gw-nl-kv' }, [
      el('span', { class: 'gw-meta-key' }, ['Source categories reviewed: ']),
      (p.sourceCategoriesReviewed ?? []).length
        ? el('span', {}, [(p.sourceCategoriesReviewed ?? []).join(', ')])
        : el('span', { class: 'gw-muted' }, ['none recorded']),
    ]),
    el('div', { class: 'gw-nl-kv', 'data-test': 'chronological-range' }, [
      el('span', { class: 'gw-meta-key' }, ['Chronological range: ']),
      range ? el('span', {}, [`${range.oldest} → ${range.newest}`]) : el('span', { class: 'gw-muted' }, ['none']),
    ]),
    el('div', { class: 'gw-nl-kv' }, [
      el('span', { class: 'gw-meta-key' }, ['Ordering preserved: ']),
      el('span', {}, [p.orderingPreserved || 'unspecified']),
    ]),
    // completionFraming is a gap/status framing — NEVER shown as "complete" unless
    // the backend field itself says so (§3). Rendered verbatim, in a caution frame.
    el('p', { class: 'gw-nl-framing', 'data-test': 'completion-framing' }, [p.completionFraming || '—']),
    el('div', { class: 'gw-nl-kv', 'data-test': 'known-gaps' }, [
      el('span', { class: 'gw-meta-key' }, [`Known gaps (${gaps.length}): `]),
      gaps.length
        ? el('span', {}, [gaps.map((g) => (typeof g === 'string' ? g : JSON.stringify(g))).join('; ')])
        : el('span', { class: 'gw-muted' }, ['none listed']),
    ]),
  ];
  // The progress section itself is structural — always present (never "none").
  return section('sourceSetProgress', 'Source-set / backfill progress', body, false);
}

function itemListSection(key: string, title: string, digest: NewsletterDigest, ids: string[]): HTMLElement {
  const items = resolveItems(digest, ids ?? []);
  return section(key, title, items.map(itemRow), items.length === 0);
}

function idListSection(key: string, title: string, ids: string[]): HTMLElement {
  return section(
    key,
    title,
    [el('div', { class: 'gw-nl-chips' }, (ids ?? []).map(idChip))],
    (ids ?? []).length === 0,
  );
}

function sourceTrailEntryRow(entry: SourceTrailEntry): HTMLElement {
  const parts: (Node | string)[] = [
    el('span', { class: 'gw-nl-item-id', 'data-test': 'source-id' }, [entry.sourceId]),
  ];
  if (entry.sourceType) parts.push(el('span', { class: 'gw-nl-chip' }, [entry.sourceType]));
  if (entry.authorityLevel) parts.push(el('span', { class: 'gw-nl-chip' }, [entry.authorityLevel]));
  if (entry.verificationStatus) {
    parts.push(el('span', { class: 'gw-nl-chip', 'data-test': 'source-verification-status' }, [
      `Verification: ${entry.verificationStatus}`,
    ]));
  }
  const links: (Node | string)[] = [];
  if (entry.originalUrl) {
    links.push(el('a', {
      class: 'gw-nl-deeplink',
      href: entry.originalUrl,
      target: '_blank',
      rel: 'noopener noreferrer',
      'data-test': 'source-original',
      'aria-label': `View original source ${entry.sourceId}`,
    }, ['View original']));
  }
  if (entry.archiveUrl) {
    links.push(el('a', {
      class: 'gw-nl-deeplink',
      href: entry.archiveUrl,
      target: '_blank',
      rel: 'noopener noreferrer',
      'data-test': 'source-archive',
      'aria-label': `View archived source ${entry.sourceId}`,
    }, ['View archive']));
  }
  const children: (Node | string)[] = [el('div', { class: 'gw-nl-item-head' }, parts)];
  const receiptDetails: HTMLElement[] = [];
  if (entry.scanDate) receiptDetails.push(el('span', { 'data-test': 'source-scan-date' }, [`Scanned: ${entry.scanDate}`]));
  if (entry.page != null) receiptDetails.push(el('span', { 'data-test': 'source-page' }, [`Page: ${entry.page}`]));
  if (entry.section) receiptDetails.push(el('span', { 'data-test': 'source-section' }, [`Section: ${entry.section}`]));
  if (entry.timestampSeconds != null) {
    receiptDetails.push(el('span', { 'data-test': 'source-timestamp' }, [`Timestamp: ${entry.timestampSeconds}s`]));
  }
  if (receiptDetails.length) children.push(el('div', { class: 'gw-nl-receipt-meta' }, receiptDetails));
  if (links.length) children.push(el('div', { class: 'gw-nl-item-links' }, links));
  // localSourcePath is null and intentionally never rendered (§3).
  return el('div', { class: 'gw-nl-item', 'data-test': 'source-trail-entry' }, children);
}

function sourceTrailSection(digest: NewsletterDigest): HTMLElement {
  const trail = digest.sections.sourceTrail ?? [];
  return section('sourceTrail', 'Source trail', trail.map(sourceTrailEntryRow), trail.length === 0);
}

// ---------------------------------------------------------------------------
// Baseline newsletter information architecture
// ---------------------------------------------------------------------------

/**
 * The handoff reserves richer newsletter modules than NewsletterDigestResponse
 * currently supplies. Keep those modules in the real route as explicit designed
 * gaps so the page does not silently collapse to a thinner layout. Populated
 * prose, debate, agenda diffs, lenses, and meeting states require a typed backend
 * value; this renderer never derives them from summaries or ids.
 */
function designedGapInfo(testId: string, title: string, message: string): HTMLDivElement {
  return renderPrivateUnavailableInfoNote({
    id: testId,
    title,
    what: `This reserved newsletter slot is unavailable because ${message.charAt(0).toLowerCase()}${message.slice(1)}`,
    source: 'The current reviewer-only NewsletterDigestResponse and the design baseline identify the slot, but do not supply its required typed values.',
    filedUnder: `Newsletter · Designed gap · ${title}`,
    review: 'The module stays explanatory and disabled until the backend supplies a typed projection, the reviewer policy validates it, and the route receives an explicit access decision.',
    lifecycle: 'Current state: designed gap in the reviewer-only newsletter baseline.',
    limits: 'This note does not create a civic finding, current-edition claim, comparison, subscription, delivery promise, or release date.',
    expectedResult: `A reviewed backend projection will replace this placeholder with ${title.toLowerCase()}, preserving edition version, trust state, and direct source receipts.`,
  });
}

function designedGap(testId: string, title: string, message: string): HTMLElement {
  return el('div', {
    class: 'gw-nl-designed-gap',
    'data-test': testId,
    'data-state': 'unavailable',
    'data-origin': 'designed-gap',
    role: 'region',
    'aria-label': `${title} unavailable newsletter module`,
  }, [
    el('div', { class: 'gw-nl-gap-heading' }, [
      el('strong', { class: 'gw-nl-gap-title' }, [title]),
      designedGapInfo(testId, title, message),
    ]),
    el('p', { class: 'gw-nl-gap-copy' }, [message]),
  ]);
}

function meetingPairBoard(digest?: NewsletterDigest): HTMLElement {
  const meetingIds = digest?.sections.keyMeetings ?? [];
  const meetingCount = meetingIds.length;
  const meetingCopy = meetingCount === 0
    ? 'No meeting references are supplied in this digest, so no pre/post pair can be shown.'
    : `${meetingCount} meeting reference${meetingCount === 1 ? ' is' : 's are'} supplied, but the digest does not provide a pre/post relationship.`;
  return el('section', {
    class: 'gw-nl-baseline-card gw-nl-meeting-pairs',
    'data-test': 'newsletter-meeting-pair-board',
    'data-state': 'unavailable',
  }, [
    el('div', { class: 'gw-nl-baseline-head' }, [
      el('div', {}, [
        el('p', { class: 'gw-nl-baseline-kicker' }, ['NEWS BY MEETING']),
        el('h2', { class: 'gw-nl-baseline-title' }, ['Pre-meeting / post-meeting pairs']),
      ]),
      designedGapInfo(
        'newsletter-meeting-pair-board-help',
        'Pre-meeting and post-meeting edition pairing',
        meetingCopy,
      ),
      el('span', { class: 'gw-nl-unavailable-chip' }, ['UNAVAILABLE IN DIGEST']),
    ]),
    el('p', { class: 'gw-nl-baseline-intro' }, [meetingCopy]),
    el('div', { class: 'gw-nl-tool-row', role: 'group', 'aria-label': 'Newsletter edition pair tools', 'data-test': 'newsletter-pair-tools' }, [
      el('button', { type: 'button', disabled: '', 'aria-disabled': 'true' }, ['Pre-meeting edition · unavailable']),
      el('button', { type: 'button', disabled: '', 'aria-disabled': 'true' }, ['Post-meeting edition · unavailable']),
    ]),
    el('div', { class: 'gw-nl-meeting-reference-list', 'data-test': 'newsletter-meeting-reference-list' }, meetingIds.length
      ? meetingIds.map((meetingId) => el('article', { class: 'gw-nl-meeting-reference', 'data-test': 'newsletter-meeting-reference' }, [
          el('strong', {}, [meetingId]),
          el('span', {}, ['Agenda status unavailable']),
          el('span', {}, ['Pre-meeting edition unavailable']),
          el('span', {}, ['Post-meeting edition unavailable']),
        ]))
      : [designedGap(
          'newsletter-meeting-reference-empty',
          'No supplied meeting identifiers',
          'The digest contains no key-meeting ids to place in the pair board.',
        )]),
    el('div', { class: 'gw-nl-pair-grid' }, [
      designedGap(
        'newsletter-pre-meeting-slot',
        'Pre-meeting brief',
        'No typed pre-meeting edition, agenda link, or publication state is supplied.',
      ),
      designedGap(
        'newsletter-post-meeting-slot',
        'Post-meeting analysis',
        'No typed post-meeting edition, result, transcript state, or pair link is supplied.',
      ),
    ]),
  ]);
}

function roundtableSlot(): HTMLElement {
  return el('section', {
    class: 'gw-nl-baseline-card gw-nl-roundtable',
    'data-test': 'newsletter-roundtable',
    'data-state': 'unavailable',
    'data-origin': 'designed-gap',
  }, [
    el('div', { class: 'gw-nl-baseline-head' }, [
      el('div', {}, [
        el('p', { class: 'gw-nl-baseline-kicker' }, ['THE ROUNDTABLE']),
        el('h2', { class: 'gw-nl-baseline-title' }, ['Record-supplied debate and player']),
      ]),
      designedGapInfo(
        'newsletter-roundtable-help',
        'Record-supplied roundtable',
        'No reviewed debate script, speaker turns, playback state, transcript, or line-level receipt projection is supplied.',
      ),
      el('span', { class: 'gw-nl-unavailable-chip' }, ['NOT SUPPLIED']),
    ]),
    el('p', { class: 'gw-nl-baseline-intro' }, [
      'This reviewed digest supplies no debate script, speaker turns, runtime, audio, or transcript. Player controls stay disabled until those values have a reviewed data contract.',
    ]),
    el('div', { class: 'gw-nl-tool-row', role: 'group', 'aria-label': 'Roundtable display controls', 'data-test': 'newsletter-roundtable-tools' }, [
      el('button', { type: 'button', disabled: '', 'aria-disabled': 'true' }, ['Restart · unavailable']),
      el('button', { type: 'button', disabled: '', 'aria-disabled': 'true' }, ['Transcript · unavailable']),
      el('button', { type: 'button', disabled: '', 'aria-disabled': 'true' }, ['Receipt rail · unavailable']),
    ]),
    el('div', { class: 'gw-nl-player', 'aria-label': 'Roundtable player unavailable' }, [
      el('button', { type: 'button', disabled: '', 'aria-disabled': 'true' }, ['‹']),
      el('button', { type: 'button', disabled: '', 'aria-disabled': 'true', class: 'gw-nl-player-main' }, ['Debate unavailable']),
      el('button', { type: 'button', disabled: '', 'aria-disabled': 'true' }, ['›']),
      el('span', { class: 'gw-nl-player-status' }, ['No supplied lines · no playback state']),
    ]),
    el('div', {
      class: 'gw-nl-player-progress',
      role: 'progressbar',
      'aria-label': 'Roundtable playback progress',
      'aria-valuetext': 'Playback unavailable',
      'data-test': 'newsletter-roundtable-progress',
    }, [el('span', {}, ['Playback position unavailable'])]),
    el('div', { class: 'gw-nl-roundtable-meta' }, [
      designedGap(
        'newsletter-roundtable-speakers',
        'Speaker-role legend',
        'No reviewed speaker roles or turn order are supplied.',
      ),
      designedGap(
        'newsletter-roundtable-receipts',
        'Debate receipt rail',
        'No line-level source anchors or approved script version are supplied.',
      ),
    ]),
  ]);
}

function agendaFeatureSlot(): HTMLElement {
  return el('section', {
    class: 'gw-nl-baseline-card gw-nl-agenda-feature',
    'data-test': 'newsletter-agenda-feature',
    'data-state': 'unavailable',
  }, [
    el('div', { class: 'gw-nl-baseline-head' }, [
      el('div', {}, [
        el('p', { class: 'gw-nl-baseline-kicker' }, ['FEATURED AGENDA']),
        el('h2', { class: 'gw-nl-baseline-title' }, ['Agenda analysis workspace']),
      ]),
      designedGapInfo(
        'newsletter-agenda-feature-help',
        'Agenda analysis workspace',
        'No typed agenda structure, agenda versions, reviewed analysis, questions, or outcome projection is supplied.',
      ),
      el('span', { class: 'gw-nl-unavailable-chip' }, ['DESIGNED GAP']),
    ]),
    el('p', { class: 'gw-nl-baseline-intro' }, [
      'Digest records remain available below. The richer agenda feature requires typed agenda structure and reviewed analysis fields that are not present here.',
    ]),
    el('div', { class: 'gw-nl-tool-row', role: 'group', 'aria-label': 'Agenda feature controls', 'data-test': 'newsletter-agenda-tools' }, [
      ...['Town', 'County', 'State'].map((level) => el('button', {
        type: 'button',
        disabled: '',
        'aria-disabled': 'true',
      }, [`${level} agenda · unavailable`])),
      el('button', { type: 'button', disabled: '', 'aria-disabled': 'true' }, ['Pre-meeting · unavailable']),
      el('button', { type: 'button', disabled: '', 'aria-disabled': 'true' }, ['Post-meeting · unavailable']),
    ]),
    el('div', { class: 'gw-nl-agenda-grid' }, [
      designedGap(
        'newsletter-agenda-full',
        'Full agenda and per-item analysis',
        'No agenda numbering, motions, attachment mapping, or per-item analysis is supplied.',
      ),
      designedGap(
        'newsletter-agenda-diffs',
        'Document changes and side-by-side diffs',
        'No document versions, changed spans, or before/after values are supplied.',
      ),
      designedGap(
        'newsletter-language-watch',
        'Language watch',
        'No reviewed language flags or source-linked wording callouts are supplied.',
      ),
      designedGap(
        'newsletter-question-checklist',
        'Public questions and outcome checklist',
        'No question list, asked/not-asked state, vote, or post-meeting outcome is supplied.',
      ),
    ]),
  ]);
}

const LENS_SLOT_LABELS = [
  'Conservative — current platform',
  'Conservative — founding / drift check',
  'Progressive — current platform',
  'Progressive — founding / drift check',
  'Libertarian',
  'Constitutional / founding documents',
] as const;

function lensGridSlot(): HTMLElement {
  return el('section', {
    class: 'gw-nl-baseline-card gw-nl-lenses',
    'data-test': 'newsletter-six-lens-grid',
    'data-state': 'unavailable',
  }, [
    el('div', { class: 'gw-nl-baseline-head' }, [
      el('div', {}, [
        el('p', { class: 'gw-nl-baseline-kicker' }, ['SIX-LENS GRID']),
        el('h2', { class: 'gw-nl-baseline-title' }, ['Perspective checks']),
      ]),
      designedGapInfo(
        'newsletter-six-lens-grid-help',
        'Six-lens perspective checks',
        'No reviewed lens conclusion, method version, comparison inputs, exclusions, or citations are supplied.',
      ),
      el('span', { class: 'gw-nl-unavailable-chip' }, ['NO REVIEWED CONCLUSIONS']),
    ]),
    el('p', { class: 'gw-nl-baseline-intro' }, [
      'The layout is reserved, but NewsletterDigestResponse supplies no lens claims or citations. No perspective is inferred from the record summaries.',
    ]),
    el('div', { class: 'gw-nl-lens-grid' }, LENS_SLOT_LABELS.map((label, index) =>
      el('div', {
        class: `gw-nl-lens-slot gw-nl-lens-${index + 1}`,
        'data-test': 'newsletter-lens-slot',
        'data-state': 'unavailable',
        'data-origin': 'designed-gap',
      }, [
        el('div', { class: 'gw-nl-gap-heading' }, [
          el('strong', {}, [label]),
          designedGapInfo(
            `newsletter-lens-${index + 1}`,
            `${label} lens`,
            'No reviewed conclusion, method, evidence set, or citation is supplied for this perspective.',
          ),
        ]),
        el('span', {}, ['No reviewed lens conclusion supplied.']),
      ]),
    )),
  ]);
}

function meetingLedgerSlot(digest?: NewsletterDigest): HTMLElement {
  const meetingIds = digest?.sections.keyMeetings ?? [];
  return el('section', {
    class: 'gw-nl-baseline-card gw-nl-ledger',
    'data-test': 'newsletter-meeting-ledger',
    'data-state': 'unavailable',
    'data-origin': 'designed-gap',
  }, [
    el('div', { class: 'gw-nl-baseline-head' }, [
      el('div', {}, [
        el('p', { class: 'gw-nl-baseline-kicker' }, ['MEETING LEDGER']),
        el('h2', { class: 'gw-nl-baseline-title' }, ['Agenda → pre → post status']),
      ]),
      designedGapInfo(
        'newsletter-meeting-ledger-help',
        'Meeting edition-status ledger',
        'No typed meeting dates, agenda state, pre-meeting edition state, post-meeting edition state, or pairing contract is supplied.',
      ),
      el('span', { class: 'gw-nl-unavailable-chip' }, ['NO STATUS ROWS']),
    ]),
    el('p', { class: 'gw-nl-baseline-intro' }, [
      meetingIds.length
        ? 'The supplied meeting ids are retained below, but no dates or agenda/pre/post completion states are supplied by this digest.'
        : 'No meeting identifiers, dates, or agenda/pre/post completion states are supplied by this digest.',
    ]),
    el('table', { class: 'gw-nl-ledger-table', 'aria-label': 'Meeting ledger unavailable', 'data-test': 'newsletter-ledger-table' }, [
      el('thead', {}, [
        el('tr', {}, ['Meeting', 'Agenda', 'Pre-meeting', 'Post-meeting'].map((label) =>
          el('th', { scope: 'col' }, [label]),
        )),
      ]),
      el('tbody', { 'data-test': 'newsletter-ledger-rows' }, meetingIds.length
        ? meetingIds.map((meetingId) => el('tr', { 'data-test': 'newsletter-ledger-row' }, [
            el('th', { scope: 'row' }, [meetingId]),
            el('td', {}, ['Agenda unavailable']),
            el('td', {}, ['Pre-meeting unavailable']),
            el('td', {}, ['Post-meeting unavailable']),
          ]))
        : [el('tr', {}, [
            el('td', { colspan: '4' }, [designedGap(
              'newsletter-ledger-empty',
              'No meeting rows supplied',
              'A typed meeting id and edition-status contract is required before this ledger can populate.',
            )]),
          ])]),
    ]),
  ]);
}

function historyHonestyReferenceSlot(digest?: NewsletterDigest): HTMLElement {
  const references = digest?.sections.sourceTrail ?? [];
  return el('section', {
    class: 'gw-nl-baseline-card gw-nl-history-honesty',
    'data-test': 'newsletter-history-honesty',
  }, [
    el('div', { class: 'gw-nl-baseline-head' }, [
      el('div', {}, [
        el('p', { class: 'gw-nl-baseline-kicker' }, ['HISTORY · HONESTY · REFERENCES']),
        el('h2', { class: 'gw-nl-baseline-title' }, ['What this edition can and cannot establish']),
      ]),
      designedGapInfo(
        'newsletter-history-honesty-help',
        'Newsletter history and publication-honesty comparison',
        'No prior-edition relationship, completeness window, balance method, or approved composite score is supplied.',
      ),
      el('span', { class: 'gw-nl-unavailable-chip' }, ['NO COMPOSITE SCORE']),
    ]),
    el('div', { class: 'gw-nl-history-grid' }, [
      designedGap(
        'newsletter-history-lookback',
        'History look-back',
        'No prior-edition relationship, change summary, or 90-day completeness window is supplied.',
      ),
      designedGap(
        'newsletter-publication-honesty',
        'Publication honesty',
        'Source counts are not converted into a sourced, balanced, complete, or quality score.',
      ),
      el('div', {
        class: 'gw-nl-reference-rail',
        'data-test': 'newsletter-reference-rail',
        'data-state': references.length ? 'supplied' : 'unavailable',
        'data-origin': references.length ? 'reviewed-response' : 'designed-gap',
      }, [
        el('strong', { class: 'gw-nl-gap-title' }, ['Supplied reference rail']),
        ...(references.length
          ? references.map((entry) => el('article', { class: 'gw-nl-reference', 'data-test': 'newsletter-reference' }, [
              el('strong', {}, [entry.sourceId]),
              el('span', { class: 'gw-muted' }, [[entry.sourceType, entry.verificationStatus, entry.scanDate].filter(Boolean).join(' · ')]),
              ...(entry.originalUrl ? [el('a', {
                href: entry.originalUrl,
                target: '_blank',
                rel: 'noopener noreferrer',
                'aria-label': `Open supplied original for ${entry.sourceId}`,
              }, ['Open supplied original'])] : []),
              ...(entry.archiveUrl ? [el('a', {
                href: entry.archiveUrl,
                target: '_blank',
                rel: 'noopener noreferrer',
                'aria-label': `Open supplied archive for ${entry.sourceId}`,
              }, ['Open supplied archive'])] : []),
            ]))
          : [designedGap(
              'newsletter-reference-rail-empty',
              'Source reference rail',
              'No source-trail entries are supplied.',
            )]),
      ]),
    ]),
    el('div', { class: 'gw-nl-delivery-slot', 'data-test': 'newsletter-delivery-unavailable', 'data-state': 'unavailable' }, [
      el('div', { class: 'gw-nl-gap-heading' }, [
        el('strong', {}, ['Edition delivery unavailable']),
        designedGapInfo(
          'newsletter-delivery-unavailable-help',
          'Edition delivery',
          'No recipient, subscription, sender, schedule, consent, or delivery service contract is connected.',
        ),
      ]),
      el('p', {}, ['No recipient, subscription, sender, schedule, or delivery service is connected.']),
      el('button', { type: 'button', disabled: '', 'aria-disabled': 'true' }, ['Email delivery · unavailable']),
    ]),
  ]);
}

function baselineSlots(digest?: NewsletterDigest, designFixture = false): HTMLElement {
  const mode = readMode();
  const simple = mode === 'simple';
  return el('div', {
    class: `gw-nl-baseline-stack gw-nl-baseline-${mode}`,
    'data-test': 'newsletter-baseline-structure',
    role: 'region',
    'aria-label': `${simple ? 'Simple' : 'Advanced'} newsletter baseline and designed gaps`,
  }, [
    ...(designFixture
      ? [el('div', {
          class: 'gw-nl-design-banner',
          role: 'status',
          'data-test': 'newsletter-design-banner',
          'data-origin': 'fixture',
        }, [
          `${DESIGN_FIXTURE_LABEL}. Every block below is synthetic: no real meeting, official, `
          + 'motion, vote, or quotation is asserted, and no record is classified into a lens.',
        ])]
      : []),
    el('div', { class: 'gw-nl-baseline-context' }, [
      renderPrivateInfoNote('newsletter-gaps'),
    ]),
    el('section', {
      class: simple ? 'gw-nl-simple-edition' : 'gw-nl-advanced-workbench',
      'data-test': simple ? 'newsletter-simple-edition' : 'newsletter-advanced-workbench',
    }, simple
      ? [
          el('div', { class: 'gw-nl-editorial-lead' }, [designFixture ? meetingPairBoardFixture() : meetingPairBoard(digest), designFixture ? agendaFeatureFixture() : agendaFeatureSlot()]),
          designFixture ? roundtableFixture() : roundtableSlot(),
          el('div', { class: 'gw-nl-editorial-secondary' }, [designFixture ? lensGridFixture() : lensGridSlot(), designFixture ? meetingLedgerFixture() : meetingLedgerSlot(digest)]),
          historyHonestyReferenceSlot(digest),
        ]
      : [
          el('div', { class: 'gw-nl-workbench-toolbar', role: 'group', 'aria-label': 'Newsletter workbench tools' }, [
            el('button', { type: 'button', disabled: '', 'aria-disabled': 'true' }, ['Pre / post pair · unavailable']),
            el('button', { type: 'button', disabled: '', 'aria-disabled': 'true' }, ['Town / county / state · unavailable']),
            el('button', { type: 'button', disabled: '', 'aria-disabled': 'true' }, ['All-history search · unavailable']),
            designedGapInfo(
              'newsletter-workbench-tools-help',
              'Advanced newsletter workbench tools',
              'No edition pairing, multi-jurisdiction selection, entitlement, or all-history search projection is supplied.',
            ),
          ]),
          el('div', { class: 'gw-nl-workbench-lead' }, [designFixture ? meetingPairBoardFixture() : meetingPairBoard(digest), designFixture ? roundtableFixture() : roundtableSlot()]),
          designFixture ? agendaFeatureFixture() : agendaFeatureSlot(),
          designFixture ? lensGridFixture() : lensGridSlot(),
          el('div', { class: 'gw-nl-workbench-secondary' }, [designFixture ? meetingLedgerFixture() : meetingLedgerSlot(digest), historyHonestyReferenceSlot(digest)]),
        ]),
  ]);
}

/** Render EVERY required section, in contract order. */
function renderSections(host: HTMLElement, digest: NewsletterDigest): void {
  const s: DigestSections = digest.sections;
  host.append(processedRecordsSection(digest));
  host.append(sourceSetProgressSection(digest));
  host.append(itemListSection('timelineChunks', 'Timeline chunks', digest, s.timelineChunks));
  host.append(idListSection('keyMeetings', 'Key meetings', s.keyMeetings));
  host.append(idListSection('keyDocuments', 'Key documents', s.keyDocuments));
  host.append(idListSection('topics', 'Topics', s.topics));
  host.append(itemListSection('corrections', 'Corrections', digest, s.corrections));
  host.append(itemListSection('conflicts', 'Conflicts', digest, s.conflicts));
  host.append(itemListSection('laterOutcomes', 'Later outcomes', digest, s.laterOutcomes));
  host.append(itemListSection('unverifiedItems', 'Unverified items', digest, s.unverifiedItems));
  host.append(sourceTrailSection(digest));
}

// ---------------------------------------------------------------------------
// Public render entry points
// ---------------------------------------------------------------------------

function reviewedOrigin(notice?: string): HTMLElement {
  return el('div', {
    class: 'gw-nl-reviewed-origin',
    'data-test': 'newsletter-reviewed-origin',
    role: 'region',
    'aria-label': 'Newsletter trust and reviewed-origin notice',
  }, [
    el('div', { class: 'gw-nl-origin-with-info' }, [
      el('strong', {}, ['REVIEWER-INTERNAL DIGEST CAPTURE — trust labels shown per record']),
      renderPrivateInfoNote('newsletter-trust'),
    ]),
    ...(notice ? [el('div', { class: 'gw-notice' }, [notice])] : []),
  ]);
}

function prepareNewsletterRoot(root: HTMLElement): void {
  ensureNewsletterStyle();
  root.className = 'gw-nl-root';
  root.setAttribute('data-mode', readMode());
  root.replaceChildren();
}

/** Fail closed before resolving or rendering any digest row. */
function admitReviewerLane(root: HTMLElement, access: string): boolean {
  if (access === 'reviewer_internal') return true;
  root.append(el('section', {
    class: 'gw-state',
    'data-state': 'empty',
    'data-test': 'state-reviewer-gated',
    role: 'status',
  }, [
    el('h1', { class: 'gw-nl-h1' }, ['Reviewer-internal only']),
    el('p', {}, ['The Alpine newsletter archive is gated to the reviewer-internal lane. The public lane renders no civic records.']),
  ]));
  return false;
}

/** `#/newsletter` — archive list of digests by Alpine coverage period. */
export function renderNewsletterArchive(
  root: HTMLElement,
  response: NewsletterDigestResponse,
  notice?: string,
  designFixture = false,
): void {
  prepareNewsletterRoot(root);
  if (!admitReviewerLane(root, response.access)) return;
  const rows = archiveRows(response);

  root.append(
    reviewedOrigin(notice),
    el('section', {
      class: 'gw-nl-header',
      'data-test': 'newsletter-archive',
      'aria-label': 'Alpine reviewed newsletter archive overview',
    }, [
      el('p', { class: 'gw-landing-kicker' }, [ALPINE_KICKER]),
      headingWithInfo('h1', { class: 'gw-nl-h1' }, 'Alpine Weekly broadsheet archive', 'newsletter-overview'),
      el('div', { class: 'gw-nl-context-row' }, [
        el('p', { class: 'gw-muted' }, ['Reviewed weekly digest rows by Alpine coverage period. Reviewer-internal archive only.']),
        renderPrivateInfoNote('newsletter-archive'),
      ]),
    ]),
  );

  root.append(
    designedGap(
      'newsletter-current-edition-unavailable',
      'Current-edition selection unavailable',
      'The reviewed response supplies archived digests but no current, featured, or latest-edition marker. Choose a reviewed capture below; the full baseline edition layout remains visible without guessing which archive row is current.',
    ),
    baselineSlots(undefined, designFixture),
  );

  if (rows.length === 0) {
    root.append(el('p', { class: 'gw-nl-none gw-muted', 'data-test': 'archive-empty' }, ['No digests for Alpine yet.']));
    return;
  }

  const list = el('div', {
    class: 'gw-nl-archive-list',
    role: 'navigation',
    'aria-label': 'Reviewed Alpine newsletter editions',
  });
  for (const row of rows) {
    list.append(
      el('a', {
        class: 'gw-nl-archive-row',
        href: row.href,
        'data-test': 'archive-row',
        'data-id': row.newsletterId,
        'aria-label': `Open reviewed newsletter edition ${row.newsletterId}, ${row.periodLabel}`,
      }, [
        el('div', { class: 'gw-nl-archive-main' }, [
          el('span', { class: 'gw-nl-archive-id' }, [row.newsletterId]),
          el('span', { class: 'gw-nl-archive-period gw-muted' }, [row.periodLabel]),
        ]),
        el('div', { class: 'gw-nl-archive-meta' }, [
          el('span', { class: 'gw-nl-count', 'data-test': 'archive-count' }, [
            `${row.recordCount} record${row.recordCount === 1 ? '' : 's'}`,
          ]),
          ...row.labelSummary.flatMap((g) => {
            const badges: HTMLElement[] = [
              el('span', { class: `gw-badge gw-tone-${g.tone}`, 'data-test': 'archive-claim-label', 'data-tone': g.tone }, [
                `${g.count} ${g.label}`,
              ]),
            ];
            if (g.ai) badges.push(el('span', { class: 'gw-badge gw-badge-ai', 'data-test': 'archive-ai-label' }, [AI_LABEL_TEXT]));
            return badges;
          }),
        ]),
      ]),
    );
  }
  root.append(list);
}

function detailArchiveStrip(response: NewsletterDigestResponse, currentId: string): HTMLElement {
  const rows = archiveRows(response);
  return el('section', {
    class: 'gw-nl-detail-archive',
    'data-test': 'newsletter-detail-archive',
    'aria-label': 'Reviewed newsletter edition archive',
  }, [
    el('div', { class: 'gw-nl-baseline-head' }, [
      el('div', {}, [
        el('p', { class: 'gw-nl-baseline-kicker' }, ['ARCHIVED EDITIONS']),
        el('h2', { class: 'gw-nl-baseline-title' }, ['Reviewed digest archive']),
      ]),
      renderPrivateInfoNote('newsletter-archive'),
      el('a', { href: '#/newsletter?view=archive', class: 'gw-nl-deeplink', 'data-test': 'open-full-archive' }, ['Open full archive']),
    ]),
    ...(rows.length
      ? [el('div', { class: 'gw-nl-detail-archive-list' }, rows.map((row) => el('a', {
          href: row.href,
          class: 'gw-nl-detail-archive-row',
          'data-test': 'newsletter-detail-archive-row',
          'aria-current': row.newsletterId === currentId ? 'page' : 'false',
        }, [
          el('strong', {}, [row.periodLabel]),
          el('span', { class: 'gw-muted' }, [row.newsletterId]),
          el('span', {}, [`${row.recordCount} record${row.recordCount === 1 ? '' : 's'}`]),
        ])))]
      : [designedGap('newsletter-detail-archive-empty', 'No archived editions', 'The response supplied no digest rows.')]),
  ]);
}

/** `#/newsletter?id=<id>` — one digest as every required GOV-15 section (§3). */
export function renderNewsletterDetail(
  root: HTMLElement,
  response: NewsletterDigestResponse,
  newsletterId: string,
  notice?: string,
  designFixture = false,
): void {
  prepareNewsletterRoot(root);
  if (!admitReviewerLane(root, response.access)) return;
  const digest = resolveDigest(response, newsletterId);

  root.append(reviewedOrigin(notice));

  if (!digest) {
    root.append(
      el('section', {
        class: 'gw-nl-header',
        'data-test': 'newsletter-detail-missing',
        'aria-label': 'Newsletter edition not found',
      }, [
        el('p', { class: 'gw-landing-kicker' }, [ALPINE_KICKER]),
        headingWithInfo('h1', { class: 'gw-nl-h1' }, 'Digest not found', 'newsletter-edition'),
        designedGap(
          'newsletter-detail-not-found',
          'Requested newsletter edition',
          `No reviewed Alpine digest with id "${newsletterId}" is supplied by this response.`,
        ),
        el('p', {}, [el('a', { class: 'gw-nl-deeplink', href: '#/newsletter?view=archive', 'data-test': 'back-to-archive' }, ['← Back to archive'])]),
      ]),
    );
    return;
  }

  const printButton = el('button', {
    type: 'button',
    class: 'gw-nl-action',
    'data-test': 'newsletter-print',
    'aria-label': `Print or save reviewed newsletter edition ${digest.newsletterId} as PDF`,
  }, ['Print / save PDF']);
  printButton.addEventListener('click', () => window.print());

  root.append(
    el('section', {
      class: 'gw-nl-header',
      'data-test': 'newsletter-detail',
      'data-id': digest.newsletterId,
      'aria-label': `Reviewed newsletter edition ${digest.newsletterId}`,
    }, [
      el('div', { class: 'gw-nl-context-row' }, [
        el('p', { class: 'gw-landing-kicker' }, [ALPINE_KICKER]),
        renderPrivateInfoNote('newsletter-overview'),
      ]),
      headingWithInfo(
        'h1',
        { class: 'gw-nl-h1' },
        `Alpine Weekly broadsheet — ${coveragePeriodLabel(digest.coveragePeriod)}`,
        'newsletter-edition',
      ),
      el('p', { class: 'gw-muted' }, [digest.newsletterId]),
      el('div', {
        class: 'gw-nl-header-actions',
        role: 'group',
        'aria-label': `Tools for reviewed newsletter edition ${digest.newsletterId}`,
      }, [
        el('a', { class: 'gw-nl-deeplink', href: '#/newsletter?view=archive', 'data-test': 'back-to-archive' }, ['Browse archive']),
        printButton,
      ]),
    ]),
  );

  root.append(baselineSlots(digest, designFixture));

  const sections = el('div', { class: 'gw-nl-sections', 'data-test': 'newsletter-digest-sections' }, [
    el('div', { class: 'gw-nl-sections-heading' }, [
      el('p', { class: 'gw-nl-baseline-kicker' }, ['SUPPLIED DIGEST']),
      headingWithInfo('h2', { class: 'gw-nl-baseline-title' }, 'Reviewed data contract', 'newsletter-sections'),
      el('p', { class: 'gw-muted' }, ['Every typed section is retained below, including explicit empty states.']),
    ]),
  ]);
  renderSections(sections, digest);
  root.append(sections, detailArchiveStrip(response, digest.newsletterId));
}

/** State kinds capturable via `?state=` (BEH-STATE precedent). */
export type NewsletterStateKind = 'loading' | 'empty' | 'error';

/** `?state=loading|empty|error` over the data binding (screenshot override, §2). */
export function renderNewsletterState(
  root: HTMLElement,
  kind: NewsletterStateKind,
  access = 'reviewer_internal',
): void {
  prepareNewsletterRoot(root);
  if (!admitReviewerLane(root, access)) return;
  const copy: Record<NewsletterStateKind, { heading: string; message: string }> = {
    loading: { heading: 'Loading…', message: 'Fetching the reviewer-internal Alpine newsletter archive.' },
    empty: { heading: 'No digests for Alpine yet', message: 'No reviewed digests are available for this view.' },
    error: { heading: 'Could not load the newsletter archive', message: 'The reviewer-internal digest source is unreachable.' },
  };
  const c = copy[kind];
  root.append(
    reviewedOrigin(),
    el('section', {
      class: 'gw-state',
      'data-test': 'newsletter-state',
      'data-state': kind,
      'aria-label': `${c.heading} newsletter state`,
    }, [
      headingWithInfo('h1', { class: 'gw-nl-h1' }, c.heading, 'newsletter-overview'),
      el('p', { class: 'gw-muted' }, [c.message]),
      designedGapInfo(
        `newsletter-state-${kind}`,
        `${kind} newsletter archive state`,
        c.message,
      ),
    ]),
  );
}

// ---------------------------------------------------------------------------
// Styles — reuse the app's gw-badge / gw-tone-* classes (from render.ts), add
// only newsletter layout. No new tone / badge styling is introduced here.
// ---------------------------------------------------------------------------

export const NEWSLETTER_STYLE = `${GW_TOKENS}
.gw-nl-root{font-family:var(--gw-font);line-height:1.55;color:var(--gw-text);max-width:76rem;margin:0 auto;padding:var(--gw-space-6);background:linear-gradient(180deg,var(--gw-surface),var(--gw-page-bg))}
.gw-nl-root *{box-sizing:border-box}
.gw-nl-root[data-mode="simple"]{font-family:var(--gw-font-serif);max-width:64rem;background:var(--gw-surface)}
.gw-nl-root[data-mode="simple"] .gw-nl-baseline-kicker,.gw-nl-root[data-mode="simple"] .gw-nl-unavailable-chip,.gw-nl-root[data-mode="simple"] .gw-nl-player,.gw-nl-root[data-mode="simple"] .gw-nl-count,.gw-nl-root[data-mode="simple"] .gw-badge{font-family:var(--gw-font)}
.gw-nl-h1{font-size:var(--gw-text-xl);margin:0 0 var(--gw-space-2);line-height:var(--gw-leading-tight)}
.gw-nl-heading-with-info,.gw-nl-context-row,.gw-nl-origin-with-info,.gw-nl-gap-heading{display:flex;align-items:flex-start;gap:var(--gw-space-2)}
.gw-nl-heading-with-info,.gw-nl-context-row{justify-content:center}
.gw-nl-heading-with-info .gw-nl-h1,.gw-nl-heading-with-info .gw-nl-baseline-title,.gw-nl-context-row p{margin-top:0}
.gw-nl-origin-with-info{justify-content:space-between}
.gw-nl-gap-heading{justify-content:space-between}
.gw-nl-gap-heading>strong{min-width:0}
.gw-nl-root[data-mode="simple"] .gw-nl-h1{font-size:var(--gw-text-display);font-weight:600}
.gw-nl-header{margin-bottom:var(--gw-space-5);border-top:3px solid var(--gw-rule-strong);border-bottom:var(--gw-border-w) solid var(--gw-rule-strong);padding:var(--gw-space-5) 0;text-align:center}
.gw-nl-header-actions{display:flex;justify-content:center;align-items:center;gap:var(--gw-space-3);flex-wrap:wrap;margin-top:var(--gw-space-3)}
.gw-nl-action,.gw-nl-tool-row button,.gw-nl-workbench-toolbar button,.gw-nl-delivery-slot button{min-height:var(--gw-tap-min);padding:.45rem .8rem;border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius);background:var(--gw-surface);color:var(--gw-text);font:700 var(--gw-text-sm)/1.2 var(--gw-font)}
.gw-nl-action{cursor:pointer}.gw-nl-tool-row button:disabled,.gw-nl-workbench-toolbar button:disabled,.gw-nl-delivery-slot button:disabled{cursor:not-allowed;opacity:.62}
.gw-muted{color:var(--gw-text-muted)}
.gw-meta-key{color:var(--gw-text-muted);font-weight:600}
.gw-badge{font-size:var(--gw-text-badge);line-height:1.3;font-weight:700;background:var(--gw-surface-accent-tint);color:var(--gw-text-secondary);border:var(--gw-border-w) solid var(--gw-neutral-border);border-radius:var(--gw-radius-pill);padding:.15rem .55rem;white-space:nowrap}
.gw-tone-ok{background:var(--gw-ok-bg);color:var(--gw-ok-text);border-color:var(--gw-ok-text)}
.gw-tone-caution{background:var(--gw-caution-bg);color:var(--gw-caution-text);border-color:var(--gw-caution-text)}
.gw-tone-stop{background:var(--gw-stop-bg);color:var(--gw-stop-text);border-color:var(--gw-stop-border)}
.gw-tone-neutral{background:var(--gw-surface-accent-tint);color:var(--gw-accent);border-color:var(--gw-accent)}
.gw-badge-ai{background:var(--gw-caution-bg);color:var(--gw-caution-text);border-color:var(--gw-caution-text)}
.gw-nl-reviewed-origin{background:var(--gw-tone-info-well);border:var(--gw-border-w) solid var(--gw-info-text);color:var(--gw-info-text);padding:var(--gw-space-3) var(--gw-space-4);border-radius:var(--gw-radius);font:600 var(--gw-text-sm)/1.45 var(--gw-font);margin-bottom:var(--gw-space-5)}
.gw-notice{font-size:var(--gw-text-sm);color:var(--gw-text-secondary);margin-top:var(--gw-space-1);font-weight:400}
.gw-state{border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-5);background:var(--gw-surface)}
.gw-state[data-state="error"]{border-color:var(--gw-stop-border);color:var(--gw-stop-text);background:var(--gw-stop-bg)}
.gw-nl-archive-list{display:flex;flex-direction:column;gap:var(--gw-space-3)}
.gw-nl-archive-row{display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--gw-space-3);align-items:center;text-decoration:none;color:inherit;border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:.7rem .9rem;background:var(--gw-surface);min-height:var(--gw-tap-min)}
.gw-nl-archive-row:hover,.gw-nl-archive-row:focus-visible{border-color:var(--gw-accent);outline:none}
.gw-nl-archive-id{font-weight:700;margin-right:var(--gw-space-3)}
.gw-nl-archive-meta{display:flex;flex-wrap:wrap;gap:var(--gw-space-2);align-items:center}
.gw-nl-count{font-size:var(--gw-text-sm);font-weight:700;color:var(--gw-text-secondary)}
.gw-nl-baseline-stack{display:flex;flex-direction:column;gap:var(--gw-space-5);margin-bottom:var(--gw-space-6)}
.gw-nl-baseline-context{display:flex;justify-content:flex-end;margin-bottom:calc(-1 * var(--gw-space-3))}
.gw-nl-simple-edition,.gw-nl-advanced-workbench{display:grid;gap:var(--gw-space-5)}
.gw-nl-root[data-mode="simple"] .gw-nl-simple-edition{border-top:4px double var(--gw-rule-strong);border-bottom:4px double var(--gw-rule-strong);padding:var(--gw-space-5) 0}
.gw-nl-root[data-mode="simple"] .gw-nl-baseline-card{border-left:0;border-right:0;border-radius:0;box-shadow:none;background:transparent}
.gw-nl-editorial-lead{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(18rem,.8fr);gap:var(--gw-space-5)}
.gw-nl-editorial-secondary{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(18rem,.75fr);gap:var(--gw-space-5)}
.gw-nl-workbench-toolbar,.gw-nl-tool-row{display:flex;gap:var(--gw-space-2);align-items:center;flex-wrap:wrap;padding:var(--gw-space-3);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-surface-well)}
.gw-nl-workbench-lead{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--gw-space-5);align-items:start}
.gw-nl-workbench-secondary{display:grid;grid-template-columns:minmax(18rem,.75fr) minmax(0,1.25fr);gap:var(--gw-space-5);align-items:start}
.gw-nl-baseline-card{border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);padding:var(--gw-space-6);background:var(--gw-surface-subtle);box-shadow:0 8px 24px color-mix(in srgb,var(--gw-page-bg) 75%,transparent)}
.gw-nl-baseline-head{display:flex;justify-content:space-between;align-items:flex-start;gap:var(--gw-space-4);flex-wrap:wrap}
.gw-nl-baseline-kicker{margin:0 0 var(--gw-space-1);font:800 var(--gw-text-kicker)/1.2 var(--gw-font);letter-spacing:1.4px;color:var(--gw-accent);text-transform:uppercase}
.gw-nl-baseline-title{margin:0;font-size:var(--gw-text-lg);line-height:var(--gw-leading-tight)}
.gw-nl-root[data-mode="simple"] .gw-nl-baseline-title{font-size:1.35rem;font-weight:600}
.gw-nl-baseline-intro{margin:var(--gw-space-3) 0;color:var(--gw-text-secondary)}
.gw-nl-unavailable-chip{display:inline-flex;align-items:center;min-height:1.8rem;padding:.15rem .55rem;border:var(--gw-border-w) solid var(--gw-caution-line);border-radius:var(--gw-radius-sm);background:var(--gw-caution-bg);color:var(--gw-caution-text-strong);font:800 var(--gw-text-xs)/1.2 var(--gw-font);letter-spacing:.55px}
.gw-nl-pair-grid,.gw-nl-agenda-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gw-space-3)}
.gw-nl-meeting-reference-list{display:grid;gap:var(--gw-space-2);margin:var(--gw-space-3) 0}.gw-nl-meeting-reference{display:grid;grid-template-columns:minmax(8rem,1fr) repeat(3,minmax(0,1fr));gap:var(--gw-space-2);padding:var(--gw-space-3);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-sm);background:var(--gw-surface-well);font-size:var(--gw-text-sm)}
.gw-nl-designed-gap{min-width:0;border:var(--gw-border-w) dashed var(--gw-border-strong);border-radius:var(--gw-radius);padding:var(--gw-space-4);background:var(--gw-surface-well)}
.gw-nl-gap-title{display:block;color:var(--gw-text);font-size:var(--gw-text-body)}
.gw-nl-gap-copy{margin:var(--gw-space-2) 0 0;color:var(--gw-text-muted);font-size:var(--gw-text-sm)}
.gw-nl-roundtable{border-width:2px;border-color:var(--gw-rule-strong)}
.gw-nl-player{display:flex;gap:var(--gw-space-2);align-items:center;flex-wrap:wrap;margin-top:var(--gw-space-4)}
.gw-nl-player button{min-width:var(--gw-tap-min);min-height:var(--gw-tap-min);border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius);background:var(--gw-surface-well);color:var(--gw-text-muted);font:800 var(--gw-text-body)/1 var(--gw-font)}
.gw-nl-player button:disabled{cursor:not-allowed;opacity:.8}
.gw-nl-player .gw-nl-player-main{min-width:12rem;background:var(--gw-rule-strong);color:var(--gw-surface)}
.gw-nl-player-status{color:var(--gw-text-muted);font-size:var(--gw-text-sm);margin-left:auto}
.gw-nl-player-progress{height:2rem;display:flex;align-items:center;margin-top:var(--gw-space-3);padding:0 var(--gw-space-3);border:var(--gw-border-w) dashed var(--gw-border-strong);border-radius:var(--gw-radius-pill);background:var(--gw-surface-well);color:var(--gw-text-muted);font:600 var(--gw-text-xs)/1.2 var(--gw-font-mono)}
.gw-nl-roundtable-meta{display:grid;grid-template-columns:1fr 1fr;gap:var(--gw-space-3);margin-top:var(--gw-space-3)}
.gw-nl-lens-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--gw-space-3);margin-top:var(--gw-space-4)}
.gw-nl-lens-slot{display:flex;flex-direction:column;gap:var(--gw-space-2);min-height:7rem;border:var(--gw-border-w) dashed var(--gw-border-strong);border-radius:var(--gw-radius);padding:var(--gw-space-4);background:var(--gw-surface-well)}
.gw-nl-lens-slot strong{font-size:var(--gw-text-sm);color:var(--gw-text-secondary)}
.gw-nl-lens-slot span{font-size:var(--gw-text-sm);color:var(--gw-text-muted)}
.gw-nl-lens-1,.gw-nl-lens-2{border-left:3px solid var(--gw-stop-border)}
.gw-nl-lens-3,.gw-nl-lens-4{border-left:3px solid var(--gw-level-state)}
.gw-nl-lens-5,.gw-nl-lens-6{border-left:3px solid var(--gw-caution-line)}
.gw-nl-ledger-table{width:100%;margin-top:var(--gw-space-3);border-collapse:separate;border-spacing:0;border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);overflow:hidden;background:var(--gw-surface-well);font:600 var(--gw-text-sm)/1.4 var(--gw-font)}.gw-nl-ledger-table th,.gw-nl-ledger-table td{padding:var(--gw-space-3);text-align:left;border-right:var(--gw-border-w) solid var(--gw-border)}.gw-nl-ledger-table th:last-child,.gw-nl-ledger-table td:last-child{border-right:0}.gw-nl-ledger-table thead th{background:var(--gw-surface-subtle);color:var(--gw-text-secondary);font-weight:800}.gw-nl-ledger-table tbody th,.gw-nl-ledger-table tbody td{border-top:var(--gw-border-w) solid var(--gw-border);color:var(--gw-text-muted)}
.gw-nl-history-grid{display:grid;grid-template-columns:1fr 1fr minmax(18rem,1fr);gap:var(--gw-space-3);margin-top:var(--gw-space-4)}
.gw-nl-reference-rail{display:grid;gap:var(--gw-space-2);padding:var(--gw-space-4);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-surface-well)}.gw-nl-reference{display:grid;gap:var(--gw-space-1);padding-top:var(--gw-space-2);border-top:var(--gw-border-w) solid var(--gw-border);font-size:var(--gw-text-sm);overflow-wrap:anywhere}.gw-nl-reference a{color:var(--gw-accent)}
.gw-nl-delivery-slot{display:flex;align-items:center;gap:var(--gw-space-3);flex-wrap:wrap;margin-top:var(--gw-space-4);padding:var(--gw-space-4);border:var(--gw-border-w) dashed var(--gw-border-strong);border-radius:var(--gw-radius);background:var(--gw-surface-well)}.gw-nl-delivery-slot p{flex:1;min-width:16rem;margin:0;color:var(--gw-text-muted)}
.gw-nl-sections{display:grid;grid-template-columns:repeat(auto-fit,minmax(18rem,1fr));gap:var(--gw-space-4);padding-top:var(--gw-space-6);border-top:2px solid var(--gw-rule-strong)}
.gw-nl-sections-heading{grid-column:1/-1}
.gw-nl-sections-heading p:last-child{margin:var(--gw-space-2) 0 0}
.gw-nl-section{border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:.8rem 1rem;background:var(--gw-surface)}
.gw-nl-section-title{font-size:var(--gw-text-lg);margin:0 0 var(--gw-space-3)}
.gw-nl-none{font-style:italic;margin:var(--gw-space-1) 0}
.gw-nl-item{border-top:var(--gw-border-w) solid var(--gw-border);padding:var(--gw-space-3) 0}
.gw-nl-item:first-of-type{border-top:none}
.gw-nl-item-head{display:flex;flex-wrap:wrap;gap:var(--gw-space-2);align-items:center}
.gw-nl-item-id{font-weight:600}
.gw-nl-item-date{font-size:var(--gw-text-sm)}
.gw-nl-item-summary{margin:var(--gw-space-1) 0}
.gw-nl-item-links{display:flex;gap:var(--gw-space-3);margin-top:var(--gw-space-1)}
.gw-nl-receipt-meta{display:flex;flex-wrap:wrap;gap:var(--gw-space-2) var(--gw-space-4);margin-top:var(--gw-space-2);color:var(--gw-text-muted);font-family:var(--gw-font-mono);font-size:var(--gw-text-xs)}
.gw-nl-deeplink{color:var(--gw-accent);font-size:var(--gw-text-sm);text-decoration:none;font-weight:600}
.gw-nl-deeplink:hover{text-decoration:underline}
.gw-nl-chips{display:flex;flex-wrap:wrap;gap:var(--gw-space-2)}
.gw-nl-chip{font-size:var(--gw-text-sm);background:var(--gw-surface-accent-tint);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-sm);padding:.1rem .45rem}
.gw-nl-kv{margin:var(--gw-space-1) 0}
.gw-nl-framing{background:var(--gw-caution-bg-soft);border-left:3px solid var(--gw-caution-line);padding:var(--gw-space-1) var(--gw-space-3);border-radius:var(--gw-radius-sm);margin:var(--gw-space-2) 0}
.gw-nl-detail-archive{margin-top:var(--gw-space-6);padding-top:var(--gw-space-5);border-top:3px double var(--gw-rule-strong)}.gw-nl-detail-archive-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:var(--gw-space-3);margin-top:var(--gw-space-3)}.gw-nl-detail-archive-row{display:grid;gap:var(--gw-space-1);min-height:var(--gw-tap-min);padding:var(--gw-space-3);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-surface);color:var(--gw-text);text-decoration:none}.gw-nl-detail-archive-row[aria-current="page"]{border-color:var(--gw-accent);background:var(--gw-surface-accent-tint)}
@media(max-width:900px){.gw-nl-editorial-lead,.gw-nl-editorial-secondary,.gw-nl-workbench-lead,.gw-nl-workbench-secondary,.gw-nl-history-grid{grid-template-columns:1fr}}
@media(max-width:760px){.gw-nl-root{padding:var(--gw-space-4)}.gw-nl-pair-grid,.gw-nl-agenda-grid,.gw-nl-lens-grid,.gw-nl-roundtable-meta{grid-template-columns:1fr}.gw-nl-meeting-reference{grid-template-columns:1fr}.gw-nl-ledger-table{display:block;overflow-x:auto}.gw-nl-player-status{width:100%;margin-left:0}.gw-nl-baseline-card{padding:var(--gw-space-4)}.gw-nl-heading-with-info,.gw-nl-context-row{align-items:center}.gw-nl-origin-with-info{align-items:center}}
${NEWSLETTER_DESIGN_STYLE}
`;

let styleInjected = false;
function ensureNewsletterStyle(): void {
  if (styleInjected) return;
  document.head.append(el('style', {}, [NEWSLETTER_STYLE]));
  styleInjected = true;
}
