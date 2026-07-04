/**
 * GOV-606 (GOV-599 real-data) — the agenda Kanban board surface, now wired to the
 * REAL reviewed-Alpine projection (GOV-605, backend PR #96) instead of fixtures.
 *
 * The board consumes the GOV-605 board-projection payload
 * (`stage5_agenda_board.agenda_board(conn)`, contract GOV-601 §2) VERBATIM — a
 * six-lane Kanban of agenda-item cards over `read_api.reviewer_internal_records`.
 * The website invents no civic claim: every card, badge, lane, gap, and source is
 * a leaf the backend already emitted web-safe.
 *
 * The GOV-599 shipped UX is preserved exactly:
 *  - DEFAULT view = "Agendas by meeting" (Board A); the top toggle order is
 *    [Agendas by meeting] [Agenda tracking] (Board B); the choice persists.
 *  - Board A groups the projection's cards by MEETING (newest-first) — a display
 *    ordering, never a trust signal.
 *  - Board B lays the projection's cards across the six frozen lifecycle lanes
 *    (upcoming → correction), exactly as the backend assigned them.
 *  - The true-dark elevation ladder (board < lane < card) is inherited from the
 *    shared board-chrome tokens — this module adds no CSS.
 *
 * Hard rules (GOV-601 §0 / GOV-605 contract, restated as invariants):
 *  - **Reviewer-internal is the SOLE gate.** The projection carries
 *    `access: reviewer_internal`; on any other lane the board renders ZERO card
 *    content (no card, badge, source, or disclosure leaf) — by construction.
 *  - **No trust is recomputed.** `statusBadge` / `confidenceBadge` / `lane` /
 *    `gapBadges` are rendered VERBATIM; the client never upgrades a status,
 *    invents a lane, or hides a disclosed gap.
 *  - **Latents are disclosed-empty, never faked.** `decisions:[]` and
 *    `categoryAnchor` render as disclosed-empty; the board footer surfaces the
 *    decisions/categories/unanchored disclosures.
 *  - **Empty-state honesty.** An empty projection renders a well-formed empty
 *    board (six lanes shown) + the disclosed empty-state — never a fabricated card.
 */

import type {
  AgendaBoard,
  AgendaBoardCard,
  AgendaLane,
  LineageEdge,
  SourceRef,
} from '../types/agenda-board';
import type { StatementRecord } from '../types/read-api';
import { ensureStyle } from './render';
import { confidenceLabel } from './statement-presenter';
import { FIXTURE_BANNER_TEXT } from './state-view';
import type { TrustTone } from './state-view';

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

// --- Verbatim badge → tone (colour only, never a trust decision) ---------------

const AI_BADGE_LABEL = 'AI — not independently verified';

/**
 * Colour tone for a backend `statusBadge` string. This is PRESENTATION ONLY — the
 * backend already fail-closed the badge; this never upgrades or re-derives it.
 * Unknown badges default to `caution` (fail-closed to "not yet trustable").
 */
function statusBadgeTone(badge: string): TrustTone {
  if (badge === 'Verified') return 'ok';
  if (badge === 'Corrected') return 'neutral';
  if (badge === 'Source missing') return 'stop';
  return 'caution'; // Unverified / AI-presented / anything unrecognised
}

/** Whether the (verbatim) status badge marks an AI-presented card. */
function isAiBadge(badge: string): boolean {
  return badge.startsWith('AI');
}

// --- Card component (one agenda-item card, shared by both views) ----------------

function sourceRefRow(ref: SourceRef): HTMLElement {
  const parts: (Node | string)[] = [
    el('span', { class: 'gw-related-type' }, [ref.sourceId]),
  ];
  if (ref.originalUrl) {
    parts.push(' ');
    parts.push(
      el('a', { href: ref.originalUrl, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'source-original' }, ['View original']),
    );
  }
  if (ref.archiveUrl) {
    parts.push(' ');
    parts.push(
      el('a', { href: ref.archiveUrl, target: '_blank', rel: 'noopener noreferrer', 'data-test': 'source-archive' }, ['View archive']),
    );
  }
  const loc = ref.locator;
  if (loc) {
    const bits: string[] = [];
    if (loc.page != null) bits.push(`p.${loc.page}`);
    if (loc.section) bits.push(loc.section);
    if (loc.timestampHuman) bits.push(`@${loc.timestampHuman}`);
    if (bits.length) parts.push(el('span', { class: 'gw-muted' }, [` ${bits.join(' · ')}`]));
  }
  return el('li', { class: 'gw-related', 'data-test': 'source-ref' }, parts);
}

function lineageRow(edge: LineageEdge): HTMLElement {
  // Typed relation label kept verbatim — humanised only cosmetically.
  const label = edge.relation.replace(/^agenda_item_/, '').replace(/_/g, ' ');
  return el('li', { class: 'gw-related', 'data-test': 'lineage-edge' }, [
    el('span', { class: 'gw-related-type' }, [label]),
    ' → ',
    el('span', { class: 'gw-related-target' }, [edge.ref]),
  ]);
}

function agendaCard(card: AgendaBoardCard): HTMLElement {
  const children: (Node | string)[] = [];

  // Meeting context line — date · body · title (grouped ordering, never a trust cue).
  const meetingBits = [card.meetingDate, card.meetingBody, card.meetingTitle].filter(Boolean).join(' · ');
  if (meetingBits) {
    children.push(el('p', { class: 'gw-muted', 'data-test': 'card-meeting' }, [meetingBits]));
  }

  // Agenda item title (the card's subject).
  children.push(
    el('h3', { 'data-test': 'card-title' }, [
      card.agendaItemTitle ?? card.agendaItemId,
    ]),
  );

  // Badges: status (verbatim, toned) + AI label when AI-presented + confidence + lane.
  const badges: HTMLElement[] = [];
  const tone = statusBadgeTone(card.statusBadge);
  badges.push(
    el('span', { class: `gw-badge gw-tone-${tone}`, 'data-test': 'card-status', 'data-tone': tone, title: 'Backend-assigned status (verbatim)' }, [card.statusBadge]),
  );
  if (isAiBadge(card.statusBadge)) {
    badges.push(el('span', { class: 'gw-badge gw-badge-ai', 'data-test': 'card-ai-label' }, [AI_BADGE_LABEL]));
  }
  const conf = confidenceLabel({ confidence_label: card.confidenceBadge } as StatementRecord);
  if (conf) {
    badges.push(el('span', { class: 'gw-badge gw-tone-neutral', 'data-test': 'card-confidence', title: 'Source confidence (verbatim)' }, [conf]));
  }
  badges.push(
    el('span', { class: 'gw-badge gw-tone-neutral', 'data-test': 'card-lane' }, [card.laneLabel]),
  );
  children.push(el('div', { class: 'gw-badges' }, badges));

  // Agenda thread linkage (when present).
  if (card.threadLabel) {
    children.push(
      el('p', { class: 'gw-muted', 'data-test': 'card-thread' }, [
        `Thread: ${card.threadLabel}`,
        ...(card.threadStatus ? [` (${card.threadStatus})`] : []),
      ]),
    );
  }

  // videoRef — a public deep-link, rendered only when the backend composed one.
  if (card.videoRef) {
    const secs = card.videoRef.timestampSeconds;
    children.push(
      el('p', { class: 'gw-related', 'data-test': 'card-video' }, [
        el('a', { href: card.videoRef.url, target: '_blank', rel: 'noopener noreferrer' }, [
          `Watch from ${secs}s`,
        ]),
      ]),
    );
  }

  // Typed lineage (verbatim; never an untyped "related").
  if (card.lineage.length) {
    children.push(
      el('ul', { class: 'gw-related-list', 'data-test': 'card-lineage' }, card.lineage.map(lineageRow)),
    );
  }

  // Source drawer — the web-safe evidence refs.
  if (card.sourceRefs.length) {
    children.push(
      el('details', { class: 'gw-drawer', 'data-test': 'card-sources' }, [
        el('summary', {}, [`Sources (${card.sourceRefs.length})`]),
        el('ul', { class: 'gw-related-list' }, card.sourceRefs.map(sourceRefRow)),
      ]),
    );
  }

  // Disclosed gaps — surfaced visibly, never hidden (unknown codes pass through).
  if (card.gapBadges.length) {
    children.push(
      el('div', { class: 'gw-badges', 'data-test': 'card-gaps' },
        card.gapBadges.map((g) =>
          el('span', { class: 'gw-badge gw-tone-caution', 'data-test': 'gap-badge' }, [g]),
        ),
      ),
    );
  }

  // Latent-by-data fields — rendered as disclosed-empty, never faked.
  children.push(
    el('p', { class: 'gw-muted', 'data-test': 'card-decisions-empty' }, [
      card.decisions.length === 0
        ? 'Decisions: none recorded yet (disclosed-empty — no vote/decision rows landed)'
        : `Decisions: ${card.decisions.length}`,
    ]),
  );
  children.push(
    el('p', { class: 'gw-muted', 'data-test': 'card-category-anchor', title: card.categoryAnchor.disclosure }, [
      `Category anchor: ${card.categoryAnchor.kind} (no topic layer yet)`,
    ]),
  );

  // Traceability footer — record count (aggregation size), never a claim.
  children.push(
    el('p', { class: 'gw-muted', 'data-test': 'card-record-count' }, [
      `${card.recordCount} reviewed statement${card.recordCount === 1 ? '' : 's'} under this item`,
    ]),
  );

  return el('article', {
    class: 'gw-card',
    'data-test': 'agenda-card',
    'data-agenda-item': card.agendaItemId,
    'data-lane': String(card.lane),
  }, children);
}

// --- Board A — Agendas by meeting (cards grouped by meeting, newest-first) ------

const UNDATED = 'Undated';

interface MeetingGroup {
  date: string;
  title?: string;
  body?: string;
  cards: AgendaBoardCard[];
}

function allCards(board: AgendaBoard): AgendaBoardCard[] {
  return board.lanes.flatMap((l) => l.cards);
}

function groupByMeeting(cards: AgendaBoardCard[]): MeetingGroup[] {
  const byDate = new Map<string, MeetingGroup>();
  for (const c of cards) {
    const date = c.meetingDate ?? UNDATED;
    let g = byDate.get(date);
    if (!g) {
      g = { date, cards: [], ...(c.meetingTitle ? { title: c.meetingTitle } : {}), ...(c.meetingBody ? { body: c.meetingBody } : {}) };
      byDate.set(date, g);
    }
    g.cards.push(c);
  }
  // Newest meeting day first; the Undated column always trails.
  return [...byDate.values()].sort((a, b) => {
    if (a.date === UNDATED) return 1;
    if (b.date === UNDATED) return -1;
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
}

function meetingLane(group: MeetingGroup): HTMLElement {
  const n = group.cards.length;
  const header = el('div', { class: 'gw-lane-header' }, [
    el('div', { class: 'gw-lane-title' }, [
      el('span', { class: 'gw-lane-name', 'data-test': 'lane-name' }, [group.date === UNDATED ? 'Undated' : group.date]),
      el('span', { class: 'gw-lane-count', 'data-test': 'lane-count' }, [String(n)]),
    ]),
    el('p', { class: 'gw-lane-sub', 'data-test': 'lane-sub' }, [
      group.title ? `Meeting: ${group.title}` : `${n} agenda item${n === 1 ? '' : 's'} at this meeting`,
    ]),
  ]);
  const body = el('div', { class: 'gw-lane-body' }, group.cards.map(agendaCard));
  return el('section', { class: 'gw-lane', 'data-test': 'meeting-lane', 'data-meeting-date': group.date }, [header, body]);
}

function buildBoardA(board: AgendaBoard): HTMLElement {
  const cards = allCards(board);
  const children: HTMLElement[] = [];

  if (!cards.length) {
    children.push(emptyState('No agenda cards yet', emptyStateDetail(board)));
    children.push(disclosureFooter(board));
    return el('div', { 'data-test': 'board-meeting' }, children);
  }

  const groups = groupByMeeting(cards);
  children.push(
    el('div', { class: 'gw-board', 'data-test': 'board-meeting-lanes', role: 'list', 'aria-label': 'Agendas by meeting' },
      groups.map(meetingLane),
    ),
  );
  children.push(disclosureFooter(board));
  return el('div', { 'data-test': 'board-meeting' }, children);
}

// --- Board B — Agenda tracking (the projection's six lifecycle lanes) -----------

function lifecycleLane(lane: AgendaLane): HTMLElement {
  const header = el('div', { class: 'gw-lane-header' }, [
    el('div', { class: 'gw-lane-title' }, [
      el('span', { class: 'gw-lane-name', 'data-test': 'lane-name' }, [lane.laneLabel]),
      el('span', { class: 'gw-lane-count', 'data-test': 'lane-count' }, [String(lane.cardCount)]),
    ]),
  ]);
  const body = el('div', { class: 'gw-lane-body' },
    lane.cards.length
      ? lane.cards.map(agendaCard)
      : [el('p', { class: 'gw-lane-empty', 'data-test': 'lane-empty' }, ['—'])],
  );
  return el('section', { class: 'gw-lane', 'data-test': 'tracking-lane', 'data-lane': String(lane.lane) }, [header, body]);
}

function buildBoardB(board: AgendaBoard): HTMLElement {
  const root = el('div', { 'data-test': 'board-tracking' });
  root.append(
    el('div', { class: 'gw-board', 'data-test': 'board-tracking-lanes', role: 'list', 'aria-label': 'Agenda tracking' },
      board.lanes.map(lifecycleLane),
    ),
  );
  root.append(disclosureFooter(board));
  return root;
}

// --- Shared: empty-state + board-level disclosures -----------------------------

function emptyState(title: string, detail: string): HTMLElement {
  return el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'state-empty', role: 'status' }, [
    el('h1', {}, [title]),
    el('p', {}, [detail]),
  ]);
}

function emptyStateDetail(board: AgendaBoard): string {
  const n = board.unanchoredStatementCount;
  if (n > 0) {
    return `No reviewed Alpine agenda cards yet. ${n} reviewed statement${n === 1 ? ' is' : 's are'} not yet anchored to an agenda item (disclosed, not dropped).`;
  }
  return 'No reviewed Alpine agenda records exist in this projection yet.';
}

/** Board-level disclosure block — surfaces the projection's own honest limits. */
function disclosureFooter(board: AgendaBoard): HTMLElement {
  const d = board.disclosures;
  const items: HTMLElement[] = [
    el('li', { 'data-test': 'disclosure-decisions' }, [d.decisions]),
    el('li', { 'data-test': 'disclosure-categories' }, [d.categories]),
  ];
  if (board.unanchoredStatementCount > 0) {
    items.push(
      el('li', { 'data-test': 'disclosure-unanchored' }, [
        `${board.unanchoredStatementCount} reviewed statement(s) not yet anchored to an agenda item (disclosed, not dropped).`,
      ]),
    );
  }
  items.push(el('li', { 'data-test': 'disclosure-scope' }, [d.scope]));
  return el('section', { class: 'gw-state', 'data-test': 'board-disclosures', role: 'note' }, [
    el('p', { class: 'gw-muted' }, ['What this board does NOT yet show (disclosed, never faked):']),
    el('ul', { class: 'gw-muted' }, items),
  ]);
}

// --- Shell — toggle + gate + both boards ---------------------------------------

export interface BoardsInput {
  /** The GOV-605 agenda-board projection (the reviewer-internal gate lives on it). */
  board: AgendaBoard;
  /**
   * Optional access override for the route (e.g. force the public lane to prove
   * no board content leaks). Defaults to the projection's own `access`.
   */
  access?: string;
  /** Provenance notice shown under the fixture banner. */
  notice?: string;
  /**
   * True when rendering the clearly-labelled DEV sample projection (populated
   * cards) rather than the real reviewed-Alpine capture — shows a dev banner so it
   * can never be mistaken for real Alpine data.
   */
  devSample?: boolean;
}

/**
 * Render the agenda Kanban surface into `root` from the GOV-605 projection.
 * Default view is "Agendas by meeting". The reviewer-internal lane is the SOLE
 * gate: on any other lane the board renders ZERO card content.
 */
export function renderBoards(root: HTMLElement, input: BoardsInput): void {
  ensureStyle();
  const board = input.board;
  const access = input.access ?? board.access;
  const reviewerInternal = access === 'reviewer_internal';

  // The board page needs more horizontal room than the 48rem reading column.
  root.className = 'gw-root gw-boards-root';
  root.replaceChildren();

  // Always-on offline-snapshot banner (the projection is a committed capture).
  root.append(
    el('div', { class: 'gw-fixture-banner', role: 'status', 'data-test': 'fixture-banner' }, [
      FIXTURE_BANNER_TEXT,
      el('small', {}, [
        `Reviewer-internal offline snapshot of the GOV-605 board projection (${board.generatedFrom}) — not a live read.`,
      ]),
      ...(input.notice ? [el('div', { class: 'gw-notice' }, [input.notice])] : []),
    ]),
  );

  // §5 — public lane renders ZERO board content: gate before any card leaf touches the DOM.
  if (!reviewerInternal) {
    root.append(
      el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'state-reviewer-gated', role: 'status' }, [
        el('h1', {}, ['Reviewer-internal only']),
        el('p', {}, ['The Alpine agenda boards are gated to the reviewer-internal lane. The public lane renders no cards.']),
      ]),
    );
    return;
  }

  // Clearly-labelled DEV sample banner (populated demo — never real Alpine data).
  if (input.devSample) {
    root.append(
      el('div', { class: 'gw-synthetic-banner', role: 'status', 'data-test': 'dev-sample-banner' }, [
        'DEV SAMPLE projection — populated agenda cards from the backend test seed, NOT real Alpine data. Proves the populated-card UX (videoRef / lineage / gaps / disclosed-empty latents).',
      ]),
    );
  }

  const wrap = el('div', { class: 'gw-boards', 'data-test': 'agenda-boards' });
  wrap.append(el('h1', { class: 'gw-h1' }, ['Alpine agendas (reviewer-internal)']));

  // Build both boards once; the toggle swaps which is mounted (no re-fetch).
  const boardA = buildBoardA(board);
  const boardB = buildBoardB(board);

  const mount = el('div', { 'data-test': 'board-mount', id: 'gw-board-mount', role: 'tabpanel' });
  const tabMeeting = el('button', { type: 'button', class: 'gw-view-tab', 'data-test': 'tab-meeting', role: 'tab', id: 'gw-tab-meeting', 'aria-controls': 'gw-board-mount' }, ['Agendas by meeting']);
  const tabTracking = el('button', { type: 'button', class: 'gw-view-tab', 'data-test': 'tab-tracking', role: 'tab', id: 'gw-tab-tracking', 'aria-controls': 'gw-board-mount' }, ['Agenda tracking']);

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
