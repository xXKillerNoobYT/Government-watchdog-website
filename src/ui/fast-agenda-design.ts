/**
 * High-fidelity Fast Agenda design fixture derived from the supplied handoff.
 *
 * This module is deliberately self-contained and is not wired into routing yet.
 * Its synthetic civic records are available only when BOTH reviewer-internal
 * access and explicit fixture mode are present. Every other call fails closed
 * before any fixture leaf is added to the DOM.
 */

import { readMode, type ShellMode } from './shell';
import { GW_TOKENS } from './tokens';

export interface FastAgendaDesignOptions {
  access?: string;
  fixture?: boolean;
  notice?: string;
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

function kicker(text: string): HTMLElement {
  return el('p', { class: 'gw-fa-kicker' }, [text]);
}

function readTracked(): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem('gw_tracked') ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter((entry): entry is [string, true] => entry[1] === true),
    );
  } catch {
    return {};
  }
}

function persistTracked(tracked: Record<string, boolean>): void {
  try {
    localStorage.setItem('gw_tracked', JSON.stringify(tracked));
  } catch {
    /* The control still works for this render when storage is unavailable. */
  }
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
    persistTracked(tracked);
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

const modalCleanup = new WeakMap<HTMLElement, () => void>();

function openDetails(
  root: HTMLElement,
  item: AgendaItem,
  tracked: Record<string, boolean>,
  trigger: HTMLElement,
): void {
  modalCleanup.get(root)?.();

  const titleId = `gw-fa-modal-title-${item.id}`;
  const receiptId = `gw-fa-modal-receipts-${item.id}`;
  const closeButton = el('button', {
    type: 'button',
    class: 'gw-fa-modal-close',
    'aria-label': 'Close detailed agenda analysis',
    'data-test': 'modal-close',
  }, ['×']);

  const history = el('section', { class: 'gw-fa-modal-section' }, [
    el('h3', {}, ['Past activity — newest first']),
    el('ul', {}, item.history.map((event) => el('li', {}, [event]))),
  ]);
  const receipts = el('section', { class: 'gw-fa-modal-section', id: receiptId }, [
    el('h3', {}, ['Receipts']),
    el('ul', {}, item.receipts.map((receipt) => el('li', {}, [receipt]))),
    el('p', { class: 'gw-fa-receipts-note', 'data-test': 'receipts-disclaimer' }, [RECEIPTS_DISCLAIMER]),
  ]);

  const dialog = el('section', {
    class: 'gw-fa-modal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titleId,
    'aria-describedby': receiptId,
    'data-test': 'agenda-modal',
  }, [
    el('header', { class: 'gw-fa-modal-head' }, [
      el('div', {}, [
        kicker(`ITEM ${item.number} · DETAILED DESIGN ANALYSIS`),
        el('h2', { id: titleId }, [item.title]),
        el('p', { class: 'gw-fa-action' }, [item.action]),
      ]),
      closeButton,
    ]),
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
      el('button', { type: 'button', class: 'gw-fa-secondary', 'data-test': 'modal-footer-close' }, ['Close']),
    ]),
  ]);

  const backdrop = el('div', {
    class: 'gw-fa-backdrop',
    'data-test': 'agenda-modal-backdrop',
  }, [dialog]);

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown);
    backdrop.remove();
    modalCleanup.delete(root);
    trigger.focus();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  closeButton.addEventListener('click', close);
  const footerClose = dialog.querySelector<HTMLButtonElement>('[data-test="modal-footer-close"]');
  footerClose?.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener('keydown', onKeyDown);
  modalCleanup.set(root, close);
  root.append(backdrop);
  closeButton.focus();
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
    el('h2', { id: 'gw-fa-meeting-title' }, ['Alpine Town Council']),
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
        el('h2', { id: 'gw-fa-agenda-title' }, ['Plain English first; official numbering preserved']),
      ]),
      el('span', { class: 'gw-fa-muted' }, ['8 synthetic design rows']),
    ]),
    el('p', { class: 'gw-fa-board-disclosure' }, [
      'All summaries and language-watch notes below are AI-presented synthetic design copy. They are not independently verified and are not a live read.',
    ]),
    el('div', { class: 'gw-fa-agenda-list' }, AGENDA_ITEMS.map((item) => agendaRow(root, item, tracked))),
  ]);
}

function issueCard(
  root: HTMLElement,
  issue: IssueCard,
  tracked: Record<string, boolean>,
): HTMLElement {
  const children: (Node | string)[] = [
    el('h4', {}, [issue.title]),
    el('p', { class: 'gw-fa-muted' }, [issue.body]),
    el('span', { class: `gw-fa-level is-${issue.jurisdiction}` }, [JURISDICTION_LABEL[issue.jurisdiction]]),
  ];
  if (issue.flag) children.push(el('span', { class: 'gw-fa-issue-flag' }, [issue.flag]));
  children.push(
    el('dl', {}, [
      el('div', {}, [el('dt', {}, ['Last']), el('dd', {}, [issue.last])]),
      el('div', {}, [el('dt', {}, ['Next']), el('dd', {}, [issue.next])]),
    ]),
    el('p', { class: 'gw-fa-row-receipt' }, [`Receipts (${issue.receipts}) · synthetic references only`]),
    trackButton(root, tracked, issue.issueKey, issue.title),
  );
  return el('article', {
    class: 'gw-fa-issue-card',
    'data-level': issue.jurisdiction,
    'data-test': 'issue-card',
  }, children);
}

function issueTracker(root: HTMLElement, tracked: Record<string, boolean>): HTMLElement {
  const rail = el('div', {
    class: 'gw-fa-issue-rail',
    role: 'region',
    'aria-label': 'Seven-stage issue tracker; scroll horizontally for later stages',
    tabindex: '0',
    'data-test': 'issue-tracker',
  });
  const columns: HTMLElement[] = [];
  for (let index = 0; index < ISSUE_STAGES.length; index += 1) {
    const stageIssues = ISSUE_CARDS.filter((issue) => issue.stage === index);
    const column = el('section', {
      class: 'gw-fa-issue-column',
      'data-stage-index': String(index),
      'data-test': 'issue-stage',
    }, [
      el('header', {}, [
        el('h3', {}, [`${index + 1}. ${ISSUE_STAGES[index]}`]),
        el('span', { 'data-stage-count': String(index) }, [String(stageIssues.length)]),
      ]),
      el('div', { class: 'gw-fa-issue-stack' }, stageIssues.map((issue) => issueCard(root, issue, tracked))),
    ]);
    columns.push(column);
    rail.append(column);
  }

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
      for (const card of rail.querySelectorAll<HTMLElement>('[data-test="issue-card"]')) {
        card.hidden = choice.value !== 'all' && card.dataset.level !== choice.value;
      }
      for (let stageIndex = 0; stageIndex < columns.length; stageIndex += 1) {
        const visible = columns[stageIndex]?.querySelectorAll<HTMLElement>('[data-test="issue-card"]:not([hidden])').length ?? 0;
        const count = columns[stageIndex]?.querySelector<HTMLElement>('[data-stage-count]');
        if (count) count.textContent = String(visible);
      }
    });
    filters.append(button);
  }

  return el('section', { class: 'gw-fa-tracker', 'aria-labelledby': 'gw-fa-tracker-title' }, [
    el('div', { class: 'gw-fa-section-head' }, [
      el('div', {}, [
        kicker('ISSUE TRACKER · WHERE EVERYTHING STANDS'),
        el('h2', { id: 'gw-fa-tracker-title' }, ['Seven stages, one shared tracking state']),
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

function pageHeader(mode: ShellMode): HTMLElement {
  return el('header', { class: 'gw-fa-page-head' }, [
    el('div', {}, [
      kicker('GOVERNMENT WATCHDOG · MEETINGS & AGENDAS'),
      el('h1', {}, [mode === 'simple' ? 'What your council will discuss next' : 'Fast Agenda']),
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

function gate(root: HTMLElement): void {
  root.append(el('section', {
    class: 'gw-fa-gated',
    role: 'status',
    'data-test': 'fast-agenda-gated',
  }, [
    el('h1', {}, ['Fast Agenda unavailable']),
    el('p', {}, ['Reviewer-internal fixture access is required for this design surface.']),
  ]));
}

/**
 * Render the Fast Agenda handoff as an accessible synthetic design fixture.
 * The fixture fails closed unless both gate requirements are explicitly present.
 */
export function renderFastAgendaDesign(root: HTMLElement, options: FastAgendaDesignOptions = {}): void {
  ensureFastAgendaStyle();
  modalCleanup.get(root)?.();
  root.className = 'gw-fast-agenda-design-root';
  root.replaceChildren();

  if (options.access !== 'reviewer_internal' || options.fixture !== true) {
    gate(root);
    return;
  }

  const mode = readMode();
  const tracked = readTracked();
  const surface = el('div', {
    class: `gw-fa gw-fa--${mode}`,
    'data-mode': mode,
    'data-test': `fast-agenda-${mode}`,
  }, [
    fixtureBanner(options.notice),
    el('div', { class: 'gw-fa-frame' }, [
      pageHeader(mode),
      el('div', { class: 'gw-fa-overview' }, [meetingBoard(), agendaBoard(root, tracked)]),
      issueTracker(root, tracked),
      el('footer', { class: 'gw-fa-footer' }, [
        el('strong', {}, ['◆ Holding power accountable. Amplifying transparency.']),
        el('span', {}, ['Synthetic fixture · no live refresh timestamp']),
      ]),
    ]),
  ]);
  root.append(surface);
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
.gw-fa-fixture-banner{display:flex;justify-content:center;align-items:center;gap:var(--gw-space-3);flex-wrap:wrap;background:var(--gw-caution-bg);border-bottom:var(--gw-border-w) solid var(--gw-caution-line);color:var(--gw-caution-text-strong);padding:var(--gw-space-2) var(--gw-space-5);font:var(--gw-text-sm)/1.4 var(--gw-font-mono);text-align:center}
.gw-fa-fixture-banner strong{letter-spacing:.04em}.gw-fa-notice{border-left:var(--gw-border-w) solid var(--gw-caution-line);padding-left:var(--gw-space-3)}
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
.gw-fa-ai strong{background:var(--gw-caution-line);color:var(--gw-accent-text-on)}.gw-fa-language strong{background:var(--gw-stop-border);color:var(--gw-accent-text-on)}
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
.gw-fa-footer{display:flex;justify-content:space-between;gap:var(--gw-space-4);border-top:var(--gw-border-w) solid var(--gw-border);padding-top:var(--gw-space-5);color:var(--gw-text-muted);font-size:var(--gw-text-sm)}
.gw-fa-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:var(--gw-space-5);background:rgba(3,6,10,.76)}
.gw-fa-modal{width:min(800px,96vw);max-height:90vh;overflow:auto;background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius-lg);box-shadow:0 24px 80px rgba(0,0,0,.45);padding:var(--gw-space-6);display:grid;gap:var(--gw-space-4)}
.gw-fa-modal-head{display:flex;align-items:start;justify-content:space-between;gap:var(--gw-space-4)}.gw-fa-modal-head h2{font-size:var(--gw-text-xl)}.gw-fa-modal-close{flex:none;width:44px;height:44px;border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius);background:transparent;color:var(--gw-text);font-size:1.4rem}
.gw-fa-modal>.gw-fa-track{justify-self:start}.gw-fa-modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--gw-space-4)}.gw-fa-modal-section{background:var(--gw-surface-subtle);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius);padding:var(--gw-space-4)}.gw-fa-modal-section ul{margin-bottom:0;padding-left:1.25rem}.gw-fa-modal-actions{display:flex;align-items:center;gap:var(--gw-space-3);justify-content:space-between;border-top:var(--gw-border-w) solid var(--gw-border);padding-top:var(--gw-space-4);color:var(--gw-text-muted);font-size:var(--gw-text-sm)}
.gw-fa-gated{max-width:52rem;margin:var(--gw-space-6) auto;background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);padding:var(--gw-space-6);color:var(--gw-text);font-family:var(--gw-font)}
.gw-fa--simple{font-family:var(--gw-font-serif);font-size:1.03rem}.gw-fa--simple .gw-fa-frame{max-width:1000px;background:var(--gw-header-bg);border-left:var(--gw-border-w) solid var(--gw-border);border-right:var(--gw-border-w) solid var(--gw-border)}.gw-fa--simple .gw-fa-page-head{text-align:center;border-top:3px solid var(--gw-rule-strong);border-bottom:3px double var(--gw-rule-strong);align-items:center}.gw-fa--simple .gw-fa-page-head>div{flex:1}.gw-fa--simple .gw-fa-page-head h1{font:600 var(--gw-text-display)/1 var(--gw-font-serif)}.gw-fa--simple .gw-fa-overview{grid-template-columns:1fr}.gw-fa--simple .gw-fa-meeting,.gw-fa--simple .gw-fa-agenda,.gw-fa--simple .gw-fa-tracker{border-color:var(--gw-rule-strong);border-radius:var(--gw-radius-sm)}.gw-fa--simple .gw-fa-agenda-row{grid-template-columns:2.5rem minmax(0,1fr);border:0;border-bottom:var(--gw-border-w) solid var(--gw-border);border-radius:0;background:transparent}.gw-fa--simple .gw-fa-number{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--gw-accent);color:var(--gw-accent-text-on)}.gw-fa--simple .gw-fa-row-actions{grid-column:2;grid-template-columns:1fr 1fr}.gw-fa--simple .gw-fa-agenda-title h3{font:600 1.25rem/1.2 var(--gw-font-serif)}.gw-fa--simple .gw-fa-issue-rail{grid-auto-columns:minmax(260px,1fr)}
@media (max-width:1050px){.gw-fa-overview{grid-template-columns:1fr}.gw-fa-meeting{position:static}.gw-fa-stat-grid{grid-template-columns:repeat(4,minmax(90px,1fr))}}
@media (max-width:720px){.gw-fa-frame{padding:var(--gw-space-4)}.gw-fa-page-head,.gw-fa-section-head,.gw-fa-footer{align-items:stretch;flex-direction:column}.gw-fa-status-grid,.gw-fa-stat-grid,.gw-fa-modal-grid{grid-template-columns:1fr 1fr}.gw-fa-agenda-row,.gw-fa--simple .gw-fa-agenda-row{grid-template-columns:2.5rem minmax(0,1fr)}.gw-fa-row-actions,.gw-fa--simple .gw-fa-row-actions{grid-column:2;grid-template-columns:1fr 1fr}.gw-fa-agenda,.gw-fa-meeting,.gw-fa-tracker{padding:var(--gw-space-4)}}
@media (max-width:440px){.gw-fa-status-grid,.gw-fa-stat-grid,.gw-fa-modal-grid{grid-template-columns:1fr}.gw-fa-row-actions,.gw-fa--simple .gw-fa-row-actions{grid-template-columns:1fr}.gw-fa-process-wrap{display:block}.gw-fa-process-wrap>strong{display:block;margin-bottom:var(--gw-space-2)}.gw-fa-backdrop{padding:var(--gw-space-2)}.gw-fa-modal{padding:var(--gw-space-4)}}
@media print{.gw-fa-fixture-banner{border:2px solid var(--gw-caution-line)}.gw-fa button{display:none}.gw-fa-issue-rail{grid-auto-flow:row;grid-auto-columns:auto;overflow:visible}.gw-fa-backdrop{display:none}}
`;

function ensureFastAgendaStyle(): void {
  if (document.getElementById('gw-fast-agenda-design-style')) return;
  const style = el('style', { id: 'gw-fast-agenda-design-style' }, [FAST_AGENDA_DESIGN_STYLE]);
  document.head.append(style);
}
