// @vitest-environment jsdom
//
// GOV-658 §6 — Home dashboard data-honesty checks. These tests pin the new
// `#/home` surface to existing reviewer-internal projections only: real cards and
// digest rows may render; unavailable widgets must be honest-empty (or DEV sample
// under ?demo=sample); gated verdict/lens/search/alert features are absent.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHome } from '../src/ui/home';
import { applyMode } from '../src/ui/shell';
import { loadDigestResponse } from '../src/ui/newsletter';
import cardFeedData from '../src/fixtures/alpine-card-feed.json';
import agendaBoardData from '../src/fixtures/agenda-board-projection.json';
import agendaBoardSampleData from '../src/fixtures/agenda-board-projection.sample.dev.json';
import newsletterDigestData from '../src/fixtures/alpine-newsletter-digest.json';
import type { CardFeed } from '../src/ui/card-feed';
import type { AgendaBoard } from '../src/types/agenda-board';

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
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('main');
  document.body.append(root);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GOV-658 Home dashboard — Advanced mode honesty map', () => {
  it('renders the Advanced Home widgets from real projections plus honest-empty modules', () => {
    renderHome(root, opts());

    expect(root.querySelector('[data-test="home-civic-weather"]')).not.toBeNull();
    expect(root.querySelector('[data-test="home-active-issues"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-test="home-issue-row"]').length).toBeGreaterThan(0);
    expect(root.querySelectorAll('[data-test="home-timeline-event"]').length).toBeGreaterThan(0);

    expect(root.querySelector('[data-test="home-fast-agenda"]')?.textContent).toContain(
      'No upcoming reviewed meeting records',
    );
    expect(root.querySelector('[data-test="home-transparency-alerts"]')?.textContent).toContain(
      'Document-change tracking is not live yet',
    );
    expect(root.querySelector('[data-test="home-source-vault"]')?.textContent).toContain(
      'Source statistics are not wired yet',
    );
  });

  it('keeps gated verdict/lens and fake shell features absent from the Home DOM', () => {
    renderHome(root, opts());
    const text = root.textContent ?? '';
    expect(text).not.toContain('Promise Conflicts');
    expect(text).not.toContain('LATEST VERDICT');
    expect(text).not.toContain('Conservative');
    expect(text).not.toContain('Progressive');
    expect(text).not.toContain('Libertarian');
    expect(text).not.toContain('⌘K');
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
    expect(root.querySelector('[data-test="home-demo-banner"]')?.textContent).toContain('DEV SAMPLE');
    expect(root.querySelectorAll('[data-test="home-agenda-card"]').length).toBeGreaterThan(0);
    expect(root.querySelector('[data-test="home-transparency-alerts"]')?.textContent).toContain('Demonstration only');
  });
});

describe('GOV-658 Home dashboard — Simple broadsheet mode', () => {
  it('renders the Simple front page from reviewed digest items and keeps AI disclosure visible', () => {
    applyMode('simple');
    renderHome(root, opts());

    expect(root.querySelector('[data-test="home-simple"]')).not.toBeNull();
    expect(root.textContent).toContain('Government Watchdog Weekly');
    expect(root.querySelectorAll('[data-test="home-simple-item"]').length).toBeGreaterThan(0);
    expect(root.querySelector('[data-test="home-simple-featured"]')?.textContent).toContain('PLAIN-ENGLISH SUMMARY');
    expect(root.querySelector('[data-test="home-simple-featured"]')?.textContent).toContain('AI');
    expect(root.querySelector('[data-test="home-simple-rail"]')?.textContent).toContain('Publication Honesty Tracker');
  });
});
