// @vitest-environment jsdom
/**
 * GOV-104 · Slice 4·E — reviewer-internal INTEGRATION SMOKE.
 *
 * This is the slice-closing smoke. It wires the REAL captured backend read-API
 * sample (`read-api-sample.json`, from `read_api.build_response(...)` at GOV-98
 * merge) through the actual client → render → graph pipeline and asserts the
 * five hard invariants of the slice, end-to-end:
 *
 *   (a) zero raw/absolute paths in the response body (TRANSPORT level),
 *   (b) no rendered card without a trust label,
 *   (c) no fabricated cross-meeting link (links only from typed backend edges),
 *   (d) the rollup filter returns descendants,
 *   (e) a cyclic rollup graph is rejected (degraded, never rendered as a tree).
 *
 * Run alone: `npm run test:smoke`. Also runs inside `npm test` in CI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { loadReadModel } from '../src/data/client';
import { assertWebSafe, findRawPathLeaksInText } from '../src/data/web-safe';
import { render } from '../src/ui/render';
import { assembleThread } from '../src/ui/timeline';
import { graphFromResponse, flattenTopicTree, buildRollupGraph, rollupFilter, TOPIC_ROLLUP } from '../src/ui/topic-tree';
import type { ReadApiResponse, ConceptEdge } from '../src/types/read-api';
// The REAL reviewed backend output (read_api.reviewer_internal_records at backend
// origin/main 235bba6, GOV-146 Option-A seed): 6 real reviewed Alpine records,
// source-backed, no concept graph. Drives the records-level invariants (a)+(b).
import sampleData from './read-api-sample.json';
// Labeled SYNTHETIC concept-graph demo: drives the agenda-thread + topic-rollup +
// cycle invariants (c)+(d)+(e) that the real reviewed corpus cannot exercise yet
// (0 topics / 0 threads). When the backend builds a reviewer-internal concept graph
// over the real corpus, these flip to the real capture (GOV-129 follow-up).
import graphDemoData from '../src/fixtures/concept-graph-demo.json';

const sample = sampleData as unknown as ReadApiResponse;
const demo = graphDemoData as unknown as ReadApiResponse;
// Transport-level body text: the serialized response exactly as it crosses the
// wire (keys + values). Scanning this catches a raw locator in ANY field.
const SAMPLE_TEXT = JSON.stringify(sampleData);

/** Mock fetch returning the captured sample — exercises the real live-read path. */
function mockFetch(body: unknown): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
  })) as unknown as typeof fetch;
}

let root: HTMLElement;
beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
});

describe('GOV-104 integration smoke — 5 assertions against the real read-API sample', () => {
  it('(a) zero raw/absolute paths in the response body (transport-level)', () => {
    // Transport-level: scan the raw BYTES, before any parse.
    expect(findRawPathLeaksInText(SAMPLE_TEXT)).toEqual([]);
    // Structural defense-in-depth: the parsed body also passes the walk.
    expect(() => assertWebSafe(sample)).not.toThrow();
  });

  it('(b) no rendered card is missing a trust label', async () => {
    const { state } = await loadReadModel({
      config: { useFixtures: false, readApiUrl: 'http://127.0.0.1:8787/read' },
      fetchImpl: mockFetch(sample),
    });
    expect(state.status).toBe('ready');
    render(root, state);

    const cards = root.querySelectorAll('[data-test="record-card"]');
    expect(cards.length).toBe(sample.records!.length);
    expect(cards.length).toBeGreaterThan(0);
    for (const card of Array.from(cards)) {
      const badge = card.querySelector('[data-test="trust-badge"]');
      expect(badge, 'every card must carry a trust badge').not.toBeNull();
      expect((badge!.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
    // The legend that explains those labels is present and tap-reachable.
    expect(root.querySelector('[data-test="trust-legend"]')?.tagName).toBe('DETAILS');
  });

  it('(c) no fabricated cross-meeting link — links come only from typed backend edges', () => {
    const thread = demo.agenda_thread!;
    const memberIds = new Set(thread.members.map((m) => m.agenda_item_id));
    const assembled = assembleThread(thread);

    const allLinks = assembled.instances.flatMap((i) => i.links);
    // Exactly the links the single backend supersedes edge implies (one 'out',
    // one 'in') — never more, so nothing was invented from title similarity.
    expect(allLinks.length).toBe(thread.lifecycle_edges.length * 2);
    for (const link of allLinks) {
      expect(memberIds.has(link.targetId), `link target ${link.targetId} must be a real member`).toBe(true);
      // BEH-AGENDA-2: a typed label, never the untyped word "related".
      expect(link.label.toLowerCase()).not.toBe('related');
      expect(link.label.length).toBeGreaterThan(0);
    }
  });

  it('(d) the rollup filter returns descendants (parent → whole subtree)', () => {
    const { graph, cyclic } = graphFromResponse(demo.topic_tree!);
    expect(cyclic).toBe(false);
    // safety → fire → fireworks (from the captured tree).
    const underSafety = rollupFilter(graph, 'topic:safety');
    expect(underSafety).toContain('topic:fire');
    expect(underSafety).toContain('topic:fireworks');
    expect(rollupFilter(graph, 'topic:fire')).toContain('topic:fireworks');
    // A leaf returns only itself — no invented descendants.
    expect(rollupFilter(graph, 'topic:fireworks')).toEqual(['topic:fireworks']);
  });

  it('(e) a cyclic rollup graph is rejected (degraded, not rendered as a tree)', () => {
    const { nodes, edges } = flattenTopicTree(demo.topic_tree!.tree);
    // Inject a back-edge (a top ancestor rolling up to its own descendant).
    const backEdge: ConceptEdge = {
      edge_id: 'cycle',
      edge_type: TOPIC_ROLLUP,
      from_node_id: 'topic:safety',
      from_node_type: 'topic',
      to_node_id: 'topic:fireworks',
      to_node_type: 'topic',
    };
    const result = buildRollupGraph(nodes, [...edges, backEdge]);
    expect(result.cyclic).toBe(true);
    expect(result.warnings.some((w) => w.includes('cycle'))).toBe(true);
  });
});
