// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_NOTIFICATIONS,
  loadNotifications,
  normalizeNotificationEnvelope,
  readNotificationsConfig,
  type LoadNotificationsResult,
} from '../src/data/notifications';
import {
  mountNotificationPanel,
  renderNotificationList,
} from '../src/ui/notification-panel';
import type { NotificationResponse } from '../src/types/notification';

const LIVE_RESPONSE: NotificationResponse = {
  unread_count: 11,
  notifications: [
    {
      id: 'server-account-event-1',
      kind: 'account_approved',
      title: 'Server title',
      body: 'Server body',
      created_utc: '2026-07-24T16:00:00Z',
      read: false,
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function installMemoryLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  });
}

let root: HTMLElement;
beforeEach(() => {
  installMemoryLocalStorage();
  document.head.replaceChildren();
  document.body.replaceChildren();
  window.history.replaceState({}, '', '/');
  root = document.createElement('div');
  document.body.append(root);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('issue #52 — live notification transport fails closed', () => {
  for (const status of [401, 403] as const) {
    it(`maps HTTP ${status} to denied with zero unread and no sample`, async () => {
      const result = await loadNotifications({
        config: { mode: 'live', apiPath: '/api/notifications' },
        fetchImpl: vi.fn(async () => jsonResponse({ error: 'secret detail' }, status)) as unknown as typeof fetch,
      });

      expect(result.state).toBe('denied');
      expect(result.data).toBe(EMPTY_NOTIFICATIONS);
      expect(result.data.unread_count).toBe(0);
      expect(JSON.stringify(result)).not.toMatch(/secret detail|ntf_sample|approved|revoked/i);
    });
  }

  for (const status of [404, 500] as const) {
    it(`maps HTTP ${status} to unavailable with zero unread and no sample`, async () => {
      const result = await loadNotifications({
        config: { mode: 'live', apiPath: '/api/notifications' },
        fetchImpl: vi.fn(async () => new Response('server detail', { status })) as unknown as typeof fetch,
      });

      expect(result.state).toBe('unavailable');
      expect(result.data).toBe(EMPTY_NOTIFICATIONS);
      expect(JSON.stringify(result)).not.toMatch(/server detail|ntf_sample|cohort|consent/i);
    });
  }

  it('uses same-origin credentials, refuses redirects, and passes an abort signal', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(LIVE_RESPONSE)) as unknown as typeof fetch;
    const result = await loadNotifications({
      config: { mode: 'live', apiPath: '/api/notifications' },
      fetchImpl,
    });

    expect(result.state).toBe('ready');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(url).toBe('/api/notifications');
    expect(init).toEqual(expect.objectContaining({
      credentials: 'same-origin',
      redirect: 'error',
      headers: { accept: 'application/json' },
      signal: expect.any(AbortSignal),
    }));
  });

  it('accepts the backend UTC timestamp form with a +00:00 offset', async () => {
    const backendResponse = {
      ...LIVE_RESPONSE,
      notifications: [{
        ...LIVE_RESPONSE.notifications[0],
        created_utc: '2026-07-24T16:00:00.000+00:00',
      }],
    };
    const result = await loadNotifications({
      config: { mode: 'live', apiPath: '/api/notifications' },
      fetchImpl: vi.fn(async () => jsonResponse(backendResponse)) as unknown as typeof fetch,
    });

    expect(result.state).toBe('ready');
    expect(result.data.notifications[0]?.created_utc)
      .toBe('2026-07-24T16:00:00.000+00:00');
  });

  it('rejects cross-origin or network-path configuration before fetch', async () => {
    for (const apiPath of [
      'https://evil.example/notifications',
      '//evil.example/notifications',
      '/api/notifications?next=https://evil.example',
      '/api%2f%2fevil.example/notifications',
    ]) {
      const fetchImpl = vi.fn() as unknown as typeof fetch;
      const result = await loadNotifications({
        config: { mode: 'live', apiPath },
        fetchImpl,
      });
      expect(result.state, apiPath).toBe('invalid');
      expect(result.data, apiPath).toBe(EMPTY_NOTIFICATIONS);
      expect(fetchImpl, apiPath).not.toHaveBeenCalled();
    }
  });

  it('maps a rejected request or missing fetch runtime to unavailable', async () => {
    const rejected = await loadNotifications({
      config: { mode: 'live', apiPath: '/api/notifications' },
      fetchImpl: vi.fn(async () => {
        throw new Error('private network detail');
      }) as unknown as typeof fetch,
    });
    const missing = await loadNotifications({
      config: { mode: 'live', apiPath: '/api/notifications' },
      fetchImpl: null,
    });

    for (const result of [rejected, missing]) {
      expect(result.state).toBe('unavailable');
      expect(result.data).toBe(EMPTY_NOTIFICATIONS);
      expect(JSON.stringify(result)).not.toContain('private network detail');
    }
  });

  it('bounds the entire request and aborts a fetch that never resolves', async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    }) as unknown as typeof fetch;
    const pending = loadNotifications({
      config: { mode: 'live', apiPath: '/api/notifications' },
      fetchImpl,
      timeoutMs: 25,
    });

    await vi.advanceTimersByTimeAsync(25);
    const result = await pending;
    expect(result.state).toBe('unavailable');
    expect(result.data).toBe(EMPTY_NOTIFICATIONS);
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('rejects malformed JSON, non-JSON bodies, and unsafe raw locators', async () => {
    const cases: Response[] = [
      new Response('{broken', { status: 200, headers: { 'content-type': 'application/json' } }),
      new Response(JSON.stringify(LIVE_RESPONSE), { status: 200, headers: { 'content-type': 'text/html' } }),
      jsonResponse({
        ...LIVE_RESPONSE,
        debug: { raw_local_path: '/Users/reviewer/private.json' },
      }),
      jsonResponse({
        ...LIVE_RESPONSE,
        debug: { locator: 'file:///etc/private-account-state' },
      }),
      jsonResponse({
        ...LIVE_RESPONSE,
        debug: { locator: 'file:/etc/private-account-state' },
      }),
      jsonResponse({
        ...LIVE_RESPONSE,
        debug: { locator: '\\\\reviewer-server\\private-share' },
      }),
      jsonResponse({
        ...LIVE_RESPONSE,
        debug: { locator: 'See C:\\private\\account-state.json' },
      }),
    ];

    for (const response of cases) {
      const result = await loadNotifications({
        config: { mode: 'live', apiPath: '/api/notifications' },
        fetchImpl: vi.fn(async () => response) as unknown as typeof fetch,
      });
      expect(result.state).toBe('invalid');
      expect(result.data).toBe(EMPTY_NOTIFICATIONS);
    }
  });
});

describe('issue #52 — strict allowlisted notification contract', () => {
  it('keeps only allowlisted fields and preserves the authoritative server count', () => {
    const normalized = normalizeNotificationEnvelope({
      unread_count: 11,
      server_debug: 'ignored safe additive field',
      notifications: [{
        ...LIVE_RESPONSE.notifications[0],
        untrusted_extra: 'ignored safe additive field',
      }],
    });

    expect(normalized).toEqual(LIVE_RESPONSE);
    expect(normalized.unread_count).toBe(11);
    expect(Object.keys(normalized)).toEqual(['notifications', 'unread_count']);
    expect(Object.keys(normalized.notifications[0]!)).toEqual([
      'id',
      'kind',
      'title',
      'body',
      'created_utc',
      'read',
    ]);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.notifications)).toBe(true);
    expect(Object.isFrozen(normalized.notifications[0]!)).toBe(true);
  });

  it('accepts a valid empty server response as the designed empty state', async () => {
    const result = await loadNotifications({
      config: { mode: 'live', apiPath: '/api/notifications' },
      fetchImpl: vi.fn(async () => jsonResponse({
        notifications: [],
        unread_count: 0,
      })) as unknown as typeof fetch,
    });

    expect(result).toEqual({
      state: 'ready',
      data: { notifications: [], unread_count: 0 },
    });
    root.append(renderNotificationList(result));
    expect(root.querySelector('[data-test="notification-empty"]')?.textContent)
      .toMatch(/caught up/i);
    expect(root.querySelector('[data-test="notification-unavailable"]')).toBeNull();
  });

  it('rejects the whole response for unknown kinds, duplicate IDs, bad timestamps, wrong booleans, or invalid counts', async () => {
    const invalidBodies = [
      {
        ...LIVE_RESPONSE,
        notifications: [{ ...LIVE_RESPONSE.notifications[0], kind: 'civic_alert' }],
      },
      {
        ...LIVE_RESPONSE,
        notifications: [LIVE_RESPONSE.notifications[0], LIVE_RESPONSE.notifications[0]],
      },
      {
        ...LIVE_RESPONSE,
        notifications: [{ ...LIVE_RESPONSE.notifications[0], created_utc: 'yesterday' }],
      },
      {
        ...LIVE_RESPONSE,
        notifications: [{ ...LIVE_RESPONSE.notifications[0], created_utc: '2026-02-31T00:00:00Z' }],
      },
      {
        ...LIVE_RESPONSE,
        notifications: [{ ...LIVE_RESPONSE.notifications[0], created_utc: '2026-07-24T10:00:00-06:00' }],
      },
      {
        ...LIVE_RESPONSE,
        notifications: [{ ...LIVE_RESPONSE.notifications[0], read: 'false' }],
      },
      { ...LIVE_RESPONSE, unread_count: -1 },
      { ...LIVE_RESPONSE, unread_count: 1.5 },
    ];

    for (const body of invalidBodies) {
      const result = await loadNotifications({
        config: { mode: 'live', apiPath: '/api/notifications' },
        fetchImpl: vi.fn(async () => jsonResponse(body)) as unknown as typeof fetch,
      });
      expect(result.state).toBe('invalid');
      expect(result.data).toBe(EMPTY_NOTIFICATIONS);
    }
  });

  it('allows explicit development demo injection but production ignores every browser-style control', async () => {
    const dev = readNotificationsConfig({
      DEV: true,
      PROD: false,
      VITE_NOTIFICATIONS_DEMO: 'true',
    });
    expect(dev.mode).toBe('demo');
    const demo = await loadNotifications({
      config: dev,
      demoLoader: async () => LIVE_RESPONSE,
    });
    expect(demo.state).toBe('demo');
    expect(demo.notice).toMatch(/DEVELOPMENT SAMPLE/i);

    localStorage.setItem('VITE_NOTIFICATIONS_DEMO', 'true');
    localStorage.setItem('gw_home_mode', 'advanced');
    window.history.replaceState({}, '', '/#/home?demo=notifications');
    const production = readNotificationsConfig({
      DEV: false,
      PROD: true,
      VITE_USE_FIXTURES: 'true',
      VITE_NOTIFICATIONS_DEMO: 'true',
      VITE_NOTIFICATIONS_API_URL: 'https://evil.example/notifications',
      MODE: 'demo',
    });
    expect(production).toEqual({ mode: 'live', apiPath: '/api/notifications' });
  });
});

describe('issue #52 — bell, drawer, note, and async ordering', () => {
  it.each(['denied', 'unavailable', 'invalid'] as const)(
    'shows %s with zero badge, zero rows, and no misleading empty claim',
    async (state) => {
      const result: LoadNotificationsResult = {
        state,
        data: EMPTY_NOTIFICATIONS,
        notice: `Fixed ${state} explanation. No sample account activity was substituted.`,
      };
      const bell = mountNotificationPanel(root, {
        load: vi.fn(async () => result),
      });
      await settle();

      const badge = root.querySelector<HTMLElement>('[data-test="notification-badge"]')!;
      expect(badge.hidden).toBe(true);
      expect(bell.getAttribute('aria-label')).toBe('Notifications unavailable');
      bell.click();
      await settle();
      expect(root.querySelector('[data-test="notification-unread-count"]')?.textContent)
        .toBe('Count unavailable');
      expect(root.querySelector('[data-test="notification-unavailable"]')).not.toBeNull();
      expect(root.querySelector('[data-test="notification-empty"]')).toBeNull();
      expect(root.querySelector('[data-test="notification-item"]')).toBeNull();
      expect(root.textContent).not.toMatch(/Beta access approved|cohort advanced|preference saved/i);
    },
  );

  it('labels demo beside the closed bell and never presents its count as a live badge', async () => {
    const bell = mountNotificationPanel(root, {
      load: vi.fn(async () => ({
        state: 'demo' as const,
        data: LIVE_RESPONSE,
        notice: 'DEVELOPMENT SAMPLE — not live.',
      })),
    });
    await settle();

    expect(root.querySelector<HTMLElement>('[data-test="notification-demo-chip"]')?.hidden)
      .toBe(false);
    expect(root.querySelector<HTMLElement>('[data-test="notification-badge"]')?.hidden)
      .toBe(true);
    expect(bell.getAttribute('aria-label')).toMatch(/development sample/i);
    bell.click();
    await settle();
    expect(root.querySelector('[data-test="notification-notice"]')?.textContent)
      .toMatch(/DEVELOPMENT SAMPLE/);
    expect(root.querySelector('[data-test="notification-unread-count"]')?.textContent)
      .toBe('11 sample unread');
  });

  it('converts an unexpected injected loader rejection into an unavailable state', async () => {
    const bell = mountNotificationPanel(root, {
      load: vi.fn(async () => {
        throw new Error('raw private failure');
      }),
    });
    await settle();
    bell.click();
    await settle();

    expect(root.querySelector('[data-test="notification-badge"]')?.hasAttribute('hidden'))
      .toBe(true);
    expect(root.querySelector('[data-test="notification-unavailable"]')).not.toBeNull();
    expect(root.textContent).not.toContain('raw private failure');
  });

  it('names the dialog while loading and does not steal focus on outside dismissal', async () => {
    vi.useFakeTimers();
    const load = vi.fn(() => new Promise<LoadNotificationsResult>(() => undefined));
    const bell = mountNotificationPanel(root, { load });
    const outside = document.createElement('button');
    outside.textContent = 'Search';
    root.append(outside);

    bell.click();
    expect(root.querySelector('[data-test="notification-drawer"]')?.getAttribute('aria-label'))
      .toBe('Notifications');
    const drawerBody = root.querySelector('[data-test="notification-drawer-body"]');
    expect(drawerBody?.getAttribute('aria-busy'))
      .toBe('true');
    expect(drawerBody?.hasAttribute('aria-live')).toBe(false);
    await vi.runOnlyPendingTimersAsync();
    outside.focus();
    outside.click();

    expect(root.querySelector('[data-test="notification-drawer"]')?.hasAttribute('hidden'))
      .toBe(true);
    expect(document.activeElement).toBe(outside);
  });

  it('does not let a stale badge-prime response overwrite a newer drawer result', async () => {
    let resolveFirst!: (result: LoadNotificationsResult) => void;
    const first = new Promise<LoadNotificationsResult>((resolve) => {
      resolveFirst = resolve;
    });
    const newer: LoadNotificationsResult = {
      state: 'unavailable',
      data: EMPTY_NOTIFICATIONS,
      notice: 'Notifications are temporarily unavailable.',
    };
    const load = vi.fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(newer);
    const bell = mountNotificationPanel(root, { load });
    bell.click();
    await settle();
    resolveFirst({ state: 'ready', data: LIVE_RESPONSE });
    await settle();

    expect(root.querySelector('[data-test="notification-badge"]')?.hasAttribute('hidden'))
      .toBe(true);
    expect(bell.getAttribute('aria-label')).toBe('Notifications unavailable');
    expect(root.querySelector('[data-test="notification-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-test="notification-item"]')).toBeNull();
  });

  it('clears prior rows and marks the drawer busy before a reopen refresh resolves', async () => {
    let resolveRefresh!: (result: LoadNotificationsResult) => void;
    const pendingRefresh = new Promise<LoadNotificationsResult>((resolve) => {
      resolveRefresh = resolve;
    });
    const ready: LoadNotificationsResult = { state: 'ready', data: LIVE_RESPONSE };
    const load = vi.fn()
      .mockResolvedValueOnce(ready)
      .mockResolvedValueOnce(ready)
      .mockReturnValueOnce(pendingRefresh);
    const bell = mountNotificationPanel(root, { load });
    await settle();

    bell.click();
    await settle();
    expect(root.querySelector('[data-test="notification-item"]')).not.toBeNull();
    bell.click();
    bell.click();

    const body = root.querySelector<HTMLElement>('[data-test="notification-drawer-body"]')!;
    expect(body.getAttribute('aria-busy')).toBe('true');
    expect(root.querySelector<HTMLElement>('[data-test="notification-badge"]')?.hidden)
      .toBe(true);
    expect(root.querySelector<HTMLElement>('[data-test="notification-demo-chip"]')?.hidden)
      .toBe(true);
    expect(bell.getAttribute('aria-label')).toBe('Notifications loading');
    expect(root.querySelector('[data-test="notification-loading"]')?.textContent)
      .toMatch(/Refreshing account notifications/);
    expect(root.querySelector('[data-test="notification-item"]')).toBeNull();

    resolveRefresh({
      state: 'unavailable',
      data: EMPTY_NOTIFICATIONS,
      notice: 'Notifications are temporarily unavailable.',
    });
    await settle();
    expect(body.hasAttribute('aria-busy')).toBe(false);
    expect(root.querySelector('[data-test="notification-unavailable"]')).not.toBeNull();
  });
});
