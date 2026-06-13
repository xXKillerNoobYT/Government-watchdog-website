// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderTopicTreeView, TREE_STYLE } from '../src/ui/topic-tree-view';
import { buildRollupGraph, TOPIC_ROLLUP } from '../src/ui/topic-tree';
import { BADGE_MIN_FONT_PX, DRAWER_TAP_MIN_PX } from '../src/ui/render';
import type { TopicTreeResponse, TopicNode, ConceptEdge } from '../src/types/read-api';
// GOV-129: graph-logic coverage runs on the labeled SYNTHETIC concept-graph demo
// (the real reviewed corpus has 0 topics/0 threads, so it cannot exercise this).
import fixture from '../src/fixtures/concept-graph-demo.json';

const TOPIC_TREE = (fixture as unknown as { topic_tree: TopicTreeResponse }).topic_tree;

let root: HTMLElement;
beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
});

describe('topic-tree view — nested tree + human-label-first nodes', () => {
  beforeEach(() => renderTopicTreeView(root, TOPIC_TREE, { focusTopicId: 'topic:fire' }));

  it('renders one node per topic with the human label as the primary text', () => {
    const labels = [...root.querySelectorAll('[data-test="tt-node-label"]')].map((n) => n.textContent);
    expect(labels).toContain('general safety');
    expect(labels).toContain('fire prevention');
    expect(labels).toContain('fireworks');
    // The government term is NOT a primary node label.
    expect(labels).not.toContain('consumer pyrotechnics');
  });

  it('exposes the government alias only on demand (collapsed details, "source term:" prefix)', () => {
    const alias = root.querySelector('[data-topic-id="topic:fireworks"] [data-test="tt-alias"]');
    expect(alias).not.toBeNull();
    expect((alias as HTMLDetailsElement).open).toBe(false); // inspect-on-demand, never primary
    expect(root.querySelector('[data-topic-id="topic:fireworks"] [data-test="tt-alias-term"]')?.textContent).toBe('source term: consumer pyrotechnics');
    // Provenance intact: a link/ref to the source term's original location exists.
    expect(root.querySelector('[data-topic-id="topic:fireworks"] [data-test="tt-alias-source"]')).not.toBeNull();
  });

  it('marks the rollup subtree of the focused category and leaves the rest unmarked', () => {
    const inRollup = (id: string) => root.querySelector(`[data-test="tt-node"][data-topic-id="${id}"]`)?.getAttribute('data-in-rollup');
    expect(inRollup('topic:fire')).toBe('true');
    expect(inRollup('topic:fireworks')).toBe('true'); // descendant rolls up
    expect(inRollup('topic:safety')).toBe('false'); // ancestor is NOT in the rollup
  });
});

describe('topic-tree view — derived breadcrumb + rollup result copy', () => {
  it('renders the derived breadcrumb path for the focused leaf', () => {
    renderTopicTreeView(root, TOPIC_TREE, { focusTopicId: 'topic:fireworks' });
    const crumbs = [...root.querySelectorAll('[data-test="tt-crumb"]')].map((n) => n.textContent);
    expect(crumbs).toEqual(['general safety', 'fire prevention', 'fireworks']);
  });

  it('describes a parent rollup as multi-category and a leaf as itself only', () => {
    renderTopicTreeView(root, TOPIC_TREE, { focusTopicId: 'topic:fire' });
    expect(root.querySelector('[data-test="tt-rollup-result"]')?.getAttribute('data-count')).toBe('2');
    expect(root.querySelector('[data-test="tt-rollup-result"]')?.textContent).toContain('fire prevention');

    renderTopicTreeView(root, TOPIC_TREE, { focusTopicId: 'topic:fireworks' });
    const leaf = root.querySelector('[data-test="tt-rollup-result"]');
    expect(leaf?.getAttribute('data-count')).toBe('1');
    expect(leaf?.textContent).toContain('returns only itself');
  });
});

describe('topic-tree view — audited move shows before/after + provenance, no record rewrite', () => {
  beforeEach(() =>
    renderTopicTreeView(root, TOPIC_TREE, {
      focusTopicId: 'topic:fire',
      move: { topicId: 'topic:fireworks', toParentTopicId: 'topic:safety', movedBy: 'reviewer:demo', movedAtUtc: '2026-06-09T00:00:00Z' },
    }),
  );

  it('records {movedBy, movedAtUtc, fromParent, toParent} in the provenance block', () => {
    expect(root.querySelector('[data-test="tt-prov-movedBy"]')?.textContent).toBe('reviewer:demo');
    expect(root.querySelector('[data-test="tt-prov-movedAt"]')?.textContent).toBe('2026-06-09T00:00:00Z');
    expect(root.querySelector('[data-test="tt-prov-from"]')?.textContent).toBe('topic:fire');
    expect(root.querySelector('[data-test="tt-prov-to"]')?.textContent).toBe('topic:safety');
  });

  it('renders a before AND an after tree (the move is auditable visually)', () => {
    expect(root.querySelectorAll('[data-test="tt-move"] .tt-move-col').length).toBe(2);
  });
});

describe('topic-tree view — BEH-TOPICTREE-4 cycle degrade (flat list + warning, never broken tree)', () => {
  it('renders a flat list + an alert warning and logs a console warning, not a nested tree', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const nodes: TopicNode[] = ['a', 'b', 'c'].map((id) => ({ topic_id: id, name: id, canonicalHumanLabel: id, sourceAliases: [] }));
    const cyclicEdges: ConceptEdge[] = [
      { edge_type: TOPIC_ROLLUP, from_node_id: 'a', to_node_id: 'b' },
      { edge_type: TOPIC_ROLLUP, from_node_id: 'b', to_node_id: 'c' },
      { edge_type: TOPIC_ROLLUP, from_node_id: 'c', to_node_id: 'a' },
    ];
    const override = buildRollupGraph(nodes, cyclicEdges);
    renderTopicTreeView(root, TOPIC_TREE, { graphOverride: override });

    expect(root.querySelector('[data-test="tt-flat"]')).not.toBeNull();
    expect(root.querySelector('[data-test="tt-cycle-warning"]')?.getAttribute('role')).toBe('alert');
    expect(root.querySelector('[data-test="tt-tree"]')).toBeNull(); // no nested tree
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('topic-tree view — safety + legibility floors', () => {
  it('never paints a raw/local path into the DOM', () => {
    renderTopicTreeView(root, TOPIC_TREE, { focusTopicId: 'topic:fireworks' });
    expect(root.textContent ?? '').not.toMatch(/\/Users\/|Obsidian Vault|transcript_path|\.sha256/);
  });

  it('honours the badge-font and tap-target floors in the tree stylesheet', () => {
    expect(TREE_STYLE).toContain(`font-size:${BADGE_MIN_FONT_PX}px`);
    expect(TREE_STYLE).toContain(`min-height:${DRAWER_TAP_MIN_PX}px`);
  });
});
