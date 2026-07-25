/**
 * Three-lane timeline primitives (MOTY Timeline screen).
 *
 * Renders a Town / County / State lane stack across a date axis, with dots
 * positioned by date and an SVG overlay that draws dashed connectors between
 * events belonging to the same issue run when one is focused.
 *
 * Geometry is percentage-based inside a `preserveAspectRatio="none"` viewBox, so
 * nothing depends on measured layout — the same markup is produced in a browser
 * and in jsdom, which keeps connector behaviour testable.
 *
 * This module draws only what the caller supplies. It never infers that two
 * events belong together: `issueKey` must come from a backend-supplied issue or
 * thread id, never from title similarity.
 */

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

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag: string, attrs: Record<string, string> = {}): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

export type TimelineLevel = 'town' | 'county' | 'state';
export type TimelineEventType = 'meeting' | 'document' | 'change' | 'decision';

export interface TimelineEventSpec {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  level: TimelineLevel;
  type: TimelineEventType;
  label: string;
  /** Backend-supplied issue/thread id shared by every event in one run. */
  issueKey?: string;
}

export interface TimelineLaneSpec {
  level: TimelineLevel;
  label: string;
  /** Rendered instead of dots when the lane has no reviewed contract. */
  gapNote?: string;
}

export interface TimelineLanesSpec {
  /** ISO date of the axis start. */
  start: string;
  /** ISO date of the axis end. */
  end: string;
  lanes: TimelineLaneSpec[];
  events: TimelineEventSpec[];
  /** Called when a dot is activated (click / Enter). */
  onSelect?: (event: TimelineEventSpec) => void;
}

const LANE_HEIGHT = 10;
const DIM_OPACITY = '0.22';

function toDay(iso: string): number {
  const parsed = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(parsed) ? Number.NaN : Math.floor(parsed / 86_400_000);
}

/** Maps an ISO date onto 0-100 across the axis window; clamped, NaN-safe. */
export function axisPercent(date: string, start: string, end: string): number {
  const day = toDay(date);
  const from = toDay(start);
  const to = toDay(end);
  if (Number.isNaN(day) || Number.isNaN(from) || Number.isNaN(to) || to <= from) return 0;
  const pct = ((day - from) / (to - from)) * 100;
  return Math.min(100, Math.max(0, Number(pct.toFixed(4))));
}

export const TIMELINE_LANES_STYLE = `${GW_TOKENS}
.gw-tl{position:relative;display:grid;gap:var(--gw-space-2);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);background:var(--gw-surface);padding:var(--gw-space-4)}
.gw-tl-axis{display:flex;justify-content:space-between;font:500 var(--gw-text-badge)/1 var(--gw-font-mono);color:var(--gw-text-muted)}
.gw-tl-stack{position:relative;display:grid;gap:var(--gw-space-2)}
.gw-tl-connectors{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.gw-tl-lane{position:relative;display:grid;grid-template-columns:5.5rem minmax(0,1fr);align-items:center;gap:var(--gw-space-3);min-height:2.75rem}
.gw-tl-lane-name{font:800 var(--gw-text-kicker)/1.3 var(--gw-font);letter-spacing:.09em;text-transform:uppercase;color:var(--gw-text-secondary)}
.gw-tl-track{position:relative;height:2.25rem;border-radius:var(--gw-radius-pill);background:var(--gw-surface-subtle);border:var(--gw-border-w) solid var(--gw-border-subtle)}
.gw-tl-lane[data-level="town"] .gw-tl-lane-name{color:var(--gw-level-town)}
.gw-tl-lane[data-level="county"] .gw-tl-lane-name{color:var(--gw-level-county)}
.gw-tl-lane[data-level="state"] .gw-tl-lane-name{color:var(--gw-level-state)}
.gw-tl-dot{position:absolute;top:50%;width:var(--gw-tap-min);height:var(--gw-tap-min);transform:translate(-50%,-50%);border:0;background:transparent;padding:0;display:grid;place-items:center;transition:opacity .15s ease}
.gw-tl-dot::after{content:"";width:13px;height:13px;border-radius:50%;border:2px solid var(--gw-surface);background:var(--gw-neutral-border)}
.gw-tl-dot[data-type="meeting"]::after{background:var(--gw-ok-text)}
.gw-tl-dot[data-type="document"]::after{background:var(--gw-info-text)}
.gw-tl-dot[data-type="change"]::after{background:var(--gw-stop-text)}
.gw-tl-dot[data-type="decision"]::after{background:var(--gw-caution-text)}
.gw-tl[data-focus-run] .gw-tl-dot{opacity:${DIM_OPACITY}}
.gw-tl[data-focus-run] .gw-tl-dot[data-run-active="true"]{opacity:1}
.gw-tl-gap{position:absolute;top:50%;left:var(--gw-space-3);transform:translateY(-50%);margin:0;font-size:var(--gw-text-badge);color:var(--gw-text-muted)}
.gw-tl-connector{stroke:var(--gw-accent);stroke-width:1.5;stroke-dasharray:4 3;fill:none;vector-effect:non-scaling-stroke}
.gw-tl-legend{display:flex;flex-wrap:wrap;gap:var(--gw-space-3);margin:0;font-size:var(--gw-text-badge);color:var(--gw-text-muted)}
@media print{.gw-tl-connectors{display:none}}
`;

export function ensureTimelineLanesStyle(): void {
  if (document.getElementById('gw-timeline-lanes-style')) return;
  document.head.append(el('style', { id: 'gw-timeline-lanes-style' }, [TIMELINE_LANES_STYLE]));
}

/**
 * Builds a dashed polyline joining every point of one issue run, in the
 * percentage/lane coordinate space of the connector overlay.
 */
export function connectorPoints(
  events: TimelineEventSpec[],
  spec: { start: string; end: string; lanes: TimelineLaneSpec[] },
): string {
  const laneIndex = new Map(spec.lanes.map((lane, index) => [lane.level, index]));
  return events
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((event) => {
      const x = axisPercent(event.date, spec.start, spec.end);
      const row = laneIndex.get(event.level) ?? 0;
      const y = row * LANE_HEIGHT + LANE_HEIGHT / 2;
      return `${x},${y}`;
    })
    .join(' ');
}

/** The full three-lane timeline with hover/focus run highlighting. */
export function timelineLanes(spec: TimelineLanesSpec): HTMLElement {
  ensureTimelineLanesStyle();

  const root = el('div', { class: 'gw-tl', 'data-test': 'timeline-lanes' });

  root.append(el('div', { class: 'gw-tl-axis' }, [
    el('span', {}, [spec.start]),
    el('span', {}, [spec.end]),
  ]));

  const stack = el('div', { class: 'gw-tl-stack' });
  const overlay = svgEl('svg', {
    class: 'gw-tl-connectors',
    viewBox: `0 0 100 ${spec.lanes.length * LANE_HEIGHT}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
    'data-test': 'timeline-connectors',
  });
  stack.append(overlay);

  const clearRun = (): void => {
    root.removeAttribute('data-focus-run');
    overlay.replaceChildren();
    for (const dot of root.querySelectorAll<HTMLElement>('.gw-tl-dot')) {
      dot.removeAttribute('data-run-active');
    }
  };

  const focusRun = (issueKey: string | undefined): void => {
    if (!issueKey) {
      clearRun();
      return;
    }
    const run = spec.events.filter((event) => event.issueKey === issueKey);
    root.setAttribute('data-focus-run', issueKey);
    for (const dot of root.querySelectorAll<HTMLElement>('.gw-tl-dot')) {
      dot.setAttribute('data-run-active', dot.dataset.issueKey === issueKey ? 'true' : 'false');
    }
    overlay.replaceChildren();
    if (run.length > 1) {
      overlay.append(svgEl('polyline', {
        class: 'gw-tl-connector',
        'data-test': 'timeline-connector',
        points: connectorPoints(run, spec),
      }));
    }
  };

  for (const lane of spec.lanes) {
    const track = el('div', { class: 'gw-tl-track', 'data-test': 'timeline-track' });
    const laneEvents = spec.events.filter((event) => event.level === lane.level);

    if (!laneEvents.length && lane.gapNote) {
      track.append(el('p', { class: 'gw-tl-gap', 'data-test': 'timeline-lane-gap' }, [lane.gapNote]));
    }

    for (const event of laneEvents) {
      const dot = el('button', {
        type: 'button',
        class: 'gw-tl-dot',
        'data-test': 'timeline-dot',
        'data-type': event.type,
        'data-event-id': event.id,
        'aria-label': `${event.date} · ${lane.label} · ${event.label}`,
      });
      dot.style.left = `${axisPercent(event.date, spec.start, spec.end)}%`;
      if (event.issueKey) dot.dataset.issueKey = event.issueKey;

      dot.addEventListener('mouseenter', () => focusRun(event.issueKey));
      dot.addEventListener('focus', () => focusRun(event.issueKey));
      dot.addEventListener('mouseleave', clearRun);
      dot.addEventListener('blur', clearRun);
      dot.addEventListener('click', () => spec.onSelect?.(event));
      track.append(dot);
    }

    stack.append(el('div', {
      class: 'gw-tl-lane',
      'data-level': lane.level,
      'data-test': 'timeline-lane',
    }, [
      el('span', { class: 'gw-tl-lane-name' }, [lane.label]),
      track,
    ]));
  }

  root.append(stack);
  return root;
}
