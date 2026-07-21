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

describe('MOTY design-handoff route integration', () => {
  it('keeps the explicit design preview active while navigating every new route', async () => {
    window.location.hash = '#/agenda?reviewer=1&demo=design';
    await import('../src/main');

    const app = document.querySelector('#app')!;
    expect(app.querySelector('[data-test="fast-agenda-advanced"]')).not.toBeNull();
    expect(app.querySelector('[data-test="fixture-banner"]')?.textContent).toContain('SYNTHETIC DESIGN FIXTURE');

    const routes = [
      ['/power', 'power-tracker-page'],
      ['/watchlist', 'watchlist-page'],
      ['/location', 'location-page'],
      ['/alerts', 'alerts-page'],
    ] as const;

    for (const [route, testId] of routes) {
      window.location.hash = `#${route}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(app.querySelector(`[data-test="${testId}"]`), route).not.toBeNull();
      expect(app.querySelector('[data-test="design-fixture-banner"]')?.textContent).toContain(
        'SYNTHETIC DESIGN FIXTURE',
      );
    }
  });

  it('does not render synthetic page content until design preview is explicit', async () => {
    window.location.hash = '#/power?reviewer=1';
    await import('../src/main');

    const app = document.querySelector('#app')!;
    expect(app.querySelector('[data-test="power-tracker-page"]')).not.toBeNull();
    expect(app.querySelector('[data-test="power-tracker-gated"]')).toBeNull();
    expect(app.querySelector('[data-test="design-fixture-banner"]')).toBeNull();
    expect(app.querySelector('[data-fixture="true"]')).toBeNull();
  });

  it('keeps the explicit public verification lane empty even during preview', async () => {
    window.location.hash = '#/alerts?reviewer=1&demo=design&access=public';
    await import('../src/main');

    const app = document.querySelector('#app')!;
    expect(app.querySelector('[data-test="alerts-gated"]')).not.toBeNull();
    expect(app.querySelector('[data-test="alerts-page"]')).toBeNull();
    expect(app.querySelector('[data-test="alerts-unread-item"]')).toBeNull();
  });
});
