/**
 * Reviewer/private-beta information-note definitions.
 *
 * Keep these definitions out of `info-note.ts`: that module is intentionally in
 * the anonymous Free build graph. Only the interaction primitive is shared.
 */

import {
  renderDefinedInfoNote,
  type InfoNoteDefinition,
} from './info-note';

export const PRIVATE_INFO_NOTES = {
  'shell-notifications': {
    label: 'About account notifications',
    what: 'These messages report beta-account workflow changes such as access, cohort, or email-consent updates.',
    source: 'The admitted browser session requests a same-origin, session-scoped notification endpoint.',
    filedUnder: 'Account workflow · Notifications',
    review: 'The server writes and counts these account events; the browser validates the response before showing it.',
    limits: 'These are not civic Alerts. A denial, 404, outage, or invalid response means unavailable—not proof that no real events exist—and live mode never substitutes a sample.',
    expectedResult: 'A validated server list and server unread count, or a zero-badge unavailable explanation.',
  },
} as const satisfies Record<string, InfoNoteDefinition>;

export type PrivateInfoNoteId = keyof typeof PRIVATE_INFO_NOTES;

export function renderPrivateInfoNote(id: PrivateInfoNoteId): HTMLDivElement {
  return renderDefinedInfoNote(id, PRIVATE_INFO_NOTES[id]);
}
