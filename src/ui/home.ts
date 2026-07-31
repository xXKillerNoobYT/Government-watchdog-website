import type { AgendaBoard, AgendaBoardCard } from '../types/agenda-board';
import type { ReadApiResponse, StatementRecord } from '../types/read-api';
import type { CardFeed, CardFeedCard, PresentCard } from './card-feed';
import type { NewsletterDigest, NewsletterDigestResponse, NewsletterItem } from '../types/newsletter-digest';
import { GW_TOKENS } from './tokens';
import { readMode } from './shell';
import { claimPresentation } from './newsletter';
import { comingSoonNote } from './coming-soon';
import { AI_LABEL_TEXT } from './state-view';
import { ensureStyle, recordCard } from './render';
import {
  renderPrivateInfoNote,
  renderPrivateUnavailableInfoNote,
  type PrivateInfoNoteId,
} from './private-info-note';
import {
  renderProjectionGap,
  renderReviewerContextState,
  type ProjectionGapDefinition,
} from './reviewer-context-state';
import { safeExternalHref } from '../data/web-safe';

export type HomeLevel = 'all' | 'town' | 'county' | 'state';

interface HomeOptions {
  cardFeed: CardFeed;
  board: AgendaBoard;
  newsletter: NewsletterDigestResponse;
  /** Explicit route access lane. Any value other than reviewer_internal fails closed. */
  access?: string;
  demo?: boolean;
  /**
   * The gated design-fixture lane (`demo=design`). Deliberately SEPARATE from
   * `demo`: GOV-76: `renderHomeRoute` used to collapse both into one flag, so the
   * design lane could only ever show the DEV-sample widgets. Reviewer access is
   * enforced upstream — renderHome fails closed before any widget renders.
   */
  designFixture?: boolean;
  sampleBoard?: AgendaBoard;
}

interface HomeModel {
  level: HomeLevel;
  presentCards: PresentCard[];
  newsletterItems: NewsletterItem[];
  primaryDigest: NewsletterDigest | null;
  boardCards: AgendaBoardCard[];
  demoCards: AgendaBoardCard[];
  sourceCount: number;
}

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

function isPresentCard(card: CardFeedCard): card is PresentCard {
  return card.type !== 'source_missing';
}

function allBoardCards(board: AgendaBoard): AgendaBoardCard[] {
  return board.lanes.flatMap((lane) => lane.cards);
}

function cardLevel(card: PresentCard): HomeLevel {
  return card.jurisdiction === 'alpine' ? 'town' : 'all';
}

function itemLevel(item: NewsletterItem): HomeLevel {
  if (item.jurisdiction.town === 'Alpine') return 'town';
  if (item.jurisdiction.county) return 'county';
  return 'state';
}

function matchesLevel(level: HomeLevel, card: PresentCard): boolean {
  return level === 'all' || cardLevel(card) === level;
}

function matchesItemLevel(level: HomeLevel, item: NewsletterItem): boolean {
  return level === 'all' || itemLevel(item) === level;
}

function titleForCard(card: PresentCard): string {
  return card.title ?? card.reviewed_summary ?? card.handle;
}

function statusText(status: string): string {
  return status.replace(/_/g, ' ');
}

function sourceTotal(items: NewsletterItem[]): number {
  return items.reduce((total, item) => total + item.sourceTrail.length, 0);
}

function makeModel(opts: HomeOptions, level: HomeLevel): HomeModel {
  const digest = opts.newsletter.digests[0] ?? null;
  const digestItems = digest?.items ?? [];
  const newsletterItems = digestItems.filter((item) => matchesItemLevel(level, item));
  const townBoardVisible = level === 'all' || level === 'town';
  return {
    level,
    presentCards: opts.cardFeed.cards.filter(isPresentCard).filter((card) => matchesLevel(level, card)),
    newsletterItems,
    primaryDigest: digest,
    boardCards: townBoardVisible ? allBoardCards(opts.board) : [],
    demoCards: townBoardVisible && opts.sampleBoard ? allBoardCards(opts.sampleBoard) : [],
    sourceCount: sourceTotal(newsletterItems),
  };
}

function levelFilter(level: HomeLevel, onSelect: (level: HomeLevel) => void): HTMLElement {
  const wrap = el('div', { class: 'gw-home-levels', role: 'group', 'aria-label': 'Jurisdiction level filter', 'data-test': 'home-level-filter' });
  const levels: { value: HomeLevel; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'town', label: 'Town' },
    { value: 'county', label: 'County' },
    { value: 'state', label: 'State' },
  ];
  for (const opt of levels) {
    const active = opt.value === level;
    const btn = el('button', {
      type: 'button',
      class: `gw-home-level gw-level-${opt.value}`,
      'aria-pressed': active ? 'true' : 'false',
      'data-test': `home-level-${opt.value}`,
    }, [opt.label]);
    btn.addEventListener('click', () => onSelect(opt.value));
    wrap.append(btn);
  }
  wrap.append(renderPrivateInfoNote('home-jurisdiction-filter'));
  return wrap;
}

function headingWithNote(
  tag: 'h1' | 'h2' | 'h3',
  title: string,
  noteId: PrivateInfoNoteId,
): HTMLElement {
  return el('div', { class: 'gw-home-title-with-note' }, [
    el(tag, {}, [title]),
    renderPrivateInfoNote(noteId),
  ]);
}

function widget(
  title: string,
  kicker: string,
  children: (Node | string)[],
  attrs: Record<string, string> = {},
  noteId?: PrivateInfoNoteId,
): HTMLElement {
  return el('section', { class: 'gw-home-widget', ...attrs }, [
    el('div', { class: 'gw-home-widget-head' }, [
      el('p', { class: 'gw-home-kicker' }, [kicker]),
      noteId ? headingWithNote('h2', title, noteId) : el('h2', {}, [title]),
    ]),
    ...children,
  ]);
}

function honestEmpty(title: string, body: string, source: string): HTMLElement {
  const slug = title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return el('div', { class: 'gw-home-empty', 'data-test': 'home-honest-empty' }, [
    el('div', { class: 'gw-home-empty-title' }, [
      el('strong', {}, [title]),
      renderPrivateUnavailableInfoNote({
        id: `home-${slug}`,
        title,
        what: body,
        source,
        filedUnder: 'Home · Honest-empty module',
        expectedResult: 'This same module will show only a reviewed, authorized result with its source, status, freshness, limitations, and route to the complete evidence.',
      }),
    ]),
    el('p', {}, [body]),
    el('p', { class: 'gw-home-source-note' }, [source]),
  ]);
}

function demoBanner(designFixture: boolean): HTMLElement {
  return el('div', {
    class: 'gw-home-demo',
    role: 'status',
    'data-test': 'home-demo-banner',
    'data-origin': 'fixture',
  }, [
    designFixture
      ? 'SYNTHETIC DESIGN FIXTURE — not a live read. DEV SAMPLE synthetic modules: Fast Agenda, Transparency Alerts, Source Vault, Latest Verdict, and Language Watch. Civic Weather, Active Issues, Timeline Preview, and newsletter content remain reviewed snapshot data; every remaining designed gap stays empty.'
      : 'SYNTHETIC DESIGN FIXTURE — not a live read. DEV SAMPLE synthetic modules: Fast Agenda, Transparency Alerts, and Source Vault. Civic Weather, Active Issues, Timeline Preview, and newsletter content remain reviewed snapshot data; designed gaps remain empty.',
  ]);
}

function civicWeather(model: HomeModel, nested = false): HTMLElement {
  const realEvents = model.presentCards.length;
  const items = [
    { key: 'reviewed-records', label: 'Reviewed records', value: String(realEvents), state: realEvents ? 'REAL timeline cards in the reviewer-internal feed.' : 'No reviewed activity summary yet — the archive is still filling in.', origin: 'reviewed_snapshot' },
    { key: 'agenda-cards', label: 'Agenda cards', value: String(model.boardCards.length), state: model.boardCards.length ? 'REAL agenda projection cards.' : 'No reviewed agenda-card rollup yet.', origin: 'reviewed_snapshot' },
    { key: 'source-receipts', label: 'Source receipts', value: String(model.sourceCount), state: model.sourceCount ? 'REAL digest source trails.' : 'Source counts need the vault projection.', origin: 'reviewed_snapshot' },
    { key: 'changes-votes', label: 'Changes/votes', value: '—', state: 'No weekly change/vote aggregate endpoint is live yet.', origin: 'designed-gap' },
  ];
  return el('section', { class: 'gw-home-weather', 'data-test': 'home-civic-weather' }, [
    el('div', {}, [
      el('p', { class: 'gw-home-kicker' }, ['CIVIC WEATHER']),
      headingWithNote(
        nested ? 'h2' : 'h1',
        'Alpine government dashboard',
        nested ? 'home-summary' : 'home-overview',
      ),
      el('div', { class: 'gw-home-summary-copy' }, [
        el('p', {}, ['Reviewed records first, honest-empty where the archive or backend projection is not ready yet.']),
        ...(nested ? [] : [renderPrivateInfoNote('home-summary')]),
      ]),
    ]),
    el('div', { class: 'gw-home-weather-grid' }, items.map((item) =>
      el('article', { class: 'gw-home-stat', 'data-metric': item.key, 'data-origin': item.origin }, [
        el('span', {}, [item.label]),
        el('strong', {}, [item.value]),
        el('small', {}, [item.state]),
      ]),
    )),
  ]);
}

function fastAgenda(model: HomeModel, demo: boolean): HTMLElement {
  const cards = demo ? model.demoCards.slice(0, 3) : model.boardCards.slice(0, 3);
  if (!cards.length) {
    if (demo) {
      return widget('Fast Agenda', 'DEV SAMPLE', [
        honestEmpty(
          'No sample agenda cards for this level',
          'The synthetic Alpine/Town agenda cards do not populate County or State filters.',
          'Source: explicit reviewer design fixture; no civic record is inferred for this filter.',
        ),
      ], { 'data-test': 'home-fast-agenda', 'data-origin': 'fixture' }, 'home-fast-agenda');
    }
    return widget('Fast Agenda', 'NEXT MEETING', [
      honestEmpty(
        'No upcoming reviewed meeting records',
        'Meeting agenda cards will appear here after the agenda-thread and meeting-id contract lands in the reviewed projection.',
        'Source: GOV-605 board projection today reports an honest empty board for the real Alpine corpus.',
      ),
    ], { 'data-test': 'home-fast-agenda', 'data-origin': 'reviewed_snapshot' }, 'home-fast-agenda');
  }
  return widget('Fast Agenda', demo ? 'DEV SAMPLE' : 'NEXT MEETING', [
    ...cards.map((card) => el('article', { class: 'gw-home-mini-card', 'data-test': 'home-agenda-card', 'data-origin': demo ? 'fixture' : 'reviewed_snapshot' }, [
      el('span', { class: 'gw-home-chip gw-level-town' }, ['TOWN']),
      el('h3', {}, [card.agendaItemTitle ?? card.agendaItemId]),
      el('p', {}, [[card.meetingDate, card.meetingBody, card.laneLabel].filter(Boolean).join(' · ')]),
    ])),
  ], { 'data-test': 'home-fast-agenda', 'data-origin': demo ? 'fixture' : 'reviewed_snapshot' }, 'home-fast-agenda');
}

function transparencyAlerts(demo: boolean): HTMLElement {
  if (!demo) {
    return widget('Transparency Alerts', 'HIDDEN THINGS', [
      honestEmpty(
        'Document-change tracking is not live yet',
        'Late packet, missing-video, and quiet-edit alerts will appear here when the version-diff pipeline is live and reviewed.',
        'Source: future document version-diff projection; no claims are made before that contract exists.',
      ),
    ], { 'data-test': 'home-transparency-alerts', 'data-origin': 'designed-gap' }, 'home-transparency-alerts');
  }
  return widget('Transparency Alerts', 'DEV SAMPLE', [
    el('article', { class: 'gw-home-mini-card', 'data-origin': 'fixture' }, [
      el('span', { class: 'gw-home-chip gw-tone-caution' }, ['SAMPLE']),
      el('h3', {}, ['Packet changed after posting']),
      el('p', {}, ['Demonstration only — not a real Alpine alert.']),
    ]),
  ], { 'data-test': 'home-transparency-alerts', 'data-origin': 'fixture' }, 'home-transparency-alerts');
}

function activeIssues(model: HomeModel): HTMLElement {
  if (!model.presentCards.length) {
    return widget('Active Issues', 'SOURCE-BACKED ROWS', [
      honestEmpty(
        `No ${model.level === 'all' ? '' : model.level + ' '}reviewed issue rows in this view`,
        'Issue rows derive from reviewed topic/card records only. Empty filters mean no matching reviewed records, not a broken dashboard.',
        'Source: GOV-347 card feed and GOV-149 topic projection.',
      ),
    ], { 'data-test': 'home-active-issues', 'data-origin': 'reviewed_snapshot' }, 'home-active-issues');
  }
  return widget('Active Issues', 'SOURCE-BACKED ROWS', [
    el('p', { class: 'gw-home-source-note', 'data-test': 'home-issues-record-disclosure' }, [
      'Reviewed card-feed records — not typed or inferred issue threads.',
    ]),
    el('div', { class: 'gw-home-issue-list' }, model.presentCards.slice(0, 5).map((card) =>
      el('article', { class: 'gw-home-issue-row', 'data-test': 'home-issue-row', 'data-origin': 'reviewed_snapshot' }, [
        el('span', { class: 'gw-home-chip gw-level-town' }, ['TOWN']),
        el('div', {}, [
          el('h3', {}, [titleForCard(card)]),
          el('p', {}, ['Alpine · Timeline · ', statusText(card.status)]),
        ]),
        el('a', { href: '#/cards', class: 'gw-home-link' }, ['receipts ›']),
      ]),
    )),
  ], { 'data-test': 'home-active-issues', 'data-origin': 'reviewed_snapshot' }, 'home-active-issues');
}

function timelinePreview(model: HomeModel): HTMLElement {
  if (!model.presentCards.length) {
    return widget('Timeline Preview', 'LATEST REVIEWED EVENTS', [
      honestEmpty(
        'No reviewed timeline events for this filter',
        'Latest events will show here directly from the reviewer-internal Alpine projection.',
        'Source: the same reviewed read/card projection that powers #/timeline and #/cards.',
      ),
    ], { 'data-test': 'home-timeline-preview', 'data-origin': 'reviewed_snapshot' }, 'home-timeline-preview');
  }
  return widget('Timeline Preview', 'LATEST REVIEWED EVENTS', [
    el('ol', { class: 'gw-home-timeline' }, model.presentCards.slice(0, 4).map((card) =>
      el('li', { 'data-test': 'home-timeline-event', 'data-origin': 'reviewed_snapshot' }, [
        el('time', {}, [card.date ?? 'undated']),
        el('div', {}, [
          el('span', {}, [titleForCard(card)]),
          el('div', { class: 'gw-home-record-meta' }, [
            el('span', {
              class: 'gw-home-chip',
              'data-test': 'home-timeline-status',
              'data-status': card.status,
            }, [statusText(card.status)]),
            ...(card.confidence_label ? [el('span', { class: 'gw-home-chip', 'data-test': 'home-timeline-confidence' }, [card.confidence_label])] : []),
            ...(card.provenance_status ? [el('span', { class: 'gw-home-chip', 'data-test': 'home-timeline-provenance' }, [card.provenance_status])] : []),
            el('a', { href: '#/cards', class: 'gw-home-link', 'data-test': 'home-timeline-receipts' }, [
              `${card.evidence?.length ?? 0} receipt${(card.evidence?.length ?? 0) === 1 ? '' : 's'} ›`,
            ]),
          ]),
        ]),
      ]),
    )),
    el('a', { href: '#/timeline', class: 'gw-home-link' }, ['Timeline ›']),
  ], { 'data-test': 'home-timeline-preview', 'data-origin': 'reviewed_snapshot' }, 'home-timeline-preview');
}

function sourceVault(model: HomeModel, demo: boolean): HTMLElement {
  if (!demo) {
    return widget('Source Vault', 'RECEIPTS', [
      honestEmpty(
        'Source statistics are not wired yet',
        'Counts, hash verification, and latest-source summaries will appear when the source-vault projection is live.',
        'Source: future source-registry stats projection; no vault percentages or verification totals are inferred.',
      ),
      ...(model.sourceCount ? [el('p', { class: 'gw-home-source-note', 'data-origin': 'reviewed_snapshot' }, [
        `The selected digest items carry ${model.sourceCount} source trail receipt${model.sourceCount === 1 ? '' : 's'}.`,
      ])] : []),
    ], { 'data-test': 'home-source-vault', 'data-origin': 'designed-gap' }, 'home-source-vault');
  }
  return widget('Source Vault', 'DEV SAMPLE', [
    el('p', {}, ['Sample source statistics would render here only in demo mode.']),
  ], { 'data-test': 'home-source-vault', 'data-origin': 'fixture' }, 'home-source-vault');
}

/**
 * The design fixture renders the baseline's card GEOMETRY, never a plausible civic
 * claim. A fabricated promise-versus-action pair reads as a live verdict once it is
 * screenshotted; a self-describing placeholder cannot. `reference/README.md`
 * §State Management ("No person-naming in AI analyses") also bars a named official,
 * so the baseline's "R. Roe" is replaced by an unmistakable placeholder rather than
 * transcribed — a Doe-style surname still reads as a person at a glance.
 */
function fixtureLeaf(label: string, text: string): HTMLElement {
  return el('div', { class: 'gw-home-fixture-leaf', 'data-origin': 'fixture' }, [
    el('strong', { class: 'gw-home-fixture-leaf-label' }, [label]),
    el('span', {}, [text]),
  ]);
}

function aiPresented(kind: string): HTMLElement {
  return el('p', { class: 'gw-home-ai', 'data-test': 'home-ai-presented' }, [
    el('strong', { class: 'gw-home-ai-label' }, [`AI-PRESENTED ${kind}`]),
    el('span', { class: 'gw-home-ai-caveat' }, ['not independently verified']),
    el('span', {}, [
      'Synthetic fixture text carries no receipts because no reviewed record backs it. '
      + 'A label is not a legal or political verdict.',
    ]),
  ]);
}

function latestVerdictFixture(): HTMLElement {
  return widget('Latest Verdict', 'PROMISE CONFLICTS · SYNTHETIC DESIGN FIXTURE', [
    el('div', { class: 'gw-home-verdict', 'data-test': 'home-latest-verdict-fixture-card' }, [
      el('p', { class: 'gw-home-verdict-subject' }, ['OFFICIAL A — PLACEHOLDER, not a real person']),
      fixtureLeaf('Promise', 'SYNTHETIC PLACEHOLDER — stands in for a reviewed saved quote.'),
      fixtureLeaf('Action', 'SYNTHETIC PLACEHOLDER — stands in for a reviewed recorded action.'),
      fixtureLeaf('Comparison', 'SYNTHETIC PLACEHOLDER — stands in for a reviewed comparison and its receipts.'),
    ]),
    aiPresented('ANALYSIS'),
    // The baseline draws this card RED. This design system has no red/alert token — only
    // `caution` — and inventing one is a design-system change, not GOV-76's scope. The
    // conflict is therefore carried in TEXT ("PROMISE CONFLICTS"), which the micro-detail
    // rule requires anyway: every state needs text and label, never colour alone.
  ], { 'data-test': 'home-latest-verdict-fixture', 'data-tone': 'caution', 'data-origin': 'fixture' }, 'home-latest-verdict');
}

/** The baseline's three tricky-phrase tiles. Wording patterns, not civic claims. */
const LANGUAGE_WATCH_FIXTURE_PHRASES = [
  '…with ____________',
  'accounted for separately',
  'engagement agreement',
] as const;

function languageWatchFixture(): HTMLElement {
  return widget('Language Watch', 'JUL 21 PACKET · SYNTHETIC DESIGN FIXTURE', [
    el('ul', { class: 'gw-home-phrases', 'data-test': 'home-language-watch-fixture-tiles' },
      LANGUAGE_WATCH_FIXTURE_PHRASES.map((phrase) => el('li', {
        class: 'gw-home-phrase',
        'data-origin': 'fixture',
      }, [phrase]))),
    aiPresented('LANGUAGE WATCH'),
  ], { 'data-test': 'home-language-watch-fixture', 'data-tone': 'caution', 'data-origin': 'fixture' }, 'home-language-watch');
}

function latestVerdict(fixture: boolean): HTMLElement {
  if (fixture) return latestVerdictFixture();
  return widget('Latest Verdict', 'PROMISE CONFLICTS', [
    honestEmpty(
      'No reviewed promise-versus-action verdict is available',
      'Reviewed statements are not verdicts. This slot stays unscored until the backend supplies a saved quote, a recorded action, a reviewed comparison, and the receipts supporting that comparison.',
      'Source: future reviewed promise-versus-action projection; no official, score, or verdict is inferred from the card feed.',
    ),
    el('a', { href: '#/power', class: 'gw-home-link' }, ['Open the Power Tracker baseline ›']),
  ], { 'data-test': 'home-latest-verdict-unavailable', 'data-tone': 'caution', 'data-origin': 'designed-gap' }, 'home-latest-verdict');
}

function languageWatch(fixture: boolean): HTMLElement {
  if (fixture) return languageWatchFixture();
  return widget('Language Watch', 'AI-PRESENTED REVIEW SLOT', [
    honestEmpty(
      'No reviewed language-watch flags are available',
      'The Home route does not classify agenda wording on its own. Exact excerpts, their source anchors, an AI-presented label, and reviewer state must arrive together before this area can identify wording for attention.',
      'Source: future reviewed language-watch projection; ordinary agenda and statement text remains unflagged.',
    ),
  ], { 'data-test': 'home-language-watch-unavailable', 'data-tone': 'caution', 'data-origin': 'designed-gap' }, 'home-language-watch');
}

function explainerVideo(): HTMLElement {
  // Not a designed gap. A gap says a civic record is missing and names the reviewed
  // contract that would fill it; this slot is waiting on a video nobody has made.
  // Promising "no video URL is connected" implies a pipeline that does not exist.
  return widget('How Government Watchdog Works', 'EXPLAINER VIDEO', [
    comingSoonNote(
      'Explainer video',
      'The walkthrough has not been produced. This is a product feature that exists in no lane yet, not a civic record waiting on a reviewed source.',
    ),
    el('a', { href: '#/explainer', class: 'gw-home-link', 'data-test': 'home-explainer-link' }, [
      'What the walkthrough will cover ›',
    ]),
  ], { 'data-test': 'home-explainer-video', 'data-origin': 'coming-soon' }, 'home-explainer');
}

function simpleThings(model: HomeModel): HTMLElement {
  const items = model.newsletterItems.slice(0, 3);
  if (!items.length) {
    return el('section', { class: 'gw-simple-things', 'data-test': 'home-simple-things', 'data-origin': 'reviewed_snapshot' }, [
      el('div', { class: 'gw-home-title-with-note' }, [
        el('p', { class: 'gw-home-kicker' }, ['3 THINGS TO KNOW']),
        renderPrivateInfoNote('home-simple-things'),
      ]),
      honestEmpty(
        'No reviewed briefing items for this filter',
        'The front-page summary uses reviewed digest or briefing items verbatim when present.',
        'Source: Stage 4.05 digest / Stage 4.08 briefing trail.',
      ),
    ]);
  }
  return el('section', { class: 'gw-simple-things', 'data-test': 'home-simple-things', 'data-origin': 'reviewed_snapshot' }, [
    el('div', { class: 'gw-home-title-with-note' }, [
      el('p', { class: 'gw-home-kicker' }, ['3 THINGS TO KNOW']),
      renderPrivateInfoNote('home-simple-things'),
    ]),
    ...items.map((item, idx) => {
      const presentation = claimPresentation(item.labels.claimStatus, item.labels.aiPresented);
      return el('article', { class: 'gw-simple-thing', 'data-test': 'home-simple-item', 'data-origin': 'reviewed_snapshot' }, [
        el('span', {}, [String(idx + 1)]),
        el('div', {}, [
          el('p', {}, [item.summary ?? item.title ?? item.id]),
          el('div', { class: 'gw-home-record-meta' }, [
            el('span', {
              class: `gw-home-chip gw-tone-${presentation.tone}`,
              'data-test': 'home-simple-claim-label',
              'data-claim': presentation.claimStatus,
            }, [presentation.label]),
            ...(presentation.ai ? [el('span', { class: 'gw-home-chip gw-badge-ai', 'data-test': 'home-simple-ai-label' }, [AI_LABEL_TEXT])] : []),
            ...(item.labels.correctionStatus !== 'none'
              ? [el('span', { class: 'gw-home-chip', 'data-test': 'home-simple-correction-label' }, [`Correction: ${item.labels.correctionStatus}`])]
              : []),
            el('a', { href: `#/newsletter?id=${encodeURIComponent(item.newsletterId)}`, class: 'gw-home-link', 'data-test': 'home-simple-item-receipts' }, [
              `${item.sourceTrail.length} receipt${item.sourceTrail.length === 1 ? '' : 's'} ›`,
            ]),
          ]),
        ]),
      ]);
    }),
  ]);
}

function simpleFeatured(model: HomeModel): HTMLElement {
  const item = model.newsletterItems[0] ?? null;
  if (!item) {
    return widget('Featured Story', 'PLAIN ENGLISH FIRST', [
      honestEmpty('No featured story yet', 'A sourced story appears here when a reviewed digest item matches the current filter.', 'Source: reviewed newsletter digest items.'),
    ], { 'data-test': 'home-simple-featured' }, 'home-featured-story');
  }
  const sourceCount = item.sourceTrail.length;
  const presentation = claimPresentation(item.labels.claimStatus, item.labels.aiPresented);
  return el('article', { class: 'gw-simple-feature', 'data-test': 'home-simple-featured', 'data-origin': 'reviewed_snapshot' }, [
    el('p', { class: 'gw-home-kicker' }, ['FEATURED STORY']),
    headingWithNote('h2', item.title ?? item.summary ?? item.id, 'home-featured-story'),
    el('div', { class: 'gw-simple-dek gw-home-record-meta' }, [
      el('span', {}, [item.recordDate]),
      el('span', {
        class: `gw-home-chip gw-tone-${presentation.tone}`,
        'data-test': 'home-simple-feature-claim-label',
        'data-claim': presentation.claimStatus,
      }, [presentation.label]),
      ...(presentation.ai ? [el('span', { class: 'gw-home-chip gw-badge-ai', 'data-test': 'home-simple-feature-ai-label' }, [AI_LABEL_TEXT])] : []),
      ...(item.labels.correctionStatus !== 'none'
        ? [el('span', { class: 'gw-home-chip', 'data-test': 'home-simple-feature-correction-label' }, [`Correction: ${item.labels.correctionStatus}`])]
        : []),
    ]),
    el('div', { class: 'gw-simple-columns' }, [
      el('section', {}, [el('h3', {}, ['PLAIN-ENGLISH SUMMARY']), el('p', {}, [item.summary ?? 'Reviewed digest item.'])]),
      el('section', {}, [el('h3', {}, ['WHY IT MATTERS']), el('p', {}, ['This item is included only because it exists in the reviewer-internal digest trail.'])]),
      el('section', {}, [el('h3', {}, ['NEXT ACTION']), el('p', {}, ['Open the timeline or newsletter detail to inspect the source trail.'])]),
    ]),
    el('a', { href: '#/newsletter', class: 'gw-home-link', 'data-test': 'home-simple-source-link' }, [
      `View ${sourceCount} source trail receipt${sourceCount === 1 ? '' : 's'} ›`,
    ]),
  ]);
}

function editionHistorySelector(): HTMLElement {
  const id = 'gw-home-edition-history';
  return el('div', {
    class: 'gw-home-edition-history',
    'data-test': 'home-edition-history-unavailable',
    'data-origin': 'designed-gap',
  }, [
    el('div', { class: 'gw-home-title-with-note' }, [
      el('label', { for: id }, ['EDITION VERSIONS — archived updates']),
      renderPrivateInfoNote('home-edition-history'),
    ]),
    el('select', {
      id,
      disabled: '',
      'aria-disabled': 'true',
      'data-test': 'home-edition-history-select',
    }, [el('option', {}, ['Edition history unavailable'])]),
    el('p', {}, ['The digest coverage period is not version history. This selector will activate only when the backend provides reviewed edition versions and their archive receipts.']),
  ]);
}

/**
 * GOV-75: the baseline puts an upsell beside the Simple 90-day search field. It
 * vanished rather than being marked, so a reviewer diffing against `Home.dc.html`
 * saw an unexplained omission.
 *
 * It is **CS, not DG**: no payment, plan, entitlement, or account tier exists in any
 * lane, so there is no backend contract to await and none is named here. The
 * baseline's `$25/yr Local Data Geek` figure is deliberately **omitted** — backend
 * #131 has not approved customer-facing plan names or pricing, and printing an
 * unapproved price would be exactly the invented commercial claim this class exists
 * to prevent. Nothing in the slot is focusable, clickable, or linked.
 *
 * `withUpsell` is opt-in because this function also builds the Advanced briefing
 * (`advancedBriefingGroups`), which GOV-75 requires to stay unchanged.
 */
function simpleUpsellSlot(): HTMLElement {
  return el('aside', {
    class: 'gw-simple-tool-upsell',
    'data-test': 'home-simple-upsell',
    'data-origin': 'coming-soon',
  }, [
    comingSoonNote(
      'Supporter plan',
      'There is no paid plan, checkout, account tier, or entitlement anywhere in this beta, '
      + 'and no price has been approved. Nothing on this page can be purchased or subscribed to.',
    ),
  ]);
}

function simpleSearchTools(withUpsell = false): HTMLElement {
  const inputId = 'gw-home-simple-search';
  return el('section', { class: 'gw-simple-tools', 'data-test': 'home-simple-90-day-tools', 'data-origin': 'designed-gap' }, [
    el('div', { class: 'gw-simple-tool-copy' }, [
      el('p', { class: 'gw-home-kicker' }, ['SEARCH THE RECORD']),
      headingWithNote('h2', 'Simple 90-day search', 'home-search'),
      el('p', {}, ['Past 90 days is the intended Simple reading window. The connected digest does not yet provide a reviewed 90-day search index, so no range, match count, or result is claimed here.']),
    ]),
    el('div', { class: 'gw-simple-search', 'data-test': 'home-simple-search-unavailable' }, [
      el('label', { for: inputId }, ['Search agendas, meetings, documents, and issues']),
      el('div', { class: 'gw-simple-search-row' }, [
        el('input', {
          id: inputId,
          type: 'search',
          disabled: '',
          'aria-disabled': 'true',
          placeholder: '90-day search unavailable',
          'data-test': 'home-simple-search-input',
        }),
        el('button', { type: 'button', disabled: '', 'aria-disabled': 'true' }, ['Search unavailable']),
      ]),
      el('small', {}, ['Designed slot · awaiting a reviewed archive-search projection.']),
    ]),
    ...(withUpsell ? [simpleUpsellSlot()] : []),
  ]);
}

function simpleRails(model: HomeModel): HTMLElement {
  return el('aside', { class: 'gw-simple-rail', 'data-test': 'home-simple-rail' }, [
    widget('Sources / Receipts', 'RECEIPTS', [
      model.sourceCount
        ? el('p', {}, [`${model.sourceCount} source trail receipt${model.sourceCount === 1 ? '' : 's'} in the selected digest items.`])
        : honestEmpty('No source trail in this filter', 'Receipts appear when selected briefing items carry source trails.', 'Source: digest sourceTrail.'),
    ], { 'data-origin': 'reviewed_snapshot' }, 'reviewed-source-receipts'),
    widget('History Looks Back', 'ARCHIVE', [
      model.newsletterItems[0]
        ? el('p', {}, [model.newsletterItems[0].summary ?? 'Reviewed historical item available.'])
        : honestEmpty('No historical echo yet', 'Historical items appear only when reviewed digest items are present.', 'Source: Stage 4.08 reviewed historical briefing.'),
      editionHistorySelector(),
    ], { 'data-origin': 'reviewed_snapshot' }),
    widget('Publication Honesty Tracker', 'HONESTY', [
      honestEmpty('Metrics not computed yet', 'Sourced, balanced, clear, and updated scores are not self-asserted until digest metadata can compute them.', 'Source: future digest-metadata metrics projection.'),
    ], { 'data-origin': 'designed-gap' }, 'home-honesty-metrics'),
  ]);
}

function localEditionGaps(): HTMLElement {
  return el('section', { class: 'gw-simple-local-editions', 'data-test': 'home-local-edition-gaps', 'data-origin': 'designed-gap' }, [
    headingWithNote('h2', 'County and State editions', 'home-local-editions'),
    el('div', { class: 'gw-simple-local-boxes' }, [
      widget('County', 'HONEST EMPTY', [honestEmpty('No county dashboard yet', 'County-level rows filter real data and show empty until reviewed county records land.', 'Source: same Alpine-first projections.')]),
      widget('State', 'HONEST EMPTY', [honestEmpty('No state dashboard yet', 'State-level rows filter real data and show empty until reviewed state records land.', 'Source: same Alpine-first projections.')]),
    ]),
  ]);
}

function advancedBriefingGroups(model: HomeModel): HTMLElement {
  return el('div', { class: 'gw-home-advanced-briefing', 'data-test': 'home-advanced-briefing' }, [
    headingWithNote('h2', 'Plain-English briefing and archive tools', 'home-briefing'),
    simpleSearchTools(),
    simpleThings(model),
    el('div', { class: 'gw-home-advanced-briefing-grid' }, [
      simpleFeatured(model),
      simpleRails(model),
    ]),
    localEditionGaps(),
  ]);
}

function simpleAccountabilityGroups(model: HomeModel, opts: HomeOptions): HTMLElement {
  const designFixture = Boolean(opts.designFixture);
  return el('section', {
    class: 'gw-simple-accountability',
    'data-test': 'home-simple-accountability',
    'aria-label': 'Accountability dashboard details',
  }, [
    headingWithNote('h2', 'Accountability dashboard details', 'home-accountability'),
    civicWeather(model, true),
    el('div', { class: 'gw-home-grid' }, [
      el('div', { class: 'gw-home-col' }, [activeIssues(model), timelinePreview(model)]),
      el('div', { class: 'gw-home-col' }, [latestVerdict(designFixture), sourceVault(model, Boolean(opts.demo))]),
      el('div', { class: 'gw-home-col' }, [explainerVideo(), languageWatch(designFixture)]),
    ]),
  ]);
}

function renderAdvanced(root: HTMLElement, model: HomeModel, opts: HomeOptions, setLevel: (level: HomeLevel) => void): void {
  const designFixture = Boolean(opts.designFixture);
  root.append(
    levelFilter(model.level, setLevel),
    civicWeather(model),
    el('div', { class: 'gw-home-grid', 'data-test': 'home-grid' }, [
      el('div', { class: 'gw-home-col' }, [fastAgenda(model, Boolean(opts.demo)), transparencyAlerts(Boolean(opts.demo))]),
      el('div', { class: 'gw-home-col' }, [activeIssues(model), timelinePreview(model)]),
      el('div', { class: 'gw-home-col' }, [latestVerdict(designFixture), sourceVault(model, Boolean(opts.demo)), explainerVideo()]),
    ]),
    languageWatch(designFixture),
    advancedBriefingGroups(model),
  );
}

function renderSimple(root: HTMLElement, model: HomeModel, opts: HomeOptions, setLevel: (level: HomeLevel) => void): void {
  const digestPeriod = model.primaryDigest?.coveragePeriod;
  const dateline = digestPeriod ? `${digestPeriod.startDate}–${digestPeriod.endDate}` : 'Reviewer-internal Alpine edition';
  root.append(
    el('section', { class: 'gw-simple-home', 'data-test': 'home-simple' }, [
      el('header', { class: 'gw-simple-masthead' }, [
        el('p', {}, ['plain English first · official text one tap away']),
        headingWithNote('h1', 'Government Watchdog Weekly', 'home-overview'),
        el('blockquote', {}, ['“Facts are stubborn things.” — John Adams']),
        el('p', {}, [dateline]),
      ]),
      levelFilter(model.level, setLevel),
      simpleSearchTools(true),
      simpleThings(model),
      el('div', { class: 'gw-simple-layout' }, [
        el('aside', { class: 'gw-simple-rail' }, [fastAgenda(model, Boolean(opts.demo)), transparencyAlerts(Boolean(opts.demo))]),
        simpleFeatured(model),
        simpleRails(model),
      ]),
      localEditionGaps(),
      simpleAccountabilityGroups(model, opts),
      el('footer', { class: 'gw-simple-footer' }, ['We Watch. We Report. You Decide. · Switch to Advanced for the denser data-workbench layout.']),
    ]),
  );
}

export function renderHome(root: HTMLElement, opts: HomeOptions): void {
  ensureHomeStyle();
  root.className = 'gw-home-root';
  root.replaceChildren();
  const access = opts.access ?? opts.cardFeed.access;
  const sourceLanesAreReviewerInternal = opts.cardFeed.access === 'reviewer_internal'
    && opts.board.access === 'reviewer_internal'
    && opts.newsletter.access === 'reviewer_internal'
    && (!opts.demo || !opts.sampleBoard || opts.sampleBoard.access === 'reviewer_internal');
  if (access !== 'reviewer_internal' || !sourceLanesAreReviewerInternal) {
    root.append(el('section', {
      class: 'gw-state',
      'data-state': 'empty',
      'data-test': 'state-reviewer-gated',
      role: 'status',
    }, [
      el('h1', {}, ['Reviewer-internal only']),
      el('p', {}, ['The Alpine Home dashboard is gated to the reviewer-internal lane. The public lane renders no civic records.']),
    ]));
    return;
  }
  let level: HomeLevel = 'all';
  const draw = (): void => {
    root.replaceChildren();
    if (opts.demo) root.append(demoBanner(Boolean(opts.designFixture)));
    const mode = readMode();
    const model = makeModel(opts, level);
    if (mode === 'simple') renderSimple(root, model, opts, (next) => { level = next; draw(); });
    else renderAdvanced(root, model, opts, (next) => { level = next; draw(); });
  };
  draw();
}

/**
 * Detailed designed slots that the current reviewer-context response does not
 * supply. These definitions are shared by Simple and Advanced so a presentation
 * preference cannot make a capability, entitlement, or geography appear.
 */
const LIVE_HOME_PROJECTION_GAPS: readonly ProjectionGapDefinition[] = [
  {
    id: 'agenda-board',
    kicker: 'FAST AGENDA',
    title: 'Meeting and agenda projection not available yet',
    whatItDoes: 'Shows upcoming public meetings, official agenda item numbering, packet status, deadlines, and the source receipt for each row.',
    requiredProjection: 'An authorized AgendaBoard response with stable meeting IDs, agenda item IDs, dates, body names, lane states, and web-safe packet receipts.',
    howItWorks: 'The backend reviews and files official meeting records, then returns the agenda projection for the already-authorized record and geography scope. The browser displays those rows without turning statements into agenda items.',
    expectedResult: 'A quick next-meeting view that opens the exact agenda item and its official packet while preserving missing-packet and review warnings.',
    filedUnder: 'Civic records · Meetings and agendas',
  },
  {
    id: 'newsletter-digest',
    kicker: 'PLAIN-ENGLISH BRIEFING',
    title: 'Newsletter digest projection not available yet',
    whatItDoes: 'Provides a short everyday briefing, edition history, corrections, and one-tap source trails without replacing the underlying records.',
    requiredProjection: 'An authorized NewsletterDigest response with stable edition and item IDs, coverage dates, reviewed summaries, backend labels, correction state, and source trails.',
    howItWorks: 'The backend assembles and reviews a versioned digest from eligible records. The website consumes that saved projection verbatim instead of selecting or summarizing records on its own.',
    expectedResult: 'A readable Alpine briefing whose claims, updates, and receipts can be traced to a specific reviewed edition.',
    filedUnder: 'Publications · Reviewed newsletter digest',
  },
  {
    id: 'plan-entitlements',
    kicker: 'PLAN AND TOOLS',
    title: 'Plan-specific tools not available in this response',
    whatItDoes: 'Explains which Free, Pro Town, Pro Home, Pro State, Pro Global, team, beta, or developer capabilities this account may use.',
    requiredProjection: 'A server-authoritative access decision containing the effective program, plan, feature grants, publication lane, decision time, and safe reason codes.',
    howItWorks: 'The server evaluates the account and feature together. The browser may explain the returned decision, but a mode toggle, URL value, or saved setting never creates a grant.',
    expectedResult: 'Only authorized research, export, watchlist, alert, and team tools activate, with a clear explanation when a tool is outside the current plan.',
    filedUnder: 'Product access · Plans and feature entitlements',
  },
  {
    id: 'geography-coverage',
    kicker: 'COVERAGE',
    title: 'Authorized geography and coverage details not available yet',
    whatItDoes: 'Shows the exact town, border-town, county, and state coverage assigned to the account and the source health available for each place.',
    requiredProjection: 'A server-authoritative exact-geography grant plus reviewed coverage metadata for Alpine, Lincoln County, Wyoming, and any later approved location.',
    howItWorks: 'The server intersects the requested feature with the account’s active geography grant. A location picker remains a display/navigation choice and cannot widen the returned record set.',
    expectedResult: 'A clear coverage map and location switcher that displays only authorized places, including honest gaps and the next eligible town-change date where applicable.',
    filedUnder: 'Geography · Authorized coverage',
  },
  {
    id: 'transparency-alerts',
    kicker: 'TRANSPARENCY ALERTS',
    title: 'Reviewed alert projection not available yet',
    whatItDoes: 'Surfaces reviewed late packets, missing media, document revisions, correction events, and other source-backed changes worth checking.',
    requiredProjection: 'An authorized alert feed with stable alert IDs, typed reasons, review state, timestamps, affected record IDs, and before/after source receipts.',
    howItWorks: 'Backend comparison jobs detect a candidate change, a review step confirms its meaning, and the resulting alert is filed before the website displays it.',
    expectedResult: 'A watchable alert inbox where every item explains what changed, when it changed, its review state, and which source proves it.',
    filedUnder: 'Monitoring · Reviewed transparency alerts',
  },
  {
    id: 'source-vault-stats',
    kicker: 'SOURCE VAULT',
    title: 'Source registry statistics not available yet',
    whatItDoes: 'Summarizes source freshness, archive coverage, validation state, corrections, and receipt history across the authorized record set.',
    requiredProjection: 'An authorized source-registry summary with stable source IDs, reviewed validation timestamps, archive state, correction links, and completeness counts.',
    howItWorks: 'The backend calculates source-level status from its reviewed registry. The website may count the receipts attached to this response, but it does not infer vault health from those links.',
    expectedResult: 'A source health overview that opens the exact receipt and distinguishes fresh, changed, incomplete, and corrected material.',
    filedUnder: 'Source Vault · Registry health',
  },
];

function liveReceiptCount(records: readonly StatementRecord[]): number {
  return records.reduce((total, record) => total + (record.evidence?.length ?? 0), 0);
}

function displayValue(value: string): string {
  return value.replace(/_/g, ' ');
}

function liveHomeSummary(
  data: ReadApiResponse,
  records: readonly StatementRecord[],
  headingLevel: 'h1' | 'h2' = 'h1',
  includeRouteNote = true,
): HTMLElement {
  const receiptCount = liveReceiptCount(records);
  const items = [
    {
      key: 'reviewed-records',
      label: 'Reviewed records',
      value: String(records.length),
      detail: 'Exact rows in this authorized response; neither reading mode filters them.',
    },
    {
      key: 'source-receipts',
      label: 'Source receipts',
      value: String(receiptCount),
      detail: 'Exact evidence entries attached to the returned records.',
    },
    {
      key: 'response-scope',
      label: 'Response scope',
      value: data.scope,
      detail: 'Server-provided scope label; detailed geography coverage needs its own grant projection.',
    },
    {
      key: 'access-lane',
      label: 'Access lane',
      value: displayValue(data.access),
      detail: 'Server-provided response lane; this is not a subscription-plan decision.',
    },
  ];
  return el('section', {
    class: 'gw-home-weather gw-home-live-summary',
    'data-test': 'home-live-summary',
    'data-origin': 'reviewer-context',
  }, [
    el('div', {}, [
      el('div', { class: 'gw-home-live-heading' }, [
        el('div', {}, [
          el('p', { class: 'gw-home-kicker' }, ['LIVE REVIEWER CONTEXT']),
          includeRouteNote
            ? headingWithNote(headingLevel, 'Alpine government dashboard', 'home-overview')
            : headingWithNote(headingLevel, 'Alpine government dashboard', 'home-summary'),
        ]),
      ]),
      el('div', { class: 'gw-home-summary-copy' }, [
        el('p', {}, ['One authorized record set, shown with the same IDs, trust labels, provenance, and receipts in Simple and Advanced.']),
        ...(includeRouteNote ? [renderPrivateInfoNote('home-summary')] : []),
      ]),
    ]),
    el('div', { class: 'gw-home-weather-grid' }, items.map((item) =>
      el('article', {
        class: 'gw-home-stat',
        'data-metric': item.key,
        'data-origin': 'reviewer-context',
      }, [
        el('span', {}, [item.label]),
        el('strong', {}, [item.value]),
        el('small', {}, [item.detail]),
      ]),
    )),
  ]);
}

function liveRecordItem(record: StatementRecord): HTMLElement {
  const attrs: Record<string, string> = {
    class: 'gw-home-live-record',
    'data-test': 'home-live-record',
    'data-record-id': record.statement_id,
    'data-receipt-count': String(record.evidence?.length ?? 0),
    'data-origin': 'reviewer-context',
  };
  if (record.ui_status != null) attrs['data-ui-status'] = record.ui_status;
  if (record.provenance_status != null) attrs['data-provenance-status'] = record.provenance_status;
  return el('div', attrs, [
    recordCard(record, undefined, undefined, { reviewerInternal: true }),
  ]);
}

function liveRecords(records: readonly StatementRecord[]): HTMLElement {
  const body = records.length
    ? el('div', { class: 'gw-home-live-record-list' }, records.map(liveRecordItem))
    : renderProjectionGap({
        id: 'reviewed-record-feed',
        kicker: 'REVIEWED RECORDS',
        title: 'No reviewed records are available in this response',
        whatItDoes: 'Lists the source-backed statement records already authorized for this private-beta session.',
        requiredProjection: 'A web-safe reviewer-context response containing at least one eligible StatementRecord with its stable ID and evidence receipts.',
        howItWorks: 'The backend applies publication, provenance, and authorization checks before returning records. The website does not fill an empty response with captured or sample rows.',
        expectedResult: 'Each eligible record appears with the same ID, trust state, provenance state, speaker/confidence labels when supplied, and expandable source receipts.',
        filedUnder: 'Civic records · Reviewed statement feed',
      });
  return el('section', {
    class: 'gw-home-live-records',
    'data-test': 'home-live-records',
    'data-origin': 'reviewer-context',
  }, [
    el('header', { class: 'gw-home-live-records-head' }, [
      el('div', {}, [
        el('p', { class: 'gw-home-kicker' }, ['AUTHORIZED RECORD SET']),
        headingWithNote('h2', 'Reviewed records and receipts', 'home-records'),
      ]),
      el('p', {}, [
        'These are direct response rows, not client-generated agenda items, issues, newsletter stories, scores, or verdicts. Captured and sample records are never substituted or added.',
      ]),
    ]),
    body,
  ]);
}

function liveProjectionGaps(): HTMLElement {
  return el('section', {
    class: 'gw-home-live-gaps',
    'data-test': 'home-live-projection-gaps',
    'aria-labelledby': 'gw-home-live-gaps-title',
  }, [
    el('header', { class: 'gw-home-live-gaps-head' }, [
      el('p', { class: 'gw-home-kicker' }, ['DESIGNED SLOTS · HONEST STATUS']),
      el('div', { class: 'gw-home-title-with-note' }, [
        el('h2', { id: 'gw-home-live-gaps-title' }, ['What still needs a backend projection']),
        renderPrivateInfoNote('home-gaps'),
      ]),
      el('p', {}, [
        'These placeholders preserve the planned dashboard layout while naming the exact contract each feature needs. They contain no civic result or access grant.',
      ]),
    ]),
    el(
      'div',
      { class: 'gw-home-live-gap-grid' },
      LIVE_HOME_PROJECTION_GAPS.map((definition) => renderProjectionGap(definition)),
    ),
  ]);
}

function renderLiveAdvanced(
  root: HTMLElement,
  data: ReadApiResponse,
  records: readonly StatementRecord[],
): void {
  root.append(
    liveHomeSummary(data, records),
    el('div', { class: 'gw-home-live-advanced', 'data-test': 'home-live-advanced' }, [
      liveRecords(records),
      liveProjectionGaps(),
    ]),
  );
}

function renderLiveSimple(
  root: HTMLElement,
  data: ReadApiResponse,
  records: readonly StatementRecord[],
): void {
  root.append(
    el('section', { class: 'gw-simple-home', 'data-test': 'home-live-simple' }, [
      el('header', { class: 'gw-simple-masthead' }, [
        el('p', {}, ['plain English first · official receipts one tap away']),
        headingWithNote('h1', 'Government Watchdog Weekly', 'home-overview'),
        el('blockquote', {}, ['“Facts are stubborn things.” — John Adams']),
        el('p', {}, ['Live reviewer context · Alpine private beta']),
      ]),
      liveHomeSummary(data, records, 'h2', false),
      liveRecords(records),
      liveProjectionGaps(),
      el('footer', { class: 'gw-simple-footer' }, [
        'We Watch. We Report. You Decide. · Advanced changes density and layout, never the authorized facts.',
      ]),
    ]),
  );
}

/**
 * Render the private-beta Home directly from one normalized reviewer response.
 *
 * No CardFeed, AgendaBoard, newsletter, location, URL, or storage-derived civic
 * model is accepted here. Both reading modes enumerate the exact same records
 * in server order and use the shared record card for every trust surface.
 */
export function renderHomeReadModel(root: HTMLElement, data: ReadApiResponse): void {
  ensureHomeStyle();
  ensureStyle();
  if (data.access !== 'reviewer_internal') {
    renderReviewerContextState(root, 'denied');
    return;
  }
  root.className = 'gw-home-root gw-home-live-root';
  root.replaceChildren();
  const records = data.records ?? [];
  if (readMode() === 'simple') renderLiveSimple(root, data, records);
  else renderLiveAdvanced(root, data, records);
}

export const HOME_STYLE = `${GW_TOKENS}
.gw-home-root{font-family:var(--gw-font);color:var(--gw-text);line-height:var(--gw-leading)}
.gw-home-root *{box-sizing:border-box}
.gw-home-kicker{margin:0 0 var(--gw-space-2);font-size:var(--gw-text-kicker);font-weight:800;letter-spacing:1.4px;color:var(--gw-accent);text-transform:uppercase}
.gw-home-title-with-note{display:flex;align-items:flex-start;gap:var(--gw-space-2);min-width:0}.gw-home-title-with-note>h1,.gw-home-title-with-note>h2,.gw-home-title-with-note>h3,.gw-home-title-with-note>p{min-width:0}.gw-home-title-with-note>.gw-info-note{flex:0 0 auto}.gw-home-summary-copy{display:flex;align-items:flex-start;gap:var(--gw-space-2)}.gw-home-summary-copy>p{flex:1;min-width:0}.gw-home-summary-copy>.gw-info-note{flex:0 0 auto}
.gw-home-levels{display:flex;flex-wrap:wrap;gap:var(--gw-space-2);margin:0 0 var(--gw-space-5)}
.gw-home-level{min-height:var(--gw-tap-min);border:var(--gw-border-w) solid var(--gw-border);background:var(--gw-surface);color:var(--gw-text-secondary);border-radius:var(--gw-radius-pill);padding:0 var(--gw-space-5);font:700 var(--gw-text-badge)/1 var(--gw-font);cursor:pointer}
.gw-home-level[aria-pressed="true"]{background:var(--gw-accent);color:var(--gw-accent-text-on);border-color:var(--gw-accent)}
.gw-home-weather{display:grid;grid-template-columns:minmax(280px,1fr) 1.5fr;gap:var(--gw-space-5);background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);padding:var(--gw-space-6);margin-bottom:var(--gw-space-5)}
.gw-home-weather h1,.gw-home-weather h2{margin:0;font-size:var(--gw-text-display);line-height:var(--gw-leading-tight)}
.gw-home-weather p{margin:.35rem 0 0;color:var(--gw-text-secondary)}
.gw-home-weather-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--gw-space-3)}
.gw-home-stat{background:var(--gw-surface-subtle);border:var(--gw-border-w) solid var(--gw-border-subtle);border-radius:var(--gw-radius);padding:var(--gw-space-4)}
.gw-home-stat span,.gw-home-stat small{display:block;color:var(--gw-text-muted);font-size:var(--gw-text-sm)}
.gw-home-stat strong{display:block;margin:.25rem 0;font-size:var(--gw-text-xl);line-height:1;color:var(--gw-text)}
.gw-home-grid{display:grid;grid-template-columns:400px minmax(0,1fr) 352px;gap:var(--gw-space-5);align-items:start}
.gw-home-col{display:grid;gap:var(--gw-space-5)}
.gw-home-widget{background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);padding:var(--gw-space-5)}
.gw-home-widget h2{margin:0;font-size:var(--gw-text-lg);line-height:var(--gw-leading-tight)}
.gw-home-widget-head{border-bottom:var(--gw-border-w) solid var(--gw-border-subtle);padding-bottom:var(--gw-space-3);margin-bottom:var(--gw-space-4)}
.gw-home-widget[data-tone="caution"]{border-color:var(--gw-caution-line)}
.gw-home-empty{background:var(--gw-surface-well);border:var(--gw-border-w) dashed var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-4);color:var(--gw-text-secondary)}
.gw-home-empty strong{display:block;color:var(--gw-text);margin-bottom:var(--gw-space-2)}
.gw-home-empty p{margin:.35rem 0 0}.gw-home-source-note{font-family:var(--gw-font-mono);font-size:var(--gw-text-xs);color:var(--gw-text-muted)}
.gw-home-widget>.gw-home-link{display:inline-block;margin-top:var(--gw-space-3)}
.gw-home-demo{font-family:var(--gw-font-mono);font-size:var(--gw-text-badge);font-weight:700;color:var(--gw-caution-text-strong);background:var(--gw-caution-bg);border:var(--gw-border-w) solid var(--gw-caution-line);border-radius:var(--gw-radius);padding:var(--gw-space-3) var(--gw-space-4);margin-bottom:var(--gw-space-5)}
.gw-home-verdict{display:grid;gap:var(--gw-space-3);background:var(--gw-caution-bg);border:var(--gw-border-w) solid var(--gw-caution-line);border-radius:var(--gw-radius);padding:var(--gw-space-4)}
.gw-home-verdict-subject{margin:0;font-family:var(--gw-font-mono);font-size:var(--gw-text-badge);font-weight:800;text-transform:uppercase;color:var(--gw-caution-text-strong)}
.gw-home-fixture-leaf{display:grid;gap:.15rem}
.gw-home-fixture-leaf-label{font-family:var(--gw-font-mono);font-size:var(--gw-text-badge);font-weight:800;text-transform:uppercase;color:var(--gw-text-muted)}
.gw-home-phrases{list-style:none;margin:0;padding:0;display:grid;gap:var(--gw-space-3)}
.gw-home-phrase{background:var(--gw-surface-subtle);border:var(--gw-border-w) solid var(--gw-border-subtle);border-radius:var(--gw-radius);padding:var(--gw-space-3);font-family:var(--gw-font-mono);font-size:var(--gw-text-sm)}
.gw-home-ai{display:grid;gap:.2rem;margin-top:var(--gw-space-3);font-size:var(--gw-text-sm);color:var(--gw-text-secondary)}
.gw-home-ai-label{font-family:var(--gw-font-mono);font-size:var(--gw-text-badge);font-weight:800;color:var(--gw-caution-text-strong)}
.gw-home-ai-caveat{font-style:italic}
.gw-home-mini-card,.gw-home-issue-row{background:var(--gw-surface-subtle);border:var(--gw-border-w) solid var(--gw-border-subtle);border-radius:var(--gw-radius);padding:var(--gw-space-4);margin-top:var(--gw-space-3)}
.gw-home-mini-card h3,.gw-home-issue-row h3{margin:.35rem 0;font-size:var(--gw-text-md)}
.gw-home-mini-card p,.gw-home-issue-row p{margin:.25rem 0;color:var(--gw-text-secondary)}
.gw-home-chip{display:inline-flex;align-items:center;min-height:var(--gw-badge-min);border-radius:var(--gw-radius-sm);border:var(--gw-border-w) solid currentColor;padding:.15rem .4rem;font-size:var(--gw-text-badge);font-weight:800;line-height:1;text-transform:uppercase}.gw-level-town{color:var(--gw-level-town)}.gw-level-county{color:var(--gw-level-county)}.gw-level-state{color:var(--gw-level-state)}.gw-tone-caution{color:var(--gw-caution-text)}.gw-badge-ai{background:var(--gw-caution-bg);color:var(--gw-caution-text-strong);border-color:var(--gw-caution-line)}
.gw-home-issue-row{display:grid;grid-template-columns:auto 1fr auto;gap:var(--gw-space-3);align-items:start}
.gw-home-link{display:inline-flex;align-items:center;min-height:var(--gw-tap-min);color:var(--gw-info-text);font-weight:700;text-decoration:none}.gw-home-link:hover{text-decoration:underline}
.gw-home-timeline{list-style:none;margin:0;padding:0;display:grid;gap:var(--gw-space-3)}.gw-home-timeline li{display:grid;grid-template-columns:6.5rem 1fr;gap:var(--gw-space-3);position:relative}.gw-home-timeline time{font-family:var(--gw-font-mono);font-size:var(--gw-text-sm);color:var(--gw-text-muted)}
.gw-home-record-meta{display:flex;align-items:center;flex-wrap:wrap;gap:var(--gw-space-2);margin-top:var(--gw-space-2);font-family:var(--gw-font);font-style:normal;font-size:var(--gw-text-sm)}
.gw-simple-home{max-width:1150px;margin:0 auto;font-family:var(--gw-font-serif);background:var(--gw-header-bg);border:var(--gw-border-w) solid var(--gw-rule-strong);border-radius:var(--gw-radius-lg);padding:var(--gw-space-6);color:var(--gw-text)}
.gw-simple-masthead{text-align:center;border-bottom:3px double var(--gw-rule-strong);margin-bottom:var(--gw-space-5);padding-bottom:var(--gw-space-5)}.gw-simple-masthead h1{font-size:var(--gw-text-display);line-height:1;margin:.2rem 0}.gw-simple-masthead p,.gw-simple-masthead blockquote{margin:.25rem 0;color:var(--gw-text-secondary)}
.gw-simple-tools{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,1fr);gap:var(--gw-space-5);align-items:end;border:2px solid var(--gw-rule-strong);background:var(--gw-surface-subtle);padding:var(--gw-space-5);margin-bottom:var(--gw-space-5)}.gw-simple-tools h2{margin:0;font-size:var(--gw-text-xl)}.gw-simple-tool-copy>p:last-child{margin:.35rem 0 0;color:var(--gw-text-secondary)}.gw-simple-search{display:grid;gap:var(--gw-space-2);font-family:var(--gw-font)}.gw-simple-search label,.gw-home-edition-history label{font-size:var(--gw-text-badge);font-weight:800;letter-spacing:1px;text-transform:uppercase}.gw-simple-search-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--gw-space-2)}.gw-simple-search input,.gw-simple-search button,.gw-home-edition-history select{min-height:var(--gw-tap-min);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-surface);color:var(--gw-text);padding:0 var(--gw-space-3);font:600 var(--gw-text-sm)/1 var(--gw-font)}.gw-simple-search button{font-weight:800}.gw-simple-search :disabled,.gw-home-edition-history select:disabled{cursor:not-allowed;opacity:.72}.gw-simple-search small{color:var(--gw-text-muted)}
.gw-simple-things{border:2px solid var(--gw-rule-strong);padding:var(--gw-space-5);margin-bottom:var(--gw-space-5)}.gw-simple-thing{display:grid;grid-template-columns:2rem 1fr;gap:var(--gw-space-3);border-top:var(--gw-border-w) solid var(--gw-border);padding-top:var(--gw-space-3);margin-top:var(--gw-space-3)}.gw-simple-thing span{font:800 1.4rem/1 var(--gw-font-serif)}
.gw-simple-layout{display:grid;grid-template-columns:260px minmax(0,1fr) 280px;gap:var(--gw-space-5);align-items:start}.gw-simple-feature{border-top:3px solid var(--gw-rule-strong);border-bottom:3px solid var(--gw-rule-strong);padding:var(--gw-space-5) 0}.gw-simple-feature h2{font-size:clamp(1.6rem,3vw,2.6rem);line-height:1.05;margin:0}.gw-simple-dek{color:var(--gw-text-secondary);font-style:italic}.gw-simple-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--gw-space-4);border-top:var(--gw-border-w) solid var(--gw-border);padding-top:var(--gw-space-4)}.gw-simple-columns h3{font-family:var(--gw-font);font-size:var(--gw-text-kicker);letter-spacing:1.2px;text-transform:uppercase}.gw-simple-rail{display:grid;gap:var(--gw-space-4)}.gw-home-edition-history{display:grid;gap:var(--gw-space-2);border-top:var(--gw-border-w) solid var(--gw-border);margin-top:var(--gw-space-4);padding-top:var(--gw-space-4);font-family:var(--gw-font)}.gw-home-edition-history p{margin:0;color:var(--gw-text-secondary);font-size:var(--gw-text-sm)}.gw-simple-local-editions{display:grid;gap:var(--gw-space-4);margin-top:var(--gw-space-5)}.gw-simple-local-editions>h2,.gw-simple-local-editions>.gw-home-title-with-note h2{margin:0;font-size:var(--gw-text-xl)}.gw-simple-local-boxes{display:grid;grid-template-columns:1fr 1fr;gap:var(--gw-space-5)}.gw-simple-footer{text-align:center;border-top:3px double var(--gw-rule-strong);margin-top:var(--gw-space-5);padding-top:var(--gw-space-5);color:var(--gw-text-secondary)}
.gw-home-advanced-briefing,.gw-simple-accountability{display:grid;gap:var(--gw-space-5);margin-top:var(--gw-space-6);padding-top:var(--gw-space-6);border-top:3px double var(--gw-rule-strong)}.gw-home-advanced-briefing-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(280px,.5fr);gap:var(--gw-space-5);align-items:start}.gw-home-advanced-briefing .gw-simple-things{margin-bottom:0}.gw-simple-accountability .gw-home-weather{margin-bottom:0}
.gw-home-live-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--gw-space-4)}
.gw-home-live-root .gw-home-live-summary{margin-bottom:var(--gw-space-5)}
.gw-home-live-root .gw-simple-home>.gw-home-live-summary{margin-top:var(--gw-space-5)}
.gw-home-live-advanced{display:grid;gap:var(--gw-space-6)}
.gw-home-live-records{min-width:0;background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);padding:var(--gw-space-5)}
.gw-home-live-records-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.7fr);gap:var(--gw-space-5);align-items:end;padding-bottom:var(--gw-space-4);border-bottom:var(--gw-border-w) solid var(--gw-border-subtle)}
.gw-home-live-records-head h2,.gw-home-live-gaps-head h2{margin:0;font-size:var(--gw-text-xl);line-height:var(--gw-leading-tight)}
.gw-home-live-records-head>p,.gw-home-live-gaps-head>p{margin:0;color:var(--gw-text-secondary)}
.gw-home-live-record-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gw-space-4);margin-top:var(--gw-space-4)}
.gw-home-live-record{min-width:0}.gw-home-live-record>.gw-card{height:100%;margin:0;background:var(--gw-card-bg)}
.gw-home-live-gaps{display:grid;gap:var(--gw-space-4)}
.gw-home-live-gaps-head{max-width:850px}.gw-home-live-gaps-head>p:last-child{margin:.45rem 0 0}
.gw-home-live-gap-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--gw-space-4)}
.gw-simple-home .gw-home-live-records{margin-top:var(--gw-space-5);border:2px solid var(--gw-rule-strong);border-radius:0}
.gw-simple-home .gw-home-live-records-head,.gw-simple-home .gw-home-live-gaps-head{font-family:var(--gw-font-serif)}
.gw-simple-home .gw-home-live-record-list{grid-template-columns:1fr}
.gw-simple-home .gw-home-live-gaps{margin-top:var(--gw-space-6);padding-top:var(--gw-space-5);border-top:3px double var(--gw-rule-strong)}
.gw-simple-home .gw-home-live-gap-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
@media (max-width:980px){.gw-home-weather{grid-template-columns:1fr}.gw-home-weather-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.gw-home-grid{grid-template-columns:1fr 1fr}.gw-home-col:first-child{grid-column:1/-1}.gw-simple-tools,.gw-simple-layout,.gw-home-advanced-briefing-grid{grid-template-columns:1fr}.gw-simple-local-boxes{grid-template-columns:1fr}.gw-simple-columns{grid-template-columns:1fr}}
@media (max-width:980px){.gw-home-live-gap-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:720px){.gw-home-live-record-list,.gw-simple-home .gw-home-live-gap-grid{grid-template-columns:1fr}.gw-home-live-records-head{grid-template-columns:1fr}}
@media (max-width:640px){.gw-home-weather-grid,.gw-home-grid,.gw-home-live-gap-grid{grid-template-columns:1fr}.gw-home-issue-row{grid-template-columns:1fr}.gw-home-timeline li{grid-template-columns:1fr}.gw-simple-home{padding:var(--gw-space-4)}}`;

let styleInjected = false;
function ensureHomeStyle(): void {
  if (styleInjected) return;
  document.head.append(el('style', {}, [HOME_STYLE]));
  styleInjected = true;
}
