import { describe, expect, it } from 'vitest';
import {
  normalizeReviewerInternalEnvelope,
  ReviewerNormalizationError,
} from '../src/data/reviewer-normalize';

function record(statementId = 'statement-1'): Record<string, unknown> {
  return {
    statement_id: statementId,
    statement_text: 'The council called the meeting to order.',
    ui_status: 'source-backed',
    verification_status: 'reviewed_source_linked',
    provenance_status: 'grounded',
    publication_state: 'publishable',
    produced_by: 'human',
    evidence: [{
      to_source_id: 'source-1',
      verification_status: 'source_recorded',
      related_concepts: ['meeting'],
    }],
  };
}

describe('normalizeReviewerInternalEnvelope', () => {
  it('accepts only the reviewer-internal envelope and creates the fixed read model', () => {
    const model = normalizeReviewerInternalEnvelope({
      reviewer_internal_records: [record()],
    });
    expect(model).toEqual({
      scope: 'alpine',
      access: 'reviewer_internal',
      records: [record()],
    });

    expect(() => normalizeReviewerInternalEnvelope({ records: [record()] }))
      .toThrow(ReviewerNormalizationError);
    expect(() => normalizeReviewerInternalEnvelope({
      reviewer_internal_records: [record()],
      scope: 'alpine',
    })).toThrow(/exactly/);
  });

  it('requires plain objects and JSON-only nested values', () => {
    const nonPlain = Object.create({ inherited: true }) as Record<string, unknown>;
    nonPlain.reviewer_internal_records = [record()];
    expect(() => normalizeReviewerInternalEnvelope(nonPlain)).toThrow(/exactly/);

    const withDate = record();
    withDate.future_metadata = { captured: new Date() };
    expect(() => normalizeReviewerInternalEnvelope({
      reviewer_internal_records: [withDate],
    })).toThrow(/JSON values and plain objects/);
  });

  it('requires nonempty unique statement ids without coercion', () => {
    expect(() => normalizeReviewerInternalEnvelope({
      reviewer_internal_records: [record('   ')],
    })).toThrow(/nonempty string/);
    expect(() => normalizeReviewerInternalEnvelope({
      reviewer_internal_records: [record('7'), record('7')],
    })).toThrow(/must be unique/);

    const numericId = record();
    numericId.statement_id = 7;
    expect(() => normalizeReviewerInternalEnvelope({
      reviewer_internal_records: [numericId],
    })).toThrow(/nonempty string/);
  });

  it.each([
    ['ui_status', 'trusted'],
    ['verification_status', 'verified'],
    ['provenance_status', 'partly-grounded'],
    ['publication_state', 'public'],
    ['produced_by', 'reviewer'],
  ])('rejects an unknown %s value rather than coercing it', (field, badValue) => {
    const invalid = record();
    invalid[field] = badValue;
    expect(() => normalizeReviewerInternalEnvelope({
      reviewer_internal_records: [invalid],
    })).toThrow(new RegExp(field));
  });

  it('validates record and evidence arrays plus evidence verification enums', () => {
    const missingEvidence = record();
    delete missingEvidence.evidence;
    expect(() => normalizeReviewerInternalEnvelope({
      reviewer_internal_records: [missingEvidence],
    })).toThrow(/evidence must be an array/);

    const badEvidence = record();
    badEvidence.evidence = [{ verification_status: 'verified' }];
    expect(() => normalizeReviewerInternalEnvelope({
      reviewer_internal_records: [badEvidence],
    })).toThrow(/evidence\[0\]\.verification_status/);

    const badRelated = record();
    badRelated.evidence = [{ related_concepts: 'meeting' }];
    expect(() => normalizeReviewerInternalEnvelope({
      reviewer_internal_records: [badRelated],
    })).toThrow(/related_concepts must be null or an array/);
  });

  it('rejects render-unsafe record and evidence field types', () => {
    const badStatement = record();
    badStatement.statement_text = { nested: 'not text' };
    expect(() => normalizeReviewerInternalEnvelope({
      reviewer_internal_records: [badStatement],
    })).toThrow(/statement_text must be null or a string/);

    const badSection = record();
    badSection.evidence = [{ section: ['not', 'text'] }];
    expect(() => normalizeReviewerInternalEnvelope({
      reviewer_internal_records: [badSection],
    })).toThrow(/evidence\[0\]\.section must be null or a string/);

    const badPage = record();
    badPage.evidence = [{ page: 'seven' }];
    expect(() => normalizeReviewerInternalEnvelope({
      reviewer_internal_records: [badPage],
    })).toThrow(/evidence\[0\]\.page must be null or a finite number/);

    const badFlag = record();
    badFlag.source_changed = 2;
    expect(() => normalizeReviewerInternalEnvelope({
      reviewer_internal_records: [badFlag],
    })).toThrow(/source_changed must be null, a boolean, 0, or 1/);
  });

  it('accepts only absolute http(s) receipt links', () => {
    for (const unsafeUrl of [
      'javascript:alert(1)',
      'data:text/html,unsafe',
      '//evil.example/source',
      '/relative/source',
      'not a url',
    ]) {
      const unsafe = record();
      unsafe.evidence = [{ original_url: unsafeUrl }];
      expect(() => normalizeReviewerInternalEnvelope({
        reviewer_internal_records: [unsafe],
      }), unsafeUrl).toThrow(
        /absolute http\(s\) URL|must use http or https|absolute\/filesystem path/,
      );
    }

    const safe = record();
    safe.evidence = [{
      original_url: 'https://records.example/source',
      archive_url: 'http://archive.example/source',
    }];
    expect(() => normalizeReviewerInternalEnvelope({
      reviewer_internal_records: [safe],
    })).not.toThrow();
  });

  it('runs the web-safe sweep before returning any civic data', () => {
    const unsafe = record();
    unsafe.evidence = [{ original_url: '/Users/reviewer/private/source.pdf' }];
    expect(() => normalizeReviewerInternalEnvelope({
      reviewer_internal_records: [unsafe],
    })).toThrow(/absolute\/filesystem path/);
  });

  it('returns a detached frozen allowlist and strips unknown record or evidence fields', () => {
    const sourceRecord = record();
    sourceRecord.future_metadata = { labels: ['new-server-field'] };
    (sourceRecord.evidence as Record<string, unknown>[])[0].internal_future_note = 'private';
    const body = { reviewer_internal_records: [sourceRecord] };
    const model = normalizeReviewerInternalEnvelope(body);
    const normalized = model.records?.[0] as unknown as Record<string, unknown>;
    const normalizedEvidence = model.records?.[0]?.evidence[0] as unknown as Record<string, unknown>;

    expect(model.records).not.toBe(body.reviewer_internal_records);
    expect(normalized).not.toBe(sourceRecord);
    expect(normalized.future_metadata).toBeUndefined();
    expect(normalizedEvidence.internal_future_note).toBeUndefined();
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.records)).toBe(true);
    expect(Object.isFrozen(model.records?.[0]?.evidence[0])).toBe(true);

    sourceRecord.statement_text = 'mutated after normalization';
    expect(model.records?.[0]?.statement_text).toBe('The council called the meeting to order.');
    expect(() => {
      model.records?.push(record('statement-2') as never);
    }).toThrow(TypeError);
  });
});
