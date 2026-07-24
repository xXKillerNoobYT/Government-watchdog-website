/**
 * COMING SOON primitives (MOTY full-application pass).
 *
 * A Coming Soon marker names a product FEATURE that is not built in any lane
 * yet (search, alert delivery, payments, the explainer video). It is
 * deliberately distinct from the honest-empty / designed-gap copy used when
 * reviewed civic DATA is missing: a gap describes an information slot awaiting
 * a reviewed contract; Coming Soon describes functionality that does not
 * exist. Never use these markers in place of a data gap.
 */

import { GW_TOKENS } from './tokens';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export const COMING_SOON_LABEL = 'COMING SOON';

export const COMING_SOON_STYLE = `${GW_TOKENS}
.gw-coming-soon-chip{display:inline-flex;align-items:center;gap:var(--gw-space-2);border:var(--gw-border-w) solid var(--gw-caution-line);border-radius:var(--gw-radius-pill);background:var(--gw-caution-bg);padding:var(--gw-space-1) var(--gw-space-3);font-size:var(--gw-text-badge);line-height:1.3}
.gw-coming-soon-chip strong{color:var(--gw-caution-text);font:700 var(--gw-text-badge)/1.3 var(--gw-font-mono);letter-spacing:.05em}
.gw-coming-soon-chip span{color:var(--gw-text-secondary)}
.gw-coming-soon-note{border:var(--gw-border-w) dashed var(--gw-caution-line);border-radius:var(--gw-radius-md);background:var(--gw-caution-bg);padding:var(--gw-space-4);display:grid;gap:var(--gw-space-2);justify-items:start}
.gw-coming-soon-note strong{color:var(--gw-caution-text);font:700 var(--gw-text-badge)/1.3 var(--gw-font-mono);letter-spacing:.06em}
.gw-coming-soon-note h3{font-size:var(--gw-text-lg);color:var(--gw-text)}
.gw-coming-soon-note p{margin:0;color:var(--gw-text-secondary);max-width:60ch}
`;

export function ensureComingSoonStyle(): void {
  if (document.getElementById('gw-coming-soon-style')) return;
  document.head.append(el('style', { id: 'gw-coming-soon-style' }, [COMING_SOON_STYLE]));
}

/** Inline pill for a not-yet-built feature, e.g. next to a disabled control. */
export function comingSoonChip(feature: string): HTMLElement {
  ensureComingSoonStyle();
  return el('span', { class: 'gw-coming-soon-chip', 'data-test': 'coming-soon-chip' }, [
    el('strong', {}, [COMING_SOON_LABEL]),
    el('span', {}, [feature]),
  ]);
}

/** Block card for a not-yet-built feature that owns a whole designed slot. */
export function comingSoonNote(feature: string, detail: string): HTMLElement {
  ensureComingSoonStyle();
  return el('section', { class: 'gw-coming-soon-note', 'data-test': 'coming-soon-note' }, [
    el('strong', {}, [COMING_SOON_LABEL]),
    el('h3', {}, [feature]),
    el('p', {}, [detail]),
  ]);
}
