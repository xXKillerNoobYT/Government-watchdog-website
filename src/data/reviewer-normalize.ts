/**
 * Strict wire normalizer for the reviewer-internal serving lane.
 *
 * This is deliberately narrower than the general `ReadApiResponse` type. The
 * same-origin endpoint has one accepted wire contract:
 *
 *     { "reviewer_internal_records": [ ... ] }
 *
 * A successful normalization returns one detached, deeply frozen read model.
 * Nothing is coerced, defaulted, or inferred from an invalid value.
 */

import type {
  EvidenceLink,
  ProducedBy,
  ProvenanceStatus,
  PublicationState,
  ReadApiResponse,
  StatementRecord,
  UiStatus,
  VerificationStatus,
} from '../types/read-api';
import { assertWebSafe } from './web-safe';

export interface ReviewerInternalEnvelope {
  reviewer_internal_records: unknown[];
}

export class ReviewerNormalizationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ReviewerNormalizationError';
  }
}

const UI_STATUSES = new Set<UiStatus>([
  'do-not-publish',
  'disputed',
  'source-missing',
  'source-changed',
  'corrected',
  'needs-clarification',
  'unverified',
  'pending-review',
  'archived-source-backed',
  'source-backed',
]);

const VERIFICATION_STATUSES = new Set<VerificationStatus>([
  'source_recorded',
  'machine_extracted_unreviewed',
  'reviewed_source_linked',
  'human_verified',
  'disputed',
  'do_not_publish',
]);

const PROVENANCE_STATUSES = new Set<ProvenanceStatus>(['grounded', 'unverified']);
const PUBLICATION_STATES = new Set<PublicationState>(['not_publishable', 'publishable']);
const PRODUCERS = new Set<ProducedBy>(['automation', 'ai', 'human']);

const EVIDENCE_STRING_FIELDS = [
  'to_source_id',
  'relation',
  'locator_kind',
  'source_type',
  'published_by',
  'jurisdiction',
  'source_date',
  'timestamp_human',
  'section',
  'paragraph',
  'archive_status',
  'scan_date',
  'last_validated_utc',
  'confidence',
  'correction_status',
  'layer',
  'from_node_id',
  'from_node_type',
] as const;

const EVIDENCE_NUMBER_FIELDS = ['timestamp_seconds', 'page'] as const;
const EVIDENCE_URL_FIELDS = ['original_url', 'archive_url', 'final_url', 'url'] as const;

const RECORD_STRING_FIELDS = [
  'statement_text',
  'layer',
  'confidence',
  'updates_statement_id',
  'agenda_item_id',
  'confidence_label',
  'speaker_label',
  'correction_status',
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function fail(path: string, expectation: string): never {
  throw new ReviewerNormalizationError(`${path} ${expectation}`);
}

function assertPlainObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) fail(path, 'must be a plain object');
}

function assertNullableEnum<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  path: string,
): void {
  if (value !== undefined && value !== null && (typeof value !== 'string' || !allowed.has(value as T))) {
    fail(path, `must be null or one of: ${[...allowed].join(', ')}`);
  }
}

function assertOptionalStringArray(value: unknown, path: string): void {
  if (value === undefined || value === null) return;
  if (!Array.isArray(value)) fail(path, 'must be null or an array');
  value.forEach((entry, index) => {
    if (typeof entry !== 'string') fail(`${path}[${index}]`, 'must be a string');
  });
}

function assertOptionalString(
  value: unknown,
  path: string,
): asserts value is string | null | undefined {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    fail(path, 'must be null or a string');
  }
}

function assertOptionalFiniteNumber(value: unknown, path: string): void {
  if (
    value !== undefined
    && value !== null
    && (typeof value !== 'number' || !Number.isFinite(value))
  ) {
    fail(path, 'must be null or a finite number');
  }
}

function assertOptionalBooleanFlag(value: unknown, path: string): void {
  if (
    value !== undefined
    && value !== null
    && value !== true
    && value !== false
    && value !== 0
    && value !== 1
  ) {
    fail(path, 'must be null, a boolean, 0, or 1');
  }
}

function assertOptionalPublicUrl(value: unknown, path: string): void {
  assertOptionalString(value, path);
  if (value === undefined || value === null) return;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail(path, 'must be an absolute http(s) URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    fail(path, 'must use http or https');
  }
}

function assertJsonTree(value: unknown, path: string): void {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))
  ) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJsonTree(entry, `${path}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      assertJsonTree(child, `${path}.${key}`);
    }
    return;
  }
  fail(path, 'must contain JSON values and plain objects only');
}

function assertEvidence(value: unknown, recordPath: string): void {
  if (!Array.isArray(value)) fail(`${recordPath}.evidence`, 'must be an array');
  value.forEach((entry, evidenceIndex) => {
    const path = `${recordPath}.evidence[${evidenceIndex}]`;
    assertPlainObject(entry, path);
    for (const field of EVIDENCE_STRING_FIELDS) {
      assertOptionalString(entry[field], `${path}.${field}`);
    }
    for (const field of EVIDENCE_NUMBER_FIELDS) {
      assertOptionalFiniteNumber(entry[field], `${path}.${field}`);
    }
    for (const field of EVIDENCE_URL_FIELDS) {
      assertOptionalPublicUrl(entry[field], `${path}.${field}`);
    }
    assertOptionalBooleanFlag(entry.is_verbatim, `${path}.is_verbatim`);
    assertNullableEnum(entry.verification_status, VERIFICATION_STATUSES, `${path}.verification_status`);
    assertOptionalStringArray(entry.related_concepts, `${path}.related_concepts`);
  });
}

function assertRecord(value: unknown, index: number, ids: Set<string>): void {
  const path = `reviewer_internal_records[${index}]`;
  assertPlainObject(value, path);

  if (typeof value.statement_id !== 'string' || value.statement_id.trim().length === 0) {
    fail(`${path}.statement_id`, 'must be a nonempty string');
  }
  if (ids.has(value.statement_id)) {
    fail(`${path}.statement_id`, `must be unique (duplicate ${JSON.stringify(value.statement_id)})`);
  }
  ids.add(value.statement_id);

  for (const field of RECORD_STRING_FIELDS) {
    assertOptionalString(value[field], `${path}.${field}`);
  }
  assertOptionalBooleanFlag(value.is_verbatim, `${path}.is_verbatim`);
  assertOptionalBooleanFlag(value.source_changed, `${path}.source_changed`);
  assertEvidence(value.evidence, path);
  assertNullableEnum(value.ui_status, UI_STATUSES, `${path}.ui_status`);
  assertNullableEnum(
    value.verification_status,
    VERIFICATION_STATUSES,
    `${path}.verification_status`,
  );
  assertNullableEnum(
    value.provenance_status,
    PROVENANCE_STATUSES,
    `${path}.provenance_status`,
  );
  assertNullableEnum(
    value.publication_state,
    PUBLICATION_STATES,
    `${path}.publication_state`,
  );
  assertNullableEnum(value.produced_by, PRODUCERS, `${path}.produced_by`);
}

function cloneJson<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => cloneJson(entry)) as T;
  if (isPlainObject(value)) {
    const clone: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      Object.defineProperty(clone, key, {
        configurable: true,
        enumerable: true,
        value: cloneJson(child),
        writable: true,
      });
    }
    return clone as T;
  }
  return value;
}

function copyPresentFields(
  source: Record<string, unknown>,
  destination: Record<string, unknown>,
  fields: readonly string[],
): void {
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(source, field)) continue;
    Object.defineProperty(destination, field, {
      configurable: true,
      enumerable: true,
      value: cloneJson(source[field]),
      writable: true,
    });
  }
}

function projectEvidence(value: unknown): EvidenceLink {
  // Validation has already established this exact shape before projection.
  const source = value as Record<string, unknown>;
  const projected: Record<string, unknown> = {};
  copyPresentFields(source, projected, [
    ...EVIDENCE_STRING_FIELDS,
    ...EVIDENCE_NUMBER_FIELDS,
    ...EVIDENCE_URL_FIELDS,
    'is_verbatim',
    'verification_status',
    'related_concepts',
  ]);
  return projected as EvidenceLink;
}

function projectRecord(value: unknown): StatementRecord {
  // Validation has already established the required id and evidence array.
  const source = value as Record<string, unknown>;
  const projected: Record<string, unknown> = {
    statement_id: source.statement_id,
    evidence: (source.evidence as unknown[]).map(projectEvidence),
  };
  copyPresentFields(source, projected, [
    ...RECORD_STRING_FIELDS,
    'is_verbatim',
    'source_changed',
    'ui_status',
    'verification_status',
    'provenance_status',
    'publication_state',
    'produced_by',
  ]);
  return projected as unknown as StatementRecord;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * Shallow contract predicate retained for the legacy data client. Strict
 * validation happens in {@link normalizeReviewerInternalEnvelope}.
 */
export function isReviewerInternalEnvelope(body: unknown): body is ReviewerInternalEnvelope {
  return (
    isPlainObject(body)
    && Object.keys(body).length === 1
    && Object.prototype.hasOwnProperty.call(body, 'reviewer_internal_records')
    && Array.isArray(body.reviewer_internal_records)
  );
}

/**
 * Validate, detach, and freeze the reviewer-internal response.
 *
 * The returned object has exactly the read surface the canonical routes share:
 * Alpine endpoint scope, reviewer-internal access, and only the documented
 * web-safe record/evidence allowlist. Unknown server fields are deliberately
 * discarded before the shared browser state is created.
 */
export function normalizeReviewerInternalEnvelope(body: unknown): ReadApiResponse {
  if (!isReviewerInternalEnvelope(body)) {
    throw new ReviewerNormalizationError(
      'response must be exactly { reviewer_internal_records: [...] }',
    );
  }

  assertJsonTree(body, 'response');
  assertWebSafe(body);

  const ids = new Set<string>();
  body.reviewer_internal_records.forEach((record, index) => assertRecord(record, index, ids));

  const detachedRecords = body.reviewer_internal_records.map(projectRecord);
  const model: ReadApiResponse = {
    scope: 'alpine',
    access: 'reviewer_internal',
    records: detachedRecords as ReadApiResponse['records'],
  };
  return deepFreeze(model);
}

/** Compatibility name for the pre-context data client. */
export function toReadModel(envelope: ReviewerInternalEnvelope): ReadApiResponse {
  return normalizeReviewerInternalEnvelope(envelope);
}
