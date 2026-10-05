// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseMunicodeAgenda } from '../src/data/parse-municode-agenda';
import { mapMunicodeAgendaToKanbanLanes } from '../src/ui/map-municode-agenda-kanban';
import { SOURCE_SNAPSHOT_CARD_LABEL } from '../src/ui/source-snapshot';
import {
  ALPINE_APR21_2026_MUNICODE_SHA256,
  ALPINE_APR21_2026_MUNICODE_URL,
  ALPINE_OCT6_2026_MUNICODE_SHA256,
  ALPINE_OCT6_2026_MUNICODE_URL,
} from '../src/data/municode-alpine-fixture';
import alpineAgendaHtml from '../test/fixtures/municode/alpine-town-council-2026-04-21.html?raw';
import alpineOct6Html from '../test/fixtures/municode/alpine-town-council-2026-10-06.html?raw';
import alpineOct6Parsed from '../src/fixtures/municode/alpine-town-council-2026-10-06.parsed.json';
import { safeExternalHref } from '../src/data/web-safe';

const EXPECTED_SECTIONS = [
  'CALL TO ORDER',
  'ADOPT THE AGENDA',
  'EXECUTIVE SESSION',
  'RECONVENE INTO REGULAR SESSION',
  'PLEDGE OF ALLEGIANCE',
  'ROLL CALL',
  'CONSENT AGENDA',
  'REPORTS',
  'PUBLIC HEARINGS',
  'ACTION ITEMS',
  'TABLED ITEMS',
  'PUBLIC COMMENT',
  'EXECUTIVE SESSION',
  'ADJOURNMENT',
];

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('Municode agenda parser and Kanban mapper', () => {
  it('uses the committed Apr 21, 2026 fixture bytes', async () => {
    expect(await sha256(alpineAgendaHtml)).toBe(ALPINE_APR21_2026_MUNICODE_SHA256);
  });

  it('parses the real Alpine fixture into sections, items, and meeting metadata', () => {
    const agenda = parseMunicodeAgenda(alpineAgendaHtml, ALPINE_APR21_2026_MUNICODE_URL);

    expect(agenda.meetingTitle).toBe(
      'Town Council Meeting – Executive Session at 6:00 PM | Regular Session at 7:00 PM',
    );
    expect(agenda.meetingDate).toBe('2026-04-21');
    expect(agenda.meetingTime).toBe('06:00 PM');
    expect(agenda.executiveSessionTime).toBe('6:00 PM');
    expect(agenda.location).toBe('250 River Circle - Alpine, WY 83128');
    expect(agenda.sections).toHaveLength(14);
    expect(agenda.sections.map((section) => section.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ]);
    expect(agenda.sections.map((section) => section.title)).toEqual(EXPECTED_SECTIONS);

    const itemCounts = Object.fromEntries(
      agenda.sections.map((section) => [section.number, section.items.length]),
    );
    expect(itemCounts).toEqual({
      1: 0, 2: 0, 3: 1, 4: 0, 5: 0, 6: 0, 7: 8, 8: 9, 9: 2, 10: 17, 11: 1, 12: 0, 13: 1, 14: 0,
    });

    const attachmentTotal = agenda.sections
      .flatMap((section) => section.items)
      .reduce((sum, item) => sum + item.attachments.length, 0);
    expect(attachmentTotal).toBe(63);

    const section7a = agenda.sections.find((section) => section.number === 7)?.items[0];
    expect(section7a?.title).toBe('Town Council Minutes: March 17, 2026 Town Council Meeting Minutes.');
    expect(section7a?.attachments).toHaveLength(1);

    const section10q = agenda.sections.find((section) => section.number === 10)
      ?.items.find((item) => item.letter === 'q');
    expect(section10q?.title).toBe('Alpine Well #4 Transmission Pipeline 2026 Project Agreement:');
  });

  it('maps parsed items onto posted/packet lanes with source links and empty hearing/voted lanes', () => {
    const agenda = parseMunicodeAgenda(alpineAgendaHtml, ALPINE_APR21_2026_MUNICODE_URL);
    const lanes = mapMunicodeAgendaToKanbanLanes(agenda);
    expect(lanes.map((lane) => lane.id)).toEqual(['posted', 'packet', 'hearing', 'voted']);

    const posted = lanes.find((lane) => lane.id === 'posted')?.cards ?? [];
    const packet = lanes.find((lane) => lane.id === 'packet')?.cards ?? [];
    expect(posted.length + packet.length).toBe(39);
    expect(lanes.find((lane) => lane.id === 'hearing')?.cards).toEqual([]);
    expect(lanes.find((lane) => lane.id === 'voted')?.cards).toEqual([]);

    const ids = [...posted, ...packet].map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const card of [...posted, ...packet]) {
      expect(card.flags?.[0]).toBe(SOURCE_SNAPSHOT_CARD_LABEL);
      expect(card.last).toBeUndefined();
      expect(card.next).toBeUndefined();
      expect(card.actions?.length).toBeGreaterThanOrEqual(1);
      const link = card.actions?.[0];
      expect(link?.getAttribute('href')).toBe(ALPINE_APR21_2026_MUNICODE_URL);
      const whenLine = card.actions?.find((node) =>
        node.getAttribute('data-test') === 'kanban-card-snapshot-when');
      const executive = card.area?.endsWith('EXECUTIVE SESSION') ?? false;
      expect(whenLine?.textContent).toMatch(
        executive ? /Snapshot:.* · 6:00 PM$/ : /Snapshot:.* · 06:00 PM$/,
      );
    }
  });

  it('uses the Oct 6, 2026 regular-meeting clock and keeps the executive session separate', () => {
    const html = `<!DOCTYPE html><html><body>
      <div class="header-content">
        <span class="header-content__h1 h1-line-one">Town Council Meeting – Executive Session at 6:00 PM; Regular Meeting at 7:00 PM</span>
        <span class="header-content__h1 h1-line-two">Tuesday, October 06, 2026 06:00 PM</span>
        <span class="header-content__h1 h1-line-three">250 River Circle - Alpine, WY 83128</span>
      </div>
    </body></html>`;
    const agenda = parseMunicodeAgenda(html, ALPINE_OCT6_2026_MUNICODE_URL);
    expect(agenda.meetingDate).toBe('2026-10-06');
    expect(agenda.meetingTime).toBe('7:00 PM');
    expect(agenda.executiveSessionTime).toBe('6:00 PM');
    expect(agenda.gaps).toEqual([]);
  });

  it('falls back to line two when line one has no regular-meeting time', () => {
    const html = `<!DOCTYPE html><html><body>
      <div class="header-content">
        <span class="header-content__h1 h1-line-one">Town Council Meeting – Executive Session at 6:00 PM | Regular Session at 7:00 PM</span>
        <span class="header-content__h1 h1-line-two">Tuesday, April 21, 2026 06:00 PM</span>
        <span class="header-content__h1 h1-line-three">250 River Circle - Alpine, WY 83128</span>
      </div>
    </body></html>`;
    const agenda = parseMunicodeAgenda(html, ALPINE_APR21_2026_MUNICODE_URL);
    expect(agenda.meetingTime).toBe('06:00 PM');
    expect(agenda.executiveSessionTime).toBe('6:00 PM');
  });

  it('parses the Oct 6 packet into 14 cards with suggested motions and split clocks', async () => {
    expect(await sha256(alpineOct6Html)).toBe(ALPINE_OCT6_2026_MUNICODE_SHA256);
    const agenda = parseMunicodeAgenda(alpineOct6Html, ALPINE_OCT6_2026_MUNICODE_URL);
    expect(JSON.parse(JSON.stringify(agenda))).toEqual(alpineOct6Parsed);
    expect(agenda.meetingTime).toBe('7:00 PM');
    expect(agenda.executiveSessionTime).toBe('6:00 PM');

    const motions: Record<string, string> = {
      '10a': 'Motion to approve Resolution No. 2026-036',
      '10b': 'Motion to authorize staff to submit an out-of-cycle application',
      '10c': 'increasing the total authorized amount from $20,000 to $23,500',
      '11a': 'amend the water fund capital outlays budget by $30,000',
    };
    for (const [key, phrase] of Object.entries(motions)) {
      const sectionNumber = Number(key.slice(0, -1));
      const letter = key.slice(-1);
      const item = agenda.sections.find((section) => section.number === sectionNumber)
        ?.items.find((entry) => entry.letter === letter);
      expect(item?.description?.startsWith('Suggested Motion:')).toBe(true);
      expect(item?.description).toContain(phrase);
    }

    const lanes = mapMunicodeAgendaToKanbanLanes(agenda);
    const cards = lanes.flatMap((lane) => lane.cards);
    expect(cards).toHaveLength(14);
    expect(lanes.find((lane) => lane.id === 'hearing')?.cards).toEqual([]);
    expect(lanes.find((lane) => lane.id === 'voted')?.cards).toEqual([]);

    const executive = cards.find((card) => card.id === 'alpine-2026-10-06-s2-a');
    expect(executive?.when).toBe('Tue, Oct 6, 2026 · 6:00 PM');
    for (const card of cards) {
      expect(card.flags?.[0]).toBe(SOURCE_SNAPSHOT_CARD_LABEL);
      expect(card.actions?.[0]?.getAttribute('href')).toBe(ALPINE_OCT6_2026_MUNICODE_URL);
      expect(card.actions?.[0]?.getAttribute('href')).not.toContain('#');
      if (card.id === 'alpine-2026-10-06-s2-a') continue;
      expect(card.when).toBe('Tue, Oct 6, 2026 · 7:00 PM');
    }
  });

  it('handles missing headers, empty sections, and refuses javascript: attachment hrefs', () => {
    const html = `<!DOCTYPE html><html><body>
      <div class="ap-agenda">
        <section class="agenda-section">
          <h2 class="section-header"><div class="Section0"><p><num>1.</num><span style="font-weight:bold;">EMPTY SECTION</span></p></div></h2>
        </section>
        <section class="agenda-section">
          <h2 class="section-header"><div class="Section0"><p><num>2.</num><span style="font-weight:bold;">WITH ITEM</span></p></div></h2>
          <ol class="agenda-items">
            <li><div class="Section0"><p><num>a.</num><span>No attachments here.</span></p></div></li>
            <ul class="agenda_item_attachments"><li><a href="javascript:alert(1)">bad.pdf</a> (0.01 MB)</li></ul>
          </ol>
        </section>
      </div>
    </body></html>`;

    const agenda = parseMunicodeAgenda(html, 'https://meetings.municode.com/adaHtmlDocument/index?cc=ALPINEWY');
    expect(agenda.meetingTitle).toBe('');
    expect(agenda.meetingDate).toBeNull();
    expect(agenda.gaps.length).toBeGreaterThan(0);
    expect(agenda.sections[0]?.items).toEqual([]);

    const lanes = mapMunicodeAgendaToKanbanLanes(agenda);
    const card = lanes.find((lane) => lane.id === 'packet')?.cards[0];
    expect(card?.title).toBe('No attachments here.');
    expect(card?.actions?.[0]?.getAttribute('href')).toBe(
      'https://meetings.municode.com/adaHtmlDocument/index?cc=ALPINEWY',
    );

    const badAttachment = agenda.sections[1]?.items[0]?.attachments[0];
    expect(badAttachment?.url).toBe('javascript:alert(1)');
    expect(safeExternalHref(badAttachment?.url ?? '')).toBeNull();
  });
});
