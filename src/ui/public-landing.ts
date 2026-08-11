/**
 * Anonymous Free lane.
 *
 * This module is deliberately dependency-isolated from the private application:
 * it imports no civic fixtures, gated client, private route, or local admission
 * mechanism. Until the backend publishes a separately approved public
 * projection, it renders the complete designed shape as honest unavailable
 * states rather than filling those slots with samples.
 */

import { GW_TOKENS } from './tokens';
import { renderInfoNote, type InfoNoteId } from './info-note';

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

function labelledHeading(
  title: string,
  infoId: InfoNoteId,
  level: 'h2' | 'h3' = 'h2',
): HTMLElement {
  return el('div', { class: 'gw-public-heading-row' }, [
    el(level, {}, [title]),
    renderInfoNote(infoId),
  ]);
}

interface PreviewCard {
  title: string;
  description: string;
  result: string;
  infoId: InfoNoteId;
}

function previewCard(card: PreviewCard): HTMLElement {
  return el('article', {
    class: 'gw-public-card',
    'data-availability': 'coverage-coming',
  }, [
    labelledHeading(card.title, card.infoId, 'h3'),
    el('span', { class: 'gw-public-state' }, ['Coverage connection pending']),
    el('p', {}, [card.description]),
    el('div', { class: 'gw-public-result' }, [
      el('strong', {}, ['Expected result']),
      el('span', {}, [card.result]),
    ]),
  ]);
}

function brand(): HTMLElement {
  return el('a', {
    class: 'gw-public-brand',
    href: '#app',
    'aria-label': 'Government Watchdog public home',
  }, [
    el('span', { class: 'gw-public-logo', 'aria-hidden': 'true' }, ['GW']),
    el('span', { class: 'gw-public-wordmark' }, [
      el('strong', {}, ['GOVERNMENT']),
      el('span', {}, ['WATCHDOG']),
    ]),
  ]);
}

/** Render the no-records-yet public result with the approved Simple visual skin. */
export function renderPublicLanding(root: HTMLElement): void {
  ensurePublicStyle();
  document.documentElement.setAttribute('data-theme', 'light');
  root.className = 'gw-public-root';
  root.replaceChildren();

  const header = el('header', { class: 'gw-public-header' }, [
    el('div', { class: 'gw-public-header-inner' }, [
      brand(),
      el('div', { class: 'gw-public-header-meta' }, [
        el('span', { class: 'gw-public-place' }, ['Alpine, Wyoming']),
        renderInfoNote('public-scope'),
        el('span', { class: 'gw-public-plan' }, ['FREE PREVIEW']),
        renderInfoNote('public-plan'),
      ]),
    ]),
  ]);

  const hero = el('section', { class: 'gw-public-hero' }, [
    el('p', { class: 'gw-public-kicker' }, ['ALPINE · LINCOLN COUNTY · WYOMING']),
    el('h1', {}, ['A fast, source-first look at local government']),
    el('p', { class: 'gw-public-deck' }, [
      'Government Watchdog is preparing a plain-language public view of meetings, decisions, records, and corrections—without presenting private review material or design samples as civic fact.',
    ]),
    el('div', { class: 'gw-public-hero-actions' }, [
      el('a', { class: 'gw-public-primary', href: '#status' }, ['See current availability']),
      el('a', { class: 'gw-public-secondary', href: '#advanced' }, ['Preview Advanced tools']),
    ]),
  ]);

  // The walkthrough is an ILLUSTRATION, not a record. Resolution 2026-041 and
  // the Cedar Street project are constructed, and the percentages are stated
  // targets rather than measurements (owner, 2026-08-11: "just an example
  // really, made up numbers, but the goal").
  //
  // Labelling that in the page — not only inside the video — is the point. This
  // product's argument is that unsourced civic claims should not be taken on
  // trust. A demo that quietly presented invented figures as findings would
  // concede that argument on the landing page, and a resident who later worked
  // out the difference would not extend trust a second time. The label costs
  // nothing; being caught without it costs the thesis.
  const explainer = el('section', {
    id: 'how-it-works',
    class: 'gw-public-section gw-public-explainer',
    'aria-labelledby': 'explainer-title',
    'data-test': 'public-explainer',
  }, [
    el('div', { class: 'gw-public-section-intro' }, [
      el('p', { class: 'gw-public-kicker' }, ['EXAMPLE WALKTHROUGH · 73 SECONDS · NO SOUND']),
      el('h2', { id: 'explainer-title' }, ['How Government Watchdog works']),
      el('p', {}, [
        'One sidewalk notice, followed from the line it occupies in a meeting packet to the vote that decides it.',
      ]),
    ]),
    el('figure', { class: 'gw-explainer-figure' }, [
      el('video', {
        class: 'gw-explainer-video',
        controls: '',
        preload: 'none',
        playsinline: '',
        poster: '/media/explainer-poster.jpg',
        src: '/media/explainer.mp4',
        'aria-describedby': 'explainer-disclosure explainer-summary',
      }),
      el('figcaption', { id: 'explainer-disclosure', class: 'gw-explainer-disclosure' }, [
        el('strong', {}, ['Illustrative example — not Alpine records. ']),
        el('span', {}, [
          'Resolution 2026-041, the Cedar Street project, the parcel counts and the dollar figures are constructed to show how the tool reads an agenda item. They are not real filings. The participation percentages are the outcome this product aims for, not a measured result.',
        ]),
      ]),
    ]),
    el('div', { class: 'gw-explainer-summary', id: 'explainer-summary' }, [
      el('h3', {}, ['What the walkthrough shows']),
      el('p', {}, [
        'The video is silent. In text: a routine agenda line reads "authorizing acquisition of certain real property interests by negotiated purchase or condemnation." Rewritten as plain questions, it means the town may force the sale of strips of fourteen front yards to build a sidewalk. The walkthrough then shows that item in Simple view — one story, one deadline, one next step — and in Advanced view, with the cost breakdown, the public comments on file, and a flag marking money added to the packet after the notice went out.',
      ]),
      el('p', { class: 'gw-explainer-point' }, [
        'The gap it describes is the reason this product exists: the people most affected by a decision are usually the least likely to have been told in time to respond.',
      ]),
    ]),
  ]);

  const availability = el('section', {
    id: 'status',
    class: 'gw-public-availability',
    'aria-labelledby': 'public-availability-title',
    'data-test': 'public-honest-gap',
  }, [
    el('div', { class: 'gw-public-availability-icon', 'aria-hidden': 'true' }, ['i']),
    el('div', {}, [
      el('div', { class: 'gw-public-heading-row' }, [
        el('h2', { id: 'public-availability-title' }, ['Reviewed public civic feed not connected yet']),
        renderInfoNote('public-status'),
      ]),
      el('p', {}, [
        'The Free page is ready as a safe public shell, but no separately approved public records projection is connected. The site therefore shows zero civic claims here.',
      ]),
      el('dl', { class: 'gw-public-gap-steps' }, [
        el('div', {}, [
          el('dt', {}, ['What will fill this']),
          el('dd', {}, ['A public-only Alpine projection containing publication state, sources, freshness, review status, and corrections.']),
        ]),
        el('div', {}, [
          el('dt', {}, ['How it will work']),
          el('dd', {}, ['The backend publishes eligible rows; automated bundle checks and publication review prevent private or sample material from entering this lane.']),
        ]),
        el('div', {}, [
          el('dt', {}, ['End result']),
          el('dd', {}, ['Every visible civic statement can be traced to a public source and retains its uncertainty and correction history.']),
        ]),
      ]),
    ]),
  ]);

  const quickLook = el('section', {
    class: 'gw-public-section',
    'aria-labelledby': 'quick-look-title',
  }, [
    el('div', { class: 'gw-public-section-intro' }, [
      el('p', { class: 'gw-public-kicker' }, ['SIMPLE · EVERYDAY VIEW']),
      el('h2', { id: 'quick-look-title' }, ['Your Alpine quick look']),
      el('p', {}, ['These designed slots stay visible so their purpose is clear while the public data contract is completed.']),
    ]),
    el('div', { class: 'gw-public-grid' }, [
      previewCard({
        title: 'Meetings & agendas',
        description: 'Upcoming public meetings, official agenda order, likely action type, and participation guidance when supplied by a reviewed source.',
        result: 'Know what is scheduled, what may be decided, and where to verify it.',
        infoId: 'public-meetings',
      }),
      previewCard({
        title: 'Decisions & timeline',
        description: 'A connected public history of proposals, votes, decisions, follow-up, and corrections—without guessing missing relationships.',
        result: 'Understand what changed over time and open the supporting receipts.',
        infoId: 'public-decisions',
      }),
      previewCard({
        title: 'Sources & corrections',
        description: 'Official document links, stable locators, freshness, review state, and visible corrections behind published explanations.',
        result: 'Move from a summary to the exact public record in one step.',
        infoId: 'public-sources',
      }),
    ]),
  ]);

  const safety = el('section', {
    class: 'gw-public-safety',
    'aria-labelledby': 'public-safety-title',
  }, [
    el('div', { class: 'gw-public-heading-row' }, [
      el('h2', { id: 'public-safety-title' }, ['AI safety stays visible']),
      renderInfoNote('public-ai-safety'),
    ]),
    el('div', { class: 'gw-public-safety-grid' }, [
      el('article', {}, [
        el('strong', {}, ['Source before summary']),
        el('p', {}, ['AI-assisted text cannot stand in for an official record. Public output must keep its source receipt.']),
      ]),
      el('article', {}, [
        el('strong', {}, ['Uncertainty remains attached']),
        el('p', {}, ['Missing context, review status, source changes, and corrections remain visible in both Simple and Advanced layouts.']),
      ]),
      el('article', {}, [
        el('strong', {}, ['No silent substitution']),
        el('p', {}, ['If public data is absent or unavailable, the page shows an honest gap instead of private captures or synthetic examples.']),
      ]),
    ]),
  ]);

  const advanced = el('section', {
    id: 'advanced',
    class: 'gw-public-advanced',
    'aria-labelledby': 'advanced-title',
    'data-test': 'public-advanced-preview',
  }, [
    el('div', {}, [
      el('p', { class: 'gw-public-kicker' }, ['ADVANCED / PRO · DESIGNED PREVIEW']),
      el('div', { class: 'gw-public-heading-row' }, [
        el('h2', { id: 'advanced-title' }, ['Research workbench']),
        renderInfoNote('public-advanced'),
      ]),
      el('p', {}, [
        'For newsrooms, public-interest researchers, political organizations, government teams, and residents who need to piece a longer record together.',
      ]),
    ]),
    el('ul', {}, [
      el('li', {}, ['Connected issue timelines and typed event relationships']),
      el('li', {}, ['Source versions, deterministic comparisons, and correction ledgers']),
      el('li', {}, ['Saved searches, watchlists, civic alerts, and delivery history']),
      el('li', {}, ['Town, state, multi-home, global, contract, beta, and developer access governed by server-side grants']),
      el('li', {}, ['Exports and team workflows with provenance preserved']),
    ]),
    el('p', { class: 'gw-public-advanced-note' }, [
      'Preview only: no protected records, plan entitlement, or location grant is included in this page.',
    ]),
  ]);

  const coverage = el('section', { class: 'gw-public-section gw-public-coverage' }, [
    el('div', { class: 'gw-public-section-intro' }, [
      el('p', { class: 'gw-public-kicker' }, ['INITIAL SERVICE AREA']),
      labelledHeading('Alpine-first coverage', 'public-coverage'),
      el('p', {}, ['Current implementation focus is Alpine. County and state slots remain explicit without claiming complete coverage.']),
    ]),
    el('div', { class: 'gw-public-coverage-list' }, [
      el('div', {}, [
        el('strong', {}, ['Town']),
        el('span', {}, ['Alpine']),
        el('em', {}, ['Implementation focus']),
      ]),
      el('div', {}, [
        el('strong', {}, ['County']),
        el('span', {}, ['Lincoln County']),
        el('em', {}, ['Coverage contract pending']),
      ]),
      el('div', {}, [
        el('strong', {}, ['State']),
        el('span', {}, ['Wyoming']),
        el('em', {}, ['Coverage contract pending']),
      ]),
    ]),
  ]);

  const footer = el('footer', { class: 'gw-public-footer' }, [
    el('strong', {}, ['Government Watchdog']),
    el('span', {}, ['Public Free preview · Alpine, Wyoming']),
    el('span', {}, ['Verify every conclusion against the linked primary record when records become available.']),
  ]);

  root.append(
    header,
    el('main', {}, [hero, explainer, availability, quickLook, safety, advanced, coverage]),
    footer,
  );
}

export const PUBLIC_STYLE = `${GW_TOKENS}
*{box-sizing:border-box}
html{scroll-behavior:smooth;background:var(--gw-page-bg)}
body{margin:0;background:var(--gw-page-bg)}
.gw-public-explainer{padding-top:8px}
.gw-explainer-figure{margin:20px 0 0;padding:0}
.gw-explainer-video{width:100%;max-width:900px;height:auto;display:block;border-radius:var(--gw-radius);background:#0d1117;border:1px solid var(--gw-rule)}
.gw-explainer-disclosure{max-width:900px;margin-top:10px;padding:10px 12px;border-left:3px solid var(--gw-accent,#d08a3e);background:rgba(208,138,62,.08);font:400 13px/1.5 var(--gw-font);color:var(--gw-text)}
.gw-explainer-disclosure strong{font-weight:700}
.gw-explainer-summary{max-width:900px;margin-top:18px}
.gw-explainer-summary h3{margin:0 0 6px;font:700 15px/1.3 var(--gw-font)}
.gw-explainer-summary p{margin:0 0 10px;font-size:15px}
.gw-explainer-point{font-weight:600}
@media (max-width:640px){.gw-explainer-disclosure{font-size:12.5px}}
.gw-public-root{min-height:100vh;color:var(--gw-text);background:var(--gw-page-bg);font:400 16px/1.55 var(--gw-font-serif)}
.gw-public-header{position:sticky;top:0;z-index:40;background:color-mix(in srgb,var(--gw-header-bg) 94%,transparent);border-bottom:var(--gw-border-w) solid var(--gw-border);backdrop-filter:blur(12px)}
.gw-public-header-inner{max-width:1210px;margin:0 auto;padding:10px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.gw-public-brand{display:inline-flex;align-items:center;gap:10px;min-height:var(--gw-tap-min);color:var(--gw-text);text-decoration:none;font-family:var(--gw-font)}
.gw-public-logo{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;color:var(--gw-accent-text-on);background:var(--gw-accent);font-size:14px;font-weight:800}
.gw-public-wordmark{display:flex;flex-direction:column;line-height:1}
.gw-public-wordmark strong{font-size:15px;letter-spacing:.02em}
.gw-public-wordmark span{margin-top:4px;color:var(--gw-text-muted);font-size:10px;font-weight:700;letter-spacing:.26em}
.gw-public-header-meta{display:flex;align-items:center;justify-content:flex-end;gap:8px 10px;font-family:var(--gw-font)}
.gw-public-place{font-size:13px;font-weight:700}
.gw-public-plan,.gw-public-state{display:inline-flex;align-items:center;min-height:28px;padding:4px 10px;border-radius:var(--gw-radius-pill);font:800 11px/1.2 var(--gw-font);letter-spacing:.06em;text-transform:uppercase}
.gw-public-plan{color:var(--gw-accent);background:var(--gw-surface-accent-tint);border:var(--gw-border-w) solid var(--gw-accent)}
.gw-public-root main{max-width:1210px;margin:0 auto;padding:0 24px 64px}
.gw-public-hero{padding:76px 0 54px;border-bottom:3px double var(--gw-rule-strong)}
.gw-public-kicker{margin:0 0 10px;color:var(--gw-accent);font:800 11px/1.4 var(--gw-font);letter-spacing:.15em}
.gw-public-hero h1{max-width:850px;margin:0;font:600 clamp(2.5rem,7vw,5rem)/.98 var(--gw-font-serif);letter-spacing:-.035em}
.gw-public-deck{max-width:830px;margin:24px 0 0;color:var(--gw-text-secondary);font-size:clamp(1.05rem,2.3vw,1.35rem)}
.gw-public-hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px;font-family:var(--gw-font)}
.gw-public-primary,.gw-public-secondary{display:inline-flex;align-items:center;justify-content:center;min-height:var(--gw-tap-min);padding:9px 17px;border-radius:var(--gw-radius);font-size:14px;font-weight:750;text-decoration:none}
.gw-public-primary{color:var(--gw-accent-text-on);background:var(--gw-accent);border:var(--gw-border-w) solid var(--gw-accent)}
.gw-public-secondary{color:var(--gw-accent);background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-accent)}
.gw-public-primary:focus-visible,.gw-public-secondary:focus-visible,.gw-public-brand:focus-visible{outline:3px solid var(--gw-accent);outline-offset:3px}
.gw-public-availability{scroll-margin-top:82px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:16px;margin:28px 0 0;padding:22px;background:var(--gw-tone-info-well);border:var(--gw-border-w) solid var(--gw-tone-info-line);border-radius:var(--gw-radius-lg);font-family:var(--gw-font)}
.gw-public-availability-icon{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;color:var(--gw-info-text);border:2px solid var(--gw-info-text);font-weight:800}
.gw-public-heading-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.gw-public-heading-row h2,.gw-public-heading-row h3{margin:0}
.gw-public-availability h2{font-size:1.25rem}
.gw-public-availability p{margin:8px 0 0;color:var(--gw-text-secondary)}
.gw-public-gap-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0 0}
.gw-public-gap-steps div{padding:12px;background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius)}
.gw-public-gap-steps dt{color:var(--gw-text-muted);font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.gw-public-gap-steps dd{margin:4px 0 0;color:var(--gw-text-secondary);font-size:13px}
.gw-public-section{padding:64px 0 8px}
.gw-public-section-intro{max-width:760px}
.gw-public-section-intro h2,.gw-public-safety h2,.gw-public-advanced h2{margin:0;font:600 clamp(1.8rem,4vw,2.8rem)/1.05 var(--gw-font-serif)}
.gw-public-section-intro>p:last-child{color:var(--gw-text-secondary)}
.gw-public-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:26px}
.gw-public-card{display:flex;flex-direction:column;min-height:320px;padding:20px;background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-top:4px solid var(--gw-level-town);border-radius:var(--gw-radius-lg)}
.gw-public-card h3{font:600 1.4rem/1.1 var(--gw-font-serif)}
.gw-public-state{align-self:flex-start;margin:16px 0 6px;color:var(--gw-caution-text);background:var(--gw-caution-bg);border:var(--gw-border-w) solid var(--gw-caution-line)}
.gw-public-card>p{color:var(--gw-text-secondary)}
.gw-public-result{display:grid;gap:5px;margin-top:auto;padding-top:16px;border-top:var(--gw-border-w) solid var(--gw-border);font-family:var(--gw-font)}
.gw-public-result strong{font-size:11px;letter-spacing:.08em;text-transform:uppercase}
.gw-public-result span{color:var(--gw-text-secondary);font-size:13px}
.gw-public-safety{margin:64px 0 0;padding:28px;background:var(--gw-surface);border:3px double var(--gw-rule-strong);border-radius:var(--gw-radius-lg)}
.gw-public-safety-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin-top:24px}
.gw-public-safety article{padding-top:12px;border-top:3px solid var(--gw-accent);font-family:var(--gw-font)}
.gw-public-safety p{margin:7px 0 0;color:var(--gw-text-secondary);font-size:14px}
.gw-public-advanced{scroll-margin-top:82px;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);gap:32px;margin:64px 0 0;padding:34px;color:#ECF1F7;background:#0B0F14;border:1px solid #2A3644;border-radius:var(--gw-radius-lg);font-family:var(--gw-font)}
.gw-public-advanced .gw-public-kicker{color:#4ED8C3}
.gw-public-advanced h2{font-family:var(--gw-font)}
.gw-public-advanced p{color:#C3CDD9}
.gw-public-advanced ul{margin:4px 0;padding-left:22px;color:#C3CDD9}
.gw-public-advanced li+li{margin-top:10px}
.gw-public-advanced-note{grid-column:1/-1;margin:0!important;padding-top:16px;border-top:1px solid #2A3644;font-size:13px}
.gw-public-coverage-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:24px;border-top:2px solid var(--gw-rule-strong);border-bottom:2px solid var(--gw-rule-strong)}
.gw-public-coverage-list div{display:grid;gap:4px;padding:18px;border-right:var(--gw-border-w) solid var(--gw-border)}
.gw-public-coverage-list div:last-child{border-right:0}
.gw-public-coverage-list strong{font:800 11px/1.2 var(--gw-font);letter-spacing:.1em;text-transform:uppercase}
.gw-public-coverage-list span{font-size:1.3rem}
.gw-public-coverage-list em{color:var(--gw-text-muted);font:italic 13px/1.4 var(--gw-font)}
.gw-public-footer{max-width:1162px;margin:0 auto;padding:24px 0 48px;display:flex;align-items:baseline;flex-wrap:wrap;gap:8px 18px;color:var(--gw-text-muted);border-top:3px double var(--gw-rule-strong);font-size:13px}
.gw-public-footer strong{color:var(--gw-text)}
.gw-public-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
@media (max-width:850px){
  .gw-public-gap-steps,.gw-public-grid,.gw-public-safety-grid{grid-template-columns:1fr}
  .gw-public-card{min-height:0}
  .gw-public-advanced{grid-template-columns:1fr}
  .gw-public-coverage-list{grid-template-columns:1fr}
  .gw-public-coverage-list div{border-right:0;border-bottom:var(--gw-border-w) solid var(--gw-border)}
  .gw-public-coverage-list div:last-child{border-bottom:0}
}
@media (max-width:600px){
  .gw-public-header{position:relative}
  .gw-public-header-inner{align-items:flex-start;padding:10px 14px}
  .gw-public-header-meta{max-width:190px;flex-wrap:wrap}
  .gw-public-place{width:100%;text-align:right}
  .gw-public-root main{padding:0 14px 44px}
  .gw-public-hero{padding:48px 0 38px}
  .gw-public-hero h1{font-size:clamp(2.4rem,14vw,4rem)}
  .gw-public-availability{grid-template-columns:1fr;padding:16px}
  .gw-public-section{padding-top:48px}
  .gw-public-safety,.gw-public-advanced{margin-top:48px;padding:20px}
  .gw-public-footer{margin:0 14px}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
}`;

const PUBLIC_STYLE_ID = 'gw-public-style';
function ensurePublicStyle(): void {
  if (document.getElementById(PUBLIC_STYLE_ID)) return;
  document.head.append(el('style', { id: PUBLIC_STYLE_ID }, [PUBLIC_STYLE]));
}
