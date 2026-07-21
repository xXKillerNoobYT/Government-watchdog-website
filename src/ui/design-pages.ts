/**
 * Synthetic, reviewer-only implementations of the four design-handoff routes
 * that do not yet have production data contracts.
 *
 * The prototype bundle is a visual/interaction reference, not a source of civic
 * facts. These renderers therefore fail closed unless the caller explicitly
 * supplies BOTH reviewer-internal access and fixture consent. Every populated
 * surface is visibly labelled, and every persisted interaction is device-local.
 */

import { applyMode, readMode } from './shell';
import type { ShellMode } from './shell';
import { applyThemePref, hasExplicitThemePref } from './theme-toggle';
import { GW_TOKENS } from './tokens';

export interface DesignPageOptions {
  access?: string;
  fixture?: boolean;
}

export interface SavedLocation {
  state: string;
  county: string;
  region: string;
  town: string;
}

export const DESIGN_FIXTURE_LABEL = 'SYNTHETIC DESIGN FIXTURE — not a live read';
export const TRACKED_STORAGE_KEY = 'gw_tracked';
export const LOCATION_STORAGE_KEY = 'gw_location';
export const ALERTS_READ_STORAGE_KEY = 'gw_alerts_read';
export const DELIVERY_PREVIEW_STORAGE_KEY = 'gw_alert_delivery_preview';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function readStoredJson(key: string): unknown {
  try {
    const value = localStorage.getItem(key);
    return value === null ? null : JSON.parse(value);
  } catch {
    return null;
  }
}

function writeStoredJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage can be unavailable; the current rendered interaction still works. */
  }
}

function hasFixtureAccess(options: DesignPageOptions): boolean {
  return options.access === 'reviewer_internal' && options.fixture === true;
}

function syncUnpinnedPalette(mode: ShellMode): void {
  if (hasExplicitThemePref()) return;
  applyThemePref(mode === 'advanced' ? 'dark' : 'light');
}

interface PageFrame {
  page: HTMLElement;
  content: HTMLElement;
  mode: ShellMode;
}

function fixtureBanner(): HTMLElement {
  return el('div', {
    class: 'gw-dp-fixture',
    role: 'status',
    'data-test': 'design-fixture-banner',
  }, [DESIGN_FIXTURE_LABEL]);
}

function modeToggle(mode: ShellMode, rerender: () => void): HTMLElement {
  const group = el('div', {
    class: 'gw-dp-mode',
    role: 'group',
    'aria-label': 'Reading mode',
    'data-test': 'design-mode-toggle',
  });

  for (const value of ['simple', 'advanced'] as const) {
    const button = el('button', {
      type: 'button',
      class: 'gw-dp-mode-button',
      'data-test': `design-mode-${value}`,
      'aria-pressed': String(mode === value),
    }, [value === 'simple' ? 'Simple' : 'Advanced']);
    button.addEventListener('click', () => {
      applyMode(value);
      rerender();
    });
    group.append(button);
  }
  return group;
}

function beginPage(
  root: HTMLElement,
  pageId: string,
  title: string,
  subtitle: string,
  options: DesignPageOptions,
  rerender: () => void,
): PageFrame | null {
  ensureDesignPagesStyle();
  root.className = 'gw-design-root';
  root.replaceChildren();

  if (!hasFixtureAccess(options)) {
    root.append(el('main', {
      class: 'gw-dp-gated',
      'data-test': `${pageId}-gated`,
    }, [
      el('h1', {}, [title]),
      el('section', { class: 'gw-dp-empty', role: 'status' }, [
        el('h2', {}, ['Preview unavailable']),
        el('p', {}, ['No page data is available for this access context.']),
      ]),
    ]));
    return null;
  }

  const mode = readMode();
  syncUnpinnedPalette(mode);
  const content = el('div', { class: 'gw-dp-content' });
  const page = el('main', {
    class: 'gw-dp-page',
    'data-mode': mode,
    'data-test': `${pageId}-page`,
    'data-fixture': 'synthetic',
  }, [
    fixtureBanner(),
    el('div', { class: 'gw-dp-inner' }, [
      el('header', { class: 'gw-dp-page-head' }, [
        el('div', {}, [
          el('p', { class: 'gw-dp-kicker' }, [mode === 'simple' ? 'PLAIN-ENGLISH PREVIEW' : 'REVIEWER DESIGN PREVIEW']),
          el('h1', { class: 'gw-dp-title' }, [title]),
          el('p', { class: 'gw-dp-subtitle' }, [subtitle]),
        ]),
        modeToggle(mode, rerender),
      ]),
      content,
    ]),
  ]);
  root.append(page);
  return { page, content, mode };
}

function panel(title: string, kicker: string, children: (Node | string)[], attrs: Record<string, string> = {}): HTMLElement {
  return el('section', { class: 'gw-dp-panel', ...attrs }, [
    el('header', { class: 'gw-dp-panel-head' }, [
      el('p', { class: 'gw-dp-kicker' }, [kicker]),
      el('h2', {}, [title]),
    ]),
    ...children,
  ]);
}

function notice(title: string, body: string, tone = 'info', attrs: Record<string, string> = {}): HTMLElement {
  return el('aside', { class: `gw-dp-notice gw-dp-${tone}`, role: 'note', ...attrs }, [
    el('strong', {}, [title]),
    el('p', {}, [body]),
  ]);
}

interface FixtureOfficial {
  id: string;
  initials: string;
  name: string;
  role: string;
  level: 'town' | 'county' | 'state';
  review: string;
}

const FIXTURE_OFFICIALS: readonly FixtureOfficial[] = [
  {
    id: 'official-a',
    initials: 'OA',
    name: 'Placeholder Official A',
    role: 'Town role — synthetic',
    level: 'town',
    review: 'One synthetic promise/action match is waiting for human review.',
  },
  {
    id: 'official-b',
    initials: 'OB',
    name: 'Placeholder Official B',
    role: 'County role — synthetic',
    level: 'county',
    review: 'No synthetic match is ready for review.',
  },
  {
    id: 'official-c',
    initials: 'OC',
    name: 'Placeholder Official C',
    role: 'State role — synthetic',
    level: 'state',
    review: 'Receipt placeholders are incomplete.',
  },
];

function openPowerDetailModal(page: HTMLElement, opener: HTMLButtonElement, official: FixtureOfficial): void {
  const titleId = `gw-power-dialog-title-${official.id}`;
  const body = el('div', { class: 'gw-dp-modal-body' });
  const closeButton = el('button', {
    type: 'button',
    class: 'gw-dp-icon-button',
    'aria-label': 'Close synthetic match detail',
    'data-test': 'power-modal-close',
  }, ['×']);
  const dialog = el('section', {
    class: 'gw-dp-modal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titleId,
  }, [
    el('header', { class: 'gw-dp-modal-head' }, [
      el('div', {}, [
        el('p', { class: 'gw-dp-kicker' }, ['PROMISE / ACTION REVIEW']),
        el('h2', { id: titleId }, [`${official.name}: synthetic match`]),
      ]),
      closeButton,
    ]),
    body,
  ]);
  const backdrop = el('div', {
    class: 'gw-dp-modal-backdrop',
    'data-test': 'power-modal',
  }, [dialog]);

  const close = (): void => {
    window.removeEventListener('keydown', onKeydown);
    backdrop.remove();
    if (opener.isConnected) opener.focus();
  };
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') close();
  };
  closeButton.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  window.addEventListener('keydown', onKeydown);

  const consent = el('button', {
    type: 'button',
    class: 'gw-dp-button gw-dp-primary',
    'data-test': 'power-ai-consent',
  }, ['I understand — show the synthetic detail']);
  body.append(el('div', {
    class: 'gw-dp-ai-gate',
    'data-test': 'power-ai-gate',
  }, [
    el('strong', {}, ['AI-GENERATED ANALYSIS — READ FIRST']),
    el('p', {}, [
      'This match is synthetic and was prepared to demonstrate an AI-assisted review flow. AI can hallucinate, omit context, or make an inaccurate match. Treat the result as a lead and inspect every receipt before drawing a conclusion.',
    ]),
    consent,
  ]));

  consent.addEventListener('click', () => {
    const challengeStatus = el('p', {
      class: 'gw-dp-muted',
      role: 'status',
      'aria-live': 'polite',
      'data-test': 'power-challenge-status',
    });
    const challengeButton = el('button', {
      type: 'button',
      class: 'gw-dp-button gw-dp-secondary',
      'data-test': 'power-challenge',
    }, ['Preview challenge process']);
    challengeButton.addEventListener('click', () => {
      challengeStatus.textContent = 'Challenge preview only — nothing was submitted.';
    });

    const detailHeading = el('h3', { tabindex: '-1' }, ['Fixture disposition: human review required']);
    body.replaceChildren(el('div', {
      class: 'gw-dp-verdict',
      'data-test': 'power-verdict-detail',
    }, [
      detailHeading,
      el('div', { class: 'gw-dp-compare' }, [
        el('article', {}, [
          el('span', { class: 'gw-dp-chip gw-dp-level-town' }, ['PROMISE — FIXTURE']),
          el('p', {}, ['Placeholder statement about a generic public-policy goal.']),
        ]),
        el('article', {}, [
          el('span', { class: 'gw-dp-chip gw-dp-caution' }, ['ACTION — FIXTURE']),
          el('p', {}, ['Placeholder recorded action awaiting source verification.']),
        ]),
      ]),
      el('h3', {}, ['Receipt placeholders']),
      el('ul', { class: 'gw-dp-receipts' }, [
        el('li', {}, ['Source document placeholder — not connected']),
        el('li', {}, ['Meeting record placeholder — not connected']),
      ]),
      notice(
        'Receipts and challenges are not operational here',
        'No receipt on this page has been verified, and the challenge control is a device-only interaction preview. It does not submit, publish, or change a civic record.',
        'caution',
        { 'data-test': 'power-receipt-disclaimer' },
      ),
      challengeButton,
      challengeStatus,
    ]));
    detailHeading.focus();
  });

  page.append(backdrop);
  closeButton.focus();
}

export function renderPowerTracker(root: HTMLElement, options: DesignPageOptions = {}): void {
  const frame = beginPage(
    root,
    'power-tracker',
    'Power Tracker',
    'A consent-first preview of promise/action review. Placeholder people and synthetic records only.',
    options,
    () => renderPowerTracker(root, options),
  );
  if (!frame) return;

  frame.content.append(notice(
    'No real people, scores, or verdicts',
    'Official names are placeholders. This fixture does not calculate or claim a production score, ranking, kept promise, or broken promise.',
    'stop',
    { 'data-test': 'power-score-disclaimer' },
  ));

  const officialsMount = el('div', { class: 'gw-dp-official-list', 'data-test': 'power-official-list' });
  const profileMount = el('div', { 'data-test': 'power-profile-mount' });
  let selectedId = FIXTURE_OFFICIALS[0].id;

  const renderSelection = (): void => {
    officialsMount.replaceChildren();
    for (const official of FIXTURE_OFFICIALS) {
      const selected = official.id === selectedId;
      const button = el('button', {
        type: 'button',
        class: 'gw-dp-official',
        'aria-pressed': String(selected),
        'data-test': 'power-official',
        'data-official-id': official.id,
      }, [
        el('span', { class: `gw-dp-avatar gw-dp-level-${official.level}`, 'aria-hidden': 'true' }, [official.initials]),
        el('span', { class: 'gw-dp-official-copy' }, [
          el('strong', {}, [official.name]),
          el('small', {}, [official.role]),
        ]),
        el('span', { class: `gw-dp-chip gw-dp-level-${official.level}` }, [official.level.toUpperCase()]),
      ]);
      button.addEventListener('click', () => {
        selectedId = official.id;
        renderSelection();
      });
      officialsMount.append(button);
    }

    const official = FIXTURE_OFFICIALS.find((candidate) => candidate.id === selectedId) ?? FIXTURE_OFFICIALS[0];
    const openButton = el('button', {
      type: 'button',
      class: 'gw-dp-button gw-dp-primary',
      'data-test': 'power-open-detail',
    }, ['Review synthetic AI match']);
    openButton.addEventListener('click', () => openPowerDetailModal(frame.page, openButton, official));

    profileMount.replaceChildren(panel(official.name, 'PLACEHOLDER PROFILE', [
      el('div', { class: 'gw-dp-profile-head' }, [
        el('span', { class: `gw-dp-avatar gw-dp-avatar-large gw-dp-level-${official.level}`, 'aria-hidden': 'true' }, [official.initials]),
        el('div', {}, [
          el('p', {}, [official.role]),
          el('strong', { class: 'gw-dp-no-score' }, ['Production score unavailable']),
        ]),
      ]),
      el('div', { class: 'gw-dp-review-card' }, [
        el('span', { class: 'gw-dp-chip gw-dp-caution' }, ['AI DETAIL LOCKED']),
        el('h3', {}, ['Latest synthetic match']),
        el('p', {}, [official.review]),
        el('p', { class: 'gw-dp-muted' }, ['The verdict detail is withheld until the AI-read-first consent step.']),
        openButton,
      ]),
      el('div', { class: 'gw-dp-ledger' }, [
        el('div', {}, [
          el('p', { class: 'gw-dp-kicker' }, ['QUOTE LEDGER']),
          el('span', { class: 'gw-dp-ai-badge' }, ['FOUND BY AI — VERIFY SOURCE FIRST']),
        ]),
        el('p', {}, ['Placeholder quote entry — no real speaker, quotation, source, or attribution is asserted.']),
      ]),
    ], { 'data-test': 'power-profile' }));
  };
  renderSelection();

  frame.content.append(el('div', { class: 'gw-dp-power-grid' }, [
    panel('Placeholder officials', 'BROKEN-FIRST SORT PREVIEW', [
      officialsMount,
      el('p', { class: 'gw-dp-muted' }, ['Visual ordering only. No real comparison, score, or outcome ranking is produced.']),
    ]),
    profileMount,
  ]));
}

interface TrackedMeta {
  title: string;
  type: string;
  context: string;
}

const TRACKED_CATALOG: Readonly<Record<string, TrackedMeta>> = {
  moratorium: {
    title: 'Building and annexation moratorium',
    type: 'ISSUE',
    context: 'Synthetic town issue preview',
  },
  str: {
    title: 'Short-term rental policy',
    type: 'ISSUE',
    context: 'Synthetic state issue preview',
  },
  water: {
    title: 'Water and sewer rates review',
    type: 'ISSUE',
    context: 'Synthetic utility issue preview',
  },
  landuse: {
    title: 'Land-use code update',
    type: 'ISSUE',
    context: 'Synthetic county issue preview',
  },
};

function readTracked(): Record<string, true> {
  const parsed = readStoredJson(TRACKED_STORAGE_KEY);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const tracked: Record<string, true> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (value === true && key.length > 0) tracked[key] = true;
  }
  return tracked;
}

function humanizeTrackedKey(key: string): string {
  const text = key.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!text) return 'Untitled tracked issue';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function trackedMeta(key: string): TrackedMeta {
  return TRACKED_CATALOG[key] ?? {
    title: humanizeTrackedKey(key),
    type: 'ISSUE',
    context: 'Locally tracked key — no fixture metadata available',
  };
}

export function renderWatchlist(root: HTMLElement, options: DesignPageOptions = {}): void {
  const frame = beginPage(
    root,
    'watchlist',
    'Your Watchlist',
    'A device-local digest of issue keys shared through gw_tracked.',
    options,
    () => renderWatchlist(root, options),
  );
  if (!frame) return;

  frame.content.append(notice(
    'Local tracking only',
    'This page stores issue choices on this device. It does not subscribe you to email, text messages, push notifications, or real alerts.',
    'info',
    { 'data-test': 'watchlist-local-notice' },
  ));

  let tracked = readTracked();
  const count = el('strong', { 'data-test': 'watchlist-count' });
  const status = el('p', {
    class: 'gw-dp-sr-status',
    role: 'status',
    'aria-live': 'polite',
    'data-test': 'watchlist-status',
  });
  const list = el('div', { class: 'gw-dp-watch-list', 'data-test': 'watchlist-items' });

  const renderItems = (): void => {
    const keys = Object.keys(tracked).sort();
    count.textContent = `${keys.length} ${keys.length === 1 ? 'issue' : 'issues'}`;
    list.replaceChildren();
    if (keys.length === 0) {
      list.append(el('section', {
        class: 'gw-dp-empty',
        role: 'status',
        'data-test': 'watchlist-empty',
      }, [
        el('h3', {}, ['Nothing is tracked on this device yet']),
        el('p', {}, ['Track an issue from a supported page and its local key will appear here. No sample item was invented to fill this state.']),
      ]));
      return;
    }

    for (const key of keys) {
      const meta = trackedMeta(key);
      const remove = el('button', {
        type: 'button',
        class: 'gw-dp-button gw-dp-remove',
        'data-test': 'watchlist-remove',
        'data-tracked-key': key,
        'aria-label': `Stop tracking ${meta.title} on this device`,
      }, ['Stop tracking']);
      remove.addEventListener('click', () => {
        delete tracked[key];
        writeStoredJson(TRACKED_STORAGE_KEY, tracked);
        renderItems();
        status.textContent = `${meta.title} was removed from this device.`;
        const next = list.querySelector<HTMLButtonElement>('[data-test="watchlist-remove"]');
        if (next) next.focus();
        else list.querySelector<HTMLElement>('h3')?.focus();
      });

      list.append(el('article', {
        class: 'gw-dp-watch-row',
        'data-test': 'watchlist-item',
        'data-tracked-key': key,
      }, [
        el('span', { class: 'gw-dp-chip gw-dp-level-town' }, [meta.type]),
        el('div', { class: 'gw-dp-watch-copy' }, [
          el('h3', {}, [meta.title]),
          el('p', {}, [meta.context]),
          el('small', {}, [`Stored key: ${key.slice(0, 80)}`]),
        ]),
        remove,
      ]));
    }
  };
  renderItems();

  frame.content.append(panel('Watched issues', 'DEVICE-LOCAL WATCHLIST', [
    el('div', { class: 'gw-dp-count-line' }, [
      el('span', {}, ['Currently tracking']),
      count,
    ]),
    list,
    status,
  ], { 'data-test': 'watchlist-panel' }));
}

const STATE_NAMES: Readonly<Record<string, string>> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

const WY_COUNTIES = [
  'Albany', 'Big Horn', 'Campbell', 'Carbon', 'Converse', 'Crook', 'Fremont', 'Goshen', 'Hot Springs', 'Johnson',
  'Laramie', 'Lincoln', 'Natrona', 'Niobrara', 'Park', 'Platte', 'Sheridan', 'Sublette', 'Sweetwater', 'Teton',
  'Uinta', 'Washakie', 'Weston',
] as const;

const LINCOLN_TOWNS: Readonly<Record<string, string>> = {
  Alpine: 'Star Valley',
  'Star Valley Ranch': 'Star Valley',
  Thayne: 'Star Valley',
  Afton: 'Star Valley',
  Grover: 'Star Valley',
  Kemmerer: 'South Lincoln',
  Diamondville: 'South Lincoln',
  'La Barge': 'South Lincoln',
  Cokeville: 'South Lincoln',
};

const DEFAULT_LOCATION: SavedLocation = {
  state: 'WY',
  county: 'Lincoln',
  region: 'Star Valley',
  town: 'Alpine',
};

function normalizeLocation(raw: unknown): SavedLocation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_LOCATION };
  const candidate = raw as Record<string, unknown>;
  const state = typeof candidate.state === 'string' && STATE_NAMES[candidate.state] ? candidate.state : DEFAULT_LOCATION.state;
  if (state !== 'WY') return { state, county: '', region: '', town: '' };

  const county = typeof candidate.county === 'string' && (WY_COUNTIES as readonly string[]).includes(candidate.county)
    ? candidate.county
    : '';
  if (!county) return { state, county: '', region: '', town: '' };
  if (county !== 'Lincoln') return { state, county, region: '', town: '' };

  const town = typeof candidate.town === 'string' && LINCOLN_TOWNS[candidate.town] ? candidate.town : '';
  return {
    state,
    county,
    region: town ? LINCOLN_TOWNS[town] : '',
    town,
  };
}

function locationLabel(location: SavedLocation): string {
  const parts = [STATE_NAMES[location.state] ?? location.state];
  if (location.county) parts.push(`${location.county} County`);
  if (location.region) parts.push(location.region);
  if (location.town) parts.push(location.town);
  return parts.join(' › ');
}

function option(value: string, label: string): HTMLOptionElement {
  return el('option', { value }, [label]);
}

export function renderLocation(root: HTMLElement, options: DesignPageOptions = {}): void {
  const frame = beginPage(
    root,
    'location',
    'Choose your place',
    'A valid state, county, region, and town selection stored only on this device.',
    options,
    () => renderLocation(root, options),
  );
  if (!frame) return;

  let location = normalizeLocation(readStoredJson(LOCATION_STORAGE_KEY));
  const mount = el('div', { 'data-test': 'location-picker' });

  const setLocation = (next: SavedLocation): void => {
    location = normalizeLocation(next);
    writeStoredJson(LOCATION_STORAGE_KEY, location);
    renderPicker();
  };

  const renderPicker = (): void => {
    const stateSelect = el('select', {
      id: 'gw-location-state',
      class: 'gw-dp-select',
      'aria-label': 'State',
      'data-test': 'location-state',
    });
    for (const [code, name] of Object.entries(STATE_NAMES)) stateSelect.append(option(code, name));
    stateSelect.value = location.state;
    stateSelect.addEventListener('change', () => {
      setLocation({ state: stateSelect.value, county: '', region: '', town: '' });
    });

    const countySelect = el('select', {
      id: 'gw-location-county',
      class: 'gw-dp-select',
      'aria-label': 'County',
      'data-test': 'location-county',
    });
    countySelect.append(option('', location.state === 'WY' ? 'Pick a Wyoming county' : 'County unavailable for this state fixture'));
    for (const county of WY_COUNTIES) countySelect.append(option(county, `${county} County`));
    countySelect.value = location.county;
    countySelect.disabled = location.state !== 'WY';
    countySelect.addEventListener('change', () => {
      setLocation({ state: 'WY', county: countySelect.value, region: '', town: '' });
    });

    const townSelect = el('select', {
      id: 'gw-location-town',
      class: 'gw-dp-select',
      'aria-label': 'Town',
      'data-test': 'location-town',
    });
    townSelect.append(option('', location.county === 'Lincoln' ? 'Pick a Lincoln County town' : 'Town unavailable for this county fixture'));
    for (const town of Object.keys(LINCOLN_TOWNS)) townSelect.append(option(town, town));
    townSelect.value = location.town;
    townSelect.disabled = location.state !== 'WY' || location.county !== 'Lincoln';
    townSelect.addEventListener('change', () => {
      setLocation({ state: 'WY', county: 'Lincoln', region: '', town: townSelect.value });
    });

    const breadcrumbs = el('nav', {
      class: 'gw-dp-breadcrumbs',
      'aria-label': 'Selected location',
      'data-test': 'location-breadcrumbs',
    }, [locationLabel(location)]);

    const stateGrid = el('div', { class: 'gw-dp-state-grid', 'data-test': 'location-state-grid' });
    for (const [code, name] of Object.entries(STATE_NAMES)) {
      const button = el('button', {
        type: 'button',
        class: 'gw-dp-place-tile',
        'aria-label': `Select ${name}`,
        'aria-pressed': String(location.state === code),
        'data-state': code,
      }, [code]);
      button.addEventListener('click', () => setLocation({ state: code, county: '', region: '', town: '' }));
      stateGrid.append(button);
    }

    const countyGrid = el('div', { class: 'gw-dp-county-grid', 'data-test': 'location-county-grid' });
    if (location.state === 'WY') {
      for (const county of WY_COUNTIES) {
        const button = el('button', {
          type: 'button',
          class: 'gw-dp-place-tile gw-dp-county-tile',
          'aria-label': `Select ${county} County`,
          'aria-pressed': String(location.county === county),
          'data-county': county,
        }, [county]);
        button.addEventListener('click', () => setLocation({ state: 'WY', county, region: '', town: '' }));
        countyGrid.append(button);
      }
    } else {
      countyGrid.append(el('p', { class: 'gw-dp-muted' }, [
        `${STATE_NAMES[location.state]} has no county fixture in this design preview. Wyoming county and town selections were cleared.`,
      ]));
    }

    const townGrid = el('div', { class: 'gw-dp-town-grid', 'data-test': 'location-town-grid' });
    if (location.state === 'WY' && location.county === 'Lincoln') {
      for (const [town, region] of Object.entries(LINCOLN_TOWNS)) {
        const button = el('button', {
          type: 'button',
          class: 'gw-dp-place-tile gw-dp-town-tile',
          'aria-label': `Select ${town}, ${region}`,
          'aria-pressed': String(location.town === town),
          'data-town': town,
        }, [town]);
        button.addEventListener('click', () => setLocation({ state: 'WY', county: 'Lincoln', region, town }));
        townGrid.append(button);
      }
    } else {
      townGrid.append(el('p', { class: 'gw-dp-muted' }, ['Choose Lincoln County to see the synthetic town list.']));
    }

    mount.replaceChildren(
      breadcrumbs,
      el('div', { class: 'gw-dp-location-selects' }, [
        el('label', { for: 'gw-location-state' }, ['State', stateSelect]),
        el('label', { for: 'gw-location-county' }, ['County', countySelect]),
        el('label', { for: 'gw-location-town' }, ['Town', townSelect]),
      ]),
      notice(
        'Fixture coverage figures',
        'Every percentage and coverage state below is a synthetic design fixture, not a measurement of service or processed public records.',
        'caution',
        { 'data-test': 'location-coverage-disclaimer' },
      ),
      el('div', { class: 'gw-dp-coverage-grid' }, [
        el('article', { class: 'gw-dp-stat', 'data-test': 'location-coverage-figure' }, [
          el('strong', {}, ['Town 62%']),
          el('span', {}, ['Fixture estimate']),
        ]),
        el('article', { class: 'gw-dp-stat', 'data-test': 'location-coverage-figure' }, [
          el('strong', {}, ['County 38%']),
          el('span', {}, ['Fixture estimate']),
        ]),
        el('article', { class: 'gw-dp-stat', 'data-test': 'location-coverage-figure' }, [
          el('strong', {}, ['State 21%']),
          el('span', {}, ['Fixture estimate']),
        ]),
      ]),
      panel('Pick your state', 'STEP 1 · SYNTHETIC COVERAGE MAP', [
        el('p', { class: 'gw-dp-muted' }, ['The tiles demonstrate selection behavior. They do not represent voting patterns, availability, or current coverage.']),
        stateGrid,
      ]),
      el('div', { class: 'gw-dp-location-grid' }, [
        panel('Pick a county', 'STEP 2 · WYOMING FIXTURE', [countyGrid]),
        panel('Pick a town', 'STEP 3 · LINCOLN COUNTY FIXTURE', [townGrid]),
      ]),
      notice(
        'Saved automatically on this device',
        `Current valid selection: ${locationLabel(location)}. Saving a location does not confirm coverage or create an account.`,
        'info',
        { 'data-test': 'location-saved-notice' },
      ),
    );
  };

  renderPicker();
  frame.content.append(mount);
}

interface FixtureAlert {
  id: string;
  icon: string;
  tone: 'stop' | 'caution' | 'ok';
  level: string;
  title: string;
  detail: string;
  when: string;
}

const FIXTURE_ALERTS: readonly FixtureAlert[] = [
  {
    id: 'fixture-attachment-replaced',
    icon: '▲',
    tone: 'stop',
    level: 'TOWN FIXTURE',
    title: 'Fixture packet attachment replaced',
    detail: 'A sample version-change card demonstrates the high-severity state. No document is being monitored.',
    when: 'SAMPLE · RECENT',
  },
  {
    id: 'fixture-meeting-eve',
    icon: '◉',
    tone: 'caution',
    level: 'TOWN FIXTURE',
    title: 'Fixture meeting-eve reminder',
    detail: 'A sample deadline card demonstrates the caution state. No reminder will be delivered.',
    when: 'SAMPLE · UPCOMING',
  },
  {
    id: 'fixture-agenda-posted',
    icon: '✓',
    tone: 'ok',
    level: 'COUNTY FIXTURE',
    title: 'Fixture agenda posted',
    detail: 'A sample posted-state card demonstrates the positive state. It is not sourced from a live feed.',
    when: 'SAMPLE · EARLIER',
  },
];

const FIXTURE_EARLIER: readonly FixtureAlert[] = [
  {
    id: 'fixture-earlier-record',
    icon: '◌',
    tone: 'ok',
    level: 'STATE FIXTURE',
    title: 'Earlier fixture item',
    detail: 'Static layout example for the read-history treatment.',
    when: 'SAMPLE · HISTORY',
  },
];

interface DeliveryPreview {
  email: boolean;
  text: boolean;
  meetingEve: boolean;
  dailyDigest: boolean;
}

const DELIVERY_DEFAULTS: DeliveryPreview = {
  email: true,
  text: false,
  meetingEve: true,
  dailyDigest: false,
};

function readAlertIds(): Set<string> {
  const parsed = readStoredJson(ALERTS_READ_STORAGE_KEY);
  if (!Array.isArray(parsed)) return new Set();
  return new Set(parsed.filter((value): value is string => typeof value === 'string'));
}

function readDeliveryPreview(): DeliveryPreview {
  const parsed = readStoredJson(DELIVERY_PREVIEW_STORAGE_KEY);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DELIVERY_DEFAULTS };
  const value = parsed as Record<string, unknown>;
  return {
    email: typeof value.email === 'boolean' ? value.email : DELIVERY_DEFAULTS.email,
    text: typeof value.text === 'boolean' ? value.text : DELIVERY_DEFAULTS.text,
    meetingEve: typeof value.meetingEve === 'boolean' ? value.meetingEve : DELIVERY_DEFAULTS.meetingEve,
    dailyDigest: typeof value.dailyDigest === 'boolean' ? value.dailyDigest : DELIVERY_DEFAULTS.dailyDigest,
  };
}

function trackedCount(): number {
  return Object.keys(readTracked()).length;
}

function alertRow(alert: FixtureAlert, read = false): HTMLElement {
  return el('article', {
    class: `gw-dp-alert-row gw-dp-alert-${alert.tone}${read ? ' gw-dp-alert-read' : ''}`,
    'data-alert-id': alert.id,
  }, [
    el('span', { class: 'gw-dp-alert-icon', 'aria-hidden': 'true' }, [alert.icon]),
    el('div', { class: 'gw-dp-alert-copy' }, [
      el('span', { class: 'gw-dp-chip' }, [alert.level]),
      el('h3', {}, [alert.title]),
      el('p', {}, [alert.detail]),
      el('time', {}, [alert.when]),
    ]),
  ]);
}

export function renderAlerts(root: HTMLElement, options: DesignPageOptions = {}): void {
  const frame = beginPage(
    root,
    'alerts',
    'Alerts',
    'A read-state and delivery-settings interaction preview. Nothing here is subscribed or sent.',
    options,
    () => renderAlerts(root, options),
  );
  if (!frame) return;

  frame.content.append(notice(
    'Device-only preview — not subscribed',
    'Reading cards and changing delivery toggles only updates this browser. There is no alert service, recipient, account sync, email, text, or push subscription behind this fixture.',
    'caution',
    { 'data-test': 'alerts-device-only-notice' },
  ));

  let readIds = readAlertIds();
  let delivery = readDeliveryPreview();
  const unreadMount = el('div', { class: 'gw-dp-alert-list', 'data-test': 'alerts-unread-list' });
  const earlierMount = el('div', { class: 'gw-dp-alert-list', 'data-test': 'alerts-earlier-list' });
  const unreadCount = el('span', { class: 'gw-dp-chip gw-dp-stop', 'data-test': 'alerts-unread-count' });
  const feedStatus = el('p', { role: 'status', 'aria-live': 'polite', class: 'gw-dp-sr-status' });
  const markAll = el('button', {
    type: 'button',
    class: 'gw-dp-button gw-dp-secondary',
    'data-test': 'alerts-mark-all',
  }, ['Mark all read']);

  const persistRead = (): void => writeStoredJson(ALERTS_READ_STORAGE_KEY, [...readIds]);
  const renderFeeds = (): void => {
    const unread = FIXTURE_ALERTS.filter((alert) => !readIds.has(alert.id));
    const newlyRead = FIXTURE_ALERTS.filter((alert) => readIds.has(alert.id));
    unreadCount.textContent = `${unread.length} unread`;
    markAll.disabled = unread.length === 0;
    unreadMount.replaceChildren();
    earlierMount.replaceChildren();

    if (unread.length === 0) {
      unreadMount.append(el('section', { class: 'gw-dp-empty', role: 'status', 'data-test': 'alerts-empty' }, [
        el('h3', {}, ['All fixture cards are marked read']),
        el('p', {}, ['There are no unread synthetic cards on this device. This is not a live inbox.']),
      ]));
    } else {
      for (const alert of unread) {
        const row = alertRow(alert);
        row.setAttribute('data-test', 'alerts-unread-item');
        const readButton = el('button', {
          type: 'button',
          class: 'gw-dp-button gw-dp-mark-read',
          'data-test': 'alerts-mark-read',
          'data-alert-id': alert.id,
          'aria-label': `Mark ${alert.title} read on this device`,
        }, ['✓ Read']);
        readButton.addEventListener('click', () => {
          readIds.add(alert.id);
          persistRead();
          renderFeeds();
          feedStatus.textContent = `${alert.title} was marked read on this device.`;
        });
        row.append(readButton);
        unreadMount.append(row);
      }
    }

    for (const alert of [...newlyRead, ...FIXTURE_EARLIER]) {
      const row = alertRow(alert, true);
      row.setAttribute('data-test', 'alerts-earlier-item');
      earlierMount.append(row);
    }
  };

  markAll.addEventListener('click', () => {
    for (const alert of FIXTURE_ALERTS) readIds.add(alert.id);
    persistRead();
    renderFeeds();
    feedStatus.textContent = 'All synthetic alert cards were marked read on this device.';
  });
  renderFeeds();

  const deliveryMount = el('div', { class: 'gw-dp-delivery-list', 'data-test': 'alerts-delivery-preview' });
  const deliveryStatus = el('p', {
    role: 'status',
    'aria-live': 'polite',
    class: 'gw-dp-muted',
    'data-test': 'alerts-delivery-status',
  });
  const renderDelivery = (): void => {
    deliveryMount.replaceChildren();
    const settings: { key: keyof DeliveryPreview; label: string; detail: string }[] = [
      { key: 'email', label: 'Email preview', detail: 'Agenda-posting example' },
      { key: 'text', label: 'Text preview', detail: 'Document-change example' },
      { key: 'meetingEve', label: 'Meeting-eve preview', detail: 'Evening-before example' },
      { key: 'dailyDigest', label: 'Daily digest preview', detail: 'Daily-summary example' },
    ];
    for (const setting of settings) {
      const enabled = delivery[setting.key];
      const toggle = el('button', {
        type: 'button',
        class: 'gw-dp-switch',
        role: 'switch',
        'aria-checked': String(enabled),
        'aria-label': `${setting.label}: ${enabled ? 'on' : 'off'}; device-only preview`,
        'data-test': 'alerts-delivery-toggle',
        'data-delivery-key': setting.key,
      }, [
        el('span', { class: 'gw-dp-switch-track', 'aria-hidden': 'true' }, [el('span')]),
        el('span', { class: 'gw-dp-switch-copy' }, [
          el('strong', {}, [setting.label]),
          el('small', {}, [setting.detail]),
        ]),
        el('b', {}, [enabled ? 'ON' : 'OFF']),
      ]);
      toggle.addEventListener('click', () => {
        delivery = { ...delivery, [setting.key]: !delivery[setting.key] };
        writeStoredJson(DELIVERY_PREVIEW_STORAGE_KEY, delivery);
        renderDelivery();
        deliveryStatus.textContent = `${setting.label} changed on this device only. No subscription was created.`;
      });
      deliveryMount.append(toggle);
    }
  };
  renderDelivery();

  frame.content.append(el('div', { class: 'gw-dp-alert-grid' }, [
    el('div', { class: 'gw-dp-stack' }, [
      panel('Unread fixture cards', 'UNREAD', [
        el('div', { class: 'gw-dp-panel-actions' }, [unreadCount, markAll]),
        unreadMount,
        feedStatus,
      ]),
      panel('Earlier fixture cards', 'EARLIER · READ', [earlierMount]),
    ]),
    el('div', { class: 'gw-dp-stack' }, [
      panel('Delivery controls', 'DEVICE-ONLY PREVIEW', [
        deliveryMount,
        deliveryStatus,
        el('p', { class: 'gw-dp-muted' }, ['These switches are appearance and persistence tests. They do not register a recipient or promise delivery timing.']),
      ]),
      panel('What a future alert could represent', 'TRIGGER EXAMPLES', [
        el('ul', { class: 'gw-dp-trigger-list' }, [
          el('li', {}, ['A fixture document-change event']),
          el('li', {}, ['A fixture agenda-posted event']),
          el('li', {}, ['A fixture deadline or meeting-eve event']),
        ]),
        el('p', {}, [
          'Local tracked issue count: ',
          el('strong', { 'data-test': 'alerts-tracked-count' }, [String(trackedCount())]),
          '. This count comes from gw_tracked; it does not mean monitoring is active.',
        ]),
      ]),
    ]),
  ]));
}

export const DESIGN_PAGES_STYLE = `${GW_TOKENS}
.gw-design-root{font-family:var(--gw-font);color:var(--gw-text);background:var(--gw-page-bg);min-height:100%;line-height:var(--gw-leading)}
.gw-dp-page,.gw-dp-gated{min-height:100%;color:var(--gw-text);background:var(--gw-page-bg)}
.gw-dp-page *,.gw-dp-gated *{box-sizing:border-box}
.gw-dp-page[data-mode="simple"]{font-family:var(--gw-font-serif);font-size:var(--gw-text-md)}
.gw-dp-page[data-mode="advanced"]{font-family:var(--gw-font);font-size:var(--gw-text-body)}
.gw-dp-fixture{position:relative;z-index:2;padding:var(--gw-space-2) var(--gw-space-5);border-bottom:var(--gw-border-w) solid var(--gw-tone-caution-line);background:var(--gw-tone-caution-well);color:var(--gw-caution-text);font:700 var(--gw-text-badge)/1.35 var(--gw-font-mono);text-align:center;letter-spacing:.03em}
.gw-dp-inner,.gw-dp-gated{width:min(100% - 2rem,1200px);margin:0 auto;padding:var(--gw-space-6) 0 2rem}
.gw-dp-page[data-mode="simple"] .gw-dp-inner{width:min(100% - 2rem,900px);background:var(--gw-surface);padding:var(--gw-space-6);border-inline:var(--gw-border-w) solid var(--gw-border-subtle)}
.gw-dp-page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--gw-space-5);padding-bottom:var(--gw-space-5);border-bottom:var(--gw-border-w) solid var(--gw-rule-strong);margin-bottom:var(--gw-space-5)}
.gw-dp-title{font-size:var(--gw-text-display);line-height:var(--gw-leading-tight);margin:.15rem 0}
.gw-dp-subtitle{max-width:52rem;margin:0;color:var(--gw-text-secondary)}
.gw-dp-kicker{margin:0;color:var(--gw-accent);font:800 var(--gw-text-kicker)/1.35 var(--gw-font);letter-spacing:1.4px;text-transform:uppercase}
.gw-dp-mode{display:inline-flex;flex:none;border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);padding:3px;background:var(--gw-surface-well)}
.gw-dp-mode-button,.gw-dp-button,.gw-dp-icon-button,.gw-dp-official,.gw-dp-place-tile,.gw-dp-switch,.gw-dp-select{min-height:var(--gw-tap-min);min-width:var(--gw-tap-min);font:700 var(--gw-text-badge)/1.25 var(--gw-font)}
.gw-dp-mode-button{padding:.45rem .9rem;border:0;border-radius:var(--gw-radius-pill);color:var(--gw-text-secondary);background:transparent;cursor:pointer}
.gw-dp-mode-button[aria-pressed="true"]{color:var(--gw-accent-text-on);background:var(--gw-accent)}
.gw-dp-content,.gw-dp-stack{display:grid;gap:var(--gw-space-5)}
.gw-dp-panel{padding:var(--gw-space-6);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);background:var(--gw-surface)}
.gw-dp-page[data-mode="simple"] .gw-dp-panel{border-radius:var(--gw-radius-sm);background:var(--gw-surface-subtle)}
.gw-dp-panel-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--gw-space-3);margin-bottom:var(--gw-space-4)}
.gw-dp-panel h2,.gw-dp-panel h3,.gw-dp-empty h2,.gw-dp-empty h3{margin:.2rem 0;line-height:var(--gw-leading-tight)}
.gw-dp-panel p{margin:.4rem 0}
.gw-dp-notice{border:var(--gw-border-w) solid var(--gw-tone-info-line);border-left:3px solid var(--gw-info-text);border-radius:0 var(--gw-radius) var(--gw-radius) 0;background:var(--gw-tone-info-well);padding:var(--gw-space-4) var(--gw-space-5)}
.gw-dp-notice p{margin:.25rem 0 0;color:var(--gw-text-secondary)}
.gw-dp-notice.gw-dp-caution{border-color:var(--gw-tone-caution-line);border-left-color:var(--gw-caution-line);background:var(--gw-tone-caution-well)}
.gw-dp-notice.gw-dp-stop{border-color:var(--gw-tone-stop-line);border-left-color:var(--gw-stop-border);background:var(--gw-tone-stop-well)}
.gw-dp-button,.gw-dp-icon-button{display:inline-flex;align-items:center;justify-content:center;gap:var(--gw-space-2);padding:.55rem .9rem;border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius);color:var(--gw-text);background:var(--gw-surface-subtle);cursor:pointer}
.gw-dp-button:disabled{opacity:.5;cursor:not-allowed}
.gw-dp-primary{color:var(--gw-accent-text-on);background:var(--gw-accent);border-color:var(--gw-accent)}
.gw-dp-secondary{color:var(--gw-accent);border-color:var(--gw-accent);background:var(--gw-surface)}
.gw-dp-remove{color:var(--gw-stop-text);border-color:var(--gw-stop-border)}
.gw-dp-icon-button{padding:0;border-radius:var(--gw-radius-pill);font-size:1.5rem}
.gw-dp-chip,.gw-dp-ai-badge{display:inline-flex;align-items:center;min-height:1.65rem;padding:.15rem .5rem;border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius-sm);font:800 var(--gw-text-badge)/1.2 var(--gw-font);letter-spacing:.04em}
.gw-dp-ai-badge,.gw-dp-caution{color:var(--gw-caution-text-strong);background:var(--gw-caution-bg);border-color:var(--gw-caution-line)}
.gw-dp-stop{color:var(--gw-stop-text);background:var(--gw-stop-bg);border-color:var(--gw-stop-border)}
.gw-dp-level-town{color:var(--gw-level-town);border-color:var(--gw-level-town)}
.gw-dp-level-county{color:var(--gw-level-county);border-color:var(--gw-level-county)}
.gw-dp-level-state{color:var(--gw-level-state);border-color:var(--gw-level-state)}
.gw-dp-muted{color:var(--gw-text-muted)}
.gw-dp-empty{padding:2rem var(--gw-space-5);border:var(--gw-border-w) dashed var(--gw-border-strong);border-radius:var(--gw-radius);text-align:center;background:var(--gw-surface-well)}
.gw-dp-power-grid{display:grid;grid-template-columns:minmax(16rem,.72fr) minmax(0,1.6fr);gap:var(--gw-space-5);align-items:start}
.gw-dp-official-list{display:grid;gap:var(--gw-space-3)}
.gw-dp-official{width:100%;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:var(--gw-space-3);padding:var(--gw-space-3);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);color:var(--gw-text);background:var(--gw-surface-subtle);text-align:left;cursor:pointer}
.gw-dp-official[aria-pressed="true"]{border-color:var(--gw-accent);background:var(--gw-surface-accent-tint)}
.gw-dp-official-copy{display:grid;min-width:0}.gw-dp-official-copy small{color:var(--gw-text-muted)}
.gw-dp-avatar{display:inline-grid;place-items:center;width:2.7rem;height:2.7rem;border:var(--gw-border-w) solid currentColor;border-radius:50%;font-weight:800;background:var(--gw-surface-well)}
.gw-dp-avatar-large{width:4.5rem;height:4.5rem;font-size:var(--gw-text-lg)}
.gw-dp-profile-head{display:flex;align-items:center;gap:var(--gw-space-4);margin-bottom:var(--gw-space-5)}
.gw-dp-no-score{display:block;color:var(--gw-stop-text)}
.gw-dp-review-card,.gw-dp-ledger{padding:var(--gw-space-5);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-surface-subtle);margin-top:var(--gw-space-4)}
.gw-dp-ledger>div{display:flex;align-items:center;justify-content:space-between;gap:var(--gw-space-3);flex-wrap:wrap}
.gw-dp-modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:var(--gw-space-5);background:color-mix(in srgb,var(--gw-page-bg) 82%,transparent)}
.gw-dp-modal{width:min(46rem,100%);max-height:88vh;overflow:auto;border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius-lg);background:var(--gw-surface);padding:var(--gw-space-6)}
.gw-dp-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--gw-space-4);padding-bottom:var(--gw-space-4);border-bottom:var(--gw-border-w) solid var(--gw-border);margin-bottom:var(--gw-space-4)}
.gw-dp-modal-head h2{margin:.2rem 0}.gw-dp-modal-body{display:grid;gap:var(--gw-space-4)}
.gw-dp-ai-gate{padding:var(--gw-space-6);border:var(--gw-border-w) dashed var(--gw-caution-line);border-radius:var(--gw-radius);background:var(--gw-caution-bg-soft);text-align:center}.gw-dp-ai-gate p{text-align:left;color:var(--gw-text-secondary)}
.gw-dp-verdict{display:grid;gap:var(--gw-space-4)}.gw-dp-verdict h3{margin:0}
.gw-dp-compare{display:grid;grid-template-columns:1fr 1fr;gap:var(--gw-space-4)}
.gw-dp-compare article{padding:var(--gw-space-4);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-surface-subtle)}
.gw-dp-receipts{margin:0;padding-left:1.25rem;color:var(--gw-text-secondary)}
.gw-dp-count-line,.gw-dp-panel-actions{display:flex;align-items:center;justify-content:space-between;gap:var(--gw-space-3);margin-bottom:var(--gw-space-4)}
.gw-dp-watch-list{display:grid;gap:var(--gw-space-3)}
.gw-dp-watch-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:var(--gw-space-4);padding:var(--gw-space-4);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-surface-subtle)}
.gw-dp-watch-copy h3,.gw-dp-watch-copy p{margin:.15rem 0}.gw-dp-watch-copy small{color:var(--gw-text-muted);overflow-wrap:anywhere}
.gw-dp-sr-status:empty{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
.gw-dp-breadcrumbs{min-height:var(--gw-tap-min);display:flex;align-items:center;padding:var(--gw-space-3) var(--gw-space-4);margin-bottom:var(--gw-space-4);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);color:var(--gw-text-secondary);background:var(--gw-surface-well);font-weight:700}
.gw-dp-location-selects{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--gw-space-4);margin-bottom:var(--gw-space-5)}
.gw-dp-location-selects label{display:grid;gap:var(--gw-space-2);font-weight:700}
.gw-dp-select{width:100%;padding:.55rem .7rem;border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius);color:var(--gw-text);background:var(--gw-surface)}
.gw-dp-select:disabled{opacity:.65}
.gw-dp-coverage-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--gw-space-4);margin:var(--gw-space-5) 0}
.gw-dp-stat{display:grid;gap:var(--gw-space-2);padding:var(--gw-space-4);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-surface-subtle)}
.gw-dp-stat strong{font-size:var(--gw-text-xl)}.gw-dp-stat span{color:var(--gw-caution-text);font-weight:700}
.gw-dp-state-grid{display:grid;grid-template-columns:repeat(11,minmax(0,1fr));gap:var(--gw-space-1)}
.gw-dp-place-tile{padding:.35rem;border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-sm);color:var(--gw-text-secondary);background:var(--gw-surface-subtle);cursor:pointer}
.gw-dp-place-tile[aria-pressed="true"]{color:var(--gw-accent-text-on);background:var(--gw-accent);border-color:var(--gw-accent)}
.gw-dp-location-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--gw-space-5);margin-top:var(--gw-space-5)}
.gw-dp-county-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--gw-space-2)}
.gw-dp-town-grid{display:flex;flex-wrap:wrap;gap:var(--gw-space-2)}
.gw-dp-county-tile,.gw-dp-town-tile{padding:.5rem .65rem}
.gw-dp-alert-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(18rem,.8fr);gap:var(--gw-space-5);align-items:start}
.gw-dp-alert-list,.gw-dp-delivery-list{display:grid;gap:var(--gw-space-3)}
.gw-dp-alert-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:var(--gw-space-3);padding:var(--gw-space-4);border:var(--gw-border-w) solid var(--gw-border);border-left:3px solid var(--gw-info-text);border-radius:var(--gw-radius);background:var(--gw-surface-subtle)}
.gw-dp-alert-stop{border-left-color:var(--gw-stop-border);background:var(--gw-tone-stop-well)}
.gw-dp-alert-caution{border-left-color:var(--gw-caution-line);background:var(--gw-tone-caution-well)}
.gw-dp-alert-ok{border-left-color:var(--gw-ok-text);background:var(--gw-tone-ok-well)}
.gw-dp-alert-read{opacity:.72}.gw-dp-alert-icon{font-size:var(--gw-text-xl)}
.gw-dp-alert-copy h3,.gw-dp-alert-copy p{margin:.2rem 0}.gw-dp-alert-copy time{color:var(--gw-text-muted);font:500 var(--gw-text-sm)/1.3 var(--gw-font-mono)}
.gw-dp-mark-read{align-self:start}.gw-dp-switch{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:var(--gw-space-3);padding:var(--gw-space-3);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);color:var(--gw-text);background:var(--gw-surface-subtle);text-align:left;cursor:pointer}
.gw-dp-switch-track{position:relative;width:2rem;height:1.1rem;border-radius:var(--gw-radius-pill);background:var(--gw-border-strong)}
.gw-dp-switch-track span{position:absolute;top:.15rem;left:.15rem;width:.8rem;height:.8rem;border-radius:50%;background:var(--gw-surface)}
.gw-dp-switch[aria-checked="true"] .gw-dp-switch-track{background:var(--gw-accent)}
.gw-dp-switch[aria-checked="true"] .gw-dp-switch-track span{left:1.05rem}
.gw-dp-switch-copy{display:grid}.gw-dp-switch-copy small{color:var(--gw-text-muted)}
.gw-dp-switch[aria-checked="true"]>b{color:var(--gw-accent)}.gw-dp-switch[aria-checked="false"]>b{color:var(--gw-text-muted)}
.gw-dp-trigger-list{margin:.3rem 0;padding-left:1.25rem;color:var(--gw-text-secondary)}
.gw-dp-page button:focus-visible,.gw-dp-page select:focus-visible,.gw-dp-page a:focus-visible{outline:3px solid var(--gw-accent);outline-offset:3px}
@media (max-width:860px){.gw-dp-power-grid,.gw-dp-alert-grid,.gw-dp-location-grid{grid-template-columns:1fr}.gw-dp-state-grid{grid-template-columns:repeat(8,minmax(0,1fr))}.gw-dp-county-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:640px){.gw-dp-inner,.gw-dp-gated,.gw-dp-page[data-mode="simple"] .gw-dp-inner{width:100%;padding:var(--gw-space-4)}.gw-dp-page-head{display:grid}.gw-dp-mode{width:100%}.gw-dp-mode-button{flex:1}.gw-dp-watch-row,.gw-dp-alert-row{grid-template-columns:auto minmax(0,1fr)}.gw-dp-watch-row .gw-dp-remove,.gw-dp-alert-row .gw-dp-mark-read{grid-column:1/-1;width:100%}.gw-dp-location-selects,.gw-dp-coverage-grid,.gw-dp-compare{grid-template-columns:1fr}.gw-dp-state-grid{grid-template-columns:repeat(5,minmax(0,1fr))}.gw-dp-county-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.gw-dp-panel{padding:var(--gw-space-4)}}
@media (prefers-reduced-motion:reduce){.gw-dp-page *{scroll-behavior:auto!important;transition:none!important}}
`;

function ensureDesignPagesStyle(): void {
  if (document.getElementById('gw-design-pages-style')) return;
  const style = el('style', { id: 'gw-design-pages-style' }, [DESIGN_PAGES_STYLE]);
  document.head.append(style);
}
