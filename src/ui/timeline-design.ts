/**
 * Gated synthetic Timeline fixture (MOTY `Timeline.dc.html`).
 *
 * Renders the design's three-lane river at full fidelity using the shared
 * timeline-lane primitive. Every record here is invented for visual review:
 * the module fails closed unless the caller supplies BOTH reviewer-internal
 * access and explicit fixture consent, and the shell stamps the route with the
 * SYNTHETIC DESIGN FIXTURE banner.
 *
 * Issue runs join on an explicit `issueKey` carried by the fixture rows — the
 * same contract a reviewed response must supply. Nothing here infers that two
 * events are related from their titles.
 */

import { comingSoonChip } from './coming-soon';
import {
  timelineLanes,
  type TimelineEventSpec,
  type TimelineLaneSpec,
} from './timeline-lanes';
import { readMode } from './shell';
import { GW_TOKENS } from './tokens';

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

export interface TimelineDesignOptions {
  access?: string;
  fixture?: boolean;
}

export const DESIGN_FIXTURE_LABEL = 'SYNTHETIC DESIGN FIXTURE — not a live read';

/** The design's `?issue=` vocabulary. Anything else fails closed to `all`. */
export const ISSUE_SLUGS = [
  'all',
  'thread',
  'moratorium',
  'fees',
  'str',
  'landuse',
  'annexation',
  'water',
  'permits',
  'council',
  'ludc',
  'ami',
] as const;
export type IssueSlug = (typeof ISSUE_SLUGS)[number];

/** The zoning thread preset — a saved multi-issue view, not a derived cluster. */
export const THREAD_PRESET: readonly string[] = ['annexation', 'ludc', 'landuse', 'moratorium', 'str'];

export const AXIS_START = '2026-07-06';
export const AXIS_END = '2026-08-05';

const LANES: TimelineLaneSpec[] = [
  { level: 'town', label: 'Town' },
  { level: 'county', label: 'County' },
  { level: 'state', label: 'State' },
];

/** Synthetic events. Titles describe fixture records, never real proceedings. */
const FIXTURE_EVENTS: readonly TimelineEventSpec[] = [
  { id: 'fx-01', date: '2026-07-06', level: 'town', type: 'document', label: 'Fixture agenda posted', issueKey: 'moratorium' },
  { id: 'fx-02', date: '2026-07-08', level: 'town', type: 'document', label: 'Fixture packet published', issueKey: 'fees' },
  { id: 'fx-03', date: '2026-07-10', level: 'county', type: 'meeting', label: 'Fixture county session', issueKey: 'landuse' },
  { id: 'fx-04', date: '2026-07-13', level: 'town', type: 'change', label: 'Fixture attachment replaced', issueKey: 'fees' },
  { id: 'fx-05', date: '2026-07-15', level: 'state', type: 'document', label: 'Fixture state filing', issueKey: 'str' },
  { id: 'fx-06', date: '2026-07-17', level: 'town', type: 'document', label: 'Fixture staff report', issueKey: 'annexation' },
  { id: 'fx-07', date: '2026-07-21', level: 'town', type: 'meeting', label: 'Fixture council meeting', issueKey: 'moratorium' },
  { id: 'fx-08', date: '2026-07-21', level: 'town', type: 'decision', label: 'Fixture motion recorded', issueKey: 'fees' },
  { id: 'fx-09', date: '2026-07-23', level: 'county', type: 'document', label: 'Fixture county notice', issueKey: 'landuse' },
  { id: 'fx-10', date: '2026-07-25', level: 'town', type: 'change', label: 'Fixture late revision', issueKey: 'ludc' },
  { id: 'fx-11', date: '2026-07-28', level: 'town', type: 'meeting', label: 'Fixture hearing', issueKey: 'annexation' },
  { id: 'fx-12', date: '2026-07-30', level: 'state', type: 'meeting', label: 'Fixture interim committee', issueKey: 'str' },
  { id: 'fx-13', date: '2026-08-03', level: 'county', type: 'decision', label: 'Fixture county decision', issueKey: 'landuse' },
  { id: 'fx-14', date: '2026-08-04', level: 'town', type: 'meeting', label: 'Fixture follow-up meeting', issueKey: 'moratorium' },
];

const WINDOWS = [
  { id: 'n3', label: 'Next 3 weeks' },
  { id: '90d', label: '90 days' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All records' },
] as const;

/** Fail closed: an unrecognised slug collapses to the unfiltered view. */
export function normalizeIssueSlug(raw: string | null): IssueSlug {
  if (!raw) return 'all';
  return (ISSUE_SLUGS as readonly string[]).includes(raw) ? (raw as IssueSlug) : 'all';
}

export function eventsForSlug(slug: IssueSlug): TimelineEventSpec[] {
  if (slug === 'all') return [...FIXTURE_EVENTS];
  if (slug === 'thread') {
    return FIXTURE_EVENTS.filter((e) => e.issueKey && THREAD_PRESET.includes(e.issueKey));
  }
  return FIXTURE_EVENTS.filter((e) => e.issueKey === slug);
}

function hasFixtureAccess(options: TimelineDesignOptions): boolean {
  return options.access === 'reviewer_internal' && options.fixture === true;
}

export const TIMELINE_DESIGN_STYLE = `${GW_TOKENS}
.gw-tld{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-4);padding:var(--gw-space-5) var(--gw-space-4);max-width:1200px;margin:0 auto;color:var(--gw-text);font-family:var(--gw-font)}
.gw-tld-banner{border:var(--gw-border-w) solid var(--gw-tone-caution-line);background:var(--gw-tone-caution-well);color:var(--gw-caution-text);border-radius:var(--gw-radius-sm);padding:var(--gw-space-2) var(--gw-space-3);font:700 var(--gw-text-badge)/1.4 var(--gw-font-mono);letter-spacing:.04em}
.gw-tld-head{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-2)}
.gw-tld-head h1{font-size:var(--gw-text-display);line-height:var(--gw-leading-tight)}
.gw-tld-head p{margin:0;color:var(--gw-text-secondary);max-width:62ch}
.gw-tld-controls{display:flex;flex-wrap:wrap;gap:var(--gw-space-2);align-items:center}
.gw-tld-pill{min-height:var(--gw-tap-min);display:inline-flex;align-items:center;padding:0 var(--gw-space-3);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);background:transparent;color:var(--gw-text-secondary);font-size:var(--gw-text-sm);text-decoration:none}
.gw-tld-pill[aria-pressed="true"],.gw-tld-pill[aria-current="true"]{border-color:var(--gw-accent);background:var(--gw-surface-accent-tint);color:var(--gw-text)}
.gw-tld-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-2)}
.gw-tld-row{display:grid;grid-template-columns:7rem minmax(0,1fr);gap:var(--gw-space-3);align-items:baseline;border-top:var(--gw-border-w) solid var(--gw-border);padding-top:var(--gw-space-2)}
.gw-tld-row time{font:500 var(--gw-text-badge)/1.4 var(--gw-font-mono);color:var(--gw-text-muted)}
.gw-tld-row b{font-weight:600}
.gw-tld-tag{margin-left:var(--gw-space-2);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-sm);padding:0 var(--gw-space-2);font:500 var(--gw-text-badge)/1.6 var(--gw-font-mono);color:var(--gw-text-muted)}
.gw-tld-gate{max-width:52rem;margin:var(--gw-space-6) auto;border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);padding:var(--gw-space-6);color:var(--gw-text);font-family:var(--gw-font)}
@media (max-width:600px){.gw-tld-row{grid-template-columns:minmax(0,1fr)}}
`;

function ensureTimelineDesignStyle(): void {
  if (document.getElementById('gw-timeline-design-style')) return;
  document.head.append(el('style', { id: 'gw-timeline-design-style' }, [TIMELINE_DESIGN_STYLE]));
}

function gate(root: HTMLElement): void {
  root.replaceChildren(el('section', { class: 'gw-tld-gate', 'data-test': 'timeline-design-gate' }, [
    el('h1', {}, ['Design fixture unavailable']),
    el('p', {}, [
      'This screen renders synthetic sample records for visual review. It needs both '
      + 'reviewer-internal access and explicit fixture mode, so nothing is shown here.',
    ]),
  ]));
}

/**
 * Render the synthetic three-lane timeline. Fails closed before any fixture
 * leaf reaches the DOM.
 */
export function renderTimelineDesign(
  root: HTMLElement,
  query: URLSearchParams,
  options: TimelineDesignOptions = {},
): void {
  ensureTimelineDesignStyle();
  root.className = 'gw-tld';
  root.replaceChildren();

  if (!hasFixtureAccess(options)) {
    gate(root);
    return;
  }

  const slug = normalizeIssueSlug(query.get('issue'));
  const events = eventsForSlug(slug);
  const mode = readMode();

  root.append(el('p', {
    class: 'gw-tld-banner',
    role: 'status',
    'data-test': 'timeline-design-banner',
  }, [DESIGN_FIXTURE_LABEL]));

  root.append(el('header', { class: 'gw-tld-head' }, [
    el('h1', {}, ['Timeline']),
    el('p', {}, [
      'Town, county, and state activity on one axis. Hover or focus a marker to '
      + 'follow that issue across levels; every record below is a synthetic sample.',
    ]),
  ]));

  const issueControls = el('div', { class: 'gw-tld-controls', 'data-test': 'timeline-design-issues' });
  for (const option of ISSUE_SLUGS) {
    const attrs: Record<string, string> = {
      class: 'gw-tld-pill',
      href: `#/timeline?demo=design&issue=${option}`,
      'data-test': 'timeline-issue-pill',
      'data-issue': option,
    };
    if (option === slug) attrs['aria-current'] = 'true';
    issueControls.append(el('a', attrs, [option === 'thread' ? 'Zoning thread' : option]));
  }
  root.append(issueControls);

  // Window pills describe THIS fixture response only; Simple mode shows the
  // first two, matching the reference's reduced control set.
  const windowControls = el('div', { class: 'gw-tld-controls', 'data-test': 'timeline-design-windows' });
  const visibleWindows = mode === 'simple' ? WINDOWS.slice(0, 2) : WINDOWS;
  visibleWindows.forEach((w, index) => {
    // C7 (iteration 44): these pills were ENABLED with `aria-pressed` and no handler
    // anywhere — a screen reader announced a toggle state and activating did nothing.
    // Micro-detail rule 5: a button either works, leads somewhere, or is not rendered;
    // an unavailable one must say why. No reviewed time-window projection exists, so they
    // are inert-and-explained, matching the disabled+title convention used elsewhere.
    windowControls.append(el('button', {
      type: 'button',
      class: 'gw-tld-pill',
      'data-test': 'timeline-window-pill',
      'data-window': w.id,
      'aria-pressed': index === 0 ? 'true' : 'false',
      disabled: '',
      title: index === 0
        ? 'This is the window this fixture response covers.'
        : 'Window selection needs a reviewed timeline-window projection.',
    }, [w.label]));
  });
  windowControls.append(comingSoonChip('Saved timeline views'));
  root.append(windowControls);

  root.append(timelineLanes({
    start: AXIS_START,
    end: AXIS_END,
    lanes: LANES,
    events,
    onSelect: (event) => {
      if (event.issueKey) window.location.hash = `#/timeline?demo=design&issue=${event.issueKey}`;
    },
  }));

  const list = el('ul', { class: 'gw-tld-list', 'data-test': 'timeline-design-list' });
  for (const event of [...events].sort((a, b) => a.date.localeCompare(b.date))) {
    list.append(el('li', { class: 'gw-tld-row', 'data-test': 'timeline-design-row' }, [
      el('time', { datetime: event.date }, [event.date]),
      el('span', {}, [
        el('b', {}, [event.label]),
        el('span', { class: 'gw-tld-tag' }, [`#${event.issueKey ?? 'untagged'}`]),
      ]),
    ]));
  }
  root.append(el('section', {}, [
    el('h2', {}, [`Event list — ${events.length} matching`]),
    list,
  ]));
}
