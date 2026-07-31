// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { DIFF_CODE_CHIP, diffView, diffWords, ensureDiffViewStyle } from '../src/ui/diff-view';

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('diffWords', () => {
  it('marks unchanged, added, and removed words', () => {
    const tokens = diffWords('the fee is waived', 'the fee is $150');
    expect(tokens.filter((t) => t.op === 'same').map((t) => t.text).join('')).toContain('the fee is');
    expect(tokens.filter((t) => t.op === 'removed').map((t) => t.text).join('')).toContain('waived');
    expect(tokens.filter((t) => t.op === 'added').map((t) => t.text).join('')).toContain('$150');
  });

  it('is deterministic for identical inputs', () => {
    const a = diffWords('agenda item four', 'agenda item five');
    const b = diffWords('agenda item four', 'agenda item five');
    expect(a).toEqual(b);
  });

  it('reports no changes for identical documents', () => {
    const tokens = diffWords('same text here', 'same text here');
    expect(tokens.every((t) => t.op === 'same')).toBe(true);
  });

  it('handles empty sides without throwing', () => {
    expect(diffWords('', 'new content').every((t) => t.op === 'added')).toBe(true);
    expect(diffWords('old content', '').every((t) => t.op === 'removed')).toBe(true);
    expect(diffWords('', '')).toEqual([]);
  });

  it('reconstructs each side exactly from its tokens', () => {
    const before = 'the packet adds a $150 administrative fee';
    const after = 'the packet adds a $250 administrative processing fee';
    const tokens = diffWords(before, after);
    const rebuiltBefore = tokens.filter((t) => t.op !== 'added').map((t) => t.text).join('');
    const rebuiltAfter = tokens.filter((t) => t.op !== 'removed').map((t) => t.text).join('');
    expect(rebuiltBefore).toBe(before);
    expect(rebuiltAfter).toBe(after);
  });
});

describe('diffView', () => {
  const spec = {
    beforeLabel: 'Version 1 — Jul 7',
    afterLabel: 'Version 2 — Jul 21',
    before: 'the fee is waived',
    after: 'the fee is $150',
  };

  it('renders both panes with their labels', () => {
    const view = diffView(spec);
    expect(view.querySelector('[data-test="diff-pane-before"]')?.textContent).toContain('Version 1 — Jul 7');
    expect(view.querySelector('[data-test="diff-pane-after"]')?.textContent).toContain('Version 2 — Jul 21');
  });

  it('states that the comparison is code-computed, not model-written', () => {
    const view = diffView(spec);
    expect(view.querySelector('[data-test="diff-code-chip"]')?.textContent).toBe(DIFF_CODE_CHIP);
    expect(view.textContent).toContain('No model wrote, ranked, or summarised this difference.');
  });

  it('starts plain and adds word-level marks when toggled', () => {
    const view = diffView(spec);
    const toggle = view.querySelector<HTMLButtonElement>('[data-test="diff-word-toggle"]');
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
    // Scoped to the PANES (GOV-82). This was `view.querySelectorAll('ins, del')`, which
    // worked only while nothing else in the view used those tags. The added/removed key
    // now uses real <ins>/<del> so it matches the marks it explains, and a key entry is
    // not a word-level mark. `.gw-diff-body` is exactly what the assertion means.
    expect(view.querySelectorAll('.gw-diff-body ins, .gw-diff-body del')).toHaveLength(0);

    toggle?.click();
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    expect(view.querySelector('[data-test="diff-before-body"] del')?.textContent).toContain('waived');
    expect(view.querySelector('[data-test="diff-after-body"] ins')?.textContent).toContain('$150');

    toggle?.click();
    expect(view.querySelectorAll('.gw-diff-body ins, .gw-diff-body del')).toHaveLength(0);
  });

  it('honours an initial word-level preference', () => {
    const view = diffView({ ...spec, wordLevel: true });
    expect(view.querySelector<HTMLButtonElement>('[data-test="diff-word-toggle"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(view.querySelectorAll('ins, del').length).toBeGreaterThan(0);
  });

  it('never shows additions in the before pane or removals in the after pane', () => {
    const view = diffView({ ...spec, wordLevel: true });
    expect(view.querySelectorAll('[data-test="diff-before-body"] ins')).toHaveLength(0);
    expect(view.querySelectorAll('[data-test="diff-after-body"] del')).toHaveLength(0);
  });
});

// C4 (iteration 43) — found by mutation sweep: neutralising `ensureDiffViewStyle` to a
// no-op broke ZERO tests across the whole pages-civic suite. The diff would have rendered
// completely unstyled and every check stayed green. Its idempotency early-return was also
// never exercised.
describe('ensureDiffViewStyle', () => {
  it('injects the stylesheet exactly once, however many times it is called', () => {
    document.head.querySelectorAll('#gw-diff-view-style').forEach((n) => n.remove());
    expect(document.getElementById('gw-diff-view-style')).toBeNull();

    ensureDiffViewStyle();
    const style = document.getElementById('gw-diff-view-style');
    expect(style).not.toBeNull();
    expect(style?.tagName).toBe('STYLE');
    expect(style?.textContent).toContain('.gw-diff');

    // The early-return branch: repeated calls must not stack duplicate <style> nodes.
    for (let i = 0; i < 50; i += 1) ensureDiffViewStyle();
    expect(document.querySelectorAll('#gw-diff-view-style')).toHaveLength(1);
    expect(document.getElementById('gw-diff-view-style')).toBe(style);
  });

  it('is called by diffView, so a rendered diff is never unstyled', () => {
    document.head.querySelectorAll('#gw-diff-view-style').forEach((n) => n.remove());
    diffView({ beforeLabel: 'v1', afterLabel: 'v2', before: 'a b', after: 'a c' });
    expect(document.getElementById('gw-diff-view-style')).not.toBeNull();
  });
});
