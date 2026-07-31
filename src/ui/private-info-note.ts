/**
 * Reviewer/private-beta information-note definitions.
 *
 * Keep these definitions out of `info-note.ts`: that module is intentionally in
 * the anonymous Free build graph. Only the interaction primitive is shared.
 */

import {
  renderDefinedInfoNote,
  type InfoNoteRenderOptions,
} from './info-note';
import {
  PRIVATE_INFO_NOTES,
  type PrivateInfoNoteId,
} from './private-info-note-definitions';

export {
  PRIVATE_INFO_NOTES,
  type PrivateInfoNoteId,
} from './private-info-note-definitions';

export function renderPrivateInfoNote(
  id: PrivateInfoNoteId,
  options: InfoNoteRenderOptions = {},
): HTMLDivElement {
  return renderDefinedInfoNote(id, PRIVATE_INFO_NOTES[id], options);
}

/**
 * Structured private placeholder explanation. Callers must provide the exact
 * missing projection and end result; this prevents a polished empty card from
 * silently becoming a generic "coming soon" promise.
 */
export interface PrivateUnavailableInfoNote {
  id: string;
  title: string;
  what: string;
  source: string;
  filedUnder: string;
  review?: string;
  lifecycle?: string;
  limits?: string;
  expectedResult: string;
}

export function renderPrivateUnavailableInfoNote(
  definition: PrivateUnavailableInfoNote,
): HTMLDivElement {
  return renderDefinedInfoNote(`private-gap-${definition.id}`, {
    label: `About ${definition.title}`,
    what: definition.what,
    source: definition.source,
    filedUnder: definition.filedUnder,
    review: definition.review
      ?? 'The slot remains unavailable until the server contract, authorization, review policy, and safe output fields are approved.',
    lifecycle: definition.lifecycle ?? 'Current state: planned or incomplete; this is an explanatory placeholder.',
    limits: definition.limits
      ?? 'The placeholder contains no civic result, score, entitlement, coverage decision, subscription, or release-date promise.',
    expectedResult: definition.expectedResult,
  });
}

/** Minimal structural type avoids a circular import from reviewer-context-state. */
export interface PrivateProjectionInfoNote {
  id: string;
  title: string;
  whatItDoes: string;
  requiredProjection: string;
  howItWorks: string;
  expectedResult: string;
  filedUnder: string;
}

export function renderPrivateProjectionInfoNote(
  definition: PrivateProjectionInfoNote,
): HTMLDivElement {
  return renderDefinedInfoNote(`private-projection-${definition.id}`, {
    label: `How ${definition.title} is filed`,
    what: definition.whatItDoes,
    source: definition.requiredProjection,
    filedUnder: definition.filedUnder,
    review: definition.howItWorks,
    lifecycle: 'Current state: designed gap. The required backend projection is not available to this route.',
    limits: 'This explanation is not a record, result, entitlement, coverage claim, subscription, or release-date promise.',
    expectedResult: definition.expectedResult,
  });
}

