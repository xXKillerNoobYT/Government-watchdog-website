// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { DIFF_CODE_CHIP, diffView, diffWords } from '../src/ui/diff-view';

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
    expect(view.querySelectorAll('ins, del')).toHaveLength(0);

    toggle?.click();
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    expect(view.querySelector('[data-test="diff-before-body"] del')?.textContent).toContain('waived');
    expect(view.querySelector('[data-test="diff-after-body"] ins')?.textContent).toContain('$150');

    toggle?.click();
    expect(view.querySelectorAll('ins, del')).toHaveLength(0);
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
