/**
 * Thin DOM renderer for the app skeleton. NEUTRAL styling only — no visual-style
 * commitments (Isaac's design direction refines visuals in a later slice). Its
 * job here is to prove the loading / empty / error / ready primitives render and
 * that backend trust + fixture labels are visible, not to be the final look.
 */

import type { AsyncState } from '../state/async-state';
import type { ReadApiResponse, StatementRecord, EvidenceLink } from '../types/read-api';
import { stateView, trustLabel, isAiProduced, FIXTURE_BANNER_TEXT, AI_LABEL_TEXT } from './state-view';

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

function evidenceDrawer(evidence: EvidenceLink[]): HTMLElement {
  const items = evidence.map((e) => {
    const parts: (Node | string)[] = [];
    if (e.original_url) parts.push(el('a', { href: e.original_url, target: '_blank', rel: 'noopener', 'data-test': 'source-link' }, ['View original']));
    if (e.archive_url) parts.push(el('a', { href: e.archive_url, target: '_blank', rel: 'noopener', 'data-test': 'archive-link' }, ['View archive']));
    else parts.push(el('span', { class: 'gw-muted' }, ['Archive not available']));
    const locator = [e.page ? `p.${e.page}` : '', e.section ?? '', e.timestamp_human ?? ''].filter(Boolean).join(' · ');
    return el('li', {}, [el('span', { class: 'gw-muted' }, [`${e.relation ?? 'source'}${locator ? ` — ${locator}` : ''} `]), ...interleave(parts)]);
  });
  return el('details', { class: 'gw-drawer', 'data-test': 'source-drawer' }, [
    el('summary', {}, [`Sources (${evidence.length})`]),
    el('ul', {}, items),
  ]);
}

function interleave(nodes: (Node | string)[]): (Node | string)[] {
  const out: (Node | string)[] = [];
  nodes.forEach((n, i) => {
    if (i > 0) out.push(' · ');
    out.push(n);
  });
  return out;
}

function recordCard(r: StatementRecord): HTMLElement {
  const badges = [el('span', { class: 'gw-badge', 'data-test': 'trust-badge' }, [trustLabel(r)])];
  if (isAiProduced(r)) {
    // Standing gate: locked/visible AI label — never hidden behind interaction.
    badges.push(el('span', { class: 'gw-badge gw-badge-ai', 'data-test': 'ai-label' }, [AI_LABEL_TEXT]));
  }
  return el('article', { class: 'gw-card', 'data-test': 'record-card' }, [
    el('div', { class: 'gw-badges' }, badges),
    el('p', { class: 'gw-statement' }, [r.statement_text ?? '(no text)']),
    evidenceDrawer(r.evidence ?? []),
  ]);
}

function readyView(data: ReadApiResponse): HTMLElement {
  const children: HTMLElement[] = [];
  const crumb = data.topic_tree?.breadcrumb?.map((t) => t.canonicalHumanLabel ?? t.name ?? t.topic_id).join(' › ');
  if (crumb) children.push(el('nav', { class: 'gw-breadcrumb', 'data-test': 'breadcrumb' }, [crumb]));
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
  children.push(el('section', { class: 'gw-timeline', 'data-test': 'timeline' }, records.map(recordCard)));
  return el('div', {}, children);
}

const STYLE = `
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
.gw-badge{font-size:.75rem;font-weight:700;background:#e8f0e8;color:#1e4620;border:1px solid #1e4620;border-radius:999px;padding:.1rem .5rem}
.gw-badge-ai{background:#fff3cd;color:#7a5b00;border-color:#7a5b00}
.gw-statement{margin:.3rem 0}
.gw-drawer summary{cursor:pointer;font-size:.85rem;color:#1a4d8f}
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
