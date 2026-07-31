/**
 * Deterministic document version compare (MOTY Source Vault / Newsletter).
 *
 * The diff is computed in code from two SUPPLIED strings — no model is involved,
 * which is why the design carries a "100% CODE — NO AI WAIT" chip. This module
 * decides nothing about provenance: the caller is responsible for the strings
 * being either backend-supplied or explicitly gated fixture text, and for
 * labelling their origin.
 */

import { GW_TOKENS } from './tokens';
import { safeExternalHref } from '../data/web-safe';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    // C8: a supplied URL is untrusted input. An unsafe scheme is REFUSED, not rendered —
    // the anchor keeps its text and simply has no href, so nothing is clickable and no
    // dead affordance is presented. See safeExternalHref in src/data/web-safe.ts.
    if (key === 'href' && safeExternalHref(value) === null) {
      node.setAttribute('data-href-refused', 'unsafe-scheme');
      continue;
    }
    node.setAttribute(key, value);
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

/**
 * **Deliberate one-word divergence from the baseline, recorded per GOV-82.** The MOTY
 * chip is a single span reading exactly `100% CODE — NO AI WAIT`
 * (`reference/Source Vault.dc.html`). We ship `100% CODE — NO AI`, dropping the trailing
 * word: "NO AI" is the honesty claim the chip exists to make, whereas a trailing "WAIT"
 * reads as an instruction to the user ("wait!") rather than as "no waiting for a model".
 * The claim is unchanged and no weaker; only the ambiguity is removed. Flagged to the
 * owner in the GOV-82 PR — if the baseline wording is preferred verbatim, change this one
 * constant and the assertion in `test/diff-view.test.ts`.
 */
export const DIFF_CODE_CHIP = '100% CODE — NO AI';

export type DiffOp = 'same' | 'added' | 'removed';

export interface DiffToken {
  op: DiffOp;
  text: string;
}

/**
 * Word-level diff via a longest-common-subsequence table.
 *
 * Deterministic and dependency-free: identical inputs always produce identical
 * output, which is what makes the result quotable as evidence.
 */
/**
 * C9 (iteration 47) — the word-level diff is a full LCS table: O(n x m) in time AND in
 * memory, allocating a (rows+1) x (cols+1) matrix. Measured on this machine:
 *
 *     4,000 words/side ->   536 ms   (64M cells)
 *     6,000 words/side ->  1.83 s   (144M cells)
 *     8,000 words/side ->  2.98 s   (256M cells)
 *    10,000 words/side ->  5.30 s   (400M cells)
 *
 * and several such diffs in one process exhausted the JS heap outright. A 10,000-word
 * pair freezes the main thread for over five seconds with no spinner and no way out —
 * and government minutes and packets, which is exactly what Source Vault compares,
 * routinely run past that.
 *
 * So the comparison is BOUNDED. Above the cap the panes still render side by side with
 * their full text — only the word-level highlighting is withheld, with a stated reason.
 * Degrade the feature, never the page. The cap is expressed in table CELLS because that,
 * not word count, is what drives both cost and allocation.
 */
export const DIFF_CELL_BUDGET = 6_000_000;

/** Token counts a diff would need, without building anything. */
export function diffCellCount(before: string, after: string): number {
  const a = before.split(/(\s+)/).filter((part) => part !== '').length;
  const b = after.split(/(\s+)/).filter((part) => part !== '').length;
  return (a + 1) * (b + 1);
}

export function diffWords(before: string, after: string): DiffToken[] {
  const a = before.split(/(\s+)/).filter((part) => part !== '');
  const b = after.split(/(\s+)/).filter((part) => part !== '');

  const rows = a.length;
  const cols = b.length;
  const table: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(cols + 1).fill(0));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const tokens: DiffToken[] = [];
  const push = (op: DiffOp, text: string): void => {
    const last = tokens[tokens.length - 1];
    if (last && last.op === op) last.text += text;
    else tokens.push({ op, text });
  };

  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (a[i] === b[j]) {
      push('same', a[i]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push('removed', a[i]);
      i += 1;
    } else {
      push('added', b[j]);
      j += 1;
    }
  }
  while (i < rows) {
    push('removed', a[i]);
    i += 1;
  }
  while (j < cols) {
    push('added', b[j]);
    j += 1;
  }
  return tokens;
}

export const DIFF_VIEW_STYLE = `${GW_TOKENS}
.gw-diff{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-3);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);background:var(--gw-surface);padding:var(--gw-space-4)}
.gw-diff-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--gw-space-3)}
.gw-diff-code-chip{border:var(--gw-border-w) solid var(--gw-tone-ok-line);border-radius:var(--gw-radius-sm);background:var(--gw-tone-ok-well);color:var(--gw-ok-text);padding:0 var(--gw-space-2);font:700 var(--gw-text-badge)/1.6 var(--gw-font-mono);letter-spacing:.05em}
.gw-diff-toggle{min-height:var(--gw-tap-min);border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius);background:transparent;color:var(--gw-text);padding:0 var(--gw-space-3);font-size:var(--gw-text-sm)}
.gw-diff-toggle[aria-pressed="true"]{background:var(--gw-surface-accent-tint);border-color:var(--gw-accent)}
.gw-diff-panes{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--gw-space-3)}
.gw-diff-pane{border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-md);background:var(--gw-surface-subtle);padding:var(--gw-space-3);display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-2);align-content:start}
.gw-diff-pane h4{margin:0;font:800 var(--gw-text-kicker)/1.3 var(--gw-font);letter-spacing:.08em;text-transform:uppercase;color:var(--gw-text-muted)}
.gw-diff-body{margin:0;white-space:pre-wrap;word-break:break-word;font-size:var(--gw-text-sm);line-height:var(--gw-leading);color:var(--gw-text)}
.gw-diff-body ins{background:var(--gw-tone-ok-well);color:var(--gw-ok-text);text-decoration:none;border-bottom:2px solid var(--gw-tone-ok-line)}
.gw-diff-body del{background:var(--gw-tone-stop-well);color:var(--gw-stop-text);border-bottom:2px solid var(--gw-tone-stop-line)}
.gw-diff-oversize{margin:0 0 var(--gw-space-2);font-size:var(--gw-text-sm);color:var(--gw-text-secondary)}
.gw-diff-key{display:flex;flex-wrap:wrap;gap:var(--gw-space-3);margin:0 0 var(--gw-space-2);font-size:var(--gw-text-badge);color:var(--gw-text-secondary)}
.gw-diff-key-item{display:inline-flex;align-items:center;gap:.3rem}
.gw-diff-legend{display:flex;flex-wrap:wrap;gap:var(--gw-space-3);margin:0;font-size:var(--gw-text-badge);color:var(--gw-text-muted)}
@media (max-width:720px){.gw-diff-panes{grid-template-columns:minmax(0,1fr)}}
`;

export function ensureDiffViewStyle(): void {
  if (document.getElementById('gw-diff-view-style')) return;
  document.head.append(el('style', { id: 'gw-diff-view-style' }, [DIFF_VIEW_STYLE]));
}

export interface DiffViewSpec {
  beforeLabel: string;
  afterLabel: string;
  before: string;
  after: string;
  /** Start with word-level highlighting on. Defaults to false (plain panes). */
  wordLevel?: boolean;
}

function renderPane(
  label: string,
  text: string,
  tokens: DiffToken[] | null,
  side: 'before' | 'after',
): HTMLElement {
  const body = el('p', { class: 'gw-diff-body', 'data-test': `diff-${side}-body` });
  if (!tokens) {
    body.textContent = text;
  } else {
    const drop: DiffOp = side === 'before' ? 'added' : 'removed';
    const mark = side === 'before' ? 'del' : 'ins';
    for (const token of tokens) {
      if (token.op === drop) continue;
      if (token.op === 'same') body.append(document.createTextNode(token.text));
      else body.append(el(mark, {}, [token.text]));
    }
  }
  return el('section', { class: 'gw-diff-pane', 'data-test': `diff-pane-${side}` }, [
    el('h4', {}, [label]),
    body,
  ]);
}

/** Side-by-side version compare with a word-level highlighting toggle. */
export function diffView(spec: DiffViewSpec): HTMLElement {
  ensureDiffViewStyle();
  // C9: refuse the expensive path rather than freezing the tab. See DIFF_CELL_BUDGET.
  const overBudget = diffCellCount(spec.before, spec.after) > DIFF_CELL_BUDGET;
  let wordLevel = spec.wordLevel === true && !overBudget;
  const tokens = overBudget ? [] : diffWords(spec.before, spec.after);

  const panes = el('div', { class: 'gw-diff-panes' });
  const paint = (): void => {
    panes.replaceChildren(
      renderPane(spec.beforeLabel, spec.before, wordLevel ? tokens : null, 'before'),
      renderPane(spec.afterLabel, spec.after, wordLevel ? tokens : null, 'after'),
    );
  };

  const toggle = el('button', {
    type: 'button',
    class: 'gw-diff-toggle',
    'data-test': 'diff-word-toggle',
    'aria-pressed': wordLevel ? 'true' : 'false',
    // Inert and explained when the comparison is too large — never a dead control (C7).
    ...(overBudget
      ? {
          disabled: '',
          title: 'This comparison is too large to highlight word by word in the browser. '
            + 'Both versions are shown in full.',
        }
      : {}),
  }, ['Word-level changes']);
  toggle.addEventListener('click', () => {
    wordLevel = !wordLevel;
    toggle.setAttribute('aria-pressed', wordLevel ? 'true' : 'false');
    paint();
  });

  paint();

  return el('section', { class: 'gw-diff', 'data-test': 'diff-view' }, [
    el('div', { class: 'gw-diff-head' }, [
      el('span', { class: 'gw-diff-code-chip', 'data-test': 'diff-code-chip' }, [DIFF_CODE_CHIP]),
      toggle,
    ]),
    panes,
    ...(overBudget
      ? [el('p', { class: 'gw-diff-oversize', 'data-test': 'diff-oversize-note' }, [
          'Both versions are shown in full. Word-level highlighting is withheld because this '
          + 'comparison is too large to compute in the browser without freezing the page.',
        ])]
      : []),
    el('p', { class: 'gw-diff-key', 'data-test': 'diff-key' }, [
      // Micro-detail rule 1: every state has text and label, never colour alone. The
      // <ins>/<del> tags already announce to assistive tech; this key is what a sighted
      // reader needs to know which highlight means what.
      el('span', { class: 'gw-diff-key-item' }, [el('ins', {}, ['Added']), ' text is added in the later version']),
      el('span', { class: 'gw-diff-key-item' }, [el('del', {}, ['Removed']), ' text is gone from the later version']),
    ]),
    el('p', { class: 'gw-diff-legend' }, [
      'Comparison is computed in code from the two stored versions. No model wrote, ranked, or summarised this difference.',
    ]),
  ]);
}
