// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const REVIEWER_ENVELOPE = {
  reviewer_internal_records: [{
    statement_id: 'server-route-record',
    statement_text: 'The Alpine Town Council approved the published minutes.',
    ui_status: 'source-backed',
    verification_status: 'human_verified',
    provenance_status: 'grounded',
    publication_state: 'publishable',
    produced_by: 'human',
    evidence: [{
      to_source_id: 'server-route-source',
      relation: 'supports',
      original_url: 'https://www.alpinewy.gov/server-route-source',
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

describe('MOTY design-handoff route integration', () => {
  it('returns to the top when primary pages change without resetting same-page controls', async () => {
    window.location.hash = '#/home?reviewer=1';
    await import('../src/main');
    document.documentElement.scrollTop = 620;

    window.location.hash = '#/watchlist?reviewer=1';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.querySelector('.gw-shell-tab[aria-current="page"]')?.textContent).toBe('Watchlist');
  });

  it('reaches Alerts and the explainer from the header on every route', async () => {
    window.location.hash = '#/home?reviewer=1';
    await import('../src/main');

    for (const route of ['/home', '/timeline', '/newsletter', '/watchlist']) {
      window.location.hash = `#${route}?reviewer=1`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(document.querySelector('[data-test="shell-alerts-chip"]'), route).not.toBeNull();
      expect(document.querySelector('[data-test="shell-demo"]'), route).not.toBeNull();
    }
  });

  it('renders the explainer route as an unbuilt feature, not a data gap', async () => {
    window.location.hash = '#/home?reviewer=1';
    await import('../src/main');

    window.location.hash = '#/explainer?reviewer=1';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    const note = document.querySelector('[data-test="coming-soon-note"]');
    expect(note?.textContent).toContain('COMING SOON');
    expect(note?.textContent).toContain('Explainer video');
    expect(document.querySelector('[data-test="explainer-back"]')?.getAttribute('href')).toBe('#/home');
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

  // Integration sweep over 8+ routes with waitFor loops. The 5s unit default
  // is too tight on the shared self-hosted runner (see issue #59 for the same
  // class of timeout); the budget below is a ceiling, not a target.
  it('keeps the explicit design preview active while navigating every new route', { timeout: 20000 }, async () => {
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

    // Timeline now has its own gated design fixture, so the shell must call it
    // a fixture. Its banner lives in the page module, not the shared one.
    window.location.hash = '#/timeline';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => {
      expect(app.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'))
        .toBe('fixture');
    });
    expect(app.querySelector('[data-test="timeline-design-banner"]')?.textContent)
      .toContain('SYNTHETIC DESIGN FIXTURE');

    // Routes with no design fixture yet must stay reviewed, never claim one.
    for (const route of ['/boards', '/vault', '/newsletter']) {
      window.location.hash = `#${route}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await vi.waitFor(() => {
        expect(app.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'), route)
          .toBe('live_server');
      });
      expect(app.querySelector('[data-test="design-fixture-banner"]'), route).toBeNull();
    }
  });

  it('does not render synthetic page content until design preview is explicit', async () => {
    window.location.hash = '#/power?reviewer=1';
    await import('../src/main');

    const app = document.querySelector('#app')!;
    await vi.waitFor(() => {
      expect(app.querySelector('[data-test="power-tracker-page"]')).not.toBeNull();
    });
    expect(app.querySelector('[data-test="power-tracker-gated"]')).toBeNull();
    expect(app.querySelector('[data-test="design-fixture-banner"]')).toBeNull();
    expect(app.querySelector('[data-fixture="true"]')).toBeNull();
    const origin = app.querySelector('[data-test="shell-origin-banner"]');
    expect(origin?.getAttribute('data-origin')).toBe('live_server');
    expect(origin?.textContent).toContain('LIVE SERVER CONTEXT');
    expect(origin?.textContent).toContain('same-origin authorization');

    const liveRoutes = [
      ['/agenda', 'reviewer-projection-gap', 'reviewer-projection-gap'],
      ['/power', 'power-real-advanced-workbench', 'power-score-unavailable'],
      ['/watchlist', 'watchlist-real-advanced-workbench', 'watchlist-history-unavailable'],
      ['/location', 'location-real-advanced-workbench', 'location-coverage-unavailable'],
      ['/alerts', 'alerts-real-advanced-workbench', 'alerts-history-unavailable'],
    ] as const;
    for (const [route, baselineId, gapId] of liveRoutes) {
      window.location.hash = `#${route}?reviewer=1`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await vi.waitFor(() => {
        expect(app.querySelector(`[data-test="${baselineId}"]`), route).not.toBeNull();
      });
      expect(app.querySelector(`[data-test="${gapId}"]`), route).not.toBeNull();
      if (route === '/agenda') {
        expect(app.querySelector('[data-test="reviewer-projection-gap"]')?.getAttribute('data-projection'))
          .toBe('agenda-board');
      }
      expect(app.querySelector('[data-test="design-fixture-banner"]'), route).toBeNull();
      expect(app.querySelector('[data-test="fixture-banner"]'), route).toBeNull();
      expect(app.querySelector('[data-fixture]'), route).toBeNull();
      expect(app.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'), route)
        .toBe('live_server');
    }
  });

  it('opens the reviewed newsletter archive without guessing a current edition and keeps explicit detail links', async () => {
    window.location.hash = '#/newsletter?reviewer=1&demo=snapshot';
    await import('../src/main');

    const app = document.querySelector('#app')!;
    expect(app.querySelector('[data-test="newsletter-archive"]')).not.toBeNull();
    expect(app.querySelector('[data-test="newsletter-current-edition-unavailable"]')).not.toBeNull();
    expect(app.querySelector('[data-test="newsletter-baseline-structure"]')).not.toBeNull();
    expect(app.querySelector('[data-test="newsletter-detail"]')).toBeNull();

    window.location.hash = '#/newsletter?reviewer=1&demo=snapshot&id=alpine-historical-2026-18';
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
      ['/vault', 'sample'],
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

    const liveRoutes = [
      ['/power', 'complete'],
      ['/power', 'sample'],
      ['/newsletter', 'sample'],
      ['/cards', 'sample'],
      ['/power', 'live'],
    ] as const;
    for (const [route, demo] of liveRoutes) {
      window.location.hash = `#${route}?reviewer=1&demo=${demo}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(app.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'), `${route}:${demo}`)
        .toBe('live_server');
    }

    const capturedRoutes = [
      ['/timeline', 'graph'],
      ['/topics', 'graph'],
      ['/newsletter', 'snapshot'],
    ] as const;
    for (const [route, demo] of capturedRoutes) {
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
