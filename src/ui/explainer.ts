/**
 * Explainer video route — an unbuilt feature, stated plainly.
 *
 * The design handoff ships a looping promo animation as a concept reference
 * built on a prototyping runtime that is not portable to this app. Rather than
 * port a throwaway animation engine, the route holds the designed slot and says
 * the video does not exist yet.
 *
 * This is a FEATURE gap, not a data gap: nothing here waits on a reviewed civic
 * contract, so it carries a Coming Soon note rather than designed-gap copy.
 */

import { comingSoonNote } from './coming-soon';
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

export const EXPLAINER_STYLE = `${GW_TOKENS}
.gw-explainer{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-4);max-width:52rem;margin:0 auto;padding:var(--gw-space-6) var(--gw-space-4);color:var(--gw-text);font-family:var(--gw-font)}
.gw-explainer h1{font-size:var(--gw-text-display);line-height:var(--gw-leading-tight)}
.gw-explainer p{margin:0;max-width:62ch;color:var(--gw-text-secondary)}
.gw-explainer-back{justify-self:start;min-height:var(--gw-tap-min);display:inline-flex;align-items:center;padding:0 var(--gw-space-3);border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius);color:var(--gw-text);text-decoration:none}
`;

function ensureExplainerStyle(): void {
  if (document.getElementById('gw-explainer-style')) return;
  document.head.append(el('style', { id: 'gw-explainer-style' }, [EXPLAINER_STYLE]));
}

/** Designed slot for the explainer video, with no video and no civic claim. */
export function renderExplainer(root: HTMLElement): void {
  ensureExplainerStyle();
  root.className = 'gw-explainer';
  root.replaceChildren(
    el('h1', {}, ['How Government Watchdog works']),
    el('p', {}, [
      'The handoff includes a short walkthrough that follows one sidewalk notice from '
      + 'the moment it appears in a packet to the vote that decides it. That walkthrough '
      + 'has not been produced yet.',
    ]),
    comingSoonNote(
      'Explainer video',
      'The design bundle ships this as a storyboard on a prototyping runtime we do not '
      + 'run in production. When a produced walkthrough exists it will play here; until '
      + 'then there is nothing to watch.',
    ),
    el('a', { class: 'gw-explainer-back', href: '#/home', 'data-test': 'explainer-back' }, ['Back to Home']),
  );
}
