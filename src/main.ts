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

/**
 * State-matrix sample (GOV-104): one labeled card per record-level trust state
 * (pending-review / disputed / corrected / do-not-publish) so the legend + each
 * status badge can be captured in one screenshot. Swept for raw paths at load,
 * exactly like the main fixture — demo scaffolding, never a trust recompute.
 */
const STATE_MATRIX: ReadApiResponse = assertWebSafe(stateMatrixData as ReadApiResponse);

/**
 * Concept-graph demo (GOV-129): a clearly-labeled SYNTHETIC sample carrying the
 * agenda-thread + topic-tree + completeness shapes. The real reviewed read_api
 * serves 0 topics / 0 threads today (only promoted statements exist), so the
 * `/topics` tree and the `?demo=complete` completeness state are demonstrated
 * from this sample under a visible "not real data" notice — NEVER presented as
 * real. Flips to a real capture once the backend builds a reviewer-internal
 * concept graph over the real Alpine corpus (GOV-129 follow-up).
 */
const GRAPH_DEMO: ReadApiResponse = assertWebSafe(conceptGraphDemoData as ReadApiResponse);
const GRAPH_DEMO_NOTICE =
  'Concept-graph sample (topic tree / agenda thread) — not real data; no real concept graph exists yet.';

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

/** Topic page: civic topic tree above the reused B card+drawer timeline.
 *  Default: real reviewed data (no concept graph yet → honest "no topic tree").
 *  `?demo=graph`: render the labeled SYNTHETIC concept-graph sample so the tree
 *  surface can be reviewed/screenshotted until the real graph exists. */
async function renderTopics(query: URLSearchParams): Promise<void> {
  render(root!, idle<ReadApiResponse>());
  const { state, notice } =
    query.get('demo') === 'graph'
      ? { state: resolved(GRAPH_DEMO, 'fixture', isEmptyResponse), notice: GRAPH_DEMO_NOTICE }
      : await loadReadModel();
  root!.replaceChildren();

  const treeBox = el('div', { class: 'tt-wrap', 'data-test': 'topics-page' });
  root!.append(treeBox);
  const topicTree = state.status === 'ready' ? state.data?.topic_tree : null;
  if (topicTree) {
    renderTopicTreeView(treeBox, topicTree, {
      focusTopicId: query.get('topic') ?? DEFAULT_FOCUS,
      move: parseMove(query),
    });
  } else {
    treeBox.append(el('p', { class: 'gw-muted' }, 'No topic tree in this view.'));
  }

  // Reuse the B card+drawer timeline below the tree.
  const timelineBox = el('div', { 'data-test': 'topics-timeline' });
  root!.append(timelineBox);
  render(timelineBox, state, notice);
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
