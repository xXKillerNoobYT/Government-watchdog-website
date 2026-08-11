/**
 * Owner-supplied product explainer.
 *
 * The animation contains a deliberately hypothetical civic scenario and
 * figures. It is therefore a gated synthetic presentation, never a reviewed
 * Alpine record. The ordinary route explains that boundary without attaching
 * the media; only the explicit `demo=sample` route renders the player.
 */

import explainerVideoUrl from '../assets/government-watchdog-explainer.mp4?url';
import explainerPosterUrl from '../assets/government-watchdog-explainer-poster.jpg?url';
import { GW_TOKENS } from './tokens';
import { safeExternalHref } from '../data/web-safe';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'href' && safeExternalHref(value) === null) {
      node.setAttribute('data-href-refused', 'unsafe-scheme');
      continue;
    }
    node.setAttribute(key, value);
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

const DEMO_NOTICE =
  'Illustrative product demo — hypothetical scenario and figures, not a live or reviewed Alpine finding.';

const TRANSCRIPT_SCENES: readonly {
  title: string;
  paragraphs: readonly string[];
}[] = [
  {
    title: 'Scene 1 — A decision most people may miss',
    paragraphs: [
      'The opening reads, “Your town is about to decide something that affects your land.” A field of dots highlights a small red group while the captions say that a few people push it through and most people never hear about it.',
      'Everything that follows is one hypothetical teaching scenario, not a report about a real Alpine proposal.',
    ],
  },
  {
    title: 'Scene 2 — The source line: sample agenda item 7a',
    paragraphs: [
      'A fictional Town of Alpine regular council agenda zooms to item 7a. The example describes possible action on a resolution authorizing negotiated purchase or condemnation of property interests for a Cedar Street pedestrian-connectivity project, with an appropriation of funds.',
      'The caption explains the product problem: residents might receive only one procedural line buried in an agenda.',
    ],
  },
  {
    title: 'Scene 3 — Six plain-language questions and example answers',
    paragraphs: [
      'What are they doing? In the example, taking strips of private front yards.',
      'How can they take it? In the example, buy the land or force the sale through eminent domain.',
      'Why? In the example, to build a public sidewalk.',
      'How much? The hypothetical amount is $480,000 set aside.',
      'Who is affected? The hypothetical location is Cedar Street and the example population is 14 homes.',
      'When? The fictional vote is September 3 and the example public-comment deadline is August 20.',
      'Source-reference tags beside the answers demonstrate that every plain-language answer should link back to the record.',
    ],
  },
  {
    title: 'Scene 4 — Hypothetical awareness gap',
    paragraphs: [
      'Three example bars read: 61% know it is happening, 34% were officially informed, and 12% have weighed in.',
      'A row of 14 house icons represents the fictional Cedar Street homes and different neighbor reactions. The scene concludes that the people most affected can be the least likely to have been told.',
    ],
  },
  {
    title: 'Scene 5 — Simple mode',
    paragraphs: [
      'A newspaper-style Government Watchdog Weekly page uses the example headline, “Town May Take Cedar St. Land to Build a Sidewalk.”',
      'Its fictional summary says the town wants to use eminent domain to buy strips of 14 front yards, that $480,000 is set aside, and that a vote is possible September 3.',
      'A “Why it matters” box says 6 of 14 example neighbors do not want to give up land. A “Your one next step” box says to comment by August 20 or speak at the September 3 meeting at 6 PM in the Alpine Town Hall.',
      'The caption defines Simple mode as big type, plain words, and one clear thing to do.',
    ],
  },
  {
    title: 'Scene 6 — Advanced mode',
    paragraphs: [
      'A dense dashboard shows the same fictional Cedar Street sidewalk scenario with the $480,000 amount, process status, public-comment excerpts, community-sentiment bars, source references, and a record timeline.',
      'A highlighted “Hidden changes — transparency alert” says money was added after the notice posted: the example $480,000 appropriation appeared in packet version 2 on August 30, three days before the fictional vote and after most residents had read version 1.',
      'The caption defines Advanced mode as costs, public comments, hidden-change flags, and the full record.',
    ],
  },
  {
    title: 'Scene 7 — Alert and outcome',
    paragraphs: [
      'A sample Government Watchdog alert says the town may take part of a Cedar Street yard for a sidewalk. It repeats the hypothetical eminent-domain method, $480,000 amount, September 3 vote, and August 20 comment deadline.',
      'The outcome graphic changes awareness to 96% of the 14 fictional Cedar Street residents, compared with 34% before the alert.',
      'The caption says the moment the item is filed, everyone hears, illustrating alerts and a plain-English briefing pushed out before it is too late to act.',
    ],
  },
  {
    title: 'Scene 8 — Product takeaway',
    paragraphs: [
      'The closing sequence ties the source record, plain-language Simple view, research-oriented Advanced view, and alert together.',
      'The intended result is a reader who can understand what the example means, see what to do next, and still inspect the underlying source instead of treating an AI summary as the official record.',
    ],
  },
];

export interface ExplainerOptions {
  /** Explicit synthetic-product-media flag, resolved from `demo=sample`. */
  demo?: boolean;
}

export const EXPLAINER_STYLE = `${GW_TOKENS}
.gw-explainer{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-5);max-width:68rem;margin:0 auto;padding:var(--gw-space-6) var(--gw-space-4);color:var(--gw-text);font-family:var(--gw-font)}
.gw-explainer h1{margin:0;font-size:var(--gw-text-display);line-height:var(--gw-leading-tight)}
.gw-explainer h2{margin:0;font-size:var(--gw-text-xl);line-height:var(--gw-leading-tight)}
.gw-explainer p{margin:0;max-width:68ch;color:var(--gw-text-secondary)}
.gw-explainer-kicker{font:700 var(--gw-text-badge)/1.2 var(--gw-font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--gw-accent)!important}
.gw-explainer-intro,.gw-explainer-player,.gw-explainer-transcript{display:grid;gap:var(--gw-space-4);background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);padding:var(--gw-space-5)}
.gw-explainer-notice{display:grid;gap:var(--gw-space-2);padding:var(--gw-space-4);border:var(--gw-border-w) solid var(--gw-caution-line);border-left-width:4px;border-radius:var(--gw-radius);background:var(--gw-caution-bg);color:var(--gw-caution-text)}
.gw-explainer-notice strong{font:700 var(--gw-text-badge)/1.3 var(--gw-font-mono);letter-spacing:.1em;text-transform:uppercase}
.gw-explainer-notice p{color:inherit}
.gw-explainer-figure{display:grid;gap:var(--gw-space-3);margin:0}
.gw-explainer-video{display:block;width:100%;height:auto;aspect-ratio:16/9;background:#070b10;border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius-lg)}
.gw-explainer-figure figcaption{display:flex;flex-wrap:wrap;gap:var(--gw-space-2) var(--gw-space-4);justify-content:space-between;color:var(--gw-text-muted);font:600 var(--gw-text-sm)/1.45 var(--gw-font)}
.gw-explainer-transcript summary{min-height:var(--gw-tap-min);display:flex;align-items:center;cursor:pointer;font-weight:800;color:var(--gw-text)}
.gw-explainer-transcript ol{display:grid;gap:var(--gw-space-4);margin:0;padding-left:1.5rem}
.gw-explainer-transcript li{padding-left:var(--gw-space-2);color:var(--gw-text-secondary)}
.gw-explainer-transcript li strong{display:block;margin-bottom:var(--gw-space-1);color:var(--gw-text)}
.gw-explainer-transcript li p{margin:var(--gw-space-2) 0 0;color:inherit}
.gw-explainer-actions{display:flex;flex-wrap:wrap;gap:var(--gw-space-3)}
.gw-explainer-link,.gw-explainer-back{min-height:var(--gw-tap-min);display:inline-flex;align-items:center;justify-content:center;padding:0 var(--gw-space-4);border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius);color:var(--gw-text);font-weight:750;text-decoration:none}
.gw-explainer-link{border-color:var(--gw-accent);background:var(--gw-accent);color:var(--gw-accent-text-on)}
.gw-explainer-link:hover,.gw-explainer-back:hover{text-decoration:underline;text-underline-offset:3px}
@media (max-width:640px){.gw-explainer{padding:var(--gw-space-4) 0}.gw-explainer-intro,.gw-explainer-player,.gw-explainer-transcript{padding:var(--gw-space-4)}.gw-explainer-actions>a{width:100%}}
@media print{
  .gw-explainer{background:#fff!important;color:#000!important}
  .gw-explainer-intro,.gw-explainer-notice,.gw-explainer-player,.gw-explainer-transcript{display:block!important;background:#fff!important;color:#000!important;border-color:#555!important}
  .gw-explainer p,.gw-explainer-kicker,.gw-explainer-figure figcaption,.gw-explainer-notice p,.gw-explainer-transcript p,.gw-explainer-transcript li,.gw-explainer-transcript li strong,.gw-explainer-transcript summary{display:block!important;color:#000!important}
  .gw-explainer-video{display:none!important}
  .gw-explainer-transcript>ol{display:grid!important}
  .gw-explainer-actions{display:none!important}
}
`;

function ensureExplainerStyle(): void {
  if (document.getElementById('gw-explainer-style')) return;
  document.head.append(el('style', { id: 'gw-explainer-style' }, [EXPLAINER_STYLE]));
}

function demoNotice(): HTMLElement {
  return el('aside', {
    id: 'gw-explainer-demo-notice',
    class: 'gw-explainer-notice',
    role: 'note',
    'data-test': 'explainer-demo-notice',
    'data-origin': 'fixture',
  }, [
    el('strong', {}, ['Illustrative product demo']),
    el('p', {}, [DEMO_NOTICE]),
    el('p', {}, [
      'The animation teaches the product flow. It is not filed in the civic record system and must not be cited as evidence about Alpine.',
    ]),
  ]);
}

function transcript(): HTMLDetailsElement {
  return el('details', {
    id: 'gw-explainer-transcript',
    class: 'gw-explainer-transcript',
    'data-test': 'explainer-transcript',
  }, [
    el('summary', {}, ['Read the full visual transcript']),
    el('p', { id: 'gw-explainer-transcript-summary' }, [
      'Complete text equivalent for a silent 1 minute 13 second animation. No spoken dialogue or music is present. Every place, event, date, amount, percentage, quotation, and outcome below belongs to the hypothetical product demonstration and is not a live or reviewed Alpine finding.',
    ]),
    el('ol', {}, TRANSCRIPT_SCENES.map(({ title, paragraphs }) => el('li', {}, [
      el('strong', {}, [title]),
      ...paragraphs.map((paragraph) => el('p', {}, [paragraph])),
    ]))),
  ]);
}

function player(): HTMLElement {
  const video = el('video', {
    class: 'gw-explainer-video',
    controls: '',
    playsinline: '',
    preload: 'metadata',
    poster: explainerPosterUrl,
    'aria-label': 'Government Watchdog illustrative product demo. Silent video, 1 minute 13 seconds.',
    'aria-describedby': 'gw-explainer-demo-notice gw-explainer-transcript-summary',
    'data-test': 'explainer-video',
  }, [
    el('source', { src: explainerVideoUrl, type: 'video/mp4' }),
    'Your browser does not support HTML video. Read the complete visual transcript below.',
  ]);

  return el('section', {
    class: 'gw-explainer-player',
    'aria-labelledby': 'gw-explainer-player-title',
    'data-test': 'explainer-player',
    'data-origin': 'fixture',
  }, [
    el('h2', { id: 'gw-explainer-player-title' }, ['Watch how the pieces fit together']),
    el('figure', { class: 'gw-explainer-figure' }, [
      video,
      el('figcaption', {}, [
        el('span', {}, ['Silent visual explainer · 1 minute 13 seconds']),
        el('span', {}, ['Native playback controls · no autoplay']),
      ]),
    ]),
  ]);
}

/** Render either the media-free overview or the explicitly selected demo. */
export function renderExplainer(root: HTMLElement, options: ExplainerOptions = {}): void {
  ensureExplainerStyle();
  root.className = 'gw-explainer';
  root.replaceChildren(
    el('p', { class: 'gw-explainer-kicker' }, ['PRODUCT WALKTHROUGH']),
    el('h1', {}, ['How Government Watchdog works']),
    el('p', {}, [
      'See how a public notice can move from a source packet into a plain-language briefing, a deeper research workspace, and a follow-up alert without replacing the official record.',
    ]),
  );

  if (options.demo) {
    root.append(
      demoNotice(),
      player(),
      transcript(),
      el('div', { class: 'gw-explainer-actions' }, [
        el('a', { class: 'gw-explainer-back', href: '#/home', 'data-test': 'explainer-back' }, ['Back to Home']),
      ]),
    );
    return;
  }

  root.append(
    el('section', {
      class: 'gw-explainer-intro',
      'data-test': 'explainer-overview',
      'data-origin': 'product-media',
    }, [
      el('h2', {}, ['Choose the clearly labelled demo']),
      el('p', {}, [
        'The produced walkthrough uses a hypothetical civic scenario. It loads only after you choose the explicit demo route, where the shell and player both identify it as illustrative rather than live civic information.',
      ]),
      el('div', { class: 'gw-explainer-actions' }, [
        el('a', {
          class: 'gw-explainer-link',
          href: '#/explainer?demo=sample',
          'data-test': 'explainer-open-demo',
        }, ['Watch the 1:13 illustrative demo']),
        el('a', { class: 'gw-explainer-back', href: '#/home', 'data-test': 'explainer-back' }, ['Back to Home']),
      ]),
    ]),
  );
}
