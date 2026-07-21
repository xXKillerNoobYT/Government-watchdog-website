/**
 * App boot.
 *
 * GOV-419 — the DEFAULT entry is the preview-launch LANDING; the full
 * reviewer-internal app is revealed only past the gated-beta entry:
 *  - `/`         preview-launch landing (gate-aware; no civic data pre-gate).
 *  - `/app`      timeline skeleton (GOV-99/100): cards, drawers, trust labels —
 *                GATED (reviewer bypass or `?gate=approved` required).
 *  - `/topics`   civic topic tree (GOV-102): rollup filter, derived breadcrumb,
 *                human-label-first nodes + inspectable gov alias, audited move,
 *                cycle-safe degrade — ABOVE the reused B card+drawer timeline.
 *  - `/body`,
 *    `/meeting`  body/meeting surfaces (GOV-102): the same B card+drawer list
 *                under a page-context heading (reuse, not a re-implementation).
 *
 * A `?state=` query override forces loading / empty / error for screenshots.
 * `/topics` accepts `?topic=<id>` (focus → breadcrumb + rollup highlight) and
 * `?move=<childId>:<newParentId>` (demonstrate an audited re-home).
 */

// GOV-658 §2.3 — self-hosted webfonts (side-effect import; app-boot only, keeps
// the unit-test path hermetic). Vendored WOFF2, zero third-party font beacons (§3.5).
import './ui/fonts';
import { createRouter } from './router';
import type { RouteHandler } from './router';
import { renderLanding, renderGatedApp } from './ui/landing';
import { resolveAccess } from './gate/access';
import { loadReadModel, isEmptyResponse } from './data/client';
import { assertWebSafe } from './data/web-safe';
import { render, renderCardFeed } from './ui/render';
import { renderBoards } from './ui/board';
import { renderHome } from './ui/home';
import {
  renderBoardsDirectory,
  renderFastAgenda,
  renderIssueDetail,
  renderLocation as renderReviewedLocation,
  renderPowerTracker as renderReviewedPowerTracker,
  renderSourceVault,
  renderTimelineLevels,
  renderWatchlist as renderReviewedWatchlist,
} from './ui/pages-program';
import { renderFastAgendaDesign } from './ui/fast-agenda-design';
import {
  renderAlerts as renderDesignAlerts,
  renderLocation as renderDesignLocation,
  renderPowerTracker as renderDesignPowerTracker,
  renderWatchlist as renderDesignWatchlist,
  type DesignPageOptions,
} from './ui/design-pages';
import { renderTopicTreeView } from './ui/topic-tree-view';
import { mountThemeToggle } from './ui/theme-toggle';
import { renderShell, type ShellOrigin } from './ui/shell';
import {
  loadDigestResponse,
  renderNewsletterArchive,
  renderNewsletterDetail,
  renderNewsletterState,
  type NewsletterStateKind,
} from './ui/newsletter';
import type { CardFeed } from './ui/card-feed';
import { idle, loading, failed, resolved } from './state/async-state';
import type { AsyncState } from './state/async-state';
import type { ReadApiResponse } from './types/read-api';
import type { MoveRequest } from './ui/topic-tree';
import stateMatrixData from './fixtures/state-matrix.json';
import conceptGraphDemoData from './fixtures/concept-graph-demo.json';
import conceptGraphRealData from './fixtures/concept-graph-real.json';
import cardFeedData from './fixtures/alpine-card-feed.json';
import newsletterDigestData from './fixtures/alpine-newsletter-digest.json';
import agendaBoardData from './fixtures/agenda-board-projection.json';
import agendaBoardSampleData from './fixtures/agenda-board-projection.sample.dev.json';
import type { AgendaBoard } from './types/agenda-board';

/**
 * State-matrix sample (GOV-104): one labeled card per record-level trust state
 * (pending-review / disputed / corrected / do-not-publish) so the legend + each
 * status badge can be captured in one screenshot. Swept for raw paths at load,
 * exactly like the main fixture — demo scaffolding, never a trust recompute.
 */
const STATE_MATRIX: ReadApiResponse = assertWebSafe(stateMatrixData as ReadApiResponse);

/**
 * REAL concept-graph capture (GOV-150): a byte-faithful capture of GOV-149's
 * reviewer-internal `read_api` serve over the REAL Alpine corpus — real
 * `topic_tree` (root "Town of Alpine" + 3 civic topics, 3 `topic_rollup` edges,
 * 3 char-span government-term aliases) plus the 6 real reviewer-internal
 * statement records. Reproduce command + provenance are in the file's
 * `_provenance` block. Reviewer-internal only; nothing here is owner-published.
 *
 * It carries NO `agenda_thread`: the real corpus supports 0 threads (GOV-149
 * Gate-1 accepted this honest-EMPTY deviation — no thread is fabricated from
 * title similarity). The agenda-thread + completeness surfaces therefore keep
 * the SYNTHETIC {@link GRAPH_DEMO} below until real agenda structure exists.
 */
const GRAPH_REAL: ReadApiResponse = assertWebSafe(conceptGraphRealData as ReadApiResponse);
const GRAPH_REAL_NOTICE =
  'Real reviewer-internal concept-graph capture (GOV-149 read_api serve over the Alpine corpus) — reviewer-internal, not owner-published.';
/** Real tree focuses the jurisdiction root so the full civic-topic rollup shows. */
const REAL_DEFAULT_FOCUS = 'topic:alpine:jurisdiction';

/**
 * Concept-graph SYNTHETIC demo (GOV-129): a clearly-labeled sample carrying the
 * agenda-thread + completeness + deep-nesting shapes the REAL flat capture
 * cannot exercise (the real tree is depth-2: root + leaf civic topics, 0
 * threads). Used ONLY by `?demo=graph-synthetic` (nesting + audited move) and
 * `?demo=complete` (thread completeness), always under a visible "not real
 * data" notice — NEVER presented as real. The real `/topics` tree comes from
 * {@link GRAPH_REAL}.
 */
const GRAPH_DEMO: ReadApiResponse = assertWebSafe(conceptGraphDemoData as ReadApiResponse);
const GRAPH_DEMO_NOTICE =
  'SYNTHETIC concept-graph sample (deep nesting / agenda thread / completeness) — not real data; the real corpus has no agenda threads yet.';

/**
 * GOV-354 — the GOV-347 card feed for the reviewer-internal Alpine timeline.
 * Verbatim capture of `scripts/stage3_card_feed.py` at backend `origin/main` HEAD
 * `6d65bd3` over the real reviewed Alpine corpus (see the file `_provenance`).
 * Swept for raw paths at module load exactly like the other fixtures.
 */
const CARD_FEED: CardFeed = assertWebSafe(cardFeedData as unknown as CardFeed);
const CARD_FEED_NOTICE =
  'Verbatim GOV-347 card-feed capture (reviewer-internal, backend HEAD 6d65bd3) — not a live read.';

/**
 * GOV-606 (GOV-599 real-data) — the REAL reviewed-Alpine agenda-board projection,
 * captured VERBATIM from `stage5_agenda_board.agenda_board(conn)` over the reviewed
 * read-API (GOV-605, backend merge 655afba3 / PR #96) run against the Stage-1
 * reviewer-internal promotion seed (the 6 real reviewer-internal Alpine rows,
 * GOV-146/GOV-208). The real corpus has no agenda-anchored reviewed statements yet,
 * so this is the HONEST empty board: `cardCount:0`, six lanes shown, and 6 reviewed
 * statements disclosed as not-yet-anchored — never a fabricated card (AC4/AC5).
 * Raw-path swept on load (defence-in-depth over the backend's own transport sweep).
 */
const BOARD_PROJECTION: AgendaBoard = assertWebSafe(agendaBoardData as unknown as AgendaBoard);
const BOARD_NOTICE =
  'Verbatim GOV-605 agenda-board projection over the reviewed Alpine corpus (backend merge 655afba3) — not a live read.';

/**
 * GOV-606 DEV sample — a genuine `agenda_board(conn)` output over the backend's own
 * test seed (NOT real Alpine data), used only via `#/app?demo=sample` to exercise
 * the populated-card UX (videoRef / lineage / gap badges / disclosed-empty latents)
 * the real empty board cannot show. Always rendered under a "DEV SAMPLE" banner.
 */
const BOARD_SAMPLE: AgendaBoard = assertWebSafe(agendaBoardSampleData as unknown as AgendaBoard);
const BOARD_SAMPLE_NOTICE =
  'DEV SAMPLE — genuine agenda_board() output over the backend test seed, NOT real Alpine data.';

/**
 * GOV-462 — the Stage 4.05 reviewer-internal Alpine newsletter digest object,
 * captured verbatim from a real `assemble_digests(...)` run (backend origin/main
 * PR #79 / cf61ea5; see the fixture `_provenance`). Route-aware web-safe sweep on
 * load (`loadDigestResponse` → `assertDigestWebSafe`): `localSourcePath` is always
 * null and `/alpine/` route links are exempt from the absolute-path rule (mirrors
 * the backend's own `_assert_local_safe`). No live digest endpoint is wired this
 * slice — fixture mode only.
 */
const NEWSLETTER_DIGEST = loadDigestResponse(newsletterDigestData);
const NEWSLETTER_NOTICE =
  'Verbatim Stage 4.05 digest capture (reviewer-internal, backend cf61ea5 / PR #79) — not a live read.';

const root = document.getElementById('app');
if (!root) throw new Error('missing #app mount');

function el(tag: string, attrs: Record<string, string> = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text) node.textContent = text;
  return node;
}

/**
 * Screenshot-only override for the `complete` completeness state (GOV-101
 * evidence: one `complete`, one `gaps`). The labeled fixture ships the honest
 * `gaps` state for this sample; `?demo=complete` substitutes a backend-equivalent
 * `complete` assessment so the indicator's complete rendering can be captured.
 * This is demo scaffolding (like `?state=`), NOT a frontend recompute of
 * completeness — the value is supplied as data and rendered verbatim.
 */
function completeDemoBody(): ReadApiResponse {
  // Completeness lives on the agenda thread, which only exists in the synthetic
  // concept-graph demo (the real reviewed corpus has none). Render from the
  // labeled demo, never from the real FIXTURE.
  const base = GRAPH_DEMO;
  if (!base.agenda_thread) return base;
  return {
    ...base,
    agenda_thread: { ...base.agenda_thread, completeness: { state: 'complete' } },
  };
}

/**
 * Screenshot-only sample for the GOV-314 provenance / audit-passed badge. The
 * REAL fixture predates GOV-311 so every record fails closed to "unverified" —
 * this labeled sample carries one `grounded` and one `unverified` record so BOTH
 * badge states can be captured in one frame. Like `?demo=matrix`, it is demo
 * scaffolding rendered VERBATIM (the `provenance_status` values are supplied as
 * data, NOT recomputed on the client) and is always shown under a "not real
 * data" notice. Reviewer-internal access so the lane gate emits the badge.
 */
function provenanceDemoBody(): ReadApiResponse {
  return assertWebSafe({
    scope: 'alpine',
    access: 'reviewer_internal',
    records: [
      {
        statement_id: 'demo-prov-grounded',
        statement_text:
          'SAMPLE record — the full canonical provenance chain audited clean: grounded, raw-preserved, AI run OK.',
        ui_status: 'source-backed',
        verification_status: 'reviewed_source_linked',
        correction_status: 'none',
        produced_by: 'human',
        is_verbatim: 1,
        publication_state: 'publishable',
        provenance_status: 'grounded',
        confidence_label: 'source_anchored_timed',
        speaker_label: 'Jane Doe, Mayor',
        evidence: [
          {
            to_source_id: 'sample_minutes_2024_03',
            source_type: 'Meeting minutes',
            published_by: 'Town of Alpine Clerk',
            jurisdiction: 'Alpine, WY',
            source_date: '2024-03-12',
            original_url: 'https://records.example/alpine/2024-03-12.html',
            archive_url: 'https://web.archive.org/web/2024/https://records.example/alpine/2024-03-12.html',
            scan_date: '2024-03-13',
            verification_status: 'human_verified',
            correction_status: 'none',
          },
        ],
      },
      {
        statement_id: 'demo-prov-unverified',
        statement_text:
          'SAMPLE record — at least one provenance leg did not pass, so it is shown fail-closed as unverified.',
        ui_status: 'pending-review',
        verification_status: 'machine_extracted_unreviewed',
        correction_status: 'none',
        produced_by: 'ai',
        is_verbatim: 0,
        publication_state: 'publishable',
        provenance_status: 'unverified',
        confidence_label: 'auto_caption_untimed',
        speaker_label: 'Meeting Attendee',
        evidence: [
          {
            to_source_id: 'sample_auto_caption_2024_02',
            source_type: 'Auto-caption transcript',
            published_by: 'Town of Alpine (YouTube auto-caption)',
            jurisdiction: 'Alpine, WY',
            source_date: '2024-02-06',
            verification_status: 'machine_extracted_unreviewed',
            correction_status: 'none',
          },
        ],
      },
    ],
  } as ReadApiResponse);
}
const PROVENANCE_DEMO_NOTICE =
  'SAMPLE — not real data. Demonstrates the GOV-314 provenance / audit-passed badge (reviewer-internal): one grounded record, one fail-closed unverified record.';

/** Default screenshot scenario so `/topics` shows everything with no query. */
const DEFAULT_FOCUS = 'topic:fire';
const DEFAULT_MOVE: MoveRequest = {
  topicId: 'topic:fireworks',
  toParentTopicId: 'topic:safety',
  movedBy: 'reviewer:demo',
  // Fixed stamp keeps screenshots/diffs stable (live edits would use Date.now()).
  movedAtUtc: '2026-06-09T00:00:00Z',
};

function parseMove(query: URLSearchParams): MoveRequest | undefined {
  const raw = query.get('move');
  if (!raw) return DEFAULT_MOVE;
  const [topicId, toParentTopicId] = raw.split(':');
  if (!topicId || !toParentTopicId) return DEFAULT_MOVE;
  return { topicId, toParentTopicId, movedBy: 'reviewer:demo', movedAtUtc: '2026-06-09T00:00:00Z' };
}

/** Move only when explicitly requested (the real flat tree has no demo move). */
function parseOptionalMove(query: URLSearchParams): MoveRequest | undefined {
  const raw = query.get('move');
  if (!raw) return undefined;
  const [topicId, toParentTopicId] = raw.split(':');
  if (!topicId || !toParentTopicId) return undefined;
  return { topicId, toParentTopicId, movedBy: 'reviewer:demo', movedAtUtc: '2026-06-09T00:00:00Z' };
}

/** Force a state for review/screenshots: ?state=loading|empty|error. */
function forcedState(forced: string | null): AsyncState<ReadApiResponse> | null {
  if (forced === 'loading') return loading<ReadApiResponse>('fixture');
  if (forced === 'error') return failed<ReadApiResponse>(new Error('Reviewer-internal read-API is unreachable.'), 'fixture');
  if (forced === 'empty') {
    const emptyBody: ReadApiResponse = { scope: 'alpine', access: 'reviewer_internal', records: [] };
    return resolved(emptyBody, 'fixture', isEmptyResponse);
  }
  return null;
}

// Timeline route: ?state= overrides loading/empty/error; ?demo=complete shows
// the backend-equivalent `complete` completeness state for screenshots.
async function renderTimeline(mount: HTMLElement, query: URLSearchParams): Promise<void> {
  const forced = forcedState(query.get('state'));
  if (forced) return render(mount, forced);
  if (query.get('demo') === 'matrix') {
    render(mount, resolved(STATE_MATRIX, 'fixture', isEmptyResponse), 'State-matrix sample — one card per trust state, not real data.');
    return;
  }
  if (query.get('demo') === 'complete') {
    render(mount, resolved(completeDemoBody(), 'fixture', isEmptyResponse), 'Showing a labeled sample — not real data.');
    return;
  }
  if (query.get('demo') === 'provenance') {
    render(mount, resolved(provenanceDemoBody(), 'fixture', isEmptyResponse), PROVENANCE_DEMO_NOTICE);
    return;
  }
  render(mount, idle<ReadApiResponse>());
  const { state, notice } = await loadReadModel();
  render(mount, state, notice);
}

/** Render the topics surface: civic topic tree above the reused B card+drawer
 *  timeline. `treeOverride` lets the default view show the REAL tree above a
 *  live/fixture timeline that itself carries no tree. */
function renderTopicsSurface(
  mount: HTMLElement,
  state: AsyncState<ReadApiResponse>,
  notice: string | undefined,
  focusTopicId: string,
  move: MoveRequest | undefined,
  treeOverride?: ReadApiResponse['topic_tree'],
): void {
  mount.replaceChildren();

  const treeBox = el('div', { class: 'tt-wrap', 'data-test': 'topics-page' });
  mount.append(treeBox);
  const topicTree = treeOverride ?? (state.status === 'ready' ? state.data?.topic_tree : null);
  if (topicTree) {
    renderTopicTreeView(treeBox, topicTree, { focusTopicId, move });
  } else {
    treeBox.append(el('p', { class: 'gw-muted' }, 'No topic tree in this view.'));
  }

  // Reuse the B card+drawer timeline below the tree.
  const timelineBox = el('div', { 'data-test': 'topics-timeline' });
  mount.append(timelineBox);
  render(timelineBox, state, notice);
}

/** Topic page: civic topic tree above the reused B card+drawer timeline.
 *  - Default `/topics`: REAL reviewed timeline (loadReadModel) with the REAL
 *    GOV-149 topic tree above it — the real concept graph now exists (GOV-150).
 *  - `?demo=graph`: the REAL concept-graph capture (tree + its 6 real records).
 *  - `?demo=graph-synthetic`: the clearly-labeled SYNTHETIC sample so the
 *    deep-nesting + audited-move surfaces the flat real tree cannot exercise
 *    can still be reviewed/screenshotted. (Agenda-thread completeness uses the
 *    same synthetic data via the timeline's `?demo=complete`.) */
async function renderTopics(mount: HTMLElement, query: URLSearchParams): Promise<void> {
  render(mount, idle<ReadApiResponse>());
  const demo = query.get('demo');

  if (demo === 'graph-synthetic') {
    renderTopicsSurface(
      mount,
      resolved(GRAPH_DEMO, 'fixture', isEmptyResponse),
      GRAPH_DEMO_NOTICE,
      query.get('topic') ?? DEFAULT_FOCUS,
      parseMove(query),
    );
    return;
  }

  // Default + ?demo=graph: REAL GOV-149 concept-graph capture.
  const { state, notice } =
    demo === 'graph'
      ? { state: resolved(GRAPH_REAL, 'fixture', isEmptyResponse), notice: GRAPH_REAL_NOTICE }
      : await loadReadModel();
  renderTopicsSurface(
    mount,
    state,
    notice,
    query.get('topic') ?? REAL_DEFAULT_FOCUS,
    parseOptionalMove(query),
    // Default timeline carries no tree → show the REAL tree above it.
    GRAPH_REAL.topic_tree,
  );
}

/** Body / meeting page: the same B card+drawer list under a context heading. */
async function renderContextPage(mount: HTMLElement, kind: 'body' | 'meeting', query: URLSearchParams): Promise<void> {
  const forced = forcedState(query.get('state'));
  render(mount, idle<ReadApiResponse>());
  const { state, notice } = forced ? { state: forced, notice: undefined } : await loadReadModel();
  mount.replaceChildren();
  const heading = kind === 'body'
    ? 'Government body — Alpine Town Council (reviewer-internal)'
    : 'Meeting record (reviewer-internal)';
  mount.append(el('section', { class: 'gw-page-context', 'data-test': `${kind}-page` }, heading));
  const timelineBox = el('div', { 'data-test': `${kind}-timeline` });
  mount.append(timelineBox);
  render(timelineBox, state, notice);
}

/**
 * GOV-354 card-feed route: render the GOV-347 envelope on the reviewer-internal
 * Alpine timeline. `?state=` forces loading/empty/error for screenshots;
 * `?access=public` forces the public lane (0 cards) so the no-public-leak
 * invariant (§5) can be captured/verified.
 */
function renderCardFeedRoute(mount: HTMLElement, query: URLSearchParams): void {
  const forced = forcedState(query.get('state'));
  if (forced) {
    render(mount, forced);
    return;
  }
  const access = query.get('access');
  const feed = access ? { ...CARD_FEED, access } : CARD_FEED;
  renderCardFeed(mount, feed, CARD_FEED_NOTICE);
}

/**
 * GOV-606 (GOV-599 real-data) — the agenda Kanban surface, the primary app view
 * (`#/app`), now wired to the REAL reviewed-Alpine board projection (GOV-605)
 * instead of fixtures. Owner-confirmed DEFAULT view is "Agendas by meeting"; the
 * top toggle switches to "Agenda tracking". Both boards render the SAME projection
 * (Board A groups its cards by meeting; Board B lays them across the six lifecycle
 * lanes). `?demo=sample` swaps in the clearly-labelled DEV sample projection
 * (populated cards, not real Alpine data); `?access=public` forces the public lane
 * (0 board content) so the no-public-leak invariant (§5) stays capturable;
 * `?state=` forces async states for screenshots.
 */
function renderBoardsRoute(mount: HTMLElement, query: URLSearchParams): void {
  const forced = forcedState(query.get('state'));
  if (forced) {
    render(mount, forced);
    return;
  }
  const access = query.get('access') ?? undefined;
  const sample = query.get('demo') === 'sample';
  const board = sample ? BOARD_SAMPLE : BOARD_PROJECTION;
  renderBoards(mount, {
    board,
    ...(access ? { access } : {}),
    notice: sample ? BOARD_SAMPLE_NOTICE : BOARD_NOTICE,
    devSample: sample,
  });
}

/** GOV-665 Fast Agenda page: quick agenda-first read over the same GOV-605
 * projection used by the agenda Kanban. `?demo=sample` is the only populated
 * sample path and stays visibly labeled by the notice. */
function renderFastAgendaRoute(mount: HTMLElement, query: URLSearchParams): void {
  const access = query.get('access') ?? undefined;
  const sample = query.get('demo') === 'sample';
  const board = sample ? BOARD_SAMPLE : BOARD_PROJECTION;
  if (designPreviewActive(query)) {
    renderFastAgendaDesign(mount, {
      access: access ?? board.access,
      fixture: true,
      notice: 'Owner-approved MOTY visual handoff preview. July 21 meeting content is synthetic until a reviewed backend projection exists.',
    });
    return;
  }
  renderFastAgenda(mount, access ? { ...board, access } : board, sample ? BOARD_SAMPLE_NOTICE : BOARD_NOTICE, sample);
}

/** GOV-665 Timeline page: level toggles + event-type filters + simple/advanced
 * (`gw_home_mode`) presentation over the existing reviewed read-model data. */
async function renderTimelineLevelsRoute(mount: HTMLElement, query: URLSearchParams): Promise<void> {
  const demo = query.get('demo');
  const access = query.get('access');
  const { state, notice } =
    demo === 'graph'
      ? { state: resolved(GRAPH_REAL, 'fixture', isEmptyResponse), notice: GRAPH_REAL_NOTICE }
      : await loadReadModel();
  const data: ReadApiResponse = state.status === 'ready' && state.data ? state.data : GRAPH_REAL;
  renderTimelineLevels(mount, access ? { ...data, access } : data, query, notice);
}

/** GOV-665 Boards directory + detail: consumes the REAL GOV-149 concept-graph
 * body/topic nodes; no score/verdict/ranking surface is rendered. */
function renderBoardsDirectoryRoute(mount: HTMLElement, query: URLSearchParams): void {
  const access = query.get('access');
  const data = access ? { ...GRAPH_REAL, access } : GRAPH_REAL;
  renderBoardsDirectory(mount, data, query, GRAPH_REAL_NOTICE);
}

/** GOV-668 Issue Detail route: one reviewed statement per `#/issue?id=` URL,
 * with Simple dossier and Advanced proof rail over the real GOV-149 capture. */
function renderIssueDetailRoute(mount: HTMLElement, query: URLSearchParams): void {
  const access = query.get('access');
  const data = access ? { ...GRAPH_REAL, access } : GRAPH_REAL;
  renderIssueDetail(mount, data, query, GRAPH_REAL_NOTICE);
}

/** GOV-668 Source Vault: real per-record source metadata plus honest-empty
 * ledger/alert rows; packet diff is demo/sample-only. */
function renderSourceVaultRoute(mount: HTMLElement, query: URLSearchParams): void {
  const access = query.get('access');
  const data = access ? { ...GRAPH_REAL, access } : GRAPH_REAL;
  renderSourceVault(mount, data, query, GRAPH_REAL_NOTICE);
}

/**
 * GOV-462 newsletter route (gated): `#/newsletter` archive list, `#/newsletter?id=`
 * digest detail. `?state=loading|empty|error` forces the async states for
 * screenshots. Both surfaces are full-app civic surfaces → gated identically to
 * `#/app` via the shared `gated()` wrapper (§5); this handler only runs once an
 * approved request has been admitted.
 */
function renderNewsletterRoute(mount: HTMLElement, query: URLSearchParams): void {
  const forced = query.get('state');
  if (forced === 'loading' || forced === 'empty' || forced === 'error') {
    renderNewsletterState(mount, forced as NewsletterStateKind);
    return;
  }
  const id = query.get('id');
  if (id) {
    renderNewsletterDetail(mount, NEWSLETTER_DIGEST, id, NEWSLETTER_NOTICE);
    return;
  }
  renderNewsletterArchive(mount, NEWSLETTER_DIGEST, NEWSLETTER_NOTICE);
}

/**
 * GOV-658 §6 — reviewer-internal Home dashboard. Real widgets consume existing
 * reviewed Alpine projections (card feed / digest / board); unavailable widgets
 * render honest-empty states or DEV samples only behind `?demo=sample`.
 */
function renderHomeRoute(mount: HTMLElement, query: URLSearchParams): void {
  renderHome(mount, {
    cardFeed: CARD_FEED,
    board: BOARD_PROJECTION,
    newsletter: NEWSLETTER_DIGEST,
    // `demo=design` enters the shared handoff-preview session. Home reuses its
    // existing visibly labelled sample widgets while the dedicated handoff
    // routes render their richer synthetic design fixtures.
    demo: query.get('demo') === 'sample' || designPreviewActive(query),
    sampleBoard: BOARD_SAMPLE,
  });
}

/** Options shared by design-handoff-only routes. The outer `gated()` wrapper is
 * still the access authority; the explicit public-lane query remains a
 * fail-closed verification hook for tests/review. */
function designPageOptions(query: URLSearchParams): DesignPageOptions {
  return {
    access: query.get('access') === 'public' ? 'public' : 'reviewer_internal',
    fixture: designPreviewActive(query),
  };
}

function renderPowerRoute(mount: HTMLElement, query: URLSearchParams): void {
  const options = designPageOptions(query);
  if (options.fixture) {
    renderDesignPowerTracker(mount, options);
    return;
  }
  const access = query.get('access');
  const data = access ? { ...GRAPH_REAL, access } : GRAPH_REAL;
  renderReviewedPowerTracker(mount, data, query, GRAPH_REAL_NOTICE);
}

function renderWatchlistRoute(mount: HTMLElement, query: URLSearchParams): void {
  const options = designPageOptions(query);
  if (options.fixture) {
    renderDesignWatchlist(mount, options);
    return;
  }
  const access = query.get('access');
  const data = access ? { ...GRAPH_REAL, access } : GRAPH_REAL;
  renderReviewedWatchlist(mount, data, query, GRAPH_REAL_NOTICE);
}

function renderLocationRoute(mount: HTMLElement, query: URLSearchParams): void {
  const options = designPageOptions(query);
  if (options.fixture) {
    renderDesignLocation(mount, options);
    return;
  }
  const access = query.get('access');
  const data = access ? { ...GRAPH_REAL, access } : GRAPH_REAL;
  renderReviewedLocation(mount, data, query, GRAPH_REAL_NOTICE);
}

function renderAlertsRoute(mount: HTMLElement, query: URLSearchParams): void {
  renderDesignAlerts(mount, designPageOptions(query));
}

/**
 * Reviewer / local bypass (GOV-419 acceptance #3) — lets Isaac SEE the full app
 * behind the gate for a local walkthrough WITHOUT shipping public access. Three
 * impure sources, all LOCAL-only (this build is reviewer-internal + noindex):
 *   - `VITE_REVIEWER_BYPASS=true` in `.env` — the persistent local-walkthrough
 *     switch (set once, every full-app route opens). Primary path for Isaac.
 *   - `?reviewer=1` on any route — a per-URL bypass; sticky for the session so
 *     in-app links (`#/cards`, `#/topics`, …) keep working after entry.
 *   - the sticky session flag set by a prior `?reviewer=1`.
 * The pure {@link resolveAccess} stays env/storage-free; this is the only glue
 * that touches the environment. An explicit `?gate=` override still wins, so any
 * gate state can be screenshotted even with the bypass on.
 */
const BYPASS_KEY = 'gw-reviewer-bypass';
const DESIGN_PREVIEW_KEY = 'gw-design-preview';
const ENV_BYPASS = (() => {
  try {
    return import.meta.env?.VITE_REVIEWER_BYPASS === 'true';
  } catch {
    return false;
  }
})();
function sessionBypass(): boolean {
  try {
    return globalThis.sessionStorage?.getItem(BYPASS_KEY) === '1';
  } catch {
    return false;
  }
}
function persistBypass(): void {
  try {
    globalThis.sessionStorage?.setItem(BYPASS_KEY, '1');
  } catch {
    /* storage unavailable (private mode / non-browser) — per-URL bypass still works */
  }
}
function reviewerBypassActive(query: URLSearchParams): boolean {
  const urlBypass = query.get('reviewer') === '1';
  if (urlBypass) persistBypass();
  return ENV_BYPASS || urlBypass || sessionBypass();
}

/**
 * A tab-scoped switch for the owner-approved MOTY handoff preview. Entering a
 * single route with `?demo=design` keeps the synthetic design fixture active as
 * the reviewer moves through normal shell links. `?demo=live` explicitly exits
 * it. This is presentation state only: it never grants access and is consulted
 * only after the existing reviewer gate has admitted the route.
 */
function designPreviewActive(query: URLSearchParams): boolean {
  try {
    if (query.get('demo') === 'live') sessionStorage.removeItem(DESIGN_PREVIEW_KEY);
    if (query.get('demo') === 'design') sessionStorage.setItem(DESIGN_PREVIEW_KEY, '1');
    return sessionStorage.getItem(DESIGN_PREVIEW_KEY) === '1';
  } catch {
    return query.get('demo') === 'design';
  }
}

/**
 * Shell-wide provenance follows the explicit demo contract. The design preview
 * is tab-sticky; all other synthetic modes are URL-local. Real captures and the
 * live/default route remain reviewed snapshots rather than being called live.
 */
const SHELL_SAMPLE_FIXTURE_ROUTES: ReadonlySet<string> = new Set([
  '/home',
  '/app',
  '/agenda-boards',
  '/agenda',
  '/timeline',
  '/boards',
  '/power',
  '/watchlist',
  '/location',
  '/issue',
  '/vault',
  '/sources',
]);
const SHELL_DESIGN_FIXTURE_ROUTES: ReadonlySet<string> = new Set([
  '/home',
  '/agenda',
  '/power',
  '/watchlist',
  '/location',
  '/alerts',
]);
function shellOriginFor(path: string, query: URLSearchParams): ShellOrigin {
  const designFixture = designPreviewActive(query);
  const demo = query.get('demo');
  const explicitFixture =
    (demo === 'sample' && SHELL_SAMPLE_FIXTURE_ROUTES.has(path))
    || (path === '/timeline-legacy' && ['complete', 'matrix', 'provenance'].includes(demo ?? ''))
    || (path === '/topics' && demo === 'graph-synthetic');
  if ((designFixture && SHELL_DESIGN_FIXTURE_ROUTES.has(path)) || explicitFixture) return 'fixture';
  return 'reviewed_snapshot';
}

/** Resolve the access state for a request from its query + the live bypass. */
function accessFor(query: URLSearchParams) {
  return resolveAccess(query.get('gate'), reviewerBypassActive(query));
}

/** A gated surface handler: renders civic content into the shell's content slot. */
type ShellHandler = (ctx: { mount: HTMLElement; path: string; query: URLSearchParams }) => void;

/**
 * Wrap a full-app route so it renders ONLY when approved; otherwise the gate
 * panel shows and zero civic data reaches the DOM (acceptance #2).
 *
 * GOV-658 §5 — on approval, draw the persistent app shell (header/tabs/footer)
 * into `root` and hand the surface its inner content slot. The shell renders
 * ONLY here (inside the gate); the `#/` landing keeps its own standalone layout
 * and never shows app nav (§5.2, fail-closed §3.4).
 */
function gated(handler: ShellHandler): RouteHandler {
  return ({ path, query }) =>
    renderGatedApp(root!, accessFor(query), () => {
      const mount = renderShell(root!, { active: path, origin: shellOriginFor(path, query) });
      handler({ mount, path, query });
    });
}

// Preview-launch landing is the DEFAULT entry (and the fallback). The full
// reviewer-internal app lives at `/app` (+ the other surfaces), each gated.
const router = createRouter(({ query }) => renderLanding(root!, accessFor(query)));
router.register('/', ({ query }) => renderLanding(root!, accessFor(query)));
// GOV-600 — `#/app` is now the agenda Kanban surface (default: Agendas by
// meeting), the owner-confirmed primary UX that replaces the long card list. The
// prior chronological long-list timeline stays reachable at `#/timeline` (and the
// GOV-354 single-list card feed at `#/cards`) for continuity + regression.
router.register('/home', gated(({ mount, query }) => renderHomeRoute(mount, query)));
router.register('/app', gated(({ mount, query }) => renderBoardsRoute(mount, query)));
router.register('/agenda', gated(({ mount, query }) => renderFastAgendaRoute(mount, query)));
router.register('/boards', gated(({ mount, query }) => renderBoardsDirectoryRoute(mount, query)));
router.register('/issue', gated(({ mount, query }) => renderIssueDetailRoute(mount, query)));
router.register('/vault', gated(({ mount, query }) => renderSourceVaultRoute(mount, query)));
router.register('/sources', gated(({ mount, query }) => renderSourceVaultRoute(mount, query)));
router.register('/agenda-boards', gated(({ mount, query }) => renderBoardsRoute(mount, query)));
router.register('/timeline', gated(({ mount, query }) => void renderTimelineLevelsRoute(mount, query)));
router.register('/timeline-legacy', gated(({ mount, query }) => void renderTimeline(mount, query)));
router.register('/cards', gated(({ mount, query }) => renderCardFeedRoute(mount, query)));
router.register('/newsletter', gated(({ mount, query }) => renderNewsletterRoute(mount, query)));
router.register('/power', gated(({ mount, query }) => renderPowerRoute(mount, query)));
router.register('/watchlist', gated(({ mount, query }) => renderWatchlistRoute(mount, query)));
router.register('/location', gated(({ mount, query }) => renderLocationRoute(mount, query)));
router.register('/alerts', gated(({ mount, query }) => renderAlertsRoute(mount, query)));
router.register('/topics', gated(({ mount, query }) => void renderTopics(mount, query)));
router.register('/body', gated(({ mount, query }) => void renderContextPage(mount, 'body', query)));
router.register('/meeting', gated(({ mount, query }) => void renderContextPage(mount, 'meeting', query)));

// GOV-440 — apply the stored theme preference and mount the dark/light toggle on
// <body> (outside #app, so it survives route re-renders). GOV-665 page-mode
// defaults may then apply Advanced/dark when the stored pref is still `system`;
// explicit dark/light toggle choices continue to win.
mountThemeToggle();
router.start();
