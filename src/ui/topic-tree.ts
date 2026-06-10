/**
 * Civic topic tree — pure logic over `topic_rollup` edges (GOV-102, Slice 4·D).
 *
 * BEH-TOPICTREE-1..5. DOM-free so rollup / breadcrumb / move / cycle-safety stay
 * unit-testable in node, and so a later visual slice can restyle the view
 * (topic-tree-view.ts) without touching the graph rules. The view degrades to a
 * flat list when this module flags a cycle.
 *
 * Edge direction (the one fact everything derives from):
 *   a `topic_rollup` ConceptEdge is CHILD → PARENT — `from_node_id` rolls up to
 *   `to_node_id`. e.g. fireworks --topic_rollup--> fire prevention --> general
 *   safety. So: breadcrumb walks parents UP; rollup-filter walks children DOWN;
 *   a move rewrites exactly one child's parent pointer.
 *
 * Three hard rules carried from GOV-99/100 hold here:
 *  1. **No trust is recomputed.** This module only arranges topic nodes by their
 *     typed rollup edges. It never reads/derives `ui_status` or publication
 *     state — that stays backend-owned (pass-up trigger if ever needed).
 *  2. **A move never rewrites underlying records.** {@link applyMove} returns a
 *     NEW edge + a provenance record and leaves every TopicNode object (and all
 *     statements/agenda items/source trail) byte-for-byte unchanged.
 *  3. **Human label is primary; the government term is inspectable, never
 *     hidden, never primary** (BEH-TOPICTREE-5) — see {@link topicPrimaryLabel}
 *     / {@link topicGovAlias}.
 */

import type {
  TopicNode,
  TopicTreeNode,
  TopicTreeResponse,
  ConceptEdge,
  SourceAlias,
  LabelLayer,
} from '../types/read-api';

/** The only edge type this module arranges. */
export const TOPIC_ROLLUP = 'topic_rollup';

// --- Label layer (BEH-TOPICTREE-5: human-label-first) -----------------------

/**
 * Primary display label for a topic/thread node: the everyday human word. The
 * government source-term is NEVER primary; if no human label exists we fall back
 * to the node's `name`, then its id — but never to a `sourceAlias.term`.
 */
export function topicPrimaryLabel(node: Partial<LabelLayer> & { name?: string | null; topic_id?: string }): string {
  const human = node.canonicalHumanLabel?.trim();
  if (human) return human;
  const name = node.name?.trim();
  if (name) return name;
  return node.topic_id ?? '(untitled topic)';
}

/**
 * The government/source term to expose ON DEMAND (alias chip / "source term:
 * …"). Inspectable, never hidden, never primary. Prefers a `government_term`,
 * else the first alias that carries one. Returns undefined when the node has no
 * source alias (then the view shows no alias chip — it never invents one).
 */
export function topicGovAlias(node: Partial<LabelLayer>): SourceAlias | undefined {
  const aliases = node.sourceAliases ?? [];
  return aliases.find((a) => a.aliasType === 'government_term') ?? aliases[0];
}

/** "source term: public safety" — the inspect-on-demand line for an alias. */
export function aliasInspectLabel(alias: SourceAlias): string {
  return `source term: ${alias.term}`;
}

// --- Rollup graph -----------------------------------------------------------

export interface RollupGraph {
  /** topic_id → node. */
  nodes: Map<string, TopicNode>;
  /** child topic_id → parent topic_id (each child rolls up to at most one parent). */
  parentOf: Map<string, string>;
  /** parent topic_id → child topic_ids, in first-seen edge order. */
  childrenOf: Map<string, string[]>;
}

export interface BuildResult {
  graph: RollupGraph;
  /** True when the rollup edges contain a cycle (caller must degrade to flat). */
  cyclic: boolean;
  /** Non-fatal anomalies (cycle, multi-parent) — surfaced + logged by the view. */
  warnings: string[];
}

/**
 * Build the rollup graph from a flat node set + edge set. Filters to
 * `topic_rollup` edges, ignores edges whose endpoints are unknown, keeps the
 * FIRST parent if a child is given several (multi-parent is a structural
 * anomaly — warn, don't crash), and runs cycle detection.
 *
 * Cycle-safety (BEH-TOPICTREE-4): on a cycle we still return a usable graph
 * (so the view can render a flat list), set `cyclic=true`, and add a warning —
 * we never build a structure that would render as a broken/infinite tree.
 */
export function buildRollupGraph(nodes: TopicNode[], edges: ConceptEdge[]): BuildResult {
  const warnings: string[] = [];
  const nodeMap = new Map<string, TopicNode>();
  for (const n of nodes) nodeMap.set(n.topic_id, n);

  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();

  for (const edge of edges) {
    if (edge.edge_type !== TOPIC_ROLLUP) continue;
    const child = edge.from_node_id;
    const parent = edge.to_node_id;
    if (!nodeMap.has(child) || !nodeMap.has(parent)) {
      warnings.push(`rollup edge references unknown topic (${child} → ${parent}) — skipped`);
      continue;
    }
    if (child === parent) {
      warnings.push(`self-rollup edge on ${child} — skipped`);
      continue;
    }
    if (parentOf.has(child)) {
      warnings.push(`topic ${child} has multiple parents — keeping first (${parentOf.get(child)}), ignoring ${parent}`);
      continue;
    }
    parentOf.set(child, parent);
    const siblings = childrenOf.get(parent) ?? [];
    siblings.push(child);
    childrenOf.set(parent, siblings);
  }

  const graph: RollupGraph = { nodes: nodeMap, parentOf, childrenOf };
  const cycleNode = findCycleNode(graph);
  if (cycleNode) {
    warnings.push(`topic_rollup cycle detected at "${cycleNode}" — degrading to a flat list`);
    return { graph, cyclic: true, warnings };
  }
  return { graph, cyclic: false, warnings };
}

/**
 * Return a topic id that lies on a parent-walk cycle, or null if acyclic. Walks
 * each node upward through `parentOf`; a node re-seen within a single walk is a
 * cycle. Bounded by the node count, so even a corrupt graph terminates.
 */
function findCycleNode(graph: RollupGraph): string | null {
  for (const start of graph.parentOf.keys()) {
    const seen = new Set<string>();
    let cur: string | undefined = start;
    while (cur !== undefined) {
      if (seen.has(cur)) return cur;
      seen.add(cur);
      cur = graph.parentOf.get(cur);
    }
  }
  return null;
}

// --- Breadcrumb (BEH-TOPICTREE-2: derived, not hardcoded) -------------------

/**
 * Ancestor path top → this node ("general safety › fire prevention › fireworks"),
 * derived purely from the rollup edges. Cycle-guarded: if a corrupt graph loops,
 * we stop at the repeat and return what we have rather than spin. Unknown ids
 * yield an empty path.
 */
export function breadcrumb(graph: RollupGraph, topicId: string): TopicNode[] {
  if (!graph.nodes.has(topicId)) return [];
  const path: TopicNode[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = topicId;
  while (cur !== undefined && graph.nodes.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    path.push(graph.nodes.get(cur)!);
    cur = graph.parentOf.get(cur);
  }
  return path.reverse();
}

// --- Rollup filter (BEH-TOPICTREE-1) ----------------------------------------

/**
 * All descendants of a topic (children, grandchildren, …), excluding itself, in
 * breadth-first order. Cycle-guarded by a visited set.
 */
export function descendants(graph: RollupGraph, topicId: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>([topicId]);
  const queue = [...(graph.childrenOf.get(topicId) ?? [])];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    queue.push(...(graph.childrenOf.get(id) ?? []));
  }
  return out;
}

/**
 * Filter-by-category WITH rollup (BEH-TOPICTREE-1): the topic itself + every
 * descendant. A parent (fire prevention) returns its subtree (incl. fireworks);
 * a leaf returns ONLY itself. Returns ids in tree order (self first, then BFS).
 */
export function rollupFilter(graph: RollupGraph, topicId: string): string[] {
  if (!graph.nodes.has(topicId)) return [];
  return [topicId, ...descendants(graph, topicId)];
}

/** Roots = nodes with no parent edge (the tops of each rollup chain). */
export function rootTopicIds(graph: RollupGraph): string[] {
  const roots: string[] = [];
  for (const id of graph.nodes.keys()) {
    if (!graph.parentOf.has(id)) roots.push(id);
  }
  return roots;
}

// --- Audited category move (BEH-TOPICTREE-3) --------------------------------

/** Provenance recorded for an audited re-home — the ONLY thing a move writes. */
export interface MoveProvenance {
  topicId: string;
  movedBy: string;
  movedAtUtc: string;
  fromParentTopicId: string | null;
  toParentTopicId: string | null;
}

export interface MoveRequest {
  topicId: string;
  /** New parent topic id, or null to promote the topic to a root. */
  toParentTopicId: string | null;
  movedBy: string;
  /** Injected ISO-8601 UTC stamp (clock injection keeps tests deterministic). */
  movedAtUtc: string;
}

export type MoveResult =
  | {
      ok: true;
      /** The new/updated typed edge (absent when promoting to a root). */
      edge: ConceptEdge | null;
      provenance: MoveProvenance;
      /** A fresh graph with the single parent pointer rewritten. */
      graph: RollupGraph;
    }
  | { ok: false; error: string };

/**
 * Re-home a topic under a new parent, audited. Validates existence and rejects
 * any move that would create a cycle (re-homing a node under itself or one of
 * its own descendants) — that protection is what keeps the tree renderable.
 *
 * On success it returns a NEW graph (the input is not mutated), the single new
 * typed edge, and a provenance record `{movedBy, movedAtUtc, fromParentTopicId,
 * toParentTopicId}`. No TopicNode — and nothing in the underlying agenda
 * items / statements / source trail — is touched: only the typed edge changes.
 */
export function applyMove(graph: RollupGraph, req: MoveRequest): MoveResult {
  const { topicId, toParentTopicId } = req;
  if (!graph.nodes.has(topicId)) return { ok: false, error: `unknown topic "${topicId}"` };
  if (toParentTopicId !== null && !graph.nodes.has(toParentTopicId)) {
    return { ok: false, error: `unknown target parent "${toParentTopicId}"` };
  }
  if (toParentTopicId === topicId) return { ok: false, error: 'cannot re-home a topic under itself' };

  const fromParentTopicId = graph.parentOf.get(topicId) ?? null;
  if (fromParentTopicId === toParentTopicId) {
    return { ok: false, error: 'topic already sits under that parent (no-op)' };
  }
  // Cycle guard: the new parent must not be the topic's own descendant.
  if (toParentTopicId !== null && descendants(graph, topicId).includes(toParentTopicId)) {
    return { ok: false, error: `move would create a cycle (${toParentTopicId} is a descendant of ${topicId})` };
  }

  const next = cloneGraph(graph);
  // Detach from old parent's child list.
  if (fromParentTopicId !== null) {
    const sibs = (next.childrenOf.get(fromParentTopicId) ?? []).filter((c) => c !== topicId);
    if (sibs.length) next.childrenOf.set(fromParentTopicId, sibs);
    else next.childrenOf.delete(fromParentTopicId);
  }
  // Attach to new parent (or promote to root when null).
  if (toParentTopicId === null) {
    next.parentOf.delete(topicId);
  } else {
    next.parentOf.set(topicId, toParentTopicId);
    next.childrenOf.set(toParentTopicId, [...(next.childrenOf.get(toParentTopicId) ?? []), topicId]);
  }

  const provenance: MoveProvenance = {
    topicId,
    movedBy: req.movedBy,
    movedAtUtc: req.movedAtUtc,
    fromParentTopicId,
    toParentTopicId,
  };
  const edge: ConceptEdge | null =
    toParentTopicId === null
      ? null
      : {
          edge_id: `${TOPIC_ROLLUP}:${topicId}->${toParentTopicId}`,
          edge_type: TOPIC_ROLLUP,
          from_node_id: topicId,
          from_node_type: 'topic',
          to_node_id: toParentTopicId,
          to_node_type: 'topic',
        };
  return { ok: true, edge, provenance, graph: next };
}

function cloneGraph(graph: RollupGraph): RollupGraph {
  const childrenOf = new Map<string, string[]>();
  for (const [k, v] of graph.childrenOf) childrenOf.set(k, [...v]);
  return {
    nodes: new Map(graph.nodes), // nodes are shared by REFERENCE — never rewritten
    parentOf: new Map(graph.parentOf),
    childrenOf,
  };
}

// --- Adapter: served nested tree → flat node/edge set -----------------------

/**
 * Flatten the backend `topic_tree` (already acyclic by construction) into the
 * flat `{nodes, edges}` this module operates on, DERIVING one child→parent
 * `topic_rollup` edge per nesting step. This is how the breadcrumb stays
 * "derived from edges, not hardcoded": even when the backend hands us a nested
 * tree, the frontend rebuilds the edge set and re-derives structure from it.
 */
export function flattenTopicTree(tree: TopicTreeNode, parentId: string | null = null): {
  nodes: TopicNode[];
  edges: ConceptEdge[];
} {
  const nodes: TopicNode[] = [tree.topic];
  const edges: ConceptEdge[] = [];
  if (parentId !== null) {
    edges.push({
      edge_id: `${TOPIC_ROLLUP}:${tree.topic.topic_id}->${parentId}`,
      edge_type: TOPIC_ROLLUP,
      from_node_id: tree.topic.topic_id,
      from_node_type: 'topic',
      to_node_id: parentId,
      to_node_type: 'topic',
    });
  }
  for (const child of tree.children) {
    const sub = flattenTopicTree(child, tree.topic.topic_id);
    nodes.push(...sub.nodes);
    edges.push(...sub.edges);
  }
  return { nodes, edges };
}

/** Convenience: build a rollup graph straight from a served `topic_tree`. */
export function graphFromResponse(topicTree: TopicTreeResponse): BuildResult {
  const { nodes, edges } = flattenTopicTree(topicTree.tree);
  return buildRollupGraph(nodes, edges);
}
