// @vitest-environment jsdom

/**
 * GOV-2256 — Upload route heading + contextual guidance regression.
 *
 * Recurrence of closed #64 (exactly one descriptive route `h1`) and #53
 * (a purpose-specific contextual note on every route/tool), scoped to the
 * approved Upload surface. These assertions boot the REAL app through
 * `src/main.ts` (not the surface in isolation) so they cover the route wrapper,
 * both reading modes, and every forced upload phase — the states the audit
 * reproduced the regression across.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UPLOAD_COPY } from '../src/ui/gated-upload';
import { NAV_TABS } from '../src/ui/shell';

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

/** A reviewer-admitting fetch so the gated app shell + route content render. */
function reviewerFetch(): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify({ reviewer_internal_records: [] }),
    json: async () => ({ reviewer_internal_records: [] }),
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.resetModules();
  document.head.replaceChildren();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('fetch', reviewerFetch());
  const root = document.createElement('div');
  root.id = 'app';
  document.body.append(root);
});

/** All heading elements (h1–h6) and their trimmed accessible text. */
function headingNames(): { level: number; text: string }[] {
  return [...document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')].map((h) => ({
    level: Number(h.tagName[1]),
    text: (h.textContent ?? '').trim(),
  }));
}

async function bootUpload(hash: string): Promise<void> {
  window.location.hash = '#/home?reviewer=1';
  await import('../src/main');
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

describe('GOV-2256 Upload route heading + contextual guidance', () => {
  it('renders exactly one descriptive route-level h1 inside the single main', async () => {
    await bootUpload('#/upload?reviewer=1');

    expect(document.querySelectorAll('main').length).toBe(1);
    const h1s = document.querySelectorAll<HTMLElement>('h1');
    expect(h1s.length).toBe(1);
    expect((h1s[0].textContent ?? '').trim()).toBe(UPLOAD_COPY.heading);
    // The route heading is inside the single <main> content region.
    expect(document.querySelector('main')!.contains(h1s[0])).toBe(true);
    // The upload surface itself still renders (the h1 sits above it, not instead of it).
    expect(document.querySelector('[data-test="upload-surface"]')).not.toBeNull();
  });

  it('never duplicates the route heading accessible name across headings', async () => {
    await bootUpload('#/upload?reviewer=1');
    const matches = headingNames().filter((h) => h.text === UPLOAD_COPY.heading);
    expect(matches).toEqual([{ level: 1, text: UPLOAD_COPY.heading }]);
    // The surface no longer carries its own duplicate title heading.
    expect(document.querySelector('.gw-up-heading')).toBeNull();
  });

  it('renders a keyboard- and touch-accessible Upload-specific contextual note', async () => {
    await bootUpload('#/upload?reviewer=1');
    const trigger = document.querySelector<HTMLElement>('[data-info-note="upload-overview"]');
    expect(trigger).not.toBeNull();
    // A real <button> is inherently keyboard-reachable and touch-operable (not a
    // hover-only affordance), with the disclosure ARIA wiring intact.
    expect(trigger!.tagName).toBe('BUTTON');
    expect(trigger!.getAttribute('aria-expanded')).toBe('false');
    expect(trigger!.getAttribute('aria-controls')).toBeTruthy();
    expect(trigger!.getAttribute('aria-label')).toContain('upload');
  });

  it('keeps one h1 + the contextual note across every upload phase', async () => {
    // idle | validating(error) | uploading | received | held — the states the
    // audit swept. Each must carry the heading + note without a second h1.
    for (const ustate of ['idle', 'validating', 'uploading', 'received', 'held', 'error']) {
      await bootUpload(`#/upload?reviewer=1&ustate=${ustate}`);
      const h1s = document.querySelectorAll<HTMLElement>('h1');
      expect(h1s.length, ustate).toBe(1);
      expect((h1s[0].textContent ?? '').trim(), ustate).toBe(UPLOAD_COPY.heading);
      expect(document.querySelector('[data-info-note="upload-overview"]'), ustate).not.toBeNull();
      // No heading anywhere in this phase reuses the route-heading name.
      expect(headingNames().filter((h) => h.text === UPLOAD_COPY.heading).length, ustate).toBe(1);
    }
  });

  it('renders exactly one route h1 in both Simple and Advanced modes', async () => {
    for (const mode of ['simple', 'advanced'] as const) {
      vi.resetModules();
      document.head.replaceChildren();
      document.body.replaceChildren();
      vi.stubGlobal('localStorage', memoryStorage());
      vi.stubGlobal('sessionStorage', memoryStorage());
      vi.stubGlobal('fetch', reviewerFetch());
      localStorage.setItem('gw_home_mode', mode);
      const root = document.createElement('div');
      root.id = 'app';
      document.body.append(root);

      await bootUpload('#/upload?reviewer=1');
      const h1s = document.querySelectorAll<HTMLElement>('h1');
      expect(h1s.length, mode).toBe(1);
      expect((h1s[0].textContent ?? '').trim(), mode).toBe(UPLOAD_COPY.heading);
      expect(document.querySelector('[data-info-note="upload-overview"]'), mode).not.toBeNull();
    }
  });

  it('introduces no dead/false-active nav affordance for the action-only route', async () => {
    // GOV-2256 discoverability decision: Upload is intentionally NOT one of the
    // eight approved primary reading tabs (it is a reviewer action surface, like
    // Alerts/Location header controls). So the route must show NO active primary
    // tab rather than a dead or falsely-highlighted one. See
    // docs/product/route-and-state-matrix.md.
    expect(NAV_TABS.some((t) => t.route === '/upload')).toBe(false);
    await bootUpload('#/upload?reviewer=1');
    expect(document.querySelector('.gw-shell-tab[aria-current="page"]')).toBeNull();
    // The route's identity is carried by its own h1, not a nav tab.
    expect(document.querySelector('[data-test="upload-page-title"]')).not.toBeNull();
  });
});
