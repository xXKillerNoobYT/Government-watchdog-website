// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hostedReviewerAccessActive,
  SITES_ACCESS_META,
  SITES_PRIVATE_BETA_META,
  SITES_PRIVATE_BETA_VALUE,
  SITES_PRODUCTION_HOST,
} from '../src/gate/hosted-access';

const REVIEWER_ENVELOPE = {
  reviewer_internal_records: [{
    statement_id: 'server-home-record',
    statement_text: 'The Alpine Town Council approved the published minutes.',
    ui_status: 'source-backed',
    verification_status: 'human_verified',
    provenance_status: 'grounded',
    publication_state: 'publishable',
    produced_by: 'human',
    evidence: [{
      to_source_id: 'server-home-source',
      relation: 'supports',
      original_url: 'https://www.alpinewy.gov/server-home-source',
      verification_status: 'human_verified',
    }],
  }],
};

function reviewerFetch(): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify(REVIEWER_ENVELOPE),
  })) as unknown as typeof fetch;
}

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, String(value)),
  };
}

function addAccessMeta(content: string, name = SITES_ACCESS_META): void {
  const meta = document.createElement('meta');
  meta.name = name;
  meta.content = content;
  document.head.append(meta);
}

beforeEach(() => {
  vi.resetModules();
  document.head.replaceChildren();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('fetch', reviewerFetch());
  localStorage.setItem('gw_home_mode', 'advanced');
  const root = document.createElement('div');
  root.id = 'app';
  document.body.append(root);
});

describe('Sites authenticated-owner entry', () => {
  it('accepts only the exact worker-injected boolean marker on any host', () => {
    expect(hostedReviewerAccessActive()).toBe(false);
    addAccessMeta('pending');
    expect(hostedReviewerAccessActive()).toBe(false);
    document.head.replaceChildren();
    addAccessMeta('approved');
    expect(hostedReviewerAccessActive()).toBe(true);
  });

  it('accepts the private build marker only on the exact owner-only production host', () => {
    addAccessMeta(SITES_PRIVATE_BETA_VALUE, SITES_PRIVATE_BETA_META);

    expect(hostedReviewerAccessActive()).toBe(false);
    expect(hostedReviewerAccessActive(document, { hostname: 'example.test' })).toBe(false);
    expect(hostedReviewerAccessActive(document, { hostname: SITES_PRODUCTION_HOST })).toBe(true);

    document.head.replaceChildren();
    addAccessMeta('public', SITES_PRIVATE_BETA_META);
    expect(hostedReviewerAccessActive(document, { hostname: SITES_PRODUCTION_HOST })).toBe(false);
  });

  it('opens Home for an admitted owner while preserving explicit gate overrides', async () => {
    addAccessMeta('approved');
    window.location.hash = '#/';
    await import('../src/main');

    await vi.waitFor(() => expect(window.location.hash).toBe('#/home'));
    await vi.waitFor(() => {
      expect(document.querySelector('[data-test="app-shell"]')).not.toBeNull();
      expect(document.querySelector('[data-test="home-live-advanced"]')).not.toBeNull();
      expect(document.querySelector('[data-test="home-live-record"][data-record-id="server-home-record"]'))
        .not.toBeNull();
    });

    window.location.hash = '#/home?gate=denied';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(document.querySelector('[data-test="gate-panel"]')?.getAttribute('data-state')).toBe('denied');
    expect(document.querySelector('[data-test="app-shell"]')).toBeNull();
  });
});
