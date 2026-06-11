import { describe, it, expect } from 'vitest';
import { trustLegend, LEGEND_TITLE } from '../src/ui/legend';
import { uiStatusLabel, statusTone, AI_LABEL_TEXT, FIXTURE_BANNER_TEXT } from '../src/ui/state-view';
import { ALL_UI_STATUSES } from '../src/types/read-api';

describe('trustLegend — explains every label exactly once', () => {
  const legend = trustLegend();

  it('has one entry per UiStatus, plus the AI label and the fixture banner', () => {
    expect(legend.length).toBe(ALL_UI_STATUSES.length + 2);
  });

  it('covers every backend UiStatus value (exhaustive)', () => {
    const statusKeys = new Set(legend.filter((e) => !e.meta).map((e) => e.key));
    for (const s of ALL_UI_STATUSES) {
      expect(statusKeys.has(`status-${s}`)).toBe(true);
    }
  });

  it('uses the verbatim label text for each status (no paraphrase drift)', () => {
    for (const s of ALL_UI_STATUSES) {
      const entry = legend.find((e) => e.key === `status-${s}`)!;
      expect(entry.label).toBe(uiStatusLabel(s));
      expect(entry.tone).toBe(statusTone(s));
      expect(entry.meaning.trim().length).toBeGreaterThan(0);
    }
  });

  it('includes the locked AI label and the fixture-mode banner with meanings', () => {
    const ai = legend.find((e) => e.key === 'ai')!;
    expect(ai.label).toBe(AI_LABEL_TEXT);
    expect(ai.meta).toBe(true);
    expect(ai.meaning.trim().length).toBeGreaterThan(0);

    const fixture = legend.find((e) => e.key === 'fixture')!;
    expect(fixture.label).toBe(FIXTURE_BANNER_TEXT);
    expect(fixture.meta).toBe(true);
  });

  it('exposes a reviewer-facing title', () => {
    expect(LEGEND_TITLE.trim().length).toBeGreaterThan(0);
  });
});

describe('uiStatusLabel / statusTone — full 10-state coverage', () => {
  it('never falls through to the raw kebab wire form', () => {
    for (const s of ALL_UI_STATUSES) {
      // A human label differs from the raw kebab value for every state here.
      expect(uiStatusLabel(s)).not.toBe(s);
    }
  });

  it('marks the hard-stop states with the "stop" tone', () => {
    for (const s of ['disputed', 'do-not-publish', 'source-missing', 'source-changed'] as const) {
      expect(statusTone(s)).toBe('stop');
    }
  });

  it('marks source-backed states "ok" and provisional states "caution"', () => {
    expect(statusTone('source-backed')).toBe('ok');
    expect(statusTone('archived-source-backed')).toBe('ok');
    expect(statusTone('pending-review')).toBe('caution');
    expect(statusTone('unverified')).toBe('caution');
    expect(statusTone('corrected')).toBe('neutral');
  });
});
