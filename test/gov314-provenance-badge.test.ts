// @vitest-environment jsdom
//
// GOV-314 (Stage 2.12 frontend surface) — the provenance / audit-passed trust
// badge on the reviewer-internal timeline. Consumes the GOV-311 backend
// `provenance_status` envelope key VERBATIM; the client never recomputes grounding.
//
// Covers the GOV-311 read-time contract end to end:
//   - pure `provenanceBadge` mapping (fail-closed, CLOSED 2-value SSOT),
//   - the rendered per-record badge on the reviewer-internal lane,
//   - the PUBLIC-lane guard (0 provenance badges — the client never synthesizes it),
//   - accessibility (icon + text, not colour-only; meaningful aria-label).
import { describe, it, expect, beforeEach } from 'vitest';
import { provenanceBadge } from '../src/ui/statement-presenter';
import { render } from '../src/ui/render';
import { resolved } from '../src/state/async-state';
import { isEmptyResponse } from '../src/data/client';
import type { ReadApiResponse, StatementRecord, ProvenanceStatus, AccessState } from '../src/types/read-api';
import { PROVENANCE_GROUNDED, PROVENANCE_UNVERIFIED } from '../src/types/read-api';

function rec(partial: Partial<StatementRecord> & { statement_id: string }): StatementRecord {
  return { evidence: [], ...partial };
}

function resp(
  records: StatementRecord[],
  access: AccessState = 'reviewer_internal',
  scope = 'alpine',
): ReadApiResponse {
  return { scope, access, records };
}

describe('GOV-314 provenanceBadge — pure fail-closed mapping (never recomputes trust)', () => {
  it('maps the exact SSOT "grounded" value to the audit-passed affirmative state', () => {
    const badge = provenanceBadge(rec({ statement_id: 's', provenance_status: PROVENANCE_GROUNDED }));
    expect(badge.state).toBe('grounded');
    expect(badge.label).toBe('Audit-passed');
    expect(badge.icon).toBe('✓');
    expect(badge.tone).toBe('ok');
    expect(badge.description.length).toBeGreaterThan(0);
  });

  it('maps the explicit "unverified" value to the cautionary state', () => {
    const badge = provenanceBadge(rec({ statement_id: 's', provenance_status: PROVENANCE_UNVERIFIED }));
    expect(badge.state).toBe('unverified');
    expect(badge.label).toBe('Unverified provenance');
    expect(badge.icon).toBe('⚠');
    expect(badge.tone).toBe('caution');
  });

  it('fails closed to "unverified" for a missing / null / blank value (never optimistic)', () => {
    expect(provenanceBadge(rec({ statement_id: 's' })).state).toBe('unverified');
    expect(provenanceBadge(rec({ statement_id: 's', provenance_status: null })).state).toBe('unverified');
    expect(provenanceBadge(rec({ statement_id: 's', provenance_status: '' as ProvenanceStatus })).state).toBe('unverified');
  });

  it('fails closed to "unverified" for an unknown / off-SSOT value (CLOSED — only exact grounded passes)', () => {
    // A partial/unforeseen backend value must NEVER read as audit-passed.
    expect(provenanceBadge(rec({ statement_id: 's', provenance_status: 'partial' as ProvenanceStatus })).state).toBe('unverified');
    expect(provenanceBadge(rec({ statement_id: 's', provenance_status: 'GROUNDED' as ProvenanceStatus })).state).toBe('unverified');
    expect(provenanceBadge(rec({ statement_id: 's', provenance_status: 'grounded ' as ProvenanceStatus })).state).toBe('unverified');
  });
});

describe('GOV-314 provenance badge — render on the reviewer-internal lane', () => {
  let root: HTMLElement;
  beforeEach(() => {
    document.head.replaceChildren();
    document.body.replaceChildren();
    root = document.createElement('div');
    document.body.append(root);
  });

  const ready = (data: ReadApiResponse): void => render(root, resolved(data, 'fixture', isEmptyResponse));

  it('renders exactly one provenance badge per reviewer-internal record', () => {
    ready(
      resp([
        rec({ statement_id: 's1', provenance_status: 'grounded' }),
        rec({ statement_id: 's2', provenance_status: 'unverified' }),
        rec({ statement_id: 's3' }),
      ]),
    );
    const cards = root.querySelectorAll('[data-test="record-card"]');
    expect(cards.length).toBe(3);
    expect(root.querySelectorAll('[data-test="provenance-badge"]').length).toBe(3);
    for (const card of cards) {
      expect(card.querySelectorAll('[data-test="provenance-badge"]').length).toBe(1);
    }
  });

  it('shows the audit-passed badge ONLY for a "grounded" record (✓ + data-provenance)', () => {
    ready(resp([rec({ statement_id: 's1', provenance_status: 'grounded' })]));
    const badge = root.querySelector('[data-test="provenance-badge"]')!;
    expect(badge.getAttribute('data-provenance')).toBe('grounded');
    expect(badge.textContent).toContain('Audit-passed');
    expect(badge.textContent).toContain('✓');
  });

  it('renders the cautionary badge for an unverified record AND a record missing the field (fail-closed)', () => {
    ready(
      resp([
        rec({ statement_id: 's1', provenance_status: 'unverified' }),
        rec({ statement_id: 's2' }), // field absent on the reviewer-internal lane → fail-closed
      ]),
    );
    const badges = [...root.querySelectorAll('[data-test="provenance-badge"]')];
    expect(badges.length).toBe(2);
    for (const badge of badges) {
      expect(badge.getAttribute('data-provenance')).toBe('unverified');
      expect(badge.textContent).toContain('Unverified provenance');
      expect(badge.textContent).toContain('⚠');
    }
    // The fail-closed default never paints an affirmative "grounded".
    expect(root.querySelector('[data-provenance="grounded"]')).toBeNull();
  });

  it('is accessible: distinguished by icon + text (not colour-only) with a meaningful aria-label', () => {
    ready(resp([rec({ statement_id: 's1', provenance_status: 'grounded' })]));
    const badge = root.querySelector('[data-test="provenance-badge"]')!;
    // aria-label carries the state in words (a screen reader never relies on colour).
    expect(badge.getAttribute('aria-label')).toBe('Provenance: Audit-passed');
    // a title gives the plain-English meaning on hover/focus.
    expect((badge.getAttribute('title') ?? '').length).toBeGreaterThan(0);
    // the glyph is decorative (state already in text + aria-label) so it is hidden from AT.
    const icon = badge.querySelector('.gw-prov-icon')!;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.textContent).toBe('✓');
  });

  it('keeps the provenance badge DISTINCT from the ui_status trust badge (no data-test collision)', () => {
    ready(resp([rec({ statement_id: 's1', ui_status: 'source-backed', provenance_status: 'grounded' })]));
    const card = root.querySelector('[data-test="record-card"]')!;
    // Exactly one of each — the provenance verdict is separate from the publication-state badge.
    expect(card.querySelectorAll('[data-test="trust-badge"]').length).toBe(1);
    expect(card.querySelectorAll('[data-test="provenance-badge"]').length).toBe(1);
  });
});

describe('GOV-314 provenance badge — PUBLIC lane shows NO badge (0 occurrences)', () => {
  let root: HTMLElement;
  beforeEach(() => {
    document.head.replaceChildren();
    document.body.replaceChildren();
    root = document.createElement('div');
    document.body.append(root);
  });

  const ready = (data: ReadApiResponse): void => render(root, resolved(data, 'fixture', isEmptyResponse));

  it('renders 0 provenance badges when the response is not reviewer-internal', () => {
    // Even if a (malformed) public payload carried the field, the lane gate wins:
    // the client must never synthesize the provenance badge on the public lane.
    ready(resp([rec({ statement_id: 's1', provenance_status: 'grounded' })], 'public'));
    expect(root.querySelectorAll('[data-test="record-card"]').length).toBe(1);
    expect(root.querySelectorAll('[data-test="provenance-badge"]').length).toBe(0);
    // The ordinary trust badge still renders — only the provenance badge is lane-gated.
    expect(root.querySelector('[data-test="trust-badge"]')).not.toBeNull();
  });
});
