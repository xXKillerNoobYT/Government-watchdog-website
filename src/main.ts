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
import { render } from './ui/render';
import { renderTopicTreeView } from './ui/topic-tree-view';
import { idle, loading, failed, resolved } from './state/async-state';
import type { AsyncState } from './state/async-state';
import type { ReadApiResponse } from './types/read-api';
import type { MoveRequest } from './ui/topic-tree';

const root = document.getElementById('app');
if (!root) throw new Error('missing #app mount');

function el(tag: string, attrs: Record<string, string> = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text) node.textContent = text;
  return node;
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

async function renderTimeline(query: URLSearchParams): Promise<void> {
  const forced = forcedState(query.get('state'));
  if (forced) return render(root!, forced);
  render(root!, idle<ReadApiResponse>());
  const { state, notice } = await loadReadModel();
  render(root!, state, notice);
}

/** Topic page: civic topic tree above the reused B card+drawer timeline. */
async function renderTopics(query: URLSearchParams): Promise<void> {
  render(root!, idle<ReadApiResponse>());
  const { state, notice } = await loadReadModel();
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
