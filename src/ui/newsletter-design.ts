/**
 * GOV-84 — the gated design-fixture lane for `#/newsletter`.
 *
 * The matrix (§7) keeps every Newsletter slot **DG** on the reviewed lane and classes the
 * July 21 edition, debate, and lenses as **GS**: "preserved as owner design reference only
 * unless an explicit gated fixture renderer is added". This is that renderer. It is
 * reachable only through `designPreviewActive` + the reviewer lane, and nothing here is
 * importable from the public lane (this module is absent from `PUBLIC_LOCAL_MODULES`, so
 * `publicModuleBoundary()` fails the public build if it is ever pulled in).
 *
 * **Geometry, not civic prose** — the rule established by GOV-76 and applied again here,
 * because Newsletter is the page where breaking it would do the most damage. The baseline
 * supplies a 4-voice roundtable, a full Jul 21 agenda, and a six-lens ideology grid; a
 * synthetic *transcript of political speech*, or a synthetic *ideological classification of
 * a named person*, reads as a real read the moment it is screenshotted. So every leaf here
 * describes the slot it stands in rather than asserting a civic claim:
 *
 *   - No official, meeting, motion, vote, or quotation is named. Voices are `VOICE A…D`.
 *   - No record is classified into a lens. The grid renders the six lens *headings* with an
 *     explicit "no record is classified in the browser" statement in each cell — which is
 *     also what the issue's own acceptance criteria require.
 *   - The roundtable script is placeholder lines, which is sufficient for the playback
 *     position contract (`gw_debate_pos`) the fixture exists to demonstrate.
 */
import { DESIGN_FIXTURE_LABEL } from './design-pages';
import { readDebatePosition, writeDebatePosition } from '../state/local-store';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
}

/** Every fixture card carries the banner label and declares fixture origin at its root. */
function fixtureCard(
  extraClass: string,
  testId: string,
  kicker: string,
  title: string,
  children: (Node | string)[],
): HTMLElement {
  return el('section', {
    class: `gw-nl-baseline-card ${extraClass}`,
    'data-test': testId,
    'data-state': 'fixture',
    'data-origin': 'fixture',
  }, [
    el('div', { class: 'gw-nl-baseline-head' }, [
      el('div', {}, [
        el('p', { class: 'gw-nl-baseline-kicker' }, [kicker]),
        el('h2', { class: 'gw-nl-baseline-title' }, [title]),
      ]),
      el('span', { class: 'gw-nl-fixture-chip', 'data-test': 'newsletter-fixture-chip' }, [DESIGN_FIXTURE_LABEL]),
    ]),
    ...children,
  ]);
}

/** An AI-authored block always carries its label, its caveat, and its receipts state. */
function aiPresented(kind: string): HTMLElement {
  return el('p', { class: 'gw-nl-ai', 'data-test': 'newsletter-ai-presented' }, [
    el('strong', { class: 'gw-nl-ai-label' }, [`AI-PRESENTED ${kind}`]),
    el('span', { class: 'gw-nl-ai-caveat' }, ['not independently verified']),
    el('span', {}, [
      'Synthetic fixture text carries no receipts because no reviewed record backs it. '
      + 'A label is not a legal or political verdict.',
    ]),
  ]);
}

function placeholderLeaf(label: string, text: string): HTMLElement {
  return el('div', { class: 'gw-nl-fixture-leaf', 'data-origin': 'fixture' }, [
    el('strong', { class: 'gw-nl-fixture-leaf-label' }, [label]),
    el('span', {}, [text]),
  ]);
}

/* ---------------------------------------------------------------- pair board */

const PAIR_ROWS = [
  { id: 'SYNTHETIC MEETING 1', pre: 'Pre-meeting edition — placeholder', post: 'Post-meeting edition — placeholder' },
  { id: 'SYNTHETIC MEETING 2', pre: 'Pre-meeting edition — placeholder', post: 'Post-meeting edition — placeholder' },
] as const;

export function meetingPairBoardFixture(): HTMLElement {
  return fixtureCard('gw-nl-meeting-pairs', 'newsletter-meeting-pair-board-fixture', 'NEWS BY MEETING', 'Pre-meeting / post-meeting pairs', [
    el('p', { class: 'gw-nl-baseline-intro' }, [
      'Synthetic pairs. No real meeting is referenced; the pair-jump geometry is what this fixture demonstrates.',
    ]),
    el('div', { class: 'gw-nl-pair-list', 'data-test': 'newsletter-pair-rows' },
      PAIR_ROWS.map((row) => el('article', { class: 'gw-nl-pair-row', 'data-origin': 'fixture' }, [
        el('strong', {}, [row.id]),
        el('a', { class: 'gw-nl-pair-jump', href: '#/newsletter', 'data-test': 'newsletter-pair-jump' }, [row.pre]),
        el('a', { class: 'gw-nl-pair-jump', href: '#/newsletter', 'data-test': 'newsletter-pair-jump' }, [row.post]),
      ]))),
  ]);
}

/* ----------------------------------------------------------------- roundtable */

/**
 * Four placeholder voices. Deliberately NOT synthetic political speech: the fixture exists
 * to prove the transcript geometry and the saved listen position, and a fabricated debate
 * would be the single most misreadable artefact this repo could render.
 */
export const ROUNDTABLE_SCRIPT = [
  { voice: 'VOICE A', line: 'SYNTHETIC PLACEHOLDER LINE — stands in for a reviewed transcript line.' },
  { voice: 'VOICE B', line: 'SYNTHETIC PLACEHOLDER LINE — stands in for a reviewed transcript line.' },
  { voice: 'VOICE C', line: 'SYNTHETIC PLACEHOLDER LINE — stands in for a reviewed transcript line.' },
  { voice: 'VOICE D', line: 'SYNTHETIC PLACEHOLDER LINE — stands in for a reviewed transcript line.' },
] as const;

export function roundtableFixture(): HTMLElement {
  const saved = Math.min(readDebatePosition(), ROUNDTABLE_SCRIPT.length - 1);

  const lines = ROUNDTABLE_SCRIPT.map((entry, i) => el('li', {
    class: 'gw-nl-roundtable-line',
    'data-origin': 'fixture',
    'data-test': 'newsletter-roundtable-line',
    ...(i === saved ? { 'data-current': 'true' } : {}),
  }, [
    el('strong', { class: 'gw-nl-roundtable-voice' }, [entry.voice]),
    el('span', {}, [entry.line]),
  ]));

  const transcript = el('ol', {
    class: 'gw-nl-roundtable-transcript',
    'data-test': 'newsletter-roundtable-transcript',
    hidden: '',
  }, lines);

  const toggle = el('button', {
    type: 'button',
    class: 'gw-nl-roundtable-toggle',
    'data-test': 'newsletter-roundtable-toggle',
    'aria-expanded': 'false',
  }, ['Show transcript']);

  // Collapsed by default, per the baseline.
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    toggle.textContent = open ? 'Show transcript' : 'Hide transcript';
    if (open) transcript.setAttribute('hidden', '');
    else transcript.removeAttribute('hidden');
  });

  const position = el('p', {
    class: 'gw-nl-roundtable-position',
    'data-test': 'newsletter-roundtable-position',
  }, [`Saved listen position: line ${saved + 1} of ${ROUNDTABLE_SCRIPT.length}`]);

  // Advancing writes through local-store; nothing is authored or relabelled client-side.
  const advance = el('button', {
    type: 'button',
    class: 'gw-nl-roundtable-advance',
    'data-test': 'newsletter-roundtable-advance',
  }, ['Advance saved position']);
  advance.addEventListener('click', () => {
    const next = (readDebatePosition() + 1) % ROUNDTABLE_SCRIPT.length;
    writeDebatePosition(next);
    position.textContent = `Saved listen position: line ${next + 1} of ${ROUNDTABLE_SCRIPT.length}`;
    for (const [i, node] of lines.entries()) {
      if (i === next) node.setAttribute('data-current', 'true');
      else node.removeAttribute('data-current');
    }
  });

  return fixtureCard('gw-nl-roundtable', 'newsletter-roundtable-fixture', 'ROUNDTABLE', 'Four-voice roundtable', [
    el('p', { class: 'gw-nl-baseline-intro' }, [
      'Synthetic voices. No official is named and no position is attributed to any real person.',
    ]),
    el('div', { class: 'gw-nl-roundtable-controls', role: 'group', 'aria-label': 'Roundtable playback' }, [toggle, advance]),
    position,
    transcript,
    aiPresented('ROUNDTABLE SUMMARY'),
  ]);
}

/* ------------------------------------------------------------- agenda feature */

const AGENDA_ITEMS = [
  'SYNTHETIC AGENDA ITEM 1 — placeholder for a reviewed agenda item.',
  'SYNTHETIC AGENDA ITEM 2 — placeholder for a reviewed agenda item.',
  'SYNTHETIC AGENDA ITEM 3 — placeholder for a reviewed agenda item.',
] as const;

export function agendaFeatureFixture(): HTMLElement {
  return fixtureCard('gw-nl-agenda-feature', 'newsletter-agenda-feature-fixture', 'FEATURED EDITION', 'Pre / post featured edition', [
    el('p', { class: 'gw-nl-baseline-intro' }, [
      'Synthetic edition. The per-item analysis badge and the v1/v2 diff geometry are what this fixture demonstrates.',
    ]),
    el('ul', { class: 'gw-nl-agenda-items', 'data-test': 'newsletter-agenda-items' },
      AGENDA_ITEMS.map((item) => el('li', { class: 'gw-nl-agenda-item', 'data-origin': 'fixture' }, [
        el('span', {}, [item]),
        el('span', { class: 'gw-nl-analysis-badge', 'data-test': 'newsletter-analysis-badge' }, ['AI ANALYSIS']),
      ]))),
    el('div', { class: 'gw-nl-diff', 'data-test': 'newsletter-version-diff' }, [
      placeholderLeaf('v1', 'SYNTHETIC PLACEHOLDER — stands in for a reviewed prior version.'),
      placeholderLeaf('v2', 'SYNTHETIC PLACEHOLDER — stands in for a reviewed current version.'),
    ]),
    aiPresented('AGENDA ANALYSIS'),
  ]);
}

/* ------------------------------------------------------------------ lens grid */

/**
 * The six lens headings from the baseline. **No record is classified into any of them** —
 * that is an acceptance criterion of GOV-84 and a standing product rule: classification is
 * a backend product, never a browser inference. Each cell states that explicitly.
 */
const LENSES = [
  'Fiscal', 'Process', 'Transparency', 'Land use', 'Services', 'Equity',
] as const;

export function lensGridFixture(): HTMLElement {
  return fixtureCard('gw-nl-lenses', 'newsletter-six-lens-grid-fixture', 'SIX LENSES', 'Ideology lens grid', [
    el('p', { class: 'gw-nl-baseline-intro' }, [
      'Lens headings only. No record is classified into a lens in the browser, and no drift is computed here.',
    ]),
    el('div', { class: 'gw-nl-lens-grid', 'data-test': 'newsletter-lens-cells' },
      LENSES.map((lens) => el('article', { class: 'gw-nl-lens-cell', 'data-origin': 'fixture', 'data-test': 'newsletter-lens-cell' }, [
        el('strong', {}, [lens]),
        el('span', {}, ['No record is classified into this lens in the browser.']),
      ]))),
    aiPresented('LENS COMMENTARY'),
  ]);
}

/* --------------------------------------------------------------- meeting ledger */

const LEDGER_ROWS = ['SYNTHETIC LEDGER ROW 1', 'SYNTHETIC LEDGER ROW 2', 'SYNTHETIC LEDGER ROW 3'] as const;

export function meetingLedgerFixture(): HTMLElement {
  return fixtureCard('gw-nl-ledger', 'newsletter-meeting-ledger-fixture', 'MEETING LEDGER', 'Ledger of covered meetings', [
    el('p', { class: 'gw-nl-baseline-intro' }, [
      'Synthetic rows. No real meeting, date, or outcome is asserted.',
    ]),
    el('ul', { class: 'gw-nl-ledger-rows', 'data-test': 'newsletter-ledger-rows' },
      LEDGER_ROWS.map((row) => el('li', { class: 'gw-nl-ledger-row', 'data-origin': 'fixture' }, [
        el('strong', {}, [row]),
        el('span', {}, ['SYNTHETIC PLACEHOLDER — stands in for a reviewed meeting record.']),
      ]))),
  ]);
}

/** Style for the fixture-only classes. Appended to the newsletter style block. */
export const NEWSLETTER_DESIGN_STYLE = `
.gw-nl-design-banner{font-family:var(--gw-font-mono);font-size:var(--gw-text-badge);font-weight:700;color:var(--gw-caution-text-strong);background:var(--gw-caution-bg);border:var(--gw-border-w) solid var(--gw-caution-line);border-radius:var(--gw-radius);padding:var(--gw-space-3) var(--gw-space-4);margin-bottom:var(--gw-space-4)}
.gw-nl-fixture-chip{font-family:var(--gw-font-mono);font-size:var(--gw-text-badge);font-weight:800;color:var(--gw-caution-text-strong);background:var(--gw-caution-bg);border:var(--gw-border-w) solid var(--gw-caution-line);border-radius:var(--gw-radius-sm);padding:.2rem .45rem;min-height:var(--gw-badge-min);display:inline-flex;align-items:center}
.gw-nl-fixture-leaf{display:grid;gap:.15rem}
.gw-nl-fixture-leaf-label{font-family:var(--gw-font-mono);font-size:var(--gw-text-badge);font-weight:800;text-transform:uppercase;color:var(--gw-text-muted)}
.gw-nl-ai{display:grid;gap:.2rem;margin-top:var(--gw-space-3);font-size:var(--gw-text-sm);color:var(--gw-text-secondary)}
.gw-nl-ai-label{font-family:var(--gw-font-mono);font-size:var(--gw-text-badge);font-weight:800;color:var(--gw-caution-text-strong)}
.gw-nl-ai-caveat{font-style:italic}
.gw-nl-pair-list,.gw-nl-ledger-rows,.gw-nl-agenda-items{list-style:none;margin:0;padding:0;display:grid;gap:var(--gw-space-3)}
.gw-nl-pair-row,.gw-nl-ledger-row,.gw-nl-agenda-item{display:grid;gap:.2rem;background:var(--gw-surface-subtle);border:var(--gw-border-w) solid var(--gw-border-subtle);border-radius:var(--gw-radius);padding:var(--gw-space-3)}
.gw-nl-agenda-item{grid-template-columns:1fr auto;align-items:center;gap:var(--gw-space-3)}
.gw-nl-analysis-badge{font-family:var(--gw-font-mono);font-size:var(--gw-text-badge);font-weight:800;min-height:var(--gw-badge-min);display:inline-flex;align-items:center;color:var(--gw-caution-text-strong)}
.gw-nl-pair-jump{display:inline-flex;align-items:center;min-height:var(--gw-tap-min);color:var(--gw-info-text);font-weight:700}
.gw-nl-roundtable-controls{display:flex;flex-wrap:wrap;gap:var(--gw-space-3);margin:var(--gw-space-3) 0}
.gw-nl-roundtable-toggle,.gw-nl-roundtable-advance{min-height:var(--gw-tap-min);border-radius:var(--gw-radius);border:var(--gw-border-w) solid var(--gw-border-strong);background:var(--gw-surface);padding:0 var(--gw-space-4);font-weight:700}
.gw-nl-roundtable-transcript{list-style:none;margin:0;padding:0;display:grid;gap:var(--gw-space-3)}
.gw-nl-roundtable-line{display:grid;gap:.15rem;padding:var(--gw-space-3);border-radius:var(--gw-radius);border:var(--gw-border-w) solid var(--gw-border-subtle)}
.gw-nl-roundtable-line[data-current="true"]{border-color:var(--gw-caution-line);background:var(--gw-caution-bg)}
.gw-nl-roundtable-voice{font-family:var(--gw-font-mono);font-size:var(--gw-text-badge);font-weight:800;color:var(--gw-text-muted)}
.gw-nl-roundtable-position{font-family:var(--gw-font-mono);font-size:var(--gw-text-sm);color:var(--gw-text-secondary)}
.gw-nl-lens-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:var(--gw-space-3)}
.gw-nl-lens-cell{display:grid;gap:.2rem;background:var(--gw-surface-subtle);border:var(--gw-border-w) solid var(--gw-border-subtle);border-radius:var(--gw-radius);padding:var(--gw-space-3);font-size:var(--gw-text-sm)}
.gw-nl-diff{display:grid;gap:var(--gw-space-3);margin-top:var(--gw-space-3)}
`;
