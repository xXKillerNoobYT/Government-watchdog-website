import { describe, it, expect } from 'vitest';
import {
  ALPINE_SCOPE,
  isAlpineRecord,
  partitionAlpine,
  recordTimelineDate,
  orderedTimeline,
  buildTimeline,
  buildTimeNavigator,
  assembleThread,
  completenessView,
  NO_LINK_TEXT,
} from '../src/ui/timeline';
import type {
  ReadApiResponse,
  StatementRecord,
  AgendaThreadResponse,
  ThreadCompleteness,
} from '../src/types/read-api';
// GOV-129: graph-logic coverage runs on the labeled SYNTHETIC concept-graph demo
// (the real reviewed corpus has 0 topics/0 threads, so it cannot exercise this).
import fixture from '../src/fixtures/concept-graph-demo.json';

const FIXTURE = fixture as ReadApiResponse;

function rec(partial: Partial<StatementRecord> & { statement_id: string }): StatementRecord {
  return { evidence: [], ...partial };
}

// --- Alpine scope lock (BEH-FILTER-1/2) -------------------------------------

describe('partitionAlpine — scope lock + drop log', () => {
  it('keeps Alpine-namespaced records and records with no agenda id', () => {
    const res: ReadApiResponse = {
      scope: 'alpine',
      access: 'reviewer_internal',
      records: [
        rec({ statement_id: 's1', agenda_item_id: 'alpine:2020-01-01:item-1' }),
        rec({ statement_id: 's2' }), // no id → cannot be proven non-Alpine → kept
      ],
    };
    const { kept, dropped, warnings } = partitionAlpine(res);
    expect(kept.map((r) => r.statement_id)).toEqual(['s1', 's2']);
    expect(dropped).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('drops + logs a record from another jurisdiction namespace', () => {
    const res: ReadApiResponse = {
      scope: 'alpine',
      access: 'reviewer_internal',
      records: [
        rec({ statement_id: 'keep', agenda_item_id: 'alpine:2020-01-01:item-1' }),
        rec({ statement_id: 'drop', agenda_item_id: 'jackson:2020-01-01:item-9' }),
      ],
    };
    const { kept, dropped, warnings } = partitionAlpine(res);
    expect(kept.map((r) => r.statement_id)).toEqual(['keep']);
    expect(dropped).toEqual([{ statement_id: 'drop', reason: expect.stringContaining('jackson') }]);
    expect(warnings[0]).toContain('dropped non-Alpine record drop');
  });

  it('drops EVERY record when the whole response is not Alpine-scoped', () => {
    const res: ReadApiResponse = {
      scope: 'jackson',
      access: 'reviewer_internal',
      records: [rec({ statement_id: 'a', agenda_item_id: 'alpine:2020-01-01:item-1' })],
    };
    const { kept, dropped } = partitionAlpine(res);
    expect(kept).toEqual([]);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].reason).toContain('not "alpine"');
  });

  it('isAlpineRecord guards the namespace prefix', () => {
    expect(isAlpineRecord(rec({ statement_id: 'x', agenda_item_id: `${ALPINE_SCOPE}:2020-01-01:item-1` }))).toBe(true);
    expect(isAlpineRecord(rec({ statement_id: 'x', agenda_item_id: 'other:2020:item-1' }))).toBe(false);
    expect(isAlpineRecord(rec({ statement_id: 'x' }))).toBe(true);
  });
});

// --- Chronology -------------------------------------------------------------

describe('recordTimelineDate — derived from web-safe fields, never invented', () => {
  it('reads the meeting date embedded in the agenda_item_id', () => {
    expect(recordTimelineDate(rec({ statement_id: 's', agenda_item_id: 'alpine:2019-06-11:item-5' }))).toBe('2019-06-11');
  });

  it('falls back to the latest evidence date when no id date exists', () => {
    const r = rec({
      statement_id: 's',
      evidence: [
        { source_date: '2021-03-01' },
        { scan_date: '2021-05-09' },
      ],
    });
    expect(recordTimelineDate(r)).toBe('2021-05-09');
  });

  it('returns undefined when no web-safe date is available', () => {
    expect(recordTimelineDate(rec({ statement_id: 's' }))).toBeUndefined();
  });
});

describe('orderedTimeline — newest-first, stable, dateless last', () => {
  it('sorts newest-first by derived date', () => {
    const records = [
      rec({ statement_id: 'old', agenda_item_id: 'alpine:2019-06-11:item-5' }),
      rec({ statement_id: 'new', agenda_item_id: 'alpine:2019-07-09:item-7' }),
      rec({ statement_id: 'mid', agenda_item_id: 'alpine:2019-06-25:item-2' }),
    ];
    expect(orderedTimeline(records).map((o) => o.record.statement_id)).toEqual(['new', 'mid', 'old']);
  });

  it('keeps dateless records last, in stable payload order', () => {
    const records = [
      rec({ statement_id: 'd1' }),
      rec({ statement_id: 'dated', agenda_item_id: 'alpine:2019-07-09:item-7' }),
      rec({ statement_id: 'd2' }),
    ];
    expect(orderedTimeline(records).map((o) => o.record.statement_id)).toEqual(['dated', 'd1', 'd2']);
  });

  it('breaks ties by original order (stable)', () => {
    const records = [
      rec({ statement_id: 'a', agenda_item_id: 'alpine:2019-06-11:item-5' }),
      rec({ statement_id: 'b', agenda_item_id: 'alpine:2019-06-11:item-9' }),
    ];
    expect(orderedTimeline(records).map((o) => o.record.statement_id)).toEqual(['a', 'b']);
  });
});

describe('buildTimeline — fixture composes to newest-first, Alpine-locked', () => {
  it('orders the fixture records newest-first with no drops', () => {
    const { ordered, dropped } = buildTimeline(FIXTURE);
    expect(dropped).toEqual([]);
    const dates = ordered.map((o) => o.timelineDate);
    const sorted = [...dates].sort().reverse();
    expect(dates).toEqual(sorted);
    expect(dates[0]).toBe('2019-07-09'); // newest meeting first
  });
});

// --- Agenda thread assembly (BEH-AGENDA-1..5) -------------------------------

describe('assembleThread — known-then order + typed forward links', () => {
  const thread = FIXTURE.agenda_thread as AgendaThreadResponse;

  it('orders instances earliest meeting first (known-then)', () => {
    const { instances } = assembleThread(thread);
    expect(instances.map((i) => i.meetingDate)).toEqual(['2019-06-11', '2019-06-25', '2019-07-09']);
  });

  it('attaches typed lifecycle links and never an untyped "related"', () => {
    const { instances } = assembleThread(thread);
    const adoption = instances.find((i) => i.member.agenda_item_id === 'alpine:2019-06-25:item-2')!;
    const out = adoption.links.filter((l) => l.direction === 'out');
    expect(out.some((l) => l.label === 'Supersedes')).toBe(true);
    for (const inst of instances) for (const l of inst.links) expect(l.label.toLowerCase()).not.toBe('related');
  });

  it('keeps each instance label its own (no borrowed title)', () => {
    const { instances } = assembleThread(thread);
    expect(instances[0].title).toBe('Fireworks ordinance — first reading');
    expect(instances[2].title).toBe('Fireworks ordinance — correction');
  });

  it('reports a lifecycle connection across ≥2 instances', () => {
    expect(assembleThread(thread).hasLifecycleConnection).toBe(true);
  });

  it('flags an instance with no edge as hasNoLinks (→ "no linked prior/next item recorded")', () => {
    const lonely: AgendaThreadResponse = {
      thread: thread.thread,
      members: [
        { agenda_item_id: 'alpine:2022-01-01:item-1', title: 'Standalone item', item_order: 1 },
      ],
      lifecycle_edges: [],
    };
    const { instances, hasLifecycleConnection } = assembleThread(lonely);
    expect(instances[0].hasNoLinks).toBe(true);
    expect(hasLifecycleConnection).toBe(false);
    expect(NO_LINK_TEXT).toBe('no linked prior/next item recorded');
  });

  it('does NOT link two members that merely share a similar title (BEH-AGENDA-3)', () => {
    const similar: AgendaThreadResponse = {
      thread: thread.thread,
      members: [
        { agenda_item_id: 'alpine:2022-01-01:item-1', title: 'Fireworks rules', item_order: 1 },
        { agenda_item_id: 'alpine:2022-02-01:item-1', title: 'Fireworks rules', item_order: 1 },
      ],
      lifecycle_edges: [], // no explicit edge → no inferred link
    };
    const { instances } = assembleThread(similar);
    expect(instances.every((i) => i.links.length === 0)).toBe(true);
  });
});

// --- Completeness (BEH-COMPLETE-1..3, fail-closed) --------------------------

describe('completenessView — fail-closed, never false-complete', () => {
  it('renders the fixture gaps verbatim', () => {
    const v = completenessView((FIXTURE.agenda_thread as AgendaThreadResponse).completeness);
    expect(v.state).toBe('gaps');
    expect(v.summary).toContain('gaps');
    expect(v.gaps.map((g) => g.kind)).toEqual(['unreviewed_instance', 'missing_minutes_transcript']);
    expect(v.summary).toContain('unreviewed instance');
    expect(v.summary).toContain('missing minutes/transcript');
  });

  it('renders complete only when backend asserts complete with no gaps', () => {
    const v = completenessView({ state: 'complete' });
    expect(v.state).toBe('complete');
    expect(v.summary).toBe('complete');
  });

  it('treats an ABSENT completeness field as unknown, never complete', () => {
    expect(completenessView(undefined).state).toBe('unknown');
    expect(completenessView(null).summary).toBe('completeness unknown');
  });

  it('treats an explicit unknown state as unknown', () => {
    expect(completenessView({ state: 'unknown' }).state).toBe('unknown');
  });

  it('DOWNGRADES a "complete" that nonetheless carries gaps to gaps (never false-complete)', () => {
    const sneaky: ThreadCompleteness = { state: 'complete', gaps: [{ kind: 'missing_meeting_instance' }] };
    expect(completenessView(sneaky).state).toBe('gaps');
  });
});

// C7b (iteration 45) — runtime-safety / edge-case hunt over the pages-civic area.
//
// `buildTimeNavigator` destructures `timelineDate.split('-')`. On anything that is not a
// full YYYY-MM-DD, month and day come back undefined, which produced two measured defects:
//   * 'unknown' → month label `undefined`, day label "NaN"
//   * '2026-07' → filed as a DAY under July, labelled "NaN"
// The second is the one that matters: month-precision data rendered as a day entry claims
// a specificity the record does not have. Such dates are UNDATED, which this function
// already models.
describe('buildTimeNavigator — partial and malformed dates', () => {
  const nav = (dates: (string | null)[]) =>
    buildTimeNavigator(dates.map((timelineDate) => ({ timelineDate })) as never);

  it('never renders NaN or undefined as a date label', () => {
    const result = nav(['2026-07-21', '2026-07', 'unknown', '', null, '2026-13-99x']);
    for (const y of result.years) {
      expect(y.year, 'year').not.toMatch(/NaN|undefined/);
      for (const m of y.months) {
        expect(String(m.label), 'month label').not.toMatch(/NaN|undefined/);
        for (const d of m.days) {
          expect(String(d.label), 'day label').not.toMatch(/NaN|undefined/);
        }
      }
    }
  });

  it('counts a month-precision date as undated rather than inventing a day', () => {
    const result = nav(['2026-07-21', '2026-07']);
    const julyDays = result.years.flatMap((y) => y.months).flatMap((m) => m.days);
    // The real date is placed; the month-precision one is not given a fabricated day.
    expect(julyDays.map((d) => d.label)).toEqual(['21']);
    expect(result.undatedCount).toBe(1);
  });

  it('counts malformed values as undated, not as a year of their own', () => {
    const result = nav(['unknown', '2026', '2026-7-1', 'null']);
    expect(result.years).toHaveLength(0);
    expect(result.undatedCount).toBe(4);
  });

  it('still places well-formed dates exactly as before', () => {
    const result = nav(['2026-07-21', '2026-07-22', '2026-06-01']);
    expect(result.undatedCount).toBe(0);
    const labels = result.years.flatMap((y) => y.months).flatMap((m) => m.days).map((d) => d.label);
    expect(labels.sort()).toEqual(['1', '21', '22']);
  });
});
