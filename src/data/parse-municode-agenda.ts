import type {
  MunicodeAgenda,
  MunicodeAgendaItem,
  MunicodeAgendaSection,
  MunicodeAttachment,
} from '../types/municode-agenda';

const MONTHS: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseMeetingDate(lineTwo: string): string | null {
  const match = lineTwo.match(
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\w+)\s+(\d{1,2}),\s+(\d{4})/i,
  );
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  const day = match[2].padStart(2, '0');
  return `${match[3]}-${month}-${day}`;
}

function clockTime(value: string): string | null {
  const match = value.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
  return match ? normalizeText(match[1]) : null;
}

function labeledClock(line: string, label: string): string | null {
  const match = line.match(new RegExp(`${label}\\s+at\\s+(\\d{1,2}:\\d{2}\\s*[AP]M)`, 'i'));
  return match ? normalizeText(match[1]) : null;
}

/**
 * Meeting clock from the header.
 * A "Regular Meeting at <time>" on line one wins. Line two is only the fallback.
 * An "Executive Session at <time>" on line one is stored separately and is not the meeting time.
 */
function parseMeetingTime(lineOne: string, lineTwo: string): {
  meetingTime: string | null;
  executiveSessionTime: string | null;
} {
  const regularMeetingTime = labeledClock(lineOne, 'Regular Meeting');
  return {
    meetingTime: regularMeetingTime ?? clockTime(lineTwo),
    executiveSessionTime: labeledClock(lineOne, 'Executive Session'),
  };
}

function sectionHeaderParagraph(section: Element): HTMLParagraphElement | null {
  const header = section.querySelector(':scope > h2.section-header');
  if (!header) return null;
  return header.querySelector('p');
}

function parseSectionNumber(paragraph: HTMLParagraphElement): number | null {
  const num = paragraph.querySelector('num');
  if (!num) return null;
  const match = normalizeText(num.textContent ?? '').match(/^(\d+)\.$/);
  if (!match) return null;
  return Number(match[1]);
}

function parseSectionTitle(paragraph: HTMLParagraphElement): string {
  const bold = paragraph.querySelector('span[style*="font-weight:bold"], span[style*="font-weight: bold"]');
  if (bold) return normalizeText(bold.textContent ?? '');
  const spans = [...paragraph.querySelectorAll('span')];
  for (const span of spans) {
    const text = normalizeText(span.textContent ?? '');
    if (text) return text;
  }
  return normalizeText(paragraph.textContent ?? '');
}

function parseSectionPresenter(paragraph: HTMLParagraphElement, title: string): string | undefined {
  const spans = [...paragraph.querySelectorAll('span')];
  for (const span of spans) {
    const text = normalizeText(span.textContent ?? '');
    if (!text || text === title) continue;
    const presenter = text.replace(/^[-–—]\s*/, '').trim();
    if (presenter) return presenter;
  }
  return undefined;
}

function parseItemTitle(itemLi: HTMLLIElement): { letter: string; title: string; description?: string } | null {
  const paragraphs = [...itemLi.querySelectorAll('p')];
  const paragraph = paragraphs[0];
  if (!paragraph) return null;
  const num = paragraph.querySelector('num');
  const letterMatch = normalizeText(num?.textContent ?? '').match(/^([a-z])\.$/i);
  if (!letterMatch) return null;
  const spans = [...paragraph.querySelectorAll('span')];
  const titleSpan = spans.find((span) => normalizeText(span.textContent ?? '').length > 0);
  const title = normalizeText(titleSpan?.textContent ?? paragraph.textContent ?? '');
  if (!title) return null;
  const description = paragraphs
    .slice(1)
    .map((extra) => normalizeText(extra.textContent ?? ''))
    .filter((text) => text.length > 0)
    .join(' ');
  return {
    letter: letterMatch[1].toLowerCase(),
    title,
    ...(description ? { description } : {}),
  };
}

function parseAttachments(attachmentList: HTMLUListElement): MunicodeAttachment[] {
  const attachments: MunicodeAttachment[] = [];
  for (const li of attachmentList.querySelectorAll(':scope > li')) {
    const anchor = li.querySelector('a[href]');
    if (!anchor) continue;
    const url = anchor.getAttribute('href') ?? '';
    const name = normalizeText(anchor.textContent ?? '');
    const sizeMatch = normalizeText(li.textContent ?? '').match(/\(([\d.]+)\s*MB\)/i);
    attachments.push({
      name: name || url,
      url,
      sizeMb: sizeMatch?.[1],
    });
  }
  return attachments;
}

function parseSectionItems(section: Element): MunicodeAgendaItem[] {
  const list = section.querySelector(':scope > ol.agenda-items');
  if (!list) return [];
  const items: MunicodeAgendaItem[] = [];
  let current: MunicodeAgendaItem | null = null;
  for (const child of list.children) {
    if (child.tagName === 'LI') {
      const parsed = parseItemTitle(child as HTMLLIElement);
      if (!parsed) continue;
      current = {
        letter: parsed.letter,
        title: parsed.title,
        ...(parsed.description ? { description: parsed.description } : {}),
        attachments: [],
      };
      items.push(current);
      continue;
    }
    if (child.tagName === 'UL' && child.classList.contains('agenda_item_attachments') && current) {
      current.attachments.push(...parseAttachments(child as HTMLUListElement));
    }
  }
  return items;
}

function parseSections(root: ParentNode): MunicodeAgendaSection[] {
  const sections: MunicodeAgendaSection[] = [];
  for (const section of root.querySelectorAll('div.ap-agenda > section.agenda-section')) {
    const paragraph = sectionHeaderParagraph(section);
    if (!paragraph) continue;
    const number = parseSectionNumber(paragraph);
    if (number === null) continue;
    const title = parseSectionTitle(paragraph);
    if (!title) continue;
    sections.push({
      number,
      title,
      presenter: parseSectionPresenter(paragraph, title),
      items: parseSectionItems(section),
    });
  }
  return sections;
}

/** Parse saved Municode agenda HTML into a typed model (offline, no network). */
export function parseMunicodeAgenda(html: string, sourceUrl: string): MunicodeAgenda {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const gaps: string[] = [];
  const lineOne = doc.querySelector('.header-content .h1-line-one');
  const lineTwo = doc.querySelector('.header-content .h1-line-two');
  const lineThree = doc.querySelector('.header-content .h1-line-three');

  const lineOneText = normalizeText(lineOne?.textContent ?? '');
  const lineTwoText = normalizeText(lineTwo?.textContent ?? '');
  const meetingTitle = lineOneText;
  if (!meetingTitle) gaps.push('Meeting title missing from agenda header.');

  const meetingDate = lineTwoText ? parseMeetingDate(lineTwoText) : null;
  if (!meetingDate) gaps.push('Meeting date missing or not parseable to YYYY-MM-DD.');

  const { meetingTime, executiveSessionTime } = parseMeetingTime(lineOneText, lineTwoText);
  const location = lineThree ? normalizeText(lineThree.textContent ?? '') : null;
  if (!location) gaps.push('Meeting location missing from agenda header.');

  return {
    meetingTitle,
    meetingDate,
    meetingTime,
    executiveSessionTime,
    location,
    sourceUrl,
    sections: parseSections(doc),
    gaps,
  };
}
