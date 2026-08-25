/**
 * App boot.
 *
 * GOV-419 — the DEFAULT entry is the preview-launch LANDING; the full
 * reviewer-internal app is revealed only past the gated-beta entry:
 *  - `/`         preview-launch landing (gate-aware; no civic data pre-gate).
 *  - `/home`     live reviewer dashboard over one same-origin authorized model.
 *  - `/app`      agenda-board contract surface; an honest gap is shown until
 *                the backend supplies the required projection.
 *  - `/topics`   civic topic tree (GOV-102): rollup filter, derived breadcrumb,
 *                human-label-first nodes + inspectable gov alias, audited move,
 *                cycle-safe degrade — ABOVE the reused B card+drawer timeline.
 *  - `/body`,
 *    `/meeting`  explicit relationship-contract gaps plus direct authorized
 *                records that remain visibly unassigned to that context.
 *
 * A `?state=` query override forces loading / empty / error for screenshots on
 * explicitly supported legacy/demo routes.
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
import { hostedReviewerAccessActive } from './gate/hosted-access';
import { isEmptyResponse } from './data/client';
import { assertWebSafe } from './data/web-safe';
import { ensureStyle as ensureRecordStyle, recordCard, render } from './ui/render';
import { renderBoards } from './ui/board';
import { renderHome, renderHomeReadModel } from './ui/home';
import {
  renderBoardsDirectory,
  renderFastAgenda,
  renderIssueDetail,
  renderSourceVault,
  renderTimelineLevels,
} from './ui/pages-program';
import { renderFastAgendaDesign } from './ui/fast-agenda-design';
import {
  renderAlerts as renderDesignAlerts,
  renderBoardsDesign,
  renderLocation as renderDesignLocation,
  renderPowerTracker as renderDesignPowerTracker,
  renderWatchlist as renderDesignWatchlist,
  type DesignPageOptions,
} from './ui/design-pages';
import { renderTopicTreeView } from './ui/topic-tree-view';
import {
  renderGatedUpload,
  createHttpIntakeTransport,
  DEFAULT_INTAKE_CONSTRAINTS,
  type UploadPhase,
} from './ui/gated-upload';
import type { UploadReviewState } from './types/upload-intake';
import { mountThemeToggle } from './ui/theme-toggle';
import { renderExplainer } from './ui/explainer';
import { renderTimelineDesign } from './ui/timeline-design';
import { renderShell, type ShellOrigin } from './ui/shell';
import {
  loadDigestResponse,
  renderNewsletterArchive,
  renderNewsletterDetail,
  renderNewsletterState,
  type NewsletterStateKind,
} from './ui/newsletter';
import type { CardFeed } from './ui/card-feed';
import { loading, failed, resolved } from './state/async-state';
import type { AsyncState } from './state/async-state';
import { ReviewerContextStore } from './state/reviewer-context';
import {
  renderProjectionGap,
  renderReviewerContextState,
  type ProjectionGapDefinition,
} from './ui/reviewer-context-state';
import {
  renderPrivateInfoNote,
  type PrivateInfoNoteId,
} from './ui/private-info-note';
import type { ReadApiResponse, SuppliedFilesProjection, SupersedeProjection } from './types/read-api';
import type { MoveRequest } from './ui/topic-tree';
import stateMatrixData from './fixtures/state-matrix.json';
import conceptGraphDemoData from './fixtures/concept-graph-demo.json';
import conceptGraphRealData from './fixtures/concept-graph-real.json';
import cardFeedData from './fixtures/alpine-card-feed.json';
import newsletterDigestData from './fixtures/alpine-newsletter-digest.json';
import agendaBoardData from './fixtures/agenda-board-projection.json';
import agendaBoardSampleData from './fixtures/agenda-board-projection.sample.dev.json';
import suppliedFilesData from './fixtures/alpine-supplied-files.json';
import supersedeData from './fixtures/alpine-supersede-events.json';
import uploadIntakeContract from './fixtures/alpine-upload-intake.json';
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
 * GOV-1566 F2 — reviewed supplied-file source drawer, consuming the B6 web-safe
 * projection contract. This is a CONTRACT fixture (Backend B6 is not built yet):
 * it exercises the fail-closed renderer against the exact shape B6 will emit —
 * only `web_safe` files, no raw `review_state` key, a bare `pending_review_count`
 * for the content-free placeholder. Swept for raw paths on load exactly like the
 * other fixtures; when B6 lands this constant is swapped for the live read.
 */
const SUPPLIED_FILES: SuppliedFilesProjection = assertWebSafe(suppliedFilesData as SuppliedFilesProjection);

/**
 * GOV-1566 F3 — before/after supersede view, consuming the same B6 web-safe
 * projection contract (built from a B5 supersede mark). CONTRACT fixture (B5/B6
 * not built yet): it exercises the fail-closed renderer against the exact shape
 * B6 will emit — before/after are both `web_safe` file refs, the coarse
 * `reprocessing_status` lane is NOT the raw `review_state`, and an in-re-review
 * event carries `after: null` so its unreviewed content is never shown. Swept
 * for raw paths on load like every other fixture; swapped for the live read when
 * B5 (GOV-1578) + B6 (GOV-1579) land.
 */
const SUPERSEDE_EVENTS: SupersedeProjection = assertWebSafe(supersedeData as SupersedeProjection);

/**
 * GOV-1566 F1 — the gated upload surface's B3 intake CONTRACT fixture (Backend
 * B3 GOV-1576 is not built yet). It carries the mime+size constraints the form
 * mirrors and the three coarse web-safe receipt buckets — NO raw path and NO
 * internal `review_state` key, so it passes the same load-time raw-path sweep as
 * every other fixture. The form runs against the fail-closed SCAFFOLD transport
 * until B3 lands (one-line live swap in the route below).
 */
assertWebSafe(uploadIntakeContract);

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

/**
 * One server-authoritative reviewer context for the lifetime of this app boot.
 *
 * Every live route reads this same memoized promise/result. Browser routing,
 * Simple/Advanced mode, and device-local location/watch preferences may only
 * change presentation or narrow what is shown; none can create a second data
 * source or widen the server response.
 */
const reviewerContext = new ReviewerContextStore();
const LIVE_CONTEXT_NOTICE =
  'Live same-origin reviewer context. Allowed record fields, trust labels, and source receipts are rendered exactly from the authorized server response.';

/** `?access=public` is a deliberate fail-closed QA hook; every other value is ignored. */
function narrowToRequestedAccess(data: ReadApiResponse, query: URLSearchParams): ReadApiResponse {
  if (query.get('access') !== 'public') return data;
  return {
    scope: data.scope,
    access: 'public',
    records: [],
  };
}

/**
 * Draw a shared context state, then invoke a route only for the exact ready
 * model. Detached mounts are ignored so a slow response cannot repaint a route
 * after navigation.
 */
async function withReviewerContext(
  mount: HTMLElement,
  query: URLSearchParams,
  ready: (data: ReadApiResponse) => void,
): Promise<void> {
  const initial = reviewerContext.state;
  if (initial.status !== 'ready') renderReviewerContextState(mount, initial.status);
  const state = await reviewerContext.load();
  if (!mount.isConnected || state !== reviewerContext.state) return;
  if (state.status !== 'ready') {
    renderReviewerContextState(mount, state.status);
    return;
  }
  ready(narrowToRequestedAccess(state.data, query));
}

function projectionGapPage(
  mount: HTMLElement,
  definition: ProjectionGapDefinition,
): void {
  mount.className = 'gw-projection-gap-page';
  mount.replaceChildren(renderProjectionGap(definition, { headingLevel: 1 }));
}

function el(tag: string, attrs: Record<string, string> = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text) node.textContent = text;
  return node;
}

function contextualRouteHeading(
  heading: string,
  noteId: PrivateInfoNoteId,
  testId: string,
): HTMLElement {
  const wrapper = el('div', {
    class: 'gw-context-heading',
    'data-test': `${testId}-context-heading`,
  });
  wrapper.append(
    el('h1', { class: 'gw-h1', 'data-test': `${testId}-page-title` }, heading),
    renderPrivateInfoNote(noteId),
  );
  return wrapper;
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
function renderTimeline(
  mount: HTMLElement,
  query: URLSearchParams,
  data?: ReadApiResponse,
): void {
  const forced = forcedState(query.get('state'));
  if (forced) {
    return render(mount, forced, undefined, {
      infoNoteId: 'legacy-timeline-overview',
      access: forced.status === 'empty' ? 'reviewer_internal' : undefined,
    });
  }
  if (query.get('demo') === 'matrix') {
    const matrix = narrowToRequestedAccess(STATE_MATRIX, query);
    render(
      mount,
      resolved(matrix, 'fixture', isEmptyResponse),
      'State-matrix sample — one card per trust state, not real data.',
      {
        infoNoteId: 'legacy-timeline-overview',
        access: matrix.access,
      },
    );
    return;
  }
  if (query.get('demo') === 'complete') {
    const complete = narrowToRequestedAccess(completeDemoBody(), query);
    render(
      mount,
      resolved(complete, 'fixture', isEmptyResponse),
      'Showing a labeled sample — not real data.',
      {
        infoNoteId: 'legacy-timeline-overview',
        access: complete.access,
      },
    );
    return;
  }
  if (query.get('demo') === 'provenance') {
    const provenance = narrowToRequestedAccess(provenanceDemoBody(), query);
    render(
      mount,
      resolved(provenance, 'fixture', isEmptyResponse),
      PROVENANCE_DEMO_NOTICE,
      {
        infoNoteId: 'legacy-timeline-overview',
        access: provenance.access,
      },
    );
    return;
  }
  if (!data) {
    renderReviewerContextState(mount, 'unavailable');
    return;
  }
  render(mount, resolved(data, 'live', isEmptyResponse), LIVE_CONTEXT_NOTICE, {
    infoNoteId: 'legacy-timeline-overview',
    access: data.access,
  });
}

/** Render the topics surface: an optional civic topic tree above the reused
 *  record timeline. When the live response carries no tree, the tree slot
 *  explains the missing backend projection instead of grafting a capture. */
function renderTopicsSurface(
  mount: HTMLElement,
  state: AsyncState<ReadApiResponse>,
  access: ReadApiResponse['access'],
  notice: string | undefined,
  focusTopicId: string,
  move: MoveRequest | undefined,
  treeOverride?: ReadApiResponse['topic_tree'],
): void {
  if (access !== 'reviewer_internal') {
    renderReviewerContextState(mount, 'denied');
    return;
  }
  mount.replaceChildren();

  mount.append(contextualRouteHeading('Topics', 'topics-overview', 'topics'));

  const treeBox = el('div', { class: 'tt-wrap', 'data-test': 'topics-page' });
  mount.append(treeBox);
  const topicTree = treeOverride ?? (state.status === 'ready' ? state.data?.topic_tree : null);
  if (topicTree) {
    renderTopicTreeView(treeBox, topicTree, { focusTopicId, move });
  } else {
    treeBox.append(renderProjectionGap({
      id: 'topic-tree',
      kicker: 'TOPICS · LIVE CONTRACT GAP',
      title: 'Connected topic tree not available yet',
      whatItDoes: 'The topic tree will organize the same reviewed records under plain-language civic subjects without relabelling or inventing relationships.',
      requiredProjection: 'A server-reviewed topic tree with stable topic ids, source-grounded labels, aliases, and explicit record-to-topic relationships.',
      howItWorks: 'The backend will supply the graph beside this authorized record set; the browser will only navigate and filter those reviewed links.',
      expectedResult: 'A browsable issue map where each branch leads back to the exact statements and source receipts that support it.',
      filedUnder: 'Research graph · Topics · Alpine',
    }));
  }

  // Reuse the B card+drawer timeline below the tree.
  const timelineBox = el('div', { 'data-test': 'topics-timeline' });
  mount.append(timelineBox);
  render(timelineBox, state, notice, {
    access,
    headingLevel: 'h2',
  });
}

/** Topic page: civic topic tree above the reused B card+drawer timeline.
 *  - Default `/topics`: shared live reviewer-context records with an honest
 *    topic-tree gap when that projection is absent.
 *  - `?demo=graph`: the REAL concept-graph capture (tree + its 6 real records).
 *  - `?demo=graph-synthetic`: the clearly-labeled SYNTHETIC sample so the
 *    deep-nesting + audited-move surfaces the flat real tree cannot exercise
 *    can still be reviewed/screenshotted. (Agenda-thread completeness uses the
 *    same synthetic data via the timeline's `?demo=complete`.) */
function renderTopics(
  mount: HTMLElement,
  query: URLSearchParams,
  data?: ReadApiResponse,
): void {
  const demo = query.get('demo');

  if (demo === 'graph-synthetic') {
    const synthetic = narrowToRequestedAccess(GRAPH_DEMO, query);
    renderTopicsSurface(
      mount,
      resolved(synthetic, 'fixture', isEmptyResponse),
      synthetic.access,
      GRAPH_DEMO_NOTICE,
      query.get('topic') ?? DEFAULT_FOCUS,
      parseMove(query),
    );
    return;
  }

  // `?demo=graph` is the explicit archived concept-graph capture. The default
  // route uses only the shared live model and never grafts the captured tree
  // onto a server response.
  const selected = demo === 'graph' ? narrowToRequestedAccess(GRAPH_REAL, query) : data;
  if (!selected) {
    renderReviewerContextState(mount, 'unavailable');
    return;
  }
  const state = resolved(selected, demo === 'graph' ? 'fixture' : 'live', isEmptyResponse);
  const notice = demo === 'graph' ? GRAPH_REAL_NOTICE : LIVE_CONTEXT_NOTICE;
  renderTopicsSurface(
    mount,
    state,
    selected.access,
    notice,
    query.get('topic') ?? (demo === 'graph' ? REAL_DEFAULT_FOCUS : ''),
    parseOptionalMove(query),
  );
}

const CONTEXT_RELATIONSHIP_GAPS: Record<'body' | 'meeting', ProjectionGapDefinition> = {
  body: {
    id: 'government-body-relationship',
    kicker: 'GOVERNMENT BODY · LIVE CONTRACT GAP',
    title: 'Government-body record assignment not available yet',
    whatItDoes: 'This page will gather the officials, meetings, decisions, responsibilities, source records, and reviewed changes that belong to one identified government body.',
    requiredProjection: 'A server-authorized government-body response with a stable body id, official name, jurisdiction and level, membership, meeting ids, and explicit statement-to-body relationships.',
    howItWorks: 'The backend will resolve and authorize the requested body, then return only records connected by reviewed ids. The browser will not infer a body from speaker text, publisher labels, URL parameters, or the Alpine endpoint scope.',
    expectedResult: 'A sourced body profile whose Simple view answers who and what quickly, while Advanced preserves the same ids, receipts, relationship evidence, and trust states.',
    filedUnder: 'Civic records · Government bodies · Relationship awaiting backend projection',
  },
  meeting: {
    id: 'meeting-relationship',
    kicker: 'MEETING RECORD · LIVE CONTRACT GAP',
    title: 'Meeting-to-record assignment not available yet',
    whatItDoes: 'This page will assemble one official meeting with its notice, agenda, packet, minutes or transcript, public-comment windows, votes, decisions, and reviewed follow-up.',
    requiredProjection: 'A server-authorized meeting response with a stable meeting id, body id, official dates, document receipts, agenda-item ids, and explicit statement-to-meeting relationships.',
    howItWorks: 'The backend will join reviewed records through stable meeting and agenda ids and disclose missing documents. The browser will not assign every Alpine-context row to a requested meeting.',
    expectedResult: 'One traceable meeting file with fast Simple answers and an Advanced evidence trail over the exact same authorized records.',
    filedUnder: 'Civic records · Meetings · Relationship awaiting backend projection',
  },
};

/**
 * Body / meeting page: disclose the missing relationship, then show the shared
 * direct records only in an explicitly unassigned area.
 */
function renderContextPage(
  mount: HTMLElement,
  kind: 'body' | 'meeting',
  query: URLSearchParams,
  data?: ReadApiResponse,
): void {
  const forced = forcedState(query.get('state'));
  if (forced) {
    render(mount, forced, undefined, {
      infoNoteId: kind === 'body' ? 'body-overview' : 'meeting-overview',
      access: forced.status === 'empty' ? 'reviewer_internal' : undefined,
    });
    return;
  }
  if (!data) {
    renderReviewerContextState(mount, 'unavailable');
    return;
  }
  if (data.access !== 'reviewer_internal') {
    renderReviewerContextState(mount, 'denied');
    return;
  }

  ensureRecordStyle();
  mount.className = 'gw-context-projection-page';
  mount.replaceChildren();
  mount.append(contextualRouteHeading(
    kind === 'body' ? 'Government body' : 'Meeting record',
    kind === 'body' ? 'body-overview' : 'meeting-overview',
    kind,
  ));
  mount.append(renderProjectionGap(CONTEXT_RELATIONSHIP_GAPS[kind]));

  const directRecords = el('section', {
    class: 'gw-page-context gw-context-unscoped-records',
    'data-test': `${kind}-unscoped-records`,
    'data-relationship': 'unscoped',
  });
  directRecords.append(
    el('p', { class: 'gw-projection-gap-kicker' }, 'AUTHORIZED DIRECT RECORDS'),
    el(
      'h2',
      {},
      kind === 'body'
        ? 'Alpine endpoint records — not assigned to this government body'
        : 'Alpine endpoint records — not assigned to this meeting',
    ),
    el(
      'p',
      { class: 'gw-muted' },
      `${LIVE_CONTEXT_NOTICE} No body or meeting relationship is inferred from these ${data.records?.length ?? 0} direct record${data.records?.length === 1 ? '' : 's'}.`,
    ),
  );
  const recordList = el('div', { class: 'gw-timeline', 'data-test': `${kind}-direct-record-list` });
  for (const record of data.records ?? []) {
    recordList.append(recordCard(record, undefined, undefined, { reviewerInternal: true }));
  }
  if ((data.records?.length ?? 0) === 0) {
    recordList.append(el('p', { class: 'gw-muted' }, 'No direct authorized records were supplied.'));
  }
  directRecords.append(recordList);
  mount.append(directRecords);
}

/**
 * GOV-354 card-feed route: render the GOV-347 envelope on the reviewer-internal
 * Alpine timeline. `?state=` forces loading/empty/error for screenshots;
 * `?access=public` forces the public lane (0 cards) so the no-public-leak
 * invariant (§5) can be captured/verified.
 */
function renderCardFeedRoute(
  mount: HTMLElement,
  query: URLSearchParams,
  data?: ReadApiResponse,
): void {
  const forced = forcedState(query.get('state'));
  if (forced) {
    render(mount, forced, undefined, {
      infoNoteId: 'cards-overview',
      access: forced.status === 'empty' ? 'reviewer_internal' : undefined,
    });
    return;
  }
  if (!data) {
    renderReviewerContextState(mount, 'unavailable');
    return;
  }
  render(mount, resolved(data, 'live', isEmptyResponse), LIVE_CONTEXT_NOTICE, {
    infoNoteId: 'cards-overview',
    access: data.access,
  });
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
  const access = query.get('access') === 'public' ? 'public' : undefined;
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
function renderFastAgendaRoute(
  mount: HTMLElement,
  query: URLSearchParams,
  data?: ReadApiResponse,
): void {
  const access = query.get('access') === 'public' ? 'public' : undefined;
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
  const scopedBoard = access ? { ...board, access } : board;
  if (sample) {
    renderFastAgenda(mount, scopedBoard, BOARD_SAMPLE_NOTICE, true);
    return;
  }
  if (data) {
    renderAuthorizedProjectionGap(mount, data, AGENDA_BOARD_GAP);
    return;
  }
  if (!designPreviewActive(query)) {
    renderReviewerContextState(mount, 'unavailable');
    return;
  }
  renderFastAgendaDesign(mount, {
    access: access ?? board.access,
    fixture: false,
    board: scopedBoard,
    notice: BOARD_NOTICE,
  });
}

/** GOV-665 Timeline page: level toggles + event-type filters + simple/advanced
 * (`gw_home_mode`) presentation over the existing reviewed read-model data. */
function renderTimelineLevelsRoute(
  mount: HTMLElement,
  query: URLSearchParams,
  data?: ReadApiResponse,
): void {
  const demo = query.get('demo');
  // The design fixture is a separate renderer so the reviewed lane can never
  // borrow one of its synthetic rows. It sits above the shared reviewer
  // context because the fixture never consumes reviewed data at all.
  if (designPreviewActive(query)) {
    renderTimelineDesign(mount, query, {
      access: query.get('access') ?? 'reviewer_internal',
      fixture: true,
    });
    return;
  }
  const selected = demo === 'graph' ? narrowToRequestedAccess(GRAPH_REAL, query) : data;
  if (!selected) {
    renderReviewerContextState(mount, 'unavailable');
    return;
  }
  renderTimelineLevels(
    mount,
    selected,
    query,
    demo === 'graph' ? GRAPH_REAL_NOTICE : LIVE_CONTEXT_NOTICE,
  );
}

/** GOV-665 Boards directory + detail: consumes the REAL GOV-149 concept-graph
 * body/topic nodes; no score/verdict/ranking surface is rendered. */
function renderBoardsDirectoryRoute(
  mount: HTMLElement,
  query: URLSearchParams,
  data: ReadApiResponse,
): void {
  renderBoardsDirectory(mount, data, query, LIVE_CONTEXT_NOTICE);
}

/** GOV-668 Issue Detail route: one reviewed statement per `#/issue?id=` URL,
 * with Simple dossier and Advanced proof rail over the real GOV-149 capture. */
function renderIssueDetailRoute(
  mount: HTMLElement,
  query: URLSearchParams,
  data: ReadApiResponse,
): void {
  renderIssueDetail(mount, data, query, LIVE_CONTEXT_NOTICE);
}

/** GOV-668 Source Vault: live routes use the server-authorized response and
 * leave B6-only panels honest-empty. The contract fixtures are available only
 * on the visibly labeled `?demo=sample` route. */
function renderSourceVaultRoute(
  mount: HTMLElement,
  query: URLSearchParams,
  data: ReadApiResponse,
): void {
  const fixture = query.get('demo') === 'sample';
  renderSourceVault(
    mount,
    data,
    query,
    fixture ? GRAPH_REAL_NOTICE : LIVE_CONTEXT_NOTICE,
    fixture ? SUPPLIED_FILES : null,
    fixture ? SUPERSEDE_EVENTS : null,
    // GOV-82: the version-compare fixture is gated on the DESIGN flag, not `demo=sample`.
    // They are different lanes: `sample` populates contract fixtures, `design` is the
    // owner's visual-review path. Reviewer admission is enforced inside renderSourceVault,
    // which renders no source rows outside the reviewer-internal lane.
    designPreviewActive(query),
  );
}

/**
 * GOV-1566 F1 gated upload route: the authorized-cohort file-intake surface. The
 * outer `gated()` wrapper is the authority — a non-approved state renders the
 * existing gate panel with ZERO upload affordance (the honest gated-out state),
 * so this handler runs only once approved. `?ustate=` forces a phase for
 * review/screenshots (idle | validating | uploading | received | held | error),
 * and `?rstatus=` picks the projected receipt bucket for the `received` shot.
 * The intake backend (B3 GOV-1576) is `done`, so the real authenticated transport
 * is wired: submitting streams the file to `/api/beta/intake/upload` (fail-closed;
 * an unreachable/flag-off backend yields the honest "not open" error, never a fake
 * receipt). The transport projects B3's raw `review_state` to a coarse bucket.
 */
function renderUploadRoute(mount: HTMLElement, query: URLSearchParams): void {
  const forced = query.get('ustate');
  const forcedPhase: UploadPhase | undefined =
    forced === 'validating' || forced === 'uploading' || forced === 'received' ||
    forced === 'held' || forced === 'error' || forced === 'idle'
      ? forced
      : undefined;
  const rstatus = query.get('rstatus');
  const forcedReceiptStatus: UploadReviewState | undefined =
    rstatus === 'received' || rstatus === 'review_pending' || rstatus === 'held' ? rstatus : undefined;
  renderGatedUpload(mount, {
    transport: createHttpIntakeTransport(),
    constraints: DEFAULT_INTAKE_CONSTRAINTS,
    forcedPhase,
    forcedReceiptStatus,
  });
}

/**
 * GOV-462 newsletter route (gated): `#/newsletter` opens the archive plus the
 * honest-empty current-edition baseline, and `?id=` deep-links a digest. The
 * response has no current/featured marker, so the client never guesses one.
 * `?state=loading|empty|error` forces the async states for
 * screenshots. Both surfaces are full-app civic surfaces → gated identically to
 * `#/app` via the shared `gated()` wrapper (§5); this handler only runs once an
 * approved request has been admitted.
 */
function renderNewsletterRoute(
  mount: HTMLElement,
  query: URLSearchParams,
  data?: ReadApiResponse,
): void {
  // GOV-84: the gated fixture lane. `designPreviewActive` is the same session-sticky
  // reviewer flag the other design routes use; the reviewer half is enforced inside
  // the renderers, which admit only the reviewer lane before rendering anything.
  const designFixture = designPreviewActive(query);
  const requestedPublic = query.get('access') === 'public';
  const newsletter = requestedPublic
    ? { ...NEWSLETTER_DIGEST, access: 'public' }
    : NEWSLETTER_DIGEST;
  const forced = query.get('state');
  if (forced === 'loading' || forced === 'empty' || forced === 'error') {
    renderNewsletterState(mount, forced as NewsletterStateKind, newsletter.access);
    return;
  }
  // The reviewed lane still renders the live contract gap. The gated fixture lane is the
  // one exception: it exists precisely so the owner can see the populated edition, so it
  // takes the archive/detail path instead of the gap page. Reviewer admission is still
  // enforced downstream by `admitReviewerLane`.
  if (query.get('demo') !== 'snapshot' && !designFixture) {
    if (!data) {
      renderReviewerContextState(mount, 'unavailable');
      return;
    }
    if (data.access !== 'reviewer_internal') {
      renderReviewerContextState(mount, 'denied');
      return;
    }
    projectionGapPage(mount, {
      id: 'newsletter-digest',
      kicker: 'NEWSLETTER · LIVE CONTRACT GAP',
      title: 'Newsletter digest not available yet',
      whatItDoes: 'The newsletter will turn reviewed Alpine activity into a plain-language edition with direct source receipts and correction status.',
      requiredProjection: 'A server-reviewed newsletter digest containing stable edition ids, coverage dates, ordered items, source trails, and publication state.',
      howItWorks: 'The backend will assemble an edition from the same authorized records, preserve every trust label, and return the finished projection through this same-origin session.',
      expectedResult: 'A browsable archive and edition detail page where every summary opens the exact supporting public record.',
      filedUnder: 'Civic briefings · Newsletter digest · Alpine',
    });
    return;
  }
  const id = query.get('id');
  if (id) {
    renderNewsletterDetail(mount, newsletter, id, NEWSLETTER_NOTICE, designFixture);
    return;
  }
  renderNewsletterArchive(mount, newsletter, NEWSLETTER_NOTICE, designFixture);
}

/**
 * GOV-658 §6 — reviewer-internal Home dashboard. Real widgets consume existing
 * reviewed Alpine projections (card feed / digest / board); unavailable widgets
 * render honest-empty states or DEV samples only behind `?demo=sample`.
 */
function renderHomeRoute(mount: HTMLElement, query: URLSearchParams): void {
  const requestedAccess = query.get('access') === 'public' ? 'public' : undefined;
  const access = requestedAccess ?? CARD_FEED.access;
  renderHome(mount, {
    access,
    cardFeed: requestedAccess ? { ...CARD_FEED, access: requestedAccess } : CARD_FEED,
    board: requestedAccess ? { ...BOARD_PROJECTION, access: requestedAccess } : BOARD_PROJECTION,
    newsletter: requestedAccess ? { ...NEWSLETTER_DIGEST, access: requestedAccess } : NEWSLETTER_DIGEST,
    // `demo=design` enters the shared handoff-preview session. It still turns the
    // sample widgets on (`demo`), but GOV-76 splits out `designFixture` so the design
    // lane can render the baseline's Latest Verdict and Language Watch geometry that
    // `demo=sample` deliberately does not carry. Collapsing both into one flag was why
    // the shell declared fixture origin for /home while those two widgets stayed empty.
    demo: query.get('demo') === 'sample' || designPreviewActive(query),
    designFixture: designPreviewActive(query),
    sampleBoard: requestedAccess ? { ...BOARD_SAMPLE, access: requestedAccess } : BOARD_SAMPLE,
  });
}

/** Options shared by design-handoff-only routes. The outer `gated()` wrapper is
 * still the access authority; the explicit public-lane query remains a
 * fail-closed verification hook for tests/review. */
function designPageOptions(
  query: URLSearchParams,
  data?: ReadApiResponse,
): DesignPageOptions {
  return {
    access: query.get('access') === 'public' ? 'public' : data?.access ?? 'reviewer_internal',
    fixture: designPreviewActive(query),
  };
}

function renderPowerRoute(
  mount: HTMLElement,
  query: URLSearchParams,
  data?: ReadApiResponse,
): void {
  const fixture = designPreviewActive(query);
  const selected = fixture ? GRAPH_REAL : data;
  if (!selected) return renderReviewerContextState(mount, 'unavailable');
  renderDesignPowerTracker(
    mount,
    designPageOptions(query, selected),
    selected,
    fixture ? GRAPH_REAL_NOTICE : LIVE_CONTEXT_NOTICE,
  );
}

function renderWatchlistRoute(
  mount: HTMLElement,
  query: URLSearchParams,
  data?: ReadApiResponse,
): void {
  const fixture = designPreviewActive(query);
  const selected = fixture ? GRAPH_REAL : data;
  if (!selected) return renderReviewerContextState(mount, 'unavailable');
  renderDesignWatchlist(
    mount,
    designPageOptions(query, selected),
    selected,
    fixture ? GRAPH_REAL_NOTICE : LIVE_CONTEXT_NOTICE,
  );
}

function renderLocationRoute(
  mount: HTMLElement,
  query: URLSearchParams,
  data?: ReadApiResponse,
): void {
  const fixture = designPreviewActive(query);
  const selected = fixture ? GRAPH_REAL : data;
  if (!selected) return renderReviewerContextState(mount, 'unavailable');
  renderDesignLocation(
    mount,
    designPageOptions(query, selected),
    selected,
    fixture ? GRAPH_REAL_NOTICE : LIVE_CONTEXT_NOTICE,
  );
}

function renderAlertsRoute(
  mount: HTMLElement,
  query: URLSearchParams,
  data?: ReadApiResponse,
): void {
  const fixture = designPreviewActive(query);
  const selected = fixture ? GRAPH_REAL : data;
  if (!selected) return renderReviewerContextState(mount, 'unavailable');
  renderDesignAlerts(
    mount,
    designPageOptions(query, selected),
    selected,
    fixture ? GRAPH_REAL_NOTICE : LIVE_CONTEXT_NOTICE,
  );
}

/**
 * Reviewer admission + local bypass (GOV-419 acceptance #3).
 *
 * The production Sites worker is the security boundary. It authorizes the
 * forwarded authenticated-user email before serving any app asset, then injects
 * only a boolean approval marker into the HTML. The browser uses that marker to
 * skip the obsolete duplicate login form; it never receives the email address.
 *
 * Three additional impure sources remain for LOCAL reviewer walkthroughs:
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
function reviewerAccessActive(query: URLSearchParams): boolean {
  const urlBypass = query.get('reviewer') === '1';
  if (urlBypass) persistBypass();
  return hostedReviewerAccessActive() || ENV_BYPASS || urlBypass || sessionBypass();
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
 * is tab-sticky; all other synthetic modes are URL-local. Explicit archived
 * captures remain reviewed snapshots; every normal route is labelled as the
 * live same-origin server context and never falls back to one of those captures.
 */
const SHELL_SAMPLE_FIXTURE_ROUTES: ReadonlySet<string> = new Set([
  '/home',
  '/app',
  '/agenda-boards',
  '/agenda',
  '/vault',
  '/sources',
]);
const SHELL_DESIGN_FIXTURE_ROUTES: ReadonlySet<string> = new Set([
  '/home',
  // GOV-84: the Newsletter fixture lane. The matrix §7 classes the July 21 edition,
  // debate and lenses GS — "owner design reference only unless an explicit gated
  // fixture renderer is added". That renderer now exists, so the shell must declare
  // fixture origin for this route too or shell and content disagree (the exact defect
  // GOV-76 fixed on /home).
  '/newsletter',
  // GOV-82 follow-up, found by the iteration-42 C1b drift pass: the Vault's gated
  // version-compare fixture shipped WITHOUT adding the route here, so the shell declared
  // `live_server` while the page rendered a synthetic diff — the exact shell/content
  // disagreement GOV-76 and GOV-84 fixed on /home and /newsletter. Same defect, same fix.
  //
  // GOV-2272: `/sources` is the canonical ALIAS of `/vault` — both register the identical
  // Source Vault handler and pass `designPreviewActive(query)` to the same renderer. `/vault`
  // was listed here; `/sources` was not, so a tab-sticky design preview carried to `#/sources`
  // rendered the synthetic version-compare fixture while the shell still announced
  // `live_server`. The alias must be classified identically to its primary — the parity is
  // guarded by test/design-routes.test.ts so the two can never diverge again.
  '/vault',
  '/sources',
  '/agenda',
  '/timeline',
  // GOV-163: the Boards GS fixture lane. Added in the SAME change as the renderer — GOV-84
  // and the GOV-82 follow-up both shipped a fixture without this line, and each time the
  // shell announced `live_server` over synthetic content.
  '/boards',
  '/power',
  '/watchlist',
  '/location',
  '/alerts',
]);
const SHELL_FORCED_STATE_FIXTURE_ROUTES: ReadonlySet<string> = new Set([
  '/timeline-legacy',
  '/cards',
  '/newsletter',
  '/body',
  '/meeting',
]);
function shellOriginFor(path: string, query: URLSearchParams): ShellOrigin {
  const designFixture = designPreviewActive(query);
  const demo = query.get('demo');
  // The explainer is product education, not a civic response. Its dedicated
  // origin prevents LIVE SERVER CONTEXT from appearing above hypothetical
  // figures and keeps fixture Alerts counts out of this non-alerting surface.
  if (path === '/explainer') return 'product_demo';
  const explicitFixture =
    (demo === 'sample' && SHELL_SAMPLE_FIXTURE_ROUTES.has(path))
    || (path === '/timeline-legacy' && ['complete', 'matrix', 'provenance'].includes(demo ?? ''))
    || (path === '/topics' && demo === 'graph-synthetic')
    || (
      SHELL_FORCED_STATE_FIXTURE_ROUTES.has(path)
      && ['loading', 'empty', 'error'].includes(query.get('state') ?? '')
    );
  if ((designFixture && SHELL_DESIGN_FIXTURE_ROUTES.has(path)) || explicitFixture) return 'fixture';
  const reviewedSnapshot =
    ((path === '/timeline' || path === '/topics') && demo === 'graph')
    || (path === '/newsletter' && demo === 'snapshot');
  return reviewedSnapshot ? 'reviewed_snapshot' : 'live_server';
}

/** Resolve the access state for a request from its query + the live bypass. */
function accessFor(query: URLSearchParams) {
  return resolveAccess(query.get('gate'), reviewerAccessActive(query));
}

/**
 * The hosted owner has already signed in at the Sites boundary, so the root and
 * unknown routes enter the reviewed app directly. Explicit gate states still
 * render the requested access panel for QA and screenshots.
 */
function renderEntry(query: URLSearchParams): void {
  const access = accessFor(query);
  if (hostedReviewerAccessActive() && access === 'approved') {
    window.location.hash = '/home';
    return;
  }
  renderLanding(root!, access);
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
      // One origin decision feeds both the banner and the Alerts badge, so the
      // chip can never claim a count on a route the banner calls reviewed.
      const origin = shellOriginFor(path, query);
      const mount = renderShell(root!, { active: path, origin, fixture: origin === 'fixture' });
      handler({ mount, path, query });
    });
}

const AGENDA_BOARD_GAP: ProjectionGapDefinition = {
  id: 'agenda-board',
  kicker: 'FAST AGENDA · LIVE CONTRACT GAP',
  title: 'Agenda board not available yet',
  whatItDoes: 'Fast Agenda will connect meeting notices, official agenda items, reviewed changes, public-comment windows, votes, and later follow-up in one meeting-first workspace.',
  requiredProjection: 'A server-reviewed agenda-board response with stable meeting and agenda-item ids, lifecycle lanes, source receipts, timestamps, and explicit statement links.',
  howItWorks: 'The backend will assemble and authorize the board. This page will preserve the supplied order and status without guessing a meeting, deadline, vote, or relationship from statement text.',
  expectedResult: 'A quick Simple agenda and a denser Advanced workbench that show the same meetings, identifiers, receipts, and trust states.',
  filedUnder: 'Civic records · Meetings and agendas · Alpine',
};

function renderAuthorizedProjectionGap(
  mount: HTMLElement,
  data: ReadApiResponse,
  definition: ProjectionGapDefinition,
): void {
  if (data.access !== 'reviewer_internal') {
    renderReviewerContextState(mount, 'denied');
    return;
  }
  projectionGapPage(mount, definition);
}

// Preview-launch landing is the DEFAULT entry (and the fallback). The full
// reviewer-internal app begins at `/home`; every civic surface remains gated.
const router = createRouter(({ query }) => renderEntry(query));
router.register('/', ({ query }) => renderEntry(query));
// `#/app` keeps the owner-confirmed agenda-workspace position without inventing
// a board from statement rows. Until AgendaBoard is supplied by the shared
// server response, it renders the detailed contract gap. Direct records remain
// available at `#/timeline` and `#/cards`.
router.register('/home', gated(({ mount, query }) => {
  if (query.get('demo') === 'sample' || designPreviewActive(query)) {
    renderHomeRoute(mount, query);
    return;
  }
  void withReviewerContext(mount, query, (data) => renderHomeReadModel(mount, data));
}));
// The media contains a hypothetical civic scenario. Reviewer admission comes
// from `gated`; the explicit URL-local sample flag is the second GS boundary.
// Plain `/explainer` remains a media-free overview.
router.register('/explainer', gated(({ mount, query }) => renderExplainer(mount, {
  demo: query.get('demo') === 'sample',
})));
router.register('/app', gated(({ mount, query }) => {
  if (query.get('demo') === 'sample') {
    renderBoardsRoute(mount, query);
    return;
  }
  void withReviewerContext(mount, query, (data) =>
    renderAuthorizedProjectionGap(mount, data, AGENDA_BOARD_GAP));
}));
router.register('/agenda', gated(({ mount, query }) => {
  if (query.get('demo') === 'sample' || designPreviewActive(query)) {
    renderFastAgendaRoute(mount, query);
    return;
  }
  void withReviewerContext(mount, query, (data) => renderFastAgendaRoute(mount, query, data));
}));
router.register('/boards', gated(({ mount, query }) => {
  // GOV-163: the matrix §4 GS row ("populated handoff board cards") declared a fixture lane
  // that no renderer implemented. It renders SYNCHRONOUSLY, following /newsletter rather
  // than /vault: routing a fixture through `withReviewerContext` makes it depend on a live
  // reviewer read it never uses, so the shell declares fixture origin while the page waits
  // on — or fails — a fetch. With the backend down that is not hypothetical, it is what the
  // page shows.
  if (designPreviewActive(query)) {
    renderBoardsDesign(mount, designPageOptions(query));
    return;
  }
  void withReviewerContext(mount, query, (data) => renderBoardsDirectoryRoute(mount, query, data));
}));
router.register('/issue', gated(({ mount, query }) => {
  void withReviewerContext(mount, query, (data) => renderIssueDetailRoute(mount, query, data));
}));
router.register('/vault', gated(({ mount, query }) => {
  if (query.get('demo') === 'sample') {
    renderSourceVaultRoute(mount, query, narrowToRequestedAccess(GRAPH_REAL, query));
    return;
  }
  void withReviewerContext(mount, query, (data) => renderSourceVaultRoute(mount, query, data));
}));
router.register('/upload', gated(({ mount, query }) => renderUploadRoute(mount, query)));
router.register('/sources', gated(({ mount, query }) => {
  if (query.get('demo') === 'sample') {
    renderSourceVaultRoute(mount, query, narrowToRequestedAccess(GRAPH_REAL, query));
    return;
  }
  void withReviewerContext(mount, query, (data) => renderSourceVaultRoute(mount, query, data));
}));
router.register('/agenda-boards', gated(({ mount, query }) => {
  if (query.get('demo') === 'sample') {
    renderBoardsRoute(mount, query);
    return;
  }
  void withReviewerContext(mount, query, (data) =>
    renderAuthorizedProjectionGap(mount, data, AGENDA_BOARD_GAP));
}));
router.register('/timeline', gated(({ mount, query }) => {
  // The gated design fixture consumes no reviewed data, so it must not wait on
  // (or be masked by) the shared reviewer context — same rule as /home, /agenda.
  if (designPreviewActive(query)) {
    renderTimelineLevelsRoute(mount, query);
    return;
  }
  if (query.get('demo') === 'graph') {
    renderTimelineLevelsRoute(mount, query, GRAPH_REAL);
    return;
  }
  void withReviewerContext(mount, query, (data) => renderTimelineLevelsRoute(mount, query, data));
}));
router.register('/timeline-legacy', gated(({ mount, query }) => {
  if (
    ['complete', 'matrix', 'provenance'].includes(query.get('demo') ?? '')
    || ['loading', 'empty', 'error'].includes(query.get('state') ?? '')
  ) {
    renderTimeline(mount, query);
    return;
  }
  void withReviewerContext(mount, query, (data) => renderTimeline(mount, query, data));
}));
router.register('/cards', gated(({ mount, query }) => {
  if (['loading', 'empty', 'error'].includes(query.get('state') ?? '')) {
    renderCardFeedRoute(mount, query);
    return;
  }
  void withReviewerContext(mount, query, (data) => renderCardFeedRoute(mount, query, data));
}));
router.register('/newsletter', gated(({ mount, query }) => {
  if (
    query.get('demo') === 'snapshot'
    // GOV-84: the gated fixture lane renders synchronously, exactly as /power and the
    // other design routes do. Routing it through `withReviewerContext` would make the
    // fixture depend on a live reviewer read it does not use — the shell would declare
    // fixture origin while the page waited on (or failed) a fetch.
    || designPreviewActive(query)
    || ['loading', 'empty', 'error'].includes(query.get('state') ?? '')
  ) {
    renderNewsletterRoute(mount, query);
    return;
  }
  void withReviewerContext(mount, query, (data) => renderNewsletterRoute(mount, query, data));
}));
router.register('/power', gated(({ mount, query }) => {
  if (designPreviewActive(query)) {
    renderPowerRoute(mount, query);
    return;
  }
  void withReviewerContext(mount, query, (data) => renderPowerRoute(mount, query, data));
}));
router.register('/watchlist', gated(({ mount, query }) => {
  if (designPreviewActive(query)) {
    renderWatchlistRoute(mount, query);
    return;
  }
  void withReviewerContext(mount, query, (data) => renderWatchlistRoute(mount, query, data));
}));
router.register('/location', gated(({ mount, query }) => {
  if (designPreviewActive(query)) {
    renderLocationRoute(mount, query);
    return;
  }
  void withReviewerContext(mount, query, (data) => renderLocationRoute(mount, query, data));
}));
router.register('/alerts', gated(({ mount, query }) => {
  if (designPreviewActive(query)) {
    renderAlertsRoute(mount, query);
    return;
  }
  void withReviewerContext(mount, query, (data) => renderAlertsRoute(mount, query, data));
}));
router.register('/topics', gated(({ mount, query }) => {
  if (['graph', 'graph-synthetic'].includes(query.get('demo') ?? '')) {
    renderTopics(mount, query);
    return;
  }
  void withReviewerContext(mount, query, (data) => renderTopics(mount, query, data));
}));
router.register('/body', gated(({ mount, query }) => {
  if (['loading', 'empty', 'error'].includes(query.get('state') ?? '')) {
    renderContextPage(mount, 'body', query);
    return;
  }
  void withReviewerContext(mount, query, (data) => renderContextPage(mount, 'body', query, data));
}));
router.register('/meeting', gated(({ mount, query }) => {
  if (['loading', 'empty', 'error'].includes(query.get('state') ?? '')) {
    renderContextPage(mount, 'meeting', query);
    return;
  }
  void withReviewerContext(mount, query, (data) => renderContextPage(mount, 'meeting', query, data));
}));

// GOV-440 — apply the stored theme preference and mount the dark/light toggle on
// <body> (outside #app, so it survives route re-renders). GOV-665 page-mode
// defaults may then apply Advanced/dark when the stored pref is still `system`;
// explicit dark/light toggle choices continue to win.
mountThemeToggle();
router.start();
