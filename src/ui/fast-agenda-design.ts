/**
 * High-fidelity Fast Agenda design fixture derived from the supplied handoff.
 *
 * This module is deliberately self-contained and is not wired into routing yet.
 * Its synthetic civic records are available only when BOTH reviewer-internal
 * access and explicit fixture mode are present. Every other call fails closed
 * before any fixture leaf is added to the DOM.
 */

import type { AgendaBoard, AgendaBoardCard } from '../types/agenda-board';
import { readTracked, writeTracked } from '../state/local-store';
import { comingSoonChip } from './coming-soon';
import { type KanbanCardSpec, kanbanBoard } from './kanban';
import { closeModal, openModal } from './modal';
import { readMode, type ShellMode } from './shell';
import { GW_TOKENS } from './tokens';
import {
  renderPrivateInfoNote,
  renderPrivateUnavailableInfoNote,
  type PrivateInfoNoteId,
} from './private-info-note';

export interface FastAgendaDesignOptions {
  access?: string;
  fixture?: boolean;
  notice?: string;
  /** Reviewed GOV-605 agenda-board projection used when `fixture !== true`. */
  board?: AgendaBoard;
}

type Jurisdiction = 'town' | 'county' | 'state';
type StepState = 'done' | 'current' | 'next' | 'alert';

interface ProcessStep {
  label: string;
  state: StepState;
}

interface AgendaItem {
  id: string;
  number: string;
  issueKey: string;
  title: string;
  action: string;
  jurisdiction: Jurisdiction;
  page: number;
  analysis: string;
  languageWatch: string;
  decision: string;
  flag: string;
  process: ProcessStep[];
  history: string[];
  receipts: string[];
}

interface IssueCard {
  issueKey: string;
  title: string;
  stage: number;
  jurisdiction: Jurisdiction;
  body: string;
  last: string;
  next: string;
  receipts: number;
  flag?: string;
}

const FIXTURE_LABEL = 'SYNTHETIC DESIGN FIXTURE — not a live read';
const REVIEWED_LABEL = 'REVIEWED AGENDA PROJECTION — not a live read';
const RECEIPTS_DISCLAIMER =
  'Receipt references are synthetic design placeholders — not verified sources and not a live read.';

const JURISDICTION_LABEL: Record<Jurisdiction, string> = {
  town: 'TOWN',
  county: 'COUNTY',
  state: 'STATE',
};

const AGENDA_ITEMS: readonly AgendaItem[] = [
  {
    id: 'hearing-annexation',
    number: '4.a',
    issueKey: 'annexation',
    title: 'Alpine Apex annexation — public hearing',
    action: 'HEARING + POSSIBLE VOTE',
    jurisdiction: 'town',
    page: 2,
    analysis:
      'The council hears public testimony before considering whether the annexation may enter its three-reading ordinance process.',
    languageWatch:
      'The draft motion says statutory conditions “have been met” before testimony is heard; listen for whether the final findings change after public comment.',
    decision:
      'Whether to accept the drafted findings after the hearing and move the annexation into its first ordinance reading.',
    flag: 'Public comment opportunity',
    process: [
      { label: 'petition', state: 'done' },
      { label: 'staff report', state: 'done' },
      { label: 'hearing — Jul 21', state: 'current' },
      { label: 'ordinance readings', state: 'next' },
    ],
    history: ['Jul 13 — planning recommendation signed', 'Jun 10 — annexation report prepared'],
    receipts: ['Public hearing notice', 'Synthetic staff report reference', 'Draft findings and motion'],
  },
  {
    id: 'consent-agenda',
    number: '6',
    issueKey: 'council-process',
    title: 'Consent agenda — minutes, bills, and service agreements',
    action: 'CONSENT VOTE',
    jurisdiction: 'town',
    page: 3,
    analysis:
      'Several routine-looking approvals are bundled into one motion unless a council member asks to pull an item for separate discussion.',
    languageWatch:
      '“Routine” is a category, not a finding. The bills and service terms live in attachments rather than in the one-line consent motion.',
    decision: 'Whether to approve the entire consent bundle as one action or pull an item for discussion.',
    flag: 'Bundled action',
    process: [
      { label: 'documents posted', state: 'done' },
      { label: 'member review', state: 'current' },
      { label: 'pull requests', state: 'next' },
      { label: 'single vote', state: 'next' },
    ],
    history: ['Jul 17 — packet posted', 'Jul 7 — prior meeting minutes drafted'],
    receipts: ['Draft minutes', 'Claims register', 'Service-agreement index'],
  },
  {
    id: 'boardwalk-ordinance',
    number: '8.a',
    issueKey: 'annexation',
    title: 'Ordinance 2026-011 — Boardwalk II Lot 18, third reading',
    action: 'FINAL READING VOTE',
    jurisdiction: 'town',
    page: 2,
    analysis:
      'This is the third of three readings; approval would complete the town-level ordinance process for this parcel action.',
    languageWatch:
      '“Third and final reading” combines adoption and finality; the effective date still depends on the ordinance text and publication steps.',
    decision: 'Whether to adopt the ordinance after two earlier readings.',
    flag: 'Reading 3 of 3',
    process: [
      { label: '1st — Jun 23', state: 'done' },
      { label: '2nd — Jul 7', state: 'done' },
      { label: '3rd — Jul 21', state: 'current' },
      { label: 'effective-date check', state: 'next' },
    ],
    history: ['Jul 7 — second reading recorded', 'Jun 23 — first reading recorded'],
    receipts: ['Synthetic ordinance text', 'Prior-reading minute references'],
  },
  {
    id: 'apex-first-reading',
    number: '8.b',
    issueKey: 'annexation',
    title: 'Ordinance 2026-013 — Alpine Apex annexation, first reading',
    action: 'FIRST READING VOTE',
    jurisdiction: 'town',
    page: 2,
    analysis:
      'Minutes after the hearing, the council may begin a three-reading ordinance path using findings drafted in the meeting packet.',
    languageWatch:
      'The motion asserts that procedures “have been met.” Findings drafted before a hearing deserve comparison with what the public record actually shows.',
    decision: 'Whether the annexation advances from hearing to reading one of three.',
    flag: 'Follows item 4.a',
    process: [
      { label: 'petition + review', state: 'done' },
      { label: 'hearing — Jul 21', state: 'current' },
      { label: '1st reading', state: 'current' },
      { label: '2nd + 3rd', state: 'next' },
    ],
    history: ['Jul 13 — recommendation posted', 'Jun 10 — report prepared'],
    receipts: ['Draft ordinance', 'Synthetic annexation report', 'Recommendation reference'],
  },
  {
    id: 'ami-payments',
    number: '8.c',
    issueKey: 'water',
    title: 'AMI radio-read project — pay applications 1–4',
    action: 'MONEY VOTE · $667,067.91',
    jurisdiction: 'town',
    page: 5,
    analysis:
      'The motion recognizes $667,067.91 in billed work, applies a $286,111.01 materials credit, and would release a $380,956.90 balance.',
    languageWatch:
      '“Accounted for separately” means engineering and staff labor are outside this motion, so the displayed amount is not necessarily the all-in project cost.',
    decision: 'Whether to approve the four applications and release the stated balance after the materials credit.',
    flag: '$380,956.90 proposed balance',
    process: [
      { label: 'work billed', state: 'done' },
      { label: 'credit reconciled', state: 'done' },
      { label: 'approval — Jul 21', state: 'current' },
      { label: 'payment record', state: 'next' },
    ],
    history: ['Jul 9 — four applications listed in packet'],
    receipts: ['Synthetic staff report', 'Pay applications 1–4', 'Materials-credit worksheet'],
  },
  {
    id: 'outside-counsel',
    number: '8.e',
    issueKey: 'annexation',
    title: 'Outside counsel — annexation engagement',
    action: 'LEGAL CONTRACT VOTE',
    jurisdiction: 'town',
    page: 2,
    analysis:
      'The packet presents an engagement letter and hourly representation agreement connected to the annexation matter.',
    languageWatch:
      '“Engagement agreement” sounds administrative, while the referenced terms are hourly and the drafted motion does not state a fee cap.',
    decision: 'Whether to engage outside counsel under hourly terms for the annexation matter.',
    flag: 'No fee cap in drafted motion',
    process: [
      { label: 'terms drafted', state: 'done' },
      { label: 'approval — Jul 21', state: 'current' },
      { label: 'cost reporting', state: 'next' },
    ],
    history: ['Jul 17 — engagement materials listed with packet'],
    receipts: ['Synthetic engagement-letter reference', 'Hourly-terms reference'],
  },
  {
    id: 'ludc-consultant',
    number: '8.i',
    issueKey: 'ludc',
    title: 'Land-use code rewrite — consultant selection',
    action: 'CONTRACT SELECTION VOTE',
    jurisdiction: 'town',
    page: 8,
    analysis:
      'The council selects a consultant to draft the town-wide land-use code rewrite, after two proposal rounds and a revised staff evaluation.',
    languageWatch:
      'The motion authorizes negotiation with a blank firm name; compare the selection announced at the meeting with the evaluation version posted after the packet changed.',
    decision: 'Which consultant advances to negotiation and who may execute the eventual contract.',
    flag: 'Evaluation replaced with V2',
    process: [
      { label: 'RFP ×2', state: 'done' },
      { label: 'proposals', state: 'done' },
      { label: 'evaluation V2', state: 'alert' },
      { label: 'selection — Jul 21', state: 'current' },
      { label: 'contract + rewrite', state: 'next' },
    ],
    history: ['Jul 18 — evaluation V2 listed', 'Jun 25–30 — revised proposals listed'],
    receipts: ['Synthetic RFP reference', 'Evaluation V1/V2 comparison placeholder', 'Proposal index'],
  },
  {
    id: 'code-readings',
    number: '8.h',
    issueKey: 'land-use',
    title: 'Land-use amendments and building-code exemptions',
    action: 'TWO FIRST-READING VOTES',
    jurisdiction: 'town',
    page: 4,
    analysis:
      'Two code changes begin separate three-reading paths: targeted land-use amendments and local exemptions from selected building-code provisions.',
    languageWatch:
      '“Exemptions and local amendments” can obscure what protections are removed; those differences live in the attachments rather than the agenda title.',
    decision: 'Whether each ordinance advances independently from first reading toward two later votes.',
    flag: 'Two ordinances',
    process: [
      { label: 'staff reports', state: 'done' },
      { label: '1st — Jul 21', state: 'current' },
      { label: '2nd — Aug 4', state: 'next' },
      { label: '3rd — Aug 18', state: 'next' },
    ],
    history: ['Jul 13 — amendment updates listed', 'Jul 10 — exemptions report listed'],
    receipts: ['Synthetic amendment text', 'Synthetic exemptions text'],
  },
];

const ISSUE_STAGES = [
  'Captured',
  'Agenda posted',
  'Packet available',
  'Public comment',
  'Vote soon',
  'Voted',
  'Follow-up',
] as const;

const ISSUE_CARDS: readonly IssueCard[] = [
  { issueKey: 'road-bids', title: 'Road & Bridge summer bids', stage: 0, jurisdiction: 'county', body: 'Road & Bridge · procurement', last: 'Jul 18 — bids closed', next: 'Aug 3 — award review', receipts: 3 },
  { issueKey: 'dark-sky', title: 'Dark-sky lighting initiative', stage: 0, jurisdiction: 'town', body: 'Planning & Zoning · ordinances', last: 'Jun 14 — initial discussion', next: 'Jul 28 — expected agenda', receipts: 1 },
  { issueKey: 'town-lease', title: 'Learning-center lease', stage: 1, jurisdiction: 'town', body: 'Town Council · public property', last: 'Jul 17 — packet listing', next: 'Jul 21 — lease motion', receipts: 2 },
  { issueKey: 'water', title: 'On-call wastewater engineering', stage: 1, jurisdiction: 'town', body: 'Town Council · utilities', last: 'Jul 9 — agreement updated', next: 'Jul 21 — contract motion', receipts: 2 },
  { issueKey: 'land-use', title: 'Building-code exemptions', stage: 2, jurisdiction: 'town', body: 'Town Council · building codes', last: 'Jul 10 — report listed', next: 'Jul 21 — first reading', receipts: 2 },
  { issueKey: 'county-land-use', title: 'Rural land-use rule update', stage: 2, jurisdiction: 'county', body: 'County Planning · zoning', last: 'Jul 15 — hearing held', next: 'Aug 3 — follow-up', receipts: 2 },
  { issueKey: 'annexation', title: 'Alpine Apex annexation', stage: 3, jurisdiction: 'town', body: 'Town Council · development', last: 'Jul 13 — recommendation listed', next: 'Jul 21 — hearing', receipts: 5, flag: 'Comment opportunity' },
  { issueKey: 'budget', title: 'FY-27 budget priorities', stage: 3, jurisdiction: 'town', body: 'Town Council · budget', last: 'May — financial report', next: 'August — public hearings', receipts: 2 },
  { issueKey: 'annexation', title: 'Boardwalk II Lot 18', stage: 4, jurisdiction: 'town', body: 'Town Council · annexation', last: 'Jul 7 — second reading', next: 'Jul 21 — final vote', receipts: 3, flag: 'Reading 3 of 3' },
  { issueKey: 'water', title: 'AMI radio-read pay applications', stage: 4, jurisdiction: 'town', body: 'Town Council · water / money', last: 'Jul 9 — applications listed', next: 'Jul 21 — approval motion', receipts: 5, flag: '$380,956.90 balance' },
  { issueKey: 'ludc', title: 'Land-use rewrite consultant', stage: 4, jurisdiction: 'town', body: 'Town Council · zoning', last: 'Jul 18 — evaluation V2 listed', next: 'Jul 21 — selection vote', receipts: 8, flag: 'Packet changed' },
  { issueKey: 'moratorium', title: 'Building and annexation moratorium', stage: 5, jurisdiction: 'town', body: 'Town Council · zoning', last: 'Jul 7 — adopted 4–1', next: 'Jan 2027 — renewal watch', receipts: 4 },
  { issueKey: 'fees', title: 'Administrative-fee ordinance', stage: 5, jurisdiction: 'town', body: 'Town Council · fees', last: 'Jul 7 — third reading', next: 'Track effective-date record', receipts: 3 },
  { issueKey: 'short-term-rentals', title: 'Short-term-rental bill draft', stage: 6, jurisdiction: 'state', body: 'Interim Committee · property rights', last: 'Jul 13 — draft advanced', next: 'Fall — draft vote', receipts: 4 },
  { issueKey: 'water', title: 'Sewer-capacity follow-up', stage: 6, jurisdiction: 'town', body: 'Town Council · utilities', last: 'Jul 7 — capacity cited', next: 'Engineering follow-up', receipts: 2 },
];

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

function titleWithInfo(
  title: HTMLElement,
  noteId: PrivateInfoNoteId,
): HTMLElement {
  return el('div', { class: 'gw-fa-title-with-note' }, [
    title,
    renderPrivateInfoNote(noteId),
  ]);
}

function safeInfoKey(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function kicker(text: string): HTMLElement {
  return el('p', { class: 'gw-fa-kicker' }, [text]);
}

function syncTrackingButtons(root: HTMLElement, issueKey: string, tracked: boolean): void {
  for (const node of root.querySelectorAll<HTMLButtonElement>('[data-track-key]')) {
    if (node.dataset.trackKey !== issueKey) continue;
    const issueLabel = node.dataset.trackLabel ?? 'this issue';
    node.setAttribute('aria-pressed', tracked ? 'true' : 'false');
    node.setAttribute('aria-label', `${tracked ? 'Stop tracking' : 'Track'} ${issueLabel}`);
    node.classList.toggle('is-tracked', tracked);
    node.textContent = tracked ? '✓ Tracking' : '+ Track';
  }
}

function trackButton(
  root: HTMLElement,
  tracked: Record<string, boolean>,
  issueKey: string,
  issueLabel: string,
): HTMLButtonElement {
  const active = tracked[issueKey] === true;
  const button = el('button', {
    type: 'button',
    class: `gw-fa-track${active ? ' is-tracked' : ''}`,
    'aria-label': `${active ? 'Stop tracking' : 'Track'} ${issueLabel}`,
    'aria-pressed': active ? 'true' : 'false',
    'data-track-key': issueKey,
    'data-track-label': issueLabel,
    'data-test': 'track-toggle',
  }, [active ? '✓ Tracking' : '+ Track']);

  button.addEventListener('click', () => {
    const next = tracked[issueKey] !== true;
    if (next) tracked[issueKey] = true;
    else delete tracked[issueKey];
    writeTracked(tracked);
    syncTrackingButtons(root, issueKey, next);
  });
  return button;
}

function aiAnalysis(text: string): HTMLElement {
  return el('div', { class: 'gw-fa-ai', 'data-test': 'ai-analysis' }, [
    el('strong', { class: 'gw-fa-ai-label' }, ['AI-PRESENTED ANALYSIS']),
    el('span', { class: 'gw-fa-ai-caveat' }, ['not independently verified']),
    el('p', {}, [text]),
  ]);
}

function languageWatch(text: string): HTMLElement {
  return el('div', { class: 'gw-fa-language', 'data-test': 'language-watch' }, [
    el('strong', { class: 'gw-fa-language-label' }, ['AI-PRESENTED LANGUAGE WATCH']),
    el('span', { class: 'gw-fa-language-caveat' }, ['not independently verified']),
    el('p', {}, [text]),
  ]);
}

function processLadder(steps: readonly ProcessStep[]): HTMLOListElement {
  const list = el('ol', {
    class: 'gw-fa-process',
    'aria-label': 'Issue process',
    'data-test': 'process-ladder',
  });
  for (const step of steps) {
    const stateLabel: Record<StepState, string> = {
      done: 'complete',
      current: 'current',
      next: 'upcoming',
      alert: 'changed',
    };
    list.append(el('li', {
      class: `gw-fa-process-step is-${step.state}`,
      'data-state': step.state,
      'aria-label': `${step.label}, ${stateLabel[step.state]}`,
    }, [
      el('span', { 'aria-hidden': 'true' }, [step.state === 'done' ? '✓' : step.state === 'alert' ? '▲' : step.state === 'current' ? '●' : '○']),
      step.label,
    ]));
  }
  return list;
}

function openDetails(
  root: HTMLElement,
  item: AgendaItem,
  tracked: Record<string, boolean>,
  trigger: HTMLElement,
): void {
  const titleId = `gw-fa-modal-title-${item.id}`;
  const receiptId = `gw-fa-modal-receipts-${item.id}`;

  const history = el('section', { class: 'gw-fa-modal-section' }, [
    el('h3', {}, ['Past activity — newest first']),
    el('ul', {}, item.history.map((event) => el('li', {}, [event]))),
  ]);
  const receipts = el('section', { class: 'gw-fa-modal-section', id: receiptId }, [
    el('h3', {}, ['Receipts']),
    el('ul', {}, item.receipts.map((receipt) => el('li', {}, [receipt]))),
    el('p', { class: 'gw-fa-receipts-note', 'data-test': 'receipts-disclaimer' }, [RECEIPTS_DISCLAIMER]),
  ]);

  openModal(root, {
    testId: 'agenda-modal',
    labelledById: titleId,
    describedById: receiptId,
    closeLabel: 'Close detailed agenda analysis',
    trigger,
    className: 'gw-fa-modal',
    header: el('div', {}, [
      kicker(`ITEM ${item.number} · DETAILED DESIGN ANALYSIS`),
      el('h2', { id: titleId }, [item.title]),
      el('p', { class: 'gw-fa-action' }, [item.action]),
    ]),
    body: [
      trackButton(root, tracked, item.issueKey, item.title),
      aiAnalysis(`What's being decided: ${item.decision}`),
      languageWatch(item.languageWatch),
      el('section', { class: 'gw-fa-modal-section' }, [
        el('h3', {}, ['Process']),
        processLadder(item.process),
      ]),
      el('div', { class: 'gw-fa-modal-grid' }, [history, receipts]),
      el('footer', { class: 'gw-fa-modal-actions' }, [
        el('span', {}, [`Packet page ${item.page} · synthetic fixture reference`]),
        el('button', {
          type: 'button',
          class: 'gw-fa-secondary',
          'data-test': 'modal-footer-close',
          'data-modal-close': '',
        }, ['Close']),
      ]),
    ],
  });
}

function statusTile(label: string, detail: string, tone: string): HTMLElement {
  return el('article', { class: `gw-fa-status is-${tone}`, 'data-test': 'meeting-status-tile' }, [
    el('strong', {}, [label]),
    el('span', {}, [detail]),
  ]);
}

function statTile(value: string, label: string, tone = ''): HTMLElement {
  return el('article', { class: `gw-fa-stat${tone ? ` is-${tone}` : ''}`, 'data-test': 'meeting-stat-tile' }, [
    el('strong', {}, [value]),
    el('span', {}, [label]),
  ]);
}

function meetingBoard(): HTMLElement {
  return el('aside', { class: 'gw-fa-meeting', 'aria-labelledby': 'gw-fa-meeting-title', 'data-test': 'meeting-board' }, [
    el('div', { class: 'gw-fa-section-head' }, [
      kicker('NEXT MEETING · JULY 21 DESIGN BOARD'),
      el('span', { class: 'gw-fa-due' }, ['SYNTHETIC SCHEDULE']),
    ]),
    titleWithInfo(
      el('h2', { id: 'gw-fa-meeting-title' }, ['Alpine Town Council']),
      'agenda-meeting',
    ),
    el('p', { class: 'gw-fa-meeting-time' }, ['Tuesday, July 21, 2026 · 6:30 PM']),
    el('p', { class: 'gw-fa-muted' }, ['Alpine Town Hall · 250 River Circle · fixture says streamed online']),
    el('div', { class: 'gw-fa-status-grid' }, [
      statusTile('✓ Agenda posted', 'Synthetic timestamp · Jul 17', 'ok'),
      statusTile('▲ Attachment replaced', 'Consultant evaluation → V2', 'stop'),
      statusTile('! Votes possible', '9 drafted motions + 1 hearing', 'caution'),
      statusTile('○ Analysis timing', 'Fixture target: after meeting', 'neutral'),
    ]),
    el('div', { class: 'gw-fa-stat-grid' }, [
      statTile('10', 'AGENDA SECTIONS'),
      statTile('9', 'DRAFTED MOTIONS', 'caution'),
      statTile('1', 'PUBLIC HEARING', 'accent'),
      statTile('21', 'ATTACHMENTS · 1 CHANGED'),
    ]),
    el('section', { class: 'gw-fa-public-comment' }, [
      el('h2', {}, ['Public comment design note']),
      el('p', {}, [
        'The fixture places general comment at item 9 and the annexation hearing at item 4.a. Confirm all times, rules, and participation links against an official source before publication.',
      ]),
    ]),
    nearbyMeetings(),
    el('p', { class: 'gw-fa-receipts-note', 'data-test': 'receipts-disclaimer' }, [RECEIPTS_DISCLAIMER]),
  ]);
}

/**
 * LAST MEETING row + ALSO COMING UP list — the design's left column does not
 * end at the public-comment card. Fixture lane only: the reviewed lane keeps
 * its explicit reviewed-nearby-meetings-gap slot, because official meeting
 * schedules are civic data this app has not been supplied.
 *
 * The design's ◌/✓ glyphs are decorative; the adjacent text carries the
 * meaning so the status never lives in a glyph alone.
 */
function nearbyMeetings(): HTMLElement {
  const statusRow = (
    glyph: string,
    tone: 'ok' | 'pending',
    body: string,
    status: string,
  ): HTMLElement => el('li', { class: `gw-fa-nearby-row is-${tone}`, 'data-test': 'nearby-upcoming-row' }, [
    el('span', { class: 'gw-fa-nearby-glyph', 'aria-hidden': 'true' }, [glyph]),
    el('span', { class: 'gw-fa-nearby-body' }, [body]),
    el('span', { class: 'gw-fa-nearby-status' }, [status]),
  ]);

  return el('section', { class: 'gw-fa-nearby', 'data-test': 'nearby-meetings' }, [
    el('section', { class: 'gw-fa-nearby-last', 'data-test': 'nearby-last-meeting' }, [
      el('h3', {}, ['Last meeting — Jul 7']),
      el('p', { class: 'gw-fa-muted' }, [
        'Fixture record: moratorium adopted 4–1, admin-fee ordinance third reading, Boardwalk II second reading.',
      ]),
      unavailableMeetingTools(),
      comingSoonChip('Remind me'),
    ]),
    el('section', { class: 'gw-fa-nearby-upcoming' }, [
      el('h3', {}, ['Also coming up']),
      el('ul', { class: 'gw-fa-nearby-list' }, [
        statusRow('◌', 'pending', 'Planning & Zoning · Jul 28', 'agenda pending — fixture due Jul 24'),
        statusRow('✓', 'ok', 'County Commission · Aug 3', 'agenda posted (synthetic)'),
        statusRow('◌', 'pending', 'Next Town Council · Aug 4', 'agenda pending'),
      ]),
    ]),
  ]);
}

function unavailableMeetingTools(): HTMLElement {
  const unavailable = (label: string): HTMLButtonElement => el('button', {
    type: 'button',
    class: 'gw-fa-tool-unavailable',
    disabled: '',
    title: `${label} is unavailable because this is a synthetic fixture.`,
    'data-test': 'unavailable-tool',
  }, [`${label} unavailable`]);

  return el('div', {
    class: 'gw-fa-unavailable-tools',
    'aria-label': 'Meeting tools unavailable in this synthetic fixture',
  }, [
    unavailable('Official agenda'),
    unavailable('Meeting packet'),
    unavailable('Reminder'),
  ]);
}

function simpleMeetingDigest(): HTMLElement {
  return el('section', {
    class: 'gw-fa-simple-meeting',
    'aria-labelledby': 'gw-fa-simple-meeting-title',
    'data-test': 'simple-meeting-digest',
  }, [
    kicker('NEXT MEETING · SYNTHETIC SCHEDULE'),
    titleWithInfo(
      el('h2', { id: 'gw-fa-simple-meeting-title' }, ['Alpine Town Council']),
      'agenda-meeting',
    ),
    el('p', { class: 'gw-fa-meeting-time' }, ['Tuesday, July 21, 2026 · 6:30 PM']),
    el('p', { class: 'gw-fa-muted' }, ['Alpine Town Hall · 250 River Circle']),
    el('p', { class: 'gw-fa-simple-lede' }, [
      'Eight selected agenda items are summarized below. One synthetic public hearing appears at item 4.a; confirm participation rules and timing with an official source.',
    ]),
    unavailableMeetingTools(),
    el('p', { class: 'gw-fa-receipts-note', 'data-test': 'receipts-disclaimer' }, [RECEIPTS_DISCLAIMER]),
  ]);
}

function agendaRow(
  root: HTMLElement,
  item: AgendaItem,
  tracked: Record<string, boolean>,
): HTMLElement {
  const detailsButton = el('button', {
    type: 'button',
    class: 'gw-fa-details',
    'aria-label': `Open detailed analysis for item ${item.number}: ${item.title}`,
    'data-test': 'open-details',
  }, ['Detailed analysis']);
  detailsButton.addEventListener('click', () => openDetails(root, item, tracked, detailsButton));

  return el('article', {
    class: 'gw-fa-agenda-row',
    'data-test': 'agenda-row',
    'data-agenda-id': item.id,
    'data-track-issue': item.issueKey,
  }, [
    el('div', { class: 'gw-fa-number', 'aria-label': `Agenda item ${item.number}` }, [item.number]),
    el('div', { class: 'gw-fa-agenda-main' }, [
      el('header', { class: 'gw-fa-agenda-title' }, [
        el('h3', {}, [item.title]),
        el('span', { class: 'gw-fa-action' }, [item.action]),
      ]),
      aiAnalysis(item.analysis),
      languageWatch(item.languageWatch),
      el('p', { class: 'gw-fa-flag' }, [item.flag]),
      el('div', { class: 'gw-fa-process-wrap' }, [
        el('strong', {}, ['PROCESS']),
        processLadder(item.process),
      ]),
      el('p', { class: 'gw-fa-row-receipt' }, [
        `Packet p.${item.page} · ${item.receipts.length} synthetic receipt reference${item.receipts.length === 1 ? '' : 's'}`,
      ]),
    ]),
    el('div', { class: 'gw-fa-row-actions' }, [
      trackButton(root, tracked, item.issueKey, item.title),
      detailsButton,
    ]),
  ]);
}

function agendaBoard(root: HTMLElement, tracked: Record<string, boolean>): HTMLElement {
  return el('section', { class: 'gw-fa-agenda', 'aria-labelledby': 'gw-fa-agenda-title', 'data-test': 'agenda-board' }, [
    el('div', { class: 'gw-fa-section-head' }, [
      el('div', {}, [
        kicker("WHAT'S ON THE AGENDA — JULY 21"),
        titleWithInfo(
          el('h2', { id: 'gw-fa-agenda-title' }, ['Plain English first; official numbering preserved']),
          'agenda-sources',
        ),
      ]),
      el('span', { class: 'gw-fa-muted' }, ['8 synthetic design rows']),
    ]),
    el('p', { class: 'gw-fa-board-disclosure' }, [
      'All summaries and language-watch notes below are AI-presented synthetic design copy. They are not independently verified and are not a live read.',
    ]),
    el('div', { class: 'gw-fa-agenda-list' }, AGENDA_ITEMS.map((item) => agendaRow(root, item, tracked))),
  ]);
}

function simpleAgendaItem(
  root: HTMLElement,
  item: AgendaItem,
  tracked: Record<string, boolean>,
): HTMLLIElement {
  const receiptsButton = el('button', {
    type: 'button',
    class: 'gw-fa-details gw-fa-simple-receipts',
    'aria-label': `Review context and synthetic receipts for item ${item.number}: ${item.title}`,
    'data-test': 'open-receipts',
  }, [`Review context & receipts (${item.receipts.length})`]);
  receiptsButton.addEventListener('click', () => openDetails(root, item, tracked, receiptsButton));

  return el('li', {
    class: 'gw-fa-simple-item',
    'data-test': 'simple-agenda-item',
    'data-agenda-id': item.id,
  }, [
    el('article', {}, [
      el('header', { class: 'gw-fa-simple-item-head' }, [
        el('span', { class: 'gw-fa-number', 'aria-label': `Agenda item ${item.number}` }, [item.number]),
        el('div', {}, [
          el('h3', {}, [item.title]),
          el('p', { class: 'gw-fa-simple-action' }, [item.action]),
        ]),
      ]),
      aiAnalysis(item.analysis),
      el('p', { class: 'gw-fa-simple-decision' }, [
        el('strong', {}, ['The decision: ']),
        item.decision,
      ]),
      receiptsButton,
    ]),
  ]);
}

function simpleAgendaDigest(root: HTMLElement, tracked: Record<string, boolean>): HTMLElement {
  return el('section', {
    class: 'gw-fa-simple-agenda',
    'aria-labelledby': 'gw-fa-simple-agenda-title',
    'data-test': 'simple-agenda-digest',
  }, [
    kicker("WHAT'S ON THE AGENDA — JULY 21"),
    titleWithInfo(
      el('h2', { id: 'gw-fa-simple-agenda-title' }, ['Eight items in plain language']),
      'agenda-sources',
    ),
    el('p', { class: 'gw-fa-board-disclosure' }, [
      'These are AI-presented synthetic design summaries, not independently verified reporting or a live agenda.',
    ]),
    el('ol', { class: 'gw-fa-simple-list' }, AGENDA_ITEMS.map((item) => simpleAgendaItem(root, item, tracked))),
  ]);
}

function allReviewedCards(board: AgendaBoard): AgendaBoardCard[] {
  return board.lanes.flatMap((lane) => lane.cards);
}

function reviewedMetric(value: string, label: string, tone = 'neutral'): HTMLElement {
  return el('article', { class: `gw-fa-stat is-${tone}`, 'data-test': 'reviewed-readiness-metric' }, [
    el('strong', {}, [value]),
    el('span', {}, [label]),
  ]);
}

function reviewedMeetingReadiness(board: AgendaBoard): HTMLElement {
  const cards = allReviewedCards(board);
  return el('aside', {
    class: 'gw-fa-meeting gw-fa-reviewed-meeting',
    'aria-labelledby': 'gw-fa-reviewed-meeting-title',
    'data-test': 'reviewed-meeting-readiness',
  }, [
    kicker('MEETING READINESS · REVIEWED PROJECTION'),
    titleWithInfo(
      el('h2', { id: 'gw-fa-reviewed-meeting-title' }, ['Reviewed meeting readiness']),
      'agenda-meeting',
    ),
    el('p', { class: 'gw-fa-muted' }, [
      cards.length
        ? 'Agenda-anchored meeting context is listed below exactly as supplied by the reviewed projection.'
        : 'Meeting details are unavailable because this projection contains no agenda-anchored cards.',
    ]),
    el('div', { class: 'gw-fa-stat-grid gw-fa-reviewed-metrics' }, [
      reviewedMetric(String(board.cardCount), 'AGENDA-ANCHORED CARDS', board.cardCount > 0 ? 'accent' : 'neutral'),
      reviewedMetric(
        String(board.unanchoredStatementCount),
        'UNANCHORED STATEMENTS',
        board.unanchoredStatementCount > 0 ? 'caution' : 'neutral',
      ),
      reviewedMetric(String(board.lanes.length), 'SUPPLIED LIFECYCLE LANES'),
    ]),
    el('p', { class: 'gw-fa-row-receipt', 'data-test': 'reviewed-generated-from' }, [
      `Projection origin: ${board.generatedFrom}`,
    ]),
    el('div', { class: 'gw-fa-reviewed-slot-grid', 'data-test': 'reviewed-meeting-slots' }, [
      reviewedGapSlot(
        'reviewed-meeting-logistics-gap',
        'Venue and stream unavailable',
        'The reviewed AgendaBoard contract supplies no meeting venue, streaming channel, or public-access instructions.',
      ),
      reviewedGapSlot(
        'reviewed-posting-version-gap',
        'Posting and version events unavailable',
        'Agenda-posted time and attachment-replacement history require a reviewed meeting-readiness projection.',
      ),
      reviewedGapSlot(
        'reviewed-agenda-counts-gap',
        'Motion, hearing, and attachment counts unavailable',
        'Card count is shown above, but it is not substituted for official motion, hearing, section, or attachment totals.',
      ),
      reviewedGapSlot(
        'reviewed-nearby-meetings-gap',
        'Last and upcoming meetings unavailable',
        'The current projection does not supply the prior-meeting recap or upcoming-body calendar required for this slot.',
      ),
      reviewedGapSlot(
        'reviewed-public-comment-gap',
        'Public-comment rules unavailable',
        'No reviewed deadline, time limit, venue policy, or hearing-specific instruction is present.',
      ),
    ]),
    el('div', { class: 'gw-fa-unavailable-tools', role: 'group', 'aria-label': 'Meeting tools unavailable', 'data-test': 'reviewed-meeting-tools' }, [
      el('button', { type: 'button', class: 'gw-fa-tool-unavailable', disabled: '' }, ['Official agenda · unavailable']),
      el('button', { type: 'button', class: 'gw-fa-tool-unavailable', disabled: '' }, ['Packet · unavailable']),
      el('button', { type: 'button', class: 'gw-fa-tool-unavailable', disabled: '' }, ['Reminder · unavailable']),
    ]),
  ]);
}

function reviewedGapSlot(
  test: string,
  title: string,
  detail: string,
  instance = test,
  noteTitle = title,
): HTMLElement {
  return el('section', {
    class: 'gw-fa-reviewed-slot is-unavailable',
    'data-test': test,
    role: 'note',
  }, [
    el('div', { class: 'gw-fa-title-with-note' }, [
      el('h3', {}, [title]),
      renderPrivateUnavailableInfoNote({
        id: `agenda-${safeInfoKey(instance)}`,
        title: noteTitle,
        what: detail,
        source: 'Required source: an authorized, typed agenda or meeting projection carrying the missing fields and exact web-safe receipts.',
        filedUnder: 'Fast Agenda · Reviewed projection · Honest gap',
        expectedResult: `This slot will replace the explanation with reviewed ${title.toLocaleLowerCase()} data, its status, freshness, limitations, and direct source receipts.`,
      }),
    ]),
    el('p', {}, [detail]),
  ]);
}

function reviewedAnalysisSlot(card?: AgendaBoardCard): HTMLElement {
  return reviewedGapSlot(
    'reviewed-analysis-slot',
    'Analysis unavailable',
    card
      ? 'AgendaBoard does not supply analysis text for this item; no analysis has been invented.'
      : 'No agenda-anchored reviewed item is present to analyze.',
    `reviewed-analysis-slot-${card?.cardId ?? 'empty'}`,
    card ? `Analysis for ${card.agendaItemTitle ?? card.agendaItemId}` : 'Analysis unavailable',
  );
}

function reviewedLanguageSlot(card?: AgendaBoardCard): HTMLElement {
  return reviewedGapSlot(
    'reviewed-language-slot',
    'Language watch unavailable',
    card
      ? 'AgendaBoard does not supply a language-watch block for this item; no wording assessment has been invented.'
      : 'No agenda-anchored reviewed item is present for a language-watch assessment.',
    `reviewed-language-slot-${card?.cardId ?? 'empty'}`,
    card ? `Language watch for ${card.agendaItemTitle ?? card.agendaItemId}` : 'Language watch unavailable',
  );
}

function reviewedProcessSlot(card?: AgendaBoardCard): HTMLElement {
  if (!card) {
    return reviewedGapSlot(
      'reviewed-process-slot',
      'Item process unavailable',
      'No agenda-anchored reviewed item is present to place in a per-item process.',
      'reviewed-process-slot-empty',
    );
  }

  const details: (Node | string)[] = [
    el('p', { 'data-test': 'reviewed-lane' }, [
      el('strong', {}, ['Lifecycle lane: ']),
      `${card.laneLabel} (${card.lane})`,
    ]),
  ];
  if (card.agendaThreadId || card.threadLabel || card.threadStatus) {
    details.push(el('p', { 'data-test': 'reviewed-thread' }, [
      el('strong', {}, ['Agenda thread: ']),
      [card.agendaThreadId, card.threadLabel, card.threadStatus].filter(Boolean).join(' · '),
    ]));
  }
  if (card.lineage.length) {
    details.push(el('ul', { 'data-test': 'reviewed-lineage' }, card.lineage.map((edge) => el('li', {}, [`${edge.relation}: ${edge.ref}`]))));
  }
  details.push(el('p', { 'data-test': 'reviewed-category-anchor' }, [
    el('strong', {}, [`Category anchor (${card.categoryAnchor.kind}): `]),
    card.categoryAnchor.disclosure,
  ]));
  if (card.gapBadges.length) {
    details.push(el('ul', {
      class: 'gw-fa-reviewed-gap-list',
      'data-test': 'reviewed-gap-badges',
    }, card.gapBadges.map((gap) => el('li', { 'data-test': 'reviewed-gap-badge' }, [gap]))));
  }
  return el('section', { class: 'gw-fa-reviewed-slot', 'data-test': 'reviewed-process-slot' }, [
    el('h3', {}, ['Item process']),
    ...details,
  ]);
}

function sourceLocatorText(card: AgendaBoardCard, sourceIndex: number): string {
  const locator = card.sourceRefs[sourceIndex]?.locator;
  if (!locator) return '';
  const parts: string[] = [];
  if (locator.page !== undefined) parts.push(`page ${locator.page}`);
  if (locator.section) parts.push(locator.section);
  if (locator.paragraph) parts.push(locator.paragraph);
  if (locator.timestampHuman) parts.push(locator.timestampHuman);
  if (locator.timestampSeconds !== undefined) parts.push(`${locator.timestampSeconds}s`);
  return parts.join(' · ');
}

function reviewedReceiptSlot(card?: AgendaBoardCard): HTMLElement {
  if (!card || card.sourceRefs.length === 0) {
    return reviewedGapSlot(
      'reviewed-receipts-slot',
      'Receipts unavailable',
      card
        ? 'No web-safe source reference was supplied for this agenda item.'
        : 'No agenda-anchored reviewed item is present to carry a receipt.',
      `reviewed-receipts-slot-${card?.cardId ?? 'empty'}`,
      card ? `Receipts for ${card.agendaItemTitle ?? card.agendaItemId}` : 'Receipts unavailable',
    );
  }

  const receipts = card.sourceRefs.map((source, index) => {
    const locator = sourceLocatorText(card, index);
    const children: (Node | string)[] = [el('strong', {}, [source.sourceId])];
    if (source.originalUrl) {
      children.push(' · ', el('a', {
        href: source.originalUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-test': 'reviewed-source-original',
      }, ['Open supplied source']));
    }
    if (source.archiveUrl) {
      children.push(' · ', el('a', {
        href: source.archiveUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-test': 'reviewed-source-archive',
      }, ['Open supplied archive']));
    }
    if (locator) children.push(` · ${locator}`);
    return el('li', {}, children);
  });
  return el('section', { class: 'gw-fa-reviewed-slot', 'data-test': 'reviewed-receipts-slot' }, [
    el('h3', {}, ['Receipts']),
    el('ul', {}, receipts),
  ]);
}

function reviewedDecisionContextSlot(card?: AgendaBoardCard): HTMLElement {
  return reviewedGapSlot(
    'reviewed-decision-context-slot',
    'Decision context unavailable',
    card
      ? 'Past-meeting analyses, connected issue ids, and a policy-cleared decision-maker record are not supplied for this item.'
      : 'No agenda-anchored reviewed item is present for past-meeting, connected-issue, or decision-maker context.',
    `reviewed-decision-context-slot-${card?.cardId ?? 'empty'}`,
    card
      ? `Decision context for ${card.agendaItemTitle ?? card.agendaItemId}`
      : 'Decision context unavailable',
  );
}

function reviewedAgendaCard(card: AgendaBoardCard): HTMLElement {
  const meetingContext = [
    card.meetingId == null ? '' : `Meeting ${card.meetingId}`,
    card.meetingDate,
    card.meetingBody,
    card.meetingTitle,
  ].filter(Boolean).join(' · ');
  const number = card.itemOrder === undefined ? '—' : String(card.itemOrder);
  const trustBadges: HTMLElement[] = [
    el('span', {
      class: 'gw-fa-action',
      'data-test': 'reviewed-status-badge',
    }, [card.statusBadge]),
  ];
  if (card.confidenceBadge) {
    trustBadges.push(el('span', {
      class: 'gw-fa-flag',
      'data-test': 'reviewed-confidence-badge',
    }, [card.confidenceBadge]));
  } else {
    trustBadges.push(el('span', {
      class: 'gw-fa-muted',
      'data-test': 'reviewed-confidence-gap',
    }, ['Confidence not supplied']));
  }
  const meetingLinks: HTMLElement[] = [];
  if (card.meetingSourceUrl) {
    meetingLinks.push(el('a', {
      href: card.meetingSourceUrl,
      target: '_blank',
      rel: 'noopener noreferrer',
      'data-test': 'reviewed-meeting-source',
    }, ['Open supplied meeting source']));
  }
  if (card.videoRef) {
    meetingLinks.push(el('a', {
      href: card.videoRef.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      'data-test': 'reviewed-video-ref',
    }, [`Watch from ${card.videoRef.timestampSeconds}s`]));
  }
  return el('article', {
    class: 'gw-fa-agenda-row gw-fa-reviewed-agenda-row',
    'data-test': 'reviewed-agenda-row',
    'data-agenda-id': card.agendaItemId,
  }, [
    el('div', { class: 'gw-fa-number', 'aria-label': `Agenda item ${number}` }, [number]),
    el('div', { class: 'gw-fa-agenda-main' }, [
      el('header', { class: 'gw-fa-agenda-title' }, [
        el('h3', {}, [card.agendaItemTitle ?? card.agendaItemId]),
        el('div', { class: 'gw-fa-reviewed-trust', 'data-test': 'reviewed-trust-fields' }, trustBadges),
      ]),
      el('p', { class: 'gw-fa-muted', 'data-test': 'reviewed-meeting-context' }, [meetingContext || 'Meeting context not supplied']),
      ...(meetingLinks.length ? [el('div', {
        class: 'gw-fa-reviewed-links',
        'data-test': 'reviewed-meeting-links',
      }, meetingLinks)] : [el('p', {
        class: 'gw-fa-muted',
        'data-test': 'reviewed-meeting-links-gap',
      }, ['No meeting source or video reference was supplied.'])]),
      el('p', { class: 'gw-fa-row-receipt', 'data-test': 'reviewed-card-identifiers' }, [
        `Card ${card.cardId} · agenda item ${card.agendaItemId}`,
      ]),
      el('p', { class: 'gw-fa-row-receipt' }, [
        `${card.recordCount} reviewed statement${card.recordCount === 1 ? '' : 's'} · ${card.laneLabel}`,
      ]),
      ...(card.statementIds.length ? [el('p', {
        class: 'gw-fa-row-receipt',
        'data-test': 'reviewed-statement-ids',
      }, [`Statement IDs: ${card.statementIds.join(' · ')}`])] : []),
      el('div', { class: 'gw-fa-reviewed-slot-grid', 'data-test': 'reviewed-agenda-slots' }, [
        reviewedAnalysisSlot(card),
        reviewedLanguageSlot(card),
        reviewedProcessSlot(card),
        reviewedReceiptSlot(card),
        reviewedDecisionContextSlot(card),
      ]),
      el('div', { class: 'gw-fa-unavailable-tools', role: 'group', 'aria-label': 'Agenda item tools unavailable', 'data-test': 'reviewed-agenda-tools' }, [
        el('button', { type: 'button', class: 'gw-fa-tool-unavailable', disabled: '' }, ['Track · unavailable']),
        el('button', { type: 'button', class: 'gw-fa-tool-unavailable', disabled: '' }, ['Analysis · unavailable']),
        el('button', { type: 'button', class: 'gw-fa-tool-unavailable', disabled: '' }, ['Attachments · unavailable']),
      ]),
    ]),
  ]);
}

function reviewedAgendaArea(board: AgendaBoard): HTMLElement {
  const cards = allReviewedCards(board);
  const content = cards.length
    ? cards.map(reviewedAgendaCard)
    : [
        el('section', { class: 'gw-fa-reviewed-empty', role: 'status', 'data-test': 'reviewed-agenda-empty' }, [
          el('h3', {}, ['No agenda item is review-ready yet']),
          el('p', {}, [
            board.unanchoredStatementCount > 0
              ? `${board.unanchoredStatementCount} reviewed statement(s) are not yet anchored to an agenda item.`
              : 'The reviewed projection contains no agenda-anchored cards.',
          ]),
        ]),
        el('div', { class: 'gw-fa-reviewed-slot-grid', 'data-test': 'reviewed-agenda-slots' }, [
          reviewedAnalysisSlot(),
          reviewedLanguageSlot(),
          reviewedProcessSlot(),
          reviewedReceiptSlot(),
          reviewedDecisionContextSlot(),
        ]),
      ];

  return el('section', {
    class: 'gw-fa-agenda gw-fa-reviewed-agenda',
    'aria-labelledby': 'gw-fa-reviewed-agenda-title',
    'data-test': 'reviewed-agenda-area',
  }, [
    el('div', { class: 'gw-fa-section-head' }, [
      el('div', {}, [
        kicker('AGENDA CONTENT · REVIEWED PROJECTION'),
        titleWithInfo(
          el('h2', { id: 'gw-fa-reviewed-agenda-title' }, ['Agenda items and evidence slots']),
          'agenda-sources',
        ),
      ]),
      el('span', { class: 'gw-fa-muted', 'data-test': 'reviewed-card-count' }, [String(board.cardCount)]),
    ]),
    el('p', { class: 'gw-fa-board-disclosure' }, [
      'Only fields supplied by the reviewed AgendaBoard projection appear here. Unavailable analysis is shown as a gap.',
    ]),
    el('div', { class: 'gw-fa-agenda-list' }, content),
  ]);
}

function reviewedAgendaStages(board: AgendaBoard): HTMLElement {
  const stages = board.lanes.map((lane) => el('section', {
    class: 'gw-fa-issue-column gw-fa-reviewed-stage',
    'data-test': 'reviewed-issue-stage',
    'data-lane': String(lane.lane),
  }, [
    el('header', {}, [
      el('h3', {}, [lane.laneLabel]),
      el('span', { 'data-test': 'reviewed-issue-stage-count' }, [String(lane.cardCount)]),
    ]),
    lane.cards.length
      ? el('ul', { class: 'gw-fa-reviewed-stage-items' }, lane.cards.map((card) => el('li', {}, [
          card.agendaItemTitle ?? card.agendaItemId,
        ])))
      : el('p', { class: 'gw-fa-muted' }, ['No reviewed agenda item in this stage.']),
  ]));

  return el('section', {
    class: 'gw-fa-tracker gw-fa-reviewed-stages',
    'aria-labelledby': 'gw-fa-reviewed-stages-title',
    'data-test': 'reviewed-agenda-stage-area',
  }, [
    el('div', { class: 'gw-fa-section-head' }, [
      el('div', {}, [
        kicker('AGENDA LIFECYCLE · SUPPLIED PROJECTION'),
        titleWithInfo(
          el('h2', { id: 'gw-fa-reviewed-stages-title' }, ['Where reviewed agenda items stand']),
          'agenda-lifecycle',
        ),
      ]),
    ]),
    el('div', {
      class: 'gw-fa-issue-rail',
      role: 'region',
      'aria-label': 'Reviewed agenda lifecycle stages',
      tabindex: '0',
    }, stages),
    reviewedGapSlot(
      'reviewed-issue-tracker-gap',
      'Seven-stage issue tracker unavailable',
      'The six supplied AgendaBoard lanes describe agenda-card lifecycle. They are not substituted for the baseline issue-thread stages; typed cross-meeting issue ids and edges are required.',
    ),
    el('section', { class: 'gw-fa-reviewed-disclosures', role: 'note', 'data-test': 'reviewed-disclosures' }, [
      titleWithInfo(el('h3', {}, ['Projection limits']), 'agenda-gaps'),
      el('ul', {}, [
        el('li', { 'data-test': 'reviewed-disclosure-decisions' }, [board.disclosures.decisions]),
        el('li', { 'data-test': 'reviewed-disclosure-categories' }, [board.disclosures.categories]),
        el('li', { 'data-test': 'reviewed-disclosure-scope' }, [board.disclosures.scope]),
        el('li', { 'data-test': 'reviewed-unanchored-disclosure' }, [
          `Unanchored statements: ${board.unanchoredStatementCount}`,
        ]),
      ]),
    ]),
  ]);
}

/**
 * Maps one fixture issue onto the shared kanban primitive.
 *
 * `level` drives only the card's colour bar. It is never a claim about the
 * record itself — a town-coloured card asserts nothing beyond which lane the
 * fixture placed it in.
 */
function issueCardSpec(
  root: HTMLElement,
  issue: IssueCard,
  tracked: Record<string, boolean>,
  index: number,
): KanbanCardSpec {
  return {
    id: `${issue.issueKey}-${index}`,
    title: issue.title,
    level: issue.jurisdiction,
    board: issue.body,
    area: JURISDICTION_LABEL[issue.jurisdiction],
    last: issue.last,
    next: issue.next,
    ...(issue.flag ? { flags: [issue.flag] } : {}),
    actions: [
      el('span', { class: 'gw-fa-row-receipt' }, [
        `Receipts (${issue.receipts}) · synthetic references only`,
      ]),
      trackButton(root, tracked, issue.issueKey, issue.title),
    ],
  };
}

function issueTracker(root: HTMLElement, tracked: Record<string, boolean>): HTMLElement {
  const rail = el('div', {
    class: 'gw-fa-issue-rail',
    role: 'region',
    'aria-label': 'Seven-stage issue tracker; scroll horizontally for later stages',
    tabindex: '0',
    'data-test': 'issue-tracker',
  });
  // The seven design stages render through the shared kanban primitive rather
  // than a second hand-rolled board, so lane geometry, the level colour bar,
  // the empty state, and print behaviour stay identical to every other board.
  const board = kanbanBoard(
    ISSUE_STAGES.map((label, index) => ({
      id: `stage-${index}`,
      label: `${index + 1}. ${label}`,
      cards: ISSUE_CARDS
        .filter((issue) => issue.stage === index)
        .map((issue, cardIndex) => issueCardSpec(root, issue, tracked, cardIndex)),
    })),
    'Seven-stage issue tracker',
  );
  rail.append(board);
  const columns = [...board.querySelectorAll<HTMLElement>('[data-test="kanban-lane"]')];

  const filters = el('div', {
    class: 'gw-fa-filters',
    role: 'group',
    'aria-label': 'Filter issue tracker by jurisdiction',
  });
  const choices: { value: 'all' | Jurisdiction; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'town', label: 'Town' },
    { value: 'county', label: 'County' },
    { value: 'state', label: 'State' },
  ];
  for (const choice of choices) {
    const button = el('button', {
      type: 'button',
      'data-filter': choice.value,
      'aria-pressed': choice.value === 'all' ? 'true' : 'false',
    }, [choice.label]);
    button.addEventListener('click', () => {
      for (const filter of filters.querySelectorAll<HTMLButtonElement>('button')) {
        filter.setAttribute('aria-pressed', filter === button ? 'true' : 'false');
      }
      for (const card of rail.querySelectorAll<HTMLElement>('[data-test="kanban-card"]')) {
        card.hidden = choice.value !== 'all' && card.dataset.level !== choice.value;
      }
      for (const column of columns) {
        const visible = column.querySelectorAll<HTMLElement>('[data-test="kanban-card"]:not([hidden])').length;
        const count = column.querySelector<HTMLElement>('[data-test="kanban-lane-count"]');
        if (count) count.textContent = String(visible);
      }
    });
    filters.append(button);
  }
  filters.append(renderPrivateInfoNote('agenda-filters'));

  return el('section', { class: 'gw-fa-tracker', 'aria-labelledby': 'gw-fa-tracker-title' }, [
    el('div', { class: 'gw-fa-section-head' }, [
      el('div', {}, [
        kicker('ISSUE TRACKER · WHERE EVERYTHING STANDS'),
        titleWithInfo(
          el('h2', { id: 'gw-fa-tracker-title' }, ['Seven stages, one shared tracking state']),
          'agenda-lifecycle',
        ),
      ]),
      filters,
    ]),
    el('p', { class: 'gw-fa-muted' }, [
      'Issues stay in their displayed design-fixture stage. Scroll sideways for later stages →',
    ]),
    rail,
    el('p', { class: 'gw-fa-receipts-note', 'data-test': 'receipts-disclaimer' }, [RECEIPTS_DISCLAIMER]),
  ]);
}

function fixtureBanner(notice?: string): HTMLElement {
  const children: (Node | string)[] = [
    el('strong', {}, [FIXTURE_LABEL]),
    el('span', {}, ['Sample Town of Alpine records for visual review only.']),
  ];
  if (notice) children.push(el('span', { class: 'gw-fa-notice' }, [notice]));
  return el('div', { class: 'gw-fa-fixture-banner', role: 'status', 'data-test': 'fixture-banner' }, children);
}

function reviewedBanner(board: AgendaBoard, notice?: string): HTMLElement {
  const children: (Node | string)[] = [
    el('strong', {}, [REVIEWED_LABEL]),
    el('span', {}, [`Scope: ${board.scope} · access: ${board.access}`]),
  ];
  if (notice) children.push(el('span', { class: 'gw-fa-notice' }, [notice]));
  return el('div', { class: 'gw-fa-reviewed-banner', role: 'status', 'data-test': 'reviewed-banner' }, children);
}

function pageHeader(mode: ShellMode): HTMLElement {
  return el('header', { class: 'gw-fa-page-head' }, [
    el('div', {}, [
      kicker('GOVERNMENT WATCHDOG · MEETINGS & AGENDAS'),
      titleWithInfo(
        el('h1', {}, [mode === 'simple' ? 'What your council will discuss next' : 'Fast Agenda']),
        'agenda-overview',
      ),
      el('p', {}, [
        mode === 'simple'
          ? 'A plain-language reading view of the July 21 synthetic meeting fixture.'
          : 'Meeting readiness, plain-language agenda analysis, and issue movement in one synthetic review board.',
      ]),
    ]),
    el('span', { class: 'gw-fa-mode', 'data-test': 'reading-mode' }, [
      `${mode === 'simple' ? 'Simple' : 'Advanced'} reading mode`,
    ]),
  ]);
}

function reviewedPageHeader(mode: ShellMode, board: AgendaBoard): HTMLElement {
  return el('header', { class: 'gw-fa-page-head' }, [
    el('div', {}, [
      kicker('GOVERNMENT WATCHDOG · MEETINGS & AGENDAS'),
      titleWithInfo(
        el('h1', {}, [mode === 'simple' ? 'What the reviewed agenda can support' : 'Fast Agenda']),
        'agenda-overview',
      ),
      el('p', {}, [
        mode === 'simple'
          ? `A plain-language view of the reviewed ${board.scope} agenda projection and its disclosed gaps.`
          : `Meeting readiness, evidence slots, and lifecycle lanes supplied by ${board.generatedFrom}.`,
      ]),
    ]),
    el('span', { class: 'gw-fa-mode', 'data-test': 'reading-mode' }, [
      `${mode === 'simple' ? 'Simple' : 'Advanced'} reading mode`,
    ]),
  ]);
}

function gate(
  root: HTMLElement,
  detail = 'Reviewer-internal fixture access is required for this design surface.',
): void {
  root.append(el('section', {
    class: 'gw-fa-gated',
    role: 'status',
    'data-test': 'fast-agenda-gated',
  }, [
    el('h1', {}, ['Fast Agenda unavailable']),
    el('p', {}, [detail]),
  ]));
}

/**
 * Render the Fast Agenda handoff from either its explicit synthetic fixture or
 * a reviewer-internal AgendaBoard projection. Both paths fail closed at their
 * access/data boundary; reviewed mode never borrows facts from the fixture.
 */
export function renderFastAgendaDesign(root: HTMLElement, options: FastAgendaDesignOptions = {}): void {
  ensureFastAgendaStyle();
  closeModal(root);
  root.className = 'gw-fast-agenda-design-root';
  root.replaceChildren();

  const mode = readMode();
  if (options.fixture === true) {
    if (options.access !== 'reviewer_internal') {
      gate(root);
      return;
    }

    const tracked = readTracked();
    const content = mode === 'simple'
      ? [simpleMeetingDigest(), simpleAgendaDigest(root, tracked)]
      : [
          el('div', { class: 'gw-fa-overview' }, [meetingBoard(), agendaBoard(root, tracked)]),
          issueTracker(root, tracked),
        ];
    root.append(el('div', {
      class: `gw-fa gw-fa--${mode}`,
      'data-mode': mode,
      'data-test': `fast-agenda-${mode}`,
    }, [
      fixtureBanner(options.notice),
      el('div', { class: 'gw-fa-frame' }, [
        pageHeader(mode),
        ...content,
        el('footer', { class: 'gw-fa-footer' }, [
          el('strong', {}, ['◆ Holding power accountable. Amplifying transparency.']),
          el('span', {}, ['Synthetic fixture · no live refresh timestamp']),
        ]),
      ]),
    ]));
    return;
  }

  const board = options.board;
  const access = options.access ?? board?.access;
  if (!board || access !== 'reviewer_internal' || board.access !== 'reviewer_internal') {
    gate(root, 'A reviewer-internal AgendaBoard projection is required for this Fast Agenda surface.');
    return;
  }

  root.append(el('div', {
    class: `gw-fa gw-fa--${mode} gw-fa--reviewed`,
    'data-mode': mode,
    'data-origin': 'reviewed',
    'data-test': `fast-agenda-reviewed-${mode}`,
  }, [
    reviewedBanner(board, options.notice),
    el('div', { class: 'gw-fa-frame' }, [
      reviewedPageHeader(mode, board),
      el('div', { class: 'gw-fa-overview gw-fa-reviewed-overview' }, [
        reviewedMeetingReadiness(board),
        reviewedAgendaArea(board),
      ]),
      reviewedAgendaStages(board),
      el('footer', { class: 'gw-fa-footer' }, [
        el('strong', {}, ['◆ Holding power accountable. Amplifying transparency.']),
        el('span', {}, [`Reviewed projection · ${board.generatedFrom}`]),
      ]),
    ]),
  ]));
}

export const FAST_AGENDA_DESIGN_STYLE = `${GW_TOKENS}
.gw-fast-agenda-design-root{min-width:0}
.gw-fa,.gw-fa *{box-sizing:border-box}
.gw-fa{min-height:100%;background:var(--gw-page-bg);color:var(--gw-text);font:var(--gw-text-body)/var(--gw-leading) var(--gw-font)}
.gw-fa button{min-width:44px;min-height:44px;font:inherit;cursor:pointer}
.gw-fa button:focus-visible,.gw-fa [tabindex]:focus-visible{outline:3px solid var(--gw-accent);outline-offset:3px}
.gw-fa h1,.gw-fa h2,.gw-fa h3,.gw-fa h4,.gw-fa p{margin-top:0}
.gw-fa h1{font-size:var(--gw-text-xl);line-height:var(--gw-leading-tight);margin-bottom:var(--gw-space-2)}
.gw-fa h2{font-size:var(--gw-text-lg);line-height:var(--gw-leading-tight);margin-bottom:var(--gw-space-2)}
.gw-fa h3{font-size:var(--gw-text-body);line-height:1.35;margin-bottom:0}
.gw-fa-title-with-note{display:flex;align-items:flex-start;gap:var(--gw-space-2);min-width:0}.gw-fa-title-with-note>h1,.gw-fa-title-with-note>h2,.gw-fa-title-with-note>h3{min-width:0}.gw-fa-title-with-note>.gw-info-note{flex:0 0 auto}
.gw-fa-fixture-banner{display:flex;justify-content:center;align-items:center;gap:var(--gw-space-3);flex-wrap:wrap;background:var(--gw-caution-bg);border-bottom:var(--gw-border-w) solid var(--gw-caution-line);color:var(--gw-caution-text-strong);padding:var(--gw-space-2) var(--gw-space-5);font:var(--gw-text-sm)/1.4 var(--gw-font-mono);text-align:center}
.gw-fa-fixture-banner strong{letter-spacing:.04em}.gw-fa-notice{border-left:var(--gw-border-w) solid var(--gw-caution-line);padding-left:var(--gw-space-3)}
.gw-fa-reviewed-banner{display:flex;justify-content:center;align-items:center;gap:var(--gw-space-3);flex-wrap:wrap;background:var(--gw-surface-subtle);border-bottom:var(--gw-border-w) solid var(--gw-border-strong);color:var(--gw-text-secondary);padding:var(--gw-space-2) var(--gw-space-5);font:var(--gw-text-sm)/1.4 var(--gw-font-mono);text-align:center}.gw-fa-reviewed-banner strong{color:var(--gw-accent);letter-spacing:.04em}.gw-fa-reviewed-banner .gw-fa-notice{border-color:var(--gw-border-strong)}
.gw-fa-frame{width:min(1460px,100%);margin:0 auto;padding:var(--gw-space-6);display:grid;gap:var(--gw-space-6)}
.gw-fa-page-head{display:flex;align-items:end;justify-content:space-between;gap:var(--gw-space-5);border-bottom:var(--gw-border-w) solid var(--gw-border);padding-bottom:var(--gw-space-5)}
.gw-fa-page-head p{color:var(--gw-text-secondary);margin-bottom:0;max-width:70ch}
.gw-fa-kicker{font-size:var(--gw-text-kicker);font-weight:800;letter-spacing:.14em;color:var(--gw-accent);margin-bottom:var(--gw-space-2);text-transform:uppercase}
.gw-fa-mode{flex:none;border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius-pill);padding:var(--gw-space-3) var(--gw-space-5);font-weight:700;color:var(--gw-text-secondary)}
.gw-fa-overview{display:grid;grid-template-columns:minmax(300px,430px) minmax(0,1fr);gap:var(--gw-space-5);align-items:start}
.gw-fa-meeting,.gw-fa-agenda,.gw-fa-tracker{background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);padding:var(--gw-space-6)}
.gw-fa-section-head{display:flex;align-items:start;justify-content:space-between;gap:var(--gw-space-4);margin-bottom:var(--gw-space-3)}
.gw-fa-section-head h2{margin-bottom:0}.gw-fa-due,.gw-fa-action{display:inline-flex;align-items:center;min-height:26px;border:var(--gw-border-w) solid var(--gw-caution-line);border-radius:var(--gw-radius-sm);padding:var(--gw-space-1) var(--gw-space-3);color:var(--gw-caution-text);font-size:var(--gw-text-xs);font-weight:800;letter-spacing:.05em}
.gw-fa-meeting-time{font-size:var(--gw-text-md);font-weight:700;margin-bottom:var(--gw-space-1)}
.gw-fa-muted{color:var(--gw-text-muted)}
.gw-fa-status-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--gw-space-3);margin-top:var(--gw-space-5)}
.gw-fa-status{display:grid;gap:var(--gw-space-1);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-3);background:var(--gw-surface-subtle)}
.gw-fa-status strong{font-size:var(--gw-text-sm)}.gw-fa-status span{font-size:var(--gw-text-xs);color:var(--gw-text-muted)}
.gw-fa-status.is-ok{background:var(--gw-tone-ok-well);border-color:var(--gw-tone-ok-line)}.gw-fa-status.is-ok strong{color:var(--gw-ok-text)}
.gw-fa-status.is-stop{background:var(--gw-tone-stop-well);border-color:var(--gw-tone-stop-line)}.gw-fa-status.is-stop strong{color:var(--gw-stop-text)}
.gw-fa-status.is-caution{background:var(--gw-tone-caution-well);border-color:var(--gw-tone-caution-line)}.gw-fa-status.is-caution strong{color:var(--gw-caution-text)}
.gw-fa-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--gw-space-2);margin-top:var(--gw-space-3)}
.gw-fa-stat{display:grid;text-align:center;border:var(--gw-border-w) solid var(--gw-border-subtle);border-radius:var(--gw-radius);padding:var(--gw-space-3) var(--gw-space-1);background:var(--gw-surface-well)}
.gw-fa-stat strong{font-size:1.25rem}.gw-fa-stat span{font-size:.62rem;font-weight:800;letter-spacing:.04em;color:var(--gw-text-muted)}
.gw-fa-stat.is-caution strong{color:var(--gw-caution-text)}.gw-fa-stat.is-accent strong{color:var(--gw-accent)}
.gw-fa-public-comment{background:var(--gw-surface-subtle);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-4);margin-top:var(--gw-space-4)}
.gw-fa-nearby{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-3);margin-top:var(--gw-space-4)}
.gw-fa-nearby h3{margin:0 0 var(--gw-space-2);font:700 var(--gw-text-kicker)/1.3 var(--gw-font);letter-spacing:.08em;text-transform:uppercase;color:var(--gw-text-secondary)}
.gw-fa-nearby-last{border:var(--gw-border-w) solid var(--gw-border-subtle);border-radius:var(--gw-radius-md);padding:var(--gw-space-3);display:grid;gap:var(--gw-space-2);justify-items:start}
.gw-fa-nearby-list{list-style:none;margin:0;padding:0;display:grid;gap:var(--gw-space-2)}
.gw-fa-nearby-row{display:flex;align-items:baseline;gap:var(--gw-space-2);font-size:var(--gw-text-sm)}
.gw-fa-nearby-glyph{flex:none;font-family:var(--gw-font-mono)}
.gw-fa-nearby-row.is-ok .gw-fa-nearby-glyph{color:var(--gw-ok-text)}
.gw-fa-nearby-row.is-pending .gw-fa-nearby-glyph{color:var(--gw-text-muted)}
.gw-fa-nearby-body{color:var(--gw-text)}
.gw-fa-nearby-status{color:var(--gw-text-muted);font-size:var(--gw-text-badge)}
.gw-fa-public-comment h2{font-size:var(--gw-text-sm);color:var(--gw-accent)}.gw-fa-public-comment p{margin-bottom:0;color:var(--gw-text-secondary);font-size:var(--gw-text-sm)}
.gw-fa-receipts-note{border-left:3px solid var(--gw-neutral-border);padding-left:var(--gw-space-3);margin:var(--gw-space-4) 0 0;color:var(--gw-text-muted);font-size:var(--gw-text-sm)}
.gw-fa-board-disclosure{background:var(--gw-caution-bg);border:var(--gw-border-w) solid var(--gw-caution-line);border-radius:var(--gw-radius);padding:var(--gw-space-3);color:var(--gw-caution-text-strong);font-size:var(--gw-text-sm)}
.gw-fa-agenda-list{display:grid;gap:var(--gw-space-3)}
.gw-fa-agenda-row{display:grid;grid-template-columns:3rem minmax(0,1fr) 9rem;gap:var(--gw-space-4);align-items:start;background:var(--gw-card-bg);border:var(--gw-border-w) solid var(--gw-border-subtle);border-radius:var(--gw-radius);padding:var(--gw-space-4)}
.gw-fa-number{font:700 var(--gw-text-sm)/1.3 var(--gw-font-mono);color:var(--gw-accent);padding-top:var(--gw-space-2)}
.gw-fa-agenda-title{display:flex;align-items:center;gap:var(--gw-space-3);flex-wrap:wrap}.gw-fa-agenda-title h3{font-size:var(--gw-text-md)}
.gw-fa-ai,.gw-fa-language{margin-top:var(--gw-space-3);border-radius:0 var(--gw-radius) var(--gw-radius) 0;padding:var(--gw-space-3);font-size:var(--gw-text-sm)}
.gw-fa-ai{background:var(--gw-caution-bg-soft);border:var(--gw-border-w) solid var(--gw-caution-line);border-left:3px solid var(--gw-caution-line);color:var(--gw-caution-text-strong)}
.gw-fa-language{background:var(--gw-stop-bg);border:var(--gw-border-w) solid var(--gw-stop-border);border-left:3px solid var(--gw-stop-border);color:var(--gw-stop-text)}
.gw-fa-ai strong,.gw-fa-language strong{display:inline-block;border-radius:var(--gw-radius-sm);padding:var(--gw-space-1) var(--gw-space-2);font-size:var(--gw-text-xs);letter-spacing:.04em}
.gw-fa-ai strong{background:var(--gw-caution-text-strong);color:var(--gw-caution-bg)}.gw-fa-language strong{background:var(--gw-stop-border);color:var(--gw-accent-text-on)}
.gw-fa-ai-caveat,.gw-fa-language-caveat{display:inline-block;margin-left:var(--gw-space-2);font-size:var(--gw-text-xs);font-weight:700}.gw-fa-ai p,.gw-fa-language p{margin:var(--gw-space-2) 0 0}
.gw-fa-flag,.gw-fa-issue-flag{display:inline-flex;margin:var(--gw-space-3) var(--gw-space-2) 0 0;border:var(--gw-border-w) solid var(--gw-caution-line);border-radius:var(--gw-radius-sm);padding:var(--gw-space-1) var(--gw-space-2);color:var(--gw-caution-text);font-size:var(--gw-text-xs);font-weight:700}
.gw-fa-process-wrap{display:flex;align-items:start;gap:var(--gw-space-2);margin-top:var(--gw-space-3)}.gw-fa-process-wrap>strong{padding-top:var(--gw-space-2);font-size:var(--gw-text-xs);letter-spacing:.08em;color:var(--gw-text-muted)}
.gw-fa-process{display:flex;gap:var(--gw-space-2);flex-wrap:wrap;list-style:none;margin:0;padding:0}
.gw-fa-process-step{display:inline-flex;align-items:center;gap:var(--gw-space-1);border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius-sm);padding:var(--gw-space-1) var(--gw-space-2);font:var(--gw-text-xs)/1.4 var(--gw-font-mono);color:var(--gw-text-muted)}
.gw-fa-process-step.is-done{color:var(--gw-ok-text);border-color:var(--gw-ok-text)}.gw-fa-process-step.is-current{color:var(--gw-caution-text);border-color:var(--gw-caution-line)}.gw-fa-process-step.is-alert{color:var(--gw-stop-text);border-color:var(--gw-stop-border)}
.gw-fa-row-receipt{margin:var(--gw-space-3) 0 0;color:var(--gw-text-muted);font-size:var(--gw-text-xs)}
.gw-fa-row-actions{display:grid;gap:var(--gw-space-2)}
.gw-fa-track,.gw-fa-details,.gw-fa-secondary,.gw-fa-filters button{border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius);background:transparent;color:var(--gw-text-secondary);font-weight:700;padding:var(--gw-space-2) var(--gw-space-3)}
.gw-fa-track.is-tracked{background:var(--gw-tone-mint-well);border-color:var(--gw-accent);color:var(--gw-accent)}
.gw-fa-details{border-color:var(--gw-accent);color:var(--gw-accent)}.gw-fa-track:hover,.gw-fa-details:hover,.gw-fa-secondary:hover,.gw-fa-filters button:hover{background:var(--gw-surface-well)}
.gw-fa-tracker{min-width:0}.gw-fa-filters{display:flex;gap:var(--gw-space-1);flex-wrap:wrap}.gw-fa-filters button{min-height:44px;min-width:56px}.gw-fa-filters button[aria-pressed="true"]{background:var(--gw-accent);border-color:var(--gw-accent);color:var(--gw-accent-text-on)}
.gw-fa-issue-rail{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(230px,1fr);gap:var(--gw-space-3);overflow-x:auto;overscroll-behavior-inline:contain;padding:var(--gw-space-2) var(--gw-space-1) var(--gw-space-4);scroll-snap-type:x proximity}
.gw-fa-issue-column{scroll-snap-align:start;background:var(--gw-lane-bg);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-3)}
.gw-fa-issue-column>header{display:flex;align-items:center;justify-content:space-between;gap:var(--gw-space-2);margin-bottom:var(--gw-space-3)}.gw-fa-issue-column>header h3{font-size:var(--gw-text-xs);letter-spacing:.05em;text-transform:uppercase}.gw-fa-issue-column>header span{border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-sm);padding:0 var(--gw-space-2);color:var(--gw-text-muted)}
.gw-fa-issue-stack{display:grid;gap:var(--gw-space-3)}.gw-fa-issue-card{background:var(--gw-card-bg);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-3)}.gw-fa-issue-card h4{font-size:var(--gw-text-sm);line-height:1.35;margin-bottom:var(--gw-space-1)}.gw-fa-issue-card p{font-size:var(--gw-text-xs);margin-bottom:var(--gw-space-2)}
.gw-fa-level{display:inline-flex;border:var(--gw-border-w) solid currentColor;border-radius:var(--gw-radius-sm);padding:var(--gw-space-1) var(--gw-space-2);font-size:var(--gw-text-xs);font-weight:800}.gw-fa-level.is-town{color:var(--gw-level-town)}.gw-fa-level.is-county{color:var(--gw-level-county)}.gw-fa-level.is-state{color:var(--gw-level-state)}
.gw-fa-issue-card dl{display:grid;gap:var(--gw-space-2);margin:var(--gw-space-3) 0;font-size:var(--gw-text-xs)}.gw-fa-issue-card dl div{display:grid;grid-template-columns:2.5rem 1fr;gap:var(--gw-space-2)}.gw-fa-issue-card dt{font-weight:800;color:var(--gw-text-secondary)}.gw-fa-issue-card dd{margin:0;color:var(--gw-text-muted)}.gw-fa-issue-card .gw-fa-track{width:100%}
.gw-fa-reviewed-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.gw-fa-reviewed-agenda-row{grid-template-columns:3rem minmax(0,1fr)}.gw-fa-reviewed-empty{border:var(--gw-border-w) dashed var(--gw-border-strong);border-radius:var(--gw-radius);background:var(--gw-surface-subtle);padding:var(--gw-space-4)}.gw-fa-reviewed-empty p{margin:var(--gw-space-2) 0 0;color:var(--gw-text-secondary)}
.gw-fa-reviewed-slot-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--gw-space-3);margin-top:var(--gw-space-3)}.gw-fa-reviewed-slot{min-width:0;border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);background:var(--gw-surface-subtle);padding:var(--gw-space-3)}.gw-fa-reviewed-slot.is-unavailable{border-style:dashed}.gw-fa-reviewed-slot h3{color:var(--gw-text-secondary)}.gw-fa-reviewed-slot p{margin:var(--gw-space-2) 0 0;color:var(--gw-text-muted);font-size:var(--gw-text-sm)}.gw-fa-reviewed-slot ul{margin:var(--gw-space-2) 0 0;padding-left:1.2rem;color:var(--gw-text-secondary);font-size:var(--gw-text-sm);overflow-wrap:anywhere}
.gw-fa-reviewed-stage-items{margin:0;padding-left:1.2rem;color:var(--gw-text-secondary);font-size:var(--gw-text-sm)}.gw-fa-reviewed-disclosures{margin-top:var(--gw-space-4);border-top:var(--gw-border-w) solid var(--gw-border);padding-top:var(--gw-space-4)}.gw-fa-reviewed-disclosures ul{margin-bottom:0;padding-left:1.2rem;color:var(--gw-text-muted);font-size:var(--gw-text-sm)}
.gw-fa-footer{display:flex;justify-content:space-between;gap:var(--gw-space-4);border-top:var(--gw-border-w) solid var(--gw-border);padding-top:var(--gw-space-5);color:var(--gw-text-muted);font-size:var(--gw-text-sm)}
.gw-fa-unavailable-tools{display:flex;flex-wrap:wrap;gap:var(--gw-space-2);margin-top:var(--gw-space-4)}.gw-fa-tool-unavailable{border:var(--gw-border-w) dashed var(--gw-border-strong);border-radius:var(--gw-radius);background:var(--gw-surface-well);color:var(--gw-text-muted);padding:var(--gw-space-2) var(--gw-space-3);cursor:not-allowed}
.gw-fa-modal>.gw-fa-track{justify-self:start}.gw-fa-modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--gw-space-4)}.gw-fa-modal-section{background:var(--gw-surface-subtle);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-4)}.gw-fa-modal-section ul{margin-bottom:0;padding-left:1.25rem}.gw-fa-modal-actions{display:flex;align-items:center;gap:var(--gw-space-3);justify-content:space-between;border-top:var(--gw-border-w) solid var(--gw-border);padding-top:var(--gw-space-4);color:var(--gw-text-muted);font-size:var(--gw-text-sm)}
.gw-fa-gated{max-width:52rem;margin:var(--gw-space-6) auto;background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);padding:var(--gw-space-6);color:var(--gw-text);font-family:var(--gw-font)}
.gw-fa--simple{font-family:var(--gw-font-serif);font-size:1.03rem}.gw-fa--simple .gw-fa-frame{max-width:920px;background:var(--gw-header-bg);border-left:var(--gw-border-w) solid var(--gw-border);border-right:var(--gw-border-w) solid var(--gw-border)}.gw-fa--simple .gw-fa-page-head{text-align:center;border-top:3px solid var(--gw-rule-strong);border-bottom:3px double var(--gw-rule-strong);align-items:center}.gw-fa--simple .gw-fa-page-head>div{flex:1}.gw-fa--simple .gw-fa-page-head h1{font:600 var(--gw-text-display)/1 var(--gw-font-serif)}
.gw-fa--simple .gw-fa-reviewed-overview{grid-template-columns:1fr}.gw-fa--simple .gw-fa-reviewed-meeting,.gw-fa--simple .gw-fa-reviewed-agenda,.gw-fa--simple .gw-fa-reviewed-stages{border-color:var(--gw-rule-strong);border-radius:var(--gw-radius-sm)}.gw-fa--simple .gw-fa-reviewed-slot-grid{grid-template-columns:1fr}.gw-fa--simple .gw-fa-reviewed-slot{background:transparent}
.gw-fa-simple-meeting,.gw-fa-simple-agenda{background:var(--gw-surface);border-top:3px solid var(--gw-rule-strong);border-bottom:var(--gw-border-w) solid var(--gw-rule-strong);padding:var(--gw-space-6)}.gw-fa-simple-meeting h2,.gw-fa-simple-agenda h2{font:600 var(--gw-text-xl)/1.15 var(--gw-font-serif)}.gw-fa-simple-lede{max-width:65ch;margin-top:var(--gw-space-4);color:var(--gw-text-secondary)}
.gw-fa-simple-list{list-style:none;margin:var(--gw-space-5) 0 0;padding:0}.gw-fa-simple-item{border-top:var(--gw-border-w) solid var(--gw-border);padding:var(--gw-space-5) 0}.gw-fa-simple-item:first-child{border-top:3px double var(--gw-rule-strong)}.gw-fa-simple-item article{display:grid;gap:var(--gw-space-3)}.gw-fa-simple-item-head{display:grid;grid-template-columns:3rem minmax(0,1fr);gap:var(--gw-space-4);align-items:start}.gw-fa-simple-item-head h3{font:600 1.3rem/1.2 var(--gw-font-serif)}.gw-fa--simple .gw-fa-number{display:grid;place-items:center;min-width:38px;min-height:38px;border-radius:50%;background:var(--gw-accent);color:var(--gw-accent-text-on);padding:var(--gw-space-1)}.gw-fa-simple-action{margin:var(--gw-space-1) 0 0;color:var(--gw-text-muted);font:700 var(--gw-text-xs)/1.4 var(--gw-font-mono);letter-spacing:.04em}.gw-fa-simple-decision{margin:0;color:var(--gw-text-secondary)}.gw-fa-simple-receipts{justify-self:start}
@media (max-width:1050px){.gw-fa-overview{grid-template-columns:1fr}.gw-fa-meeting{position:static}.gw-fa-stat-grid{grid-template-columns:repeat(4,minmax(90px,1fr))}}
@media (max-width:720px){.gw-fa-frame{padding:var(--gw-space-4)}.gw-fa-page-head,.gw-fa-section-head,.gw-fa-footer{align-items:stretch;flex-direction:column}.gw-fa-status-grid,.gw-fa-stat-grid{grid-template-columns:1fr 1fr}.gw-fa-modal-grid,.gw-fa-reviewed-slot-grid{grid-template-columns:1fr}.gw-fa-agenda-row{grid-template-columns:2.5rem minmax(0,1fr)}.gw-fa-row-actions{grid-column:2;grid-template-columns:1fr 1fr}.gw-fa-agenda,.gw-fa-meeting,.gw-fa-tracker,.gw-fa-simple-meeting,.gw-fa-simple-agenda{padding:var(--gw-space-4)}}
@media (max-width:440px){.gw-fa-status-grid,.gw-fa-stat-grid,.gw-fa-modal-grid{grid-template-columns:1fr}.gw-fa-row-actions,.gw-fa--simple .gw-fa-row-actions{grid-template-columns:1fr}.gw-fa-process-wrap{display:block}.gw-fa-process-wrap>strong{display:block;margin-bottom:var(--gw-space-2)}}
@media print{.gw-fa-fixture-banner{border:2px solid var(--gw-caution-line)}.gw-fa-reviewed-banner{border:2px solid var(--gw-border-strong)}.gw-fa button{display:none}.gw-fa-issue-rail{grid-auto-flow:row;grid-auto-columns:auto;overflow:visible}}
`;

function ensureFastAgendaStyle(): void {
  if (document.getElementById('gw-fast-agenda-design-style')) return;
  const style = el('style', { id: 'gw-fast-agenda-design-style' }, [FAST_AGENDA_DESIGN_STYLE]);
  document.head.append(style);
}
