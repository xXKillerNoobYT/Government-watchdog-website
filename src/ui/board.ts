/**
 * GOV-600 (GOV-599 Child 1) — the agenda Kanban board surface.
 *
 * Owner-confirmed UX redesign: replace the long vertical card list with two
 * Kanban boards behind a top toggle. DEFAULT view = "Agendas by meeting"
 * (Board A); the toggle switches to "Agenda tracking" (Board B). Isaac4Alpine's
 * Town Boards are the *layout/interaction reference only* — no content is sourced
 * from that repo.
 *
 * Hard rules carried from the GOV-353/354 contract + the GOV-599 plan (§8):
 *  - **Reviewer-internal is the SOLE gate.** The whole surface renders through
 *    `buildCardFeedModel`; on a non-reviewer-internal lane the model carries ZERO
 *    cards and NONE of the reviewer-internal-only fields, so the public lane shows
 *    no board content — by construction, not merely hidden.
 *  - **No trust/status is recomputed.** Board A groups already-reviewed cards by
 *    their own `date` (a display ordering, never a trust signal) and reuses the
 *    existing `recordCard` (status badge, locked AI label, click-to-reveal blur,
 *    sources drawer). Board B places a thread using the backend's VERBATIM
 *    terminal `AgendaThreadNode.status`; the intermediate as-of lane is a
 *    structural "known-then" display over recorded meeting instances — never a
 *    frontend-inferred status.
 *  - **Honest labelling.** Board A is grouped by meeting DATE until the backend
 *    emits real `meeting_id` (GOV-599 §7 B1). Board B runs on the clearly-labelled
 *    SYNTHETIC agenda-thread demo (the real corpus has 0 threads) — never shown as
 *    real Alpine data.
 */

import type {
  StatementRecord,
  AgendaThreadResponse,
  AgendaItemMember,
  ConceptEdge,
  ReadApiResponse,
} from '../types/read-api';
import type { CardFeed, CardHeadView } from './card-feed';
import { buildCardFeedModel } from './card-feed';
import { recordCard, ensureStyle, gapCardSection } from './render';
import { buildGapSummary } from './timeline';
import { FIXTURE_BANNER_TEXT } from './state-view';

// --- Small DOM helper (children-array form, mirrors render.ts) -----------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

// --- View toggle state (persisted, default = Agendas by meeting) ---------------

export type BoardView = 'meeting' | 'tracking';
const VIEW_KEY = 'gw-board-view';
export const DEFAULT_VIEW: BoardView = 'meeting';

/** Persisted last-chosen view, defaulting to the owner-confirmed "Agendas by meeting". */
export function readBoardView(): BoardView {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'meeting' || v === 'tracking') return v;
  } catch {
    /* storage unavailable — fall back to the default */
  }
  return DEFAULT_VIEW;
}

function persistView(view: BoardView): void {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    /* non-fatal — the in-memory view still switches */
  }
}

// --- Shared date helpers -------------------------------------------------------

/**
 * Pull the `YYYY-MM-DD` a card / member sits at from its Alpine-namespaced id
 * (`alpine:2019-06-11:item-5`). ISO date strings sort/compare lexically, so the
 * as-of cursor never needs Date math. Returns null when no date is embedded.
 */
function isoDateFrom(id: string | undefined | null): string | null {
  if (!id) return null;
  const m = /(\d{4}-\d{2}-\d{2})/.exec(id);
  return m ? m[1] : null;
}

// =============================================================================
// Board A — Agendas by meeting (present cards grouped by meeting date)
// =============================================================================

const UNDATED = 'Undated';

interface MeetingGroup {
  date: string; // ISO date or UNDATED
  records: StatementRecord[];
  /** The `meeting`-type card's title, when one anchors this day (§4.1). */
  meetingTitle?: string;
}

function groupByMeetingDate(
  records: StatementRecord[],
  heads: Map<string, CardHeadView>,
): MeetingGroup[] {
  const byDate = new Map<string, MeetingGroup>();
  for (const r of records) {
    const head = heads.get(r.statement_id);
    const date = head?.date ?? isoDateFrom(r.agenda_item_id) ?? UNDATED;
    let group = byDate.get(date);
    if (!group) {
      group = { date, records: [] };
      byDate.set(date, group);
    }
    group.records.push(r);
    // A `meeting`-type card anchors the column with its title (never fabricated —
    // only used when the backend actually shipped a meeting card for that day).
    if (head?.type === 'meeting' && head.title && !group.meetingTitle) {
      group.meetingTitle = head.title;
    }
  }
  // Newest meeting day first (left→right); the Undated column always trails.
  return [...byDate.values()].sort((a, b) => {
    if (a.date === UNDATED) return 1;
    if (b.date === UNDATED) return -1;
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
}

function meetingLane(
  group: MeetingGroup,
  heads: Map<string, CardHeadView>,
  reviewerInternal: boolean,
): HTMLElement {
  const n = group.records.length;
  const title = el('div', { class: 'gw-lane-title' }, [
    el('span', { class: 'gw-lane-name', 'data-test': 'lane-name' }, [
      group.date === UNDATED ? 'Undated' : group.date,
    ]),
    el('span', { class: 'gw-lane-count', 'data-test': 'lane-count' }, [String(n)]),
  ]);
  const subText = group.meetingTitle
    ? `Meeting: ${group.meetingTitle}`
    : `${n} agenda item${n === 1 ? '' : 's'} at this meeting (grouped by date)`;
  const header = el('div', { class: 'gw-lane-header' }, [
    title,
    el('p', { class: 'gw-lane-sub', 'data-test': 'lane-sub' }, [subText]),
  ]);
  const body = el(
    'div',
    { class: 'gw-lane-body' },
    group.records.map((r) =>
      recordCard(r, undefined, undefined, {
        reviewerInternal,
        ...(heads.get(r.statement_id) ? { head: heads.get(r.statement_id)! } : {}),
      }),
    ),
  );
  return el(
    'section',
    { class: 'gw-lane', 'data-test': 'meeting-lane', 'data-meeting-date': group.date },
    [header, body],
  );
}

/** Board A: meeting-day lanes + the completeness-gap context card above them. */
function buildBoardA(
  response: ReadApiResponse,
  heads: Map<string, CardHeadView>,
  reviewerInternal: boolean,
): HTMLElement {
  const records = response.records ?? [];
  const children: HTMLElement[] = [];

  // What is MISSING stays as prominent as what is present (watchdog principle):
  // reuse the GOV-301 gap card above the board so the ~213 no-primary-source
  // meetings are not erased by the board re-layout.
  const gapSummary = buildGapSummary(response);
  if (gapSummary) children.push(gapCardSection(gapSummary));

  if (!records.length) {
    if (!gapSummary) {
      children.push(
        el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'state-empty', role: 'status' }, [
          el('h1', {}, ['Nothing to show yet']),
          el('p', {}, ['No reviewed Alpine agenda cards in this feed.']),
        ]),
      );
    }
    return el('div', { 'data-test': 'board-meeting' }, children);
  }

  const groups = groupByMeetingDate(records, heads);
  children.push(
    el(
      'div',
      { class: 'gw-board', 'data-test': 'board-meeting-lanes', role: 'list', 'aria-label': 'Agendas by meeting' },
      groups.map((g) => meetingLane(g, heads, reviewerInternal)),
    ),
  );
  return el('div', { 'data-test': 'board-meeting' }, children);
}

// =============================================================================
// Board B — Agenda tracking over time (lifecycle lanes + as-of scrubber)
// =============================================================================

interface LaneDef {
  key: string;
  name: string;
}

/** Lifecycle lanes (GOV-599 §4.2). GOV's own status vocab, not Isaac4Alpine's. */
const TRACKING_LANES: LaneDef[] = [
  { key: 'upcoming', name: 'Upcoming / Noticed' },
  { key: 'open', name: 'Open (in progress)' },
  { key: 'revisited', name: 'Revisited' },
  { key: 'decided', name: 'Decided' },
  { key: 'dormant', name: 'Dormant' },
];

const EDGE_LABEL: Record<string, string> = {
  agenda_item_supersedes: 'Supersedes',
  agenda_item_amends: 'Amends',
  agenda_item_revisits: 'Revisits',
};

/** A scrubber step: `null` iso = "before the first recorded meeting". */
interface ScrubStep {
  iso: string | null;
  label: string;
}

function scrubSteps(members: AgendaItemMember[]): ScrubStep[] {
  const dates = Array.from(
    new Set(members.map((m) => isoDateFrom(m.agenda_item_id)).filter((d): d is string => !!d)),
  ).sort(); // ascending ISO
  return [
    { iso: null, label: 'before first meeting' },
    ...dates.map((d) => ({ iso: d, label: d })),
  ];
}

/**
 * The lane a thread sits in AS OF a cursor date. Structural + verbatim, never a
 * trust inference (GOV-599 §4.2 / §7 B3):
 *  - no recorded instance yet → Upcoming / Noticed;
 *  - all instances recorded (as-of ≥ last_seen) → the backend's VERBATIM terminal
 *    `status` (decided / dormant / open) — the frontend never assigns this;
 *  - mid-life → Revisited when a `revisits` edge from the latest-seen instance is
 *    active, else Open (in progress). This is a display over known-then instance
 *    structure, not a re-computed status.
 */
function laneAsOf(
  thread: AgendaThreadResponse['thread'],
  members: AgendaItemMember[],
  edges: ConceptEdge[],
  asOf: string | null,
): string {
  if (!asOf) return 'upcoming';
  const seen = members
    .map((m) => ({ m, d: isoDateFrom(m.agenda_item_id) }))
    .filter((x) => x.d && x.d <= asOf);
  if (!seen.length) return 'upcoming';

  const last = thread.last_seen_date ?? null;
  if (last && asOf >= last) {
    switch (thread.status) {
      case 'decided':
        return 'decided';
      case 'dormant':
        return 'dormant';
      default:
        return 'open'; // any non-terminal backend status renders as Open, verbatim
    }
  }
  const latest = seen[seen.length - 1].m.agenda_item_id;
  const revisits = edges.some(
    (e) => e.edge_type === 'agenda_item_revisits' && e.from_node_id === latest,
  );
  return revisits ? 'revisited' : 'open';
}

function threadCard(
  response: AgendaThreadResponse,
  asOf: string | null,
): HTMLElement {
  const thread = response.thread;
  const members = response.members ?? [];
  const edges = response.lifecycle_edges ?? [];
  const total = members.length;
  const seen = members.filter((m) => {
    const d = isoDateFrom(m.agenda_item_id);
    return asOf && d ? d <= asOf : false;
  });
  const label = thread.canonicalHumanLabel ?? thread.title ?? thread.agenda_thread_id;

  const children: (Node | string)[] = [
    el('h3', { 'data-test': 'thread-card-title' }, [label]),
    el('div', { class: 'gw-badges' }, [
      // Terminal backend status, rendered VERBATIM (never a frontend verdict).
      el('span', { class: 'gw-badge gw-tone-neutral', 'data-test': 'thread-backend-status', title: 'Terminal status assigned by the backend (verbatim)' }, [
        `Backend status: ${thread.status ?? 'unknown'}`,
      ]),
    ]),
    el('p', { class: 'gw-thread-span', 'data-test': 'thread-span' }, [
      `${thread.first_seen_date ?? '—'} → ${thread.last_seen_date ?? '—'}`,
    ]),
    el('p', { class: 'gw-muted', 'data-test': 'thread-asof-count' }, [
      `${seen.length} of ${total} recorded meeting instance(s) as of this date`,
    ]),
  ];

  // Typed lifecycle edges among the instances seen so far — the "known-then"
  // relationships, shown verbatim (Supersedes / Amends / Revisits), never untyped.
  const seenIds = new Set(seen.map((m) => m.agenda_item_id));
  const titleFor = (id: string): string =>
    members.find((m) => m.agenda_item_id === id)?.title ?? id;
  const activeEdges = edges.filter((e) => seenIds.has(e.from_node_id));
  if (activeEdges.length) {
    children.push(
      el(
        'ul',
        { class: 'gw-thread-edges', 'data-test': 'thread-edges' },
        activeEdges.map((e) =>
          el('li', { class: 'gw-related', 'data-test': 'thread-edge' }, [
            el('span', { class: 'gw-related-type' }, [EDGE_LABEL[e.edge_type] ?? e.edge_type]),
            ' → ',
            el('span', { class: 'gw-related-target' }, [titleFor(e.to_node_id)]),
          ]),
        ),
      ),
    );
  }

  // Per-instance disclosure — the meeting instances recorded up to the cursor.
  if (seen.length) {
    children.push(
      el('details', { class: 'gw-drawer', 'data-test': 'thread-instances-drawer' }, [
        el('summary', {}, [`Meeting instances so far (${seen.length})`]),
        el(
          'ul',
          { class: 'gw-related-list' },
          seen.map((m) =>
            el('li', { class: 'gw-related', 'data-test': 'thread-instance-row' }, [
              el('span', { class: 'gw-instance-date gw-muted' }, [isoDateFrom(m.agenda_item_id) ?? '—']),
              ' ',
              el('span', { class: 'gw-instance-title' }, [m.title ?? m.agenda_item_id]),
            ]),
          ),
        ),
      ]),
    );
  }

  return el('article', { class: 'gw-thread-card', 'data-test': 'thread-card', 'data-thread-id': thread.agenda_thread_id }, children);
}

/** Board B: the synthetic thread-tracking board with a working as-of scrubber. */
function buildBoardB(thread: AgendaThreadResponse | null): HTMLElement {
  const root = el('div', { 'data-test': 'board-tracking' });
  root.append(
    el('div', { class: 'gw-synthetic-banner', role: 'status', 'data-test': 'synthetic-banner' }, [
      'SYNTHETIC demo data — the real reviewed Alpine corpus has no agenda threads yet (backend gap, GOV-599 Child 2). This proves the lane layout + as-of movement, and is NOT real Alpine data.',
    ]),
  );

  if (!thread) {
    root.append(
      el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'state-empty', role: 'status' }, [
        el('h1', {}, ['No agenda threads']),
        el('p', {}, ['No agenda-thread data is available to track.']),
      ]),
    );
    return root;
  }

  const members = thread.members ?? [];
  const edges = thread.lifecycle_edges ?? [];
  const steps = scrubSteps(members);
  // Default the cursor to the last step (terminal state — the newest known-then view).
  let idx = steps.length - 1;

  const asOfLabel = el('span', { class: 'gw-scrub-asof', 'data-test': 'scrub-asof' }, []);
  const note = el('span', { class: 'gw-scrub-note' }, [
    'Drag the date cursor to watch the agenda card move between statuses across meetings. Final status is backend-assigned; intermediate lanes reflect the recorded meeting instances up to the cursor.',
  ]);
  const prev = el('button', { type: 'button', class: 'gw-scrub-btn', 'data-test': 'scrub-prev', 'aria-label': 'Earlier date' }, ['‹']);
  const next = el('button', { type: 'button', class: 'gw-scrub-btn', 'data-test': 'scrub-next', 'aria-label': 'Later date' }, ['›']);
  const scrubber = el('div', { class: 'gw-scrubber', role: 'group', 'aria-label': 'As-of date' }, [
    prev,
    el('span', {}, ['As of: ']),
    asOfLabel,
    next,
    note,
  ]);

  const board = el('div', { class: 'gw-board', 'data-test': 'board-tracking-lanes', role: 'list', 'aria-label': 'Agenda tracking' });

  const renderLanes = (): void => {
    const step = steps[idx];
    const activeLane = laneAsOf(thread.thread, members, edges, step.iso);
    board.setAttribute('data-active-lane', activeLane);
    board.replaceChildren(
      ...TRACKING_LANES.map((lane) => {
        const here = lane.key === activeLane;
        const header = el('div', { class: 'gw-lane-header' }, [
          el('div', { class: 'gw-lane-title' }, [
            el('span', { class: 'gw-lane-name', 'data-test': 'lane-name' }, [lane.name]),
            el('span', { class: 'gw-lane-count', 'data-test': 'lane-count' }, [here ? '1' : '0']),
          ]),
        ]);
        const body = el('div', { class: 'gw-lane-body' }, [
          here
            ? threadCard(thread, step.iso)
            : el('p', { class: 'gw-lane-empty', 'data-test': 'lane-empty' }, ['—']),
        ]);
        return el('section', { class: 'gw-lane', 'data-test': 'tracking-lane', 'data-lane': lane.key }, [header, body]);
      }),
    );
  };

  const sync = (): void => {
    const step = steps[idx];
    asOfLabel.textContent = step.label;
    prev.toggleAttribute('disabled', idx <= 0);
    next.toggleAttribute('disabled', idx >= steps.length - 1);
    renderLanes();
  };
  prev.addEventListener('click', () => {
    if (idx > 0) idx--;
    sync();
  });
  next.addEventListener('click', () => {
    if (idx < steps.length - 1) idx++;
    sync();
  });
  sync();

  root.append(scrubber, board);
  return root;
}

// =============================================================================
// Shell — toggle + gate + both boards
// =============================================================================

export interface BoardsInput {
  /** The GOV-347 card feed (Board A source; the reviewer-internal gate lives here). */
  feed: CardFeed;
  /** The SYNTHETIC agenda-thread response (Board B). Null → Board B shows empty. */
  thread: AgendaThreadResponse | null;
  /** Provenance notice shown under the fixture banner. */
  notice?: string;
}

/**
 * Render the agenda Kanban surface into `root`. Default view is "Agendas by
 * meeting". The reviewer-internal gate is the SOLE gate: on any other lane the
 * board content is empty by construction (the card model returns 0 cards and the
 * synthetic Board B is not rendered).
 */
export function renderBoards(root: HTMLElement, input: BoardsInput): void {
  ensureStyle();
  const { response, heads } = buildCardFeedModel(input.feed);
  const reviewerInternal = response.access === 'reviewer_internal';

  // The board page needs more horizontal room than the 48rem reading column, so
  // the five lifecycle lanes fit without a horizontal scroll hiding the populated
  // one. `gw-boards-root` (specificity 0,2,0) widens the base `.gw-root` cap.
  root.className = 'gw-root gw-boards-root';
  root.replaceChildren();

  // Always-on offline-snapshot banner (the feed is a committed fixture).
  root.append(
    el('div', { class: 'gw-fixture-banner', role: 'status', 'data-test': 'fixture-banner' }, [
      FIXTURE_BANNER_TEXT,
      el('small', {}, ['Reviewer-internal offline snapshot — not a live read. AI-produced rows keep their own per-record label.']),
      ...(input.notice ? [el('div', { class: 'gw-notice' }, [input.notice])] : []),
    ]),
  );

  // §5.1 — public lane renders ZERO board content. The card model already
  // returned an empty response; surface only the reviewer-internal notice.
  if (!reviewerInternal) {
    root.append(
      el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'state-reviewer-gated', role: 'status' }, [
        el('h1', {}, ['Reviewer-internal only']),
        el('p', {}, ['The Alpine agenda boards are gated to the reviewer-internal lane. The public lane renders no cards.']),
      ]),
    );
    return;
  }

  const wrap = el('div', { class: 'gw-boards', 'data-test': 'agenda-boards' });
  wrap.append(el('h1', { class: 'gw-h1' }, ['Alpine agendas (reviewer-internal)']));

  // Build both boards once; the toggle swaps which is mounted (no re-fetch).
  const boardA = buildBoardA(response, heads, reviewerInternal);
  const boardB = buildBoardB(input.thread);

  const mount = el('div', { 'data-test': 'board-mount' });
  const tabMeeting = el(
    'button',
    { type: 'button', class: 'gw-view-tab', 'data-test': 'tab-meeting', role: 'tab', id: 'gw-tab-meeting', 'aria-controls': 'gw-board-mount' },
    ['Agendas by meeting'],
  );
  const tabTracking = el(
    'button',
    { type: 'button', class: 'gw-view-tab', 'data-test': 'tab-tracking', role: 'tab', id: 'gw-tab-tracking', 'aria-controls': 'gw-board-mount' },
    ['Agenda tracking'],
  );
  mount.setAttribute('id', 'gw-board-mount');
  mount.setAttribute('role', 'tabpanel');

  const show = (view: BoardView): void => {
    const meeting = view === 'meeting';
    tabMeeting.setAttribute('aria-selected', String(meeting));
    tabTracking.setAttribute('aria-selected', String(!meeting));
    mount.setAttribute('aria-labelledby', meeting ? 'gw-tab-meeting' : 'gw-tab-tracking');
    mount.replaceChildren(meeting ? boardA : boardB);
    persistView(view);
  };

  tabMeeting.addEventListener('click', () => show('meeting'));
  tabTracking.addEventListener('click', () => show('tracking'));

  // Owner-confirmed toggle ORDER: [Agendas by meeting] [Agenda tracking].
  const toggle = el('div', { class: 'gw-view-toggle', role: 'tablist', 'aria-label': 'Board view', 'data-test': 'view-toggle' }, [
    tabMeeting,
    tabTracking,
  ]);
  wrap.append(toggle, mount);
  root.append(wrap);

  // Default = Agendas by meeting (owner confirmation); a persisted choice wins.
  show(readBoardView());
}
