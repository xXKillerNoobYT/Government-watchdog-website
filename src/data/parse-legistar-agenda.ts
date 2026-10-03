import type {
  LegistarAgenda,
  LegistarAgendaItem,
  LegistarAttachment,
} from '../types/legistar-agenda';

type UnknownRecord = Record<string, unknown>;

const NUMBERED_AGENDA_ITEM = /^\d+\.$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?)?$/;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
}

function trimmedUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalUrl(value: unknown): string | null {
  const url = trimmedUrl(value);
  return url || null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function optionalText(value: unknown): string | undefined {
  const text = normalizeText(value);
  return text || undefined;
}

function parseMeetingDate(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  const match = raw.match(ISO_DATE);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonth[month - 1]) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function pushGap(gaps: string[], gap: string): void {
  if (!gaps.includes(gap)) gaps.push(gap);
}

function parseAttachments(value: unknown): LegistarAttachment[] {
  if (!Array.isArray(value)) return [];
  const attachments = value.map((entry, index) => {
    const record = isRecord(entry) ? entry : {};
    return {
      index,
      sort: finiteNumber(record.MatterAttachmentSort),
      attachment: {
        name: normalizeText(record.MatterAttachmentName),
        url: trimmedUrl(record.MatterAttachmentHyperlink),
      },
    };
  });

  if (attachments.some((entry) => entry.sort !== null)) {
    attachments.sort((left, right) => {
      if (left.sort === null && right.sort === null) return left.index - right.index;
      if (left.sort === null) return 1;
      if (right.sort === null) return -1;
      return left.sort - right.sort || left.index - right.index;
    });
  }

  return attachments.map((entry) => entry.attachment);
}

function parseItems(eventItems: unknown, gaps: string[]): LegistarAgendaItem[] {
  if (!Array.isArray(eventItems)) {
    pushGap(gaps, 'Legistar event items are missing or invalid.');
    return [];
  }

  const sequenced: Array<{ record: UnknownRecord; sequence: number; index: number }> = [];
  eventItems.forEach((entry, index) => {
    if (!isRecord(entry)) return;
    const agendaNumber = normalizeText(entry.EventItemAgendaNumber);
    const sequence = finiteNumber(entry.EventItemAgendaSequence);
    if (sequence === null) {
      if (NUMBERED_AGENDA_ITEM.test(agendaNumber)) {
        pushGap(gaps, `Agenda item ${agendaNumber} has no finite agenda sequence.`);
      }
      return;
    }
    sequenced.push({ record: entry, sequence, index });
  });

  sequenced.sort((left, right) => left.sequence - right.sequence || left.index - right.index);

  const items: LegistarAgendaItem[] = [];
  let section = '';
  for (const { record, sequence } of sequenced) {
    const agendaNumber = normalizeText(record.EventItemAgendaNumber);
    const title = normalizeText(record.EventItemTitle);
    if (!NUMBERED_AGENDA_ITEM.test(agendaNumber)) {
      if (title) section = title;
      continue;
    }

    if (!title) {
      pushGap(gaps, `Agenda item ${agendaNumber} is missing a title.`);
      continue;
    }
    const eventItemId = finiteNumber(record.EventItemId);
    if (eventItemId === null) {
      pushGap(gaps, `Agenda item ${agendaNumber} is missing a finite EventItemId.`);
      continue;
    }
    if (!section) {
      pushGap(gaps, `Agenda item ${agendaNumber} has no preceding section header.`);
    }

    items.push({
      eventItemId,
      agendaNumber,
      sequence,
      section,
      title,
      ...(optionalText(record.EventItemMatterFile) ? {
        matterFile: optionalText(record.EventItemMatterFile),
      } : {}),
      ...(optionalText(record.EventItemMatterType) ? {
        matterType: optionalText(record.EventItemMatterType),
      } : {}),
      attachments: parseAttachments(record.EventItemMatterAttachments),
    });
  }

  return items;
}

export function parseLegistarAgenda(
  event: unknown,
  eventItems: unknown,
  capturedAtUtc: string,
): LegistarAgenda {
  const record = isRecord(event) ? event : {};
  const gaps: string[] = [];
  const bodyName = normalizeText(record.EventBodyName);
  const meetingDate = parseMeetingDate(record.EventDate);
  const meetingTime = optionalText(record.EventTime) ?? null;
  const location = optionalText(record.EventLocation) ?? null;
  const sourceUrl = trimmedUrl(record.EventInSiteURL);
  const agendaPdfUrl = optionalUrl(record.EventAgendaFile);
  const minutesPdfUrl = optionalUrl(record.EventMinutesFile);

  if (!bodyName) pushGap(gaps, 'Meeting body name missing from Legistar event.');
  if (!meetingDate) pushGap(gaps, 'Meeting date missing or invalid in Legistar event.');
  if (!meetingTime) pushGap(gaps, 'Meeting time missing from Legistar event.');
  if (!location) pushGap(gaps, 'Meeting location missing from Legistar event.');
  if (!sourceUrl) pushGap(gaps, 'Meeting source URL missing from Legistar event.');
  if (!agendaPdfUrl) pushGap(gaps, 'Agenda PDF URL missing from Legistar event.');
  if (!minutesPdfUrl) pushGap(gaps, 'Minutes not yet published in the capture');

  const items = parseItems(eventItems, gaps);
  return {
    bodyName,
    meetingDate,
    meetingTime,
    location,
    sourceUrl,
    agendaPdfUrl,
    minutesPdfUrl,
    capturedAtUtc,
    items,
    gaps,
  };
}
