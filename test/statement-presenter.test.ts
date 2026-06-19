import { describe, it, expect } from 'vitest';
import {
  edgeTypeLabel,
  relatedLinksFor,
  drawerFields,
  verificationStatusLabel,
  correctionStatusLabel,
  locatorText,
  verbatimLabel,
  confidenceLabel,
  speakerLabel,
  locatorKindLabel,
} from '../src/ui/statement-presenter';
import { RAW_PATH_FORBIDDEN_KEYS } from '../src/data/web-safe';
import type { StatementRecord, EvidenceLink, ConceptEdge, AgendaItemMember, ConfidenceLabel } from '../src/types/read-api';
import { CONSERVATIVE_CONFIDENCE_LABEL } from '../src/types/read-api';

describe('edgeTypeLabel (typed links — never untyped "related", BEH-AGENDA-2)', () => {
  it('maps the lifecycle edge types to explicit labels', () => {
    expect(edgeTypeLabel('agenda_item_supersedes')).toBe('Supersedes');
    expect(edgeTypeLabel('agenda_item_amends')).toBe('Amends');
    expect(edgeTypeLabel('agenda_item_revisits')).toBe('Revisits');
  });

  it('never collapses an unknown edge type to the word "related"', () => {
    const label = edgeTypeLabel('agenda_item_clarifies' as never);
    expect(label.toLowerCase()).not.toBe('related');
    expect(label).toBe('Clarifies'); // still derived from the backend type
  });
});

describe('relatedLinksFor (matched by agenda_item_id, labeled from edge_type)', () => {
  const members: AgendaItemMember[] = [
    { agenda_item_id: 'item-a', title: 'First reading' },
    { agenda_item_id: 'item-b', title: 'Adoption' },
  ];
  const edges: ConceptEdge[] = [
    { edge_type: 'agenda_item_supersedes', from_node_id: 'item-b', to_node_id: 'item-a', from_node_type: 'agenda_item' },
  ];

  it('renders an outgoing typed link with the resolved target title', () => {
    const rec: StatementRecord = { statement_id: 's', agenda_item_id: 'item-b', evidence: [] };
    const links = relatedLinksFor(rec, edges, members);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ label: 'Supersedes', direction: 'out', targetId: 'item-a', targetTitle: 'First reading' });
  });

  it('renders the reverse edge as an incoming link', () => {
    const rec: StatementRecord = { statement_id: 's', agenda_item_id: 'item-a', evidence: [] };
    const links = relatedLinksFor(rec, edges, members);
    expect(links[0]).toMatchObject({ label: 'Supersedes', direction: 'in', targetTitle: 'Adoption' });
  });

  it('returns nothing when the card has no agenda item or no edges touch it', () => {
    expect(relatedLinksFor({ statement_id: 's', evidence: [] }, edges, members)).toEqual([]);
    expect(relatedLinksFor({ statement_id: 's', agenda_item_id: 'item-z', evidence: [] }, edges, members)).toEqual([]);
  });
});

describe('drawerFields (1.06 §6 — present-only, archive always, note never)', () => {
  const full: EvidenceLink = {
    to_source_id: 'sample_minutes_2019_07',
    source_type: 'Meeting minutes',
    published_by: 'Town of Alpine Clerk',
    jurisdiction: 'Alpine, WY',
    source_date: '2019-07-09',
    original_url: 'https://records.example/a.html',
    archive_url: 'https://web.archive.org/web/2019/https://records.example/a.html',
    scan_date: '2019-07-10',
    section: 'Item 7',
    paragraph: '2',
    verification_status: 'human_verified',
    correction_status: 'corrected',
    related_concepts: ['fireworks rules', 'public safety'],
  };

  it('emits the present 1.06 §6 fields with their labels', () => {
    const keys = drawerFields(full).map((f) => f.key);
    expect(keys).toEqual([
      'source_type',
      'published_by',
      'jurisdiction',
      'source_date',
      'original_url',
      'archive_url',
      'scan_date',
      'to_source_id',
      'locator',
      'verification_status',
      'correction_status',
      'related_concepts',
    ]);
  });

  it('renders the safe source registry id, never a raw/local path', () => {
    const id = drawerFields(full).find((f) => f.key === 'to_source_id');
    expect(id?.value).toBe('sample_minutes_2019_07');
    expect(id?.value).not.toMatch(/^\/|:\\|Vault|transcript_path/);
  });

  it('ALWAYS shows the archive row — "Archive not available" when the URL is missing', () => {
    const broken: EvidenceLink = { to_source_id: 's', original_url: 'https://x/y.pdf', archive_status: 'unavailable' };
    const archive = drawerFields(broken).find((f) => f.key === 'archive_url');
    expect(archive).toBeDefined();
    expect(archive?.kind).toBe('text');
    expect(archive?.value).toBe('Archive not available');
  });

  it('never emits a reviewer-note field (field 12 stripped at transport)', () => {
    // Even if a denylisted note key sneaks onto the row, drawerFields has no
    // accessor for it, so it cannot project into the drawer.
    const withNote = { ...full, note: 'internal reviewer remark', notes: 'x' } as EvidenceLink & Record<string, unknown>;
    const keys = drawerFields(withNote).map((f) => f.key);
    for (const forbidden of RAW_PATH_FORBIDDEN_KEYS) expect(keys).not.toContain(forbidden);
    expect(keys).not.toContain('reviewer_note');
  });

  it('composes a public-citable locator from allowlisted parts only', () => {
    expect(locatorText({ page: 5, section: 'Item 2', paragraph: '3' })).toBe('p.5 · Item 2 · ¶ 3');
    expect(locatorText({})).toBeUndefined();
  });
});

describe('verbatim status labels (verbatim, never recomputed)', () => {
  it('maps verification status to human copy', () => {
    expect(verificationStatusLabel('machine_extracted_unreviewed')).toBe('Machine-extracted — unreviewed');
    expect(verificationStatusLabel('human_verified')).toBe('Human-verified');
    expect(verificationStatusLabel(undefined)).toBeUndefined();
  });

  it('maps correction status, treating "none" as no corrections', () => {
    expect(correctionStatusLabel('none')).toBe('No corrections');
    expect(correctionStatusLabel('corrected')).toBe('Corrected');
    expect(correctionStatusLabel(null)).toBeUndefined();
  });

  it('labels AI provenance distinctly from human facts', () => {
    expect(verbatimLabel({ statement_id: 's', produced_by: 'ai', is_verbatim: 0, evidence: [] })).toBe('AI — paraphrased');
    expect(verbatimLabel({ statement_id: 's', produced_by: 'human', is_verbatim: 1, evidence: [] })).toBe('Verbatim quote');
  });
});

describe('confidenceLabel (GOV-283 — verbatim mapping, never recomputed)', () => {
  const rec = (confidence_label?: ConfidenceLabel | null): StatementRecord => ({
    statement_id: 's',
    confidence_label,
    evidence: [],
  });

  it('maps every SSOT confidence-label value to human copy', () => {
    expect(confidenceLabel(rec('source_anchored_timed'))).toBe('Source-anchored (timed transcript)');
    expect(confidenceLabel(rec('auto_caption_timed'))).toBe('Auto-caption (timed)');
    expect(confidenceLabel(rec('auto_caption_untimed'))).toBe('Auto-caption (untimed)');
    expect(confidenceLabel(rec('minutes_summary'))).toBe('Minutes summary');
    expect(confidenceLabel(rec('derived_summary'))).toBe('Derived summary');
  });

  it('maps the backend fail-closed conservative default', () => {
    // Pins that the conservative value the backend collapses to is renderable —
    // the frontend never shows a higher confidence than was sent.
    expect(confidenceLabel(rec(CONSERVATIVE_CONFIDENCE_LABEL))).toBe('Auto-caption (untimed)');
  });

  it('renders an unforeseen future value rather than dropping it', () => {
    expect(confidenceLabel(rec('official_signed_record' as ConfidenceLabel))).toBe('Official signed record');
  });

  it('returns undefined when absent/blank — never invents a confidence', () => {
    expect(confidenceLabel(rec(undefined))).toBeUndefined();
    expect(confidenceLabel(rec(null))).toBeUndefined();
    expect(confidenceLabel(rec('' as ConfidenceLabel))).toBeUndefined();
  });
});

describe('speakerLabel (GOV-290 — verbatim pass-through, never derived)', () => {
  const rec = (speaker_label?: string | null): StatementRecord => ({
    statement_id: 's',
    speaker_label,
    evidence: [],
  });

  it('surfaces the safe generic / community / approved-name labels verbatim', () => {
    expect(speakerLabel(rec('Meeting Attendee'))).toBe('Meeting Attendee');
    expect(speakerLabel(rec('Community Member'))).toBe('Community Member');
    expect(speakerLabel(rec('Jane Doe, Mayor'))).toBe('Jane Doe, Mayor');
  });

  it('returns undefined when absent/blank — never resolves or infers a speaker', () => {
    expect(speakerLabel(rec(undefined))).toBeUndefined();
    expect(speakerLabel(rec(null))).toBeUndefined();
    expect(speakerLabel(rec('   '))).toBeUndefined();
  });
});

describe('locatorKindLabel + drawer citation pointer (GOV-293 exact-source trail)', () => {
  it('names the exact-source pointer kind', () => {
    expect(locatorKindLabel('char_span')).toBe('Character span (exact source text)');
    expect(locatorKindLabel('timestamp')).toBe('Transcript timestamp');
    expect(locatorKindLabel('page')).toBe('Page');
    expect(locatorKindLabel(undefined)).toBeUndefined();
    expect(locatorKindLabel('')).toBeUndefined();
  });

  it('emits a "Citation pointer" drawer field right after the locator when present', () => {
    const e: EvidenceLink = { to_source_id: 's', locator_kind: 'char_span', page: 3 };
    const fields = drawerFields(e);
    const keys = fields.map((f) => f.key);
    expect(keys).toContain('locator_kind');
    // ordered immediately after the composed locator (field 9 → 9b)
    expect(keys.indexOf('locator_kind')).toBe(keys.indexOf('locator') + 1);
    expect(fields.find((f) => f.key === 'locator_kind')?.value).toBe('Character span (exact source text)');
  });

  it('omits the citation pointer when the row carries no locator_kind', () => {
    expect(drawerFields({ to_source_id: 's' }).map((f) => f.key)).not.toContain('locator_kind');
  });
});
