// @vitest-environment jsdom
//
// GOV-668 — Wave 3 pages: Issue Detail, Source Vault, and newsletter broadsheet
// re-skin. Pins reviewer-internal gating, mode persistence, honest-empty rows,
// and no unsupported metrics/alert generation on these pages.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIssueDetail, renderSourceVault } from '../src/ui/pages-program';
import { loadDigestResponse, renderNewsletterArchive, renderNewsletterDetail, renderNewsletterState } from '../src/ui/newsletter';
import type { ReadApiResponse } from '../src/types/read-api';
import graphRealData from '../src/fixtures/concept-graph-real.json';
import digestData from '../src/fixtures/alpine-newsletter-digest.json';

const GRAPH_REAL = graphRealData as unknown as ReadApiResponse;
const DIGEST = loadDigestResponse(digestData);

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

  it('does not leak statement detail outside reviewer-internal access', () => {
    renderIssueDetail(root, { ...GRAPH_REAL, access: 'public' }, new URLSearchParams(), 'reviewer capture notice');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="issue-dossier-card"]')).toBeNull();
    expect(root.querySelector('[data-test="source-notice"]')).toBeNull();
  });

  it('missing id is honest-empty, never a fabricated dossier', () => {
    renderIssueDetail(root, GRAPH_REAL, new URLSearchParams('id=nope'), 'real');
    expect(root.querySelector('[data-test="issue-missing"]')?.textContent).toContain('not found');
    expect(root.querySelector('[data-test="issue-dossier-card"]')).toBeNull();
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
    expect(root.querySelectorAll('[data-test="source-stat-explainer"]')).toHaveLength(3);
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
  });

  it('does not leak source rows outside reviewer-internal access', () => {
    renderSourceVault(root, { ...GRAPH_REAL, access: 'public' }, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="source-vault-row"]')).toBeNull();
  });

  it('is registered at canonical #/vault, with #/sources retained only as an alias', async () => {
    vi.resetModules();
    document.body.replaceChildren();
    const app = document.createElement('div');
    app.id = 'app';
    document.body.append(app);

    window.location.hash = '#/vault?reviewer=1';
    await import('../src/main');
    expect(app.querySelector('[data-test="source-vault-page"]')).not.toBeNull();
    expect(app.querySelector('[data-test="tab-source-vault"]')?.getAttribute('aria-current')).toBe('page');

    window.location.hash = '#/sources?reviewer=1';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(app.querySelector('[data-test="source-vault-page"]')).not.toBeNull();
    expect(app.querySelector('[data-test="tab-source-vault"]')?.getAttribute('aria-current')).toBe('page');
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

  it('keeps #/newsletter?reviewer=1&access=public inside the shell but renders zero civic records', async () => {
    vi.resetModules();
    document.body.replaceChildren();
    const app = document.createElement('div');
    app.id = 'app';
    document.body.append(app);
    window.location.hash = '#/newsletter?reviewer=1&access=public';

    await import('../src/main');

    expect(app.querySelector('[data-test="app-shell"]')).not.toBeNull();
    expect(app.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(app.querySelector('[data-test="archive-row"]')).toBeNull();
    expect(app.querySelector('[data-test="newsletter-reviewed-origin"]')).toBeNull();
  });
});
