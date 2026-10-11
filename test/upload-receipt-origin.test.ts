// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

function banner(): Element | null {
  return document.querySelector('[data-test="shell-origin-banner"]');
}

function go(hash: string): void {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

beforeEach(() => {
  vi.resetModules();
  document.head.replaceChildren();
  document.body.replaceChildren();
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('upload origin test must not read a live response');
  }));
  localStorage.setItem('gw_home_mode', 'advanced');
  const root = document.createElement('div');
  root.id = 'app';
  document.body.append(root);
});

describe('issue #293 simulated upload receipt origin', () => {
  it('labels a forced receipt as a fixture and keeps the ordinary upload route live', async () => {
    window.location.hash = '#/upload?reviewer=1&ustate=received';
    await import('../src/main');

    const received = banner();
    expect(received?.getAttribute('data-origin')).toBe('fixture');
    expect(received?.getAttribute('role')).toBe('status');
    expect(received?.textContent).toContain('SYNTHETIC DESIGN FIXTURE');
    expect(received?.textContent).toContain('visual-review sample');
    expect(received?.textContent).toContain('not a live read');
    expect(received?.textContent).not.toContain('LIVE SERVER CONTEXT');
    expect(received?.textContent).not.toContain('no captured fallback');
    expect(document.querySelector('#app')?.getAttribute('data-origin')).toBe('fixture');
    expect(document.querySelector('[data-test="upload-success-pending"]')).not.toBeNull();
    expect(document.querySelector('[data-test="upload-form"]')).toBeNull();

    document.querySelector<HTMLButtonElement>('[data-test="mode-simple"]')?.click();
    expect(document.querySelector('#app')?.getAttribute('data-mode')).toBe('simple');
    expect(banner()?.getAttribute('data-origin')).toBe('fixture');
    expect(banner()?.textContent).not.toContain('LIVE SERVER CONTEXT');
    expect(document.querySelector('[data-test="upload-success-pending"]')).not.toBeNull();

    go('#/upload?reviewer=1');
    const live = banner();
    expect(live?.getAttribute('data-origin')).toBe('live_server');
    expect(live?.textContent).toContain('LIVE SERVER CONTEXT');
    expect(live?.textContent).toContain('no captured fallback');
    expect(live?.textContent).not.toContain('SYNTHETIC DESIGN FIXTURE');
    expect(document.querySelector('#app')?.getAttribute('data-origin')).toBe('live_server');
    expect(document.querySelector('[data-test="upload-form"]')).not.toBeNull();
    expect(document.querySelector('[data-test="upload-success-pending"]')).toBeNull();
    expect(document.querySelector('[data-test="upload-held"]')).toBeNull();

    go('#/upload?reviewer=1&ustate=held');
    const held = banner();
    expect(held?.getAttribute('data-origin')).toBe('fixture');
    expect(held?.getAttribute('role')).toBe('status');
    expect(held?.textContent).toContain('SYNTHETIC DESIGN FIXTURE');
    expect(held?.textContent).not.toContain('LIVE SERVER CONTEXT');
    expect(document.querySelector('[data-test="upload-held"]')).not.toBeNull();
    expect(document.querySelector('[data-test="upload-form"]')).toBeNull();
  });
});
