// @vitest-environment jsdom
//
// GOV-668 — Wave 3 pages: Issue Detail, Source Vault, and newsletter broadsheet
// re-skin. Pins reviewer-internal gating, mode persistence, honest-empty rows,
// and no unsupported metrics/alert generation on these pages.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIssueDetail, renderSourceVault } from '../src/ui/pages-program';
import { loadDigestResponse, renderNewsletterArchive, renderNewsletterDetail } from '../src/ui/newsletter';
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
  root = document.createElement('div');
  document.body.append(root);
});

describe('GOV-668 Issue Detail', () => {
  it('renders one reviewed statement URL as Simple dossier and Advanced proof rail', () => {
    const record = GRAPH_REAL.records![0];
    renderIssueDetail(root, GRAPH_REAL, new URLSearchParams(`id=${record.statement_id}`), 'real');
    expect(root.querySelector('[data-test="issue-dossier-card"]')?.getAttribute('data-id')).toBe(record.statement_id);
    expect(root.querySelector('[data-test="issue-statement"]')?.textContent).toContain(record.statement_text!.slice(0, 20));
    expect(root.querySelector('[data-test="issue-proof-rail"]')).toBeNull();

    root.querySelector<HTMLButtonElement>('[data-test="mode-advanced"]')!.click();
    expect(localStorage.getItem('gw-mode')).toBe('advanced');
    expect(root.querySelectorAll('[data-test="proof-source"]').length).toBe(record.evidence.length);
    expect(root.textContent).not.toMatch(/impact|confidence/i);
  });

  it('does not leak statement detail outside reviewer-internal access', () => {
    renderIssueDetail(root, { ...GRAPH_REAL, access: 'public' }, new URLSearchParams(), 'real');
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="issue-dossier-card"]')).toBeNull();
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
    expect(root.querySelectorAll('[data-test="source-vault-row"]').length).toBeGreaterThan(0);
    expect(root.querySelector('[data-test="source-ledger-empty"]')?.textContent).toContain('not wired yet');
    expect(root.querySelector('[data-test="source-alerts-empty"]')?.textContent).toContain('No live alert generation');
    expect(root.querySelector('[data-test="packet-diff-demo"]')).toBeNull();
  });

  it('shows packet diff only behind explicit demo/sample fixture banner', () => {
    renderSourceVault(root, GRAPH_REAL, new URLSearchParams('demo=sample'), 'sample');
    expect(root.querySelector('[data-test="fixture-banner"]')?.textContent).toContain('OFFLINE SAMPLE');
    expect(root.querySelector('[data-test="packet-diff-demo"]')?.textContent).toContain('Sample-only');
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
    expect(app.querySelector('[data-test="tab-source vault"]')?.getAttribute('aria-current')).toBe('page');

    window.location.hash = '#/sources?reviewer=1';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(app.querySelector('[data-test="source-vault-page"]')).not.toBeNull();
    expect(app.querySelector('[data-test="tab-source vault"]')?.getAttribute('aria-current')).toBe('page');
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
    expect(root.textContent).not.toMatch(/debate|lens/i);
  });
});
