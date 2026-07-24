/**
 * Universal "?" explanation control.
 *
 * Information notes explain unfamiliar controls and data filing without hiding
 * essential safety or access warnings. Each note has a stable registry ID so
 * tests and future content review can detect missing or drifting explanations.
 */

export interface InfoNoteDefinition {
  label: string;
  what: string;
  source: string;
  filedUnder: string;
  review: string;
  limits: string;
  expectedResult?: string;
}

export const INFO_NOTES = {
  'public-plan': {
    label: 'About the Free preview',
    what: 'The Free view is the quick, plain-language starting point for everyday users.',
    source: 'Its civic facts will come only from a separately approved public projection.',
    filedUnder: 'Product access · Free',
    review: 'Publication rules are enforced before records enter the public asset lane.',
    limits: 'A visual mode or browser setting never grants paid, team, or geographic access.',
    expectedResult: 'A fast Alpine overview with direct links to the supporting public records.',
  },
  'public-scope': {
    label: 'How location scope is filed',
    what: 'The selected place tells you which town, county, and state a page is about.',
    source: 'Coverage must come from an approved server-side location and coverage contract.',
    filedUnder: 'Geography · Wyoming · Lincoln County · Alpine',
    review: 'A place is shown as covered only after its sources and publication lane are approved.',
    limits: 'A saved label does not prove residence, identity, entitlement, or complete coverage.',
  },
  'public-status': {
    label: 'How feed availability is determined',
    what: 'This status says whether reviewed public civic records are available to this build.',
    source: 'The site will read a public-only projection with publication and provenance fields.',
    filedUnder: 'Data status · Public projection',
    review: 'The status changes only after automated safety checks and a publication review pass.',
    limits: 'Private captures and design samples are never substituted when the public feed is unavailable.',
    expectedResult: 'Available records will show a source, review state, freshness, and correction path.',
  },
  'public-meetings': {
    label: 'About meetings and agendas',
    what: 'A quick view of scheduled public meetings and agenda items.',
    source: 'Official agenda packets, notices, minutes, and approved public records.',
    filedUnder: 'Civic records · Meetings and agendas',
    review: 'Dates and agenda status retain their source and last-reviewed timestamp.',
    limits: 'The site will not guess a meeting, deadline, agenda item, or likely decision.',
    expectedResult: 'A plain-language agenda with official numbering and one-tap source receipts.',
  },
  'public-decisions': {
    label: 'About decisions and actions',
    what: 'A connected view of proposals, votes, decisions, corrections, and later follow-up.',
    source: 'Reviewed public statements and typed relationships supplied by the backend.',
    filedUnder: 'Civic records · Decisions and timeline',
    review: 'Connections require an explicit reviewed relationship; title similarity is not enough.',
    limits: 'No score, verdict, motive, or relationship is invented from incomplete records.',
    expectedResult: 'A time-ordered public history with uncertainty and correction labels intact.',
  },
  'public-sources': {
    label: 'About sources and corrections',
    what: 'The receipt layer behind every published summary or flag.',
    source: 'Official public documents, stable locators, archive links, and review metadata.',
    filedUnder: 'Source Vault · Public receipts',
    review: 'Source changes and corrections stay visible instead of silently replacing old claims.',
    limits: 'A link alone does not prove that every claim is complete or current.',
    expectedResult: 'Open the exact supporting record and inspect freshness, review state, and corrections.',
  },
  'public-ai-safety': {
    label: 'How AI assistance is filed',
    what: 'AI may help summarize, organize, or flag material after source collection.',
    source: 'Only the source-backed public projection may feed a public AI-assisted explanation.',
    filedUnder: 'Method · AI assistance',
    review: 'AI output remains labelled and is checked against linked primary records before publication.',
    limits: 'AI can be wrong. It does not replace a source, official notice, legal advice, or human judgment.',
    expectedResult: 'A clearly labelled explanation with receipts, uncertainty, and a correction route.',
  },
  'public-advanced': {
    label: 'About the Advanced preview',
    what: 'Advanced is the planned research workbench for deeper civic investigation.',
    source: 'Server-authorized plan, team, geography, and feature entitlements.',
    filedUnder: 'Product access · Advanced and Pro',
    review: 'Each tool appears only when both its data contract and the user entitlement are available.',
    limits: 'This preview contains no protected values and does not unlock a tool or plan.',
    expectedResult: 'Connected timelines, source comparison, watchlists, alerts, exports, and team workflows.',
  },
  'shell-mode': {
    label: 'About Simple and Advanced',
    what: 'Simple and Advanced change information density and presentation.',
    source: 'Your device stores the reading preference.',
    filedUnder: 'Display preference · Reading mode',
    review: 'Both modes must preserve the same facts, sources, uncertainty, and corrections.',
    limits: 'Changing the layout never changes your plan, location grant, data access, or coverage.',
  },
} as const satisfies Record<string, InfoNoteDefinition>;

export type InfoNoteId = keyof typeof INFO_NOTES;
let infoNoteInstance = 0;

interface PinnedInfoNote {
  wrapper: HTMLDivElement;
  close: () => void;
}

const pinnedInfoNotes = new WeakMap<Document, PinnedInfoNote>();
const listeningDocuments = new WeakSet<Document>();

/**
 * One outside-pointer listener per document coordinates every rendered note.
 * Shell rerenders therefore cannot accumulate one permanent listener per note.
 */
function ensureOutsideDismiss(documentRef: Document): void {
  if (listeningDocuments.has(documentRef)) return;
  listeningDocuments.add(documentRef);
  documentRef.addEventListener('pointerdown', (event) => {
    const pinned = pinnedInfoNotes.get(documentRef);
    if (!pinned) return;
    if (!pinned.wrapper.isConnected) {
      pinnedInfoNotes.delete(documentRef);
      return;
    }
    if (event.target instanceof Node && pinned.wrapper.contains(event.target)) return;
    pinned.close();
  });
}

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

function row(label: string, value: string): HTMLDivElement {
  return el('div', { class: 'gw-info-row' }, [
    el('dt', {}, [label]),
    el('dd', {}, [value]),
  ]);
}

/** Render one accessible hover, focus, click, and touch explanation control. */
export function renderInfoNote(id: InfoNoteId): HTMLDivElement {
  ensureInfoNoteStyle();
  ensureOutsideDismiss(document);
  const note: InfoNoteDefinition = INFO_NOTES[id];
  const panelId = `gw-info-panel-${id}-${++infoNoteInstance}`;
  const trigger = el('button', {
    type: 'button',
    class: 'gw-info-trigger',
    'aria-label': note.label,
    'aria-expanded': 'false',
    'aria-controls': panelId,
    'data-info-note': id,
  }, ['?']);
  const rows = [
    row('What this is', note.what),
    row('Filled from', note.source),
    row('Filed under', note.filedUnder),
    row('Review and updates', note.review),
    row('Limits', note.limits),
  ];
  if (note.expectedResult) rows.push(row('Expected result', note.expectedResult));
  const panel = el('aside', {
    id: panelId,
    class: 'gw-info-panel',
    role: 'note',
    'aria-label': note.label,
    hidden: 'hidden',
  }, [
    el('div', { class: 'gw-info-heading' }, [
      el('strong', {}, [note.label]),
      el('button', {
        type: 'button',
        class: 'gw-info-close',
        'aria-label': `Close ${note.label}`,
      }, ['×']),
    ]),
    el('dl', {}, rows),
  ]);
  const wrapper = el('div', { class: 'gw-info-note' }, [trigger, panel]);
  const closeButton = panel.querySelector<HTMLButtonElement>('.gw-info-close')!;
  let suppressFocusOpen = false;
  let pinnedOpen = false;

  const setOpen = (open: boolean, restoreFocus = false): void => {
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.toggleAttribute('hidden', !open);
    wrapper.toggleAttribute('data-open', open);
    if (!open && restoreFocus) trigger.focus();
  };
  const open = (): void => setOpen(true);
  const close = (restoreFocus = false): void => setOpen(false, restoreFocus);
  const closePinned = (restoreFocus = false): void => {
    pinnedOpen = false;
    wrapper.removeAttribute('data-pinned');
    if (pinnedInfoNotes.get(document)?.wrapper === wrapper) {
      pinnedInfoNotes.delete(document);
    }
    close(restoreFocus);
  };

  trigger.addEventListener('click', () => {
    if (pinnedOpen) {
      closePinned();
    } else {
      pinnedInfoNotes.get(document)?.close();
      pinnedOpen = true;
      wrapper.setAttribute('data-pinned', '');
      pinnedInfoNotes.set(document, { wrapper, close: closePinned });
      open();
    }
  });
  trigger.addEventListener('mouseenter', open);
  trigger.addEventListener('focus', () => {
    if (!suppressFocusOpen) open();
  });
  wrapper.addEventListener('mouseleave', () => {
    if (!pinnedOpen) close();
  });
  wrapper.addEventListener('focusout', (event) => {
    const destination = event.relatedTarget;
    if (
      !pinnedOpen
      && (!(destination instanceof Node) || !wrapper.contains(destination))
    ) close();
  });
  wrapper.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closePinned();
    if (document.activeElement !== trigger) {
      suppressFocusOpen = true;
      trigger.focus();
      suppressFocusOpen = false;
    }
  });
  closeButton.addEventListener('click', () => {
    closePinned();
    if (document.activeElement !== trigger) {
      suppressFocusOpen = true;
      trigger.focus();
      suppressFocusOpen = false;
    }
  });

  return wrapper;
}

export const INFO_NOTE_STYLE = `
.gw-info-note{position:relative;display:inline-flex;align-items:center;vertical-align:middle;flex:none}
.gw-info-trigger,.gw-info-close{appearance:none;display:inline-flex;align-items:center;justify-content:center;cursor:help;color:var(--gw-info-text);background:var(--gw-tone-info-well);border:var(--gw-border-w) solid var(--gw-tone-info-line)}
.gw-info-trigger{width:28px;height:28px;border-radius:50%;font:800 14px/1 var(--gw-font)}
.gw-info-trigger:hover,.gw-info-trigger:focus-visible,.gw-info-trigger[aria-expanded="true"]{color:var(--gw-accent-text-on);background:var(--gw-accent);border-color:var(--gw-accent);outline:2px solid var(--gw-accent);outline-offset:2px}
.gw-info-panel{position:absolute;z-index:100;top:calc(100% + 9px);right:0;width:min(390px,calc(100vw - 28px));max-height:min(70vh,520px);overflow:auto;padding:14px;color:var(--gw-text);background:var(--gw-surface);border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius-lg);box-shadow:0 16px 44px rgba(0,0,0,.24);font:400 13px/1.45 var(--gw-font);text-align:left}
.gw-info-panel[hidden]{display:none}
.gw-info-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:10px;font-size:14px}
.gw-info-close{width:32px;height:32px;flex:none;border-radius:50%;font:700 20px/1 var(--gw-font);cursor:pointer}
.gw-info-panel dl{display:grid;gap:10px;margin:0}
.gw-info-row{display:grid;gap:2px}
.gw-info-row dt{color:var(--gw-text-muted);font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.gw-info-row dd{margin:0;color:var(--gw-text-secondary)}
@media (max-width:600px){
  .gw-info-trigger{width:var(--gw-tap-min);height:var(--gw-tap-min)}
  .gw-info-close{width:var(--gw-tap-min);height:var(--gw-tap-min)}
  .gw-info-note[data-pinned] .gw-info-panel{position:fixed;z-index:1000;left:10px;right:10px;top:auto;bottom:calc(10px + env(safe-area-inset-bottom));width:auto;max-height:min(72vh,620px);border-radius:16px}
}
@media (prefers-reduced-motion:reduce){
  .gw-info-panel{scroll-behavior:auto}
}`;

const INFO_NOTE_STYLE_ID = 'gw-info-note-style';
function ensureInfoNoteStyle(): void {
  if (document.getElementById(INFO_NOTE_STYLE_ID)) return;
  document.head.append(el('style', { id: INFO_NOTE_STYLE_ID }, [INFO_NOTE_STYLE]));
}
