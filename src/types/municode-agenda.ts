/** Parsed structure for a saved Municode accessible HTML agenda document. */

export interface MunicodeAttachment {
  name: string;
  url: string;
  sizeMb?: string;
}

export interface MunicodeAgendaItem {
  letter: string;
  title: string;
  description?: string;
  attachments: MunicodeAttachment[];
}

export interface MunicodeAgendaSection {
  number: number;
  title: string;
  presenter?: string;
  items: MunicodeAgendaItem[];
}

export interface MunicodeAgenda {
  meetingTitle: string;
  /** Full `YYYY-MM-DD` when the header supplies it; otherwise `null` (explicit gap). */
  meetingDate: string | null;
  /**
   * Regular-meeting clock from the header when line one names one;
   * otherwise the first clock time on line two. `null` when neither is present.
   */
  meetingTime: string | null;
  /** Executive-session clock named in the header, when line one states one. */
  executiveSessionTime: string | null;
  location: string | null;
  sourceUrl: string;
  sections: MunicodeAgendaSection[];
  /** Human-readable gaps when required fields are absent from the capture. */
  gaps: string[];
}
