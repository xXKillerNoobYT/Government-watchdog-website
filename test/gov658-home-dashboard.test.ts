// @vitest-environment jsdom
//
// GOV-658 §6 — Home dashboard data-honesty checks. These tests pin the new
// `#/home` surface to existing reviewer-internal projections only: real cards and
// digest rows may render; unavailable baseline slots must stay explicit (or DEV
// sample under ?demo=sample) and may never fabricate verdict, language, archive,
// search, price, or media data.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHome, renderHomeReadModel } from '../src/ui/home';
import { applyMode } from '../src/ui/shell';
import { loadDigestResponse } from '../src/ui/newsletter';
import cardFeedData from '../src/fixtures/alpine-card-feed.json';
import agendaBoardData from '../src/fixtures/agenda-board-projection.json';
import agendaBoardSampleData from '../src/fixtures/agenda-board-projection.sample.dev.json';
import newsletterDigestData from '../src/fixtures/alpine-newsletter-digest.json';
import type { CardFeed } from '../src/ui/card-feed';
import type { AgendaBoard } from '../src/types/agenda-board';
import type { ReadApiResponse } from '../src/types/read-api';

function installMemoryLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  });
}

function opts(demo = false) {
  return {
    cardFeed: cardFeedData as CardFeed,
    board: agendaBoardData as AgendaBoard,
    newsletter: loadDigestResponse(newsletterDigestData),
    demo,
    sampleBoard: agendaBoardSampleData as AgendaBoard,
  };
}

let root: HTMLElement;
beforeEach(() => {
  installMemoryLocalStorage();
  sessionStorage.clear();
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('main');
  document.body.append(root);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const HOME_BASELINE_SLOTS = [
  'home-civic-weather',
  'home-fast-agenda',
  'home-transparency-alerts',
  'home-active-issues',
  'home-timeline-preview',
  'home-latest-verdict-unavailable',
  'home-source-vault',
  'home-explainer-video-unavailable',
  'home-language-watch-unavailable',
  'home-simple-90-day-tools',
  'home-simple-things',
  'home-simple-featured',
  'home-simple-rail',
  'home-local-edition-gaps',
] as const;

function expectHomeInfoNotes(requiredIds: readonly string[]): HTMLButtonElement[] {
  const triggers = [...root.querySelectorAll<HTMLButtonElement>('.gw-info-trigger')];
  const labels = triggers.map((trigger) => trigger.getAttribute('aria-label') ?? '');
  const controls = triggers.map((trigger) => trigger.getAttribute('aria-controls') ?? '');
  expect(new Set(labels).size).toBe(labels.length);
  expect(new Set(controls).size).toBe(controls.length);
  for (const id of requiredIds) {
    expect(root.querySelector(`[data-info-note="${id}"]`), id).not.toBeNull();
  }
  for (const trigger of triggers) {
    expect(trigger.textContent).toBe('?');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    const panel = document.getElementById(trigger.getAttribute('aria-controls') ?? '');
    expect(panel).not.toBeNull();
    expect(panel?.hidden).toBe(true);
    expect(panel?.textContent).toContain('Current state');
    expect(panel?.textContent).toContain('Filed under');
    expect(panel?.textContent).toContain('Expected result');
  }
  return triggers;
}

describe('GOV-658 Home dashboard — Simple/Advanced information parity', () => {
  it.each(['advanced', 'simple'] as const)(
    'preserves every reviewed fact and designed-gap group in %s mode',
    (mode) => {
      applyMode(mode);
      renderHome(root, opts());

      for (const slot of HOME_BASELINE_SLOTS) {
        expect(root.querySelectorAll(`[data-test="${slot}"]`), slot).toHaveLength(1);
      }
    },
  );

  it.each([
    ['advanced', [
      'home-overview',
      'home-summary',
      'home-jurisdiction-filter',
      'home-fast-agenda',
      'home-transparency-alerts',
      'home-active-issues',
      'home-timeline-preview',
      'home-source-vault',
      'home-latest-verdict',
      'home-language-watch',
      'home-explainer',
      'home-briefing',
      'home-search',
      'home-simple-things',
      'home-featured-story',
      'reviewed-source-receipts',
      'home-edition-history',
      'home-honesty-metrics',
      'home-local-editions',
    ]],
    ['simple', [
      'home-overview',
      'home-summary',
      'home-jurisdiction-filter',
      'home-search',
      'home-simple-things',
      'home-fast-agenda',
      'home-transparency-alerts',
      'home-featured-story',
      'reviewed-source-receipts',
      'home-edition-history',
      'home-honesty-metrics',
      'home-local-editions',
      'home-accountability',
      'home-active-issues',
      'home-timeline-preview',
      'home-source-vault',
      'home-latest-verdict',
      'home-language-watch',
      'home-explainer',
    ]],
  ] as const)(
    'renders unique, structured contextual notes in %s mode',
    (mode, requiredIds) => {
      applyMode(mode);
      renderHome(root, opts());
      const notes = expectHomeInfoNotes(requiredIds);
      expect(notes.some((note) => note.dataset.infoNote?.startsWith('private-gap-home-'))).toBe(true);
    },
  );

  it.each(['advanced', 'simple'] as const)(
    'keeps the same slots visible when the reviewed digest is empty in %s mode',
    (mode) => {
      applyMode(mode);
      const options = opts();
      renderHome(root, {
        ...options,
        newsletter: { ...options.newsletter, digests: [] },
      });

      for (const slot of HOME_BASELINE_SLOTS) {
        expect(root.querySelectorAll(`[data-test="${slot}"]`), slot).toHaveLength(1);
      }
    },
  );
});

describe('GOV-658 Home dashboard — Advanced mode honesty map', () => {
  it('renders the Advanced Home widgets from real projections plus honest-empty modules', () => {
    renderHome(root, opts());

    expect(root.querySelector('[data-test="home-civic-weather"]')).not.toBeNull();
    expect(root.querySelector('[data-test="home-active-issues"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="home-issue-row"]').length).toBeGreaterThan(0);
    expect(root.querySelectorAll('[data-test="home-timeline-event"]').length).toBeGreaterThan(0);
    expect(root.querySelectorAll('[data-test="home-timeline-status"]').length).toBeGreaterThan(0);
    expect(root.querySelectorAll('[data-test="home-timeline-receipts"]').length).toBeGreaterThan(0);
    expect(root.querySelector('[data-test="home-issues-record-disclosure"]')?.textContent).toContain(
      'not typed or inferred issue threads',
    );

    expect(root.querySelector('[data-test="home-fast-agenda"]')?.textContent).toContain(
      'No upcoming reviewed meeting records',
    );
    expect(root.querySelector('[data-test="home-transparency-alerts"]')?.textContent).toContain(
      'Document-change tracking is not live yet',
    );
    expect(root.querySelector('[data-test="home-source-vault"]')?.textContent).toContain(
      'Source statistics are not wired yet',
    );
    expect(root.querySelector('[data-test="home-source-vault"]')?.getAttribute('data-origin')).toBe('designed-gap');
    expect(root.querySelector('[data-test="home-latest-verdict-unavailable"]')?.textContent).toContain(
      'No reviewed promise-versus-action verdict is available',
    );
    expect(root.querySelector('[data-test="home-language-watch-unavailable"]')?.textContent).toContain(
      'No reviewed language-watch flags are available',
    );
    expect(root.querySelector('[data-test="home-explainer-video-unavailable"]')?.textContent).toContain(
      'Explainer video is not published in this app yet',
    );
  });

  it('keeps unsupported civic values absent while preserving their designed slots', () => {
    renderHome(root, opts());
    const text = root.textContent ?? '';
    expect(text).not.toContain('Councilor R. Roe');
    expect(text).not.toContain('Admin-fee ordinance 2026-0055');
    expect(text).not.toContain('accounted for separately');
    expect(text).not.toContain('Conservative');
    expect(text).not.toContain('Progressive');
    expect(text).not.toContain('Libertarian');
    expect(text).not.toContain('⌘K');
    expect(text).not.toContain('$25');
  });

  it('renders County and State filters as honest-empty without hiding the real jurisdiction model', () => {
    renderHome(root, opts());
    (root.querySelector('[data-test="home-level-county"]') as HTMLButtonElement).click();
    expect(root.querySelector('[data-test="home-active-issues"]')?.textContent).toContain(
      'No county reviewed issue rows',
    );
    expect(root.querySelector('[data-test="home-level-county"]')?.getAttribute('aria-pressed')).toBe('true');

    (root.querySelector('[data-test="home-level-state"]') as HTMLButtonElement).click();
    expect(root.querySelector('[data-test="home-active-issues"]')?.textContent).toContain(
      'No state reviewed issue rows',
    );
  });

  it('only renders populated agenda/alert/vault samples behind demo mode with a DEV banner', () => {
    renderHome(root, opts(true));
    const banner = root.querySelector('[data-test="home-demo-banner"]');
    expect(banner?.textContent).toContain('SYNTHETIC DESIGN FIXTURE — not a live read');
    expect(banner?.textContent).toContain('synthetic modules: Fast Agenda, Transparency Alerts, and Source Vault');
    expect(banner?.getAttribute('data-origin')).toBe('fixture');
    expect(root.querySelectorAll('[data-test="home-agenda-card"]').length).toBeGreaterThan(0);
    expect(root.querySelector('[data-test="home-fast-agenda"]')?.getAttribute('data-origin')).toBe('fixture');
    expect(root.querySelector('[data-test="home-transparency-alerts"]')?.textContent).toContain('Demonstration only');
    expect(root.querySelector('[data-test="home-transparency-alerts"]')?.getAttribute('data-origin')).toBe('fixture');
    expect(root.querySelector('[data-test="home-source-vault"]')?.getAttribute('data-origin')).toBe('fixture');

    expect(root.querySelector('[data-test="home-active-issues"]')?.getAttribute('data-origin')).toBe('reviewed_snapshot');
    expect(root.querySelector('[data-test="home-timeline-preview"]')?.getAttribute('data-origin')).toBe('reviewed_snapshot');
    expect(root.querySelector('[data-metric="reviewed-records"]')?.getAttribute('data-origin')).toBe('reviewed_snapshot');
    const expectedReceiptCount = opts().newsletter.digests[0].items
      .reduce((total, item) => total + item.sourceTrail.length, 0);
    expect(root.querySelector('[data-metric="source-receipts"] strong')?.textContent).toBe(String(expectedReceiptCount));
    expect(root.querySelector('[data-metric="changes-votes"] strong')?.textContent).toBe('—');
    expect(root.querySelector('[data-metric="changes-votes"]')?.getAttribute('data-origin')).toBe('designed-gap');

    (root.querySelector('[data-test="home-level-county"]') as HTMLButtonElement).click();
    expect(root.querySelector('[data-test="home-fast-agenda"]')?.textContent).toContain('No sample agenda cards for this level');
    expect(root.textContent).not.toContain('Zoning Variance');
    expect(root.textContent).not.toContain('FY27 Budget');
  });

  it('keeps all fixture values out when demo mode is disabled', () => {
    renderHome(root, opts(false));
    expect(root.querySelector('[data-origin="fixture"]')).toBeNull();
    expect(root.textContent).not.toContain('Zoning Variance');
    expect(root.textContent).not.toContain('FY27 Budget');
    expect(root.textContent).not.toContain('Packet changed after posting');
  });

  it('fails closed before reading Home civic records outside reviewer_internal', () => {
    renderHome(root, { ...opts(true), access: 'public' });
    expect(root.querySelector('[data-test="state-reviewer-gated"]')).not.toBeNull();
    expect(root.querySelector('[data-test="home-issue-row"]')).toBeNull();
    expect(root.querySelector('[data-test="home-timeline-event"]')).toBeNull();
    expect(root.querySelector('[data-origin="fixture"]')).toBeNull();
    expect(root.querySelector('.gw-info-trigger')).toBeNull();
    expect(root.textContent).not.toContain('Filed under');
  });
});

describe('GOV-53 Home live reviewer-model contextual notes', () => {
  const liveResponse: ReadApiResponse = {
    scope: 'alpine',
    access: 'reviewer_internal',
    records: [{
      statement_id: 'home-info-record',
      statement_text: 'A reviewed Alpine statement for note coverage.',
      ui_status: 'source-backed',
      provenance_status: 'grounded',
      verification_status: 'human_verified',
      produced_by: 'human',
      evidence: [{
        to_source_id: 'home-info-source',
        relation: 'supports',
        original_url: 'https://www.alpinewy.gov/home-info-source',
        verification_status: 'human_verified',
      }],
    }],
  };

  it.each(['advanced', 'simple'] as const)(
    'keeps the live %s route, method, record, and gap notes unique',
    (mode) => {
      applyMode(mode);
      renderHomeReadModel(root, liveResponse);

      const notes = expectHomeInfoNotes([
        'home-overview',
        'home-summary',
        'home-records',
        'home-gaps',
      ]);
      expect(notes.filter((note) => note.dataset.infoNote?.startsWith('private-projection-'))).toHaveLength(6);
      const methodPanel = document.getElementById(
        root.querySelector<HTMLButtonElement>('[data-info-note="home-summary"]')?.getAttribute('aria-controls') ?? '',
      );
      expect(methodPanel?.textContent).toContain('Method version');
      expect(methodPanel?.textContent).toContain('Missing data');
    },
  );
});

describe('GOV-658 Home dashboard — Simple broadsheet mode', () => {
  it('renders the Simple front page with exact digest trust labels and source receipts', () => {
    applyMode('simple');
    renderHome(root, opts());

    expect(root.querySelector('[data-test="home-simple"]')).not.toBeNull();
    expect(root.textContent).toContain('Government Watchdog Weekly');
    expect(root.querySelectorAll('[data-test="home-simple-item"]').length).toBeGreaterThan(0);
    expect(root.querySelector('[data-test="home-simple-featured"]')?.textContent).toContain('PLAIN-ENGLISH SUMMARY');
    expect(root.querySelector('[data-test="home-simple-feature-claim-label"]')?.getAttribute('data-claim')).toBe('unverified');
    expect(root.querySelector('[data-test="home-simple-feature-claim-label"]')?.textContent).toBe('Unverified');
    expect(root.querySelector('[data-test="home-simple-feature-ai-label"]')).toBeNull();
    expect(root.querySelectorAll('[data-test="home-simple-claim-label"]')).toHaveLength(
      opts().newsletter.digests[0].items.length,
    );
    expect(root.querySelectorAll('[data-test="home-simple-item-receipts"]')).toHaveLength(
      opts().newsletter.digests[0].items.length,
    );
    expect(root.querySelector('[data-test="home-simple-rail"]')?.textContent).toContain('Publication Honesty Tracker');
    expect(root.querySelector('[data-test="home-simple-90-day-tools"]')?.textContent).toContain(
      'Past 90 days is the intended Simple reading window',
    );
    expect((root.querySelector('[data-test="home-simple-search-input"]') as HTMLInputElement).disabled).toBe(true);
    expect(root.querySelector('[data-test="home-edition-history-unavailable"]')?.textContent).toContain(
      'The digest coverage period is not version history',
    );
    expect((root.querySelector('[data-test="home-edition-history-select"]') as HTMLSelectElement).disabled).toBe(true);
    expect(root.textContent).not.toContain('$25');

    const sourceLink = root.querySelector('[data-test="home-simple-source-link"]');
    expect(sourceLink?.textContent).toMatch(/source trail receipt/i);
    expect(sourceLink?.textContent).not.toMatch(/verified/i);
    expect(root.querySelector('[data-test="home-simple-rail"]')?.textContent).not.toMatch(/verified briefing/i);
  });

  it('describes an empty History rail as reviewed digest data without claiming verification', () => {
    applyMode('simple');
    const options = opts();
    renderHome(root, {
      ...options,
      newsletter: { ...options.newsletter, digests: [] },
    });

    const rail = root.querySelector('[data-test="home-simple-rail"]');
    expect(rail?.textContent).toContain('reviewed digest items');
    expect(rail?.textContent).not.toMatch(/verified briefing/i);
  });

  it('shows the locked AI label only when the supplied item marks AI presentation', () => {
    applyMode('simple');
    const options = opts();
    const newsletter = structuredClone(options.newsletter);
    newsletter.digests[0].items[0].labels.aiPresented = true;
    renderHome(root, { ...options, newsletter });

    expect(root.querySelector('[data-test="home-simple-feature-ai-label"]')?.textContent).toBe(
      'AI — not independently verified',
    );
  });
});

describe('GOV-658 Home route access scoping', () => {
  it('narrows the shared live context to denied for access=public and renders zero civic rows', async () => {
    vi.resetModules();
    document.body.replaceChildren();
    const app = document.createElement('div');
    app.id = 'app';
    document.body.append(app);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({
        reviewer_internal_records: [{
          statement_id: 'home-live-sentinel',
          statement_text: 'Live Home route sentinel',
          ui_status: 'source-backed',
          verification_status: 'reviewed_source_linked',
          provenance_status: 'grounded',
          publication_state: 'publishable',
          produced_by: 'human',
          evidence: [{
            to_source_id: 'home-live-source',
            verification_status: 'human_verified',
            original_url: 'https://www.alpinewy.gov/home-live-source',
          }],
        }],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    window.location.hash = '#/home?reviewer=1&access=public';

    await import('../src/main');

    expect(app.querySelector('[data-test="app-shell"]')).not.toBeNull();
    await vi.waitFor(() => {
      expect(app.querySelector('[data-test="reviewer-context-denied"]')).not.toBeNull();
    });
    expect(fetchMock.mock.calls.filter(
      (call) => (call as unknown[])[0] === '/api/reviewer-internal',
    ))
      .toHaveLength(1);
    expect(app.querySelector('[data-test="home-live-record"]')).toBeNull();
    expect(app.textContent).not.toContain('Live Home route sentinel');
    expect(app.querySelector('[data-origin="fixture"]')).toBeNull();
  });
});
