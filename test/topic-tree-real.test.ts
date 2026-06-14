// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderTopicTreeView } from '../src/ui/topic-tree-view';
import { graphFromResponse, rollupFilter, rootTopicIds, topicPrimaryLabel } from '../src/ui/topic-tree';
import { assertWebSafe } from '../src/data/web-safe';
import type { ReadApiResponse, TopicTreeResponse } from '../src/types/read-api';
// GOV-150: the REAL GOV-149 reviewer-internal concept-graph capture (4 topic
// nodes / 3 topic_rollup edges / 3 char-span aliases / 0 agenda threads). Proves
// /topics renders REAL data. Deep-nesting / agenda-thread / completeness logic
// stays on the SYNTHETIC concept-graph-demo.json (the flat real tree — root +
// leaf civic topics, 0 threads — cannot exercise those; GOV-149 Gate-1 accepted).
import realCapture from '../src/fixtures/concept-graph-real.json';

const CAPTURE = realCapture as unknown as ReadApiResponse;
const TOPIC_TREE = CAPTURE.topic_tree as TopicTreeResponse;

describe('GOV-150 real capture — provenance + honest shape', () => {
  it('is a real_capture (not synthetic) reproducible from GOV-149 serve', () => {
    const prov = (realCapture as unknown as { _provenance?: Record<string, unknown> })._provenance;
    expect(prov?.kind).toBe('real_capture');
    expect(String(prov?.reproduce ?? '')).toContain('read_api.py');
    expect(String(prov?.issue ?? '')).toBe('GOV-150');
  });

  it('carries the 6 real reviewer-internal records and the real topic tree', () => {
    expect(CAPTURE.scope).toBe('alpine');
    expect(CAPTURE.access).toBe('reviewer_internal');
    expect(CAPTURE.records?.length).toBe(6);
    // Real corpus ids — the GOV-146 promoted Alpine statements (not sample-stmt-*).
    expect(CAPTURE.records?.[0]?.statement_id).toMatch(/^alpine_local_corpus:/);
    expect(TOPIC_TREE.root.topic_id).toBe('topic:alpine:jurisdiction');
  });

  it('carries NO agenda thread — the real corpus supports 0 threads (honest empty)', () => {
    // Not fabricated from title similarity (GOV-149 Gate-1 deviation); the
    // agenda-thread surface keeps the labeled synthetic fixture instead.
    expect((CAPTURE as { agenda_thread?: unknown }).agenda_thread ?? null).toBeNull();
  });

  it('passes the frontend web-safe sweep (no raw/vault path, no forbidden key)', () => {
    expect(() => assertWebSafe(CAPTURE)).not.toThrow();
  });
});

describe('GOV-150 real capture — graph logic over the real tree', () => {
  it('builds an acyclic rollup graph straight from the real served tree', () => {
    const { graph, cyclic, warnings } = graphFromResponse(TOPIC_TREE);
    expect(cyclic).toBe(false);
    expect(warnings).toEqual([]);
    // Root + 3 real civic topics.
    expect(rootTopicIds(graph)).toEqual(['topic:alpine:jurisdiction']);
    expect(rollupFilter(graph, 'topic:alpine:jurisdiction').sort()).toEqual([
      'topic:alpine:budget-taxes',
      'topic:alpine:council-governance',
      'topic:alpine:jurisdiction',
      'topic:alpine:water-system',
    ]);
    // Each civic topic is a leaf (the real tree is depth-2).
    expect(rollupFilter(graph, 'topic:alpine:water-system')).toEqual(['topic:alpine:water-system']);
  });

  it('uses the human label as the primary label for every real topic', () => {
    const { graph } = graphFromResponse(TOPIC_TREE);
    const labels = [...graph.nodes.values()].map(topicPrimaryLabel).sort();
    expect(labels).toEqual([
      'Town Council governance',
      'Town budget and taxes',
      'Town of Alpine',
      'Town water system',
    ]);
  });
});

describe('GOV-150 real capture — renders the real /topics tree', () => {
  let root: HTMLElement;
  beforeEach(() => {
    document.head.replaceChildren();
    document.body.replaceChildren();
    root = document.createElement('div');
    document.body.append(root);
    renderTopicTreeView(root, TOPIC_TREE, { focusTopicId: 'topic:alpine:jurisdiction' });
  });

  it('renders one node per real topic with the human label primary', () => {
    const labels = [...root.querySelectorAll('[data-test="tt-node-label"]')].map((n) => n.textContent);
    expect(labels).toContain('Town of Alpine');
    expect(labels).toContain('Town water system');
    expect(labels).toContain('Town budget and taxes');
    expect(labels).toContain('Town Council governance');
    // The government source term is never a primary node label.
    expect(labels).not.toContain('Town Water System');
  });

  it('exposes the real government alias inspect-on-demand (collapsed, "source term:" prefix)', () => {
    const alias = root.querySelector('[data-topic-id="topic:alpine:water-system"] [data-test="tt-alias"]');
    expect(alias).not.toBeNull();
    expect((alias as HTMLDetailsElement).open).toBe(false);
    expect(
      root.querySelector('[data-topic-id="topic:alpine:water-system"] [data-test="tt-alias-term"]')?.textContent,
    ).toBe('source term: Town Water System');
    // Provenance intact: the alias keeps a source ref (no original URL on the
    // real char-span alias → falls back to a visible source id, never hidden).
    expect(
      root.querySelector('[data-topic-id="topic:alpine:water-system"] [data-test="tt-alias-source"]')?.textContent,
    ).toContain('alpine_local_corpus');
  });

  it('marks the focused jurisdiction-root rollup (root + all civic topics)', () => {
    const inRollup = (id: string) =>
      root.querySelector(`[data-test="tt-node"][data-topic-id="${id}"]`)?.getAttribute('data-in-rollup');
    expect(inRollup('topic:alpine:jurisdiction')).toBe('true');
    expect(inRollup('topic:alpine:water-system')).toBe('true');
    expect(inRollup('topic:alpine:budget-taxes')).toBe('true');
  });

  it('never paints a raw/local path into the DOM', () => {
    expect(root.textContent ?? '').not.toMatch(/\/Users\/|Obsidian Vault|transcript_path|\.sha256/);
  });
});
