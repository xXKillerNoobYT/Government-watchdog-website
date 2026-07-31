/**
 * Synthetic, reviewer-only implementations of the four design-handoff routes
 * that do not yet have production data contracts.
 *
 * The prototype bundle is a visual/interaction reference, not a source of civic
 * facts. These renderers therefore fail closed unless the caller explicitly
 * supplies BOTH reviewer-internal access and fixture consent. Every populated
 * surface is visibly labelled, and every persisted interaction is device-local.
 */

import {
  ALERTS_READ_KEY,
  LOCATION_KEY,
  TRACKED_KEY,
  readJson,
  readTracked,
  writeJson,
  writeTracked,
} from '../state/local-store';
import { comingSoonNote, ensureComingSoonStyle } from './coming-soon';
import { readMode } from './shell';
import type { ShellMode } from './shell';
import { applyThemePref, hasExplicitThemePref } from './theme-toggle';
import { GW_TOKENS } from './tokens';
import type { EvidenceLink, ReadApiResponse, StatementRecord } from '../types/read-api';
import {
  confidenceLabel,
  correctionStatusLabel,
  provenanceBadge,
  verificationStatusLabel,
} from './statement-presenter';
import { trustLabel } from './state-view';
import {
  PRIVATE_INFO_NOTES,
  renderPrivateInfoNote,
  type PrivateInfoNoteId,
} from './private-info-note';
import { safeExternalHref } from '../data/web-safe';

export interface DesignPageOptions {
  access?: string;
  fixture?: boolean;
}

export interface SavedLocation {
  state: string;
  county: string;
  region: string;
  town: string;
}

export const DESIGN_FIXTURE_LABEL = 'SYNTHETIC DESIGN FIXTURE — not a live read';
export const TRACKED_STORAGE_KEY = TRACKED_KEY;
export const LOCATION_STORAGE_KEY = LOCATION_KEY;
export const ALERTS_READ_STORAGE_KEY = ALERTS_READ_KEY;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    // C8: a supplied URL is untrusted input. An unsafe scheme is REFUSED, not rendered —
    // the anchor keeps its text and simply has no href, so nothing is clickable and no
    // dead affordance is presented. See safeExternalHref in src/data/web-safe.ts.
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

// GOV-170: the private readStoredJson/writeStoredJson pair lived here and was
// byte-identical in behaviour to readJson/writeJson in src/state/local-store.ts —
// the module that describes itself as "the MOTY localStorage contract in one place".
// Deleted rather than kept: a second copy means a future hardening (quota handling,
// key namespacing, a storage-unavailable signal) lands in one and not the other.

function hasFixtureAccess(options: DesignPageOptions): boolean {
  return options.access === 'reviewer_internal' && options.fixture === true;
}

/**
 * The response is the authority for civic-data admission. Route options may
 * narrow access, but they must never upgrade a public response into the
 * reviewer lane (and callers that omit options still inherit the response's
 * reviewer-internal admission).
 */
function responseScopedOptions(
  options: DesignPageOptions,
  data: ReadApiResponse | undefined,
): DesignPageOptions {
  if (!data) return options;
  if (data.access !== 'reviewer_internal') return { ...options, access: data.access };
  return options.access === undefined ? { ...options, access: data.access } : options;
}

function syncUnpinnedPalette(mode: ShellMode): void {
  if (hasExplicitThemePref()) return;
  applyThemePref(mode === 'advanced' ? 'dark' : 'light');
}

interface PageFrame {
  page: HTMLElement;
  content: HTMLElement;
  mode: ShellMode;
  fixture: boolean;
}

type InfoHeadingTag = 'h1' | 'h2' | 'h3' | 'h4';

function headingWithInfo(
  tag: InfoHeadingTag,
  title: string,
  infoId: PrivateInfoNoteId,
  attrs: Record<string, string> = {},
): HTMLElement {
  return el('div', { class: 'gw-dp-heading-with-info' }, [
    el(tag, attrs, [title]),
    renderPrivateInfoNote(infoId, { contextLabel: title }),
  ]);
}

function infoNoteGroup(
  label: string,
  ids: readonly PrivateInfoNoteId[],
): HTMLElement {
  return el('div', {
    class: 'gw-dp-info-note-group',
    role: 'group',
    'aria-label': label,
  }, [
    el('span', { class: 'gw-dp-muted' }, [label]),
    ...ids.map((id) => el('span', {
      class: 'gw-dp-info-note-item',
      'data-info-note-item': id,
    }, [
      el('span', { class: 'gw-dp-info-note-label' }, [PRIVATE_INFO_NOTES[id].label]),
      renderPrivateInfoNote(id, { contextLabel: label }),
    ])),
  ]);
}

function fixtureBanner(): HTMLElement {
  return el('div', {
    class: 'gw-dp-fixture',
    role: 'status',
    'data-test': 'design-fixture-banner',
  }, [DESIGN_FIXTURE_LABEL]);
}

function reviewedBanner(sourceNotice?: string): HTMLElement {
  return el('div', {
    class: 'gw-dp-fixture gw-dp-reviewed-origin',
    role: 'status',
    'data-test': 'design-reviewed-banner',
  }, [sourceNotice?.trim() || 'REVIEWED BACKEND PROJECTION — not a live read']);
}

function beginPage(
  root: HTMLElement,
  pageId: string,
  title: string,
  subtitle: string,
  infoId: PrivateInfoNoteId,
  options: DesignPageOptions,
  sourceNotice?: string,
): PageFrame | null {
  ensureDesignPagesStyle();
  root.className = 'gw-design-root';
  root.replaceChildren();

  const mode = readMode();
  syncUnpinnedPalette(mode);

  if (options.access !== 'reviewer_internal') {
    root.append(el('div', {
      class: 'gw-dp-page gw-dp-gated',
      'data-mode': mode,
      'data-test': `${pageId}-gated`,
    }, [
      el('div', { class: 'gw-dp-inner' }, [
        el('header', { class: 'gw-dp-page-head' }, [
          el('div', {}, [
            el('p', { class: 'gw-dp-kicker' }, [mode === 'simple' ? 'PLAIN-ENGLISH VIEW' : 'REVIEWER VIEW']),
            el('h1', { class: 'gw-dp-title' }, [title]),
            el('p', { class: 'gw-dp-subtitle' }, [subtitle]),
          ]),
        ]),
        el('section', { class: 'gw-dp-empty', role: 'status' }, [
          el('h2', {}, ['Reviewer access required']),
          el('p', {}, [
            'This page renders no civic records, fixture rows, or device-local selections outside the reviewer-internal lane.',
          ]),
        ]),
      ]),
    ]));
    return null;
  }

  const fixture = hasFixtureAccess(options);
  const content = el('div', { class: 'gw-dp-content' });
  const page = el('div', {
    class: 'gw-dp-page',
    'data-mode': mode,
    'data-test': `${pageId}-page`,
    'data-origin': fixture ? 'synthetic-design-fixture' : 'reviewed-projection',
    ...(fixture ? { 'data-fixture': 'synthetic' } : {}),
  }, [
    fixture ? fixtureBanner() : reviewedBanner(sourceNotice),
    el('div', { class: 'gw-dp-inner' }, [
      el('header', { class: 'gw-dp-page-head' }, [
        el('div', {}, [
          el('p', { class: 'gw-dp-kicker' }, [mode === 'simple'
            ? (fixture ? 'PLAIN-ENGLISH PREVIEW' : 'PLAIN-ENGLISH REVIEWED VIEW')
            : (fixture ? 'REVIEWER DESIGN PREVIEW' : 'REVIEWER EVIDENCE WORKBENCH')]),
          headingWithInfo('h1', title, infoId, { class: 'gw-dp-title' }),
          el('p', { class: 'gw-dp-subtitle' }, [subtitle]),
        ]),
      ]),
      content,
    ]),
  ]);
  root.append(page);
  return { page, content, mode, fixture };
}

function panel(
  title: string,
  kicker: string,
  children: (Node | string)[],
  attrs: Record<string, string> = {},
  infoId?: PrivateInfoNoteId,
): HTMLElement {
  return el('section', { class: 'gw-dp-panel', ...attrs }, [
    el('header', { class: 'gw-dp-panel-head' }, [
      el('p', { class: 'gw-dp-kicker' }, [kicker]),
      infoId ? headingWithInfo('h2', title, infoId) : el('h2', {}, [title]),
    ]),
    ...children,
  ]);
}

function notice(title: string, body: string, tone = 'info', attrs: Record<string, string> = {}): HTMLElement {
  return el('aside', { class: `gw-dp-notice gw-dp-${tone}`, role: 'note', ...attrs }, [
    el('strong', {}, [title]),
    el('p', {}, [body]),
  ]);
}

function reviewedRecords(data?: ReadApiResponse): readonly StatementRecord[] {
  if (data?.access !== 'reviewer_internal') return [];
  return data.records ?? [];
}

function reviewedRecordTitle(record: StatementRecord): string {
  const statement = record.statement_text?.trim();
  return statement || `Reviewed record ${record.statement_id}`;
}

function reviewedReceiptLabel(entry: EvidenceLink, index: number): string {
  return entry.to_source_id?.trim() || `Source ${index + 1}`;
}

function reviewedReceipts(record: StatementRecord, pageId: string): HTMLElement {
  if (!record.evidence.length) {
    return el('section', {
      class: 'gw-dp-empty',
      role: 'status',
      'data-test': `${pageId}-receipt-gap`,
    }, [
      headingWithInfo('h3', 'Source trail unavailable', 'reviewed-source-receipts'),
      el('p', {}, ['This reviewed record did not supply a web-safe receipt. No source was inferred on the client.']),
    ]);
  }

  return el('div', { class: 'gw-dp-receipt-list', 'data-test': `${pageId}-receipts` }, record.evidence.map((entry, index) => {
    const sourceId = reviewedReceiptLabel(entry, index);
    const locator = [
      entry.page === null || entry.page === undefined ? '' : `page ${entry.page}`,
      entry.section?.trim() || '',
      entry.timestamp_human?.trim() || '',
    ].filter(Boolean).join(' · ');
    const suppliedUrls = [
      ['original', 'Open original source', entry.original_url],
      ['archive', 'Open archived source', entry.archive_url],
      ['final', 'Open final source', entry.final_url],
      ['source', 'Open supplied source', entry.url],
    ].filter((item): item is [string, string, string] => Boolean(item[2]))
      .filter((item, itemIndex, items) => items.findIndex((candidate) => candidate[2] === item[2]) === itemIndex);
    const receiptLabels = [
      entry.relation ? `Relation: ${entry.relation}` : '',
      entry.source_type ? `Type: ${entry.source_type}` : '',
      entry.jurisdiction ? `Jurisdiction: ${entry.jurisdiction}` : '',
      entry.verification_status ? `Verification: ${verificationStatusLabel(entry.verification_status)}` : '',
      entry.correction_status ? `Correction: ${correctionStatusLabel(entry.correction_status)}` : '',
      entry.confidence ? `Confidence: ${entry.confidence}` : '',
      entry.archive_status ? `Archive: ${entry.archive_status}` : '',
      entry.layer ? `Layer: ${entry.layer}` : '',
    ].filter(Boolean);
    return el('article', {
      class: 'gw-dp-receipt',
      'data-test': `${pageId}-receipt`,
      'data-source-id': sourceId,
    }, [
      el('strong', {}, [sourceId]),
      el('span', { class: 'gw-dp-muted' }, [[entry.published_by, entry.source_date, locator].filter(Boolean).join(' · ') || 'Receipt metadata not present']),
      ...(receiptLabels.length ? [el('span', {
        class: 'gw-dp-muted',
        'data-test': `${pageId}-receipt-labels`,
      }, [receiptLabels.join(' · ')])] : []),
      ...suppliedUrls.map(([kind, label, url]) => el('a', {
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-test': `${pageId}-receipt-link`,
        'data-link-kind': kind,
      }, [label])),
    ]);
  }));
}

function reviewedRecordLabels(record: StatementRecord): HTMLElement {
  const confidenceClass = confidenceLabel(record);
  const rawConfidence = record.confidence?.trim() ?? '';
  const provenance = provenanceBadge(record);
  const correction = correctionStatusLabel(record.correction_status);
  const labels: HTMLElement[] = [
    el('span', {
      class: 'gw-dp-chip',
      'data-test': 'reviewed-ui-status',
      'data-ui-status': record.ui_status ?? 'unverified',
    }, [`Status: ${trustLabel(record)}`]),
    el('span', {
      class: 'gw-dp-chip gw-dp-caution',
      'data-test': 'reviewed-verification-status',
    }, [`Verification: ${verificationStatusLabel(record.verification_status) ?? 'unavailable'}`]),
    el('span', {
      class: 'gw-dp-chip gw-dp-caution',
      'data-test': 'reviewed-publication-state',
    }, [`Publication: ${record.publication_state?.replace(/_/g, ' ') ?? 'unavailable'}`]),
    el('span', {
      class: 'gw-dp-chip',
      'data-test': 'reviewed-correction-status',
    }, [`Correction: ${correction ?? 'unavailable'}`]),
    el('span', {
      class: 'gw-dp-chip gw-dp-caution',
      'data-test': 'reviewed-source-changed',
    }, [`Source changed: ${record.source_changed == null ? 'unavailable' : record.source_changed ? 'yes' : 'no'}`]),
    el('span', {
      class: `gw-dp-chip gw-dp-${provenance.tone === 'ok' ? 'ok' : 'caution'}`,
      'data-test': 'reviewed-provenance-status',
      'data-provenance': provenance.state,
      title: provenance.description,
    }, [`${provenance.icon} Provenance: ${provenance.label}`]),
    el('span', {
      class: 'gw-dp-chip',
      'data-test': 'reviewed-produced-by',
    }, [`Produced by: ${record.produced_by ?? 'unavailable'}`]),
  ];
  if (rawConfidence) {
    labels.push(el('span', {
      class: 'gw-dp-chip',
      'data-test': 'reviewed-confidence',
    }, [`Confidence: ${rawConfidence}`]));
  }
  if (confidenceClass) {
    labels.push(el('span', {
      class: 'gw-dp-chip',
      'data-test': 'reviewed-confidence-label',
      'data-confidence-label': String(record.confidence_label),
    }, [`Confidence class: ${confidenceClass}`]));
  }
  if (!rawConfidence && !confidenceClass) {
    labels.push(el('span', {
      class: 'gw-dp-chip gw-dp-caution',
      'data-test': 'reviewed-confidence-unavailable',
    }, ['Confidence: unavailable']));
  }
  return el('div', {
    class: 'gw-dp-toolbox',
    'aria-label': 'Backend-supplied record labels',
    'data-test': 'reviewed-record-labels',
  }, labels);
}

function reviewedRecordCard(record: StatementRecord, pageId: string, includeReceipts = true): HTMLElement {
  return el('article', {
    class: 'gw-dp-panel gw-dp-reviewed-record',
    'data-test': `${pageId}-real-record`,
    'data-record-id': record.statement_id,
  }, [
    el('p', { class: 'gw-dp-kicker' }, [`REVIEWED RECORD · ${record.statement_id}`]),
    el('h3', {}, [reviewedRecordTitle(record)]),
    reviewedRecordLabels(record),
    ...(includeReceipts ? [reviewedReceipts(record, pageId)] : []),
  ]);
}

function unavailableSlot(
  title: string,
  body: string,
  testId: string,
  infoId: PrivateInfoNoteId,
): HTMLElement {
  return el('section', {
    class: 'gw-dp-empty gw-dp-unavailable-slot',
    role: 'status',
    'data-test': testId,
  }, [headingWithInfo('h3', title, infoId), el('p', {}, [body])]);
}

interface FixtureOfficial {
  id: string;
  initials: string;
  name: string;
  role: string;
  level: 'town' | 'county' | 'state';
  review: string;
}

/**
 * GOV-83 — synthetic scorecard for the gated Power Tracker fixture.
 *
 * The matrix §5 keeps every score, verdict, quote and vote **DG** on the reviewed lane and
 * classes "placeholder officials, scores, verdicts, quotes, votes" as **GS**: populated only
 * in explicit reviewer design-fixture mode behind the AI/disclaimer interstitial. This is
 * that data, and it is the whole of it — the reviewed lane never reads this table.
 *
 * **Nothing here is derived.** Every figure, including each bar's percentage, is supplied as
 * a literal so the browser computes no score, share, ranking or verdict (an acceptance
 * criterion of GOV-83, and the standing rule that scoring is a backend product). Turning a
 * supplied number into arc length or bar width is presentation; deriving the number is not
 * done anywhere in this file.
 *
 * Officials stay placeholders, consistent with GOV-76/GOV-84: no real person is named, so no
 * synthetic verdict can be read as a claim about anybody.
 */
interface FixtureBar { label: string; count: number; pct: number }
interface FixtureVoteRow { id: string; item: string; position: string; outcome: 'Kept' | 'Broken' | 'Partial' }
interface FixtureScorecard {
  score: number;
  bars: readonly FixtureBar[];
  promises: readonly string[];
  votes: readonly FixtureVoteRow[];
}

const SYNTHETIC_SCORECARD: Readonly<Record<string, FixtureScorecard>> = {
  'official-a': {
    score: 62,
    bars: [
      { label: 'Kept', count: 5, pct: 50 },
      { label: 'Broken', count: 3, pct: 30 },
      { label: 'Partial', count: 2, pct: 20 },
    ],
    promises: [
      'SYNTHETIC PROMISE 1 — placeholder for a reviewed saved quote.',
      'SYNTHETIC PROMISE 2 — placeholder for a reviewed saved quote.',
    ],
    votes: [
      { id: 'vote-a1', item: 'SYNTHETIC AGENDA ITEM 1', position: 'SYNTHETIC POSITION', outcome: 'Kept' },
      { id: 'vote-a2', item: 'SYNTHETIC AGENDA ITEM 2', position: 'SYNTHETIC POSITION', outcome: 'Broken' },
      { id: 'vote-a3', item: 'SYNTHETIC AGENDA ITEM 3', position: 'SYNTHETIC POSITION', outcome: 'Partial' },
    ],
  },
};

/** Donut for a SUPPLIED score. The arc is presentation; the number is fixture data. */
function scoreDonut(score: number): HTMLElement {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 42 42');
  svg.setAttribute('class', 'gw-dp-donut');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Synthetic score ${score} of 100 — fixture value, not a live read`);
  const track = document.createElementNS(svgNs, 'circle');
  track.setAttribute('cx', '21'); track.setAttribute('cy', '21'); track.setAttribute('r', '15.9155');
  track.setAttribute('class', 'gw-dp-donut-track');
  const arc = document.createElementNS(svgNs, 'circle');
  arc.setAttribute('cx', '21'); arc.setAttribute('cy', '21'); arc.setAttribute('r', '15.9155');
  arc.setAttribute('class', 'gw-dp-donut-arc');
  arc.setAttribute('stroke-dasharray', `${score} ${100 - score}`);
  arc.setAttribute('stroke-dashoffset', '25');
  svg.append(track, arc);
  return el('div', { class: 'gw-dp-donut-wrap', 'data-test': 'power-score-donut', 'data-origin': 'fixture' }, [
    svg,
    el('strong', { class: 'gw-dp-donut-value' }, [`${score}`]),
    el('span', { class: 'gw-dp-muted' }, ['SYNTHETIC SCORE — fixture value, not computed here']),
  ]);
}

function keptBrokenBars(bars: readonly FixtureBar[]): HTMLElement {
  return el('div', { class: 'gw-dp-bars', 'data-test': 'power-kept-broken-bars', 'data-origin': 'fixture' },
    bars.map((bar) => el('div', { class: 'gw-dp-bar-row' }, [
      el('span', { class: 'gw-dp-bar-label' }, [`${bar.label} · ${bar.count}`]),
      el('span', { class: 'gw-dp-bar-track' }, [
        el('span', { class: `gw-dp-bar-fill gw-dp-bar-${bar.label.toLowerCase()}`, style: `width:${bar.pct}%` }),
      ]),
      el('span', { class: 'gw-dp-bar-pct' }, [`${bar.pct}%`]),
    ])));
}

function promiseLedger(promises: readonly string[]): HTMLElement {
  return el('div', { class: 'gw-dp-ledger', 'data-test': 'power-promise-ledger', 'data-origin': 'fixture' }, [
    el('div', {}, [
      el('p', { class: 'gw-dp-kicker' }, ['PROMISE LEDGER']),
      el('span', { class: 'gw-dp-ai-badge' }, ['AI-PRESENTED — VERIFY SOURCE FIRST']),
    ]),
    el('ul', { class: 'gw-dp-promise-list' },
      promises.map((text) => el('li', { 'data-origin': 'fixture' }, [text]))),
  ]);
}

/**
 * VOTE / ACTION RECORD. Every row opens the EXISTING `openPowerDetailModal`, which shows the
 * AI-hallucination disclaimer before any promise/action conclusion — the reason GOV-83 routes
 * through it rather than rendering a verdict inline.
 */
function voteRecordTable(
  votes: readonly FixtureVoteRow[],
  official: FixtureOfficial,
  page: HTMLElement,
): HTMLElement {
  const rows = votes.map((vote) => {
    const open = el('button', {
      type: 'button',
      class: 'gw-dp-vote-open',
      'data-test': 'power-vote-row',
      'data-outcome': vote.outcome,
    }, [`${vote.item} · ${vote.outcome}`]);
    open.addEventListener('click', () => openPowerDetailModal(page, open, official));
    return el('tr', { 'data-origin': 'fixture' }, [
      el('td', {}, [open]),
      el('td', {}, [vote.position]),
      el('td', {}, [el('span', { class: `gw-dp-chip gw-dp-outcome-${vote.outcome.toLowerCase()}` }, [vote.outcome])]),
    ]);
  });
  return el('div', { class: 'gw-dp-vote-record', 'data-test': 'power-vote-record', 'data-origin': 'fixture' }, [
    el('p', { class: 'gw-dp-kicker' }, ['VOTE / ACTION RECORD']),
    el('p', { class: 'gw-dp-muted' }, [
      'Synthetic rows. No real vote, motion, or position is asserted; opening a row shows the '
      + 'AI-hallucination disclaimer before any conclusion.',
    ]),
    el('table', { class: 'gw-dp-vote-table' }, [
      el('thead', {}, [el('tr', {}, [
        el('th', { scope: 'col' }, ['Item']),
        el('th', { scope: 'col' }, ['Position']),
        el('th', { scope: 'col' }, ['Outcome']),
      ])]),
      el('tbody', {}, rows),
    ]),
  ]);
}

/** Every official falls back to the same synthetic card; none is ranked against another. */
function scorecardFor(id: string): FixtureScorecard {
  return SYNTHETIC_SCORECARD[id] ?? SYNTHETIC_SCORECARD['official-a']!;
}

const FIXTURE_OFFICIALS: readonly FixtureOfficial[] = [
  {
    id: 'official-a',
    initials: 'OA',
    name: 'Placeholder Official A',
    role: 'Town role — synthetic',
    level: 'town',
    review: 'One synthetic promise/action match is waiting for human review.',
  },
  {
    id: 'official-b',
    initials: 'OB',
    name: 'Placeholder Official B',
    role: 'County role — synthetic',
    level: 'county',
    review: 'No synthetic match is ready for review.',
  },
  {
    id: 'official-c',
    initials: 'OC',
    name: 'Placeholder Official C',
    role: 'State role — synthetic',
    level: 'state',
    review: 'Receipt placeholders are incomplete.',
  },
];

function openPowerDetailModal(page: HTMLElement, opener: HTMLButtonElement, official: FixtureOfficial): void {
  const titleId = `gw-power-dialog-title-${official.id}`;
  const body = el('div', { class: 'gw-dp-modal-body' });
  const closeButton = el('button', {
    type: 'button',
    class: 'gw-dp-icon-button',
    'aria-label': 'Close synthetic match detail',
    'data-test': 'power-modal-close',
  }, ['×']);
  const dialog = el('section', {
    class: 'gw-dp-modal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titleId,
  }, [
    el('header', { class: 'gw-dp-modal-head' }, [
      el('div', {}, [
        el('p', { class: 'gw-dp-kicker' }, ['PROMISE / ACTION REVIEW']),
        el('h2', { id: titleId }, [`${official.name}: synthetic match`]),
      ]),
      closeButton,
    ]),
    body,
  ]);
  const backdrop = el('div', {
    class: 'gw-dp-modal-backdrop',
    'data-test': 'power-modal',
  }, [dialog]);

  const backgroundNodes = [...page.children].filter((node): node is HTMLElement => node instanceof HTMLElement);
  const priorHidden = new Map<HTMLElement, string | null>();
  for (const node of backgroundNodes) {
    priorHidden.set(node, node.getAttribute('aria-hidden'));
    node.inert = true;
    node.setAttribute('aria-hidden', 'true');
  }
  const priorBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const close = (): void => {
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('hashchange', close);
    backdrop.remove();
    document.body.style.overflow = priorBodyOverflow;
    for (const node of backgroundNodes) {
      node.inert = false;
      const hidden = priorHidden.get(node);
      if (hidden === null || hidden === undefined) node.removeAttribute('aria-hidden');
      else node.setAttribute('aria-hidden', hidden);
    }
    if (opener.isConnected) opener.focus();
  };
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((node) => !node.hasAttribute('hidden'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  closeButton.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('hashchange', close);

  const consent = el('button', {
    type: 'button',
    class: 'gw-dp-button gw-dp-primary',
    'data-test': 'power-ai-consent',
  }, ['I understand — show the synthetic detail']);
  body.append(el('div', {
    class: 'gw-dp-ai-gate',
    'data-test': 'power-ai-gate',
  }, [
    el('strong', {}, ['AI-GENERATED ANALYSIS — READ FIRST']),
    infoNoteGroup('How this match and score are filed', ['power-match', 'power-score']),
    el('p', {}, [
      'This match is synthetic and was prepared to demonstrate an AI-assisted review flow. AI can hallucinate, omit context, or make an inaccurate match. Treat the result as a lead and inspect every receipt before drawing a conclusion.',
    ]),
    consent,
  ]));

  consent.addEventListener('click', () => {
    const challengeStatus = el('p', {
      class: 'gw-dp-muted',
      role: 'status',
      'aria-live': 'polite',
      'data-test': 'power-challenge-status',
    });
    const challengeButton = el('button', {
      type: 'button',
      class: 'gw-dp-button gw-dp-secondary',
      'data-test': 'power-challenge',
    }, ['Preview challenge process']);
    challengeButton.addEventListener('click', () => {
      challengeStatus.textContent = 'Challenge preview only — nothing was submitted.';
    });

    const detailHeading = el('h3', { tabindex: '-1' }, ['Fixture disposition: human review required']);
    body.replaceChildren(el('div', {
      class: 'gw-dp-verdict',
      'data-test': 'power-verdict-detail',
    }, [
      detailHeading,
      el('div', { class: 'gw-dp-compare' }, [
        el('article', {}, [
          el('span', { class: 'gw-dp-chip gw-dp-level-town' }, ['PROMISE — FIXTURE']),
          el('p', {}, ['Placeholder statement about a generic public-policy goal.']),
        ]),
        el('article', {}, [
          el('span', { class: 'gw-dp-chip gw-dp-caution' }, ['ACTION — FIXTURE']),
          el('p', {}, ['Placeholder recorded action awaiting source verification.']),
        ]),
      ]),
      el('h3', {}, ['Receipt placeholders']),
      el('ul', { class: 'gw-dp-receipts' }, [
        el('li', {}, ['Source document placeholder — not connected']),
        el('li', {}, ['Meeting record placeholder — not connected']),
      ]),
      notice(
        'Receipts and challenges are not operational here',
        'No receipt on this page has been verified, and the challenge control is a device-only interaction preview. It does not submit, publish, or change a civic record.',
        'caution',
        { 'data-test': 'power-receipt-disclaimer' },
      ),
      challengeButton,
      challengeStatus,
    ]));
    detailHeading.focus();
  });

  page.append(backdrop);
  closeButton.focus();
}

function reviewedPowerLevelFilterGap(): HTMLElement {
  return panel('Jurisdiction level', 'LEVEL FILTER · UNAVAILABLE', [
    el('div', {
      class: 'gw-dp-toolbox',
      role: 'group',
      'aria-label': 'Unavailable power level filters',
    }, ['All', 'Town', 'County', 'State'].map((level) => el('button', {
      type: 'button',
      class: 'gw-dp-tool-pill',
      disabled: '',
      'data-test': 'power-level-filter-option',
      'data-level': level.toLowerCase(),
    }, [`${level} · unavailable`]))),
    el('p', { class: 'gw-dp-muted' }, ['Level filtering requires a reviewed official roster with stable jurisdiction identifiers.']),
  ], { 'data-test': 'power-level-filter-unavailable', 'aria-disabled': 'true' }, 'power-jurisdiction');
}

function reviewedPowerRosterGap(): HTMLElement {
  return panel('Official roster', 'OFFICIALS · UNAVAILABLE', [
    el('div', { class: 'gw-dp-official-list' }, [
      el('button', {
        type: 'button',
        class: 'gw-dp-official',
        disabled: '',
        'data-test': 'power-roster-row-unavailable',
      }, [
        el('span', { class: 'gw-dp-avatar', 'aria-hidden': 'true' }, ['—']),
        el('span', { class: 'gw-dp-official-copy' }, [
          el('strong', {}, ['Official profile unavailable']),
          el('small', {}, ['No policy-cleared roster row was supplied']),
        ]),
        el('span', { class: 'gw-dp-muted' }, ['—']),
      ]),
    ]),
    el('p', { class: 'gw-dp-muted' }, ['No name, office, level, ranking, or promise count is inferred from statement evidence.']),
  ], { 'data-test': 'power-roster-unavailable', 'aria-disabled': 'true' }, 'power-roster');
}

function reviewedPowerProfileGap(): HTMLElement {
  return panel('Official profile and scorecard', 'PROFILE · UNAVAILABLE', [
    el('div', { class: 'gw-dp-profile-head', 'data-test': 'power-profile-geometry' }, [
      el('span', { class: 'gw-dp-avatar gw-dp-avatar-large', 'aria-hidden': 'true' }, ['—']),
      el('div', {}, [
        el('h3', {}, ['Official profile unavailable']),
        el('p', { class: 'gw-dp-muted' }, ['Name, role, term, board, and profile actions require a reviewed official record.']),
      ]),
    ]),
    el('div', { class: 'gw-dp-coverage-grid', 'data-test': 'power-scorecard-geometry' }, [
      ...['Score', 'Kept', 'Broken', 'Pending'].map((label) => el('article', {
        class: 'gw-dp-stat',
        'data-test': 'power-scorecard-stat',
      }, [
        el('strong', {}, ['—']),
        el('span', {}, [`${label} unavailable`]),
      ])),
    ]),
    unavailableSlot(
      'Scores and rankings unavailable',
      'The reviewed statement projection does not contain a policy-cleared official roster or backend score product. No score, ranking, or comparison was inferred.',
      'power-score-unavailable',
      'power-score',
    ),
  ], { 'data-test': 'power-profile-unavailable', 'aria-disabled': 'true' }, 'power-roster');
}

function reviewedPowerPromiseActionGap(): HTMLElement {
  return panel('Promise versus action', 'LATEST VERDICT · CONSENT GATED', [
    unavailableSlot(
      'Promise/action verdict unavailable',
      'A reviewed power-profile contract with backend-supplied promises, actions, typed matches, verdict labels, and receipts is required before this slot can open.',
      'power-verdict-unavailable',
      'power-match',
    ),
    el('div', {
      class: 'gw-dp-toolbox',
      role: 'group',
      'aria-label': 'Unavailable promise and action review controls',
    }, [
      el('button', { type: 'button', class: 'gw-dp-tool-pill', disabled: '', 'data-test': 'power-consent-control-unavailable' }, ['Review AI disclosure · unavailable']),
      el('button', { type: 'button', class: 'gw-dp-tool-pill', disabled: '' }, ['Show match · unavailable']),
      el('button', { type: 'button', class: 'gw-dp-tool-pill', disabled: '', 'data-test': 'power-challenge-control-unavailable' }, ['Challenge verdict · unavailable']),
    ]),
    el('p', { class: 'gw-dp-muted' }, ['Consent and challenge controls remain visible, but cannot operate without an actual reviewed match and receipt chain.']),
  ], { 'data-test': 'power-promise-action-consent-unavailable', 'aria-disabled': 'true' });
}

function reviewedPowerLedgerGap(
  title: string,
  kicker: string,
  testId: string,
  columns: readonly string[],
  body: string,
): HTMLElement {
  return panel(title, kicker, [
    el('table', {
      class: 'gw-dp-ledger-table',
      'aria-label': `${title} columns`,
      'data-test': `${testId}-columns`,
    }, [
      el('thead', {}, [
        el('tr', {}, columns.map((column) => el('th', { scope: 'col' }, [column]))),
      ]),
      el('tbody', {}, [
        el('tr', {}, [
          el('td', { colspan: String(columns.length) }, [body]),
        ]),
      ]),
    ]),
  ], { 'data-test': testId, 'aria-disabled': 'true' }, 'power-ledgers');
}

function renderReviewedPower(frame: PageFrame, data?: ReadApiResponse): void {
  const records = reviewedRecords(data);
  const levelFilterGap = reviewedPowerLevelFilterGap();
  const rosterGap = reviewedPowerRosterGap();
  const profileGap = reviewedPowerProfileGap();
  const promiseActionGap = reviewedPowerPromiseActionGap();
  const quoteLedgerGap = reviewedPowerLedgerGap(
    'Quote ledger',
    'SOURCE-ANCHORED QUOTES · UNAVAILABLE',
    'power-quote-ledger-unavailable',
    ['Quote', 'Source', 'Date', 'Review status'],
    'No reviewed, speaker-safe quote ledger with exact-source anchors was supplied. Statement rows are not relabeled as official quotes.',
  );
  const promiseLedgerGap = reviewedPowerLedgerGap(
    'Promise ledger',
    'PROMISES AND OUTCOMES · UNAVAILABLE',
    'power-promise-ledger-unavailable',
    ['Promise', 'Action', 'Status', 'Receipts'],
    'No reviewed promise ledger or action linkage was supplied. No statement is classified as kept, broken, partial, or pending.',
  );
  const voteActionGap = reviewedPowerLedgerGap(
    'Vote and action record',
    'RECORDED ACTIONS · UNAVAILABLE',
    'power-vote-action-unavailable',
    ['Date', 'Action', 'Vote', 'Promise alignment', 'Receipts'],
    'No reviewed vote, motion, attendance, or official-action table was supplied. Evidence statements are not converted into votes or actions.',
  );
  const recordList = records.length
    ? el('div', { class: 'gw-dp-stack', 'data-test': 'power-real-records' }, records.map((record) => reviewedRecordCard(record, 'power')))
    : unavailableSlot(
      'No reviewed evidence records available',
      'The reviewer projection supplied no statement records. The baseline remains visible without inventing an official or civic claim.',
      'power-records-unavailable',
      'reviewed-record-trust',
    );
  const recordNotes = infoNoteGroup('How reviewed evidence is filed', [
    'reviewed-record-trust',
    'reviewed-source-receipts',
  ]);

  if (frame.mode === 'simple') {
    frame.content.append(el('section', {
      class: 'gw-dp-newspaper-section',
      'data-test': 'power-real-simple-edition',
    }, [
      el('div', { class: 'gw-dp-newspaper-rule' }, [
        el('span', {}, ['WHO HOLDS POWER']),
        el('span', {}, ['REVIEWED EVIDENCE EDITION']),
      ]),
      el('p', { class: 'gw-dp-newspaper-deck' }, ['Reviewed statements and their receipt trails are shown below. They are evidence records, not official profiles or performance judgments.']),
      levelFilterGap,
      rosterGap,
      profileGap,
      panel('Reviewed evidence records', 'SOURCE-BACKED INPUTS', [recordNotes, recordList]),
      promiseActionGap,
      quoteLedgerGap,
      promiseLedgerGap,
      voteActionGap,
    ]));
    return;
  }

  frame.content.append(el('div', {
    class: 'gw-dp-workbench-grid',
    'data-test': 'power-real-advanced-workbench',
  }, [
    el('div', { class: 'gw-dp-stack' }, [
      levelFilterGap,
      rosterGap,
      panel('Reviewed evidence records', 'SOURCE-BACKED INPUTS', [recordNotes, recordList]),
    ]),
    el('div', { class: 'gw-dp-stack' }, [
      profileGap,
      promiseActionGap,
      quoteLedgerGap,
      promiseLedgerGap,
      voteActionGap,
    ]),
  ]));
}

export function renderPowerTracker(
  root: HTMLElement,
  options: DesignPageOptions = {},
  data?: ReadApiResponse,
  sourceNotice?: string,
): void {
  const frame = beginPage(
    root,
    'power-tracker',
    'Power Tracker',
    options.fixture
      ? 'A consent-first preview of promise/action review. Placeholder people and synthetic records only.'
      : 'The baseline power workbench populated only by reviewed statement records and their web-safe receipts.',
    'power-overview',
    responseScopedOptions(options, data),
    sourceNotice,
  );
  if (!frame) return;

  if (!frame.fixture) {
    renderReviewedPower(frame, data);
    return;
  }

  frame.content.append(notice(
    'No real people, scores, or verdicts',
    'Official names are placeholders. This fixture does not calculate or claim a production score, ranking, kept promise, or broken promise.',
    'stop',
    { 'data-test': 'power-score-disclaimer' },
  ));

  if (frame.mode === 'simple') {
    frame.content.append(
      el('section', { class: 'gw-dp-newspaper-section', 'data-test': 'power-simple-edition' }, [
        infoNoteGroup('Power Tracker fixture explanations', [
          'power-jurisdiction',
          'power-roster',
          'power-score',
          'power-match',
          'power-ledgers',
        ]),
        el('div', { class: 'gw-dp-newspaper-rule' }, [
          el('span', {}, ['WHO HOLDS POWER']),
          el('span', {}, ['PLAIN-LANGUAGE FIXTURE EDITION']),
        ]),
        ...FIXTURE_OFFICIALS.map((official) => el('article', { class: 'gw-dp-newspaper-story' }, [
          el('p', { class: `gw-dp-kicker gw-dp-level-${official.level}` }, [official.level.toUpperCase()]),
          el('h2', {}, [official.name]),
          el('p', { class: 'gw-dp-newspaper-deck' }, [official.role]),
          el('p', {}, [official.review]),
          el('p', { class: 'gw-dp-muted' }, ['No score or verdict is available. Receipts and analyst comparison tools remain withheld until a reviewed backend projection exists.']),
        ])),
        el('aside', { class: 'gw-dp-newspaper-note', role: 'note' }, [
          el('strong', {}, ['Need the evidence workbench?']),
          el('span', {}, [' Switch to Advanced for filters, profile comparison, AI consent gates, quote ledgers, and receipt review.']),
        ]),
      ]),
    );
    return;
  }

  const officialsMount = el('div', { class: 'gw-dp-official-list', 'data-test': 'power-official-list' });
  const profileMount = el('div', { 'data-test': 'power-profile-mount' });
  let selectedId = FIXTURE_OFFICIALS[0].id;
  let selectedLevel: 'all' | FixtureOfficial['level'] = 'all';

  const levelTools = el('div', {
    class: 'gw-dp-toolbox',
    role: 'group',
    'aria-label': 'Filter placeholder officials by government level',
    'data-test': 'power-level-tools',
  });
  for (const level of ['all', 'town', 'county', 'state'] as const) {
    const button = el('button', {
      type: 'button',
      class: 'gw-dp-tool-pill',
      'aria-pressed': String(level === selectedLevel),
      'data-power-level': level,
    }, [level === 'all' ? 'All levels' : level[0].toUpperCase() + level.slice(1)]);
    button.addEventListener('click', () => {
      selectedLevel = level;
      const visible = FIXTURE_OFFICIALS.filter((official) => level === 'all' || official.level === level);
      if (!visible.some((official) => official.id === selectedId)) selectedId = visible[0]?.id ?? FIXTURE_OFFICIALS[0].id;
      for (const sibling of levelTools.querySelectorAll<HTMLButtonElement>('[data-power-level]')) {
        sibling.setAttribute('aria-pressed', String(sibling === button));
      }
      renderSelection();
    });
    levelTools.append(button);
  }

  const renderSelection = (): void => {
    officialsMount.replaceChildren();
    for (const official of FIXTURE_OFFICIALS.filter((candidate) => selectedLevel === 'all' || candidate.level === selectedLevel)) {
      const selected = official.id === selectedId;
      const button = el('button', {
        type: 'button',
        class: 'gw-dp-official',
        'aria-pressed': String(selected),
        'data-test': 'power-official',
        'data-official-id': official.id,
      }, [
        el('span', { class: `gw-dp-avatar gw-dp-level-${official.level}`, 'aria-hidden': 'true' }, [official.initials]),
        el('span', { class: 'gw-dp-official-copy' }, [
          el('strong', {}, [official.name]),
          el('small', {}, [official.role]),
        ]),
        el('span', { class: `gw-dp-chip gw-dp-level-${official.level}` }, [official.level.toUpperCase()]),
      ]);
      button.addEventListener('click', () => {
        selectedId = official.id;
        renderSelection();
      });
      officialsMount.append(button);
    }

    const official = FIXTURE_OFFICIALS.find((candidate) => candidate.id === selectedId) ?? FIXTURE_OFFICIALS[0];
    const card = scorecardFor(official.id);
    const openButton = el('button', {
      type: 'button',
      class: 'gw-dp-button gw-dp-primary',
      'data-test': 'power-open-detail',
    }, ['Review synthetic AI match']);
    openButton.addEventListener('click', () => openPowerDetailModal(frame.page, openButton, official));

    profileMount.replaceChildren(panel(official.name, 'PLACEHOLDER PROFILE', [
      infoNoteGroup('How this synthetic profile is filed', [
        'power-score',
        'power-match',
        'power-ledgers',
      ]),
      el('div', { class: 'gw-dp-profile-head' }, [
        el('span', { class: `gw-dp-avatar gw-dp-avatar-large gw-dp-level-${official.level}`, 'aria-hidden': 'true' }, [official.initials]),
        el('div', {}, [
          el('p', {}, [official.role]),
          el('strong', { class: 'gw-dp-no-score' }, ['Production score unavailable']),
        ]),
        scoreDonut(card.score),
      ]),
      keptBrokenBars(card.bars),
      promiseLedger(card.promises),
      voteRecordTable(card.votes, official, frame.page),
      el('div', { class: 'gw-dp-review-card' }, [
        el('span', { class: 'gw-dp-chip gw-dp-caution' }, ['AI DETAIL LOCKED']),
        el('h3', {}, ['Latest synthetic match']),
        el('p', {}, [official.review]),
        el('p', { class: 'gw-dp-muted' }, ['The verdict detail is withheld until the AI-read-first consent step.']),
        openButton,
      ]),
      el('div', { class: 'gw-dp-ledger' }, [
        el('div', {}, [
          el('p', { class: 'gw-dp-kicker' }, ['QUOTE LEDGER']),
          el('span', { class: 'gw-dp-ai-badge' }, ['FOUND BY AI — VERIFY SOURCE FIRST']),
        ]),
        el('p', {}, ['Placeholder quote entry — no real speaker, quotation, source, or attribution is asserted.']),
      ]),
    ], { 'data-test': 'power-profile' }, 'power-roster'));
  };
  renderSelection();

  frame.content.append(
    infoNoteGroup('Power Tracker filter explanation', ['power-jurisdiction']),
    levelTools,
    el('div', { class: 'gw-dp-power-grid' }, [
    panel('Placeholder officials', 'BROKEN-FIRST SORT PREVIEW', [
      officialsMount,
      el('p', { class: 'gw-dp-muted' }, ['Visual ordering only. No real comparison, score, or outcome ranking is produced.']),
    ], {}, 'power-roster'),
    profileMount,
  ]));
}

interface TrackedMeta {
  title: string;
  type: string;
  context: string;
}

const TRACKED_CATALOG: Readonly<Record<string, TrackedMeta>> = {
  moratorium: {
    title: 'Building and annexation moratorium',
    type: 'ISSUE',
    context: 'Synthetic town issue preview',
  },
  str: {
    title: 'Short-term rental policy',
    type: 'ISSUE',
    context: 'Synthetic state issue preview',
  },
  water: {
    title: 'Water and sewer rates review',
    type: 'ISSUE',
    context: 'Synthetic utility issue preview',
  },
  landuse: {
    title: 'Land-use code update',
    type: 'ISSUE',
    context: 'Synthetic county issue preview',
  },
};


function humanizeTrackedKey(key: string): string {
  const text = key.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!text) return 'Untitled tracked issue';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function trackedMeta(key: string): TrackedMeta {
  return TRACKED_CATALOG[key] ?? {
    title: humanizeTrackedKey(key),
    type: 'ISSUE',
    context: 'Locally tracked key — no fixture metadata available',
  };
}

function reviewedWatchlistItemStatusGap(): HTMLElement {
  return el('section', {
    class: 'gw-dp-coverage-grid',
    'data-test': 'watchlist-item-status-geometry',
    'aria-label': 'Unavailable watch item timing and alert details',
  }, [
    el('article', { class: 'gw-dp-stat', 'data-test': 'watchlist-item-next-unavailable' }, [
      el('strong', {}, ['Next']),
      el('span', {}, ['Unavailable']),
      el('small', { class: 'gw-dp-muted' }, ['No reviewed next-event field']),
    ]),
    el('article', { class: 'gw-dp-stat', 'data-test': 'watchlist-item-deadline-unavailable' }, [
      el('strong', {}, ['Deadline']),
      el('span', {}, ['Unavailable']),
      el('small', { class: 'gw-dp-muted' }, ['No reviewed deadline field']),
    ]),
    el('article', { class: 'gw-dp-stat', 'data-test': 'watchlist-item-alert-unavailable' }, [
      el('strong', {}, ['Alert']),
      el('button', {
        type: 'button',
        class: 'gw-dp-switch',
        disabled: '',
        'data-test': 'watchlist-item-alert-control-unavailable',
        'aria-label': 'Alert control unavailable',
      }, [
        el('span', { class: 'gw-dp-switch-track', 'aria-hidden': 'true' }, [el('span')]),
        el('span', { class: 'gw-dp-switch-copy' }, [
          el('b', {}, ['Unavailable']),
          el('small', {}, ['No reviewed alert or delivery contract']),
        ]),
      ]),
    ]),
    infoNoteGroup('How timing and alert fields are filed', ['watchlist-timing', 'watchlist-delivery']),
  ]);
}

function reviewedWatchlistRecentHistoryGap(): HTMLElement {
  return panel('Recent alert and change history', 'RECENT HISTORY · UNAVAILABLE', [
    unavailableSlot(
      'No reviewed history supplied',
      'The statement projection does not include reviewed change, vote, deadline, or delivery events. No recent alert is inferred.',
      'watchlist-recent-history-unavailable',
      'watchlist-delivery',
    ),
  ], { 'data-test': 'watchlist-history-unavailable', 'aria-disabled': 'true' }, 'watchlist-delivery');
}

function reviewedWatchlistDeliverySettingsGap(): HTMLElement {
  const settings = [
    ['Agenda and meeting changes', 'Requires reviewed change events'],
    ['Deadlines', 'Requires reviewed deadline fields'],
    ['Votes and official actions', 'Requires reviewed vote or action records'],
    ['Document changes', 'Requires reviewed source-version events'],
  ];
  return panel('Alert settings and delivery', 'DELIVERY / SETTINGS · UNAVAILABLE', [
    unavailableSlot(
      'Delivery settings unavailable',
      'No account, verified destination, subscription state, cadence, or delivery policy was supplied. Watching locally does not send a message.',
      'watchlist-delivery-settings-unavailable',
      'watchlist-delivery',
    ),
    el('div', { class: 'gw-dp-stack', 'data-test': 'watchlist-settings-geometry' }, settings.map(([name, detail]) => el('button', {
      type: 'button',
      class: 'gw-dp-switch',
      disabled: '',
      'data-test': 'watchlist-setting-control-unavailable',
    }, [
      el('span', { class: 'gw-dp-switch-track', 'aria-hidden': 'true' }, [el('span')]),
      el('span', { class: 'gw-dp-switch-copy' }, [el('b', {}, [name]), el('small', {}, [detail])]),
      el('b', {}, ['Unavailable']),
    ]))),
  ], { 'data-test': 'watchlist-delivery-settings-panel', 'aria-disabled': 'true' }, 'watchlist-delivery');
}

function reviewedWatchlistDeadlinesGap(): HTMLElement {
  return panel('Deadlines on your list', 'DEADLINES · UNAVAILABLE', [
    unavailableSlot(
      'No reviewed deadlines supplied',
      'The statement projection has no reviewed deadline, meeting date, countdown, place, or action window. No due date is inferred.',
      'watchlist-deadlines-unavailable',
      'watchlist-timing',
    ),
    el('article', { class: 'gw-dp-stat', 'data-test': 'watchlist-deadline-row-unavailable' }, [
      el('strong', {}, ['Deadline row unavailable']),
      el('span', {}, ['Date · time · place · countdown unavailable']),
    ]),
    el('button', {
      type: 'button',
      class: 'gw-dp-button gw-dp-secondary',
      disabled: '',
      'data-test': 'watchlist-deadlines-control-unavailable',
    }, ['See all deadlines · unavailable']),
  ], { 'data-test': 'watchlist-deadlines-panel', 'aria-disabled': 'true' }, 'watchlist-timing');
}

function renderReviewedWatchlist(frame: PageFrame, data?: ReadApiResponse): void {
  const records = reviewedRecords(data);
  const recordsById = new Map(records.map((record) => [record.statement_id, record]));
  const mount = el('div', { 'data-test': 'watchlist-real-mount' });
  const status = el('p', {
    class: 'gw-dp-sr-status',
    role: 'status',
    'aria-live': 'polite',
    'data-test': 'watchlist-real-status',
  });

  const render = (): void => {
    const tracked = readTracked();
    const trackedIds = Object.keys(tracked).sort();
    const watched = trackedIds.flatMap((id) => {
      const record = recordsById.get(id);
      return record ? [record] : [];
    });
    const unresolvedCount = trackedIds.length - watched.length;

    const watchedList = watched.length
      ? el('div', { class: 'gw-dp-stack', 'data-test': 'watchlist-real-items' }, watched.map((record) => {
        const remove = el('button', {
          type: 'button',
          class: 'gw-dp-button gw-dp-remove',
          'data-test': 'watchlist-real-remove',
          'data-record-id': record.statement_id,
          'aria-label': `Stop watching reviewed record ${record.statement_id} on this device`,
        }, ['Stop watching locally']);
        remove.addEventListener('click', () => {
          const next = readTracked();
          delete next[record.statement_id];
          writeTracked(next);
          status.textContent = `Reviewed record ${record.statement_id} was removed from this device.`;
          render();
        });
        const card = reviewedRecordCard(record, 'watchlist');
        card.setAttribute('data-test', 'watchlist-real-item');
        card.append(reviewedWatchlistItemStatusGap(), remove);
        return card;
      }))
      : unavailableSlot(
        'No reviewed records watched on this device',
        'This local reading list is empty. No sample issue was inserted.',
        'watchlist-real-empty',
        'watchlist-local-state',
      );

    const unresolved = unresolvedCount
      ? notice(
        'Stored selections not present in this projection',
        `${unresolvedCount} device-local key${unresolvedCount === 1 ? '' : 's'} remain stored, but no civic title or detail is shown without a matching reviewed record.`,
        'caution',
        { 'data-test': 'watchlist-unresolved-local' },
      )
      : el('span');

    const candidates = records.filter((record) => !tracked[record.statement_id]);
    const candidateList = candidates.length
      ? el('div', { class: 'gw-dp-stack', 'data-test': 'watchlist-real-candidates' }, candidates.map((record) => {
        const add = el('button', {
          type: 'button',
          class: 'gw-dp-button gw-dp-secondary',
          'data-test': 'watchlist-real-add',
          'data-record-id': record.statement_id,
          'aria-label': `Watch reviewed record ${record.statement_id} on this device`,
        }, ['Watch locally']);
        add.addEventListener('click', () => {
          const next = readTracked();
          next[record.statement_id] = true;
          writeTracked(next);
          status.textContent = `Reviewed record ${record.statement_id} is now watched on this device.`;
          render();
        });
        return el('article', {
          class: 'gw-dp-review-card',
          'data-test': 'watchlist-real-candidate',
          'data-record-id': record.statement_id,
        }, [
          el('strong', {}, [reviewedRecordTitle(record)]),
          el('p', { class: 'gw-dp-muted' }, [`Reviewed record ${record.statement_id} · ${record.evidence.length} receipt${record.evidence.length === 1 ? '' : 's'}`]),
          add,
        ]);
      }))
      : unavailableSlot(
        'No additional reviewed records available',
        'The current reviewer projection has no other record that can be added to this device-local list.',
        'watchlist-candidates-unavailable',
        'watchlist-add',
      );

    const watchedPanel = panel(
      frame.mode === 'simple' ? 'Stories you are following' : 'Watched reviewed records',
      frame.mode === 'simple' ? 'YOUR LOCAL NEWS FILE' : 'DEVICE-LOCAL WATCHLIST',
      [
        infoNoteGroup('How Watchlist records and receipts are filed', [
          'watchlist-local-state',
          'reviewed-record-trust',
          'reviewed-source-receipts',
        ]),
        el('div', { class: 'gw-dp-count-line' }, [
          el('span', {}, ['Matched reviewed selections']),
          el('strong', { 'data-test': 'watchlist-real-count' }, [`${watched.length}`]),
        ]),
        watchedList,
        unresolved,
        status,
      ],
      { 'data-test': 'watchlist-real-panel' },
    );

    if (frame.mode === 'simple') {
      mount.replaceChildren(el('section', {
        class: 'gw-dp-newspaper-section',
        'data-test': 'watchlist-real-simple-edition',
      }, [
        watchedPanel,
        notice(
          'Device-local reading list',
          'Watching a record here does not create an account, subscription, reminder, or alert.',
          'info',
          { 'data-test': 'watchlist-real-local-notice' },
        ),
        panel('Add reviewed records', 'AVAILABLE IN THIS PROJECTION', [candidateList], {}, 'watchlist-add'),
        panel('Watch controls', 'UNAVAILABLE RECORD TYPES', [
          el('div', { class: 'gw-dp-toolbox', role: 'group', 'aria-label': 'Unavailable watchlist record types' }, [
            el('span', { class: 'gw-dp-tool-pill', 'data-test': 'watchlist-selected-record-type', 'data-selected': 'true' }, ['Reviewed statements · selected']),
            el('button', { type: 'button', class: 'gw-dp-tool-pill', disabled: '' }, ['Boards · unavailable']),
            el('button', { type: 'button', class: 'gw-dp-tool-pill', disabled: '' }, ['Officials · unavailable']),
            el('button', { type: 'button', class: 'gw-dp-tool-pill', disabled: '' }, ['Documents · unavailable']),
          ]),
        ], {}, 'watchlist-record-types'),
        reviewedWatchlistRecentHistoryGap(),
        reviewedWatchlistDeliverySettingsGap(),
        reviewedWatchlistDeadlinesGap(),
      ]));
      return;
    }

    mount.replaceChildren(el('div', {
      class: 'gw-dp-workbench-grid',
      'data-test': 'watchlist-real-advanced-workbench',
    }, [
      watchedPanel,
      el('div', { class: 'gw-dp-stack' }, [
        panel('Add reviewed records', 'AVAILABLE IN THIS PROJECTION', [candidateList], {}, 'watchlist-add'),
        panel('Watch controls', 'ADVANCED TOOLS', [
          el('div', { class: 'gw-dp-toolbox', role: 'group', 'aria-label': 'Watchlist record types' }, [
            el('span', { class: 'gw-dp-tool-pill', 'data-test': 'watchlist-selected-record-type', 'data-selected': 'true' }, ['Reviewed statements · selected']),
            el('button', { type: 'button', class: 'gw-dp-tool-pill', disabled: '' }, ['Boards · unavailable']),
            el('button', { type: 'button', class: 'gw-dp-tool-pill', disabled: '' }, ['Officials · unavailable']),
            el('button', { type: 'button', class: 'gw-dp-tool-pill', disabled: '' }, ['Documents · unavailable']),
          ]),
        ], {}, 'watchlist-record-types'),
        reviewedWatchlistRecentHistoryGap(),
        reviewedWatchlistDeliverySettingsGap(),
        reviewedWatchlistDeadlinesGap(),
      ]),
    ]));
  };

  render();
  frame.content.append(mount);
}

export function renderWatchlist(
  root: HTMLElement,
  options: DesignPageOptions = {},
  data?: ReadApiResponse,
  sourceNotice?: string,
): void {
  const frame = beginPage(
    root,
    'watchlist',
    'Your Watchlist',
    options.fixture
      ? 'A device-local digest of issue keys shared through gw_tracked.'
      : 'A device-local reading list that resolves titles and receipts only from the reviewed projection.',
    'watchlist-overview',
    responseScopedOptions(options, data),
    sourceNotice,
  );
  if (!frame) return;

  if (!frame.fixture) {
    renderReviewedWatchlist(frame, data);
    return;
  }

  frame.content.append(notice(
    'Local tracking only',
    'This page stores issue choices on this device. It does not subscribe you to email, text messages, push notifications, or real alerts.',
    'info',
    { 'data-test': 'watchlist-local-notice' },
  ));
  frame.content.append(infoNoteGroup('Watchlist fixture explanations', [
    'watchlist-local-state',
    'watchlist-add',
    'watchlist-record-types',
    'watchlist-delivery',
  ]));

  let tracked = readTracked();
  const count = el('strong', { 'data-test': 'watchlist-count' });
  const status = el('p', {
    class: 'gw-dp-sr-status',
    role: 'status',
    'aria-live': 'polite',
    'data-test': 'watchlist-status',
  });
  const list = el('div', { class: 'gw-dp-watch-list', 'data-test': 'watchlist-items' });

  const renderItems = (): void => {
    const keys = Object.keys(tracked).sort();
    count.textContent = `${keys.length} ${keys.length === 1 ? 'issue' : 'issues'}`;
    list.replaceChildren();
    if (keys.length === 0) {
      list.append(el('section', {
        class: 'gw-dp-empty',
        role: 'status',
        'data-test': 'watchlist-empty',
      }, [
        el('h3', {}, ['Nothing is tracked on this device yet']),
        el('p', {}, ['Track an issue from a supported page and its local key will appear here. No sample item was invented to fill this state.']),
      ]));
      return;
    }

    for (const key of keys) {
      const meta = trackedMeta(key);
      const remove = el('button', {
        type: 'button',
        class: 'gw-dp-button gw-dp-remove',
        'data-test': 'watchlist-remove',
        'data-tracked-key': key,
        'aria-label': `Stop tracking ${meta.title} on this device`,
      }, ['Stop tracking']);
      remove.addEventListener('click', () => {
        delete tracked[key];
        writeTracked(tracked);
        renderItems();
        status.textContent = `${meta.title} was removed from this device.`;
        const next = list.querySelector<HTMLButtonElement>('[data-test="watchlist-remove"]');
        if (next) next.focus();
        else list.querySelector<HTMLElement>('h3')?.focus();
      });

      list.append(el('article', {
        class: 'gw-dp-watch-row',
        'data-test': 'watchlist-item',
        'data-tracked-key': key,
      }, [
        el('span', { class: 'gw-dp-chip gw-dp-level-town' }, [meta.type]),
        el('div', { class: 'gw-dp-watch-copy' }, [
          el('h3', {}, [meta.title]),
          el('p', {}, [meta.context]),
          el('small', {}, [`Stored key: ${key.slice(0, 80)}`]),
        ]),
        remove,
      ]));
    }
  };
  renderItems();

  const watchedPanel = panel(frame.mode === 'simple' ? 'Stories you are following' : 'Watched issues', frame.mode === 'simple' ? 'YOUR LOCAL NEWS FILE' : 'DEVICE-LOCAL WATCHLIST', [
    el('div', { class: 'gw-dp-count-line' }, [
      el('span', {}, ['Currently tracking']),
      count,
    ]),
    list,
    status,
  ], { 'data-test': 'watchlist-panel' }, 'watchlist-local-state');

  if (frame.mode === 'simple') {
    frame.content.append(el('div', { class: 'gw-dp-newspaper-section', 'data-test': 'watchlist-simple-edition' }, [
      watchedPanel,
      el('aside', { class: 'gw-dp-newspaper-note', role: 'note' }, [
        el('strong', {}, ['This is a reading list, not an alert service.']),
        el('span', {}, [' Switch to Advanced for type filters, delivery controls, deadlines, and activity history when those reviewed services are connected.']),
      ]),
    ]));
    return;
  }

  frame.content.append(el('div', { class: 'gw-dp-workbench-grid', 'data-test': 'watchlist-advanced-workbench' }, [
    watchedPanel,
    el('div', { class: 'gw-dp-stack' }, [
      panel('Watch controls', 'ADVANCED TOOLS', [
        el('div', { class: 'gw-dp-toolbox', role: 'group', 'aria-label': 'Watchlist record types' }, [
          // C7 (iteration 44): this was the ONE enabled pill in a group whose siblings are
          // all disabled-with-title. It carried `aria-pressed="true"` and no handler, so it
          // announced a pressed toggle that could not be operated (micro-detail rule 5).
          //
          // It is NOT an unavailable tool — it is the CURRENT record type. Disabling it
          // would conflate "selected" with "does not work", which the sibling count in
          // test/design-pages.test.ts deliberately distinguishes. A current state is an
          // indicator, so it renders as one: same pill geometry, no false affordance.
          el('span', {
            class: 'gw-dp-tool-pill',
            'data-test': 'watchlist-current-record-type',
            'aria-current': 'true',
          }, ['Issues']),
          el('button', { type: 'button', class: 'gw-dp-tool-pill', disabled: '', title: 'Needs a reviewed boards projection' }, ['Boards · unavailable']),
          el('button', { type: 'button', class: 'gw-dp-tool-pill', disabled: '', title: 'Needs policy-cleared official profiles' }, ['Officials · unavailable']),
          el('button', { type: 'button', class: 'gw-dp-tool-pill', disabled: '', title: 'Needs the source monitoring service' }, ['Documents · unavailable']),
        ]),
        el('p', { class: 'gw-dp-muted' }, ['The full tool layout is present, but unsupported record types stay disabled instead of being filled with synthetic civic facts.']),
      ], {}, 'watchlist-record-types'),
      panel('Recent activity', 'REVIEWED ALERT HISTORY', [
        el('div', { class: 'gw-dp-empty' }, [
          el('h3', {}, ['No connected alert history']),
          el('p', {}, ['Recent changes, votes, deadlines, and missing-record events will appear here only when the alerts backend supplies them.']),
        ]),
      ], {}, 'watchlist-delivery'),
    ]),
  ]));
}

const STATE_NAMES: Readonly<Record<string, string>> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

const WY_COUNTIES = [
  'Albany', 'Big Horn', 'Campbell', 'Carbon', 'Converse', 'Crook', 'Fremont', 'Goshen', 'Hot Springs', 'Johnson',
  'Laramie', 'Lincoln', 'Natrona', 'Niobrara', 'Park', 'Platte', 'Sheridan', 'Sublette', 'Sweetwater', 'Teton',
  'Uinta', 'Washakie', 'Weston',
] as const;

const LINCOLN_TOWNS: Readonly<Record<string, string>> = {
  Alpine: 'Star Valley',
  'Star Valley Ranch': 'Star Valley',
  Thayne: 'Star Valley',
  Afton: 'Star Valley',
  Grover: 'Star Valley',
  Kemmerer: 'South Lincoln',
  Diamondville: 'South Lincoln',
  'La Barge': 'South Lincoln',
  Cokeville: 'South Lincoln',
};

const DEFAULT_LOCATION: SavedLocation = {
  state: 'WY',
  county: 'Lincoln',
  region: 'Star Valley',
  town: 'Alpine',
};

function normalizeLocation(raw: unknown): SavedLocation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_LOCATION };
  const candidate = raw as Record<string, unknown>;
  const state = typeof candidate.state === 'string' && STATE_NAMES[candidate.state] ? candidate.state : DEFAULT_LOCATION.state;
  if (state !== 'WY') return { state, county: '', region: '', town: '' };

  const county = typeof candidate.county === 'string' && (WY_COUNTIES as readonly string[]).includes(candidate.county)
    ? candidate.county
    : '';
  if (!county) return { state, county: '', region: '', town: '' };
  if (county !== 'Lincoln') return { state, county, region: '', town: '' };

  const town = typeof candidate.town === 'string' && LINCOLN_TOWNS[candidate.town] ? candidate.town : '';
  return {
    state,
    county,
    region: town ? LINCOLN_TOWNS[town] : '',
    town,
  };
}

function locationLabel(location: SavedLocation): string {
  const parts = [STATE_NAMES[location.state] ?? location.state];
  if (location.county) parts.push(`${location.county} County`);
  if (location.region) parts.push(location.region);
  if (location.town) parts.push(location.town);
  return parts.join(' › ');
}

function option(value: string, label: string): HTMLOptionElement {
  return el('option', { value }, [label]);
}

function readReviewedDeviceLocation(): SavedLocation | null {
  const parsed = readJson(LOCATION_STORAGE_KEY);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const candidate = parsed as Record<string, unknown>;
  const value = (key: keyof SavedLocation): string => typeof candidate[key] === 'string'
    ? candidate[key].trim().slice(0, 100)
    : '';
  const location = {
    state: value('state'),
    county: value('county'),
    region: value('region'),
    town: value('town'),
  };
  return Object.values(location).some(Boolean) ? location : null;
}

function reviewedLocationLabel(location: SavedLocation | null): string {
  if (!location) return 'No device-local location selected';
  return [location.state, location.county, location.region, location.town].filter(Boolean).join(' › ');
}

/**
 * GOV-87: the baseline's coverage board carries a fourth tile beside Town/County/State
 * — `SPEED = DEMAND + FUNDING`, with "fund your area ›". The slot vanished from both
 * lanes instead of being represented, which is precisely what the handoff forbids.
 *
 * It is restored as **CS**: no payment, pledge, or funding capability exists anywhere
 * in this phase, so there is no contract to await and none is named.
 *
 * Two things are deliberately NOT reproduced. The baseline's line "backlog moves
 * fastest where residents ask & fund it" is an **unsourced causal claim about
 * processing speed** — restoring the slot must not restore that assertion. And the
 * "fund your area ›" call to action is rendered as inert text: no `href`, no form, no
 * control, nothing that could read as a payment path.
 */
function fundingSlot(): HTMLElement {
  ensureComingSoonStyle();
  return el('article', {
    class: 'gw-dp-stat gw-dp-stat-unavailable',
    'data-test': 'location-funding-slot',
    'data-origin': 'coming-soon',
  }, [
    el('strong', {}, ['Funding']),
    comingSoonNote(
      'Fund your area',
      'No payment, pledge, or funding capability exists in this beta. No backlog, '
      + 'processing-speed, or funding-effect figure is calculated, and none is implied.',
    ),
  ]);
}

function renderReviewedLocation(frame: PageFrame, data?: ReadApiResponse): void {
  const location = readReviewedDeviceLocation();
  const records = reviewedRecords(data);
  const alpineScope = data?.access === 'reviewer_internal' && data.scope === 'alpine';
  const selectedAlpine = Boolean(
    location
    && ['wy', 'wyoming'].includes(location.state.toLowerCase())
    && ['lincoln', 'lincoln county'].includes(location.county.toLowerCase())
    && location.town.toLowerCase() === 'alpine',
  );
  const selectedElsewhere = Boolean(location && !selectedAlpine);
  const scopedRecords = alpineScope && !selectedElsewhere ? records : [];
  const savedLabel = reviewedLocationLabel(location);
  const coverageGap = unavailableSlot(
    'Coverage measurements unavailable',
    'The reviewed statement projection does not include a coverage directory, completeness percentage, processing backlog, or geographic availability decision.',
    'location-coverage-unavailable',
    'location-coverage',
  );
  const identityPolicyGap = unavailableSlot(
    'Place identity lock and change policy unavailable',
    'No reviewed canonical place identifier, locked jurisdiction chain, or change-place policy was supplied. The device label below is not treated as official identity.',
    'location-identity-policy-unavailable',
    'location-change-policy',
  );
  const recordsSlot = scopedRecords.length
    ? el('div', { class: 'gw-dp-stack', 'data-test': 'location-real-records' }, scopedRecords.map((record) => reviewedRecordCard(record, 'location')))
    : unavailableSlot(
      selectedElsewhere ? 'No reviewed projection for this saved place' : 'No reviewed Alpine records available',
      selectedElsewhere
        ? 'The device-local selection does not match the supplied Alpine projection, so no civic records are shown.'
        : 'The supplied reviewer response contains no statement rows. No location content was fabricated.',
      'location-records-unavailable',
      'location-saved-scope',
    );
  const recordNotes = infoNoteGroup('How scoped records and receipts are filed', [
    'location-saved-scope',
    'reviewed-record-trust',
    'reviewed-source-receipts',
  ]);

  const selection = el('section', { class: 'gw-dp-panel', 'data-test': 'location-real-picker' }, [
    el('p', { class: 'gw-dp-kicker' }, ['DEVICE-LOCAL SELECTION']),
    headingWithInfo('h2', savedLabel, 'location-saved-scope'),
    el('p', { class: 'gw-dp-muted' }, [location
      ? 'This label comes only from this device. It does not establish official coverage.'
      : 'The location-directory backend is not connected, so the app does not choose a place on your behalf.']),
  ]);

  const disabledSelect = (label: string): HTMLElement => {
    const select = el('select', { class: 'gw-dp-select', disabled: '', 'aria-label': label });
    select.append(option('', `${label} directory unavailable`));
    return el('label', {}, [label, select]);
  };
  const disabledPlaceControls = (): HTMLElement => panel('Place tools', 'LOCATION DIRECTORY', [
    el('div', { class: 'gw-dp-location-selects' }, [
      disabledSelect('State'),
      disabledSelect('County'),
      disabledSelect('Town'),
    ]),
    el('p', { class: 'gw-dp-muted' }, ['The baseline picker stays visible, but unsupported geography controls remain disabled instead of implying coverage.']),
  ], {}, 'location-directory');
  const coverageDiagnostics = (): HTMLElement => panel('Coverage diagnostics', 'REVIEWED COVERAGE CONTRACT', [
    el('p', { class: 'gw-dp-muted' }, [
      'The three government-level positions remain visible, but no percentage, availability state, or service-health conclusion is available.',
    ]),
    el('div', { class: 'gw-dp-coverage-grid', 'data-test': 'location-real-coverage-grid' }, [
      ...['Town', 'County', 'State'].map((level) => el('article', {
        class: 'gw-dp-stat gw-dp-stat-unavailable',
        'data-test': 'location-real-coverage-stat',
      }, [
        el('strong', {}, [level]),
        el('span', {}, ['Coverage unavailable']),
        el('small', { class: 'gw-dp-muted' }, ['No reviewed denominator or freshness value']),
      ])),
      fundingSlot(),
    ]),
  ], {}, 'location-coverage');
  const disabledDirectoryTiles = (): HTMLElement => {
    const tileGroup = (title: string, step: string, count: number): HTMLElement => panel(title, step, [
      el('p', { class: 'gw-dp-muted' }, [`${title} entries require stable reviewed location identifiers.`]),
      el('div', {
        class: title === 'State directory'
          ? 'gw-dp-state-grid gw-dp-disabled-tile-grid'
          : title === 'County directory'
            ? 'gw-dp-county-grid gw-dp-disabled-tile-grid'
            : 'gw-dp-town-grid gw-dp-disabled-tile-grid',
        'data-test': `location-real-${title.split(' ')[0].toLowerCase()}-tiles`,
      }, Array.from({ length: count }, (_, index) => el('button', {
        type: 'button',
        class: 'gw-dp-place-tile',
        disabled: '',
        'aria-label': `${title} slot ${index + 1} unavailable`,
      }, ['—']))),
    ], {}, 'location-directory');
    return el('section', { class: 'gw-dp-location-directory-workbench', 'data-test': 'location-real-directory-workbench' }, [
      tileGroup('State directory', 'STEP 1 · DIRECTORY UNAVAILABLE', 11),
      el('div', { class: 'gw-dp-location-grid' }, [
        tileGroup('County directory', 'STEP 2 · DIRECTORY UNAVAILABLE', 8),
        tileGroup('Town directory', 'STEP 3 · DIRECTORY UNAVAILABLE', 6),
      ]),
    ]);
  };
  const locationHistoryGap = (): HTMLElement => unavailableSlot(
    'Coverage history and backlog unavailable',
    'No reviewed per-level freshness, backlog, funding, or processing-speed contract was supplied.',
    'location-history-unavailable',
    'location-history',
  );

  if (frame.mode === 'simple') {
    frame.content.append(el('section', {
      class: 'gw-dp-newspaper-section',
      'data-test': 'location-real-simple-edition',
    }, [
      el('div', { class: 'gw-dp-newspaper-rule' }, [
        el('span', {}, ['YOUR LOCAL EDITION']),
        el('span', {}, [alpineScope ? 'REVIEWED ALPINE SCOPE' : 'SCOPE UNAVAILABLE']),
      ]),
      selection,
      recordNotes,
      recordsSlot,
      disabledPlaceControls(),
      coverageDiagnostics(),
      disabledDirectoryTiles(),
      coverageGap,
      identityPolicyGap,
      locationHistoryGap(),
    ]));
    return;
  }

  frame.content.append(el('div', {
    class: 'gw-dp-workbench-grid',
    'data-test': 'location-real-advanced-workbench',
  }, [
    el('div', { class: 'gw-dp-stack' }, [
      selection,
      panel('Reviewed records in scope', 'BACKEND STATEMENT PROJECTION', [recordNotes, recordsSlot], {}, 'location-saved-scope'),
    ]),
    el('div', { class: 'gw-dp-stack' }, [
      disabledPlaceControls(),
      coverageDiagnostics(),
      disabledDirectoryTiles(),
      coverageGap,
      identityPolicyGap,
      locationHistoryGap(),
    ]),
  ]));
}

export function renderLocation(
  root: HTMLElement,
  options: DesignPageOptions = {},
  data?: ReadApiResponse,
  sourceNotice?: string,
): void {
  const frame = beginPage(
    root,
    'location',
    'Choose your place',
    options.fixture
      ? 'A valid state, county, region, and town selection stored only on this device.'
      : 'The baseline location workspace with device-local selection and only backend-reviewed records in scope.',
    'location-overview',
    responseScopedOptions(options, data),
    sourceNotice,
  );
  if (!frame) return;

  if (!frame.fixture) {
    renderReviewedLocation(frame, data);
    return;
  }

  let location = normalizeLocation(readJson(LOCATION_STORAGE_KEY));
  const mount = el('div', { 'data-test': 'location-picker' });

  const setLocation = (next: SavedLocation): void => {
    location = normalizeLocation(next);
    writeJson(LOCATION_STORAGE_KEY, location);
    renderPicker();
  };

  const renderPicker = (): void => {
    const stateSelect = el('select', {
      id: 'gw-location-state',
      class: 'gw-dp-select',
      'aria-label': 'State',
      'data-test': 'location-state',
    });
    for (const [code, name] of Object.entries(STATE_NAMES)) stateSelect.append(option(code, name));
    stateSelect.value = location.state;
    stateSelect.addEventListener('change', () => {
      setLocation({ state: stateSelect.value, county: '', region: '', town: '' });
    });

    const countySelect = el('select', {
      id: 'gw-location-county',
      class: 'gw-dp-select',
      'aria-label': 'County',
      'data-test': 'location-county',
    });
    countySelect.append(option('', location.state === 'WY' ? 'Pick a Wyoming county' : 'County unavailable for this state fixture'));
    for (const county of WY_COUNTIES) countySelect.append(option(county, `${county} County`));
    countySelect.value = location.county;
    countySelect.disabled = location.state !== 'WY';
    countySelect.addEventListener('change', () => {
      setLocation({ state: 'WY', county: countySelect.value, region: '', town: '' });
    });

    const townSelect = el('select', {
      id: 'gw-location-town',
      class: 'gw-dp-select',
      'aria-label': 'Town',
      'data-test': 'location-town',
    });
    townSelect.append(option('', location.county === 'Lincoln' ? 'Pick a Lincoln County town' : 'Town unavailable for this county fixture'));
    for (const town of Object.keys(LINCOLN_TOWNS)) townSelect.append(option(town, town));
    townSelect.value = location.town;
    townSelect.disabled = location.state !== 'WY' || location.county !== 'Lincoln';
    townSelect.addEventListener('change', () => {
      setLocation({ state: 'WY', county: 'Lincoln', region: '', town: townSelect.value });
    });

    const breadcrumbs = el('nav', {
      class: 'gw-dp-breadcrumbs',
      'aria-label': 'Selected location',
      'data-test': 'location-breadcrumbs',
    }, [locationLabel(location)]);

    const stateGrid = el('div', { class: 'gw-dp-state-grid', 'data-test': 'location-state-grid' });
    for (const [code, name] of Object.entries(STATE_NAMES)) {
      const button = el('button', {
        type: 'button',
        class: 'gw-dp-place-tile',
        'aria-label': `Select ${name}`,
        'aria-pressed': String(location.state === code),
        'data-state': code,
      }, [code]);
      button.addEventListener('click', () => setLocation({ state: code, county: '', region: '', town: '' }));
      stateGrid.append(button);
    }

    const countyGrid = el('div', { class: 'gw-dp-county-grid', 'data-test': 'location-county-grid' });
    if (location.state === 'WY') {
      for (const county of WY_COUNTIES) {
        const button = el('button', {
          type: 'button',
          class: 'gw-dp-place-tile gw-dp-county-tile',
          'aria-label': `Select ${county} County`,
          'aria-pressed': String(location.county === county),
          'data-county': county,
        }, [county]);
        button.addEventListener('click', () => setLocation({ state: 'WY', county, region: '', town: '' }));
        countyGrid.append(button);
      }
    } else {
      countyGrid.append(el('p', { class: 'gw-dp-muted' }, [
        `${STATE_NAMES[location.state]} has no county fixture in this design preview. Wyoming county and town selections were cleared.`,
      ]));
    }

    const townGrid = el('div', { class: 'gw-dp-town-grid', 'data-test': 'location-town-grid' });
    if (location.state === 'WY' && location.county === 'Lincoln') {
      for (const [town, region] of Object.entries(LINCOLN_TOWNS)) {
        const button = el('button', {
          type: 'button',
          class: 'gw-dp-place-tile gw-dp-town-tile',
          'aria-label': `Select ${town}, ${region}`,
          'aria-pressed': String(location.town === town),
          'data-town': town,
        }, [town]);
        button.addEventListener('click', () => setLocation({ state: 'WY', county: 'Lincoln', region, town }));
        townGrid.append(button);
      }
    } else {
      townGrid.append(el('p', { class: 'gw-dp-muted' }, ['Choose Lincoln County to see the synthetic town list.']));
    }

    const locationSelects = el('div', { class: 'gw-dp-location-selects' }, [
      el('label', { for: 'gw-location-state' }, ['State', stateSelect]),
      el('label', { for: 'gw-location-county' }, ['County', countySelect]),
      el('label', { for: 'gw-location-town' }, ['Town', townSelect]),
    ]);
    const savedNotice = notice(
      'Saved automatically on this device',
      `Current valid selection: ${locationLabel(location)}. Saving a location does not confirm coverage or create an account.`,
      'info',
      { 'data-test': 'location-saved-notice' },
    );
    const fixtureLocationNotes = (): HTMLElement => infoNoteGroup('Location fixture explanations', [
      'location-saved-scope',
      'location-directory',
      'location-coverage',
      'location-change-policy',
    ]);

    if (frame.mode === 'simple') {
      mount.replaceChildren(
        el('section', { class: 'gw-dp-newspaper-section', 'data-test': 'location-simple-edition' }, [
          fixtureLocationNotes(),
          breadcrumbs,
          el('h2', {}, ['Your local edition']),
          el('p', { class: 'gw-dp-newspaper-deck' }, ['Choose the place whose public records you want to read.']),
          locationSelects,
          notice(
            'Fixture coverage figures',
            'Every percentage and coverage state below is a synthetic design fixture, not a measurement of service or processed public records.',
            'caution',
            { 'data-test': 'location-coverage-disclaimer' },
          ),
          infoNoteGroup('How synthetic coverage figures are filed', ['location-coverage']),
          el('div', { class: 'gw-dp-coverage-grid' }, [
            el('article', { class: 'gw-dp-stat', 'data-test': 'location-coverage-figure' }, [
              el('strong', {}, ['Town 62%']),
              el('span', {}, ['Fixture estimate']),
            ]),
            el('article', { class: 'gw-dp-stat', 'data-test': 'location-coverage-figure' }, [
              el('strong', {}, ['County 38%']),
              el('span', {}, ['Fixture estimate']),
            ]),
            el('article', { class: 'gw-dp-stat', 'data-test': 'location-coverage-figure' }, [
              el('strong', {}, ['State 21%']),
              el('span', {}, ['Fixture estimate']),
            ]),
            fundingSlot(),
          ]),
          panel('Pick your state', 'STEP 1 · SYNTHETIC COVERAGE MAP', [
            el('p', { class: 'gw-dp-muted' }, ['The tiles demonstrate selection behavior. They do not represent voting patterns, availability, or current coverage.']),
            stateGrid,
          ], {}, 'location-directory'),
          el('div', { class: 'gw-dp-location-grid' }, [
            panel('Pick a county', 'STEP 2 · WYOMING FIXTURE', [countyGrid], {}, 'location-directory'),
            panel('Pick a town', 'STEP 3 · LINCOLN COUNTY FIXTURE', [townGrid], {}, 'location-directory'),
          ]),
          savedNotice,
        ]),
      );
      return;
    }

    mount.replaceChildren(el('div', {
      class: 'gw-dp-location-advanced',
      'data-test': 'location-advanced-workbench',
    }, [
      fixtureLocationNotes(),
      breadcrumbs,
      locationSelects,
      notice(
        'Fixture coverage figures',
        'Every percentage and coverage state below is a synthetic design fixture, not a measurement of service or processed public records.',
        'caution',
        { 'data-test': 'location-coverage-disclaimer' },
      ),
      infoNoteGroup('How synthetic coverage figures are filed', ['location-coverage']),
      el('div', { class: 'gw-dp-coverage-grid' }, [
        el('article', { class: 'gw-dp-stat', 'data-test': 'location-coverage-figure' }, [
          el('strong', {}, ['Town 62%']),
          el('span', {}, ['Fixture estimate']),
        ]),
        el('article', { class: 'gw-dp-stat', 'data-test': 'location-coverage-figure' }, [
          el('strong', {}, ['County 38%']),
          el('span', {}, ['Fixture estimate']),
        ]),
        el('article', { class: 'gw-dp-stat', 'data-test': 'location-coverage-figure' }, [
          el('strong', {}, ['State 21%']),
          el('span', {}, ['Fixture estimate']),
        ]),
        fundingSlot(),
      ]),
      panel('Pick your state', 'STEP 1 · SYNTHETIC COVERAGE MAP', [
        el('p', { class: 'gw-dp-muted' }, ['The tiles demonstrate selection behavior. They do not represent voting patterns, availability, or current coverage.']),
        stateGrid,
      ], {}, 'location-directory'),
      el('div', { class: 'gw-dp-location-grid' }, [
        panel('Pick a county', 'STEP 2 · WYOMING FIXTURE', [countyGrid], {}, 'location-directory'),
        panel('Pick a town', 'STEP 3 · LINCOLN COUNTY FIXTURE', [townGrid], {}, 'location-directory'),
      ]),
      savedNotice,
    ]));
  };

  renderPicker();
  frame.content.append(mount);
}

interface FixtureAlert {
  id: string;
  icon: string;
  tone: 'stop' | 'caution' | 'ok';
  level: string;
  title: string;
  detail: string;
  when: string;
}

const FIXTURE_ALERTS: readonly FixtureAlert[] = [
  {
    id: 'fixture-attachment-replaced',
    icon: '▲',
    tone: 'stop',
    level: 'TOWN FIXTURE',
    title: 'Fixture packet attachment replaced',
    detail: 'A sample version-change card demonstrates the high-severity state. No document is being monitored.',
    when: 'SAMPLE · RECENT',
  },
  {
    id: 'fixture-meeting-eve',
    icon: '◉',
    tone: 'caution',
    level: 'TOWN FIXTURE',
    title: 'Fixture meeting-eve reminder',
    detail: 'A sample deadline card demonstrates the caution state. No reminder will be delivered.',
    when: 'SAMPLE · UPCOMING',
  },
  {
    id: 'fixture-agenda-posted',
    icon: '✓',
    tone: 'ok',
    level: 'COUNTY FIXTURE',
    title: 'Fixture agenda posted',
    detail: 'A sample posted-state card demonstrates the positive state. It is not sourced from a live feed.',
    when: 'SAMPLE · EARLIER',
  },
];

const FIXTURE_EARLIER: readonly FixtureAlert[] = [
  {
    id: 'fixture-earlier-record',
    icon: '◌',
    tone: 'ok',
    level: 'STATE FIXTURE',
    title: 'Earlier fixture item',
    detail: 'Static layout example for the read-history treatment.',
    when: 'SAMPLE · HISTORY',
  },
];

function readAlertIds(): Set<string> {
  const parsed = readJson(ALERTS_READ_STORAGE_KEY);
  if (!Array.isArray(parsed)) return new Set();
  return new Set(parsed.filter((value): value is string => typeof value === 'string'));
}

function trackedCount(): number {
  return Object.keys(readTracked()).length;
}

function alertRow(alert: FixtureAlert, read = false): HTMLElement {
  return el('article', {
    class: `gw-dp-alert-row gw-dp-alert-${alert.tone}${read ? ' gw-dp-alert-read' : ''}`,
    'data-alert-id': alert.id,
  }, [
    el('span', { class: 'gw-dp-alert-icon', 'aria-hidden': 'true' }, [alert.icon]),
    el('div', { class: 'gw-dp-alert-copy' }, [
      el('span', { class: 'gw-dp-chip' }, [alert.level]),
      el('h3', {}, [alert.title]),
      el('p', {}, [alert.detail]),
      el('time', {}, [alert.when]),
    ]),
  ]);
}

function renderReviewedAlerts(frame: PageFrame, data?: ReadApiResponse): void {
  const records = reviewedRecords(data);
  const recordIds = new Set(records.map((record) => record.statement_id));
  const watchedIds = Object.keys(readTracked()).filter((id) => recordIds.has(id));
  const historyGap = unavailableSlot(
    'Alert history unavailable',
    'The reviewed statement projection contains no alert events, read-state history, document-change events, deadlines, or delivery receipts.',
    'alerts-history-unavailable',
    'alerts-feed',
  );
  const deliveryGap = unavailableSlot(
    'Delivery settings unavailable',
    'No backend alert-preference or recipient contract was supplied. Email, text, push, reminders, and digests remain disabled.',
    'alerts-delivery-unavailable',
    'alerts-delivery',
  );
  const triggerGap = unavailableSlot(
    'Trigger rules unavailable',
    'No reviewed alert-trigger contract was supplied, so the page does not infer agenda, document-change, deadline, or meeting events.',
    'alerts-triggers-unavailable',
    'alerts-triggers',
  );
  const freshnessGap = unavailableSlot(
    'Alert freshness unavailable',
    'No civic-alert response supplied a generated-at value, event timestamp, source freshness, or delivery receipt timestamp.',
    'alerts-freshness-unavailable',
    'alerts-freshness',
  );
  const trackingNote = notice(
    'Device-local watch diagnostics only',
    `${watchedIds.length} locally stored key${watchedIds.length === 1 ? '' : 's'} match reviewed records in this response. This does not mean monitoring or delivery is active.`,
    'info',
    { 'data-test': 'alerts-real-tracked-count' },
  );
  const disabledDelivery = el('div', { class: 'gw-dp-delivery-list', 'data-test': 'alerts-real-delivery-controls' });
  for (const label of ['Email', 'Text', 'Push', 'Meeting-eve reminder', 'Daily digest']) {
    disabledDelivery.append(el('button', {
      type: 'button',
      class: 'gw-dp-switch',
      'aria-label': `${label} unavailable`,
      disabled: '',
    }, [
      el('span', { class: 'gw-dp-switch-track', 'aria-hidden': 'true' }, [el('span')]),
      el('span', { class: 'gw-dp-switch-copy' }, [
        el('strong', {}, [label]),
        el('small', {}, ['Backend preference contract unavailable']),
      ]),
      el('b', {}, ['UNAVAILABLE']),
    ]));
  }
  const emptyAlertSchema = (): HTMLElement => el('section', {
    class: 'gw-dp-alert-row gw-dp-alert-schema',
    'data-test': 'alerts-real-row-schema',
    'data-origin': 'designed-gap',
    role: 'status',
  }, [
    el('span', { class: 'gw-dp-alert-icon', 'aria-hidden': 'true' }, ['◌']),
    el('div', { class: 'gw-dp-alert-copy' }, [
      el('span', { class: 'gw-dp-chip' }, ['SEVERITY / LEVEL UNAVAILABLE']),
      headingWithInfo('h3', 'Alert row schema — no civic event supplied', 'alerts-feed'),
      el('p', {}, ['A reviewed alert row will require an event type, explanation, source receipt, stable id, and read state.']),
      el('time', {}, ['Event time and freshness unavailable']),
      el('span', { class: 'gw-dp-muted' }, ['Receipt link unavailable']),
    ]),
    el('button', { type: 'button', class: 'gw-dp-button gw-dp-mark-read', disabled: '' }, ['Read state unavailable']),
  ]);
  const triggerChecklist = (): HTMLElement => panel('Trigger checklist', 'DESIGNED TARGETS · ALL DISABLED', [
    el('p', { class: 'gw-dp-muted' }, ['These event categories describe the baseline layout only. None is registered or monitored.']),
    el('ul', { class: 'gw-dp-alert-trigger-checklist', 'data-test': 'alerts-real-trigger-checklist' }, [
      ...[
        'Agenda posted',
        'Document changed',
        'Public-comment or filing deadline',
        'Meeting-eve reminder',
        'Missing record or video ladder',
        'Vote or official action',
        'Reviewed promise/action verdict',
        'Split-follow or cross-government handoff',
      ].map((label) => el('li', {}, [
        el('label', {}, [
          el('input', { type: 'checkbox', disabled: '', 'aria-label': `${label} trigger unavailable` }),
          label,
        ]),
      ])),
    ]),
    triggerGap,
  ], {}, 'alerts-triggers');
  const receiptPolicy = (): HTMLElement => notice(
    'No alert without a receipt',
    'A future civic alert must carry a reviewed event id, exact source receipt, event time, and freshness before it can appear here. Statement rows and account notifications are never substituted.',
    'caution',
    { 'data-test': 'alerts-real-receipt-policy' },
  );
  const deliveryPolicy = (): HTMLElement => notice(
    'Delivery policy is not active',
    'No recipient is verified and no speed, meeting-eve, digest, retry, or delivery-time target is promised by this beta.',
    'info',
    { 'data-test': 'alerts-real-delivery-policy' },
  );
  const feedConnectionGap = (): HTMLElement => unavailableSlot(
    'Civic alert feed not connected',
    'No civic-alert response is connected. Statement records and account-workflow notifications are not converted into alert events.',
    'alerts-feed-unavailable',
    'alerts-feed',
  );
  const unreadStateGap = (): HTMLElement => unavailableSlot(
    'Unread count and read state unavailable',
    'Without reviewed alert ids and a read-state contract, the page cannot claim zero unread events or offer a working mark-all action.',
    'alerts-unread-unavailable',
    'alerts-read-state',
  );

  if (frame.mode === 'simple') {
    frame.content.append(el('section', {
      class: 'gw-dp-newspaper-section',
      'data-test': 'alerts-real-simple-edition',
    }, [
      el('div', { class: 'gw-dp-newspaper-rule' }, [
        el('span', {}, ['NEW SINCE YOU LAST READ']),
        el('span', {}, ['REVIEWED ALERT FEED']),
      ]),
      feedConnectionGap(),
      unreadStateGap(),
      emptyAlertSchema(),
      infoNoteGroup('How local watch diagnostics are filed', ['alerts-tracking']),
      trackingNote,
      historyGap,
      panel('Delivery controls', 'BACKEND REQUIRED', [disabledDelivery, deliveryPolicy(), deliveryGap], {}, 'alerts-delivery'),
      triggerChecklist(),
      receiptPolicy(),
      freshnessGap,
    ]));
    return;
  }

  frame.content.append(el('div', {
    class: 'gw-dp-alert-grid',
    'data-test': 'alerts-real-advanced-workbench',
  }, [
    el('div', { class: 'gw-dp-stack' }, [
      panel('Unread', 'REVIEWED ALERT EVENTS', [
        infoNoteGroup('How civic feed and read state are filed', ['alerts-feed', 'alerts-read-state']),
        el('div', { class: 'gw-dp-panel-actions' }, [
          el('span', { class: 'gw-dp-chip', 'data-test': 'alerts-real-unread-count' }, ['Unread count unavailable']),
          el('button', { type: 'button', class: 'gw-dp-button gw-dp-secondary', disabled: '', 'data-test': 'alerts-real-mark-all' }, ['Mark all read · unavailable']),
        ]),
        feedConnectionGap(),
        unreadStateGap(),
        emptyAlertSchema(),
      ], {}, 'alerts-feed'),
      panel('Earlier', 'REVIEWED ALERT HISTORY', [historyGap], {}, 'alerts-feed'),
    ]),
    el('div', { class: 'gw-dp-stack' }, [
      panel('Delivery controls', 'BACKEND REQUIRED', [disabledDelivery, deliveryPolicy(), deliveryGap], {}, 'alerts-delivery'),
      panel('Tracked-item diagnostics', 'DEVICE LOCAL', [
        infoNoteGroup('How tracked-item diagnostics are filed', ['alerts-tracking']),
        trackingNote,
        ...(watchedIds.length ? [el('ul', { class: 'gw-dp-trigger-list', 'data-test': 'alerts-real-watched-ids' }, watchedIds.map((id) => el('li', {
          'data-record-id': id,
        }, [`Reviewed record ${id}`])))] : []),
      ], {}, 'alerts-tracking'),
      triggerChecklist(),
      receiptPolicy(),
      freshnessGap,
    ]),
  ]));
}

export function renderAlerts(
  root: HTMLElement,
  options: DesignPageOptions = {},
  data?: ReadApiResponse,
  sourceNotice?: string,
): void {
  const frame = beginPage(
    root,
    'alerts',
    'Alerts',
    options.fixture
      ? 'A read-state interaction preview. Delivery is not built, and nothing here is subscribed or sent.'
      : 'The baseline alerts workspace with unsupported feed, history, trigger, and delivery products kept visibly unavailable.',
    'alerts-overview',
    responseScopedOptions(options, data),
    sourceNotice,
  );
  if (!frame) return;

  if (!frame.fixture) {
    renderReviewedAlerts(frame, data);
    return;
  }

  frame.content.append(notice(
    'Device-only preview — not subscribed',
    'Reading cards only updates this browser. There is no alert service, recipient, account sync, email, text, or push subscription behind this fixture, and no delivery control to change.',
    'caution',
    { 'data-test': 'alerts-device-only-notice' },
  ));
  frame.content.append(infoNoteGroup('Civic Alerts fixture explanations', [
    'alerts-feed',
    'alerts-read-state',
    'alerts-triggers',
    'alerts-delivery',
    'alerts-tracking',
  ]));

  let readIds = readAlertIds();
  const unreadMount = el('div', { class: 'gw-dp-alert-list', 'data-test': 'alerts-unread-list' });
  const earlierMount = el('div', { class: 'gw-dp-alert-list', 'data-test': 'alerts-earlier-list' });
  const unreadCount = el('span', { class: 'gw-dp-chip gw-dp-stop', 'data-test': 'alerts-unread-count' });
  const feedStatus = el('p', { role: 'status', 'aria-live': 'polite', class: 'gw-dp-sr-status' });
  const markAll = el('button', {
    type: 'button',
    class: 'gw-dp-button gw-dp-secondary',
    'data-test': 'alerts-mark-all',
  }, ['Mark all read']);

  const persistRead = (): void => writeJson(ALERTS_READ_STORAGE_KEY, [...readIds]);
  const renderFeeds = (): void => {
    const unread = FIXTURE_ALERTS.filter((alert) => !readIds.has(alert.id));
    const newlyRead = FIXTURE_ALERTS.filter((alert) => readIds.has(alert.id));
    unreadCount.textContent = `${unread.length} unread`;
    markAll.disabled = unread.length === 0;
    unreadMount.replaceChildren();
    earlierMount.replaceChildren();

    if (unread.length === 0) {
      unreadMount.append(el('section', { class: 'gw-dp-empty', role: 'status', 'data-test': 'alerts-empty' }, [
        el('h3', {}, ['All fixture cards are marked read']),
        el('p', {}, ['There are no unread synthetic cards on this device. This is not a live inbox.']),
      ]));
    } else {
      for (const alert of unread) {
        const row = alertRow(alert);
        row.setAttribute('data-test', 'alerts-unread-item');
        const readButton = el('button', {
          type: 'button',
          class: 'gw-dp-button gw-dp-mark-read',
          'data-test': 'alerts-mark-read',
          'data-alert-id': alert.id,
          'aria-label': `Mark ${alert.title} read on this device`,
        }, ['✓ Read']);
        readButton.addEventListener('click', () => {
          readIds.add(alert.id);
          persistRead();
          renderFeeds();
          feedStatus.textContent = `${alert.title} was marked read on this device.`;
        });
        row.append(readButton);
        unreadMount.append(row);
      }
    }

    for (const alert of [...newlyRead, ...FIXTURE_EARLIER]) {
      const row = alertRow(alert, true);
      row.setAttribute('data-test', 'alerts-earlier-item');
      earlierMount.append(row);
    }
  };

  markAll.addEventListener('click', () => {
    for (const alert of FIXTURE_ALERTS) readIds.add(alert.id);
    persistRead();
    renderFeeds();
    feedStatus.textContent = 'All synthetic alert cards were marked read on this device.';
  });
  renderFeeds();

  // GOV-86: the fixture lane used to render four `role="switch"` toggles that
  // persisted to `gw_alert_delivery_preview`, with email and meeting-eve defaulting
  // ON. A switch that reads ON and survives a reload IS a configured setting to the
  // person looking at it, whatever the surrounding notice says — and no channel,
  // recipient verification, or delivery service exists in any lane. That makes this
  // an unbuilt FEATURE (CS), not a device-local preview (DL): see the CS-versus-DG
  // section of docs/design-information-type-matrix.md. All five channels are named
  // here so the fixture lane stops disagreeing with the reviewed lane, which has
  // always listed Push.
  ensureComingSoonStyle();
  const deliveryMount = el('div', { class: 'gw-dp-delivery-list', 'data-test': 'alerts-delivery-preview' }, [
    comingSoonNote(
      'Alert delivery',
      'Email, text, push, meeting-eve reminders, and the daily digest are not built in any lane. '
      + 'There is no delivery channel, no recipient verification, and no way to switch one on — '
      + 'so nothing here is a setting, and no preference is stored on this device.',
    ),
  ]);

  const feedColumn = el('div', { class: 'gw-dp-stack' }, [
      panel(frame.mode === 'simple' ? 'New since you last read' : 'Unread fixture cards', 'UNREAD', [
        el('div', { class: 'gw-dp-panel-actions' }, [unreadCount, markAll]),
        unreadMount,
        feedStatus,
      ], {}, 'alerts-read-state'),
      panel(frame.mode === 'simple' ? 'Earlier notices' : 'Earlier fixture cards', 'EARLIER · READ', [earlierMount], {}, 'alerts-feed'),
    ]);

  if (frame.mode === 'simple') {
    frame.content.append(el('section', { class: 'gw-dp-newspaper-section', 'data-test': 'alerts-simple-edition' }, [
      feedColumn,
      el('aside', { class: 'gw-dp-newspaper-note', role: 'note' }, [
        el('strong', {}, ['A calm reading view.']),
        el('span', {}, [' Switch to Advanced to configure device-only delivery previews, inspect trigger types, and review tracked-item diagnostics.']),
      ]),
    ]));
    return;
  }

  frame.content.append(el('div', { class: 'gw-dp-alert-grid', 'data-test': 'alerts-advanced-workbench' }, [
    feedColumn,
    el('div', { class: 'gw-dp-stack' }, [
      panel('Delivery controls', 'COMING SOON', [
        deliveryMount,
        el('p', { class: 'gw-dp-muted' }, ['No recipient is registered and no delivery timing is promised, in this lane or any other.']),
      ], {}, 'alerts-delivery'),
      panel('What a future alert could represent', 'TRIGGER EXAMPLES', [
        el('ul', { class: 'gw-dp-trigger-list' }, [
          el('li', {}, ['A fixture document-change event']),
          el('li', {}, ['A fixture agenda-posted event']),
          el('li', {}, ['A fixture deadline or meeting-eve event']),
        ]),
        el('p', {}, [
          'Local tracked issue count: ',
          el('strong', { 'data-test': 'alerts-tracked-count' }, [String(trackedCount())]),
          '. This count comes from gw_tracked; it does not mean monitoring is active.',
        ]),
        infoNoteGroup('How local tracked-item counts are filed', ['alerts-tracking']),
      ], {}, 'alerts-triggers'),
    ]),
  ]));
}

export const DESIGN_PAGES_STYLE = `${GW_TOKENS}
.gw-design-root{font-family:var(--gw-font);color:var(--gw-text);background:var(--gw-page-bg);min-height:100%;line-height:var(--gw-leading)}
.gw-dp-page,.gw-dp-gated{min-height:100%;color:var(--gw-text);background:var(--gw-page-bg)}
.gw-dp-page *,.gw-dp-gated *{box-sizing:border-box}
.gw-dp-page[data-mode="simple"]{font-family:var(--gw-font-serif);font-size:var(--gw-text-md)}
.gw-dp-page[data-mode="advanced"]{font-family:var(--gw-font);font-size:var(--gw-text-body)}
.gw-dp-fixture{position:relative;z-index:2;padding:var(--gw-space-2) var(--gw-space-5);border-bottom:var(--gw-border-w) solid var(--gw-tone-caution-line);background:var(--gw-tone-caution-well);color:var(--gw-caution-text);font:700 var(--gw-text-badge)/1.35 var(--gw-font-mono);text-align:center;letter-spacing:.03em}
.gw-dp-reviewed-origin{border-color:var(--gw-tone-info-line);background:var(--gw-tone-info-well);color:var(--gw-info-text)}
.gw-dp-inner,.gw-dp-gated{width:min(100% - 2rem,1200px);margin:0 auto;padding:var(--gw-space-6) 0 2rem}
.gw-dp-page[data-mode="simple"] .gw-dp-inner{width:min(100% - 2rem,900px);background:var(--gw-surface);padding:var(--gw-space-6);border-inline:var(--gw-border-w) solid var(--gw-border-subtle)}
.gw-dp-page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--gw-space-5);padding-bottom:var(--gw-space-5);border-bottom:var(--gw-border-w) solid var(--gw-rule-strong);margin-bottom:var(--gw-space-5)}
.gw-dp-heading-with-info{display:inline-flex;align-items:center;gap:var(--gw-space-2);min-width:0;max-width:100%}
.gw-dp-heading-with-info>h1,.gw-dp-heading-with-info>h2,.gw-dp-heading-with-info>h3,.gw-dp-heading-with-info>h4{min-width:0}
.gw-dp-info-note-group{display:flex;align-items:center;flex-wrap:wrap;gap:var(--gw-space-2);max-width:100%;padding:var(--gw-space-2) 0}
.gw-dp-info-note-group>.gw-dp-muted{font-size:var(--gw-text-badge);font-weight:700}
.gw-dp-info-note-item{display:inline-flex;align-items:center;gap:var(--gw-space-1);min-height:var(--gw-tap-min);padding-left:var(--gw-space-2);border:var(--gw-border-w) solid var(--gw-border-subtle);border-radius:var(--gw-radius-pill);background:var(--gw-surface-well)}
.gw-dp-info-note-label{max-width:18rem;color:var(--gw-text-secondary);font-size:var(--gw-text-badge);font-weight:700;line-height:var(--gw-leading-tight)}
.gw-dp-title{font-size:var(--gw-text-display);line-height:var(--gw-leading-tight);margin:.15rem 0}
.gw-dp-subtitle{max-width:52rem;margin:0;color:var(--gw-text-secondary)}
.gw-dp-kicker{margin:0;color:var(--gw-accent);font:800 var(--gw-text-kicker)/1.35 var(--gw-font);letter-spacing:1.4px;text-transform:uppercase}
.gw-dp-button,.gw-dp-icon-button,.gw-dp-official,.gw-dp-place-tile,.gw-dp-switch,.gw-dp-select,.gw-dp-tool-pill{min-height:var(--gw-tap-min);min-width:var(--gw-tap-min);font:700 var(--gw-text-badge)/1.25 var(--gw-font)}
.gw-dp-page button:disabled,.gw-dp-page select:disabled{cursor:not-allowed;opacity:.62}
.gw-dp-content,.gw-dp-stack{display:grid;min-width:0;gap:var(--gw-space-5)}
.gw-dp-stack>*{min-width:0}
.gw-dp-toolbox{display:flex;align-items:center;gap:var(--gw-space-2);flex-wrap:wrap;padding:var(--gw-space-3);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-surface-well)}
.gw-dp-tool-pill{appearance:none;padding:.45rem .85rem;border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);background:var(--gw-surface);color:var(--gw-text-secondary);cursor:pointer}
.gw-dp-tool-pill[aria-pressed="true"],.gw-dp-tool-pill[data-selected="true"]{border-color:var(--gw-accent);background:var(--gw-tone-mint-well);color:var(--gw-accent)}
.gw-dp-tool-pill[data-selected="true"]{cursor:default}
.gw-dp-tool-pill:disabled{cursor:not-allowed;opacity:.58}
.gw-dp-workbench-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(18rem,.75fr);gap:var(--gw-space-5);align-items:start}
.gw-dp-newspaper-section{display:grid;gap:0;border-top:3px double var(--gw-rule-strong);border-bottom:3px double var(--gw-rule-strong);padding:var(--gw-space-4) 0}
.gw-dp-newspaper-rule{display:flex;align-items:center;justify-content:space-between;gap:var(--gw-space-4);padding:0 0 var(--gw-space-3);border-bottom:var(--gw-border-w) solid var(--gw-rule-strong);font:800 12px/1.25 var(--gw-font);letter-spacing:1px}
.gw-dp-newspaper-story{padding:var(--gw-space-6) 0;border-bottom:var(--gw-border-w) solid var(--gw-border);column-count:2;column-gap:var(--gw-space-6)}
.gw-dp-newspaper-story:last-of-type{border-bottom:0}.gw-dp-newspaper-story h2{column-span:all;margin:.15rem 0;font:600 1.55rem/1.08 var(--gw-font-serif)}
.gw-dp-newspaper-story .gw-dp-kicker,.gw-dp-newspaper-story .gw-dp-newspaper-deck{column-span:all}.gw-dp-newspaper-deck{font-size:1.08rem;color:var(--gw-text-secondary);font-style:italic}
.gw-dp-newspaper-note{margin-top:var(--gw-space-4);padding:var(--gw-space-4) 0;border-top:var(--gw-border-w) solid var(--gw-rule-strong);font-style:italic;color:var(--gw-text-secondary)}
.gw-dp-panel{padding:var(--gw-space-6);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);background:var(--gw-surface)}
.gw-dp-page[data-mode="simple"] .gw-dp-panel{border-radius:var(--gw-radius-sm);background:var(--gw-surface-subtle)}
.gw-dp-panel-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--gw-space-3);margin-bottom:var(--gw-space-4)}
.gw-dp-panel h2,.gw-dp-panel h3,.gw-dp-empty h2,.gw-dp-empty h3{margin:.2rem 0;line-height:var(--gw-leading-tight)}
.gw-dp-panel p{margin:.4rem 0}
.gw-dp-notice{border:var(--gw-border-w) solid var(--gw-tone-info-line);border-left:3px solid var(--gw-info-text);border-radius:0 var(--gw-radius) var(--gw-radius) 0;background:var(--gw-tone-info-well);padding:var(--gw-space-4) var(--gw-space-5)}
.gw-dp-notice p{margin:.25rem 0 0;color:var(--gw-text-secondary)}
.gw-dp-notice.gw-dp-caution{border-color:var(--gw-tone-caution-line);border-left-color:var(--gw-caution-line);background:var(--gw-tone-caution-well)}
.gw-dp-notice.gw-dp-stop{border-color:var(--gw-tone-stop-line);border-left-color:var(--gw-stop-border);background:var(--gw-tone-stop-well)}
.gw-dp-button,.gw-dp-icon-button{display:inline-flex;align-items:center;justify-content:center;gap:var(--gw-space-2);padding:.55rem .9rem;border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius);color:var(--gw-text);background:var(--gw-surface-subtle);cursor:pointer}
.gw-dp-button:disabled{opacity:.5;cursor:not-allowed}
.gw-dp-primary{color:var(--gw-accent-text-on);background:var(--gw-accent);border-color:var(--gw-accent)}
.gw-dp-secondary{color:var(--gw-accent);border-color:var(--gw-accent);background:var(--gw-surface)}
.gw-dp-remove{color:var(--gw-stop-text);border-color:var(--gw-stop-border)}
.gw-dp-icon-button{padding:0;border-radius:var(--gw-radius-pill);font-size:1.5rem}
.gw-dp-donut-wrap{display:grid;justify-items:center;gap:.15rem;margin-left:auto}
.gw-dp-donut{width:4.5rem;height:4.5rem;transform:rotate(-90deg)}
.gw-dp-donut-track{fill:none;stroke:var(--gw-border-subtle);stroke-width:4}
.gw-dp-donut-arc{fill:none;stroke:var(--gw-caution-line);stroke-width:4}
.gw-dp-donut-value{font:800 var(--gw-text-lg)/1 var(--gw-font-mono)}
.gw-dp-bars{display:grid;gap:var(--gw-space-2);margin-top:var(--gw-space-3)}
.gw-dp-bar-row{display:grid;grid-template-columns:8rem 1fr 3rem;align-items:center;gap:var(--gw-space-3);font-size:var(--gw-text-sm)}
.gw-dp-bar-track{background:var(--gw-surface-subtle);border:var(--gw-border-w) solid var(--gw-border-subtle);border-radius:var(--gw-radius-sm);height:.75rem;overflow:hidden}
.gw-dp-bar-fill{display:block;height:100%;background:var(--gw-caution-line)}
.gw-dp-bar-pct{font-family:var(--gw-font-mono);font-size:var(--gw-text-badge);text-align:right}
.gw-dp-promise-list{list-style:none;margin:.35rem 0 0;padding:0;display:grid;gap:var(--gw-space-2);font-size:var(--gw-text-sm)}
.gw-dp-vote-record{margin-top:var(--gw-space-4);display:grid;gap:var(--gw-space-2)}
.gw-dp-vote-table{width:100%;border-collapse:collapse;font-size:var(--gw-text-sm)}
.gw-dp-vote-table th,.gw-dp-vote-table td{text-align:left;padding:var(--gw-space-2);border-bottom:var(--gw-border-w) solid var(--gw-border-subtle);vertical-align:middle}
.gw-dp-vote-table th{font:800 var(--gw-text-badge)/1.2 var(--gw-font-mono);text-transform:uppercase;color:var(--gw-text-muted)}
.gw-dp-vote-open{display:inline-flex;align-items:center;min-height:var(--gw-tap-min);background:none;border:0;padding:0;color:var(--gw-info-text);font-weight:700;text-align:left;cursor:pointer}
.gw-dp-vote-open:hover{text-decoration:underline}
.gw-dp-chip,.gw-dp-ai-badge{display:inline-flex;align-items:center;min-height:1.65rem;padding:.15rem .5rem;border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius-sm);font:800 var(--gw-text-badge)/1.2 var(--gw-font);letter-spacing:.04em}
.gw-dp-chip.gw-dp-ok{border-color:var(--gw-ok-text);color:var(--gw-ok-text)}
.gw-dp-ai-badge,.gw-dp-caution{color:var(--gw-caution-text-strong);background:var(--gw-caution-bg);border-color:var(--gw-caution-line)}
.gw-dp-stop{color:var(--gw-stop-text);background:var(--gw-stop-bg);border-color:var(--gw-stop-border)}
.gw-dp-level-town{color:var(--gw-level-town);border-color:var(--gw-level-town)}
.gw-dp-level-county{color:var(--gw-level-county);border-color:var(--gw-level-county)}
.gw-dp-level-state{color:var(--gw-level-state);border-color:var(--gw-level-state)}
.gw-dp-muted{color:var(--gw-text-muted)}
.gw-dp-empty{padding:2rem var(--gw-space-5);border:var(--gw-border-w) dashed var(--gw-border-strong);border-radius:var(--gw-radius);text-align:center;background:var(--gw-surface-well)}
.gw-dp-unavailable-slot{text-align:left}.gw-dp-reviewed-record{display:grid;gap:var(--gw-space-3)}
.gw-dp-receipt-list{display:grid;gap:var(--gw-space-2);margin-top:var(--gw-space-3)}
.gw-dp-receipt{display:grid;gap:var(--gw-space-1);padding:var(--gw-space-3);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-sm);background:var(--gw-surface-subtle);overflow-wrap:anywhere}
.gw-dp-receipt a{width:max-content;max-width:100%;color:var(--gw-accent)}
.gw-dp-power-grid{display:grid;grid-template-columns:minmax(16rem,.72fr) minmax(0,1.6fr);gap:var(--gw-space-5);align-items:start}
.gw-dp-official-list{display:grid;gap:var(--gw-space-3)}
.gw-dp-official{width:100%;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:var(--gw-space-3);padding:var(--gw-space-3);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);color:var(--gw-text);background:var(--gw-surface-subtle);text-align:left;cursor:pointer}
.gw-dp-official[aria-pressed="true"]{border-color:var(--gw-accent);background:var(--gw-surface-accent-tint)}
.gw-dp-official-copy{display:grid;min-width:0}.gw-dp-official-copy small{color:var(--gw-text-muted)}
.gw-dp-avatar{display:inline-grid;place-items:center;width:2.7rem;height:2.7rem;border:var(--gw-border-w) solid currentColor;border-radius:50%;font-weight:800;background:var(--gw-surface-well)}
.gw-dp-avatar-large{width:4.5rem;height:4.5rem;font-size:var(--gw-text-lg)}
.gw-dp-profile-head{display:flex;align-items:center;gap:var(--gw-space-4);margin-bottom:var(--gw-space-5)}
.gw-dp-no-score{display:block;color:var(--gw-stop-text)}
.gw-dp-review-card,.gw-dp-ledger{padding:var(--gw-space-5);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-surface-subtle);margin-top:var(--gw-space-4)}
.gw-dp-ledger>div{display:flex;align-items:center;justify-content:space-between;gap:var(--gw-space-3);flex-wrap:wrap}
.gw-dp-modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:var(--gw-space-5);background:color-mix(in srgb,var(--gw-page-bg) 82%,transparent)}
.gw-dp-modal{width:min(46rem,100%);max-height:88vh;overflow:auto;border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius-lg);background:var(--gw-surface);padding:var(--gw-space-6)}
.gw-dp-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--gw-space-4);padding-bottom:var(--gw-space-4);border-bottom:var(--gw-border-w) solid var(--gw-border);margin-bottom:var(--gw-space-4)}
.gw-dp-modal-head h2{margin:.2rem 0}.gw-dp-modal-body{display:grid;gap:var(--gw-space-4)}
.gw-dp-ai-gate{padding:var(--gw-space-6);border:var(--gw-border-w) dashed var(--gw-caution-line);border-radius:var(--gw-radius);background:var(--gw-caution-bg-soft);text-align:center}.gw-dp-ai-gate p{text-align:left;color:var(--gw-text-secondary)}
.gw-dp-verdict{display:grid;gap:var(--gw-space-4)}.gw-dp-verdict h3{margin:0}
.gw-dp-compare{display:grid;grid-template-columns:1fr 1fr;gap:var(--gw-space-4)}
.gw-dp-compare article{padding:var(--gw-space-4);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-surface-subtle)}
.gw-dp-receipts{margin:0;padding-left:1.25rem;color:var(--gw-text-secondary)}
.gw-dp-ledger-table{width:100%;border-collapse:separate;border-spacing:0;border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);overflow:hidden;background:var(--gw-surface-well);font-size:var(--gw-text-sm)}.gw-dp-ledger-table th,.gw-dp-ledger-table td{padding:var(--gw-space-3);text-align:left;border-right:var(--gw-border-w) solid var(--gw-border)}.gw-dp-ledger-table th:last-child,.gw-dp-ledger-table td:last-child{border-right:0}.gw-dp-ledger-table th{background:var(--gw-surface-subtle);color:var(--gw-text-secondary);font-weight:800}.gw-dp-ledger-table td{border-top:var(--gw-border-w) solid var(--gw-border);color:var(--gw-text-muted)}
.gw-dp-count-line,.gw-dp-panel-actions{display:flex;align-items:center;justify-content:space-between;gap:var(--gw-space-3);margin-bottom:var(--gw-space-4)}
.gw-dp-watch-list{display:grid;gap:var(--gw-space-3)}
.gw-dp-watch-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:var(--gw-space-4);padding:var(--gw-space-4);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-surface-subtle)}
.gw-dp-watch-copy h3,.gw-dp-watch-copy p{margin:.15rem 0}.gw-dp-watch-copy small{color:var(--gw-text-muted);overflow-wrap:anywhere}
.gw-dp-sr-status:empty{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
.gw-dp-breadcrumbs{min-height:var(--gw-tap-min);display:flex;align-items:center;padding:var(--gw-space-3) var(--gw-space-4);margin-bottom:var(--gw-space-4);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-pill);color:var(--gw-text-secondary);background:var(--gw-surface-well);font-weight:700}
.gw-dp-location-selects{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--gw-space-4);margin-bottom:var(--gw-space-5)}
.gw-dp-location-selects label{display:grid;gap:var(--gw-space-2);font-weight:700}
.gw-dp-select{width:100%;padding:.55rem .7rem;border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius);color:var(--gw-text);background:var(--gw-surface)}
.gw-dp-select:disabled{opacity:.65}
.gw-dp-coverage-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--gw-space-4);margin:var(--gw-space-5) 0}
.gw-dp-stat{display:grid;gap:var(--gw-space-2);padding:var(--gw-space-4);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-surface-subtle)}
.gw-dp-stat strong{font-size:var(--gw-text-xl)}.gw-dp-stat span{color:var(--gw-caution-text);font-weight:700}
.gw-dp-state-grid{display:grid;grid-template-columns:repeat(11,minmax(0,1fr));gap:var(--gw-space-1)}
.gw-dp-place-tile{padding:.35rem;border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-sm);color:var(--gw-text-secondary);background:var(--gw-surface-subtle);cursor:pointer}
.gw-dp-place-tile[aria-pressed="true"]{color:var(--gw-accent-text-on);background:var(--gw-accent);border-color:var(--gw-accent)}
.gw-dp-location-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--gw-space-5);margin-top:var(--gw-space-5)}
.gw-dp-location-directory-workbench .gw-dp-location-grid{grid-template-columns:repeat(auto-fit,minmax(min(16rem,100%),1fr))}
.gw-dp-county-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--gw-space-2)}
.gw-dp-town-grid{display:flex;flex-wrap:wrap;gap:var(--gw-space-2)}
.gw-dp-disabled-tile-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(var(--gw-tap-min),1fr));gap:var(--gw-space-2)}
.gw-dp-county-tile,.gw-dp-town-tile{padding:.5rem .65rem}
.gw-dp-alert-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(18rem,.8fr);gap:var(--gw-space-5);align-items:start}
.gw-dp-alert-list,.gw-dp-delivery-list{display:grid;gap:var(--gw-space-3)}
.gw-dp-alert-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:var(--gw-space-3);padding:var(--gw-space-4);border:var(--gw-border-w) solid var(--gw-border);border-left:3px solid var(--gw-info-text);border-radius:var(--gw-radius);background:var(--gw-surface-subtle)}
.gw-dp-alert-stop{border-left-color:var(--gw-stop-border);background:var(--gw-tone-stop-well)}
.gw-dp-alert-caution{border-left-color:var(--gw-caution-line);background:var(--gw-tone-caution-well)}
.gw-dp-alert-ok{border-left-color:var(--gw-ok-text);background:var(--gw-tone-ok-well)}
.gw-dp-alert-read{opacity:.72}.gw-dp-alert-icon{font-size:var(--gw-text-xl)}
.gw-dp-alert-copy h3,.gw-dp-alert-copy p{margin:.2rem 0}.gw-dp-alert-copy time{color:var(--gw-text-muted);font:500 var(--gw-text-sm)/1.3 var(--gw-font-mono)}
.gw-dp-mark-read{align-self:start}.gw-dp-switch{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:var(--gw-space-3);padding:var(--gw-space-3);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);color:var(--gw-text);background:var(--gw-surface-subtle);text-align:left;cursor:pointer}
.gw-dp-switch-track{position:relative;width:2rem;height:1.1rem;border-radius:var(--gw-radius-pill);background:var(--gw-border-strong)}
.gw-dp-switch-track span{position:absolute;top:.15rem;left:.15rem;width:.8rem;height:.8rem;border-radius:50%;background:var(--gw-surface)}
.gw-dp-switch[aria-checked="true"] .gw-dp-switch-track{background:var(--gw-accent)}
.gw-dp-switch[aria-checked="true"] .gw-dp-switch-track span{left:1.05rem}
.gw-dp-switch-copy{display:grid}.gw-dp-switch-copy small{color:var(--gw-text-muted)}
.gw-dp-switch[aria-checked="true"]>b{color:var(--gw-accent)}.gw-dp-switch[aria-checked="false"]>b{color:var(--gw-text-muted)}
.gw-dp-trigger-list{margin:.3rem 0;padding-left:1.25rem;color:var(--gw-text-secondary)}
.gw-dp-alert-trigger-checklist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gw-space-2);margin:var(--gw-space-3) 0;padding:0;list-style:none}.gw-dp-alert-trigger-checklist label{display:flex;align-items:center;gap:var(--gw-space-2);min-height:var(--gw-tap-min);padding:var(--gw-space-2) var(--gw-space-3);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-sm);background:var(--gw-surface-subtle);color:var(--gw-text-secondary);font-size:var(--gw-text-sm)}.gw-dp-alert-trigger-checklist input{width:1rem;height:1rem}.gw-dp-alert-schema{border-style:dashed;opacity:.9}
.gw-dp-page button:focus-visible,.gw-dp-page select:focus-visible,.gw-dp-page a:focus-visible{outline:3px solid var(--gw-accent);outline-offset:3px}
@media (max-width:860px){.gw-dp-power-grid,.gw-dp-alert-grid,.gw-dp-location-grid,.gw-dp-workbench-grid{grid-template-columns:1fr}.gw-dp-state-grid{grid-template-columns:repeat(8,minmax(0,1fr))}.gw-dp-county-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:640px){.gw-dp-inner,.gw-dp-gated,.gw-dp-page[data-mode="simple"] .gw-dp-inner{width:100%;padding:var(--gw-space-4)}.gw-dp-page-head{display:grid}.gw-dp-watch-row,.gw-dp-alert-row{grid-template-columns:auto minmax(0,1fr)}.gw-dp-watch-row .gw-dp-remove,.gw-dp-alert-row .gw-dp-mark-read{grid-column:1/-1;width:100%}.gw-dp-location-selects,.gw-dp-coverage-grid,.gw-dp-compare,.gw-dp-alert-trigger-checklist{grid-template-columns:1fr}.gw-dp-state-grid{grid-template-columns:repeat(5,minmax(0,1fr))}.gw-dp-county-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.gw-dp-ledger-table{display:block;overflow-x:auto}.gw-dp-panel{padding:var(--gw-space-4)}.gw-dp-newspaper-story{column-count:1}.gw-dp-newspaper-rule{align-items:flex-start;flex-direction:column;gap:var(--gw-space-1)}}
@media (prefers-reduced-motion:reduce){.gw-dp-page *{scroll-behavior:auto!important;transition:none!important}}
`;

function ensureDesignPagesStyle(): void {
  if (document.getElementById('gw-design-pages-style')) return;
  const style = el('style', { id: 'gw-design-pages-style' }, [DESIGN_PAGES_STYLE]);
  document.head.append(style);
}
