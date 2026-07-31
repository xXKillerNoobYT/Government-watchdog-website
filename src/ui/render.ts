/**
 * Thin DOM renderer for the app skeleton. NEUTRAL styling only — no visual-style
 * commitments (Isaac's design direction refines visuals in a later slice). Its
 * job here is to prove the loading / empty / error / ready primitives render and
 * that backend trust + fixture labels are visible, not to be the final look.
 */

import type { AsyncState } from '../state/async-state';
import type { ReadApiResponse, StatementRecord, EvidenceLink, ConceptEdge, AgendaItemMember, AgendaThreadResponse } from '../types/read-api';
import { stateView, trustLabel, recordTone, isAiProduced, readyHeaderMessage, FIXTURE_BANNER_TEXT, AI_LABEL_TEXT } from './state-view';
import { trustLegend, LEGEND_TITLE } from './legend';
import { drawerFields, relatedLinksFor, verbatimLabel, confidenceLabel, speakerLabel, provenanceBadge } from './statement-presenter';
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
import { buildCardFeedModel, type CardFeed, type CardHeadView } from './card-feed';
import { GW_TOKENS } from './tokens';
import {
  renderPrivateInfoNote,
  type PrivateInfoNoteId,
} from './private-info-note';
import { safeExternalHref } from '../data/web-safe';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    // C8: a supplied URL is untrusted input. An unsafe scheme is REFUSED, not rendered —
    // the anchor keeps its text and simply has no href, so nothing is clickable and no
    // dead affordance is presented. See safeExternalHref in src/data/web-safe.ts.
    if (k === 'href' && safeExternalHref(v) === null) {
      node.setAttribute('data-href-refused', 'unsafe-scheme');
      continue;
    }
    node.setAttribute(k, v);
  }
  for (const c of children) node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

export interface RecordSurfaceInfoOptions {
  /** One route-level explanation; never attach the same note to repeated cards. */
  infoNoteId?: PrivateInfoNoteId;
  /**
   * Embedded record surfaces yield route-level heading ownership to their
   * parent. The visual class stays the same; only the document outline changes.
   */
  headingLevel?: 'h1' | 'h2';
  /**
   * Authoritative response access. Required when a response resolves to the
   * shared empty state because `AsyncState` deliberately drops that payload.
   */
  access?: ReadApiResponse['access'];
}

function recordSurfaceHeading(
  heading: string,
  infoNoteId?: PrivateInfoNoteId,
  headingLevel: 'h1' | 'h2' = 'h1',
): HTMLElement {
  if (!infoNoteId) return el(headingLevel, { class: 'gw-h1' }, [heading]);
  return el('div', {
    class: 'gw-context-heading',
    'data-test': 'record-surface-context-heading',
  }, [
    el(headingLevel, { class: 'gw-h1' }, [heading]),
    renderPrivateInfoNote(infoNoteId),
  ]);
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
  /**
   * Reviewer-internal lane flag (GOV-314). The provenance / audit-passed badge
   * is rendered ONLY when this is true — the backend emits `provenance_status`
   * solely on the reviewer-internal lane, so the public lane shows no badge and
   * the client never synthesizes one there.
   */
  reviewerInternal?: boolean;
  /**
   * GOV-354 card-feed head (type glyph + date + optional title). When present a
   * sharp `<header>` is rendered ABOVE the badges row (outside the reveal blur),
   * surfacing the GOV-347 `type` emoji + hover, `title`, and `date`. Absent for
   * the legacy record timeline — those cards render unchanged.
   */
  head?: CardHeadView;
}

/** The sharp card-feed head: type emoji + hover, title (present-only), date. */
function cardHead(head: CardHeadView): HTMLElement {
  const children: (Node | string)[] = [
    el(
      'span',
      { class: 'gw-card-type', 'data-test': 'card-type', 'data-type': head.type, title: head.glyph.label },
      [el('span', { class: 'gw-card-emoji', 'aria-hidden': 'true' }, [head.glyph.emoji]), ` ${head.glyph.label}`],
    ),
  ];
  if (head.title) {
    children.push(el('span', { class: 'gw-card-title', 'data-test': 'card-title' }, [head.title]));
  }
  if (head.date) {
    children.push(el('time', { class: 'gw-card-date', 'data-test': 'card-date', datetime: head.date }, [head.date]));
  }
  return el('header', { class: 'gw-card-head', 'data-test': 'card-head' }, children);
}

/**
 * Render ONE reviewer-internal record card — the full card with its status
 * badge(s), locked AI label, sharp meta, and the click-to-reveal blur that hides
 * the statement/analysis, provenance, related links, and sources drawer until an
 * explicit tap. Exported (GOV-600) so the Kanban boards can place the SAME card
 * component inside meeting/lane columns without re-implementing its trust surface.
 */
export function recordCard(
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

  // GOV-314 — the provenance / audit-passed trust badge. Reviewer-internal lane
  // ONLY (the backend never emits `provenance_status` publicly; we never
  // synthesize it there). It sits in the sharp badges row (never blurred), is
  // distinguished by icon + text (not colour alone), and carries an aria-label +
  // title so a screen reader / hover gets the meaning. The state is consumed
  // VERBATIM from the backend — fail-closed to "Unverified provenance" for any
  // non-grounded/absent value. It is DISTINCT from the ui_status trust badge:
  // that one is about publication/correction state; this one is about whether the
  // canonical provenance chain audited clean.
  if (opts.reviewerInternal) {
    const prov = provenanceBadge(r);
    badges.push(
      el(
        'span',
        {
          class: `gw-badge gw-prov gw-prov-${prov.state} gw-tone-${prov.tone}`,
          'data-test': 'provenance-badge',
          'data-provenance': prov.state,
          title: prov.description,
          'aria-label': `Provenance: ${prov.label}`,
        },
        [
          el('span', { class: 'gw-prov-icon', 'aria-hidden': 'true' }, [prov.icon]),
          ` ${prov.label}`,
        ],
      ),
    );
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

  const attrs: Record<string, string> = {
    class: 'gw-card',
    'data-test': 'record-card',
    'data-record-id': r.statement_id,
  };
  if (opts.anchorId) attrs.id = opts.anchorId;

  // The sharp meta row (speaker + confidence) only renders when present.
  // GOV-354 — the card-feed head (type glyph + title + date) sits ABOVE the
  // badges, sharp at all times (outside the reveal blur), when supplied.
  const cardChildren: HTMLElement[] = [];
  if (opts.head) cardChildren.push(cardHead(opts.head));
  cardChildren.push(el('div', { class: 'gw-badges' }, badges));
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
export function gapCardSection(view: GapSummaryView): HTMLElement {
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

  // Every served gap row remains tap-reachable, not just no_primary_source.
  // Grouped disclosures keep the 224-row fixture readable without reducing the
  // backend's subject/severity/status/detail evidence to aggregate counts.
  for (const group of view.groups) {
    const rows = el(
      'ul',
      { class: 'gw-gap-meeting-list', 'data-test': `gap-rows-${group.gapType}` },
      group.cards.map((c) =>
        el('li', {
          class: 'gw-gap-meeting',
          'data-test': group.gapType === 'no_primary_source' ? 'gap-meeting' : 'gap-card-detail',
          'data-gap-detail-row': 'true',
          'data-gap-type': group.gapType,
          'data-subject': c.subject_id,
        }, [
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
    children.push(el('details', {
      class: 'gw-drawer gw-gap-drawer',
      'data-test': group.gapType === 'no_primary_source' ? 'gap-meeting-drawer' : 'gap-group-drawer',
      'data-gap-type': group.gapType,
    }, [
      el('summary', {
        'data-test': group.gapType === 'no_primary_source' ? 'gap-meeting-summary' : 'gap-group-summary',
      }, [`${group.label} (${group.count})`]),
      rows,
    ]));
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

interface TimelineLayoutOpts {
  reviewerInternal: boolean;
  edges?: ConceptEdge[];
  members?: AgendaItemMember[];
  /** Per-record card-feed head (GOV-354), keyed by `statement_id`. */
  headFor?: (statementId: string) => CardHeadView | undefined;
}

/**
 * The chronological, Alpine-scope-locked timeline section (+ side time-bar).
 * Shared by the legacy record timeline (no heads) and the GOV-354 card-feed
 * timeline (per-card heads). Non-Alpine records are dropped and logged here
 * (BEH-FILTER-2) — never silently shown under an Alpine view.
 */
function timelineLayout(data: ReadApiResponse, opts: TimelineLayoutOpts): HTMLElement {
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
    const head = opts.headFor?.(record.statement_id);
    return recordCard(record, opts.edges, opts.members, {
      anchorId,
      reviewerInternal: opts.reviewerInternal,
      ...(head ? { head } : {}),
    });
  });
  const timelineSection = el('section', { class: 'gw-timeline', 'data-test': 'timeline' }, cards);

  const navigator = timeNavigatorAside(buildTimeNavigator(timeline.ordered));
  return navigator
    ? el('div', { class: 'gw-timeline-layout' }, [navigator, timelineSection])
    : timelineSection;
}

function readyView(data: ReadApiResponse): HTMLElement {
  const children: HTMLElement[] = [legendDisclosure()];
  const crumb = data.topic_tree?.breadcrumb?.map((t) => t.canonicalHumanLabel ?? t.name ?? t.topic_id).join(' › ');
  if (crumb) children.push(el('nav', { class: 'gw-breadcrumb', 'data-test': 'breadcrumb' }, [crumb]));

  // Completeness-gap card (GOV-298 / GOV-301) — what is MISSING, surfaced before
  // the present records. Null when no gaps were served / response is non-Alpine.
  const gapSummary = buildGapSummary(data);
  if (gapSummary) children.push(gapCardSection(gapSummary));

  if (data.agenda_thread) children.push(assembledThreadSurface(data.agenda_thread));

  // Reviewer-internal lane gate (GOV-314): the provenance badge renders only when
  // the response is on the reviewer-internal lane. The backend emits
  // `provenance_status` solely there; the public lane shows no provenance badge.
  children.push(
    timelineLayout(data, {
      reviewerInternal: data.access === 'reviewer_internal',
      edges: data.agenda_thread?.lifecycle_edges,
      members: data.agenda_thread?.members,
    }),
  );
  return el('div', {}, children);
}

/**
 * GOV-354 — render the GOV-347 card-feed on the reviewer-internal Alpine timeline.
 *
 * A thin consume-the-envelope surface over the EXISTING timeline: the card-feed
 * adapter (`buildCardFeedModel`) partitions `{scope, access, cards[]}` into the
 * existing-shape `records` (→ `recordCard` with a per-card head) + `completeness_gaps`
 * (→ the GOV-301 gap card), and renders them through the same components.
 *
 * The reviewer-internal invariant (§5) is the SOLE gate and is enforced in the
 * adapter: on a non-reviewer-internal lane the model carries ZERO records and ZERO
 * gaps and reads NONE of the reviewer-internal-only fields, so the public lane DOM
 * is provably empty of cards and of `reviewed_summary`/`speaker_label`/
 * `provenance_status` — not merely hidden by CSS.
 */
export function renderCardFeed(root: HTMLElement, feed: CardFeed, notice?: string): void {
  ensureStyle();
  const { response, heads, dropped } = buildCardFeedModel(feed);
  for (const d of dropped) console.warn(`[card-feed] dropped ${d.handle}: ${d.reason}`);

  const reviewerInternal = response.access === 'reviewer_internal';
  root.className = 'gw-root';
  root.replaceChildren();

  // Always-on offline-snapshot banner — the feed is a committed fixture, never a
  // live read (GOV-353 §1.4).
  root.append(
    el('div', { class: 'gw-fixture-banner', role: 'status', 'data-test': 'fixture-banner' }, [
      FIXTURE_BANNER_TEXT,
      el('small', {}, ['Reviewer-internal offline snapshot — not a live read. AI-produced rows keep their own per-record label.']),
      ...(notice ? [el('div', { class: 'gw-notice' }, [notice])] : []),
    ]),
  );

  // §5.1 — public lane renders ZERO cards. The adapter already returned an empty
  // model; surface an explicit reviewer-internal-only notice (no card content).
  if (!reviewerInternal) {
    root.append(
      el(
        'section',
        { class: 'gw-state', 'data-state': 'empty', 'data-test': 'state-reviewer-gated', role: 'status' },
        [
          el('h1', {}, ['Reviewer-internal only']),
          el('p', {}, ['The Alpine card feed is gated to the reviewer-internal lane. The public lane renders no cards.']),
        ],
      ),
    );
    return;
  }

  const recordCount = response.records?.length ?? 0;
  const children: HTMLElement[] = [
    recordSurfaceHeading('Alpine card feed (reviewer-internal)', 'cards-overview'),
    el('p', { class: 'gw-muted' }, [readyHeaderMessage(response.records ?? [])]),
    legendDisclosure(),
  ];

  const gapSummary = buildGapSummary(response);
  if (gapSummary) children.push(gapCardSection(gapSummary));

  if (recordCount > 0) {
    children.push(
      timelineLayout(response, {
        reviewerInternal,
        headFor: (id) => heads.get(id),
      }),
    );
  } else if (!gapSummary) {
    children.push(
      el('section', { class: 'gw-state', 'data-state': 'empty', 'data-test': 'state-empty', role: 'status' }, [
        el('h2', {}, ['Nothing to show yet']),
        el('p', {}, ['No reviewed Alpine cards in this feed.']),
      ]),
    );
  }

  root.append(el('div', {}, children));
}

/**
 * Re-exported from the token module so existing `import … from './render'`
 * call-sites (and the floor regression tests) keep resolving while the token
 * block (which interpolates these floors) lives in `./tokens` to avoid a
 * circular import. See `./tokens` for the floor rationale.
 */
export { BADGE_MIN_FONT_PX, DRAWER_TAP_MIN_PX } from './tokens';

/**
 * Exported for the legibility/touch-floor regression test (source of truth).
 * GOV-427: consumes the shared `GW_TOKENS` layer (`var(--gw-*)`) — zero raw hex
 * remains outside the token definitions; the badge font / tap floors flow
 * through `--gw-text-badge` / `--gw-tap-min`, which bake in BADGE_MIN_FONT_PX /
 * DRAWER_TAP_MIN_PX.
 */
export const STYLE = `${GW_TOKENS}
.gw-root{font-family:var(--gw-font);line-height:var(--gw-leading);color:var(--gw-text);max-width:48rem;margin:0 auto;padding:var(--gw-space-5)}
.gw-fixture-banner{background:var(--gw-caution-bg);border:var(--gw-border-w) solid var(--gw-caution-line);color:var(--gw-caution-text-strong);padding:var(--gw-space-3) var(--gw-space-4);border-radius:var(--gw-radius);font-weight:600;margin-bottom:.75rem}
.gw-fixture-banner small{display:block;font-weight:400}
.gw-notice{font-size:.85rem;color:var(--gw-caution-text-strong);margin-top:var(--gw-space-1)}
.gw-state{padding:var(--gw-space-6);border:var(--gw-border-w) dashed var(--gw-border);border-radius:var(--gw-radius);text-align:center;color:var(--gw-text-secondary)}
.gw-state h1{font-size:1.1rem;margin:var(--gw-space-1) 0}
.gw-state[data-state="error"]{border-color:var(--gw-stop-border);color:var(--gw-stop-text);background:var(--gw-stop-bg)}
.gw-muted{color:var(--gw-text-muted)}
.gw-breadcrumb{font-size:.85rem;color:var(--gw-text-muted);margin:var(--gw-space-5) 0}
.gw-card{border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-4);margin:var(--gw-space-3) 0}
/* GOV-354 — card-feed head: type glyph + title + date, sharp (outside the reveal
   blur). Icon + text together (never colour alone), mirroring the badge rule. */
.gw-card-head{display:flex;gap:var(--gw-space-2);align-items:baseline;flex-wrap:wrap;margin-bottom:.35rem}
.gw-card-type{font-size:var(--gw-text-badge);font-weight:700;color:var(--gw-accent);background:var(--gw-surface-accent-tint);border:var(--gw-border-w) solid var(--gw-accent);border-radius:var(--gw-radius-pill);padding:.1rem .5rem;white-space:nowrap}
.gw-card-emoji{font-size:1.05em;line-height:1}
.gw-card-title{font-weight:700;font-size:var(--gw-text-body);color:var(--gw-text);flex:1 1 12rem;min-width:0}
.gw-card-date{font-size:.78rem;color:var(--gw-text-muted);font-variant-numeric:tabular-nums;margin-left:auto}
.gw-badges{display:flex;gap:var(--gw-space-2);flex-wrap:wrap;margin-bottom:var(--gw-space-2)}
.gw-badge{font-size:var(--gw-text-badge);line-height:1.3;font-weight:700;background:var(--gw-surface-accent-tint);color:var(--gw-text-secondary);border:var(--gw-border-w) solid var(--gw-neutral-border);border-radius:var(--gw-radius-pill);padding:.15rem .55rem;white-space:nowrap}
/* Trust tones — the backend ui_status decides which, never the UI; the glyph +
   word (set in markup) carry the state, so colour is reinforcement (§3). */
.gw-tone-ok{background:var(--gw-ok-bg);color:var(--gw-ok-text);border-color:var(--gw-ok-text)}
.gw-tone-caution{background:var(--gw-caution-bg);color:var(--gw-caution-text);border-color:var(--gw-caution-text)}
.gw-tone-stop{background:var(--gw-stop-bg);color:var(--gw-stop-text);border-color:var(--gw-stop-border)}
.gw-tone-neutral{background:var(--gw-surface-accent-tint);color:var(--gw-accent);border-color:var(--gw-accent)}
.gw-badge-ai{background:var(--gw-caution-bg);color:var(--gw-caution-text);border-color:var(--gw-caution-text)}
/* GOV-314 — provenance / audit-passed trust badge (reviewer-internal lane only).
   Distinguished by icon + text (not colour alone) and an inset ring so it reads
   as a provenance verdict, distinct from the ui_status trust badge. Reuses the
   ok/caution tones; the leading glyph (✓ / ⚠) carries the state without colour. */
.gw-prov{display:inline-flex;align-items:center;gap:.15rem;box-shadow:inset 0 0 0 1px rgba(0,0,0,.04)}
.gw-prov-icon{font-weight:800;font-size:1.05em;line-height:1}
/* GOV-293 — sharp at-a-glance attribution + confidence trail (never blurred).
   Distinct from the trust badge: these are metadata, not a trust verdict. */
.gw-meta{display:flex;gap:var(--gw-space-2) .9rem;flex-wrap:wrap;margin:.1rem 0 var(--gw-space-2);font-size:var(--gw-text-badge);line-height:1.35}
.gw-speaker{color:var(--gw-text)}
.gw-confidence{color:var(--gw-accent);background:var(--gw-surface-accent-tint);border:var(--gw-border-w) solid var(--gw-accent);border-radius:var(--gw-radius-pill);padding:.05rem .5rem;white-space:nowrap}
.gw-meta-key{color:var(--gw-text-muted);font-weight:600}
.gw-legend{border:var(--gw-border-w) solid var(--gw-border);background:var(--gw-surface-subtle);border-radius:var(--gw-radius);margin:var(--gw-space-2) 0 var(--gw-space-4);padding:0 var(--gw-space-3)}
.gw-legend summary{cursor:pointer;font-size:.9rem;font-weight:600;color:var(--gw-accent);min-height:var(--gw-tap-min);box-sizing:border-box;display:flex;align-items:center}
.gw-legend-list{list-style:none;margin:0 0 var(--gw-space-3);padding:0;display:flex;flex-direction:column;gap:var(--gw-space-2)}
.gw-legend-row{display:grid;grid-template-columns:11rem 1fr;gap:var(--gw-space-2);align-items:start;font-size:.82rem}
.gw-legend-meaning{color:var(--gw-text-secondary)}
@media (max-width:420px){.gw-legend-row{grid-template-columns:1fr;gap:.15rem}}
.gw-statement{margin:var(--gw-space-1) 0}
.gw-analysis{border-left:3px solid var(--gw-caution-line);background:var(--gw-caution-bg-soft);padding:var(--gw-space-1) var(--gw-space-3);border-radius:var(--gw-radius-sm);margin:var(--gw-space-1) 0}
.gw-analysis-caption{font-size:var(--gw-text-xs);font-weight:600;margin:.1rem 0;text-transform:uppercase;letter-spacing:.02em}
.gw-provenance{font-size:.75rem;margin:.2rem 0}
.gw-related-list{list-style:none;padding:0;margin:var(--gw-space-1) 0;display:flex;flex-direction:column;gap:.2rem}
.gw-related{font-size:var(--gw-text-sm)}
.gw-related-type{font-weight:700;background:var(--gw-surface-accent-tint);color:var(--gw-accent);border:var(--gw-border-w) solid var(--gw-accent);border-radius:var(--gw-radius-sm);padding:.05rem .35rem}
.gw-drawer summary{cursor:pointer;font-size:.9rem;color:var(--gw-accent);padding:var(--gw-space-3) .2rem;min-height:var(--gw-tap-min);box-sizing:border-box;display:flex;align-items:center}
.gw-source-list{display:flex;flex-direction:column;gap:var(--gw-space-3);margin-top:var(--gw-space-2)}
.gw-source{border-top:var(--gw-border-w) solid var(--gw-border-subtle);padding-top:var(--gw-space-2);margin:0;display:grid;grid-template-columns:auto;gap:.15rem}
.gw-field{display:grid;grid-template-columns:9rem 1fr;gap:var(--gw-space-2);font-size:var(--gw-text-sm)}
.gw-field dt{color:var(--gw-text-muted);margin:0}
.gw-field dd{margin:0}
@media (max-width:420px){.gw-field{grid-template-columns:1fr}.gw-field dt{font-weight:600}}
/* GOV-301 — completeness-gap card. Surfaces what is MISSING (the ~90
   no_primary_source meetings). Caution-toned frame so it reads as a gap/status
   surface, distinct from a record card. */
.gw-gapcard{border:var(--gw-border-w) solid var(--gw-caution-line);background:var(--gw-caution-bg-soft);border-radius:var(--gw-radius);padding:.7rem .9rem;margin:var(--gw-space-3) 0}
.gw-gapcard h2{font-size:1rem;margin:.2rem 0 .35rem}
.gw-gapcard-headline{margin:.2rem 0;font-size:var(--gw-text-body)}
.gw-gapcard-headline strong{font-size:var(--gw-text-lg);color:var(--gw-caution-text)}
.gw-gap-type-list{list-style:none;margin:var(--gw-space-2) 0 .2rem;padding:0;display:flex;flex-wrap:wrap;gap:.35rem}
.gw-gap-type{display:inline-flex;align-items:center;gap:var(--gw-space-2);background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-caution-line);border-radius:var(--gw-radius-sm);padding:.15rem .5rem;font-size:var(--gw-text-sm)}
.gw-gap-count{font-size:var(--gw-text-xs);font-weight:700;background:var(--gw-caution-text);color:var(--gw-accent-text-on);border-radius:var(--gw-radius-pill);padding:0 var(--gw-space-2);min-width:1.2rem;text-align:center}
.gw-gap-drawer summary{font-weight:600}
.gw-gap-meeting-list{list-style:none;margin:var(--gw-space-2) 0 0;padding:0;display:flex;flex-direction:column;gap:var(--gw-space-1)}
.gw-gap-meeting{display:flex;align-items:center;gap:var(--gw-space-2);flex-wrap:wrap;border-top:var(--gw-border-w) solid var(--gw-border-subtle);padding-top:var(--gw-space-1);font-size:var(--gw-text-sm)}
.gw-gap-subject{font-weight:700;font-variant-numeric:tabular-nums}
.gw-gap-detail{flex:1 1 12rem;min-width:0}
.gw-thread{border:var(--gw-border-w) solid var(--gw-border);background:var(--gw-surface-subtle);border-radius:var(--gw-radius);padding:.7rem .9rem;margin:var(--gw-space-3) 0}
.gw-thread h2{font-size:1rem;margin:.2rem 0 .35rem}
.gw-completeness{margin:.2rem 0 var(--gw-space-3)}
.gw-completeness-badge{font-size:var(--gw-text-badge);line-height:1.3;font-weight:700;border-radius:var(--gw-radius-pill);padding:.15rem .55rem;white-space:nowrap;border:var(--gw-border-w) solid}
.gw-completeness-complete{background:var(--gw-ok-bg);color:var(--gw-ok-text);border-color:var(--gw-ok-text)}
.gw-completeness-gaps{background:var(--gw-stop-bg);color:var(--gw-stop-text);border-color:var(--gw-stop-border)}
.gw-completeness-unknown{background:var(--gw-surface-accent-tint);color:var(--gw-text-secondary);border-color:var(--gw-border-strong)}
.gw-gap-list{list-style:disc;margin:.35rem 0 0;padding-left:1.2rem;font-size:var(--gw-text-sm)}
.gw-gap-kind{font-weight:600}
.gw-thread-list{list-style:none;margin:var(--gw-space-1) 0 0;padding:0;display:flex;flex-direction:column;gap:var(--gw-space-2)}
.gw-thread-instance{border-left:3px solid var(--gw-accent);background:var(--gw-surface);border-radius:0 var(--gw-radius-sm) var(--gw-radius-sm) 0;padding:.35rem var(--gw-space-3)}
.gw-instance-head{display:flex;gap:var(--gw-space-2);align-items:baseline;flex-wrap:wrap}
.gw-instance-date{font-size:.75rem;font-variant-numeric:tabular-nums}
.gw-instance-title{font-weight:600;font-size:.9rem}
.gw-no-link{font-size:.78rem;font-style:italic;margin:.2rem 0 0}
/* GOV-153 #1 — side time-bar layout. Navigator sits beside the timeline on wide
   viewports and stacks above it on the mobile floor. */
.gw-timeline-layout{display:flex;gap:var(--gw-space-5);align-items:flex-start}
.gw-timeline-layout .gw-timeline{flex:1 1 auto;min-width:0}
.gw-timenav{flex:0 0 auto;display:flex;gap:var(--gw-space-2);position:sticky;top:.5rem;background:var(--gw-surface-subtle);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-3)}
.gw-tn-col{display:flex;flex-direction:column;min-width:3.2rem}
.gw-tn-head{font-size:.7rem;text-transform:uppercase;letter-spacing:.04em;color:var(--gw-text-muted);margin:.1rem 0 var(--gw-space-1);text-align:center}
.gw-tn-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.2rem;max-height:60vh;overflow-y:auto}
.gw-tn-btn{display:flex;align-items:center;justify-content:space-between;gap:var(--gw-space-1);width:100%;min-height:var(--gw-tap-min);box-sizing:border-box;cursor:pointer;font-size:var(--gw-text-badge);font-weight:600;background:var(--gw-surface);color:var(--gw-accent);border:var(--gw-border-w) solid var(--gw-accent);border-radius:var(--gw-radius-sm);padding:.2rem .45rem}
.gw-tn-btn:hover{background:var(--gw-surface-accent-tint)}
.gw-tn-btn:focus-visible{outline:2px solid var(--gw-accent);outline-offset:1px}
.gw-tn-active{background:var(--gw-accent);color:var(--gw-accent-text-on);border-color:var(--gw-accent)}
.gw-tn-count{font-size:.65rem;font-weight:700;background:rgba(0,0,0,.08);color:inherit;border-radius:var(--gw-radius-pill);padding:0 .35rem;min-width:1.1rem;text-align:center}
.gw-tn-active .gw-tn-count{background:rgba(255,255,255,.25)}
@media (max-width:640px){.gw-timeline-layout{flex-direction:column}.gw-timenav{position:static;width:100%;justify-content:space-between}.gw-tn-col{flex:1}.gw-tn-list{flex-direction:row;flex-wrap:wrap;max-height:none}}
/* GOV-153 #2 — click-to-reveal blur. The record INFO is blurred + inert until
   revealed; the trust/AI badges live OUTSIDE this region and are never blurred,
   so an AI row can't read as fact while hidden. */
.gw-reveal-btn{display:inline-flex;align-items:center;min-height:var(--gw-tap-min);box-sizing:border-box;cursor:pointer;font-size:.82rem;font-weight:600;color:var(--gw-accent);background:var(--gw-surface-accent-tint);border:var(--gw-border-w) solid var(--gw-accent);border-radius:var(--gw-radius-sm);padding:.2rem .7rem;margin:.1rem 0 var(--gw-space-2)}
.gw-reveal-btn:focus-visible{outline:2px solid var(--gw-accent);outline-offset:1px}
.gw-card-info{filter:blur(6px);user-select:none;pointer-events:none;transition:filter .15s ease}
.gw-card.gw-revealed .gw-card-info{filter:none;user-select:auto;pointer-events:auto}
@media (prefers-reduced-motion:reduce){.gw-card-info{transition:none}}
/* GOV-600 — Kanban board shell. Wider than the 48rem reading column so lanes get
   room; the board itself owns the deep dark-first --gw-board-bg elevation so the
   surface reads as one intentional dark plane (not darkened light cards). */
.gw-root.gw-boards-root{max-width:76rem}
.gw-boards{width:100%}
.gw-h1{font-size:1.5rem;line-height:var(--gw-leading-tight);color:var(--gw-text);margin:.2rem 0 var(--gw-space-3)}
/* View toggle — segmented tablist. Default (Agendas by meeting) is pre-selected. */
.gw-view-toggle{display:inline-flex;gap:0;background:var(--gw-lane-bg);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);padding:.2rem;margin:var(--gw-space-2) 0 var(--gw-space-4)}
.gw-view-tab{min-height:var(--gw-tap-min);box-sizing:border-box;cursor:pointer;font:600 var(--gw-text-badge)/1.2 var(--gw-font);color:var(--gw-text-secondary);background:transparent;border:0;border-radius:var(--gw-radius-pill);padding:.35rem 1rem;white-space:nowrap}
.gw-view-tab:focus-visible{outline:2px solid var(--gw-accent);outline-offset:2px}
.gw-view-tab[aria-selected="true"]{background:var(--gw-accent);color:var(--gw-accent-text-on)}
/* Board scroller: vertical lanes, horizontal overflow — the reference pattern. */
.gw-board{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(var(--gw-lane-min),1fr);gap:var(--gw-space-4);overflow-x:auto;padding:var(--gw-space-4);background:var(--gw-board-bg);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);align-items:start}
.gw-lane{background:var(--gw-lane-bg);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);display:flex;flex-direction:column;min-width:0}
.gw-lane-header{background:var(--gw-lane-header-bg);border-bottom:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius) var(--gw-radius) 0 0;padding:var(--gw-space-3) var(--gw-space-4);position:sticky;top:0}
.gw-lane-title{display:flex;align-items:center;gap:var(--gw-space-2);flex-wrap:wrap}
.gw-lane-name{font-weight:700;font-size:var(--gw-text-body);color:var(--gw-text)}
.gw-lane-count{font-size:var(--gw-text-xs);font-weight:700;background:var(--gw-accent);color:var(--gw-accent-text-on);border-radius:var(--gw-radius-pill);padding:0 var(--gw-space-2);min-width:1.4rem;text-align:center}
.gw-lane-sub{font-size:var(--gw-text-sm);color:var(--gw-text-muted);margin:.15rem 0 0}
.gw-lane-body{display:flex;flex-direction:column;gap:var(--gw-space-3);padding:var(--gw-space-3);min-height:2rem}
/* Cards inside a lane sit on the raised --gw-card-bg (top of the elevation ladder). */
.gw-board .gw-card{background:var(--gw-card-bg);margin:0}
.gw-lane-empty{font-size:var(--gw-text-sm);color:var(--gw-text-muted);font-style:italic;padding:var(--gw-space-2)}
/* Board B — as-of date scrubber. Real <button>s ≥44px (tap + keyboard). */
.gw-scrubber{display:flex;align-items:center;gap:var(--gw-space-3);flex-wrap:wrap;background:var(--gw-lane-bg);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-3) var(--gw-space-4);margin:0 0 var(--gw-space-4)}
.gw-scrub-btn{min-height:var(--gw-tap-min);min-width:var(--gw-tap-min);cursor:pointer;font:700 var(--gw-text-body)/1 var(--gw-font);color:var(--gw-accent);background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-accent);border-radius:var(--gw-radius-sm);padding:.2rem .7rem}
.gw-scrub-btn:focus-visible{outline:2px solid var(--gw-accent);outline-offset:1px}
.gw-scrub-btn[disabled]{opacity:.4;cursor:not-allowed}
.gw-scrub-asof{font-weight:700;color:var(--gw-text);font-variant-numeric:tabular-nums}
.gw-scrub-note{flex:1 1 14rem;font-size:var(--gw-text-sm);color:var(--gw-text-muted);min-width:0}
/* Board B — thread card face (reuses trust surfaces; adds a status/span header). */
.gw-thread-card{background:var(--gw-card-bg);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-3) var(--gw-space-4)}
.gw-thread-card h3{font-size:var(--gw-text-body);margin:.1rem 0 var(--gw-space-2)}
.gw-thread-span{font-size:var(--gw-text-sm);color:var(--gw-text-muted);font-variant-numeric:tabular-nums}
.gw-thread-edges{list-style:none;margin:var(--gw-space-2) 0 0;padding:0;display:flex;flex-direction:column;gap:.2rem}
.gw-synthetic-banner{background:var(--gw-surface-accent-tint);border:var(--gw-border-w) dashed var(--gw-accent);color:var(--gw-text-secondary);border-radius:var(--gw-radius);padding:var(--gw-space-2) var(--gw-space-4);margin:0 0 var(--gw-space-4);font-size:var(--gw-text-sm)}
.gw-context-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--gw-space-4);min-width:0}
.gw-context-heading .gw-h1{min-width:0}
/* Mobile floor — lanes stack full width, board stops being a horizontal rail. */
@media (max-width:640px){.gw-board{grid-auto-flow:row;grid-auto-columns:auto;overflow-x:visible}.gw-lane-header{position:static}}
`;

let styleInjected = false;
/**
 * Inject the shared reviewer-internal stylesheet once. Exported (GOV-600) so the
 * Kanban board surface can guarantee the `.gw-card` / drawer / badge styles it
 * reuses are present, using the SAME single stylesheet (no duplicate CSS).
 */
export function ensureStyle(): void {
  if (styleInjected) return;
  document.head.append(el('style', {}, [STYLE]));
  styleInjected = true;
}

/** Render the current state into `root`. Always shows the fixture banner in fixture mode. */
export function render(
  root: HTMLElement,
  state: AsyncState<ReadApiResponse>,
  notice?: string,
  info: RecordSurfaceInfoOptions = {},
): void {
  ensureStyle();
  const view = stateView(state, notice);
  const access = state.status === 'ready' && state.data
    ? state.data.access
    : info.access;
  const contextualInfoNote =
    access === 'reviewer_internal' ? info.infoNoteId : undefined;
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
    root.append(
      recordSurfaceHeading(view.heading, contextualInfoNote, info.headingLevel),
      el('p', { class: 'gw-muted' }, [view.message]),
      readyView(state.data),
    );
    return;
  }

  root.append(
    el('section', { class: 'gw-state', 'data-state': view.kind, 'data-test': `state-${view.kind}`, role: view.kind === 'error' ? 'alert' : 'status' }, [
      recordSurfaceHeading(view.heading, contextualInfoNote, info.headingLevel),
      el('p', {}, [view.message]),
    ]),
  );
}
