// @vitest-environment jsdom
//
// GOV-354 (Stage 3.06 impl) — render the GOV-347 card-feed on the reviewer-internal
// Alpine timeline. Proves the GOV-353 contract end to end against the card-feed
// adapter (`buildCardFeedModel`) + the rendered surface (`renderCardFeed`):
//
//   - the adapter partitions {scope, access, cards[]} → records + completeness_gaps
//     verbatim (status pinned 1:1, no field re-derived),
//   - the reviewer-internal lane is the SOLE gate: public lane = 0 cards AND 0
//     leaked reviewer-internal-only fields (reviewed_summary / speaker_label /
//     provenance_status / statement_text) anywhere in the DOM (mirror GOV-314/316),
//   - source_missing cards route to the GOV-301 gap lane, never as present records,
//   - bounded-gap statuses (disputed / source_changed) are dropped, never fabricated,
//   - the whole feed passes assertWebSafe (fail-loud on a planted raw path),
//   - the real verbatim fixture renders (6 present + 90 no_primary_source gaps).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildCardFeedModel,
  statusToUiStatus,
  isAiPresented,
  isBoundedGapStatus,
  cardTypeGlyph,
  REVIEWER_INTERNAL,
  type CardFeed,
  type PresentCard,
  type SourceMissingCard,
} from '../src/ui/card-feed';
import { renderCardFeed } from '../src/ui/render';
import { RawPathLeak } from '../src/data/web-safe';
import cardFeedData from '../src/fixtures/alpine-card-feed.json';

const REAL_FEED = cardFeedData as unknown as CardFeed;

function present(p: Partial<PresentCard> & { handle: string; type: PresentCard['type']; status: PresentCard['status'] }): PresentCard {
  return { evidence: [], ...p };
}
function gap(p: Partial<SourceMissingCard> & { handle: string }): SourceMissingCard {
  return {
    type: 'source_missing',
    status: 'source_missing',
    gap_type: 'no_primary_source',
    severity: 'warn',
    resolved_status: 'open',
    ...p,
  };
}
function feed(cards: CardFeed['cards'], access: CardFeed['access'] = REVIEWER_INTERNAL): CardFeed {
  return { scope: 'alpine', access, cards };
}

// ---------------------------------------------------------------------------
// Pure status pin (§3) — verbatim, fail-closed
// ---------------------------------------------------------------------------
describe('GOV-354 statusToUiStatus — 1:1 pin, fail-closed least-trusted', () => {
  it('maps the backend status vocab to ui_status verbatim', () => {
    expect(statusToUiStatus('verified')).toBe('source-backed');
    expect(statusToUiStatus('corrected')).toBe('corrected');
    expect(statusToUiStatus('ai_presented')).toBe('unverified');
    expect(statusToUiStatus('unverified')).toBe('unverified');
    expect(statusToUiStatus('source_missing')).toBe('source-missing');
  });
  it('fails closed to the least-trusted unverified for an unforeseen value (never drops it)', () => {
    expect(statusToUiStatus('a_future_status_we_have_not_seen')).toBe('unverified');
  });
  it('only treats ai_presented as AI-origin (a non-AI unverified card is not mislabeled AI)', () => {
    expect(isAiPresented(present({ handle: 'a', type: 'ai_presented', status: 'ai_presented' }))).toBe(true);
    expect(isAiPresented(present({ handle: 'b', type: 'statement', status: 'unverified' }))).toBe(false);
  });
  it('flags only disputed / source_changed as a bounded-gap (not surfaceable)', () => {
    expect(isBoundedGapStatus('disputed')).toBe(true);
    expect(isBoundedGapStatus('source_changed')).toBe(true);
    expect(isBoundedGapStatus('unverified')).toBe(false);
  });
  it('cardTypeGlyph gives an icon+label per type and a safe fallback', () => {
    expect(cardTypeGlyph('ai_presented')).toEqual({ emoji: '🤖', label: 'AI presented' });
    expect(cardTypeGlyph('statement').label).toBe('Statement');
    expect(cardTypeGlyph('brand_new_type').label).toBe('Brand new type');
  });
});

// ---------------------------------------------------------------------------
// Adapter partition (§2.3) — present → records, source_missing → gaps
// ---------------------------------------------------------------------------
describe('GOV-354 buildCardFeedModel — partition + verbatim mapping', () => {
  it('routes present cards to records (with head) and source_missing to the gap lane', () => {
    const model = buildCardFeedModel(
      feed([
        present({
          handle: 'c1_aaa',
          type: 'statement',
          status: 'verified',
          date: '2024-03-12',
          reviewed_summary: 'A reviewed Alpine statement.',
          speaker_label: 'Jane Doe, Mayor',
          confidence_label: 'source_anchored_timed',
          provenance_status: 'grounded',
          evidence: [{ relation: 'primary source', final_url: 'https://ex.org/a.html' }],
        }),
        gap({ handle: 'c1_bbb', gap_type: 'no_primary_source' }),
      ]),
    );
    expect(model.response.records).toHaveLength(1);
    expect(model.response.completeness_gaps).toHaveLength(1);

    const rec = model.response.records![0];
    expect(rec.statement_id).toBe('c1_aaa');
    expect(rec.statement_text).toBe('A reviewed Alpine statement.');
    expect(rec.ui_status).toBe('source-backed');
    expect(rec.speaker_label).toBe('Jane Doe, Mayor');
    expect(rec.provenance_status).toBe('grounded');
    expect(rec.produced_by).toBe('human');
    // The verbatim card date drives the existing ordering/anchor via the id.
    expect(rec.agenda_item_id).toBe('alpine:2024-03-12:c1_aaa');
    // final_url is projected into the drawer's original-url slot (never invented).
    expect(rec.evidence[0].original_url).toBe('https://ex.org/a.html');

    const head = model.heads.get('c1_aaa');
    expect(head?.glyph.label).toBe('Statement');
    expect(head?.date).toBe('2024-03-12');

    const gapCard = model.response.completeness_gaps![0];
    expect(gapCard.gap_type).toBe('no_primary_source');
    expect(gapCard.subject_id).toBe('c1_bbb'); // handle is the per-meeting subject
  });

  it('marks ai_presented cards AI-produced (gated region) — grounded provenance still rides through', () => {
    const model = buildCardFeedModel(
      feed([present({ handle: 'c1_ai', type: 'ai_presented', status: 'ai_presented', provenance_status: 'grounded', reviewed_summary: 'AI text' })]),
    );
    const rec = model.response.records![0];
    expect(rec.produced_by).toBe('ai');
    expect(rec.ui_status).toBe('unverified');
    expect(rec.provenance_status).toBe('grounded');
  });

  it('drops bounded-gap (disputed / source_changed) present cards and logs them — no fabricated dispute', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = buildCardFeedModel(
      feed([
        present({ handle: 'c1_d', type: 'statement', status: 'disputed' }),
        present({ handle: 'c1_s', type: 'statement', status: 'source_changed' }),
        present({ handle: 'c1_ok', type: 'statement', status: 'verified' }),
      ]),
    );
    expect(model.response.records).toHaveLength(1);
    expect(model.dropped.map((d) => d.handle).sort()).toEqual(['c1_d', 'c1_s']);
    warn.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// §5 reviewer-internal invariant — SOLE gate, public lane = 0 cards + 0 leaks
// ---------------------------------------------------------------------------
describe('GOV-354 reviewer-internal invariant (§5) — no public leak', () => {
  const sensitive = feed([
    present({
      handle: 'c1_secret',
      type: 'statement',
      status: 'verified',
      reviewed_summary: 'SECRET-REVIEWED-SUMMARY-TEXT',
      speaker_label: 'SECRET-SPEAKER-LABEL',
      provenance_status: 'grounded',
    }),
    gap({ handle: 'c1_gap' }),
  ]);

  it('adapter returns 0 records + 0 gaps on a non-reviewer-internal lane', () => {
    const model = buildCardFeedModel({ ...sensitive, access: 'public' });
    expect(model.response.records).toHaveLength(0);
    expect(model.response.completeness_gaps).toHaveLength(0);
    expect(model.heads.size).toBe(0);
    // The reviewer-internal-only field values never enter the serialized output.
    const serialized = JSON.stringify(model.response);
    expect(serialized).not.toContain('SECRET-REVIEWED-SUMMARY-TEXT');
    expect(serialized).not.toContain('SECRET-SPEAKER-LABEL');
  });

  let root: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '';
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  it('PUBLIC lane DOM renders 0 cards and leaks NO reviewer-internal-only field', () => {
    renderCardFeed(root, { ...sensitive, access: 'public' });
    expect(root.querySelectorAll('[data-test="record-card"]').length).toBe(0);
    expect(root.querySelector('[data-test="completeness-gap-card"]')).toBeNull();
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    const html = root.innerHTML;
    expect(html).not.toContain('SECRET-REVIEWED-SUMMARY-TEXT');
    expect(html).not.toContain('SECRET-SPEAKER-LABEL');
    // No provenance badge synthesized off-lane.
    expect(root.querySelector('[data-test="provenance-badge"]')).toBeNull();
  });

  it('REVIEWER-INTERNAL lane DOM renders the card with its head, badge, provenance + gap card', () => {
    renderCardFeed(root, sensitive);
    const cards = root.querySelectorAll('[data-test="record-card"]');
    expect(cards.length).toBe(1);
    expect(root.querySelector('[data-test="card-head"]')).not.toBeNull();
    expect(root.querySelector('[data-test="card-type"]')?.textContent).toContain('Statement');
    expect(root.querySelector('[data-test="trust-badge"]')?.textContent).toBe('Source-backed');
    expect(root.querySelector('[data-test="provenance-badge"]')).not.toBeNull();
    // gap lane present (1 gap)
    expect(root.querySelector('[data-test="completeness-gap-card"]')).not.toBeNull();
    // the reviewer-internal text IS present on this lane (it is allowed here)
    expect(root.innerHTML).toContain('SECRET-REVIEWED-SUMMARY-TEXT');
  });
});

// ---------------------------------------------------------------------------
// Defense in depth (§5.4) — assertWebSafe fails loud on a planted raw path
// ---------------------------------------------------------------------------
describe('GOV-354 web-safe sweep (§5.4)', () => {
  it('throws RawPathLeak when a present card carries a vault path in reviewed_summary', () => {
    expect(() =>
      buildCardFeedModel(
        feed([present({ handle: 'c1_leak', type: 'statement', status: 'verified', reviewed_summary: '/Users/secret/vault/notes.md' })]),
      ),
    ).toThrow(RawPathLeak);
  });
});

// ---------------------------------------------------------------------------
// Real verbatim fixture (GOV-347 @ backend HEAD 6d65bd3)
// ---------------------------------------------------------------------------
describe('GOV-354 real verbatim fixture', () => {
  let root: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '';
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  it('partitions the real feed into 6 present cards + the source_missing gap lane', () => {
    const model = buildCardFeedModel(REAL_FEED);
    expect(model.response.access).toBe('reviewer_internal');
    expect(model.response.records).toHaveLength(6);
    // every present card in this seed corpus is AI-extracted → gated AI region
    expect(model.response.records!.every((r) => r.produced_by === 'ai')).toBe(true);
    const gaps = model.response.completeness_gaps!;
    expect(gaps.length).toBeGreaterThan(200);
    const noPrimary = gaps.filter((g) => g.gap_type === 'no_primary_source');
    expect(noPrimary.length).toBe(90); // the watchdog headline — stays countable
  });

  it('renders the real feed: AI-labeled cards + the no_primary_source headline count', () => {
    renderCardFeed(root, REAL_FEED);
    expect(root.querySelectorAll('[data-test="record-card"]').length).toBe(6);
    // all present cards AI → every card shows the locked AI label
    expect(root.querySelectorAll('[data-test="ai-label"]').length).toBe(6);
    expect(root.querySelector('[data-test="gap-no-primary-source-count"]')?.textContent).toBe('90');
    // source drawer present on a card
    expect(root.querySelector('[data-test="source-drawer"]')).not.toBeNull();
  });
});
