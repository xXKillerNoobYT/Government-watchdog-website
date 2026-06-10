/**
 * Thin DOM renderer for the app skeleton. NEUTRAL styling only — no visual-style
 * commitments (Isaac's design direction refines visuals in a later slice). Its
 * job here is to prove the loading / empty / error / ready primitives render and
 * that backend trust + fixture labels are visible, not to be the final look.
 */

import type { AsyncState } from '../state/async-state';
import type { ReadApiResponse, StatementRecord, EvidenceLink, ConceptEdge, AgendaItemMember } from '../types/read-api';
import { stateView, trustLabel, isAiProduced, FIXTURE_BANNER_TEXT, AI_LABEL_TEXT } from './state-view';
import { drawerFields, relatedLinksFor, verbatimLabel } from './statement-presenter';

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

/** One source's evidence row, rendered as a labeled field list (1.06 §6). */
function evidenceEntry(e: EvidenceLink): HTMLElement {
  const rows = drawerFields(e).map((f) => {
    const value =
      f.kind === 'link' && f.href
        ? el('a', { href: f.href, target: '_blank', rel: 'noopener', 'data-test': `drawer-link-${f.key}` }, [f.value])
        : el('span', { 'data-test': `drawer-value-${f.key}` }, [f.value]);
    return el('div', { class: 'gw-field', 'data-test': `drawer-field-${f.key}` }, [
      el('dt', {}, [f.label]),
      el('dd', {}, [value]),
    ]);
  });
  return el('dl', { class: 'gw-source', 'data-test': 'source-entry' }, rows);
}

function evidenceDrawer(evidence: EvidenceLink[]): HTMLElement {
  return el('details', { class: 'gw-drawer', 'data-test': 'source-drawer' }, [
    el('summary', {}, [`Sources (${evidence.length})`]),
    el('div', { class: 'gw-source-list' }, evidence.map(evidenceEntry)),
  ]);
}

/** Typed related-links for a card — explicit Supersedes/Amends/Revisits labels. */
function relatedLinks(
  r: StatementRecord,
  edges: ConceptEdge[] | undefined,
  members: AgendaItemMember[] | undefined,
): HTMLElement | null {
  const links = relatedLinksFor(r, edges, members);
  if (!links.length) return null;
  const items = links.map((l) =>
    el('li', { class: 'gw-related', 'data-test': 'related-link' }, [
      el('span', { class: 'gw-related-type', 'data-test': 'related-type' }, [l.label]),
      ` ${l.direction === 'in' ? '←' : '→'} `,
      el('span', { class: 'gw-related-target' }, [l.targetTitle]),
    ]),
  );
  return el('ul', { class: 'gw-related-list', 'data-test': 'related-links' }, items);
}

function recordCard(
  r: StatementRecord,
  edges?: ConceptEdge[],
  members?: AgendaItemMember[],
): HTMLElement {
  // Exactly one status badge per card (acceptance criterion). The locked AI
  // label is a separate, clearly-labeled element — not a second status badge.
  const badges: HTMLElement[] = [el('span', { class: 'gw-badge', 'data-test': 'trust-badge' }, [trustLabel(r)])];
  const ai = isAiProduced(r);
  if (ai) {
    badges.push(el('span', { class: 'gw-badge gw-badge-ai', 'data-test': 'ai-label' }, [AI_LABEL_TEXT]));
  }

  // Facts rendered separately from AI analysis (BEH-HANDOFF-4): AI-origin text
  // sits in its own labeled region so it never reads as a verified fact.
  const body = ai
    ? el('div', { class: 'gw-analysis', 'data-test': 'ai-analysis' }, [
        el('p', { class: 'gw-analysis-caption gw-muted' }, ['AI analysis — not independently verified']),
        el('p', { class: 'gw-statement' }, [r.statement_text ?? '(no text)']),
      ])
    : el('div', { class: 'gw-fact', 'data-test': 'statement-fact' }, [
        el('p', { class: 'gw-statement' }, [r.statement_text ?? '(no text)']),
      ]);

  const children: HTMLElement[] = [
    el('div', { class: 'gw-badges' }, badges),
    body,
    el('p', { class: 'gw-provenance gw-muted', 'data-test': 'provenance' }, [verbatimLabel(r)]),
  ];
  const related = relatedLinks(r, edges, members);
  if (related) children.push(related);
  children.push(evidenceDrawer(r.evidence ?? []));

  return el('article', { class: 'gw-card', 'data-test': 'record-card' }, children);
}

function readyView(data: ReadApiResponse): HTMLElement {
  const children: HTMLElement[] = [];
  const crumb = data.topic_tree?.breadcrumb?.map((t) => t.canonicalHumanLabel ?? t.name ?? t.topic_id).join(' › ');
  if (crumb) children.push(el('nav', { class: 'gw-breadcrumb', 'data-test': 'breadcrumb' }, [crumb]));
  const edges = data.agenda_thread?.lifecycle_edges;
  const members = data.agenda_thread?.members;
  if (data.agenda_thread) {
    const th = data.agenda_thread.thread;
    children.push(
      el('section', { class: 'gw-thread', 'data-test': 'agenda-thread' }, [
        el('h2', {}, [th.canonicalHumanLabel ?? th.title ?? th.agenda_thread_id]),
        el('p', { class: 'gw-muted' }, [`${data.agenda_thread.members.length} linked agenda item(s)`]),
      ]),
    );
  }
  const records = data.records ?? [];
  children.push(el('section', { class: 'gw-timeline', 'data-test': 'timeline' }, records.map((r) => recordCard(r, edges, members))));
  return el('div', {}, children);
}

/**
 * Reviewer-internal legibility / touch floors, formalized by UXProductDesigner
 * on GOV-100 (not visual-style commitments — Isaac's later pass may restyle
 * ABOVE these). Stated in px so they can never scale below the floor with root
 * font changes, and exported so a unit test can assert the CSS honours them.
 *  - Badge text ≥ 13px computed at the 390px mobile floor (mobile legibility).
 *  - Drawer summary tap target ≥ 44×44px (WCAG 2.5.5 Target Size).
 */
export const BADGE_MIN_FONT_PX = 13;
export const DRAWER_TAP_MIN_PX = 44;

/** Exported for the legibility/touch-floor regression test (source of truth). */
export const STYLE = `
.gw-root{font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a;max-width:48rem;margin:0 auto;padding:1rem}
.gw-fixture-banner{background:#fff3cd;border:1px solid #d9a400;color:#5c4500;padding:.6rem .8rem;border-radius:6px;font-weight:600;margin-bottom:.75rem}
.gw-fixture-banner small{display:block;font-weight:400}
.gw-notice{font-size:.85rem;color:#5c4500;margin-top:.25rem}
.gw-state{padding:1.25rem;border:1px dashed #bbb;border-radius:8px;text-align:center;color:#444}
.gw-state h1{font-size:1.1rem;margin:.25rem 0}
.gw-state[data-state="error"]{border-color:#c0392b;color:#7b241c;background:#fdecea}
.gw-muted{color:#666}
.gw-breadcrumb{font-size:.85rem;color:#555;margin:.5rem 0}
.gw-card{border:1px solid #ddd;border-radius:8px;padding:.8rem;margin:.6rem 0}
.gw-badges{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.4rem}
.gw-badge{font-size:${BADGE_MIN_FONT_PX}px;line-height:1.3;font-weight:700;background:#e8f0e8;color:#1e4620;border:1px solid #1e4620;border-radius:999px;padding:.15rem .55rem;white-space:nowrap}
.gw-badge-ai{background:#fff3cd;color:#7a5b00;border-color:#7a5b00}
.gw-statement{margin:.3rem 0}
.gw-analysis{border-left:3px solid #d9a400;background:#fffaf0;padding:.3rem .6rem;border-radius:4px;margin:.3rem 0}
.gw-analysis-caption{font-size:.72rem;font-weight:600;margin:.1rem 0;text-transform:uppercase;letter-spacing:.02em}
.gw-provenance{font-size:.75rem;margin:.2rem 0}
.gw-related-list{list-style:none;padding:0;margin:.3rem 0;display:flex;flex-direction:column;gap:.2rem}
.gw-related{font-size:.8rem}
.gw-related-type{font-weight:700;background:#eef2f8;color:#1a4d8f;border:1px solid #1a4d8f;border-radius:4px;padding:.05rem .35rem}
.gw-drawer summary{cursor:pointer;font-size:.9rem;color:#1a4d8f;padding:.5rem .2rem;min-height:${DRAWER_TAP_MIN_PX}px;box-sizing:border-box;display:flex;align-items:center}
.gw-source-list{display:flex;flex-direction:column;gap:.5rem;margin-top:.4rem}
.gw-source{border-top:1px solid #eee;padding-top:.4rem;margin:0;display:grid;grid-template-columns:auto;gap:.15rem}
.gw-field{display:grid;grid-template-columns:9rem 1fr;gap:.5rem;font-size:.8rem}
.gw-field dt{color:#666;margin:0}
.gw-field dd{margin:0}
@media (max-width:420px){.gw-field{grid-template-columns:1fr}.gw-field dt{font-weight:600}}
.gw-thread h2{font-size:1rem;margin:.4rem 0 .1rem}
`;

let styleInjected = false;
function ensureStyle(): void {
  if (styleInjected) return;
  document.head.append(el('style', {}, [STYLE]));
  styleInjected = true;
}

/** Render the current state into `root`. Always shows the fixture banner in fixture mode. */
export function render(
  root: HTMLElement,
  state: AsyncState<ReadApiResponse>,
  notice?: string,
): void {
  ensureStyle();
  const view = stateView(state, notice);
  root.className = 'gw-root';
  root.replaceChildren();

  if (view.showFixtureBanner) {
    root.append(
      el('div', { class: 'gw-fixture-banner', role: 'status', 'data-test': 'fixture-banner' }, [
        FIXTURE_BANNER_TEXT,
        el('small', {}, ['Reviewer-internal sample for layout review — not a verified civic record.']),
        ...(view.notice ? [el('div', { class: 'gw-notice' }, [view.notice])] : []),
      ]),
    );
  }

  if (view.kind === 'ready' && state.data) {
    root.append(el('h1', { class: 'gw-h1' }, [view.heading]), el('p', { class: 'gw-muted' }, [view.message]), readyView(state.data));
    return;
  }

  root.append(
    el('section', { class: 'gw-state', 'data-state': view.kind, 'data-test': `state-${view.kind}`, role: view.kind === 'error' ? 'alert' : 'status' }, [
      el('h1', {}, [view.heading]),
      el('p', {}, [view.message]),
    ]),
  );
}
