// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hostedReviewerAccessActive,
  SITES_ACCESS_META,
} from '../src/gate/hosted-access';

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

function addAccessMeta(content: string): void {
  const meta = document.createElement('meta');
  meta.name = SITES_ACCESS_META;
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
  const root = document.createElement('div');
  root.id = 'app';
  document.body.append(root);
});

describe('Sites authenticated-owner entry', () => {
  it('accepts only the exact worker-injected boolean marker', () => {
    expect(hostedReviewerAccessActive()).toBe(false);
    addAccessMeta('pending');
    expect(hostedReviewerAccessActive()).toBe(false);
    document.head.replaceChildren();
    addAccessMeta('approved');
    expect(hostedReviewerAccessActive()).toBe(true);
  });

  it('opens Home for an admitted owner while preserving explicit gate overrides', async () => {
    addAccessMeta('approved');
    window.location.hash = '#/';
    await import('../src/main');

    await vi.waitFor(() => expect(window.location.hash).toBe('#/home'));
    await vi.waitFor(() => {
      expect(document.querySelector('[data-test="app-shell"]')).not.toBeNull();
      expect(document.querySelector('[data-test="home-grid"]')).not.toBeNull();
    });

    window.location.hash = '#/home?gate=denied';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(document.querySelector('[data-test="gate-panel"]')?.getAttribute('data-state')).toBe('denied');
    expect(document.querySelector('[data-test="app-shell"]')).toBeNull();
  });
});
