/**
 * Private-beta reviewer-context states and honest projection placeholders.
 *
 * This module deliberately accepts only a small display-state vocabulary. Raw
 * request errors, response bodies, and fixture records never cross this UI
 * boundary, so a failed reviewer-context request cannot leak diagnostics or
 * leave stale civic rows visible.
 */

import { GW_TOKENS } from './tokens';

export type ReviewerContextPanelStatus =
  | 'loading'
  | 'denied'
  | 'unavailable'
  | 'invalid';

interface ReviewerContextPanelCopy {
  eyebrow: string;
  title: string;
  body: string;
  safeguard: string;
}

const PANEL_COPY: Record<ReviewerContextPanelStatus, ReviewerContextPanelCopy> = {
  loading: {
    eyebrow: 'REVIEWER CONTEXT',
    title: 'Loading the authorized Alpine record set',
    body: 'The website is requesting the same-origin reviewer projection once for this private-beta session.',
    safeguard: 'No captured, sample, or previously rendered civic records are shown while authorization is unresolved.',
  },
  denied: {
    eyebrow: 'ACCESS NOT CONFIRMED',
    title: 'Reviewer access is not available for this session',
    body: 'The server did not authorize this session for the reviewer-internal record set.',
    safeguard: 'No civic rows are shown, and changing Simple/Advanced mode, a URL, or a saved location cannot grant access.',
  },
  unavailable: {
    eyebrow: 'SERVICE UNAVAILABLE',
    title: 'The reviewed record service is not available right now',
    body: 'The website could not obtain the same-origin reviewer projection. This may be temporary.',
    safeguard: 'The website does not substitute a design sample, captured snapshot, or cached civic row for a failed live request.',
  },
  invalid: {
    eyebrow: 'SAFETY CHECK STOPPED THE READ',
    title: 'The reviewed response could not be displayed safely',
    body: 'The response did not match the required web-safe reviewer contract, so it was rejected before any civic row rendered.',
    safeguard: 'No partial response is displayed. The backend projection must pass its full shape and safety checks first.',
  },
};

export interface ProjectionGapDefinition {
  /** Stable machine-readable name for tests, review, and future projection wiring. */
  id: string;
  /** Short visual category, such as AGENDA or COVERAGE. */
  kicker: string;
  /** Reader-facing unavailable feature name. */
  title: string;
  /** The user need this designed slot will serve. */
  whatItDoes: string;
  /** Exact missing server-side contract; never a client-side inference recipe. */
  requiredProjection: string;
  /** How authorized data will travel into the slot once the contract exists. */
  howItWorks: string;
  /** Concrete outcome the finished feature should provide. */
  expectedResult: string;
  /** Product/data filing path shown by the compact information note. */
  filedUnder: string;
}

export interface ProjectionGapRenderOptions {
  /** Standalone gap pages use h1; embedded cards remain subordinate h2s. */
  headingLevel?: 1 | 2 | 3;
}

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

function definitionRow(label: string, value: string): HTMLDivElement {
  return el('div', { class: 'gw-projection-gap-row' }, [
    el('dt', {}, [label]),
    el('dd', {}, [value]),
  ]);
}

/**
 * Render one reusable, detailed "not available yet" slot.
 *
 * Every field is visible in the card. The compact `?` control adds the filing
 * explanation for pointer, keyboard, and touch users without hiding a safety
 * warning or making availability depend on hover.
 */
export function renderProjectionGap(
  definition: ProjectionGapDefinition,
  options: ProjectionGapRenderOptions = {},
): HTMLElement {
  ensureReviewerContextStyle();
  const noteId = `gw-projection-note-${definition.id}`;
  const headingTag = `h${options.headingLevel ?? 2}` as 'h1' | 'h2' | 'h3';
  const article = el('article', {
    class: 'gw-projection-gap',
    'data-test': 'reviewer-projection-gap',
    'data-projection': definition.id,
    'data-origin': 'designed-gap',
  }, [
    el('header', { class: 'gw-projection-gap-head' }, [
      el('div', {}, [
        el('p', { class: 'gw-projection-gap-kicker' }, [definition.kicker]),
        el(headingTag, { class: 'gw-projection-gap-title' }, [definition.title]),
      ]),
      el('details', { class: 'gw-projection-gap-note' }, [
        el('summary', {
          'aria-label': `How ${definition.title} is filed`,
          'aria-controls': noteId,
          title: `How ${definition.title} is filed`,
        }, ['?']),
        el('p', { id: noteId }, [
          `Filed under ${definition.filedUnder}. This is an explanatory placeholder, not a record, result, entitlement, or coverage claim.`,
        ]),
      ]),
    ]),
    el('p', { class: 'gw-projection-gap-status', role: 'status' }, ['Not available yet']),
    el('dl', {}, [
      definitionRow('What this will do', definition.whatItDoes),
      definitionRow('Required backend projection', definition.requiredProjection),
      definitionRow('How it will work', definition.howItWorks),
      definitionRow('Expected result', definition.expectedResult),
    ]),
  ]);
  const note = article.querySelector<HTMLDetailsElement>('.gw-projection-gap-note');
  if (note) {
    const summary = note.querySelector<HTMLElement>('summary');
    let pinnedOpen = false;
    let pointerInside = false;
    let focusInside = false;
    const syncOpen = (): void => {
      note.open = pinnedOpen || pointerInside || focusInside;
    };
    const togglePinned = (): void => {
      pinnedOpen = !pinnedOpen;
      if (!pinnedOpen) {
        // An explicit second activation closes the note even though the
        // summary still owns focus or the pointer remains over it.
        pointerInside = false;
        focusInside = false;
      }
      note.open = pinnedOpen;
    };
    note.addEventListener('mouseenter', () => {
      pointerInside = true;
      syncOpen();
    });
    note.addEventListener('mouseleave', () => {
      pointerInside = false;
      syncOpen();
    });
    note.addEventListener('focusin', () => {
      focusInside = true;
      syncOpen();
    });
    note.addEventListener('focusout', (event) => {
      if (!(event.relatedTarget instanceof Node) || !note.contains(event.relatedTarget)) {
        focusInside = false;
        syncOpen();
      }
    });
    summary?.addEventListener('click', (event) => {
      // Prevent focus-open followed by the native toggle closing on first
      // activation. Click also covers touch and browser-generated Enter/Space
      // activation for the native summary control.
      event.preventDefault();
      togglePinned();
    });
    summary?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      togglePinned();
    });
  }
  return article;
}

/**
 * Replace a route mount with a safe reviewer-context state.
 *
 * Replacing the complete child list is intentional: a transition away from a
 * ready route cannot preserve a stale record card underneath an error notice.
 */
export function renderReviewerContextState(
  root: HTMLElement,
  status: ReviewerContextPanelStatus,
): void {
  ensureReviewerContextStyle();
  const copy = PANEL_COPY[status];
  root.className = 'gw-reviewer-context-root';
  root.replaceChildren(
    el('section', {
      class: `gw-reviewer-context-panel gw-reviewer-context-${status}`,
      'data-test': `reviewer-context-${status}`,
      'data-reviewer-context-status': status,
      role: status === 'loading' ? 'status' : 'alert',
      'aria-live': status === 'loading' ? 'polite' : 'assertive',
      'aria-busy': status === 'loading' ? 'true' : 'false',
    }, [
      el('p', { class: 'gw-reviewer-context-kicker' }, [copy.eyebrow]),
      el('h1', {}, [copy.title]),
      el('p', { class: 'gw-reviewer-context-body' }, [copy.body]),
      el('div', { class: 'gw-reviewer-context-safeguard' }, [
        el('strong', {}, ['Safety boundary']),
        el('p', {}, [copy.safeguard]),
      ]),
    ]),
  );
}

export const REVIEWER_CONTEXT_STYLE = `${GW_TOKENS}
.gw-reviewer-context-root{font-family:var(--gw-font);color:var(--gw-text);line-height:var(--gw-leading)}
.gw-reviewer-context-root *,.gw-projection-gap *{box-sizing:border-box}
.gw-reviewer-context-panel{max-width:760px;margin:clamp(24px,7vh,80px) auto;padding:var(--gw-space-6);background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg)}
.gw-reviewer-context-panel h1{margin:0;font-size:clamp(1.45rem,4vw,var(--gw-text-display));line-height:var(--gw-leading-tight)}
.gw-reviewer-context-kicker,.gw-projection-gap-kicker{margin:0 0 var(--gw-space-2);font:800 var(--gw-text-kicker)/1.2 var(--gw-font);letter-spacing:1.35px;color:var(--gw-accent);text-transform:uppercase}
.gw-reviewer-context-body{max-width:64ch;color:var(--gw-text-secondary)}
.gw-reviewer-context-safeguard{margin-top:var(--gw-space-5);padding:var(--gw-space-4);background:var(--gw-tone-info-well);border-left:4px solid var(--gw-tone-info-line);color:var(--gw-info-text)}
.gw-reviewer-context-safeguard p{margin:.25rem 0 0}
.gw-reviewer-context-denied,.gw-reviewer-context-invalid{border-color:var(--gw-stop-border)}
.gw-reviewer-context-denied .gw-reviewer-context-kicker,.gw-reviewer-context-invalid .gw-reviewer-context-kicker{color:var(--gw-stop-text)}
.gw-reviewer-context-unavailable{border-color:var(--gw-caution-line)}
.gw-reviewer-context-unavailable .gw-reviewer-context-kicker{color:var(--gw-caution-text)}
.gw-projection-gap{position:relative;min-width:0;padding:var(--gw-space-5);color:var(--gw-text);background:var(--gw-surface);border:var(--gw-border-w) dashed var(--gw-caution-line);border-radius:var(--gw-radius-lg);font-family:var(--gw-font)}
.gw-projection-gap-head{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--gw-space-4);padding-bottom:var(--gw-space-3);border-bottom:var(--gw-border-w) solid var(--gw-border-subtle)}
.gw-projection-gap-title{margin:0;font-size:var(--gw-text-lg);line-height:var(--gw-leading-tight)}
.gw-projection-gap-status{display:inline-flex;margin:var(--gw-space-3) 0;padding:.15rem .55rem;color:var(--gw-caution-text);background:var(--gw-caution-bg);border:var(--gw-border-w) solid var(--gw-caution-line);border-radius:var(--gw-radius-pill);font-size:var(--gw-text-badge);font-weight:800;text-transform:uppercase}
.gw-projection-gap dl{display:grid;gap:var(--gw-space-3);margin:0}
.gw-projection-gap-row{display:grid;gap:2px}
.gw-projection-gap-row dt{color:var(--gw-text-muted);font-size:var(--gw-text-xs);font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.gw-projection-gap-row dd{margin:0;color:var(--gw-text-secondary);font-size:var(--gw-text-sm)}
.gw-projection-gap-note{position:relative;flex:none}
.gw-projection-gap-note summary{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;list-style:none;cursor:help;color:var(--gw-info-text);background:var(--gw-tone-info-well);border:var(--gw-border-w) solid var(--gw-tone-info-line);border-radius:50%;font:800 14px/1 var(--gw-font)}
.gw-projection-gap-note summary::-webkit-details-marker{display:none}
.gw-projection-gap-note summary:focus-visible{outline:2px solid var(--gw-accent);outline-offset:2px}
.gw-projection-gap-note p{position:absolute;z-index:10;right:0;top:36px;width:min(330px,calc(100vw - 52px));margin:0;padding:var(--gw-space-3);color:var(--gw-text-secondary);background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius);box-shadow:0 12px 30px rgba(0,0,0,.2);font-size:var(--gw-text-sm);line-height:1.45}
@media (max-width:600px){.gw-projection-gap-note summary{width:var(--gw-tap-min);height:var(--gw-tap-min)}.gw-projection-gap-note p{position:fixed;z-index:1000;left:10px;right:10px;top:auto;bottom:calc(10px + env(safe-area-inset-bottom));width:auto}}
`;

const REVIEWER_CONTEXT_STYLE_ID = 'gw-reviewer-context-style';
function ensureReviewerContextStyle(): void {
  if (document.getElementById(REVIEWER_CONTEXT_STYLE_ID)) return;
  document.head.append(el('style', { id: REVIEWER_CONTEXT_STYLE_ID }, [REVIEWER_CONTEXT_STYLE]));
}
