import { describe, it, expect } from 'vitest';
import {
  buildRollupGraph,
  flattenTopicTree,
  graphFromResponse,
  breadcrumb,
  descendants,
  rollupFilter,
  rootTopicIds,
  applyMove,
  topicPrimaryLabel,
  topicGovAlias,
  aliasInspectLabel,
  TOPIC_ROLLUP,
} from '../src/ui/topic-tree';
import type { TopicNode, ConceptEdge, TopicTreeResponse } from '../src/types/read-api';
// GOV-129: graph-logic coverage runs on the labeled SYNTHETIC concept-graph demo
// (the real reviewed corpus has 0 topics/0 threads, so it cannot exercise this).
import fixture from '../src/fixtures/concept-graph-demo.json';

// general safety ← fire prevention ← fireworks  (child rolls up to parent)
const SAFETY: TopicNode = { topic_id: 'topic:safety', name: 'General safety', canonicalHumanLabel: 'general safety', sourceAliases: [] };
const FIRE: TopicNode = { topic_id: 'topic:fire', name: 'Fire prevention', canonicalHumanLabel: 'fire prevention', sourceAliases: [] };
const FIREWORKS: TopicNode = { topic_id: 'topic:fireworks', name: 'Fireworks', canonicalHumanLabel: 'fireworks', sourceAliases: [] };
const NOISE: TopicNode = { topic_id: 'topic:noise', name: 'Noise', canonicalHumanLabel: 'noise', sourceAliases: [] };

function rollup(from: string, to: string): ConceptEdge {
  return { edge_type: TOPIC_ROLLUP, from_node_id: from, to_node_id: to };
}

const NODES = [SAFETY, FIRE, FIREWORKS, NOISE];
const EDGES = [rollup('topic:fire', 'topic:safety'), rollup('topic:fireworks', 'topic:fire'), rollup('topic:noise', 'topic:safety')];

describe('buildRollupGraph (child → parent edges)', () => {
  it('builds parent/children maps and finds the roots', () => {
    const { graph, cyclic, warnings } = buildRollupGraph(NODES, EDGES);
    expect(cyclic).toBe(false);
    expect(warnings).toEqual([]);
    expect(graph.parentOf.get('topic:fireworks')).toBe('topic:fire');
    expect(graph.parentOf.get('topic:fire')).toBe('topic:safety');
    expect(rootTopicIds(graph)).toEqual(['topic:safety']);
  });

  it('ignores non-rollup edges and edges to unknown nodes (warns)', () => {
    const edges: ConceptEdge[] = [
      { edge_type: 'agenda_item_supersedes', from_node_id: 'topic:fire', to_node_id: 'topic:safety' },
      rollup('topic:ghost', 'topic:safety'),
    ];
    const { graph, warnings } = buildRollupGraph(NODES, edges);
    expect(graph.parentOf.size).toBe(0); // the supersedes edge is not a rollup
    expect(warnings.some((w) => w.includes('unknown topic'))).toBe(true);
  });
});

describe('BEH-TOPICTREE-1 — rollup filter returns descendants; leaf returns only itself', () => {
  const { graph } = buildRollupGraph(NODES, EDGES);

  it('a parent returns itself + ALL descendants (fire prevention → incl. fireworks)', () => {
    expect(rollupFilter(graph, 'topic:fire')).toEqual(['topic:fire', 'topic:fireworks']);
    expect(descendants(graph, 'topic:safety').sort()).toEqual(['topic:fire', 'topic:fireworks', 'topic:noise']);
  });

  it('a leaf returns ONLY itself (fireworks → just fireworks)', () => {
    expect(rollupFilter(graph, 'topic:fireworks')).toEqual(['topic:fireworks']);
    expect(descendants(graph, 'topic:fireworks')).toEqual([]);
  });
});

describe('BEH-TOPICTREE-2 — breadcrumb is derived from edges, not hardcoded', () => {
  const { graph } = buildRollupGraph(NODES, EDGES);

  it('walks the full path top → node', () => {
    const path = breadcrumb(graph, 'topic:fireworks').map(topicPrimaryLabel);
    expect(path).toEqual(['general safety', 'fire prevention', 'fireworks']);
  });

  it('a root has a single-element breadcrumb; an unknown id has none', () => {
    expect(breadcrumb(graph, 'topic:safety').map((t) => t.topic_id)).toEqual(['topic:safety']);
    expect(breadcrumb(graph, 'topic:nope')).toEqual([]);
  });

  it('re-derives the same breadcrumb from a flattened served tree', () => {
    const { nodes, edges } = flattenTopicTree((fixture as unknown as TopicTreeResponse & { topic_tree: TopicTreeResponse }).topic_tree.tree);
    const { graph: g2 } = buildRollupGraph(nodes, edges);
    expect(breadcrumb(g2, 'topic:fireworks').map(topicPrimaryLabel)).toEqual(['general safety', 'fire prevention', 'fireworks']);
  });
});

describe('BEH-TOPICTREE-3 — audited move updates the edge + records provenance; underlying records unchanged', () => {
  const { graph } = buildRollupGraph(NODES, EDGES);

  it('re-homes a topic and records {movedBy, movedAtUtc, fromParentTopicId, toParentTopicId}', () => {
    const res = applyMove(graph, { topicId: 'topic:fireworks', toParentTopicId: 'topic:safety', movedBy: 'reviewer:abby', movedAtUtc: '2026-06-09T12:00:00Z' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.provenance).toEqual({
      topicId: 'topic:fireworks',
      movedBy: 'reviewer:abby',
      movedAtUtc: '2026-06-09T12:00:00Z',
      fromParentTopicId: 'topic:fire',
      toParentTopicId: 'topic:safety',
    });
    // The new typed edge points fireworks → safety.
    expect(res.edge).toMatchObject({ edge_type: TOPIC_ROLLUP, from_node_id: 'topic:fireworks', to_node_id: 'topic:safety' });
    // New graph reflects the move…
    expect(res.graph.parentOf.get('topic:fireworks')).toBe('topic:safety');
    // …and the ORIGINAL graph is untouched (immutability).
    expect(graph.parentOf.get('topic:fireworks')).toBe('topic:fire');
  });

  it('NEVER rewrites the underlying topic node objects — only the typed edge changes', () => {
    const res = applyMove(graph, { topicId: 'topic:fireworks', toParentTopicId: 'topic:safety', movedBy: 'r', movedAtUtc: '2026-06-09T12:00:00Z' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Node objects are shared by reference — the move cannot have edited any record.
    for (const id of ['topic:fireworks', 'topic:fire', 'topic:safety']) {
      expect(res.graph.nodes.get(id)).toBe(graph.nodes.get(id));
    }
  });

  it('promotes a topic to a root when moved to null parent (no edge emitted)', () => {
    const res = applyMove(graph, { topicId: 'topic:fireworks', toParentTopicId: null, movedBy: 'r', movedAtUtc: 't' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.edge).toBeNull();
    expect(res.graph.parentOf.has('topic:fireworks')).toBe(false);
    expect(rootTopicIds(res.graph).sort()).toEqual(['topic:fireworks', 'topic:safety']);
  });

  it('rejects a move that would create a cycle (re-home a node under its own descendant)', () => {
    const res = applyMove(graph, { topicId: 'topic:safety', toParentTopicId: 'topic:fireworks', movedBy: 'r', movedAtUtc: 't' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/cycle/i);
  });

  it('rejects unknown topics, self-moves, and no-ops', () => {
    expect(applyMove(graph, { topicId: 'topic:ghost', toParentTopicId: 'topic:safety', movedBy: 'r', movedAtUtc: 't' })).toMatchObject({ ok: false });
    expect(applyMove(graph, { topicId: 'topic:fire', toParentTopicId: 'topic:fire', movedBy: 'r', movedAtUtc: 't' })).toMatchObject({ ok: false });
    expect(applyMove(graph, { topicId: 'topic:fireworks', toParentTopicId: 'topic:fire', movedBy: 'r', movedAtUtc: 't' })).toMatchObject({ ok: false }); // already there
  });
});

describe('BEH-TOPICTREE-4 — a cyclic input is rejected/degraded, not rendered broken', () => {
  it('flags a cycle and still returns a usable (flat-able) graph + warning', () => {
    const cyclicEdges = [rollup('a', 'b'), rollup('b', 'c'), rollup('c', 'a')];
    const nodes: TopicNode[] = ['a', 'b', 'c'].map((id) => ({ topic_id: id, name: id, canonicalHumanLabel: id, sourceAliases: [] }));
    const { cyclic, warnings, graph } = buildRollupGraph(nodes, cyclicEdges);
    expect(cyclic).toBe(true);
    expect(warnings.some((w) => /cycle/i.test(w))).toBe(true);
    // Still iterable as a flat node set (the view degrades to this), never infinite.
    expect([...graph.nodes.keys()].sort()).toEqual(['a', 'b', 'c']);
  });

  it('keeps the first parent and warns when a child is given multiple parents', () => {
    const edges = [rollup('topic:fire', 'topic:safety'), rollup('topic:fire', 'topic:noise')];
    const { graph, warnings } = buildRollupGraph(NODES, edges);
    expect(graph.parentOf.get('topic:fire')).toBe('topic:safety');
    expect(warnings.some((w) => /multiple parents/i.test(w))).toBe(true);
  });

  it('breadcrumb is cycle-guarded — terminates on a corrupt looped graph', () => {
    const cyclicEdges = [rollup('a', 'b'), rollup('b', 'a')];
    const nodes: TopicNode[] = ['a', 'b'].map((id) => ({ topic_id: id, name: id, canonicalHumanLabel: id, sourceAliases: [] }));
    const { graph } = buildRollupGraph(nodes, cyclicEdges);
    const path = breadcrumb(graph, 'a'); // must not spin
    expect(path.length).toBeLessThanOrEqual(2);
  });
});

describe('BEH-TOPICTREE-5 — human label primary; government term inspectable, never primary', () => {
  it('uses canonicalHumanLabel as the primary label, never the gov alias term', () => {
    const node: TopicNode = {
      topic_id: 'topic:safety',
      name: 'General safety',
      canonicalHumanLabel: 'general safety',
      sourceAliases: [{ term: 'public safety', aliasType: 'government_term', sourceRef: { sourceId: 's1' } }],
    };
    expect(topicPrimaryLabel(node)).toBe('general safety');
    expect(topicPrimaryLabel(node)).not.toBe('public safety');
  });

  it('falls back to name, then id — but NEVER to an alias term', () => {
    expect(topicPrimaryLabel({ topic_id: 't', name: 'Named', canonicalHumanLabel: null, sourceAliases: [{ term: 'gov', aliasType: 'government_term', sourceRef: { sourceId: 's' } }] })).toBe('Named');
    expect(topicPrimaryLabel({ topic_id: 'only-id', canonicalHumanLabel: null, name: null, sourceAliases: [] })).toBe('only-id');
  });

  it('exposes the government term on demand with a "source term:" prefix', () => {
    const alias = topicGovAlias({ sourceAliases: [{ term: 'public safety', aliasType: 'government_term', sourceRef: { sourceId: 's' } }] });
    expect(alias?.term).toBe('public safety');
    expect(aliasInspectLabel(alias!)).toBe('source term: public safety');
  });

  it('returns no alias (the view shows none) when a node has no source term', () => {
    expect(topicGovAlias({ sourceAliases: [] })).toBeUndefined();
  });
});

describe('graphFromResponse — consumes the served topic_tree', () => {
  it('builds an acyclic graph straight from the fixture response', () => {
    const tt = (fixture as unknown as { topic_tree: TopicTreeResponse }).topic_tree;
    const { graph, cyclic } = graphFromResponse(tt);
    expect(cyclic).toBe(false);
    expect(rollupFilter(graph, 'topic:fire')).toEqual(['topic:fire', 'topic:fireworks']);
  });
});
