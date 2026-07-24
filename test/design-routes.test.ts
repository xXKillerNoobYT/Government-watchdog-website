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
  localStorage.setItem('gw_home_mode', 'advanced');
  const root = document.createElement('div');
  root.id = 'app';
  document.body.append(root);
});

describe('MOTY design-handoff route integration', () => {
  it('returns to the top when primary pages change without resetting same-page controls', async () => {
    window.location.hash = '#/home?reviewer=1';
    await import('../src/main');
    document.documentElement.scrollTop = 620;

    window.location.hash = '#/alerts?reviewer=1';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.querySelector('.gw-shell-tab[aria-current="page"]')?.textContent).toBe('Alerts');
  });

  it('keeps the shared shell as the sole main landmark on every canonical page', async () => {
    window.location.hash = '#/home?reviewer=1';
    await import('../src/main');
    const canonicalRoutes = ['/home', '/agenda', '/timeline', '/boards', '/power', '/vault', '/newsletter', '/watchlist', '/alerts'];

    for (const route of canonicalRoutes) {
      window.location.hash = `#${route}?reviewer=1`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(document.querySelectorAll('main'), route).toHaveLength(1);
      expect(document.querySelector('main main'), route).toBeNull();
    }
  });

  it('keeps the explicit design preview active while navigating every new route', async () => {
    window.location.hash = '#/agenda?reviewer=1&demo=design';
    await import('../src/main');

    const app = document.querySelector('#app')!;
    expect(app.querySelector('[data-test="fast-agenda-advanced"]')).not.toBeNull();
    expect(app.querySelector('[data-test="fixture-banner"]')?.textContent).toContain('SYNTHETIC DESIGN FIXTURE');
    expect(app.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'))
      .toBe('fixture');
    expect(app.querySelector('[data-test="shell-origin-banner"]')?.textContent)
      .toContain('SYNTHETIC DESIGN FIXTURE');

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
      expect(app.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'), route)
        .toBe('fixture');
    }

    for (const route of ['/boards', '/vault', '/newsletter', '/timeline']) {
      window.location.hash = `#${route}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await vi.waitFor(() => {
        expect(app.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'), route)
          .toBe('reviewed_snapshot');
      });
      expect(app.querySelector('[data-test="design-fixture-banner"]'), route).toBeNull();
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
    const origin = app.querySelector('[data-test="shell-origin-banner"]');
    expect(origin?.getAttribute('data-origin')).toBe('reviewed_snapshot');
    expect(origin?.textContent).toContain('REVIEWED SNAPSHOT');
    expect(origin?.textContent).toContain('not a live read');

    const reviewedRoutes = [
      ['/agenda', 'fast-agenda-reviewed-advanced', 'reviewed-agenda-empty'],
      ['/power', 'power-real-advanced-workbench', 'power-score-unavailable'],
      ['/watchlist', 'watchlist-real-advanced-workbench', 'watchlist-history-unavailable'],
      ['/location', 'location-real-advanced-workbench', 'location-coverage-unavailable'],
      ['/alerts', 'alerts-real-advanced-workbench', 'alerts-history-unavailable'],
    ] as const;
    for (const [route, baselineId, gapId] of reviewedRoutes) {
      window.location.hash = `#${route}?reviewer=1`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(app.querySelector(`[data-test="${baselineId}"]`), route).not.toBeNull();
      expect(app.querySelector(`[data-test="${gapId}"]`), route).not.toBeNull();
      expect(app.querySelector('[data-test="design-fixture-banner"]'), route).toBeNull();
      expect(app.querySelector('[data-test="fixture-banner"]'), route).toBeNull();
      expect(app.querySelector('[data-fixture]'), route).toBeNull();
      expect(app.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'), route)
        .toBe('reviewed_snapshot');
    }
  });

  it('opens the reviewed newsletter archive without guessing a current edition and keeps explicit detail links', async () => {
    window.location.hash = '#/newsletter?reviewer=1';
    await import('../src/main');

    const app = document.querySelector('#app')!;
    expect(app.querySelector('[data-test="newsletter-archive"]')).not.toBeNull();
    expect(app.querySelector('[data-test="newsletter-current-edition-unavailable"]')).not.toBeNull();
    expect(app.querySelector('[data-test="newsletter-baseline-structure"]')).not.toBeNull();
    expect(app.querySelector('[data-test="newsletter-detail"]')).toBeNull();

    window.location.hash = '#/newsletter?reviewer=1&id=alpine-historical-2026-18';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(app.querySelector('[data-test="newsletter-detail"]')).not.toBeNull();
    expect(app.querySelector('[data-test="newsletter-detail-archive"]')).not.toBeNull();
    expect(app.querySelector('[data-test="newsletter-archive"]')).toBeNull();
  });

  it('classifies explicit demos only on routes that actually render those fixtures', async () => {
    window.location.hash = '#/power?reviewer=1';
    await import('../src/main');

    const app = document.querySelector('#app')!;
    const fixtureRoutes = [
      ['/app', 'sample'],
      ['/timeline-legacy', 'complete'],
      ['/timeline-legacy', 'matrix'],
      ['/timeline-legacy', 'provenance'],
      ['/topics', 'graph-synthetic'],
    ] as const;
    for (const [route, demo] of fixtureRoutes) {
      window.location.hash = `#${route}?reviewer=1&demo=${demo}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(app.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'), `${route}:${demo}`)
        .toBe('fixture');
    }

    const reviewedRoutes = [
      ['/power', 'complete'],
      ['/power', 'sample'],
      ['/newsletter', 'sample'],
      ['/cards', 'sample'],
      ['/topics', 'graph'],
      ['/power', 'live'],
    ] as const;
    for (const [route, demo] of reviewedRoutes) {
      window.location.hash = `#${route}?reviewer=1&demo=${demo}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(app.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'), `${route}:${demo}`)
        .toBe('reviewed_snapshot');
    }
  });

  it('keeps the explicit public verification lane empty even during preview', async () => {
    window.location.hash = '#/alerts?reviewer=1&demo=design&access=public';
    await import('../src/main');

    const app = document.querySelector('#app')!;
    expect(app.querySelector('[data-test="alerts-gated"]')).not.toBeNull();
    expect(app.querySelector('[data-test="alerts-page"]')).toBeNull();
    expect(app.querySelector('[data-test="alerts-unread-item"]')).toBeNull();
  });

  it('never renders the shell or its origin banner before the beta gate admits the route', async () => {
    window.location.hash = '#/power?gate=anonymous&demo=design';
    await import('../src/main');

    const app = document.querySelector('#app')!;
    expect(app.querySelector('[data-test="gate-panel"]')?.getAttribute('data-state')).toBe('anonymous');
    expect(app.querySelector('[data-test="app-shell"]')).toBeNull();
    expect(app.querySelector('[data-test="shell-origin-banner"]')).toBeNull();
    expect(app.querySelector('[data-test="power-tracker-page"]')).toBeNull();
  });
});
