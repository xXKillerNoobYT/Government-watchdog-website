/**
 * App boot for the reviewer-internal Alpine surfaces.
 *
 *  - `/`         timeline skeleton (GOV-99/100): cards, drawers, trust labels.
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

import { createRouter } from './router';
import { loadReadModel, isEmptyResponse } from './data/client';
import { assertWebSafe } from './data/web-safe';
import { render } from './ui/render';
import { renderTopicTreeView } from './ui/topic-tree-view';
import { idle, loading, failed, resolved } from './state/async-state';
import type { AsyncState } from './state/async-state';
import type { ReadApiResponse } from './types/read-api';
import type { MoveRequest } from './ui/topic-tree';
import stateMatrixData from './fixtures/state-matrix.json';
import conceptGraphDemoData from './fixtures/concept-graph-demo.json';
import conceptGraphRealData from './fixtures/concept-graph-real.json';

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
async function renderTimeline(query: URLSearchParams): Promise<void> {
  const forced = forcedState(query.get('state'));
  if (forced) return render(root!, forced);
  if (query.get('demo') === 'matrix') {
    render(root!, resolved(STATE_MATRIX, 'fixture', isEmptyResponse), 'State-matrix sample — one card per trust state, not real data.');
    return;
  }
  if (query.get('demo') === 'complete') {
    render(root!, resolved(completeDemoBody(), 'fixture', isEmptyResponse), 'Showing a labeled sample — not real data.');
    return;
  }
  render(root!, idle<ReadApiResponse>());
  const { state, notice } = await loadReadModel();
  render(root!, state, notice);
}

/** Render the topics surface: civic topic tree above the reused B card+drawer
 *  timeline. `treeOverride` lets the default view show the REAL tree above a
 *  live/fixture timeline that itself carries no tree. */
function renderTopicsSurface(
  state: AsyncState<ReadApiResponse>,
  notice: string | undefined,
  focusTopicId: string,
  move: MoveRequest | undefined,
  treeOverride?: ReadApiResponse['topic_tree'],
): void {
  root!.replaceChildren();

  const treeBox = el('div', { class: 'tt-wrap', 'data-test': 'topics-page' });
  root!.append(treeBox);
  const topicTree = treeOverride ?? (state.status === 'ready' ? state.data?.topic_tree : null);
  if (topicTree) {
    renderTopicTreeView(treeBox, topicTree, { focusTopicId, move });
  } else {
    treeBox.append(el('p', { class: 'gw-muted' }, 'No topic tree in this view.'));
  }

  // Reuse the B card+drawer timeline below the tree.
  const timelineBox = el('div', { 'data-test': 'topics-timeline' });
  root!.append(timelineBox);
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
async function renderTopics(query: URLSearchParams): Promise<void> {
  render(root!, idle<ReadApiResponse>());
  const demo = query.get('demo');

  if (demo === 'graph-synthetic') {
    renderTopicsSurface(
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
    state,
    notice,
    query.get('topic') ?? REAL_DEFAULT_FOCUS,
    parseOptionalMove(query),
    // Default timeline carries no tree → show the REAL tree above it.
    GRAPH_REAL.topic_tree,
  );
}

/** Body / meeting page: the same B card+drawer list under a context heading. */
async function renderContextPage(kind: 'body' | 'meeting', query: URLSearchParams): Promise<void> {
  const forced = forcedState(query.get('state'));
  render(root!, idle<ReadApiResponse>());
  const { state, notice } = forced ? { state: forced, notice: undefined } : await loadReadModel();
  root!.replaceChildren();
  const heading = kind === 'body'
    ? 'Government body — Alpine Town Council (reviewer-internal)'
    : 'Meeting record (reviewer-internal)';
  root!.append(el('section', { class: 'gw-page-context', 'data-test': `${kind}-page` }, heading));
  const timelineBox = el('div', { 'data-test': `${kind}-timeline` });
  root!.append(timelineBox);
  render(timelineBox, state, notice);
}

const router = createRouter(({ query }) => void renderTimeline(query));
router.register('/', ({ query }) => void renderTimeline(query));
router.register('/topics', ({ query }) => void renderTopics(query));
router.register('/body', ({ query }) => void renderContextPage('body', query));
router.register('/meeting', ({ query }) => void renderContextPage('meeting', query));
router.start();
