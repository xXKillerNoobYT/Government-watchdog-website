/**
 * Civic topic-tree VIEW (GOV-102, Slice 4·D). NEUTRAL styling only — no visual
 * commitments (Isaac's later pass may restyle above these floors). Its job is to
 * prove the tree, rollup filter, derived breadcrumb, human-label-first labels +
 * inspectable government alias, the cycle-safe flat degrade, and an audited
 * before/after move all render — not to be the final look.
 *
 * All graph decisions come from the pure `topic-tree.ts` module; this file only
 * builds nodes. When that module flags a cycle we render a FLAT list and a
 * visible warning (and console.warn) instead of a broken/infinite tree.
 */

import type { TopicTreeResponse, TopicNode } from '../types/read-api';
import {
  type RollupGraph,
  type MoveRequest,
  buildRollupGraph,
  flattenTopicTree,
  graphFromResponse,
  breadcrumb,
  rollupFilter,
  rootTopicIds,
  applyMove,
  topicPrimaryLabel,
  topicGovAlias,
  aliasInspectLabel,
} from './topic-tree';
import { GW_TOKENS, BADGE_MIN_FONT_PX } from './tokens';

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

export interface TopicTreeViewOptions {
  /** Topic to focus: drives the breadcrumb + the rollup-filter highlight. */
  focusTopicId?: string;
  /** When set, also render an audited before/after move + its provenance. */
  move?: MoveRequest;
  /** Test/override hook: feed a graph directly (e.g. a synthetic cyclic one). */
  graphOverride?: { graph: RollupGraph; cyclic: boolean; warnings: string[] };
}

/** A topic node label: human word primary + inspect-on-demand government alias. */
function topicLabel(node: TopicNode): HTMLElement {
  const children: (Node | string)[] = [
    el('span', { class: 'tt-label', 'data-test': 'tt-node-label' }, [topicPrimaryLabel(node)]),
  ];
  const alias = topicGovAlias(node);
  if (alias) {
    // Inspect-on-demand: collapsed <details> so the government term is never
    // primary, never hidden. Source ref kept alongside (provenance intact).
    const ref = alias.sourceRef;
    const refLine =
      ref.originalUrl
        ? el('a', { href: ref.originalUrl, target: '_blank', rel: 'noopener', class: 'tt-alias-src', 'data-test': 'tt-alias-source' }, ['view source term in original'])
        : el('span', { class: 'tt-alias-src gw-muted', 'data-test': 'tt-alias-source' }, [`source id: ${ref.sourceId ?? 'n/a'}`]);
    children.push(
      el('details', { class: 'tt-alias', 'data-test': 'tt-alias' }, [
        el('summary', { 'data-test': 'tt-alias-summary' }, ['gov term']),
        el('div', { class: 'tt-alias-body' }, [
          el('span', { 'data-test': 'tt-alias-term' }, [aliasInspectLabel(alias)]),
          refLine,
        ]),
      ]),
    );
  }
  return el('span', { class: 'tt-node-head' }, children);
}

/** Render the nested tree from the rollup graph, marking the rollup subtree. */
function treeList(graph: RollupGraph, rootIds: string[], inRollup: Set<string>): HTMLElement {
  const ul = el('ul', { class: 'tt-tree', 'data-test': 'tt-tree' });
  for (const id of rootIds) ul.append(treeNode(graph, id, inRollup));
  return ul;
}

function treeNode(graph: RollupGraph, id: string, inRollup: Set<string>): HTMLElement {
  const node = graph.nodes.get(id)!;
  const li = el('li', {
    class: 'tt-item',
    'data-test': 'tt-node',
    'data-topic-id': id,
    'data-in-rollup': String(inRollup.has(id)),
  }, [topicLabel(node)]);
  const kids = graph.childrenOf.get(id) ?? [];
  if (kids.length) {
    const sub = el('ul', { class: 'tt-children' });
    for (const k of kids) sub.append(treeNode(graph, k, inRollup));
    li.append(sub);
  }
  return li;
}

/** Cycle-safe degrade: a flat, un-nested list of every node + a visible warning. */
function flatList(graph: RollupGraph, warnings: string[]): HTMLElement {
  const section = el('section', { class: 'tt-degraded', 'data-test': 'tt-flat' }, [
    el('p', { class: 'tt-warning', role: 'alert', 'data-test': 'tt-cycle-warning' }, [
      '⚠ Topic tree could not be drawn (a category loop was detected). Showing a flat list instead.',
    ]),
  ]);
  for (const w of warnings) section.append(el('p', { class: 'gw-muted tt-warn-detail' }, [w]));
  const ul = el('ul', { class: 'tt-flat-list' });
  for (const node of graph.nodes.values()) {
    ul.append(el('li', { 'data-test': 'tt-node', 'data-topic-id': node.topic_id }, [topicLabel(node)]));
  }
  section.append(ul);
  return section;
}

/** Breadcrumb "general safety › fire prevention › fireworks" — derived from edges. */
function breadcrumbBar(graph: RollupGraph, focusId: string): HTMLElement {
  const path = breadcrumb(graph, focusId);
  const parts: (Node | string)[] = [];
  path.forEach((node, i) => {
    if (i > 0) parts.push(el('span', { class: 'tt-crumb-sep', 'aria-hidden': 'true' }, [' › ']));
    parts.push(el('span', { class: 'tt-crumb', 'data-test': 'tt-crumb' }, [topicPrimaryLabel(node)]));
  });
  return el('nav', { class: 'tt-breadcrumb', 'data-test': 'tt-breadcrumb', 'aria-label': 'Where this sits' }, parts);
}

/** Provenance record for an audited move — the only thing a move writes. */
function moveBlock(graph: RollupGraph, req: MoveRequest): HTMLElement {
  const result = applyMove(graph, req);
  const before = el('div', { class: 'tt-move-col' }, [
    el('h4', {}, ['Before']),
    treeList(graph, rootTopicIds(graph), new Set()),
  ]);

  if (!result.ok) {
    return el('section', { class: 'tt-move', 'data-test': 'tt-move' }, [
      el('h3', {}, ['Audited category move']),
      el('p', { class: 'tt-warning', role: 'alert', 'data-test': 'tt-move-rejected' }, [`Move rejected: ${result.error}`]),
      before,
    ]);
  }

  const p = result.provenance;
  const provenance = el('dl', { class: 'tt-provenance', 'data-test': 'tt-move-provenance' }, [
    el('div', { class: 'gw-field' }, [el('dt', {}, ['moved by']), el('dd', { 'data-test': 'tt-prov-movedBy' }, [p.movedBy])]),
    el('div', { class: 'gw-field' }, [el('dt', {}, ['moved at (UTC)']), el('dd', { 'data-test': 'tt-prov-movedAt' }, [p.movedAtUtc])]),
    el('div', { class: 'gw-field' }, [el('dt', {}, ['from parent']), el('dd', { 'data-test': 'tt-prov-from' }, [p.fromParentTopicId ?? '(root)'])]),
    el('div', { class: 'gw-field' }, [el('dt', {}, ['to parent']), el('dd', { 'data-test': 'tt-prov-to' }, [p.toParentTopicId ?? '(root)'])]),
  ]);
  const after = el('div', { class: 'tt-move-col' }, [
    el('h4', {}, ['After']),
    treeList(result.graph, rootTopicIds(result.graph), new Set()),
  ]);
  return el('section', { class: 'tt-move', 'data-test': 'tt-move' }, [
    el('h3', {}, ['Audited category move']),
    el('p', { class: 'gw-muted' }, ['Only the typed rollup edge changes — agenda items, statements, and the source trail are untouched.']),
    el('div', { class: 'tt-move-cols' }, [before, after]),
    provenance,
  ]);
}

const STYLE_ID = 'gw-topic-tree-style';
/** Exported so a unit test can assert the chip/tap floors are honoured. */
export const TREE_STYLE = `${GW_TOKENS}
.tt-wrap{margin:var(--gw-space-5) 0}
.tt-breadcrumb{font-size:.9rem;color:var(--gw-text-secondary);margin:var(--gw-space-3) 0;font-weight:600}
.tt-crumb-sep{color:var(--gw-text-muted)}
.tt-tree,.tt-children,.tt-flat-list{list-style:none;margin:.2rem 0;padding-left:var(--gw-space-5)}
.tt-tree{padding-left:0}
.tt-item{margin:var(--gw-space-1) 0;border-left:2px solid var(--gw-border);padding-left:var(--gw-space-3)}
.tt-item[data-in-rollup="true"]>.tt-node-head{background:var(--gw-surface-accent-tint);border-radius:var(--gw-radius-sm)}
.tt-node-head{display:inline-flex;align-items:center;gap:var(--gw-space-2);flex-wrap:wrap;padding:.1rem .3rem}
.tt-label{font-weight:600;font-size:${Math.max(BADGE_MIN_FONT_PX, 14)}px}
.tt-alias{display:inline-block}
.tt-alias summary{cursor:pointer;font-size:var(--gw-text-badge);color:var(--gw-accent);border:var(--gw-border-w) solid var(--gw-accent);border-radius:var(--gw-radius-pill);padding:.05rem .5rem;min-height:var(--gw-tap-min);box-sizing:border-box;display:inline-flex;align-items:center;list-style:none}
.tt-alias summary::-webkit-details-marker{display:none}
.tt-alias-body{font-size:var(--gw-text-sm);color:var(--gw-text-secondary);margin:.2rem 0 .2rem .3rem;display:flex;flex-direction:column;gap:.1rem}
.tt-alias-src{font-size:.75rem}
.tt-chips{display:flex;gap:var(--gw-space-2);flex-wrap:wrap;margin:var(--gw-space-3) 0}
.tt-chip{font-size:var(--gw-text-badge);border:var(--gw-border-w) solid var(--gw-accent);color:var(--gw-accent);background:var(--gw-surface);border-radius:var(--gw-radius-pill);padding:.2rem var(--gw-space-3);min-height:var(--gw-tap-min);box-sizing:border-box;display:inline-flex;align-items:center;text-decoration:none}
.tt-chip[aria-current="true"]{background:var(--gw-accent);color:var(--gw-accent-text-on)}
.tt-rollup-result{font-size:.85rem;color:var(--gw-text-secondary);margin:var(--gw-space-1) 0}
.tt-degraded{border:var(--gw-border-w) solid var(--gw-stop-border);border-radius:var(--gw-radius);padding:var(--gw-space-3);background:var(--gw-stop-bg)}
.tt-warning{color:var(--gw-stop-text);font-weight:700;margin:.2rem 0}
.tt-warn-detail{font-size:.75rem;margin:.1rem 0}
.tt-move-cols{display:flex;gap:1.5rem;flex-wrap:wrap}
.tt-move-col{flex:1;min-width:12rem}
.tt-provenance{border:var(--gw-border-w) solid var(--gw-ok-text);border-radius:var(--gw-radius-sm);padding:var(--gw-space-3);background:var(--gw-ok-bg-soft);margin-top:var(--gw-space-3)}
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = el('style', {}); style.id = STYLE_ID; style.append(TREE_STYLE);
  document.head.append(style);
}

/**
 * Render the topic-tree surface into `container`. Pure consumer of the pure
 * graph module: tree (or flat degrade) + derived breadcrumb + rollup filter
 * chips/result + (optional) audited move. Returns nothing; mutates `container`.
 */
export function renderTopicTreeView(
  container: HTMLElement,
  topicTree: TopicTreeResponse,
  opts: TopicTreeViewOptions = {},
): void {
  ensureStyle();
  container.replaceChildren();

  const built = opts.graphOverride ?? graphFromResponse(topicTree);
  const { graph, cyclic, warnings } = built;

  container.append(el('h2', { class: 'tt-title' }, ['Civic topic tree']));
  container.append(el('p', { class: 'gw-muted' }, ['Reviewer-internal — categories shown in everyday words; the government source term is inspectable on each node.']));

  if (cyclic) {
    for (const w of warnings) console.warn(`[topic-tree] ${w}`);
    container.append(flatList(graph, warnings));
    return; // never render a broken/infinite tree
  }

  const roots = rootTopicIds(graph);
  const focusId = opts.focusTopicId && graph.nodes.has(opts.focusTopicId) ? opts.focusTopicId : undefined;
  const inRollup = focusId ? new Set(rollupFilter(graph, focusId)) : new Set<string>();

  // Category filter chips — one per topic, human label primary. The focused
  // chip marks aria-current and drives the rollup highlight + result list.
  const chips = el('nav', { class: 'tt-chips', 'data-test': 'tt-chips', 'aria-label': 'Filter by category' });
  for (const node of graph.nodes.values()) {
    const isFocus = node.topic_id === focusId;
    chips.append(
      el('a', {
        class: 'tt-chip',
        'data-test': 'tt-chip',
        'data-topic-id': node.topic_id,
        href: `#/topics?topic=${encodeURIComponent(node.topic_id)}`,
        ...(isFocus ? { 'aria-current': 'true' } : {}),
      }, [topicPrimaryLabel(node)]),
    );
  }
  container.append(chips);

  if (focusId) {
    container.append(breadcrumbBar(graph, focusId));
    const ids = rollupFilter(graph, focusId);
    const labels = ids.map((id) => topicPrimaryLabel(graph.nodes.get(id)!));
    const isLeaf = ids.length === 1;
    container.append(
      el('p', { class: 'tt-rollup-result', 'data-test': 'tt-rollup-result', 'data-count': String(ids.length) }, [
        isLeaf
          ? `Leaf category "${labels[0]}" — returns only itself.`
          : `Rollup of "${labels[0]}" → ${ids.length} categories: ${labels.join(', ')}.`,
      ]),
    );
  }

  container.append(treeList(graph, roots, inRollup));

  if (opts.move) container.append(moveBlock(graph, opts.move));
}

/** Convenience for tests/screenshots: build a graph from a raw flat tree node. */
export { buildRollupGraph, flattenTopicTree };
