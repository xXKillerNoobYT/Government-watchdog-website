// C7 (iteration 44) — UI polish, re-bound from the WiredPart iOS scanner to this web
// surface. Scanner 2 of usability-enforcer: "every button does something, no empty
// handlers".
//
// The rule it enforces is the design inventory's micro-detail rule 5: *"Buttons either
// work, lead to an available route, or are not rendered. Disabled future features must
// say why."* An ENABLED button with no handler is the violation — it presents an
// affordance that does nothing, and with `aria-pressed` it also announces a toggle state
// to assistive tech that cannot be operated.
//
// This is a SOURCE audit (`?raw`), matching the existing convention in
// test/gov462-newsletter-digest.test.ts, because a bound handler is not introspectable
// from the DOM. The tsconfig carries no @types/node, so no fs is used.
import { describe, it, expect } from 'vitest';

const sources = import.meta.glob('../src/ui/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Attributes bound elsewhere by a delegated listener, with where that binding lives. */
const DELEGATED_ATTRS: readonly string[] = ['data-modal-close'];

/** Balanced-brace read. A naive /\{.*?\}/ stops at the `}` inside a `${...}` template. */
function attrsBlock(s: string, open: number): string {
  let depth = 0;
  for (let j = open; j < s.length; j += 1) {
    if (s[j] === '{') depth += 1;
    else if (s[j] === '}') {
      depth -= 1;
      if (depth === 0) return s.slice(open, j + 1);
    }
  }
  return s.slice(open);
}

function deadButtons(path: string, src: string): string[] {
  const out: string[] = [];
  const re = /el\('button',\s*/g;
  let m = re.exec(src);
  while (m !== null) {
    const open = m.index + m[0].length;
    if (src[open] === '{') {
      const attrs = attrsBlock(src, open);
      const inert = attrs.includes('disabled')
        || DELEGATED_ATTRS.some((a) => attrs.includes(a))
        || /type:\s*'submit'/.test(attrs);
      if (!inert) {
        const seg = src.slice(m.index, m.index + 1600);
        const before = src.slice(Math.max(0, m.index - 200), m.index);
        const varName = /(?:const|let)\s+([A-Za-z0-9_]+)\s*(?::[^=]+)?=\s*$/.exec(before)?.[1];
        // Three real binding patterns exist in this codebase, and a guard that models
        // only the first reports working code as dead:
        //   1. handler attached inside the same construction expression;
        //   2. assigned to a const, bound later by that name;
        //   3. built inline, retrieved afterwards by selector, then bound —
        //      e.g. `const closeButton = panel.querySelector('.gw-info-close')!`
        //      … `closeButton.addEventListener(...)` (src/ui/info-note.ts).
        const selectorBound = (): boolean => {
          const tokens = [
            ...(/class:\s*'([^']+)'/.exec(attrs)?.[1] ?? '').split(/\s+/).filter(Boolean),
            ...(/'data-test':\s*'([^']+)'/.exec(attrs)?.[1] ?? '').split(/\s+/).filter(Boolean),
          ];
          return tokens.some((tok) => {
            const q = new RegExp(
              `(?:const|let)\\s+([A-Za-z0-9_]+)[^=]*=\\s*[^;]*querySelector[^;]*${tok}[^;]*;`,
            ).exec(src);
            return q !== null && src.includes(`${q[1]}.addEventListener`);
          });
        };
        const bound = seg.includes('addEventListener')
          || (varName !== undefined && src.includes(`${varName}.addEventListener`))
          || selectorBound();
        if (!bound) {
          const line = src.slice(0, m.index).split('\n').length;
          out.push(`${path}:${line}`);
        }
      }
    }
    m = re.exec(src);
  }
  return out;
}

describe('C7 — no enabled button without an action', () => {
  it('scans a non-empty set of UI modules', () => {
    // Guard the derivation: if the glob stops matching, the sweep silently passes.
    expect(Object.keys(sources).length).toBeGreaterThan(10);
  });

  it('finds no enabled button that has no handler and no delegated binding', () => {
    const dead = Object.entries(sources).flatMap(([path, src]) => deadButtons(path, src));
    expect(dead, `enabled buttons with no action:\n${dead.join('\n')}`).toEqual([]);
  });

  it('detects a planted dead button, so the sweep is not vacuous', () => {
    const planted = "el('button', { type: 'button', class: 'x' }, ['Click me'])";
    expect(deadButtons('planted.ts', planted)).toHaveLength(1);
    // …and does not flag the legitimate inert forms.
    expect(deadButtons('a.ts', "el('button', { type: 'button', disabled: '' }, ['x'])")).toHaveLength(0);
    expect(deadButtons('b.ts', "el('button', { 'data-modal-close': '' }, ['x'])")).toHaveLength(0);
    const wired = "const b = el('button', { type: 'button' }, ['x']);\nb.addEventListener('click', () => {});";
    expect(deadButtons('c.ts', wired)).toHaveLength(0);
  });
});
