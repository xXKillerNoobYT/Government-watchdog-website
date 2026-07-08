import type { AgendaBoard, AgendaBoardCard } from '../types/agenda-board';
import type { CardFeed, CardFeedCard, PresentCard } from './card-feed';
import type { NewsletterDigest, NewsletterDigestResponse, NewsletterItem } from '../types/newsletter-digest';
import { GW_TOKENS } from './tokens';
import { readMode } from './shell';

export type HomeLevel = 'all' | 'town' | 'county' | 'state';

interface HomeOptions {
  cardFeed: CardFeed;
  board: AgendaBoard;
  newsletter: NewsletterDigestResponse;
  demo?: boolean;
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
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
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
  return new Set(items.flatMap((item) => item.sourceIds)).size;
}

function makeModel(opts: HomeOptions, level: HomeLevel): HomeModel {
  const digest = opts.newsletter.digests[0] ?? null;
  const digestItems = digest?.items ?? [];
  const newsletterItems = digestItems.filter((item) => matchesItemLevel(level, item));
  return {
    level,
    presentCards: opts.cardFeed.cards.filter(isPresentCard).filter((card) => matchesLevel(level, card)),
    newsletterItems,
    primaryDigest: digest,
    boardCards: allBoardCards(opts.board),
    demoCards: opts.sampleBoard ? allBoardCards(opts.sampleBoard) : [],
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
  return wrap;
}

function widget(title: string, kicker: string, children: (Node | string)[], attrs: Record<string, string> = {}): HTMLElement {
  return el('section', { class: 'gw-home-widget', ...attrs }, [
    el('div', { class: 'gw-home-widget-head' }, [
      el('p', { class: 'gw-home-kicker' }, [kicker]),
      el('h2', {}, [title]),
    ]),
    ...children,
  ]);
}

function honestEmpty(title: string, body: string, source: string): HTMLElement {
  return el('div', { class: 'gw-home-empty', 'data-test': 'home-honest-empty' }, [
    el('strong', {}, [title]),
    el('p', {}, [body]),
    el('p', { class: 'gw-home-source-note' }, [source]),
  ]);
}

function demoBanner(): HTMLElement {
  return el('div', { class: 'gw-home-demo', role: 'status', 'data-test': 'home-demo-banner' }, [
    'DEV SAMPLE — populated Home modules use backend test-seed projection data, not real Alpine records.',
  ]);
}

function civicWeather(model: HomeModel, demo: boolean): HTMLElement {
  const realEvents = model.presentCards.length;
  const items = [
    { label: 'Reviewed records', value: String(realEvents), state: realEvents ? 'REAL timeline cards in the reviewer-internal feed.' : 'No reviewed activity summary yet — the archive is still filling in.' },
    { label: 'Agenda cards', value: String(model.boardCards.length), state: model.boardCards.length ? 'REAL agenda projection cards.' : 'No reviewed agenda-card rollup yet.' },
    { label: 'Source receipts', value: String(model.sourceCount), state: model.sourceCount ? 'REAL digest source trails.' : 'Source counts need the vault projection.' },
    { label: 'Changes/votes', value: demo ? 'sample' : '—', state: 'No weekly change/vote aggregate endpoint is live yet.' },
  ];
  return el('section', { class: 'gw-home-weather', 'data-test': 'home-civic-weather' }, [
    el('div', {}, [
      el('p', { class: 'gw-home-kicker' }, ['CIVIC WEATHER']),
      el('h1', {}, ['Alpine government dashboard']),
      el('p', {}, ['Reviewed records first, honest-empty where the archive or backend projection is not ready yet.']),
    ]),
    el('div', { class: 'gw-home-weather-grid' }, items.map((item) =>
      el('article', { class: 'gw-home-stat' }, [
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
    return widget('Fast Agenda', 'NEXT MEETING', [
      honestEmpty(
        'No upcoming reviewed meeting records',
        'Meeting agenda cards will appear here after the agenda-thread and meeting-id contract lands in the reviewed projection.',
        'Source: GOV-605 board projection today reports an honest empty board for the real Alpine corpus.',
      ),
    ], { 'data-test': 'home-fast-agenda' });
  }
  return widget('Fast Agenda', demo ? 'DEV SAMPLE' : 'NEXT MEETING', [
    ...cards.map((card) => el('article', { class: 'gw-home-mini-card', 'data-test': 'home-agenda-card' }, [
      el('span', { class: 'gw-home-chip gw-level-town' }, ['TOWN']),
      el('h3', {}, [card.agendaItemTitle ?? card.agendaItemId]),
      el('p', {}, [[card.meetingDate, card.meetingBody, card.laneLabel].filter(Boolean).join(' · ')]),
    ])),
  ], { 'data-test': 'home-fast-agenda' });
}

function transparencyAlerts(demo: boolean): HTMLElement {
  if (!demo) {
    return widget('Transparency Alerts', 'HIDDEN THINGS', [
      honestEmpty(
        'Document-change tracking is not live yet',
        'Late packet, missing-video, and quiet-edit alerts will appear here when the version-diff pipeline is live and reviewed.',
        'Source: future document version-diff projection; no claims are made before that contract exists.',
      ),
    ], { 'data-test': 'home-transparency-alerts' });
  }
  return widget('Transparency Alerts', 'DEV SAMPLE', [
    el('article', { class: 'gw-home-mini-card' }, [
      el('span', { class: 'gw-home-chip gw-tone-caution' }, ['SAMPLE']),
      el('h3', {}, ['Packet changed after posting']),
      el('p', {}, ['Demonstration only — not a real Alpine alert.']),
    ]),
  ], { 'data-test': 'home-transparency-alerts' });
}

function activeIssues(model: HomeModel): HTMLElement {
  if (!model.presentCards.length) {
    return widget('Active Issues', 'SOURCE-BACKED ROWS', [
      honestEmpty(
        `No ${model.level === 'all' ? '' : model.level + ' '}reviewed issue rows in this view`,
        'Issue rows derive from reviewed topic/card records only. Empty filters mean no matching reviewed records, not a broken dashboard.',
        'Source: GOV-347 card feed and GOV-149 topic projection.',
      ),
    ], { 'data-test': 'home-active-issues' });
  }
  return widget('Active Issues', 'SOURCE-BACKED ROWS', [
    el('div', { class: 'gw-home-issue-list' }, model.presentCards.slice(0, 5).map((card) =>
      el('article', { class: 'gw-home-issue-row', 'data-test': 'home-issue-row' }, [
        el('span', { class: 'gw-home-chip gw-level-town' }, ['TOWN']),
        el('div', {}, [
          el('h3', {}, [titleForCard(card)]),
          el('p', {}, ['Alpine · Timeline · ', statusText(card.status)]),
        ]),
        el('a', { href: '#/cards', class: 'gw-home-link' }, ['receipts ›']),
      ]),
    )),
  ], { 'data-test': 'home-active-issues' });
}

function timelinePreview(model: HomeModel): HTMLElement {
  if (!model.presentCards.length) {
    return widget('Timeline Preview', 'LATEST REVIEWED EVENTS', [
      honestEmpty(
        'No reviewed timeline events for this filter',
        'Latest events will show here directly from the reviewer-internal Alpine projection.',
        'Source: the same reviewed read/card projection that powers #/timeline and #/cards.',
      ),
    ], { 'data-test': 'home-timeline-preview' });
  }
  return widget('Timeline Preview', 'LATEST REVIEWED EVENTS', [
    el('ol', { class: 'gw-home-timeline' }, model.presentCards.slice(0, 4).map((card) =>
      el('li', { 'data-test': 'home-timeline-event' }, [
        el('time', {}, [card.date ?? 'undated']),
        el('span', {}, [titleForCard(card)]),
      ]),
    )),
    el('a', { href: '#/timeline', class: 'gw-home-link' }, ['Timeline ›']),
  ], { 'data-test': 'home-timeline-preview' });
}

function sourceVault(model: HomeModel, demo: boolean): HTMLElement {
  if (!demo) {
    return widget('Source Vault', 'RECEIPTS', [
      honestEmpty(
        'Source statistics are not wired yet',
        'Counts, hash verification, and latest-source summaries will appear when the source-vault projection is live.',
        model.sourceCount ? `The digest currently exposes ${model.sourceCount} real source trail entr${model.sourceCount === 1 ? 'y' : 'ies'}; no vault percentages are inferred.` : 'Source: future source-registry stats projection; no hardcoded numbers.',
      ),
    ], { 'data-test': 'home-source-vault' });
  }
  return widget('Source Vault', 'DEV SAMPLE', [
    el('p', {}, ['Sample source statistics would render here only in demo mode.']),
  ], { 'data-test': 'home-source-vault' });
}

function simpleThings(model: HomeModel): HTMLElement {
  const items = model.newsletterItems.slice(0, 3);
  if (!items.length) {
    return honestEmpty(
      'No reviewed briefing items for this filter',
      'The front-page summary uses reviewed digest or briefing items verbatim when present.',
      'Source: Stage 4.05 digest / Stage 4.08 briefing trail.',
    );
  }
  return el('section', { class: 'gw-simple-things', 'data-test': 'home-simple-things' }, [
    el('p', { class: 'gw-home-kicker' }, ['3 THINGS TO KNOW']),
    ...items.map((item, idx) => el('article', { class: 'gw-simple-thing', 'data-test': 'home-simple-item' }, [
      el('span', {}, [String(idx + 1)]),
      el('p', {}, [item.summary ?? item.title ?? item.id]),
    ])),
  ]);
}

function simpleFeatured(model: HomeModel): HTMLElement {
  const item = model.newsletterItems[0] ?? null;
  if (!item) {
    return widget('Featured Story', 'PLAIN ENGLISH FIRST', [
      honestEmpty('No featured story yet', 'A sourced story appears here when a reviewed digest item matches the current filter.', 'Source: reviewed newsletter digest items.'),
    ], { 'data-test': 'home-simple-featured' });
  }
  const sourceCount = item.sourceTrail.length;
  return el('article', { class: 'gw-simple-feature', 'data-test': 'home-simple-featured' }, [
    el('p', { class: 'gw-home-kicker' }, ['FEATURED STORY']),
    el('h2', {}, [item.title ?? item.summary ?? item.id]),
    el('p', { class: 'gw-simple-dek' }, [`${item.recordDate} · ${item.labels.claimStatus}`]),
    el('div', { class: 'gw-simple-columns' }, [
      el('section', {}, [el('h3', {}, ['PLAIN-ENGLISH SUMMARY ', el('span', { class: 'gw-home-chip gw-badge-ai' }, ['AI'])]), el('p', {}, [item.summary ?? 'Reviewed digest item.'])]),
      el('section', {}, [el('h3', {}, ['WHY IT MATTERS']), el('p', {}, ['This item is included only because it exists in the reviewer-internal digest trail.'])]),
      el('section', {}, [el('h3', {}, ['NEXT ACTION']), el('p', {}, ['Open the timeline or newsletter detail to inspect the source trail.'])]),
    ]),
    el('a', { href: '#/newsletter', class: 'gw-home-link' }, [`✓ ${sourceCount} source${sourceCount === 1 ? '' : 's'} verified ›`]),
  ]);
}

function simpleRails(model: HomeModel): HTMLElement {
  return el('aside', { class: 'gw-simple-rail', 'data-test': 'home-simple-rail' }, [
    widget('Sources / Receipts', 'RECEIPTS', [
      model.sourceCount
        ? el('p', {}, [`${model.sourceCount} unique source trail entr${model.sourceCount === 1 ? 'y' : 'ies'} in the selected digest items.`])
        : honestEmpty('No source trail in this filter', 'Receipts appear when selected briefing items carry source trails.', 'Source: digest sourceTrail.'),
    ]),
    widget('History Looks Back', 'ARCHIVE', [
      model.newsletterItems[0]
        ? el('p', {}, [model.newsletterItems[0].summary ?? 'Reviewed historical item available.'])
        : honestEmpty('No historical echo yet', 'Historical items appear only when verified briefing items are present.', 'Source: Stage 4.08 reviewed historical briefing.'),
    ]),
    widget('Publication Honesty Tracker', 'HONESTY', [
      honestEmpty('Metrics not computed yet', 'Sourced, balanced, clear, and updated scores are not self-asserted until digest metadata can compute them.', 'Source: future digest-metadata metrics projection.'),
    ]),
  ]);
}

function renderAdvanced(root: HTMLElement, model: HomeModel, opts: HomeOptions, setLevel: (level: HomeLevel) => void): void {
  root.append(
    levelFilter(model.level, setLevel),
    civicWeather(model, Boolean(opts.demo)),
    el('div', { class: 'gw-home-grid', 'data-test': 'home-grid' }, [
      el('div', { class: 'gw-home-col' }, [fastAgenda(model, Boolean(opts.demo)), transparencyAlerts(Boolean(opts.demo))]),
      el('div', { class: 'gw-home-col' }, [activeIssues(model), timelinePreview(model)]),
      el('div', { class: 'gw-home-col' }, [sourceVault(model, Boolean(opts.demo))]),
    ]),
  );
}

function renderSimple(root: HTMLElement, model: HomeModel, opts: HomeOptions, setLevel: (level: HomeLevel) => void): void {
  const digestPeriod = model.primaryDigest?.coveragePeriod;
  const dateline = digestPeriod ? `${digestPeriod.startDate}–${digestPeriod.endDate}` : 'Reviewer-internal Alpine edition';
  root.append(
    el('section', { class: 'gw-simple-home', 'data-test': 'home-simple' }, [
      el('header', { class: 'gw-simple-masthead' }, [
        el('p', {}, ['plain English first · official text one tap away']),
        el('h1', {}, ['Government Watchdog Weekly']),
        el('blockquote', {}, ['“Facts are stubborn things.” — John Adams']),
        el('p', {}, [dateline]),
      ]),
      levelFilter(model.level, setLevel),
      simpleThings(model),
      el('div', { class: 'gw-simple-layout' }, [
        el('aside', { class: 'gw-simple-rail' }, [fastAgenda(model, Boolean(opts.demo)), transparencyAlerts(Boolean(opts.demo))]),
        simpleFeatured(model),
        simpleRails(model),
      ]),
      el('div', { class: 'gw-simple-local-boxes' }, [
        widget('County', 'HONEST EMPTY', [honestEmpty('No county dashboard yet', 'County-level rows filter real data and show empty until reviewed county records land.', 'Source: same Alpine-first projections.')]),
        widget('State', 'HONEST EMPTY', [honestEmpty('No state dashboard yet', 'State-level rows filter real data and show empty until reviewed state records land.', 'Source: same Alpine-first projections.')]),
      ]),
      el('footer', { class: 'gw-simple-footer' }, ['We Watch. We Report. You Decide. · Switch to Advanced for the full data dashboard.']),
    ]),
  );
}

export function renderHome(root: HTMLElement, opts: HomeOptions): void {
  ensureHomeStyle();
  root.className = 'gw-home-root';
  root.replaceChildren();
  let level: HomeLevel = 'all';
  const draw = (): void => {
    root.replaceChildren();
    if (opts.demo) root.append(demoBanner());
    const mode = readMode();
    const model = makeModel(opts, level);
    if (mode === 'simple') renderSimple(root, model, opts, (next) => { level = next; draw(); });
    else renderAdvanced(root, model, opts, (next) => { level = next; draw(); });
  };
  draw();
}

export const HOME_STYLE = `${GW_TOKENS}
.gw-home-root{font-family:var(--gw-font);color:var(--gw-text);line-height:var(--gw-leading)}
.gw-home-root *{box-sizing:border-box}
.gw-home-kicker{margin:0 0 var(--gw-space-2);font-size:var(--gw-text-kicker);font-weight:800;letter-spacing:1.4px;color:var(--gw-accent);text-transform:uppercase}
.gw-home-levels{display:flex;flex-wrap:wrap;gap:var(--gw-space-2);margin:0 0 var(--gw-space-5)}
.gw-home-level{min-height:var(--gw-tap-min);border:var(--gw-border-w) solid var(--gw-border);background:var(--gw-surface);color:var(--gw-text-secondary);border-radius:var(--gw-radius-pill);padding:0 var(--gw-space-5);font:700 var(--gw-text-badge)/1 var(--gw-font);cursor:pointer}
.gw-home-level[aria-pressed="true"]{background:var(--gw-accent);color:var(--gw-accent-text-on);border-color:var(--gw-accent)}
.gw-home-weather{display:grid;grid-template-columns:minmax(280px,1fr) 1.5fr;gap:var(--gw-space-5);background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);padding:var(--gw-space-6);margin-bottom:var(--gw-space-5)}
.gw-home-weather h1{margin:0;font-size:var(--gw-text-display);line-height:var(--gw-leading-tight)}
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
.gw-home-empty{background:var(--gw-surface-well);border:var(--gw-border-w) dashed var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-4);color:var(--gw-text-secondary)}
.gw-home-empty strong{display:block;color:var(--gw-text);margin-bottom:var(--gw-space-2)}
.gw-home-empty p{margin:.35rem 0 0}.gw-home-source-note{font-family:var(--gw-font-mono);font-size:var(--gw-text-xs);color:var(--gw-text-muted)}
.gw-home-demo{font-family:var(--gw-font-mono);font-size:var(--gw-text-badge);font-weight:700;color:var(--gw-caution-text-strong);background:var(--gw-caution-bg);border:var(--gw-border-w) solid var(--gw-caution-line);border-radius:var(--gw-radius);padding:var(--gw-space-3) var(--gw-space-4);margin-bottom:var(--gw-space-5)}
.gw-home-mini-card,.gw-home-issue-row{background:var(--gw-surface-subtle);border:var(--gw-border-w) solid var(--gw-border-subtle);border-radius:var(--gw-radius);padding:var(--gw-space-4);margin-top:var(--gw-space-3)}
.gw-home-mini-card h3,.gw-home-issue-row h3{margin:.35rem 0;font-size:var(--gw-text-md)}
.gw-home-mini-card p,.gw-home-issue-row p{margin:.25rem 0;color:var(--gw-text-secondary)}
.gw-home-chip{display:inline-flex;align-items:center;min-height:var(--gw-badge-min);border-radius:var(--gw-radius-sm);border:var(--gw-border-w) solid currentColor;padding:.15rem .4rem;font-size:var(--gw-text-badge);font-weight:800;line-height:1;text-transform:uppercase}.gw-level-town{color:var(--gw-level-town)}.gw-level-county{color:var(--gw-level-county)}.gw-level-state{color:var(--gw-level-state)}.gw-tone-caution{color:var(--gw-caution-text)}.gw-badge-ai{background:var(--gw-caution-bg);color:var(--gw-caution-text-strong);border-color:var(--gw-caution-line)}
.gw-home-issue-row{display:grid;grid-template-columns:auto 1fr auto;gap:var(--gw-space-3);align-items:start}
.gw-home-link{color:var(--gw-info-text);font-weight:700;text-decoration:none}.gw-home-link:hover{text-decoration:underline}
.gw-home-timeline{list-style:none;margin:0;padding:0;display:grid;gap:var(--gw-space-3)}.gw-home-timeline li{display:grid;grid-template-columns:6.5rem 1fr;gap:var(--gw-space-3);position:relative}.gw-home-timeline time{font-family:var(--gw-font-mono);font-size:var(--gw-text-sm);color:var(--gw-text-muted)}
.gw-simple-home{max-width:1150px;margin:0 auto;font-family:var(--gw-font-serif);background:var(--gw-header-bg);border:var(--gw-border-w) solid var(--gw-rule-strong);border-radius:var(--gw-radius-lg);padding:var(--gw-space-6);color:var(--gw-text)}
.gw-simple-masthead{text-align:center;border-bottom:3px double var(--gw-rule-strong);margin-bottom:var(--gw-space-5);padding-bottom:var(--gw-space-5)}.gw-simple-masthead h1{font-size:var(--gw-text-display);line-height:1;margin:.2rem 0}.gw-simple-masthead p,.gw-simple-masthead blockquote{margin:.25rem 0;color:var(--gw-text-secondary)}
.gw-simple-things{border:2px solid var(--gw-rule-strong);padding:var(--gw-space-5);margin-bottom:var(--gw-space-5)}.gw-simple-thing{display:grid;grid-template-columns:2rem 1fr;gap:var(--gw-space-3);border-top:var(--gw-border-w) solid var(--gw-border);padding-top:var(--gw-space-3);margin-top:var(--gw-space-3)}.gw-simple-thing span{font:800 1.4rem/1 var(--gw-font-serif)}
.gw-simple-layout{display:grid;grid-template-columns:260px minmax(0,1fr) 280px;gap:var(--gw-space-5);align-items:start}.gw-simple-feature{border-top:3px solid var(--gw-rule-strong);border-bottom:3px solid var(--gw-rule-strong);padding:var(--gw-space-5) 0}.gw-simple-feature h2{font-size:clamp(1.6rem,3vw,2.6rem);line-height:1.05;margin:0}.gw-simple-dek{color:var(--gw-text-secondary);font-style:italic}.gw-simple-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--gw-space-4);border-top:var(--gw-border-w) solid var(--gw-border);padding-top:var(--gw-space-4)}.gw-simple-columns h3{font-family:var(--gw-font);font-size:var(--gw-text-kicker);letter-spacing:1.2px;text-transform:uppercase}.gw-simple-rail{display:grid;gap:var(--gw-space-4)}.gw-simple-local-boxes{display:grid;grid-template-columns:1fr 1fr;gap:var(--gw-space-5);margin-top:var(--gw-space-5)}.gw-simple-footer{text-align:center;border-top:3px double var(--gw-rule-strong);margin-top:var(--gw-space-5);padding-top:var(--gw-space-5);color:var(--gw-text-secondary)}
@media (max-width:980px){.gw-home-weather{grid-template-columns:1fr}.gw-home-weather-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.gw-home-grid{grid-template-columns:1fr 1fr}.gw-home-col:first-child{grid-column:1/-1}.gw-simple-layout{grid-template-columns:1fr}.gw-simple-local-boxes{grid-template-columns:1fr}.gw-simple-columns{grid-template-columns:1fr}}
@media (max-width:640px){.gw-home-weather-grid,.gw-home-grid{grid-template-columns:1fr}.gw-home-issue-row{grid-template-columns:1fr}.gw-home-timeline li{grid-template-columns:1fr}.gw-simple-home{padding:var(--gw-space-4)}}`;

let styleInjected = false;
function ensureHomeStyle(): void {
  if (styleInjected) return;
  document.head.append(el('style', {}, [HOME_STYLE]));
  styleInjected = true;
}
