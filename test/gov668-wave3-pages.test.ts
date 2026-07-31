// @vitest-environment jsdom
//
// GOV-668 — Wave 3 pages: Issue Detail, Source Vault, and newsletter broadsheet
// re-skin. Pins reviewer-internal gating, mode persistence, honest-empty rows,
// and no unsupported metrics/alert generation on these pages.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIssueDetail, renderSourceVault } from '../src/ui/pages-program';
import { DIFF_CODE_CHIP } from '../src/ui/diff-view';
import { assertWebSafe } from '../src/data/web-safe';
import { loadDigestResponse, renderNewsletterArchive, renderNewsletterDetail, renderNewsletterState } from '../src/ui/newsletter';
import type { ReadApiResponse } from '../src/types/read-api';
import graphRealData from '../src/fixtures/concept-graph-real.json';
import digestData from '../src/fixtures/alpine-newsletter-digest.json';

const GRAPH_REAL = graphRealData as unknown as ReadApiResponse;
const DIGEST = loadDigestResponse(digestData);

function stubLiveReviewerContext(statementId: string, sourceId: string) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify({
      reviewer_internal_records: [{
        statement_id: statementId,
        statement_text: `Live route sentinel ${statementId}`,
        ui_status: 'source-backed',
        verification_status: 'reviewed_source_linked',
        provenance_status: 'grounded',
        publication_state: 'publishable',
        produced_by: 'human',
        evidence: [{
          to_source_id: sourceId,
          verification_status: 'human_verified',
          original_url: `https://www.alpinewy.gov/${sourceId}`,
        }],
      }],
    }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

let root: HTMLElement;
let store: Record<string, string>;

beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
  store = {};
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      clear: () => { store = {}; },
    },
  });
  localStorage.setItem('gw_home_mode', 'advanced');
  root = document.createElement('div');
  document.body.append(root);
});

function expectRouteInfoNotes(required: readonly string[]): void {
  const triggers = [...root.querySelectorAll<HTMLButtonElement>('[data-info-note]')];
  const ids = triggers.map((node) => node.dataset.infoNote!);
  const labels = triggers.map((node) => node.getAttribute('aria-label'));
  const panelIds = triggers.map((node) => node.getAttribute('aria-controls'));

  expect([...ids].sort()).toEqual([...required].sort());
  expect(new Set(labels).size).toBe(labels.length);
  expect(new Set(panelIds).size).toBe(panelIds.length);
  for (const panelId of panelIds) {
    expect(panelId).toBeTruthy();
    const panel = root.querySelector<HTMLElement>(`#${panelId}`);
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain('What this is');
    expect(panel?.textContent).toContain('Filled from');
    expect(panel?.textContent).toContain('Filed under');
    expect(panel?.textContent).toContain('Current state');
    expect(panel?.textContent).toContain('Expected result');
  }
}

describe('GOV-668 Issue Detail', () => {
  it('keeps the complete trust bundle and source receipts in both Simple and Advanced', () => {
    localStorage.setItem('gw_home_mode', 'simple');
    const record = GRAPH_REAL.records![0];
    renderIssueDetail(root, GRAPH_REAL, new URLSearchParams(`id=${record.statement_id}`), 'real');
    expect(root.querySelector('[data-test="issue-dossier-card"]')?.getAttribute('data-id')).toBe(record.statement_id);
    expect(root.querySelector('[data-test="issue-statement"]')?.textContent).toContain(record.statement_text!.slice(0, 20));
    expect(root.querySelector('[data-test="issue-publication"]')?.textContent).toContain(record.publication_state!.replace(/_/g, ' '));
    expect(root.querySelector('[data-test="issue-correction"]')).not.toBeNull();
    expect(root.querySelector('[data-test="issue-source-changed"]')).not.toBeNull();
    expect(root.querySelector('[data-test="issue-provenance"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="proof-source"]').length).toBe(record.evidence.length);

    expect(root.querySelector('[data-test="mode-toggle"]')).toBeNull();
    localStorage.setItem('gw_home_mode', 'advanced');
    renderIssueDetail(root, GRAPH_REAL, new URLSearchParams(`id=${record.statement_id}`), 'real');
    expect(localStorage.getItem('gw_home_mode')).toBe('advanced');
    expect(root.querySelectorAll('[data-test="proof-source"]').length).toBe(record.evidence.length);
    expect(root.querySelector('[data-test="issue-confidence"]')?.textContent).toContain(String(record.confidence));
    expect(root.textContent).not.toMatch(/impact/i);
  });

  it('does not mark reviewed issue detail as a fixture for an unsupported demo flag', () => {
    renderIssueDetail(root, GRAPH_REAL, new URLSearchParams('demo=sample'), 'real');
    expect(root.querySelector('[data-test="fixture-banner"]')).toBeNull();
    expect(root.querySelector('[data-test="issue-dossier-card"]')).not.toBeNull();
  });

  it('keeps overview, supplied trust, and proof explanations in both Issue modes', () => {
    const required = ['issue-overview', 'issue-trust', 'issue-proof'];
    const record = GRAPH_REAL.records![0];
    for (const mode of ['simple', 'advanced'] as const) {
      localStorage.setItem('gw_home_mode', mode);
      renderIssueDetail(root, GRAPH_REAL, new URLSearchParams(`id=${record.statement_id}`), 'real');
      expectRouteInfoNotes(required);
      const trustTrigger = root.querySelector<HTMLButtonElement>('[data-info-note="issue-trust"]')!;
      const trustPanel = root.querySelector<HTMLElement>(
        `#${trustTrigger.getAttribute('aria-controls')}`,
      );
      expect(trustPanel?.textContent).toContain('never calculates confidence');
      expect(trustPanel?.textContent).toContain('not a verdict');
    }
  });

  it('does not leak statement detail outside reviewer-internal access', () => {
    renderIssueDetail(root, { ...GRAPH_REAL, access: 'public' }, new URLSearchParams(), 'reviewer capture notice');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="issue-dossier-card"]')).toBeNull();
    expect(root.querySelector('[data-test="source-notice"]')).toBeNull();
    expect(root.querySelector('[data-info-note]')).toBeNull();
    expect(root.textContent).not.toContain('Issue research · Trust bundle');
  });

  it('missing id is honest-empty, never a fabricated dossier', () => {
    renderIssueDetail(root, GRAPH_REAL, new URLSearchParams('id=nope'), 'real');
    expect(root.querySelector('[data-test="issue-missing"]')?.textContent).toContain('not found');
    expect(root.querySelector('[data-test="issue-dossier-card"]')).toBeNull();
    expectRouteInfoNotes(['issue-overview', 'issue-missing']);
  });
});

describe('GOV-668 Source Vault', () => {
  it('dedupes real source metadata and keeps ledger/alerts honest-empty', () => {
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="mode-toggle"]')).toBeNull();
    expect(root.querySelector('[data-test="source-vault-advanced-workbench"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="source-vault-row"]').length).toBeGreaterThan(0);
    expect(root.querySelector('[data-test="source-reviewed-count"]')).not.toBeNull();
    expect(root.querySelector('[data-test="source-hash-gap"]')?.textContent).toContain('Unavailable');
    expect(root.querySelector('[data-test="source-flags-gap"]')?.textContent).toContain('no flag count is inferred');
    expect(root.querySelector('[data-test="source-version-compare-empty"]')?.textContent).toContain('not wired yet');
    expect(root.querySelector('[data-test="source-ledger-empty"]')?.textContent).toContain('not wired yet');
    expect(root.querySelector('[data-test="source-video-status-empty"]')?.textContent).toContain('not wired yet');
    expect(root.querySelector('[data-test="source-alerts-empty"]')?.textContent).toContain('No live alert generation');
    expect(root.querySelector('[data-test="source-verification-details"]')?.textContent).toContain('Link presence alone does not establish');
    expect(root.querySelector('[data-test="source-third-party-verification-empty"]')?.textContent).toContain('Third-party verification unavailable');
    expect(root.querySelector('[data-test="packet-diff-demo"]')).toBeNull();
  });

  it('keeps the source rows and every verification gap in the Simple reading composition', () => {
    localStorage.setItem('gw_home_mode', 'simple');
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="mode-toggle"]')).toBeNull();

    expect(root.querySelector('[data-test="source-vault-simple-edition"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="source-vault-row"]').length).toBeGreaterThan(0);
    expect(root.querySelector('[data-test="source-version-compare-empty"]')).not.toBeNull();
    expect(root.querySelector('[data-test="source-third-party-verification-empty"]')).not.toBeNull();
  });

  it('keeps every Source Vault control, calculation, source, and gap note in both modes', () => {
    const required = [
      'vault-overview',
      'vault-source-count',
      'vault-filters',
      'vault-source-rows',
      'vault-diff',
      'vault-ledger',
      'vault-video',
      'vault-transparency',
      'vault-verification',
      // GOV-90: the three stat explainers now use the SHARED info-note primitive
      // (hover + click-to-pin + Escape + focus restore) instead of a bespoke <details>
      // disclosure, so they join the route's info-note inventory.
      'source-stat-source-count',
      'source-stat-hash-verification',
      'source-stat-open-flags',
    ];
    for (const mode of ['simple', 'advanced'] as const) {
      localStorage.setItem('gw_home_mode', mode);
      renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real');
      expectRouteInfoNotes(required);
      const countTrigger = root.querySelector<HTMLButtonElement>(
        '[data-info-note="vault-source-count"]',
      )!;
      const countPanel = root.querySelector<HTMLElement>(
        `#${countTrigger.getAttribute('aria-controls')}`,
      );
      expect(countPanel?.textContent).toContain('VAULT-RECEIPT-DEDUP/v1');
      expect(countPanel?.textContent).toContain('to_source_id, original_url, archive_url');
      expect(countPanel?.textContent).toContain('per-record fallback key');

      const verificationTrigger = root.querySelector<HTMLButtonElement>(
        '[data-info-note="vault-verification"]',
      )!;
      const verificationPanel = root.querySelector<HTMLElement>(
        `#${verificationTrigger.getAttribute('aria-controls')}`,
      );
      expect(verificationPanel?.textContent).toContain('VAULT-LINK-PRESENCE/v1');
      expect(verificationPanel?.textContent).toContain('no verification percentage denominator');
    }
  });

  it('preserves the search, compare, ledger, video, manifest, and verification geometry in both modes', () => {
    const contractGapIds = [
      'source-vault-filter-gap',
      'source-hash-gap',
      'source-flags-gap',
      'source-version-compare-empty',
      'source-ledger-empty',
      'source-video-status-empty',
      'source-alerts-empty',
      'source-third-party-verification-empty',
      'source-manifest-empty',
    ];
    const contractSnapshot = () => ({
      sourceRows: [...root.querySelectorAll<HTMLElement>('[data-test="source-vault-row"]')]
        .map((node) => `${node.dataset.sourceId}:${node.textContent}`),
      stats: [...root.querySelectorAll<HTMLElement>('[data-test="source-vault-overview"] > article')]
        .map((node) => node.textContent),
      tools: [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
        '[data-test="source-vault-tools"] :disabled, [data-test="source-version-compare-empty"] :disabled, [data-test="source-ledger-empty"] :disabled, [data-test="source-alerts-empty"] :disabled, [data-test="source-verification-tools"] :disabled',
      )].map((node) => `${node.tagName}:${node.getAttribute('placeholder') ?? node.textContent}`).sort(),
      gaps: contractGapIds.map((id) => root.querySelector(`[data-test="${id}"]`)?.textContent),
    });

    renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="source-vault-advanced-workbench"] .gw-vault-contract-advanced-layout')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="source-vault-tools"] :disabled')).toHaveLength(3);
    // GOV-90: was three <details> disclosures; now three shared info-note triggers with
    // hover preview and click-to-pin, per the baseline's specified interaction.
    for (const id of ['source-stat-source-count', 'source-stat-hash-verification', 'source-stat-open-flags']) {
      expect(root.querySelectorAll(`[data-info-note="${id}"]`), id).toHaveLength(1);
    }
    expect(root.querySelectorAll('[data-test="source-stat-explainer"]')).toHaveLength(0);
    expect(root.querySelectorAll('[data-test="source-version-selectors"] select:disabled')).toHaveLength(2);
    expect(root.querySelector('[data-test="source-word-diff-tool"]:disabled')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="source-diff-panes"] > article')).toHaveLength(2);
    expect(root.querySelectorAll('[data-test="source-diff-tools"] button:disabled')).toHaveLength(3);
    expect(root.querySelectorAll('[data-test="source-video-ladder"] > span')).toHaveLength(3);
    expect(root.querySelector('[data-test="source-ledger-tool"]:disabled')).not.toBeNull();
    expect(root.querySelector('[data-test="source-manifest-tool"]:disabled')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="source-verification-tools"] button:disabled')).toHaveLength(3);
    const advanced = contractSnapshot();

    localStorage.setItem('gw_home_mode', 'simple');
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="source-vault-simple-edition"]')).not.toBeNull();
    expect(root.querySelector('.gw-vault-contract-advanced-layout')).toBeNull();
    expect(contractSnapshot()).toEqual(advanced);
  });

  it('shows packet diff only behind explicit demo/sample fixture banner', () => {
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams('demo=sample'), 'sample');
    expect(root.querySelector('[data-test="fixture-banner"]')?.textContent).toContain('OFFLINE SAMPLE');
    expect(root.querySelector('[data-test="packet-diff-demo"]')?.textContent).toContain('Sample-only');
  });

  it('does not expose Source Vault origin or fixture notices before public-lane admission', () => {
    renderSourceVault(root, { ...GRAPH_REAL, access: 'public' }, new URLSearchParams('demo=sample'), 'reviewer capture notice');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="source-notice"]')).toBeNull();
    expect(root.querySelector('[data-test="fixture-banner"]')).toBeNull();
    expect(root.querySelector('[data-test="source-vault-row"]')).toBeNull();
    expect(root.querySelector('[data-info-note]')).toBeNull();
    expect(root.textContent).not.toContain('Current-response statistics');
  });

  it('does not leak source rows outside reviewer-internal access', () => {
    renderSourceVault(root, { ...GRAPH_REAL, access: 'public' }, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="source-vault-row"]')).toBeNull();
    expect(root.querySelector('[data-info-note]')).toBeNull();
  });

  it('is registered at canonical #/vault, with #/sources retained only as an alias', async () => {
    vi.resetModules();
    document.body.replaceChildren();
    const app = document.createElement('div');
    app.id = 'app';
    document.body.append(app);
    const fetchMock = stubLiveReviewerContext('vault-live-sentinel', 'vault-live-source');
    const routeNoteIds = () => [...app.querySelectorAll<HTMLElement>(
      '[data-test="source-vault-page"] [data-info-note]',
    )].map((node) => node.dataset.infoNote).sort();
    const expectedNoteIds = [
      'vault-overview',
      'vault-source-count',
      'vault-filters',
      'vault-source-rows',
      'vault-diff',
      'vault-ledger',
      'vault-video',
      'vault-transparency',
      'vault-verification',
      // GOV-90: the stat explainers joined the route's info-note inventory when they
      // adopted the shared hover/click-to-pin primitive.
      'source-stat-source-count',
      'source-stat-hash-verification',
      'source-stat-open-flags',
    ].sort();

    window.location.hash = '#/vault?reviewer=1';
    await import('../src/main');
    await vi.waitFor(() => {
      expect(
        app.querySelector('[data-test="source-vault-row"][data-source-id="vault-live-source"]'),
      ).not.toBeNull();
    });
    expect(app.querySelector('[data-test="tab-source-vault"]')?.getAttribute('aria-current')).toBe('page');
    expect(routeNoteIds()).toEqual(expectedNoteIds);
    expect(fetchMock.mock.calls.filter(
      (call) => (call as unknown[])[0] === '/api/reviewer-internal',
    ))
      .toHaveLength(1);

    window.location.hash = '#/sources?reviewer=1';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => {
      expect(
        app.querySelector('[data-test="source-vault-row"][data-source-id="vault-live-source"]'),
      ).not.toBeNull();
    });
    expect(app.querySelector('[data-test="tab-source-vault"]')?.getAttribute('aria-current')).toBe('page');
    expect(routeNoteIds()).toEqual(expectedNoteIds);
    expect(fetchMock.mock.calls.filter(
      (call) => (call as unknown[])[0] === '/api/reviewer-internal',
    ))
      .toHaveLength(1);
  });

  it('keeps canonical #/vault fail-closed before the reviewer gate', async () => {
    vi.resetModules();
    document.body.replaceChildren();
    const app = document.createElement('div');
    app.id = 'app';
    document.body.append(app);

    window.location.hash = '#/vault?gate=denied';
    await import('../src/main');
    expect(app.querySelector('[data-test="gated-app"]')).not.toBeNull();
    expect(app.querySelector('[data-test="source-vault-row"]')).toBeNull();
    expect(app.querySelector('[data-test="source-vault-page"]')).toBeNull();
  });
});

describe('GOV-668 newsletter broadsheet re-skin', () => {
  it('keeps the archive/detail data contract while applying the weekly broadsheet copy', () => {
    renderNewsletterArchive(root, DIGEST, 'real');
    expect(root.querySelector('[data-test="newsletter-archive"]')?.textContent).toContain('Weekly broadsheet');
    expect(root.querySelectorAll('[data-test="archive-row"]').length).toBe(DIGEST.digests.length);

    renderNewsletterDetail(root, DIGEST, DIGEST.digests[0].newsletterId, 'real');
    expect(root.querySelector('[data-test="newsletter-detail"]')?.textContent).toContain('Weekly broadsheet');
    expect(root.querySelector('[data-test="section-processedRecords"]')).not.toBeNull();
    expect(root.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(root.querySelector('[data-test="newsletter-reviewed-origin"]')?.textContent).not.toMatch(/synthetic|fixture/i);
    expect(root.querySelector('[data-test="source-verification-status"]')?.textContent).toBe('Verification: human_verified');
    expect(root.querySelector('[data-test="source-scan-date"]')?.textContent).toBe('Scanned: 2026-05-01');
    expect(root.querySelector('[data-test="source-page"]')?.textContent).toBe('Page: 1');
  });

  it.each(['simple', 'advanced'] as const)('retains every designed newsletter slot as an honest gap in %s mode', (mode) => {
    localStorage.setItem('gw_home_mode', mode);
    const digest = DIGEST.digests[0];
    renderNewsletterDetail(root, DIGEST, digest.newsletterId, 'real');

    expect(root.getAttribute('data-mode')).toBe(mode);
    for (const testId of [
      'newsletter-meeting-pair-board',
      'newsletter-roundtable',
      'newsletter-agenda-feature',
      'newsletter-agenda-full',
      'newsletter-agenda-diffs',
      'newsletter-language-watch',
      'newsletter-question-checklist',
      'newsletter-six-lens-grid',
      'newsletter-meeting-ledger',
      'newsletter-history-lookback',
      'newsletter-publication-honesty',
      'newsletter-delivery-unavailable',
    ]) {
      expect(root.querySelector(`[data-test="${testId}"]`), testId).not.toBeNull();
      expect(root.querySelector(`[data-test="${testId}"]`)?.getAttribute('data-state'), testId).toBe('unavailable');
    }
    const referenceRail = root.querySelector('[data-test="newsletter-reference-rail"]');
    expect(referenceRail?.getAttribute('data-state')).toBe('supplied');
    expect(referenceRail?.getAttribute('data-origin')).toBe('reviewed-response');
    expect(referenceRail?.querySelectorAll('[data-test="newsletter-reference"]')).toHaveLength(
      digest.sections.sourceTrail.length,
    );
    expect(root.querySelectorAll('[data-test="newsletter-lens-slot"]')).toHaveLength(6);
    expect(root.querySelectorAll('[data-test="newsletter-roundtable"] button:disabled')).toHaveLength(6);
    expect(root.querySelector('[data-test="newsletter-roundtable-progress"]')).not.toBeNull();
    expect(root.querySelector('[data-test="newsletter-agenda-tools"]')).not.toBeNull();
    expect(root.querySelector('[data-test="newsletter-detail-archive"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="newsletter-detail-archive-row"]')).toHaveLength(DIGEST.digests.length);
    expect(root.querySelector(`[data-test="newsletter-${mode === 'simple' ? 'simple-edition' : 'advanced-workbench'}"]`)).not.toBeNull();
    expect(root.querySelector(`[data-test="newsletter-${mode === 'simple' ? 'advanced-workbench' : 'simple-edition'}"]`)).toBeNull();

    // The baseline slots are additive: all supplied digest rows and typed empty
    // states remain rendered verbatim beneath them.
    expect(root.querySelectorAll('[data-test="section-processedRecords"] [data-test="item-row"]')).toHaveLength(
      digest.sections.processedRecords.itemIds.length,
    );
    expect(root.querySelector('[data-test="section-empty-keyMeetings"]')).not.toBeNull();
  });

  it('fails closed before resolving newsletter rows outside reviewer_internal', () => {
    const publicDigest = { ...DIGEST, access: 'public' };
    renderNewsletterArchive(root, publicDigest, 'must not render');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="archive-row"]')).toBeNull();
    expect(root.querySelector('[data-test="newsletter-reviewed-origin"]')).toBeNull();

    renderNewsletterDetail(root, publicDigest, DIGEST.digests[0].newsletterId, 'must not render');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="item-row"]')).toBeNull();
    expect(root.querySelector('[data-test="newsletter-detail"]')).toBeNull();

    renderNewsletterState(root, 'loading', 'public');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="newsletter-state"]')).toBeNull();
  });

  it('retains supplied source section and timestamp locator fields', () => {
    const response = structuredClone(DIGEST);
    response.digests[0].sections.sourceTrail[0].section = 'Budget overview';
    response.digests[0].sections.sourceTrail[0].timestampSeconds = 125;
    renderNewsletterDetail(root, response, response.digests[0].newsletterId);

    expect(root.querySelector('[data-test="source-section"]')?.textContent).toBe('Section: Budget overview');
    expect(root.querySelector('[data-test="source-timestamp"]')?.textContent).toBe('Timestamp: 125s');
  });

  it('shows the detailed live projection gap by default and the archive only in demo=snapshot', async () => {
    vi.resetModules();
    document.body.replaceChildren();
    const app = document.createElement('div');
    app.id = 'app';
    document.body.append(app);
    const fetchMock = stubLiveReviewerContext('newsletter-live-sentinel', 'newsletter-live-source');
    window.history.replaceState(null, '', '#/newsletter?reviewer=1');

    await import('../src/main');

    expect(app.querySelector('[data-test="app-shell"]')).not.toBeNull();
    await vi.waitFor(() => {
      expect(
        app.querySelector('[data-test="reviewer-projection-gap"][data-projection="newsletter-digest"]'),
      ).not.toBeNull();
    });
    const gap = app.querySelector('[data-projection="newsletter-digest"]');
    expect(gap?.textContent).toContain('Not available yet');
    expect(gap?.textContent).toContain('What this will do');
    expect(gap?.textContent).toContain('Required backend projection');
    expect(gap?.textContent).toContain('How it will work');
    expect(gap?.textContent).toContain('Expected result');
    expect(app.querySelector('[data-test="archive-row"]')).toBeNull();
    expect(fetchMock.mock.calls.filter(
      (call) => (call as unknown[])[0] === '/api/reviewer-internal',
    ))
      .toHaveLength(1);

    window.location.hash = '#/newsletter?reviewer=1&demo=snapshot';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => {
      expect(app.querySelectorAll('[data-test="archive-row"]')).toHaveLength(DIGEST.digests.length);
    });
    expect(app.querySelector('[data-projection="newsletter-digest"]')).toBeNull();
    expect(fetchMock.mock.calls.filter(
      (call) => (call as unknown[])[0] === '/api/reviewer-internal',
    ))
      .toHaveLength(1);
  });
});

// GOV-82 — the deterministic diff primitive wired into Source Vault version compare.
//
// `src/ui/diff-view.ts` held the LCS diff and DIFF_CODE_CHIP from the start, but NOTHING
// in src/ imported it — its only consumer was its own test, so the primitive could drift
// from the baseline with a fully green suite. These tests pin the wiring and the lanes.
describe('GOV-82 Source Vault version compare', () => {
  const FIXTURE_STRINGS = ['SYNTHETIC DOCUMENT TEXT', 'synthetic capture 09:00'];

  it('reviewed lane with no supplied versions still renders the unavailable state', () => {
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="source-version-compare-empty"]')).not.toBeNull();
    expect(root.querySelector('[data-test="source-version-compare-fixture"]')).toBeNull();
    expect(root.querySelector('[data-test="diff-view"]')).toBeNull();
    for (const s of FIXTURE_STRINGS) expect(root.textContent, s).not.toContain(s);
    // The disabled controls the reviewed lane still owns.
    expect(root.querySelector('[data-test="source-word-diff-tool"]:disabled')).not.toBeNull();
  });

  it('fixture lane renders the real diff primitive under the banner', () => {
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real', null, null, true);
    const panel = root.querySelector('[data-test="source-version-compare-fixture"]');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('data-origin')).toBe('fixture');
    expect(root.querySelector('[data-test="source-version-compare-empty"]')).toBeNull();

    // It is the shared primitive, not a second implementation.
    expect(root.querySelector('[data-test="diff-view"]')).not.toBeNull();
    // Assert the LITERAL, not the constant. `toBe(DIFF_CODE_CHIP)` compares the rendered
    // chip against the same value it came from — a tautology that stays green if the
    // constant is changed to anything at all. Caught by red proof (GOV-82).
    expect(root.querySelector('[data-test="diff-code-chip"]')?.textContent).toBe('100% CODE — NO AI');
    // And the constant is what the panel renders, so a drift in either is caught.
    expect(DIFF_CODE_CHIP).toBe('100% CODE — NO AI');
    expect(root.querySelector('[data-test="source-version-compare-fixture-banner"]')?.textContent)
      .toContain('SYNTHETIC DESIGN FIXTURE — not a live read');
  });

  it('names both versions with their times and labels added/removed in text, not colour alone', () => {
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real', null, null, true);
    expect(root.querySelector('[data-test="diff-pane-before"] h4')?.textContent)
      .toBe('VERSION 1 · synthetic capture 09:00');
    expect(root.querySelector('[data-test="diff-pane-after"] h4')?.textContent)
      .toBe('VERSION 2 · synthetic capture 14:30');

    const key = root.querySelector('[data-test="diff-key"]');
    expect(key).not.toBeNull();
    expect(key?.textContent).toContain('Added');
    expect(key?.textContent).toContain('Removed');
  });

  it('word-level toggle is operable on the fixture path', () => {
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real', null, null, true);
    const toggle = root.querySelector<HTMLButtonElement>('[data-test="diff-word-toggle"]')!;
    expect(toggle.disabled).toBe(false);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(root.querySelectorAll('.gw-diff-body ins, .gw-diff-body del')).toHaveLength(0);

    toggle.click();
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelectorAll('.gw-diff-body ins, .gw-diff-body del').length).toBeGreaterThan(0);
  });

  it('renders no hash, local path, or private locator, and stays web-safe', () => {
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real', null, null, true);
    const text = root.textContent ?? '';
    expect(text).not.toMatch(/raw_sha256|sha256|[0-9a-f]{40,}/i);
    expect(text).not.toMatch(/\/Users\/|file:\/\/|localSourcePath/);
    expect(() => assertWebSafe(GRAPH_REAL)).not.toThrow();
  });

  it('public lane renders no fixture string', () => {
    renderSourceVault(root, { ...GRAPH_REAL, access: 'public' }, new URLSearchParams(), 'real', null, null, true);
    expect(root.querySelector('[data-test="source-version-compare-fixture"]')).toBeNull();
    expect(root.querySelector('[data-test="diff-view"]')).toBeNull();
    for (const s of FIXTURE_STRINGS) expect(root.textContent, s).not.toContain(s);
  });
});

// GOV-90 — Source Vault stat explainers adopt the shared hover/click-to-pin primitive.
//
// The baseline specifies "hover explainer cards + click-to-pin detail panels". The slot
// had substituted a native <details> disclosure — accessible and honest, but a silent,
// unrecorded divergence. Resolved by adopting the primitive #53/#62 landed rather than
// building a second overlay system.
describe('GOV-90 Source Vault stat explainers', () => {
  const STAT_NOTES = [
    'source-stat-source-count',
    'source-stat-hash-verification',
    'source-stat-open-flags',
  ] as const;

  it('renders all three as shared info-note triggers, not <details> disclosures', () => {
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real');
    for (const id of STAT_NOTES) {
      expect(root.querySelectorAll(`[data-info-note="${id}"]`), id).toHaveLength(1);
    }
    expect(root.querySelector('[data-test="source-stat-explainer"]')).toBeNull();
    expect(root.querySelector('.gw-vault-contract-stat-explainer')).toBeNull();
  });

  it('gives each stat a distinct accessible name', () => {
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real');
    const labels = STAT_NOTES.map((id) =>
      root.querySelector(`[data-info-note="${id}"]`)?.getAttribute('aria-label'));
    for (const label of labels) expect(label).toBeTruthy();
    // Three panels all reading "What this stat means" would be indistinguishable to a
    // screen-reader user. Each carries its own stat context.
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('click toggles a pinned panel, and Escape closes it', () => {
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real');
    const trigger = root.querySelector<HTMLButtonElement>(`[data-info-note="${STAT_NOTES[0]}"]`)!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('preserves the explainer copy verbatim — the sentence that bounds the RV count', () => {
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real');
    const trigger = root.querySelector<HTMLButtonElement>(`[data-info-note="${STAT_NOTES[0]}"]`)!;
    trigger.click();
    const panelId = trigger.getAttribute('aria-controls')!;
    const panel = document.getElementById(panelId);
    expect(panel?.textContent).toContain(
      'It is not a count of every file in a full source registry.',
    );
    trigger.click();
  });

  it('adds no stat value, percentage, or flag count of its own', () => {
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams(), 'real');
    for (const id of STAT_NOTES) {
      const trigger = root.querySelector<HTMLButtonElement>(`[data-info-note="${id}"]`)!;
      trigger.click();
      const panel = document.getElementById(trigger.getAttribute('aria-controls')!);
      expect(panel?.textContent, id).not.toMatch(/\b\d+%/);
      trigger.click();
    }
  });
});
