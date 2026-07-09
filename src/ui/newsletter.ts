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
 * Gated-beta enforcement (§5) lives in `main.ts` via the existing `gated()` wrapper
 * (reuses `resolveAccess`/`isApproved`, 0-diff) — this module renders civic data
 * ONLY once that wrapper has admitted an approved request.
 */

import { GW_TOKENS } from './tokens';
import { statusTone, uiStatusLabel, AI_LABEL_TEXT, FIXTURE_BANNER_TEXT } from './state-view';
import type { TrustTone } from './state-view';
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
  return el('section', { class: 'gw-nl-section', 'data-test': `section-${key}`, 'data-empty': String(isEmpty) }, [
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
  const links: (Node | string)[] = [];
  if (entry.originalUrl) {
    links.push(el('a', { class: 'gw-nl-deeplink', href: entry.originalUrl, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'source-original' }, ['View original']));
  }
  if (entry.archiveUrl) {
    links.push(el('a', { class: 'gw-nl-deeplink', href: entry.archiveUrl, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'source-archive' }, ['View archive']));
  }
  const children: (Node | string)[] = [el('div', { class: 'gw-nl-item-head' }, parts)];
  if (links.length) children.push(el('div', { class: 'gw-nl-item-links' }, links));
  // localSourcePath is null and intentionally never rendered (§3).
  return el('div', { class: 'gw-nl-item', 'data-test': 'source-trail-entry' }, children);
}

function sourceTrailSection(digest: NewsletterDigest): HTMLElement {
  const trail = digest.sections.sourceTrail ?? [];
  return section('sourceTrail', 'Source trail', trail.map(sourceTrailEntryRow), trail.length === 0);
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

function fixtureBanner(notice?: string): HTMLElement {
  return el('div', { class: 'gw-fixture-banner', 'data-test': 'fixture-banner' }, [
    FIXTURE_BANNER_TEXT,
    ...(notice ? [el('div', { class: 'gw-notice' }, [notice])] : []),
  ]);
}

/** `#/newsletter` — archive list of digests by Alpine coverage period. */
export function renderNewsletterArchive(
  root: HTMLElement,
  response: NewsletterDigestResponse,
  notice?: string,
): void {
  ensureNewsletterStyle();
  root.className = 'gw-nl-root';
  root.replaceChildren();
  const rows = archiveRows(response);

  root.append(
    fixtureBanner(notice),
    el('section', { class: 'gw-nl-header', 'data-test': 'newsletter-archive' }, [
      el('p', { class: 'gw-landing-kicker' }, [ALPINE_KICKER]),
      el('h1', { class: 'gw-nl-h1' }, ['Alpine Weekly broadsheet archive']),
      el('p', { class: 'gw-muted' }, ['Reviewed weekly digest rows by Alpine coverage period. Reviewer-internal archive only.']),
    ]),
  );

  if (rows.length === 0) {
    root.append(el('p', { class: 'gw-nl-none gw-muted', 'data-test': 'archive-empty' }, ['No digests for Alpine yet.']));
    return;
  }

  const list = el('div', { class: 'gw-nl-archive-list' });
  for (const row of rows) {
    list.append(
      el('a', { class: 'gw-nl-archive-row', href: row.href, 'data-test': 'archive-row', 'data-id': row.newsletterId }, [
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

/** `#/newsletter?id=<id>` — one digest as every required GOV-15 section (§3). */
export function renderNewsletterDetail(
  root: HTMLElement,
  response: NewsletterDigestResponse,
  newsletterId: string,
  notice?: string,
): void {
  ensureNewsletterStyle();
  root.className = 'gw-nl-root';
  root.replaceChildren();
  const digest = resolveDigest(response, newsletterId);

  root.append(fixtureBanner(notice));

  if (!digest) {
    root.append(
      el('section', { class: 'gw-nl-header', 'data-test': 'newsletter-detail-missing' }, [
        el('p', { class: 'gw-landing-kicker' }, [ALPINE_KICKER]),
        el('h1', { class: 'gw-nl-h1' }, ['Digest not found']),
        el('p', { class: 'gw-muted' }, [`No Alpine digest with id "${newsletterId}".`]),
        el('p', {}, [el('a', { class: 'gw-nl-deeplink', href: '#/newsletter', 'data-test': 'back-to-archive' }, ['← Back to archive'])]),
      ]),
    );
    return;
  }

  root.append(
    el('section', { class: 'gw-nl-header', 'data-test': 'newsletter-detail', 'data-id': digest.newsletterId }, [
      el('p', { class: 'gw-landing-kicker' }, [ALPINE_KICKER]),
      el('h1', { class: 'gw-nl-h1' }, [`Alpine Weekly broadsheet — ${coveragePeriodLabel(digest.coveragePeriod)}`]),
      el('p', { class: 'gw-muted' }, [digest.newsletterId]),
      el('p', {}, [el('a', { class: 'gw-nl-deeplink', href: '#/newsletter', 'data-test': 'back-to-archive' }, ['← Back to archive'])]),
    ]),
  );

  const sections = el('div', { class: 'gw-nl-sections' });
  renderSections(sections, digest);
  root.append(sections);
}

/** State kinds capturable via `?state=` (BEH-STATE precedent). */
export type NewsletterStateKind = 'loading' | 'empty' | 'error';

/** `?state=loading|empty|error` over the data binding (screenshot override, §2). */
export function renderNewsletterState(root: HTMLElement, kind: NewsletterStateKind): void {
  ensureNewsletterStyle();
  root.className = 'gw-nl-root';
  root.replaceChildren();
  const copy: Record<NewsletterStateKind, { heading: string; message: string }> = {
    loading: { heading: 'Loading…', message: 'Fetching the reviewer-internal Alpine newsletter archive.' },
    empty: { heading: 'No digests for Alpine yet', message: 'No reviewed digests are available for this view.' },
    error: { heading: 'Could not load the newsletter archive', message: 'The reviewer-internal digest source is unreachable.' },
  };
  const c = copy[kind];
  root.append(
    fixtureBanner(),
    el('section', { class: 'gw-state', 'data-test': 'newsletter-state', 'data-state': kind }, [
      el('h1', { class: 'gw-nl-h1' }, [c.heading]),
      el('p', { class: 'gw-muted' }, [c.message]),
    ]),
  );
}

// ---------------------------------------------------------------------------
// Styles — reuse the app's gw-badge / gw-tone-* classes (from render.ts), add
// only newsletter layout. No new tone / badge styling is introduced here.
// ---------------------------------------------------------------------------

export const NEWSLETTER_STYLE = `${GW_TOKENS}
.gw-nl-root{font-family:var(--gw-font);line-height:1.55;color:var(--gw-text);max-width:60rem;margin:0 auto;padding:1.5rem var(--gw-space-5);background:linear-gradient(180deg,var(--gw-surface),var(--gw-bg))}
.gw-nl-h1{font-size:var(--gw-text-xl);margin:0 0 var(--gw-space-2);line-height:var(--gw-leading-tight)}
.gw-nl-header{margin-bottom:var(--gw-space-4);border-bottom:var(--gw-border-w) double var(--gw-border);padding-bottom:var(--gw-space-3);text-align:center}
.gw-muted{color:var(--gw-text-muted)}
.gw-meta-key{color:var(--gw-text-muted);font-weight:600}
.gw-badge{font-size:var(--gw-text-badge);line-height:1.3;font-weight:700;background:var(--gw-surface-accent-tint);color:var(--gw-text-secondary);border:var(--gw-border-w) solid var(--gw-neutral-border);border-radius:var(--gw-radius-pill);padding:.15rem .55rem;white-space:nowrap}
.gw-tone-ok{background:var(--gw-ok-bg);color:var(--gw-ok-text);border-color:var(--gw-ok-text)}
.gw-tone-caution{background:var(--gw-caution-bg);color:var(--gw-caution-text);border-color:var(--gw-caution-text)}
.gw-tone-stop{background:var(--gw-stop-bg);color:var(--gw-stop-text);border-color:var(--gw-stop-border)}
.gw-tone-neutral{background:var(--gw-surface-accent-tint);color:var(--gw-accent);border-color:var(--gw-accent)}
.gw-badge-ai{background:var(--gw-caution-bg);color:var(--gw-caution-text);border-color:var(--gw-caution-text)}
.gw-fixture-banner{background:var(--gw-caution-bg);border:var(--gw-border-w) solid var(--gw-caution-line);color:var(--gw-caution-text-strong);padding:var(--gw-space-3) var(--gw-space-4);border-radius:var(--gw-radius);font-weight:600;margin-bottom:.75rem}
.gw-notice{font-size:.85rem;color:var(--gw-caution-text-strong);margin-top:var(--gw-space-1);font-weight:400}
.gw-state{border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-5);background:var(--gw-surface)}
.gw-state[data-state="error"]{border-color:var(--gw-stop-border);color:var(--gw-stop-text);background:var(--gw-stop-bg)}
.gw-nl-archive-list{display:flex;flex-direction:column;gap:var(--gw-space-3)}
.gw-nl-archive-row{display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--gw-space-3);align-items:center;text-decoration:none;color:inherit;border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:.7rem .9rem;background:var(--gw-surface);min-height:var(--gw-tap-min)}
.gw-nl-archive-row:hover,.gw-nl-archive-row:focus-visible{border-color:var(--gw-accent);outline:none}
.gw-nl-archive-id{font-weight:700;margin-right:var(--gw-space-3)}
.gw-nl-archive-meta{display:flex;flex-wrap:wrap;gap:var(--gw-space-2);align-items:center}
.gw-nl-count{font-size:var(--gw-text-sm);font-weight:700;color:var(--gw-text-secondary)}
.gw-nl-sections{display:grid;grid-template-columns:repeat(auto-fit,minmax(18rem,1fr));gap:var(--gw-space-4)}
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
.gw-nl-deeplink{color:var(--gw-accent);font-size:var(--gw-text-sm);text-decoration:none;font-weight:600}
.gw-nl-deeplink:hover{text-decoration:underline}
.gw-nl-chips{display:flex;flex-wrap:wrap;gap:var(--gw-space-2)}
.gw-nl-chip{font-size:var(--gw-text-sm);background:var(--gw-surface-accent-tint);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-sm);padding:.1rem .45rem}
.gw-nl-kv{margin:var(--gw-space-1) 0}
.gw-nl-framing{background:var(--gw-caution-bg-soft);border-left:3px solid var(--gw-caution-line);padding:var(--gw-space-1) var(--gw-space-3);border-radius:var(--gw-radius-sm);margin:var(--gw-space-2) 0}
`;

let styleInjected = false;
function ensureNewsletterStyle(): void {
  if (styleInjected) return;
  document.head.append(el('style', {}, [NEWSLETTER_STYLE]));
  styleInjected = true;
}
