// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SENTINEL_ID = 'server-sentinel-001';
const COMPANION_ID = 'server-authorized-companion-002';
const SENTINEL_SOURCE_ID = 'server-source-sentinel-001';
const CAPTURED_FIXTURE_ID = 'alpine_local_corpus:ai:00000064:0021';
const UNAUTHORIZED_DEVICE_ID = 'device-only-not-authorized-999';
const AUTHORIZED_IDS = [SENTINEL_ID, COMPANION_ID] as const;

const SUCCESS_ENVELOPE = {
  reviewer_internal_records: [
    {
      statement_id: SENTINEL_ID,
      statement_text: 'SERVER SENTINEL — Alpine council packet reviewed from the live route.',
      ui_status: 'source-backed',
      verification_status: 'human_verified',
      provenance_status: 'grounded',
      publication_state: 'publishable',
      produced_by: 'human',
      correction_status: 'none',
      confidence_label: 'source_anchored_timed',
      speaker_label: 'Alpine Town Council',
      evidence: [
        {
          to_source_id: SENTINEL_SOURCE_ID,
          relation: 'supports',
          source_type: 'Meeting minutes',
          published_by: 'Town of Alpine',
          jurisdiction: 'Alpine, Wyoming',
          source_date: '2026-07-20',
          original_url: 'https://records.example/sentinel-001',
          verification_status: 'human_verified',
          correction_status: 'none',
        },
      ],
    },
    {
      statement_id: COMPANION_ID,
      statement_text: 'AUTHORIZED COMPANION — a second server row for parity checks.',
      ui_status: 'pending-review',
      verification_status: 'machine_extracted_unreviewed',
      provenance_status: 'unverified',
      publication_state: 'publishable',
      produced_by: 'ai',
      correction_status: 'none',
      confidence_label: 'auto_caption_untimed',
      speaker_label: 'Meeting attendee',
      evidence: [
        {
          to_source_id: 'server-source-companion-001',
          relation: 'supports',
          published_by: 'Town of Alpine',
          original_url: 'https://records.example/companion-001',
          verification_status: 'machine_extracted_unreviewed',
        },
        {
          to_source_id: 'server-source-companion-002',
          relation: 'supports',
          archive_url: 'https://archive.example/companion-002',
          verification_status: 'source_recorded',
        },
      ],
    },
  ],
};

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, String(value)),
  };
}

function responseLike(status: number, body: unknown): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const statusText = new Map<number, string>([
    [200, 'OK'],
    [403, 'Forbidden'],
    [404, 'Not Found'],
    [500, 'Internal Server Error'],
  ]).get(status) ?? 'Error';
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => text,
  } as Response;
}

function replaceHash(hash: string): void {
  window.history.replaceState(null, '', `${window.location.pathname}#${hash}`);
}

async function navigate(hash: string, readySelector: string): Promise<void> {
  replaceHash(hash);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  await vi.waitFor(() => {
    expect(document.querySelector(readySelector), hash).not.toBeNull();
  });
}

function uniqueRecordIds(selector: string): string[] {
  return [...new Set(
    [...document.querySelectorAll<HTMLElement>(selector)]
      .map((node) => node.dataset.recordId ?? '')
      .filter(Boolean),
  )];
}

function expectOnlyAuthorizedIds(selector: string): void {
  expect(uniqueRecordIds(selector)).toEqual([...AUTHORIZED_IDS]);
  expect(document.body.textContent).not.toContain(CAPTURED_FIXTURE_ID);
  expect(document.body.textContent).not.toContain(UNAUTHORIZED_DEVICE_ID);
}

function expectDetailedProjectionGap(id: string): void {
  const gap = document.querySelector<HTMLElement>(
    `[data-test="reviewer-projection-gap"][data-projection="${id}"]`,
  );
  expect(gap, id).not.toBeNull();
  expect(gap?.textContent, id).toContain('Not available yet');
  expect(gap?.textContent, id).toContain('Required backend projection');
  expect(gap?.textContent, id).toContain('How it will work');
  expect(gap?.textContent, id).toContain('Expected result');
  const infoTrigger = gap?.querySelector<HTMLButtonElement>('[data-info-note]');
  expect(infoTrigger?.textContent, id).toBe('?');
  expect(infoTrigger?.getAttribute('aria-label'), id).toContain('How ');
}

function expectRouteInfoNote(id: string, accessibleLabel: string): void {
  const triggers = document.querySelectorAll<HTMLButtonElement>(`[data-info-note="${id}"]`);
  expect(triggers, id).toHaveLength(1);
  const trigger = triggers[0]!;
  expect(trigger.getAttribute('aria-label'), id).toBe(accessibleLabel);
  const panelId = trigger.getAttribute('aria-controls');
  expect(panelId, id).toBeTruthy();
  expect(document.querySelectorAll(`#${panelId}`), id).toHaveLength(1);
  expect(document.getElementById(panelId!)?.textContent, id).toContain('Current state');
  expect(document.getElementById(panelId!)?.textContent, id).toContain('Expected result');
}

interface HomeSnapshot {
  ids: string[];
  receipts: string[];
  uiStatuses: string[];
  provenanceStatuses: string[];
  trust: string[];
  provenance: string[];
}

function homeSnapshot(): HomeSnapshot {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-test="home-live-record"]')];
  return {
    ids: rows.map((row) => row.dataset.recordId ?? ''),
    receipts: rows.map((row) => row.dataset.receiptCount ?? ''),
    uiStatuses: rows.map((row) => row.dataset.uiStatus ?? ''),
    provenanceStatuses: rows.map((row) => row.dataset.provenanceStatus ?? ''),
    trust: [...document.querySelectorAll<HTMLElement>('[data-test="trust-badge"]')]
      .map((node) => node.textContent?.trim() ?? ''),
    provenance: [...document.querySelectorAll<HTMLElement>('[data-test="provenance-badge"]')]
      .map((node) => `${node.dataset.provenance ?? ''}:${node.textContent?.trim() ?? ''}`),
  };
}

function expectNoRejectedCivicRows(): void {
  expect(document.querySelector('[data-test="record-card"]')).toBeNull();
  expect(document.querySelector('[data-record-id]')).toBeNull();
  expect(document.body.textContent).not.toContain(SENTINEL_ID);
  expect(document.body.textContent).not.toContain('SERVER SENTINEL');
  expect(document.body.textContent).not.toContain(CAPTURED_FIXTURE_ID);
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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('shared live reviewer context across canonical routes', () => {
  it('uses one same-origin request while routes, modes, URLs, and device storage can only present or narrow its exact IDs', async () => {
    localStorage.setItem('gw_tracked', JSON.stringify({
      [CAPTURED_FIXTURE_ID]: true,
      [UNAUTHORIZED_DEVICE_ID]: true,
    }));
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      responseLike(200, SUCCESS_ENVELOPE));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    replaceHash('/timeline?reviewer=1&access=reviewer_internal&scope=global&town=Jackson&mode=simple');
    await import('../src/main');
    await vi.waitFor(() => {
      expect(document.querySelectorAll('[data-test="record-card"]')).toHaveLength(2);
      expect(document.body.textContent).toContain('SERVER SENTINEL');
    });

    const reviewerCalls = fetchMock.mock.calls.filter(
      ([input]) => input === '/api/reviewer-internal',
    );
    expect(reviewerCalls).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([input]) => input === '/api/notifications'))
      .toHaveLength(1);
    const [requestUrl, requestInit] = reviewerCalls[0]!;
    expect(requestUrl).toBe('/api/reviewer-internal');
    expect(String(requestUrl)).not.toMatch(/^https?:/);
    expect(requestInit?.credentials).toBe('same-origin');
    expect(requestInit?.signal).toBeInstanceOf(AbortSignal);
    expect(document.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'))
      .toBe('live_server');
    expect(document.body.textContent).not.toContain(CAPTURED_FIXTURE_ID);
    expect(document.querySelector('[data-test="timeline-level-town-unavailable"]')).not.toBeNull();
    expect(document.querySelector('[data-test="timeline-map-unscoped"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Town supplied');
    expect(document.body.textContent).not.toContain('TOWN · ALPINE');
    const advancedTimelineIds = uniqueRecordIds(
      '[data-test="timeline-mode-mount"] [data-record-id]',
    );
    expect(advancedTimelineIds).toEqual([...AUTHORIZED_IDS]);
    document.querySelector<HTMLButtonElement>('[data-test="mode-simple"]')?.click();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-test="timeline-simple"]')).not.toBeNull();
    });
    expect(uniqueRecordIds('[data-test="timeline-mode-mount"] [data-record-id]'))
      .toEqual(advancedTimelineIds);
    document.querySelector<HTMLButtonElement>('[data-test="mode-advanced"]')?.click();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-test="timeline-advanced-lanes"]')).not.toBeNull();
    });
    expect(uniqueRecordIds('[data-test="timeline-mode-mount"] [data-record-id]'))
      .toEqual(advancedTimelineIds);

    await navigate('/timeline?reviewer=1&state=loading', '[data-test="timeline-map"]');
    expect(document.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'))
      .toBe('live_server');
    expect(document.querySelector('[data-test="fixture-banner"]')).toBeNull();

    await navigate(
      '/home?reviewer=1&access=reviewer_internal&scope=global&town=Jackson&mode=simple',
      '[data-test="home-live-advanced"]',
    );
    expectOnlyAuthorizedIds('[data-test="home-live-record"]');
    expect(document.body.textContent).toContain('SERVER SENTINEL');
    const advanced = homeSnapshot();
    expect(advanced.receipts).toEqual(['1', '2']);
    expect(advanced.uiStatuses).toEqual(['source-backed', 'pending-review']);
    expect(advanced.provenanceStatuses).toEqual(['grounded', 'unverified']);
    expectDetailedProjectionGap('plan-entitlements');
    expectDetailedProjectionGap('geography-coverage');

    const simpleButton = document.querySelector<HTMLButtonElement>('[data-test="mode-simple"]');
    expect(simpleButton).not.toBeNull();
    simpleButton?.click();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-test="home-live-simple"]')).not.toBeNull();
    });
    const simple = homeSnapshot();
    expect(simple).toEqual(advanced);
    expect(fetchMock.mock.calls.filter(([input]) => input === '/api/reviewer-internal'))
      .toHaveLength(1);

    document.querySelector<HTMLButtonElement>('[data-test="mode-advanced"]')?.click();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-test="home-live-advanced"]')).not.toBeNull();
    });
    expect(homeSnapshot()).toEqual(advanced);

    await navigate('/app?reviewer=1', '[data-projection="agenda-board"]');
    expectDetailedProjectionGap('agenda-board');

    await navigate('/boards?reviewer=1', '[data-test="boards-advanced-workbench"]');
    expect(document.body.textContent).not.toContain(CAPTURED_FIXTURE_ID);

    await navigate(
      '/power?reviewer=1&access=reviewer_internal&scope=global&town=Jackson',
      '[data-test="power-real-advanced-workbench"]',
    );
    expectOnlyAuthorizedIds('[data-test="power-real-record"]');
    expect(document.body.textContent).toContain('SERVER SENTINEL');

    await navigate('/vault?reviewer=1', '[data-test="source-vault-list"]');
    expect(
      document.querySelector(`[data-test="source-vault-row"][data-source-id="${SENTINEL_SOURCE_ID}"]`),
    ).not.toBeNull();
    expect(document.body.textContent).not.toContain(CAPTURED_FIXTURE_ID);
    expect(document.querySelector('[data-test="supplied-files"][data-state="empty"]')).not.toBeNull();
    expect(document.querySelector('[data-test="supplied-file-row"]')).toBeNull();
    expect(document.querySelector('[data-test="supersede-view"][data-state="empty"]')).not.toBeNull();
    expect(document.querySelector('[data-test="supersede-row"]')).toBeNull();
    expect(document.querySelector('[data-file-id="sf_2f1a9c"]')).toBeNull();

    await navigate('/vault?reviewer=1&demo=sample', '[data-test="supplied-file-row"]');
    expect(document.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'))
      .toBe('fixture');
    expect(document.querySelector('[data-test="fixture-banner"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-test="supplied-file-row"]')).toHaveLength(2);
    expect(document.querySelector('[data-file-id="sf_2f1a9c"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-test="supersede-row"]')).toHaveLength(2);
    expect(document.querySelector('[data-supersede-id="sup_148_packet"]')).not.toBeNull();

    await navigate('/upload?reviewer=1', '[data-test="upload-form"]');
    expect(document.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'))
      .toBe('live_server');
    expect(document.querySelector('[data-test="upload-submit"]')).not.toBeNull();
    expect(document.body.textContent).toContain('does not publish');

    await navigate('/newsletter?reviewer=1', '[data-projection="newsletter-digest"]');
    expectDetailedProjectionGap('newsletter-digest');

    await navigate('/watchlist?reviewer=1', '[data-test="watchlist-real-advanced-workbench"]');
    expectOnlyAuthorizedIds('[data-test="watchlist-real-candidate"]');
    expect(document.querySelector('[data-test="watchlist-unresolved-local"]')?.textContent)
      .toContain('2 device-local keys');

    await navigate('/alerts?reviewer=1', '[data-test="alerts-real-advanced-workbench"]');
    expect(document.querySelector('[data-test="alerts-real-tracked-count"]')?.textContent)
      .toContain('0 locally stored keys match reviewed records');
    expect(document.body.textContent).not.toContain(UNAUTHORIZED_DEVICE_ID);

    await navigate('/topics?reviewer=1', '[data-projection="topic-tree"]');
    expectDetailedProjectionGap('topic-tree');
    expectRouteInfoNote('topics-overview', 'About the Topics tree');
    expect(document.querySelectorAll('[data-test="shell-content"] h1')).toHaveLength(1);
    expect(document.querySelector('[data-test="shell-content"] h1')?.textContent)
      .toBe('Topics');
    expect(document.querySelector('[data-test="topics-page"] h1')).toBeNull();
    expect(document.querySelector('[data-test="topics-page"] h2')).not.toBeNull();
    expect(document.querySelector('[data-test="topics-timeline"] h1')).toBeNull();
    expect(document.querySelector('[data-test="topics-timeline"] h2')?.textContent)
      .toBe('Alpine timeline (reviewer-internal)');
    expect(document.body.textContent).toContain('SERVER SENTINEL');
    expect(document.querySelectorAll('[data-test="record-card"]')).toHaveLength(2);

    await navigate(
      '/location?reviewer=1&access=reviewer_internal&scope=global&town=Jackson',
      '[data-test="location-real-advanced-workbench"]',
    );
    expectOnlyAuthorizedIds('[data-test="location-real-record"]');
    expect(document.body.textContent).toContain('SERVER SENTINEL');

    localStorage.setItem('gw_location', JSON.stringify({
      state: 'Wyoming',
      county: 'Teton County',
      region: '',
      town: 'Jackson',
    }));
    await navigate(
      '/location?reviewer=1&access=reviewer_internal&scope=global&town=Alpine',
      '[data-test="location-records-unavailable"]',
    );
    expect(document.querySelector('[data-test="location-real-record"]')).toBeNull();
    expect(document.body.textContent).not.toContain('SERVER SENTINEL');
    expect(document.body.textContent).toContain('Jackson');

    localStorage.setItem('gw_location', JSON.stringify({
      state: 'Wyoming',
      county: 'Lincoln County',
      region: '',
      town: 'Alpine',
    }));
    await navigate(
      '/location?reviewer=1&access=reviewer_internal&scope=global&town=Jackson',
      '[data-test="location-real-record"]',
    );
    expectOnlyAuthorizedIds('[data-test="location-real-record"]');

    await navigate('/home?reviewer=1&access=public&scope=global&town=Jackson', '[data-test="reviewer-context-denied"]');
    expectNoRejectedCivicRows();

    await navigate(
      '/home?reviewer=1&access=reviewer_internal&scope=global&town=Jackson&mode=simple',
      '[data-test="home-live-advanced"]',
    );
    expectOnlyAuthorizedIds('[data-test="home-live-record"]');
    expect(fetchMock.mock.calls.filter(([input]) => input === '/api/reviewer-internal'))
      .toHaveLength(1);

    await navigate('/agenda?reviewer=1', '[data-projection="agenda-board"]');
    expectDetailedProjectionGap('agenda-board');
    expect(document.body.textContent).not.toContain(CAPTURED_FIXTURE_ID);

    await navigate(`/issue?reviewer=1&id=${SENTINEL_ID}`, '[data-test="issue-dossier-card"]');
    expect(document.querySelector('[data-test="issue-dossier-card"]')?.getAttribute('data-id'))
      .toBe(SENTINEL_ID);
    expect(document.body.textContent).not.toContain(CAPTURED_FIXTURE_ID);

    await navigate('/sources?reviewer=1', '[data-test="source-vault-list"]');
    expect(
      document.querySelector(`[data-test="source-vault-row"][data-source-id="${SENTINEL_SOURCE_ID}"]`),
    ).not.toBeNull();

    await navigate('/agenda-boards?reviewer=1', '[data-projection="agenda-board"]');
    expectDetailedProjectionGap('agenda-board');

    await navigate('/timeline-legacy?reviewer=1', '[data-test="record-card"]');
    expectOnlyAuthorizedIds('[data-test="record-card"]');
    expectRouteInfoNote('legacy-timeline-overview', 'About the legacy Timeline view');

    await navigate('/cards?reviewer=1', '[data-test="record-card"]');
    expectOnlyAuthorizedIds('[data-test="record-card"]');
    expectRouteInfoNote('cards-overview', 'About the reviewed Cards view');

    await navigate('/body?reviewer=1', '[data-test="body-unscoped-records"]');
    expectDetailedProjectionGap('government-body-relationship');
    expectRouteInfoNote('body-overview', 'About Government Body context');
    expectOnlyAuthorizedIds('[data-test="body-unscoped-records"] [data-test="record-card"]');
    expect(document.querySelector('[data-test="body-unscoped-records"]')?.getAttribute('data-relationship'))
      .toBe('unscoped');
    expect(document.querySelector('[data-test="body-unscoped-records"] h2')?.textContent)
      .toContain('not assigned to this government body');

    await navigate('/meeting?reviewer=1', '[data-test="meeting-unscoped-records"]');
    expectDetailedProjectionGap('meeting-relationship');
    expectRouteInfoNote('meeting-overview', 'About Meeting context');
    expectOnlyAuthorizedIds('[data-test="meeting-unscoped-records"] [data-test="record-card"]');
    expect(document.querySelector('[data-test="meeting-unscoped-records"] h2')?.textContent)
      .toContain('not assigned to this meeting');

    await navigate('/cards?reviewer=1&state=loading', '[data-test="state-loading"]');
    expect(document.querySelector('[data-test="shell-origin-banner"]')?.getAttribute('data-origin'))
      .toBe('fixture');
    expectNoRejectedCivicRows();
    expect(fetchMock.mock.calls.filter(([input]) => input === '/api/reviewer-internal'))
      .toHaveLength(1);
  });

  it.each([
    [
      '/topics?reviewer=1&access=public',
      '[data-test="reviewer-context-denied"]',
      'topics-overview',
      'About the Topics tree',
    ],
    [
      '/body?reviewer=1&access=public',
      '[data-test="reviewer-context-denied"]',
      'body-overview',
      'About Government Body context',
    ],
    [
      '/meeting?reviewer=1&access=public',
      '[data-test="reviewer-context-denied"]',
      'meeting-overview',
      'About Meeting context',
    ],
    [
      '/cards?reviewer=1&access=public',
      '[data-test="state-empty"]',
      'cards-overview',
      'About the reviewed Cards view',
    ],
    [
      '/timeline-legacy?reviewer=1&access=public',
      '[data-test="state-empty"]',
      'legacy-timeline-overview',
      'About the legacy Timeline view',
    ],
  ] as const)(
    'keeps the private %s route explanation out of a direct public response',
    async (route, readySelector, noteId, privateLabel) => {
      const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        responseLike(200, SUCCESS_ENVELOPE));
      vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

      replaceHash(route);
      await import('../src/main');
      await vi.waitFor(() => {
        expect(document.querySelector(readySelector), route).not.toBeNull();
      });

      expect(document.querySelector(`[data-info-note="${noteId}"]`), route).toBeNull();
      expect(document.body.textContent, route).not.toContain(privateLabel);
      expectNoRejectedCivicRows();
    },
  );

  it('keeps Alpine authoritative over a saved town and gives every live route one h1', async () => {
    localStorage.setItem('gw_location', JSON.stringify({
      state: 'Wyoming',
      county: 'Teton County',
      region: '',
      town: 'Jackson',
    }));
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      responseLike(200, SUCCESS_ENVELOPE));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    replaceHash('/home?reviewer=1');
    await import('../src/main');
    await vi.waitFor(() => {
      expect(document.querySelector('[data-test="home-live-advanced"]')).not.toBeNull();
    });
    const location = document.querySelector<HTMLElement>('[data-test="shell-jurisdiction"]');
    expect(location?.dataset.authoritativeContext).toBe('alpine');
    expect(location?.querySelector('.gw-shell-location-primary')?.textContent)
      .toBe('Alpine endpoint');
    expect(location?.querySelector('.gw-shell-location-saved')?.textContent)
      .toBe('Saved view: Jackson, Wyoming');
    expectOnlyAuthorizedIds('[data-test="home-live-record"]');
    expect(document.querySelectorAll('[data-test="shell-content"] h1')).toHaveLength(1);

    document.querySelector<HTMLButtonElement>('[data-test="mode-simple"]')?.click();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-test="home-live-simple"]')).not.toBeNull();
    });
    expect(document.querySelectorAll('[data-test="shell-content"] h1')).toHaveLength(1);
    expect(document.querySelector('[data-test="shell-content"] h1')?.textContent)
      .toBe('Government Watchdog Weekly');

    document.querySelector<HTMLButtonElement>('[data-test="mode-advanced"]')?.click();
    await navigate('/timeline?reviewer=1', '[data-test="timeline-map"]');
    expect(document.querySelectorAll('[data-test="shell-content"] h1')).toHaveLength(1);
    expect(document.querySelector('[data-test="shell-jurisdiction"]')?.textContent)
      .toContain('Alpine endpoint');
    expectOnlyAuthorizedIds('[data-test="timeline-mode-mount"] [data-test="record-card"]');

    for (const [route, selector, heading] of [
      ['/app?reviewer=1', '[data-projection="agenda-board"]', 'Agenda board not available yet'],
      ['/agenda?reviewer=1', '[data-projection="agenda-board"]', 'Agenda board not available yet'],
      ['/agenda-boards?reviewer=1', '[data-projection="agenda-board"]', 'Agenda board not available yet'],
      ['/newsletter?reviewer=1', '[data-projection="newsletter-digest"]', 'Newsletter digest not available yet'],
      ['/body?reviewer=1', '[data-test="body-unscoped-records"]', 'Government body'],
      ['/meeting?reviewer=1', '[data-test="meeting-unscoped-records"]', 'Meeting record'],
    ] as const) {
      await navigate(route, selector);
      const headings = document.querySelectorAll('[data-test="shell-content"] h1');
      expect(headings, route).toHaveLength(1);
      expect(headings[0]?.textContent, route).toContain(heading);
    }
    expect(fetchMock.mock.calls.filter(([input]) => input === '/api/reviewer-internal'))
      .toHaveLength(1);
  });
});

describe('shared reviewer-context route failures', () => {
  const unsafeEnvelope = {
    reviewer_internal_records: [
      {
        ...SUCCESS_ENVELOPE.reviewer_internal_records[0],
        evidence: [
          {
            ...SUCCESS_ENVELOPE.reviewer_internal_records[0].evidence[0],
            original_url: '/Users/reviewer/private.pdf',
          },
        ],
      },
    ],
  };

  it.each([
    ['403', 403, SUCCESS_ENVELOPE, 'denied'],
    ['404', 404, SUCCESS_ENVELOPE, 'unavailable'],
    ['500', 500, SUCCESS_ENVELOPE, 'unavailable'],
    [
      'malformed JSON',
      200,
      `{"reviewer_internal_records":[{"statement_id":"${SENTINEL_ID}"`,
      'invalid',
    ],
    ['unsafe payload', 200, unsafeEnvelope, 'invalid'],
  ] as const)(
    '%s is cached as %s-safe state and never falls back to captured civic rows',
    async (_label, status, body, expectedState) => {
      const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        responseLike(status, body));
      vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

      replaceHash('/timeline?reviewer=1');
      await import('../src/main');
      await vi.waitFor(() => {
        expect(
          document.querySelector(`[data-test="reviewer-context-${expectedState}"]`),
        ).not.toBeNull();
      });
      expectNoRejectedCivicRows();

      await navigate(
        '/home?reviewer=1&access=reviewer_internal&scope=global&town=Jackson&mode=advanced',
        `[data-test="reviewer-context-${expectedState}"]`,
      );
      expectNoRejectedCivicRows();
      const reviewerCalls = fetchMock.mock.calls.filter(
        ([input]) => input === '/api/reviewer-internal',
      );
      expect(reviewerCalls).toHaveLength(1);
      expect(reviewerCalls[0]?.[1]?.credentials).toBe('same-origin');
    },
  );

  it('times out one stalled shared request and keeps every later route unavailable with zero rows', async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (input === '/api/reviewer-internal') {
        requestSignal = init?.signal ?? undefined;
      }
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    replaceHash('/timeline?reviewer=1');
    await import('../src/main');
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock.mock.calls.filter(([input]) => input === '/api/reviewer-internal'))
      .toHaveLength(1);
    expect(document.querySelector('[data-test="reviewer-context-loading"]')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(8_001);
    expect(requestSignal?.aborted).toBe(true);
    expect(document.querySelector('[data-test="reviewer-context-unavailable"]')).not.toBeNull();
    expectNoRejectedCivicRows();

    replaceHash('/location?reviewer=1&scope=global&town=Jackson');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-test="reviewer-context-unavailable"]')).not.toBeNull();
    expectNoRejectedCivicRows();
    const reviewerCalls = fetchMock.mock.calls.filter(
      ([input]) => input === '/api/reviewer-internal',
    );
    expect(reviewerCalls).toHaveLength(1);
    expect(reviewerCalls[0]?.[1]?.credentials).toBe('same-origin');
  });
});
