// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, STYLE, BADGE_MIN_FONT_PX, DRAWER_TAP_MIN_PX } from '../src/ui/render';
import { loading, failed, resolved } from '../src/state/async-state';
import { FIXTURE, isEmptyResponse } from '../src/data/client';
import type { ReadApiResponse } from '../src/types/read-api';

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
    expect(banner?.textContent).toContain('FIXTURE MODE — Not real data');
  });

  it('renders the timeline + trust badges + source drawer from the fixture', () => {
    render(root, resolved(FIXTURE, 'fixture', isEmptyResponse));
    expect(root.querySelectorAll('[data-test="record-card"]').length).toBe(FIXTURE.records!.length);
    expect(root.querySelector('[data-test="trust-badge"]')?.textContent).toContain('Source-backed');
    expect(root.querySelector('[data-test="source-drawer"]')).not.toBeNull();
    expect(root.querySelector('[data-test="breadcrumb"]')?.textContent).toContain('general safety');
  });

  it('does NOT show the fixture banner in live mode', () => {
    render(root, resolved(FIXTURE, 'live', isEmptyResponse));
    expect(root.querySelector('[data-test="fixture-banner"]')).toBeNull();
  });
});

describe('GOV-100 — statement card + drawer + typed related-links', () => {
  beforeEach(() => render(root, resolved(FIXTURE, 'fixture', isEmptyResponse)));

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

// UXProductDesigner formalized legibility/touch floors (GOV-100). The exact
// computed-px is verified in a real browser at 390px; this guards the CSS floor
// in CI (no browser) so it can never silently regress below the threshold.
describe('GOV-100 — legibility / touch-target floors honoured by the stylesheet', () => {
  it('badge font and drawer tap target meet the formalized minimums', () => {
    expect(BADGE_MIN_FONT_PX).toBeGreaterThanOrEqual(13);
    expect(DRAWER_TAP_MIN_PX).toBeGreaterThanOrEqual(44);
  });

  it('sizes badges ≥13px and the drawer summary ≥44px in the stylesheet', () => {
    expect(STYLE).toContain(`.gw-badge{font-size:${BADGE_MIN_FONT_PX}px`);
    expect(STYLE).toContain(`min-height:${DRAWER_TAP_MIN_PX}px`);
  });
});
