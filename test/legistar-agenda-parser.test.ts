// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SANDY_SEP29_2026_LEGISTAR_CAPTURED_AT_UTC,
  SANDY_SEP29_2026_LEGISTAR_EVENT_SHA256,
  SANDY_SEP29_2026_LEGISTAR_EVENT_URL,
  SANDY_SEP29_2026_LEGISTAR_EVENTITEMS_SHA256,
} from '../src/data/legistar-sandy-fixture';
import { parseLegistarAgenda } from '../src/data/parse-legistar-agenda';
import { assertWebSafe, safeExternalHref } from '../src/data/web-safe';
import parsedAgenda from '../src/fixtures/legistar/sandy-city-council-2026-09-29.parsed.json';
import { mapLegistarAgendaToKanbanLanes } from '../src/ui/map-legistar-agenda-kanban';
import { SOURCE_SNAPSHOT_CARD_LABEL } from '../src/ui/source-snapshot';

const eventBytes = readFileSync(
  'test/fixtures/legistar/sandy-city-council-2026-09-29.event.json',
);
const eventItemsBytes = readFileSync(
  'test/fixtures/legistar/sandy-city-council-2026-09-29.eventitems.json',
);
const event: unknown = JSON.parse(eventBytes.toString('utf8'));
const eventItems: unknown = JSON.parse(eventItemsBytes.toString('utf8'));

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function freshAgenda() {
  return parseLegistarAgenda(
    event,
    eventItems,
    SANDY_SEP29_2026_LEGISTAR_CAPTURED_AT_UTC,
  );
}

describe('Legistar agenda parser and Kanban mapper', () => {
  it('pins the exact saved fixture bytes', () => {
    expect(sha256(eventBytes)).toBe(SANDY_SEP29_2026_LEGISTAR_EVENT_SHA256);
    expect(sha256(eventItemsBytes)).toBe(SANDY_SEP29_2026_LEGISTAR_EVENTITEMS_SHA256);
  });

  it('parses the saved meeting metadata and the seven numbered agenda items', () => {
    const agenda = freshAgenda();
    expect(agenda.meetingDate).toBe('2026-09-29');
    expect(agenda.meetingTime).toBe('5:15 PM');
    expect(agenda.location).toBe('Council Chambers');
    expect(agenda.minutesPdfUrl).toBeNull();
    expect(agenda.sourceUrl).toBe(SANDY_SEP29_2026_LEGISTAR_EVENT_URL);
    expect(agenda.items.map((item) => item.agendaNumber)).toEqual([
      '1.', '2.', '3.', '4.', '5.', '6.', '7.',
    ]);
    expect(agenda.items.some((item) => item.agendaNumber === '5:15')).toBe(false);
    expect(agenda.items.map((item) => item.section)).toEqual([
      'Informational Items',
      'Informational Items',
      'Consent Calendar',
      'Consent Calendar',
      'Consent Calendar',
      'Council Voting Items',
      'Council Voting Items',
    ]);
  });

  it('preserves attachment counts and the exact item 6 title', () => {
    const agenda = freshAgenda();
    const counts = agenda.items.map((item) => item.attachments.length);
    expect(counts).toEqual([0, 2, 1, 1, 1, 5, 0]);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(10);
    expect(agenda.items[5]?.title).toBe(
      'Amendments to Title 21 of the Land Development Code related to Building Height',
    );
  });

  it('maps source-only cards into posted and packet lanes', () => {
    const lanes = mapLegistarAgendaToKanbanLanes(freshAgenda());
    expect(lanes.map((lane) => lane.id)).toEqual(['posted', 'packet', 'hearing', 'voted']);
    expect(lanes.map((lane) => lane.cards.length)).toEqual([2, 5, 0, 0]);
    const cards = lanes.flatMap((lane) => lane.cards);
    expect(new Set(cards.map((card) => card.id)).size).toBe(7);

    for (const card of cards) {
      expect(card.flags?.[0]).toBe(SOURCE_SNAPSHOT_CARD_LABEL);
      expect(card.actions?.[0]?.getAttribute('href')).toBe(SANDY_SEP29_2026_LEGISTAR_EVENT_URL);
      expect(card.actions?.find((action) =>
        action.getAttribute('data-test') === 'kanban-card-snapshot-when')?.textContent,
      ).toMatch(/Snapshot:.*Sep 29, 2026.*5:15 PM/);
      expect(card.actions?.find((action) =>
        action.getAttribute('data-test') === 'kanban-card-captured-at')?.textContent,
      ).toMatch(/Captured:.*Oct 1, 2026.*8:21 AM.*MDT/);
      expect(card.last).toBeUndefined();
      expect(card.next).toBeUndefined();
    }
  });

  it('keeps hostile attachment URLs as source data but refuses them as links', () => {
    const hostile = parseLegistarAgenda({
      EventBodyName: 'City Council',
      EventDate: '2026-02-31T00:00:00',
      EventTime: '5:15 PM',
      EventLocation: 'Council Chambers',
      EventInSiteURL: SANDY_SEP29_2026_LEGISTAR_EVENT_URL,
      EventAgendaFile: 'https://example.test/agenda.pdf',
      EventMinutesFile: null,
    }, [
      { EventItemAgendaSequence: 1, EventItemAgendaNumber: '', EventItemTitle: 'Section' },
      {
        EventItemId: 1,
        EventItemAgendaSequence: 2,
        EventItemAgendaNumber: '1.',
        EventItemTitle: 'Hostile attachment',
        EventItemMatterAttachments: [{
          MatterAttachmentName: 'Unsafe',
          MatterAttachmentHyperlink: 'javascript:alert(1)',
        }],
      },
    ], SANDY_SEP29_2026_LEGISTAR_CAPTURED_AT_UTC);

    expect(hostile.meetingDate).toBeNull();
    expect(hostile.gaps).toContain('Meeting date missing or invalid in Legistar event.');
    expect(hostile.items[0]?.attachments[0]?.url).toBe('javascript:alert(1)');
    expect(safeExternalHref(hostile.items[0]?.attachments[0]?.url)).toBeNull();
  });

  it('keeps the committed runtime JSON synchronized and web-safe', () => {
    expect(freshAgenda()).toEqual(parsedAgenda);
    expect(assertWebSafe(parsedAgenda)).toEqual(parsedAgenda);
  });
});
