/**
 * Thin DOM renderer for the app skeleton. NEUTRAL styling only — no visual-style
 * commitments (Isaac's design direction refines visuals in a later slice). Its
 * job here is to prove the loading / empty / error / ready primitives render and
 * that backend trust + fixture labels are visible, not to be the final look.
 */

import type { AsyncState } from '../state/async-state';
import type { ReadApiResponse, StatementRecord, EvidenceLink, ConceptEdge, AgendaItemMember, AgendaThreadResponse } from '../types/read-api';
import { stateView, trustLabel, recordTone, isAiProduced, FIXTURE_BANNER_TEXT, AI_LABEL_TEXT } from './state-view';
import { trustLegend, LEGEND_TITLE } from './legend';
import { drawerFields, relatedLinksFor, verbatimLabel, confidenceLabel, speakerLabel } from './statement-presenter';
import {
  buildTimeline,
  buildTimeNavigator,
  buildGapSummary,
  assembleThread,
  completenessView,
  NO_LINK_TEXT,
  type AssembledThread,
  type CompletenessView,
  type GapSummaryView,
  type TimeNavigator,
} from './timeline';

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

interface RecordCardOpts {
  /** Anchor id when this card is the first record of its day (time-bar target). */
  anchorId?: string;
}

function recordCard(
  r: StatementRecord,
  edges?: ConceptEdge[],
  members?: AgendaItemMember[],
  opts: RecordCardOpts = {},
): HTMLElement {
  // Exactly one status badge per card (acceptance criterion). The locked AI
  // label is a separate, clearly-labeled element — not a second status badge.
  // The tone class is colour ONLY (from the backend ui_status, never recomputed).
  const tone = recordTone(r);
  const badges: HTMLElement[] = [
    el('span', { class: `gw-badge gw-tone-${tone}`, 'data-test': 'trust-badge', 'data-tone': tone }, [trustLabel(r)]),
  ];
  const ai = isAiProduced(r);
  if (ai) {
    badges.push(el('span', { class: 'gw-badge gw-badge-ai', 'data-test': 'ai-label' }, [AI_LABEL_TEXT]));
  }

  // GOV-293 — the at-a-glance attribution + confidence trail. Both sit OUTSIDE
  // the blurred info region (sharp at all times) and are rendered VERBATIM from
  // the backend's fail-closed envelope keys: the safe speaker_label ("who said
  // it") and the confidence_label (derived from the source transcript class).
  // Neither is a trust verdict — they are distinct from the trust badge — and
  // neither is ever recomputed on the client. Each row appears only when the
  // backend sent the field (omitted, never invented, on a pre-GOV-283/290 fixture).
  const speaker = speakerLabel(r);
  const confidence = confidenceLabel(r);
  const metaChildren: HTMLElement[] = [];
  if (speaker) {
    metaChildren.push(
      el('span', { class: 'gw-speaker', 'data-test': 'speaker-label' }, [
        el('span', { class: 'gw-meta-key' }, ['Speaker: ']),
        speaker,
      ]),
    );
  }
  if (confidence) {
    metaChildren.push(
      el('span', { class: 'gw-confidence', 'data-test': 'confidence-label', title: 'Confidence derived from the source transcript class' }, [
        el('span', { class: 'gw-meta-key' }, ['Confidence: ']),
        confidence,
      ]),
    );
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

  // GOV-153 enhancement #2 — progressive disclosure. The record INFO (statement /
  // AI analysis, provenance, related links, sources) is blurred by default and
  // revealed only on explicit click. The trust badge + locked AI label are NOT
  // inside the blurred region: they stay sharp and legible at all times, so an
  // AI-produced row can never read as a verified fact while details are hidden
  // (BACKEND_FRONTEND_EVIDENCE_WORKFLOW label integrity — see GOV-153 note #2).
  const infoChildren: HTMLElement[] = [
    body,
    el('p', { class: 'gw-provenance gw-muted', 'data-test': 'provenance' }, [verbatimLabel(r)]),
  ];
  const related = relatedLinks(r, edges, members);
  if (related) infoChildren.push(related);
  infoChildren.push(evidenceDrawer(r.evidence ?? []));

  const info = el('div', { class: 'gw-card-info', 'data-test': 'card-info', 'aria-hidden': 'true' }, infoChildren);

  const reveal = el(
    'button',
    { type: 'button', class: 'gw-reveal-btn', 'data-test': 'reveal-btn', 'aria-expanded': 'false' },
    ['Reveal details'],
  );

  const attrs: Record<string, string> = { class: 'gw-card', 'data-test': 'record-card' };
  if (opts.anchorId) attrs.id = opts.anchorId;

  // The sharp meta row (speaker + confidence) only renders when present.
  const cardChildren: HTMLElement[] = [el('div', { class: 'gw-badges' }, badges)];
  if (metaChildren.length) {
    cardChildren.push(el('div', { class: 'gw-meta', 'data-test': 'card-meta' }, metaChildren));
  }
  cardChildren.push(reveal, info);

  const card = el('article', attrs, cardChildren);

  reveal.addEventListener('click', () => {
    const revealed = card.classList.toggle('gw-revealed');
    reveal.setAttribute('aria-expanded', String(revealed));
    info.setAttribute('aria-hidden', String(!revealed));
    reveal.textContent = revealed ? 'Hide details' : 'Reveal details';
  });

  return card;
}

/** The completeness indicator — fail-closed; an incomplete thread never reads complete. */
function completenessIndicator(view: CompletenessView): HTMLElement {
  const children: (Node | string)[] = [
    el('span', { class: `gw-completeness-badge gw-completeness-${view.state}`, 'data-test': 'completeness-badge' }, [view.summary]),
  ];
  if (view.state === 'gaps' && view.gaps.length) {
    children.push(
      el(
        'ul',
        { class: 'gw-gap-list', 'data-test': 'completeness-gaps' },
        view.gaps.map((g) =>
          el('li', { class: 'gw-gap', 'data-test': `gap-${g.kind}` }, [
            el('span', { class: 'gw-gap-kind' }, [g.label]),
            ...(g.detail ? [` — `, el('span', { class: 'gw-muted' }, [g.detail])] : []),
          ]),
        ),
      ),
    );
  }
  return el('div', { class: 'gw-completeness', 'data-test': 'completeness', 'data-state': view.state }, children);
}

/** Severity → tone class (colour only — the backend `severity` decides, never the UI). */
function severityTone(severity: string): 'caution' | 'stop' | 'neutral' {
  if (severity === 'blocking') return 'stop';
  if (severity === 'warn') return 'caution';
  return 'neutral'; // info / anything else
}

/**
 * The completeness-gap card (GOV-298 / GOV-301): surfaces what is MISSING on the
 * reviewer-internal Alpine timeline — the ~90 `no_primary_source` meetings plus
 * other backend-asserted gap kinds. For a watchdog product, showing gaps is as
 * important as showing presence. Every served gap is counted (never hidden); the
 * per-meeting `no_primary_source` list is a tap-reachable disclosure. All fields
 * are rendered VERBATIM from the web-safe backend projection — no gap is invented,
 * re-classified, or marked resolved on the client.
 */
function gapCardSection(view: GapSummaryView): HTMLElement {
  // Headline: the ~90 no_primary_source meetings, the focus of this slice.
  const headline = el('p', { class: 'gw-gapcard-headline', 'data-test': 'gap-headline' }, [
    el('strong', { 'data-test': 'gap-no-primary-source-count' }, [String(view.noPrimarySourceCount)]),
    ' Alpine meeting(s) still lack a primary source',
  ]);

  // Total across all kinds — keeps every other gap kind countable too.
  const total = el('p', { class: 'gw-muted', 'data-test': 'gap-total' }, [
    `${view.total} completeness gap(s) recorded across all kinds (reviewer-internal)`,
  ]);

  // Per-type breakdown — every gap kind the backend served, with its count.
  const breakdown = el(
    'ul',
    { class: 'gw-gap-type-list', 'data-test': 'gap-type-breakdown' },
    view.groups.map((g) =>
      el('li', { class: 'gw-gap-type', 'data-test': `gap-type-${g.gapType}` }, [
        el('span', { class: 'gw-gap-kind' }, [g.label]),
        el('span', { class: 'gw-gap-count', 'data-test': `gap-count-${g.gapType}` }, [String(g.count)]),
      ]),
    ),
  );

  const children: (Node | string)[] = [
    el('h2', {}, ['Completeness gaps']),
    headline,
    total,
    breakdown,
  ];

  // The per-meeting no_primary_source list, behind a tap-reachable disclosure
  // (≥44px summary, reusing the drawer tap floor). Collapsed by default so the
  // long list does not dominate, but every meeting is present and countable.
  if (view.noPrimarySource.length) {
    const meetings = el(
      'ul',
      { class: 'gw-gap-meeting-list', 'data-test': 'gap-meetings' },
      view.noPrimarySource.map((c) =>
        el('li', { class: 'gw-gap-meeting', 'data-test': 'gap-meeting', 'data-subject': c.subject_id }, [
          el('span', { class: 'gw-gap-subject', 'data-test': 'gap-subject' }, [c.subject_id]),
          el(
            'span',
            { class: `gw-badge gw-tone-${severityTone(c.severity)}`, 'data-test': 'gap-severity', 'data-severity': c.severity },
            [c.severity],
          ),
          el('span', { class: 'gw-badge gw-tone-neutral', 'data-test': 'gap-status' }, [c.resolved_status]),
          ...(c.detail ? [el('span', { class: 'gw-gap-detail gw-muted', 'data-test': 'gap-detail' }, [c.detail])] : []),
        ]),
      ),
    );
    children.push(
      el('details', { class: 'gw-drawer gw-gap-drawer', 'data-test': 'gap-meeting-drawer' }, [
        el('summary', { 'data-test': 'gap-meeting-summary' }, [
          `Meetings lacking a primary source (${view.noPrimarySourceCount})`,
        ]),
        meetings,
      ]),
    );
  }

  return el('section', { class: 'gw-gapcard', 'data-test': 'completeness-gap-card', 'data-no-primary-source-count': String(view.noPrimarySourceCount), 'data-total-gaps': String(view.total) }, children);
}

/**
 * The assembled cross-meeting thread surface (BEH-AGENDA): per-meeting instances
 * in known-then order, each keeping its own title + typed forward links, with the
 * explicit "no linked prior/next item recorded" line when an edge is absent, plus
 * the fail-closed completeness indicator.
 */
function assembledThreadSurface(threadResponse: AgendaThreadResponse): HTMLElement {
  const assembled: AssembledThread = assembleThread(threadResponse);
  const th = assembled.thread;
  const completeness = completenessView(threadResponse.completeness);

  const instances = assembled.instances.map((inst) =>
    el('li', { class: 'gw-thread-instance', 'data-test': 'thread-instance' }, [
      el('div', { class: 'gw-instance-head' }, [
        ...(inst.meetingDate ? [el('span', { class: 'gw-instance-date gw-muted', 'data-test': 'instance-date' }, [inst.meetingDate])] : []),
        el('span', { class: 'gw-instance-title' }, [inst.title]),
      ]),
      inst.hasNoLinks
        ? el('p', { class: 'gw-no-link gw-muted', 'data-test': 'no-link' }, [NO_LINK_TEXT])
        : el(
            'ul',
            { class: 'gw-related-list', 'data-test': 'instance-links' },
            inst.links.map((l) =>
              el('li', { class: 'gw-related', 'data-test': 'instance-link' }, [
                el('span', { class: 'gw-related-type', 'data-test': 'related-type' }, [l.label]),
                ` ${l.direction === 'in' ? '←' : '→'} `,
                el('span', { class: 'gw-related-target' }, [l.targetTitle]),
              ]),
            ),
          ),
    ]),
  );

  return el('section', { class: 'gw-thread', 'data-test': 'agenda-thread' }, [
    el('h2', {}, [th.canonicalHumanLabel ?? th.title ?? th.agenda_thread_id]),
    completenessIndicator(completeness),
    el('p', { class: 'gw-muted', 'data-test': 'thread-count' }, [`${assembled.instances.length} meeting instance(s) in this thread`]),
    el('ol', { class: 'gw-thread-list', 'data-test': 'thread-instances' }, instances),
  ]);
}

/**
 * The trust / AI legend — a tap-reachable `<details>` (NOT hover-only; native
 * disclosure opens on tap/click/Enter, satisfying the UX standing gate). Every
 * trust label, the locked AI label, and the fixture banner are explained once.
 * The 44px summary min-height reuses the drawer tap-target floor.
 */
function legendDisclosure(): HTMLElement {
  const entries = trustLegend();
  const rows = entries.map((e) =>
    el('li', { class: 'gw-legend-row', 'data-test': `legend-${e.key}` }, [
      el('span', { class: `gw-badge gw-tone-${e.tone}`, 'data-test': 'legend-label', 'data-tone': e.tone }, [e.label]),
      el('span', { class: 'gw-legend-meaning' }, [e.meaning]),
    ]),
  );
  return el('details', { class: 'gw-legend', 'data-test': 'trust-legend' }, [
    el('summary', { 'data-test': 'trust-legend-summary' }, [LEGEND_TITLE]),
    el('ul', { class: 'gw-legend-list' }, rows),
  ]);
}

/**
 * GOV-153 enhancement #1 — the side time-bar: three coordinated bars (year →
 * month → day) for fast chronological navigation. Selecting a year repopulates
 * the month bar; selecting a month repopulates the day bar; selecting a day
 * scrolls to that day's first record. The day bar lists ONLY active days (the
 * navigator never emits an empty day), so clicking inherently snaps to "days
 * that had something happening" (Isaac 1.3). Returns null when there is no dated
 * record to navigate. Buttons are real <button>s ≥44px tall (tap-reachable,
 * keyboard-focusable) per the UX standing gate.
 */
function timeNavigatorAside(nav: TimeNavigator): HTMLElement | null {
  if (!nav.years.length) return null;

  const yearList = el('ul', { class: 'gw-tn-list', 'data-test': 'tn-years' });
  const monthList = el('ul', { class: 'gw-tn-list', 'data-test': 'tn-months' });
  const dayList = el('ul', { class: 'gw-tn-list', 'data-test': 'tn-days' });

  let selectedYear = nav.years[0];
  let selectedMonth = selectedYear.months[0];

  const scrollToAnchor = (id: string): void => {
    const target = document.getElementById(id);
    // scrollIntoView is absent in some non-browser DOMs (e.g. jsdom) — guard it
    // so the navigator stays functional (selection still updates) regardless.
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navButton = (
    label: string,
    count: number,
    test: string,
    active: boolean,
    onClick: () => void,
  ): HTMLElement => {
    const btn = el(
      'button',
      { type: 'button', class: `gw-tn-btn${active ? ' gw-tn-active' : ''}`, 'data-test': test, 'aria-pressed': String(active) },
      [el('span', { class: 'gw-tn-label' }, [label]), el('span', { class: 'gw-tn-count' }, [String(count)])],
    );
    btn.addEventListener('click', onClick);
    return el('li', {}, [btn]);
  };

  const renderDays = (): void => {
    dayList.replaceChildren(
      ...selectedMonth.days.map((d) =>
        navButton(d.label, d.count, 'tn-day', false, () => scrollToAnchor(d.anchorId)),
      ),
    );
  };
  const renderMonths = (): void => {
    monthList.replaceChildren(
      ...selectedYear.months.map((m) =>
        navButton(m.label, m.count, 'tn-month', m === selectedMonth, () => {
          selectedMonth = m;
          renderMonths();
          renderDays();
          scrollToAnchor(m.days[0].anchorId);
        }),
      ),
    );
  };
  const renderYears = (): void => {
    yearList.replaceChildren(
      ...nav.years.map((y) =>
        navButton(y.year, y.count, 'tn-year', y === selectedYear, () => {
          selectedYear = y;
          selectedMonth = y.months[0];
          renderYears();
          renderMonths();
          renderDays();
          scrollToAnchor(selectedMonth.days[0].anchorId);
        }),
      ),
    );
  };
  renderYears();
  renderMonths();
  renderDays();

  return el('aside', { class: 'gw-timenav', 'data-test': 'time-navigator', role: 'navigation', 'aria-label': 'Timeline date navigator' }, [
    el('div', { class: 'gw-tn-col' }, [el('h3', { class: 'gw-tn-head' }, ['Year']), yearList]),
    el('div', { class: 'gw-tn-col' }, [el('h3', { class: 'gw-tn-head' }, ['Month']), monthList]),
    el('div', { class: 'gw-tn-col' }, [el('h3', { class: 'gw-tn-head' }, ['Day']), dayList]),
  ]);
}

function readyView(data: ReadApiResponse): HTMLElement {
  const children: HTMLElement[] = [legendDisclosure()];
  const crumb = data.topic_tree?.breadcrumb?.map((t) => t.canonicalHumanLabel ?? t.name ?? t.topic_id).join(' › ');
  if (crumb) children.push(el('nav', { class: 'gw-breadcrumb', 'data-test': 'breadcrumb' }, [crumb]));

  // Completeness-gap card (GOV-298 / GOV-301) — what is MISSING, surfaced before
  // the present records. Null when no gaps were served / response is non-Alpine.
  const gapSummary = buildGapSummary(data);
  if (gapSummary) children.push(gapCardSection(gapSummary));

  const edges = data.agenda_thread?.lifecycle_edges;
  const members = data.agenda_thread?.members;
  if (data.agenda_thread) children.push(assembledThreadSurface(data.agenda_thread));

  // Chronological, Alpine-scope-locked timeline. Non-Alpine records are dropped
  // and logged here (BEH-FILTER-2) — never silently shown under an Alpine view.
  const timeline = buildTimeline(data);
  for (const w of timeline.warnings) console.warn(w);

  // The first card of each day owns that day's scroll anchor, so the side
  // time-bar can jump straight to it (GOV-153 #1). Track days already anchored.
  const anchoredDays = new Set<string>();
  const cards = timeline.ordered.map(({ record, timelineDate }) => {
    let anchorId: string | undefined;
    if (timelineDate && !anchoredDays.has(timelineDate)) {
      anchoredDays.add(timelineDate);
      anchorId = `gw-day-${timelineDate}`;
    }
    return recordCard(record, edges, members, { anchorId });
  });
  const timelineSection = el('section', { class: 'gw-timeline', 'data-test': 'timeline' }, cards);

  const navigator = timeNavigatorAside(buildTimeNavigator(timeline.ordered));
  children.push(
    navigator
      ? el('div', { class: 'gw-timeline-layout' }, [navigator, timelineSection])
      : timelineSection,
  );
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
.gw-badge{font-size:${BADGE_MIN_FONT_PX}px;line-height:1.3;font-weight:700;background:#eef0f2;color:#333;border:1px solid #999;border-radius:999px;padding:.15rem .55rem;white-space:nowrap}
/* Trust tones — colour only; the backend ui_status decides which, never the UI. */
.gw-tone-ok{background:#e8f0e8;color:#1e4620;border-color:#1e4620}
.gw-tone-caution{background:#fff3cd;color:#7a5b00;border-color:#7a5b00}
.gw-tone-stop{background:#fdecea;color:#7b241c;border-color:#c0392b}
.gw-tone-neutral{background:#eef2f8;color:#1a4d8f;border-color:#1a4d8f}
.gw-badge-ai{background:#fff3cd;color:#7a5b00;border-color:#7a5b00}
/* GOV-293 — sharp at-a-glance attribution + confidence trail (never blurred).
   Distinct from the trust badge: these are metadata, not a trust verdict. */
.gw-meta{display:flex;gap:.4rem .9rem;flex-wrap:wrap;margin:.1rem 0 .4rem;font-size:${BADGE_MIN_FONT_PX}px;line-height:1.35}
.gw-speaker{color:#1a1a1a}
.gw-confidence{color:#1a4d8f;background:#eef2f8;border:1px solid #c2cedd;border-radius:999px;padding:.05rem .5rem;white-space:nowrap}
.gw-meta-key{color:#666;font-weight:600}
.gw-legend{border:1px solid #d7dee8;background:#f7f9fc;border-radius:8px;margin:.4rem 0 .8rem;padding:0 .6rem}
.gw-legend summary{cursor:pointer;font-size:.9rem;font-weight:600;color:#1a4d8f;min-height:${DRAWER_TAP_MIN_PX}px;box-sizing:border-box;display:flex;align-items:center}
.gw-legend-list{list-style:none;margin:0 0 .6rem;padding:0;display:flex;flex-direction:column;gap:.4rem}
.gw-legend-row{display:grid;grid-template-columns:11rem 1fr;gap:.5rem;align-items:start;font-size:.82rem}
.gw-legend-meaning{color:#444}
@media (max-width:420px){.gw-legend-row{grid-template-columns:1fr;gap:.15rem}}
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
/* GOV-301 — completeness-gap card. Surfaces what is MISSING (the ~90
   no_primary_source meetings). Caution-toned frame so it reads as a gap/status
   surface, distinct from a record card. */
.gw-gapcard{border:1px solid #d9a400;background:#fffaf0;border-radius:8px;padding:.7rem .9rem;margin:.6rem 0}
.gw-gapcard h2{font-size:1rem;margin:.2rem 0 .35rem}
.gw-gapcard-headline{margin:.2rem 0;font-size:.95rem}
.gw-gapcard-headline strong{font-size:1.15rem;color:#7a5b00}
.gw-gap-type-list{list-style:none;margin:.4rem 0 .2rem;padding:0;display:flex;flex-wrap:wrap;gap:.35rem}
.gw-gap-type{display:inline-flex;align-items:center;gap:.4rem;background:#fff;border:1px solid #e0c98a;border-radius:6px;padding:.15rem .5rem;font-size:.8rem}
.gw-gap-count{font-size:.7rem;font-weight:700;background:#7a5b00;color:#fff;border-radius:999px;padding:0 .4rem;min-width:1.2rem;text-align:center}
.gw-gap-drawer summary{font-weight:600}
.gw-gap-meeting-list{list-style:none;margin:.4rem 0 0;padding:0;display:flex;flex-direction:column;gap:.3rem}
.gw-gap-meeting{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;border-top:1px solid #f0e2c0;padding-top:.3rem;font-size:.8rem}
.gw-gap-subject{font-weight:700;font-variant-numeric:tabular-nums}
.gw-gap-detail{flex:1 1 12rem;min-width:0}
.gw-thread{border:1px solid #d7dee8;background:#f7f9fc;border-radius:8px;padding:.7rem .9rem;margin:.6rem 0}
.gw-thread h2{font-size:1rem;margin:.2rem 0 .35rem}
.gw-completeness{margin:.2rem 0 .5rem}
.gw-completeness-badge{font-size:${BADGE_MIN_FONT_PX}px;line-height:1.3;font-weight:700;border-radius:999px;padding:.15rem .55rem;white-space:nowrap;border:1px solid}
.gw-completeness-complete{background:#e8f0e8;color:#1e4620;border-color:#1e4620}
.gw-completeness-gaps{background:#fdecea;color:#7b241c;border-color:#c0392b}
.gw-completeness-unknown{background:#eef0f2;color:#444;border-color:#999}
.gw-gap-list{list-style:disc;margin:.35rem 0 0;padding-left:1.2rem;font-size:.8rem}
.gw-gap-kind{font-weight:600}
.gw-thread-list{list-style:none;margin:.3rem 0 0;padding:0;display:flex;flex-direction:column;gap:.4rem}
.gw-thread-instance{border-left:3px solid #1a4d8f;background:#fff;border-radius:0 4px 4px 0;padding:.35rem .6rem}
.gw-instance-head{display:flex;gap:.5rem;align-items:baseline;flex-wrap:wrap}
.gw-instance-date{font-size:.75rem;font-variant-numeric:tabular-nums}
.gw-instance-title{font-weight:600;font-size:.9rem}
.gw-no-link{font-size:.78rem;font-style:italic;margin:.2rem 0 0}
/* GOV-153 #1 — side time-bar layout. Navigator sits beside the timeline on wide
   viewports and stacks above it on the mobile floor. */
.gw-timeline-layout{display:flex;gap:1rem;align-items:flex-start}
.gw-timeline-layout .gw-timeline{flex:1 1 auto;min-width:0}
.gw-timenav{flex:0 0 auto;display:flex;gap:.4rem;position:sticky;top:.5rem;background:#f7f9fc;border:1px solid #d7dee8;border-radius:8px;padding:.5rem}
.gw-tn-col{display:flex;flex-direction:column;min-width:3.2rem}
.gw-tn-head{font-size:.7rem;text-transform:uppercase;letter-spacing:.04em;color:#5a6b82;margin:.1rem 0 .3rem;text-align:center}
.gw-tn-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.2rem;max-height:60vh;overflow-y:auto}
.gw-tn-btn{display:flex;align-items:center;justify-content:space-between;gap:.3rem;width:100%;min-height:${DRAWER_TAP_MIN_PX}px;box-sizing:border-box;cursor:pointer;font-size:${BADGE_MIN_FONT_PX}px;font-weight:600;background:#fff;color:#1a4d8f;border:1px solid #c2cedd;border-radius:6px;padding:.2rem .45rem}
.gw-tn-btn:hover{background:#eef2f8}
.gw-tn-btn:focus-visible{outline:2px solid #1a4d8f;outline-offset:1px}
.gw-tn-active{background:#1a4d8f;color:#fff;border-color:#1a4d8f}
.gw-tn-count{font-size:.65rem;font-weight:700;background:rgba(0,0,0,.08);color:inherit;border-radius:999px;padding:0 .35rem;min-width:1.1rem;text-align:center}
.gw-tn-active .gw-tn-count{background:rgba(255,255,255,.25)}
@media (max-width:640px){.gw-timeline-layout{flex-direction:column}.gw-timenav{position:static;width:100%;justify-content:space-between}.gw-tn-col{flex:1}.gw-tn-list{flex-direction:row;flex-wrap:wrap;max-height:none}}
/* GOV-153 #2 — click-to-reveal blur. The record INFO is blurred + inert until
   revealed; the trust/AI badges live OUTSIDE this region and are never blurred,
   so an AI row can't read as fact while hidden. */
.gw-reveal-btn{display:inline-flex;align-items:center;min-height:${DRAWER_TAP_MIN_PX}px;box-sizing:border-box;cursor:pointer;font-size:.82rem;font-weight:600;color:#1a4d8f;background:#eef2f8;border:1px solid #1a4d8f;border-radius:6px;padding:.2rem .7rem;margin:.1rem 0 .4rem}
.gw-reveal-btn:focus-visible{outline:2px solid #1a4d8f;outline-offset:1px}
.gw-card-info{filter:blur(6px);user-select:none;pointer-events:none;transition:filter .15s ease}
.gw-card.gw-revealed .gw-card-info{filter:none;user-select:auto;pointer-events:auto}
@media (prefers-reduced-motion:reduce){.gw-card-info{transition:none}}
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
        el('small', {}, ['Reviewer-internal offline snapshot — not a live read. See the notice for provenance; AI-produced rows keep their own per-record label.']),
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
