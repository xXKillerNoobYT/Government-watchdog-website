// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import mainSource from '../src/main.ts?raw';

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

/**
 * Every hash route `src/main.ts` registers, read from source via Vite `?raw`
 * (no `node:fs` — this repo carries no `@types/node` on purpose).
 */
function registeredRoutes(): string[] {
  const found = [...mainSource.matchAll(/router\.register\('([^']+)'/g)].map((m) => m[1]);
  // Guard the derivation itself: if the regex ever stops matching, every route
  // loop below would iterate nothing and pass vacuously.
  expect(found.length).toBeGreaterThan(15);
  return found;
}

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
      expect(document.querySelector('[data-test="shell-demo"]')?.getAttribute('href'), route)
        .toBe('#/explainer?demo=sample');
    }
  });

  it('loads synthetic media only on the explicit, truthfully labelled explainer route', async () => {
    window.location.hash = '#/home?reviewer=1';
    await import('../src/main');

    window.location.hash = '#/explainer?reviewer=1';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(document.querySelector('[data-test="explainer-overview"]')).not.toBeNull();
    expect(document.querySelector('[data-test="explainer-video"]')).toBeNull();
    expect(document.querySelector('[data-test="explainer-player"]')).toBeNull();
    expect(document.querySelector('[data-test="coming-soon-note"]')).toBeNull();
    expect(document.querySelector('[data-test="explainer-open-demo"]')?.getAttribute('href'))
      .toBe('#/explainer?demo=sample');
    expect(document.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'))
      .toBe('product_demo');

    window.location.hash = '#/explainer?reviewer=1&demo=sample';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    const video = document.querySelector<HTMLVideoElement>('[data-test="explainer-video"]');
    expect(video).not.toBeNull();
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(video?.hasAttribute('playsinline')).toBe(true);
    expect(video?.getAttribute('preload')).toBe('metadata');
    expect(video?.hasAttribute('autoplay')).toBe(false);
    expect(video?.hasAttribute('loop')).toBe(false);
    expect(video?.getAttribute('poster')).toContain('government-watchdog-explainer-poster');
    expect(video?.querySelector('source')?.getAttribute('src'))
      .toContain('government-watchdog-explainer');
    expect(video?.querySelector('source')?.getAttribute('type')).toBe('video/mp4');
    expect(video?.getAttribute('aria-describedby'))
      .toBe('gw-explainer-demo-notice gw-explainer-transcript-summary');

    const notice = document.querySelector('[data-test="explainer-demo-notice"]');
    expect(notice?.getAttribute('data-origin')).toBe('fixture');
    expect(notice?.textContent).toContain('hypothetical scenario and figures');
    expect(notice?.textContent).toContain('not a live or reviewed Alpine finding');

    const transcript = document.querySelector('[data-test="explainer-transcript"]');
    expect(transcript?.textContent).toContain('silent 1 minute 13 second animation');
    expect(transcript?.querySelectorAll('li')).toHaveLength(8);
    for (const requiredVisualDetail of [
      'item 7a',
      'private front yards',
      'eminent domain',
      'public sidewalk',
      '$480,000',
      'Cedar Street',
      '14 homes',
      'September 3',
      'August 20',
      '61%',
      '34%',
      '12%',
      'Town May Take Cedar St. Land to Build a Sidewalk',
      '6 of 14',
      'Alpine Town Hall',
      'packet version 2',
      'August 30',
      '96%',
    ]) {
      expect(transcript?.textContent, requiredVisualDetail).toContain(requiredVisualDetail);
    }
    expect(transcript?.textContent).toContain('Every place, event, date, amount, percentage');
    expect(transcript?.textContent).toContain('not a live or reviewed Alpine finding');

    const explainerStyle = document.getElementById('gw-explainer-style')?.textContent ?? '';
    expect(explainerStyle).toContain('color:var(--gw-accent-text-on)');
    expect(explainerStyle).not.toContain('--gw-accent-ink');
    expect(explainerStyle).toContain('@media print');
    expect(explainerStyle).toContain('background:#fff!important;color:#000!important');
    expect(explainerStyle).toContain('.gw-explainer-intro,.gw-explainer-notice');
    expect(explainerStyle).toContain('.gw-explainer p,.gw-explainer-kicker,.gw-explainer-figure figcaption');
    expect(explainerStyle).toContain('.gw-explainer-video{display:none!important}');
    expect(explainerStyle).toContain('.gw-explainer-transcript>ol{display:grid!important}');

    const origin = document.querySelector('[data-test="shell-origin-banner"]');
    expect(origin?.getAttribute('data-origin')).toBe('product_demo');
    expect(origin?.textContent).toContain('ILLUSTRATIVE PRODUCT DEMO');
    expect(origin?.textContent).not.toContain('LIVE SERVER CONTEXT');
    expect(document.querySelector('[data-test="shell-alerts-badge"]')).toBeNull();
    expect(document.querySelector('[data-test="explainer-back"]')?.getAttribute('href')).toBe('#/home');
  });

  // C7 (usability) bound to this repo's web surface, 2026-07-31. The shared
  // usability-enforcer is written over "iOS pages"; its scanners 2 (every control
  // does something) and 4 (no dead ends / trapped state) translate here into one
  // property that is specific to this product's contract:
  //
  //   A COMING SOON marker must be INERT.
  //
  // A CS slot that offers an operable control is the pipeline's Severity-1 "hidden
  // lock" — the user is invited to act on a feature that exists in no lane. It is
  // also an honesty failure: the marker says "not built" while the DOM says
  // "clickable". #75, #86 and #87 each asserted this for their own slot; this sweeps
  // EVERY marker on EVERY route so a future slot cannot regress silently.
  it('renders every COMING SOON marker as an inert slot on every route and lane', async () => {
    window.location.hash = '#/home?reviewer=1';
    await import('../src/main');
    // Derived from the router's own registrations, NOT hand-listed. The first
    // version of this sweep enumerated 11 routes and the app registers 22 — it
    // silently skipped half the app, including /upload, /cards and /topics. An
    // enumeration inside a completeness guard is the one place a hand-picked
    // list is least excusable, so the list is now read out of main.ts.
    const routes = registeredRoutes();

    let markersSeen = 0;
    for (const lane of ['reviewer=1', 'demo=design']) {
      for (const route of routes) {
        window.location.hash = `#${route}?${lane}`;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        const markers = document.querySelectorAll('[data-test="coming-soon-note"], [data-test="coming-soon-chip"]');
        for (const marker of markers) {
          markersSeen += 1;
          const label = `${route} (${lane})`;
          // Scanner 2 + 4: nothing operable, nothing focusable, nowhere to be trapped.
          expect(marker.querySelectorAll('a, button, input, select, textarea, form, [href]'), label)
            .toHaveLength(0);
          expect(marker.querySelectorAll('[tabindex]:not([tabindex="-1"])'), label).toHaveLength(0);
          expect(marker.querySelectorAll('[role="switch"], [role="button"], [role="link"]'), label)
            .toHaveLength(0);
          // The marker must say what it is. An unlabelled CS slot is indistinguishable
          // from a data gap, which is the collapse the CS class exists to prevent.
          expect(marker.textContent, label).toContain('COMING SOON');
          // CS forbids naming a backend contract — that is DG's job.
          expect(marker.textContent, label).not.toMatch(/GET |PUT |\/v1\//);
        }
      }
    }
    // Guard the guard: if the selectors ever stop matching, the loop above passes
    // vacuously. Several CS slots ship today, so zero means the sweep is broken.
    expect(markersSeen).toBeGreaterThan(0);
  });

  /**
   * The canonical reviewed pages. Shared by the landmark test and by the design-lane
   * completeness guard below, so the two cannot drift apart — the failure mode that let a
   * hand-listed sweep cover 11 of 22 routes for four iterations.
   */
  const CANONICAL_ROUTES = ['/home', '/agenda', '/timeline', '/boards', '/power', '/vault', '/newsletter', '/watchlist', '/alerts'] as const;

  it('keeps the shared shell as the sole main landmark on every canonical page', async () => {
    window.location.hash = '#/home?reviewer=1';
    await import('../src/main');

    for (const route of CANONICAL_ROUTES) {
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
      // GOV-163: Boards joins its four siblings — same `beginPage` frame, same
      // `design-fixture-banner`, so it belongs in this loop rather than in a special case.
      ['/boards', 'boards-design-page'],
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

    // GOV-84: Newsletter now has its own gated design fixture, so the shell must call it
    // a fixture. Its banner lives in the page module, like Timeline's.
    window.location.hash = '#/newsletter';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => {
      expect(app.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'))
        .toBe('fixture');
    });
    expect(app.querySelector('[data-test="newsletter-design-banner"]')?.textContent)
      .toContain('SYNTHETIC DESIGN FIXTURE');

    // GOV-82 follow-up: /vault has a gated version-compare fixture, so the shell must
    // call it a fixture. Its banner lives in the compare panel, like Newsletter's.
    window.location.hash = '#/vault?demo=design';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => {
      expect(app.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'))
        .toBe('fixture');
    });

    // GOV-2272: /sources is the canonical ALIAS of /vault — same handler, same renderer, same
    // `designPreviewActive(query)`. Navigating to a BARE `#/sources` (no query) exercises the
    // tab-sticky carry from the report: the design preview set on an earlier route must make the
    // shell declare fixture origin here too, alongside the page's synthetic version-compare diff.
    // Before the fix the shell announced `live_server` on /sources while /vault reported fixture.
    window.location.hash = '#/sources';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => {
      expect(app.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'))
        .toBe('fixture');
      // The synthetic version-compare diff renders after the reviewer read resolves; assert it
      // and the shell origin together so a future regression cannot split shell from content.
      expect(app.querySelector('[data-test="source-version-compare-fixture"]')).not.toBeNull();
    });

    // GOV-163 closed the last gap, so this group is no longer a list of routes awaiting a
    // fixture — it is a COMPLETENESS guard. An enumerated "not yet" list shrinks to nothing
    // and silently stops testing anything (it was down to one entry before this change).
    //
    // It reads SOURCE rather than re-navigating. The first version swept all nine canonical
    // routes through jsdom with `waitFor`, which duplicated navigations this test already
    // performs AND pushed the file far enough over the shared runner's budget to time out a
    // NEIGHBOURING test (the landmark sweep, 1.5s locally, 20.8s on CI — the #59 variance
    // class). Same property, no added navigation.
    const declared = mainSource.slice(
      mainSource.indexOf('const SHELL_DESIGN_FIXTURE_ROUTES'),
      mainSource.indexOf(']);', mainSource.indexOf('const SHELL_DESIGN_FIXTURE_ROUTES')),
    );
    // Guard the derivation: a rename would otherwise assert against an empty slice.
    expect(declared).toContain('SHELL_DESIGN_FIXTURE_ROUTES');
    for (const route of CANONICAL_ROUTES) {
      expect(
        declared,
        `${route} is canonical but is not in SHELL_DESIGN_FIXTURE_ROUTES, so the shell would `
        + `announce live_server over a design fixture`,
      ).toContain(`'${route}'`);
    }

    // GOV-2272: /sources is a canonical ALIAS of /vault — both register the identical Source
    // Vault handler. The loop above iterates the ten baseline pages and so does NOT cover the
    // alias; that gap let the shell announce live_server over the /sources design fixture while
    // /vault correctly reported fixture. Guard the alias against its primary in EVERY fixture
    // route set so renderer and shell can never diverge for /vault versus /sources again.
    const sampleDeclared = mainSource.slice(
      mainSource.indexOf('const SHELL_SAMPLE_FIXTURE_ROUTES'),
      mainSource.indexOf(']);', mainSource.indexOf('const SHELL_SAMPLE_FIXTURE_ROUTES')),
    );
    expect(sampleDeclared).toContain('SHELL_SAMPLE_FIXTURE_ROUTES');
    for (const [setName, setSource] of [
      ['SHELL_DESIGN_FIXTURE_ROUTES', declared],
      ['SHELL_SAMPLE_FIXTURE_ROUTES', sampleDeclared],
    ] as const) {
      expect(
        setSource.includes("'/sources'"),
        `${setName}: /sources must be classified identically to its /vault alias`,
      ).toBe(setSource.includes("'/vault'"));
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
      // GOV-2272: /sources is the /vault alias and shares SHELL_SAMPLE_FIXTURE_ROUTES, so its
      // explicit sample lane must report fixture identically to /vault above.
      ['/sources', 'sample'],
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
      // GOV-2272: a reviewed Sources route without a fixture flag must still declare
      // live-server context — the alias fix must not over-classify the normal reviewed lane.
      ['/sources', 'live'],
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
