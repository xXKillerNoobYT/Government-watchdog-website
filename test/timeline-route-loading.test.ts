// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const neverResolvingLoad = vi.hoisted(() => vi.fn(() => new Promise(() => undefined)));

vi.mock('../src/data/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/data/client')>();
  return { ...actual, loadReadModel: neverResolvingLoad };
});

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

beforeEach(() => {
  vi.resetModules();
  neverResolvingLoad.mockClear();
  document.head.replaceChildren();
  document.body.replaceChildren();
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  const root = document.createElement('div');
  root.id = 'app';
  document.body.append(root);
});

describe('Timeline route transient state', () => {
  it('renders a neutral loading state while the reviewed read model is pending', async () => {
    window.location.hash = '#/timeline?reviewer=1';
    await import('../src/main');

    expect(neverResolvingLoad).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-test="state-loading"]')?.textContent).toContain('Loading');
    expect(document.querySelector('[data-test="timeline-map"]')).toBeNull();
  });
});
