// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, STYLE, BADGE_MIN_FONT_PX, DRAWER_TAP_MIN_PX } from '../src/ui/render';
import { loading, failed, resolved } from '../src/state/async-state';
import { FIXTURE, isEmptyResponse } from '../src/data/client';
import type { ReadApiResponse } from '../src/types/read-api';
// FIXTURE is now the REAL reviewed snapshot (6 source-backed records, no concept
// graph). Rich card features — typed related-links, source-registry drawer fields,
// breadcrumb, mixed AI/human cards — only exist in the labeled SYNTHETIC demo,
// which the real corpus cannot produce yet (GOV-129 follow-up).
import demoData from '../src/fixtures/concept-graph-demo.json';
import stateMatrixData from '../src/fixtures/state-matrix.json';

const DEMO = demoData as unknown as ReadApiResponse;
const MATRIX = stateMatrixData as unknown as ReadApiResponse;

let root: HTMLElement;
beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
});

const empty: ReadApiResponse = { scope: 'alpine', access: 'reviewer_internal', records: [] };

describe('render — loading/empty/error primitives render from fixtures', () => {
  it('renders the loading primitive', () => {
    render(root, loading<ReadApiResponse>('fixture'));
    expect(root.querySelector('[data-test="state-loading"]')).not.toBeNull();
  });

  it('renders the empty primitive', () => {
    render(root, resolved(empty, 'fixture', isEmptyResponse));
    expect(root.querySelector('[data-test="state-empty"]')).not.toBeNull();
  });

  it('renders the error primitive with role=alert', () => {
    render(root, failed<ReadApiResponse>(new Error('read-API unreachable'), 'fixture'));
    const node = root.querySelector('[data-test="state-error"]');
    expect(node).not.toBeNull();
    expect(node!.getAttribute('role')).toBe('alert');
    expect(root.textContent).toContain('read-API unreachable');
  });

  it('always shows the FIXTURE MODE banner in fixture mode', () => {
    render(root, loading<ReadApiResponse>('fixture'));
    const banner = root.querySelector('[data-test="fixture-banner"]');
    expect(banner?.textContent).toContain('OFFLINE SAMPLE — not a live read');
  });

  it('renders the REAL reviewed records (cards + source-backed badges + source drawer)', () => {
    render(root, resolved(FIXTURE, 'fixture', isEmptyResponse));
    // All 84 promoted reviewer-internal records (5 batches), each with a trust badge + drawer.
    expect(root.querySelectorAll('[data-test="record-card"]').length).toBe(FIXTURE.records!.length);
    expect(FIXTURE.records!.length).toBe(84);
    const badges = [...root.querySelectorAll('[data-test="trust-badge"]')].map((b) => b.textContent);
    // Every real reviewed row is source-backed (the eligible-only serve emits no other).
    expect(badges.every((b) => b === 'Source-backed')).toBe(true);
    expect(root.querySelector('[data-test="source-drawer"]')).not.toBeNull();
    // Real rows are AI-produced + reviewed → the locked AI label is always present.
    expect(root.querySelector('[data-test="ai-label"]')?.textContent).toContain('AI — not independently verified');
    // Real topic_tree (GOV-149/150) provides a breadcrumb; agenda_thread is null (honest empty).
    expect(root.querySelector('[data-test="breadcrumb"]')?.textContent).toContain('Town of Alpine');
    expect(root.querySelector('[data-test="agenda-thread"]')).toBeNull();
    // Transport floor holds on the real payload: no raw/vault path reaches the DOM.
    expect(root.textContent ?? '').not.toMatch(/\/Users\/|Obsidian Vault|transcript_path|\.sha256/);
  });

  it('renders the breadcrumb from a served topic tree (synthetic demo)', () => {
    render(root, resolved(DEMO, 'fixture', isEmptyResponse));
    expect(root.querySelector('[data-test="breadcrumb"]')?.textContent).toContain('general safety');
  });

  it('does NOT show the fixture banner in live mode', () => {
    render(root, resolved(FIXTURE, 'live', isEmptyResponse));
    expect(root.querySelector('[data-test="fixture-banner"]')).toBeNull();
  });
});

describe('GOV-100 — statement card + drawer + typed related-links (synthetic demo)', () => {
  beforeEach(() => render(root, resolved(DEMO, 'fixture', isEmptyResponse)));

  it('shows exactly one status badge per card', () => {
    const cards = root.querySelectorAll('[data-test="record-card"]');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.querySelectorAll('[data-test="trust-badge"]').length).toBe(1);
    }
  });

  it('renders the locked/visible AI label and separates AI analysis from facts (BEH-HANDOFF-4)', () => {
    const ai = root.querySelector('[data-test="ai-analysis"]');
    expect(ai).not.toBeNull();
    expect(ai!.textContent).toContain('not independently verified');
    // The AI card carries the locked label; a human-fact card does not.
    expect(root.querySelector('[data-test="ai-label"]')?.textContent).toContain('AI — not independently verified');
    expect(root.querySelector('[data-test="statement-fact"]')).not.toBeNull();
  });

  it('renders a typed Supersedes link from the backend edge type (never inferred)', () => {
    const types = [...root.querySelectorAll('[data-test="related-type"]')].map((n) => n.textContent);
    expect(types).toContain('Supersedes');
    expect(types).toContain('Amends');
    expect(types).toContain('Revisits');
    expect(types).not.toContain('related');
  });

  it('drawer renders labeled 1.06 §6 fields, incl. the safe source registry id', () => {
    expect(root.querySelector('[data-test="drawer-field-to_source_id"]')).not.toBeNull();
    expect(root.querySelector('[data-test="drawer-field-verification_status"]')).not.toBeNull();
    expect(root.querySelector('[data-test="drawer-field-source_type"]')).not.toBeNull();
    expect(root.querySelector('[data-test="drawer-link-original_url"]')).not.toBeNull();
  });

  it('shows the visible "Archive not available" row for a broken archive', () => {
    const archives = [...root.querySelectorAll('[data-test="drawer-field-archive_url"]')];
    expect(archives.some((n) => n.textContent?.includes('Archive not available'))).toBe(true);
  });

  it('never paints a reviewer note or raw/local path into the DOM', () => {
    const text = root.textContent ?? '';
    expect(text).not.toMatch(/\/Users\/|Obsidian Vault|transcript_path|\.sha256/);
    // No reviewer-note field label leaks in.
    expect(root.querySelector('[data-test="drawer-field-reviewer_note"]')).toBeNull();
    expect(root.querySelector('[data-test="drawer-field-note"]')).toBeNull();
  });
});

describe('GOV-293 — confidence_label + safe speaker_label + exact-source citation', () => {
  beforeEach(() => render(root, resolved(MATRIX, 'fixture', isEmptyResponse)));

  it('renders the safe speaker_label and confidence_label verbatim on each card', () => {
    const speakers = [...root.querySelectorAll('[data-test="speaker-label"]')].map((n) => n.textContent);
    expect(speakers.length).toBe(MATRIX.records!.length);
    // The safe vocabulary surfaces verbatim — generic, community, and the one
    // approved "Name, Role" — and nothing else is invented.
    expect(speakers.some((s) => s?.includes('Meeting Attendee'))).toBe(true);
    expect(speakers.some((s) => s?.includes('Community Member'))).toBe(true);
    expect(speakers.some((s) => s?.includes('Jane Doe, Mayor'))).toBe(true);

    const confidences = [...root.querySelectorAll('[data-test="confidence-label"]')].map((n) => n.textContent);
    expect(confidences.some((c) => c?.includes('Source-anchored (timed transcript)'))).toBe(true);
    expect(confidences.some((c) => c?.includes('Auto-caption (untimed)'))).toBe(true);
    expect(confidences.some((c) => c?.includes('Derived summary'))).toBe(true);
  });

  it('keeps speaker + confidence OUTSIDE the blurred info region (sharp at all times)', () => {
    // Safety-critical: an AI/low-confidence row must read as such at a glance, so
    // the attribution + confidence trail must never sit behind the reveal blur.
    for (const card of root.querySelectorAll('[data-test="record-card"]')) {
      const info = card.querySelector('[data-test="card-info"]')!;
      expect(info.querySelector('[data-test="speaker-label"]')).toBeNull();
      expect(info.querySelector('[data-test="confidence-label"]')).toBeNull();
    }
    // And they ARE present on the card (in the sharp region).
    expect(root.querySelector('[data-test="card-meta"] [data-test="speaker-label"]')).not.toBeNull();
    expect(root.querySelector('[data-test="card-meta"] [data-test="confidence-label"]')).not.toBeNull();
  });

  it('surfaces the exact-source citation pointer (char_span) in the drawer', () => {
    const pointers = [...root.querySelectorAll('[data-test="drawer-field-locator_kind"]')].map((n) => n.textContent);
    expect(pointers.some((p) => p?.includes('Character span (exact source text)'))).toBe(true);
    expect(pointers.some((p) => p?.includes('Transcript timestamp'))).toBe(true);
  });

  it('does NOT fabricate speaker/confidence when the backend did not send them (real pre-GOV-283/290 fixture)', () => {
    // The real 84-record capture predates the two envelope keys; the card must
    // omit the rows rather than invent a label.
    render(root, resolved(FIXTURE, 'fixture', isEmptyResponse));
    expect(FIXTURE.records!.some((r) => r.confidence_label != null)).toBe(false);
    expect(root.querySelector('[data-test="speaker-label"]')).toBeNull();
    expect(root.querySelector('[data-test="confidence-label"]')).toBeNull();
    // …but the real evidence DOES carry locator_kind char_span → pointer renders.
    expect(root.querySelector('[data-test="drawer-field-locator_kind"]')?.textContent).toContain('Character span');
  });

  it('never leaks a raw/local path through the new fields', () => {
    expect(root.textContent ?? '').not.toMatch(/\/Users\/|Obsidian Vault|transcript_path|\.sha256/);
  });
});

// UXProductDesigner formalized legibility/touch floors (GOV-100). The exact
// computed-px is verified in a real browser at 390px; this guards the CSS floor
// in CI (no browser) so it can never silently regress below the threshold.
describe('GOV-100 — legibility / touch-target floors honoured by the stylesheet', () => {
  it('badge font and drawer tap target meet the formalized minimums', () => {
    expect(BADGE_MIN_FONT_PX).toBeGreaterThanOrEqual(13);
    expect(DRAWER_TAP_MIN_PX).toBeGreaterThanOrEqual(44);
  });

  // GOV-427: badges/taps now consume the design-token layer. The floor still
  // can't silently regress — it is BAKED INTO the token value (the px is tied to
  // the exported source-of-truth constant), and the consuming rules reference
  // that token. Asserting both halves keeps this a real floor guard, per
  // docs/ui-design-system.md §5.1 (intentional test update, not papering over).
  it('bakes the ≥13px / ≥44px floors into the tokens and consumes them', () => {
    // token definitions carry the floor, tied to the exported constants
    expect(STYLE).toContain(`--gw-badge-min:${BADGE_MIN_FONT_PX}px`);
    expect(STYLE).toContain(`--gw-tap-min:${DRAWER_TAP_MIN_PX}px`);
    expect(STYLE).toContain('--gw-text-badge:var(--gw-badge-min)');
    // badge + tap-target rules consume the floor tokens
    expect(STYLE).toContain('.gw-badge{font-size:var(--gw-text-badge)');
    expect(STYLE).toContain('min-height:var(--gw-tap-min)');
  });
});
