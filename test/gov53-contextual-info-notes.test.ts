import { describe, expect, it } from 'vitest';
import {
  INFO_NOTES,
  type InfoNoteDefinition,
} from '../src/ui/info-note';
import { PRIVATE_INFO_NOTES } from '../src/ui/private-info-note-definitions';

const REQUIRED_TEXT_FIELDS = [
  'label',
  'what',
  'source',
  'filedUnder',
  'review',
  'lifecycle',
  'limits',
  'expectedResult',
] as const;

const METHOD_FIELDS = [
  'version',
  'inputs',
  'exclusions',
  'denominator',
  'cadence',
  'missingData',
] as const;

const REQUIRED_METHOD_NOTES = [
  'home-summary',
  'home-honesty-metrics',
  'timeline-date-basis',
  'timeline-map',
  'vault-source-count',
  'vault-verification',
  'power-score',
  'location-coverage',
  'alerts-read-state',
  'alerts-tracking',
] as const;

function expectCompleteRegistry(
  registry: Readonly<Record<string, InfoNoteDefinition>>,
): void {
  const labels: string[] = [];
  for (const [id, note] of Object.entries(registry)) {
    expect(id.trim(), `${id}: registry id`).not.toBe('');
    for (const field of REQUIRED_TEXT_FIELDS) {
      expect(
        typeof note[field] === 'string' ? note[field]!.trim() : '',
        `${id}: ${field}`,
      ).not.toBe('');
    }
    expect(note.lifecycle, `${id}: lifecycle convention`).toMatch(/^Current state:/);
    labels.push(note.label);
    if (!note.method) continue;
    for (const field of METHOD_FIELDS) {
      expect(note.method[field].trim(), `${id}: method.${field}`).not.toBe('');
    }
  }
  expect(new Set(labels).size, 'registered accessible labels must be unique').toBe(labels.length);
}

describe('GOV-53 contextual information-note registry', () => {
  it('keeps every public definition complete and uniquely labelled', () => {
    expect(Object.keys(INFO_NOTES).length).toBeGreaterThanOrEqual(10);
    expectCompleteRegistry(INFO_NOTES);
  });

  it('keeps every private definition complete and uniquely labelled', () => {
    expect(Object.keys(PRIVATE_INFO_NOTES).length).toBeGreaterThanOrEqual(98);
    expectCompleteRegistry(PRIVATE_INFO_NOTES);
  });

  it('requires auditable methods for every current high-risk calculation', () => {
    for (const id of REQUIRED_METHOD_NOTES) {
      const note = PRIVATE_INFO_NOTES[id];
      expect(note.method, `${id}: method`).toBeTruthy();
      for (const field of METHOD_FIELDS) {
        expect(note.method?.[field].trim(), `${id}: method.${field}`).not.toBe('');
      }
    }
  });

  it('keeps public and private static accessible labels distinct', () => {
    const publicLabels = new Set<string>(Object.values(INFO_NOTES).map((note) => note.label));
    for (const [id, note] of Object.entries(PRIVATE_INFO_NOTES)) {
      expect(publicLabels.has(note.label), id).toBe(false);
    }
  });
});
