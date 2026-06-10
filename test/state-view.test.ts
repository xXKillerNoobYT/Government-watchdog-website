import { describe, it, expect } from 'vitest';
import { stateView, trustLabel, isAiProduced, FIXTURE_BANNER_TEXT } from '../src/ui/state-view';
import { idle, loading, failed, resolved } from '../src/state/async-state';
import { isEmptyResponse, FIXTURE } from '../src/data/client';
import type { ReadApiResponse, StatementRecord } from '../src/types/read-api';

const empty: ReadApiResponse = { scope: 'alpine', access: 'reviewer_internal', records: [] };

describe('stateView (BEH-STATE primitives)', () => {
  it('maps idle/loading to a loading view', () => {
    expect(stateView(idle<ReadApiResponse>()).kind).toBe('loading');
    expect(stateView(loading<ReadApiResponse>('fixture')).kind).toBe('loading');
  });

  it('maps an empty resolve to the empty view', () => {
    const v = stateView(resolved(empty, 'fixture', isEmptyResponse));
    expect(v.kind).toBe('empty');
    expect(v.showFixtureBanner).toBe(true);
  });

  it('maps a failure to the error view with the message', () => {
    const v = stateView(failed<ReadApiResponse>(new Error('boom')));
    expect(v.kind).toBe('error');
    expect(v.message).toContain('boom');
  });

  it('maps a populated resolve to the ready view', () => {
    const v = stateView(resolved(FIXTURE, 'fixture', isEmptyResponse));
    expect(v.kind).toBe('ready');
    expect(v.message).toMatch(/record/);
  });

  it('shows the fixture banner only in fixture mode', () => {
    expect(stateView(resolved(FIXTURE, 'live', isEmptyResponse)).showFixtureBanner).toBe(false);
    expect(stateView(resolved(FIXTURE, 'fixture', isEmptyResponse)).showFixtureBanner).toBe(true);
  });
});

describe('trust + AI labels (never recomputed / never hidden)', () => {
  it('maps backend ui_status verbatim to a human label', () => {
    expect(trustLabel({ statement_id: 's', ui_status: 'source-backed', evidence: [] })).toBe('Source-backed');
    expect(trustLabel({ statement_id: 's', ui_status: 'archived-source-backed', evidence: [] })).toBe('Source-backed (archived)');
    expect(trustLabel({ statement_id: 's', ui_status: 'corrected', evidence: [] })).toBe('Corrected');
  });

  it('flags AI-produced records for the locked/visible AI label', () => {
    const ai: StatementRecord = { statement_id: 's', produced_by: 'ai', evidence: [] };
    const human: StatementRecord = { statement_id: 's', produced_by: 'human', evidence: [] };
    expect(isAiProduced(ai)).toBe(true);
    expect(isAiProduced(human)).toBe(false);
  });

  it('exposes the exact fixture banner text', () => {
    expect(FIXTURE_BANNER_TEXT).toBe('FIXTURE MODE — Not real data');
  });
});
