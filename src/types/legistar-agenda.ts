export interface LegistarAttachment {
  name: string;
  url: string;
}

export interface LegistarAgendaItem {
  eventItemId: number;
  agendaNumber: string;
  sequence: number;
  section: string;
  title: string;
  matterFile?: string;
  matterType?: string;
  attachments: LegistarAttachment[];
}

export interface LegistarAgenda {
  bodyName: string;
  meetingDate: string | null;
  meetingTime: string | null;
  location: string | null;
  sourceUrl: string;
  agendaPdfUrl: string | null;
  minutesPdfUrl: string | null;
  capturedAtUtc: string;
  items: LegistarAgendaItem[];
  gaps: string[];
}
