/**
 * App boot for the reviewer-internal Alpine timeline skeleton (GOV-99).
 *
 * Mounts the single timeline route, loads the read model via the data client
 * (read-API → labeled-fixture fallback), and renders through the shared
 * state primitives. A `?state=` query override lets reviewers (and the
 * screenshot harness) force the loading / empty / error states deterministically.
 */

import { createRouter } from './router';
import { loadReadModel } from './data/client';
import { render } from './ui/render';
import { idle, loading, failed, resolved } from './state/async-state';
import { isEmptyResponse } from './data/client';
import type { ReadApiResponse } from './types/read-api';

const root = document.getElementById('app');
if (!root) throw new Error('missing #app mount');

// Force a state for review/screenshots: #/?state=loading|empty|error
async function renderTimeline(query: URLSearchParams): Promise<void> {
  const forced = query.get('state');

  if (forced === 'loading') {
    render(root!, loading<ReadApiResponse>('fixture'));
    return;
  }
  if (forced === 'error') {
    render(root!, failed<ReadApiResponse>(new Error('Reviewer-internal read-API is unreachable.'), 'fixture'));
    return;
  }
  if (forced === 'empty') {
    const emptyBody: ReadApiResponse = { scope: 'alpine', access: 'reviewer_internal', records: [] };
    render(root!, resolved(emptyBody, 'fixture', isEmptyResponse));
    return;
  }

  // Real load path: show loading, then resolve.
  render(root!, idle<ReadApiResponse>());
  const { state, notice } = await loadReadModel();
  render(root!, state, notice);
}

const router = createRouter(({ query }) => void renderTimeline(query));
router.register('/', ({ query }) => void renderTimeline(query));
router.start();
