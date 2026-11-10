import { describe, expect, it } from 'vitest';
// @ts-expect-error The repository intentionally carries no global Node typings;
// this test needs only the executable subprocess seam for the CLI dry-run proof.
import { spawnSync } from 'node:child_process';

declare const process: {
  cwd(): string;
  execPath: string;
};

// The base read-only lane (exit-code vocabulary reused by the scheduled wrapper).
// @ts-expect-error No declaration file is needed for this workflow helper.
import { EXIT } from '../scripts/backend-evidence-sync.mjs';

// The scheduled fail-closed wrapper under test.
// @ts-expect-error No declaration file is needed for this workflow helper.
import { DEFAULT_LANE, buildAlertRecord, isSuccess, parseArgs, runScheduled, verdictForExit } from '../scripts/backend-evidence-sync-scheduled.mjs';

const SCHED = 'scripts/backend-evidence-sync-scheduled.mjs';

/** Minimal call-recording spy — the repo carries no mock lib for .ts guard code. */
function spy(returnValue?: unknown) {
  const calls: unknown[][] = [];
  const fn = (...args: unknown[]) => {
    calls.push(args);
    return returnValue;
  };
  (fn as unknown as { calls: unknown[][] }).calls = calls;
  return fn as unknown as ((...args: unknown[]) => unknown) & { calls: unknown[][] };
}

describe('GOV-2283 scheduled wrapper — dry-run has no side effects', () => {
  it('never runs collect, never writes or clears an alert, and exits HEALTHY', () => {
    const run = spy({ exit: EXIT.HEALTHY });
    const writeAlert = spy();
    const clearAlert = spy();
    const emit = spy();
    const exit = runScheduled({
      dryRun: true,
      outPath: '/scratch/out.json',
      alertPath: '/scratch/alert.json',
      run,
      writeAlert,
      clearAlert,
      emit,
      now: () => '2026-08-29T00:00:00.000Z',
    });
    expect(exit).toBe(EXIT.HEALTHY);
    expect(run.calls.length).toBe(0); // no `gh` call
    expect(writeAlert.calls.length).toBe(0); // no alert written
    expect(clearAlert.calls.length).toBe(0); // nothing mutated at all
  });
});

describe('GOV-2283 scheduled wrapper — a failing run exits non-zero AND raises (never swallowed)', () => {
  it('propagates the fail-closed exit and writes a sanitized alert', () => {
    const run = spy({ exit: EXIT.NOT_FOUND });
    const writeAlert = spy();
    const clearAlert = spy();
    const exit = runScheduled({
      dryRun: false,
      outPath: '/scratch/out.json',
      alertPath: '/scratch/alert.json',
      lane: DEFAULT_LANE,
      run,
      writeAlert,
      clearAlert,
      now: () => '2026-08-29T00:00:00.000Z',
    });
    // A2/F3: the non-zero exit is propagated, not turned green.
    expect(exit).toBe(EXIT.NOT_FOUND);
    expect(exit).not.toBe(EXIT.HEALTHY);
    // And an owner-visible alert was raised.
    expect(writeAlert.calls.length).toBe(1);
    expect(clearAlert.calls.length).toBe(0);
    const record = writeAlert.calls[0][0] as Record<string, unknown>;
    expect(record.verdict).toBe('NOT_FOUND');
    expect(record.exit).toBe(EXIT.NOT_FOUND);
    expect(record.action).toBe('HOLD');
  });

  it('a launch/degraded failure (exit 13) also raises and holds', () => {
    const run = spy({ exit: EXIT.DEGRADED });
    const writeAlert = spy();
    const clearAlert = spy();
    const exit = runScheduled({
      dryRun: false, outPath: '/o', alertPath: '/a', run, writeAlert, clearAlert,
      now: () => '2026-08-29T00:00:00.000Z',
    });
    expect(exit).toBe(EXIT.DEGRADED);
    expect(writeAlert.calls.length).toBe(1);
  });
});

describe('GOV-2283 scheduled wrapper — a healthy run clears stale alerts and is idempotent', () => {
  it('exit 0 clears any prior alert, writes none, and returns HEALTHY', () => {
    const run = spy({ exit: EXIT.HEALTHY });
    const writeAlert = spy();
    const clearAlert = spy();
    const call = () => runScheduled({
      dryRun: false, outPath: '/o', alertPath: '/a', run, writeAlert, clearAlert,
      now: () => '2026-08-29T00:00:00.000Z',
    });
    expect(call()).toBe(EXIT.HEALTHY);
    expect(call()).toBe(EXIT.HEALTHY); // twice-run: same result, no accumulated state
    expect(writeAlert.calls.length).toBe(0);
    expect(clearAlert.calls.length).toBe(2); // clearing an absent alert is a no-op
  });

  it('two identical failing runs produce byte-identical alert records (deterministic)', () => {
    const mk = () => {
      const run = spy({ exit: EXIT.AUTH_FAILURE });
      const writeAlert = spy();
      runScheduled({
        dryRun: false, outPath: '/o', alertPath: '/a', run, writeAlert,
        clearAlert: spy(), now: () => '2026-08-29T00:00:00.000Z',
      });
      return JSON.stringify(writeAlert.calls[0][0]);
    };
    expect(mk()).toBe(mk());
  });
});

describe('GOV-2283 scheduled wrapper — the alert record is sanitized by construction', () => {
  it('carries only structural fields; no title/body/head ref/author can be placed in it', () => {
    const record = buildAlertRecord(EXIT.FORBIDDEN, { lane: DEFAULT_LANE, ts: '2026-08-29T00:00:00.000Z' });
    expect(Object.keys(record).sort()).toEqual(
      ['action', 'exit', 'kind', 'lane', 'note', 'schema_version', 'ts', 'verdict'],
    );
    const s = JSON.stringify(record);
    // None of the private surfaces the base script strips may appear here either.
    for (const forbidden of ['body', 'head_ref', 'login', 'title', 'author']) {
      expect(s).not.toContain(forbidden);
    }
  });

  it('maps every known exit to its verdict enum, and unknown codes to UNKNOWN', () => {
    expect(verdictForExit(EXIT.HEALTHY)).toBe('HEALTHY');
    expect(verdictForExit(EXIT.AUTH_FAILURE)).toBe('AUTH_FAILURE');
    expect(verdictForExit(EXIT.FORBIDDEN)).toBe('FORBIDDEN');
    expect(verdictForExit(EXIT.NOT_FOUND)).toBe('NOT_FOUND');
    expect(verdictForExit(EXIT.DEGRADED)).toBe('DEGRADED');
    expect(verdictForExit(999)).toBe('UNKNOWN');
    expect(isSuccess(EXIT.HEALTHY)).toBe(true);
    expect(isSuccess(EXIT.NOT_FOUND)).toBe(false);
  });
});

describe('GOV-2283 scheduled wrapper — argument surface stays minimal (no --apply, no --repo)', () => {
  it('accepts only --dry-run / --out / --lane', () => {
    expect(parseArgs(['--dry-run'])).toMatchObject({ dryRun: true });
    expect(parseArgs(['--out', '/tmp/x.json'])).toMatchObject({ out: '/tmp/x.json' });
    expect(parseArgs(['--lane', 'gov-backend-evidence'])).toMatchObject({ lane: 'gov-backend-evidence' });
  });
  it('rejects --apply and --repo and any unknown flag with a USAGE error', () => {
    expect(parseArgs(['--apply']).error).toBe(EXIT.USAGE);
    expect(parseArgs(['--repo', 'x/y']).error).toBe(EXIT.USAGE);
    expect(parseArgs(['--nope']).error).toBe(EXIT.USAGE);
  });
});

describe('GOV-2283 scheduled wrapper — CLI seam', () => {
  it('the executable dry-run exits HEALTHY and announces no side effects', () => {
    const r = spawnSync(process.execPath, [SCHED, '--dry-run'], { cwd: process.cwd(), encoding: 'utf8' });
    expect(r.status).toBe(EXIT.HEALTHY);
    expect(r.stdout).toContain('dry-run');
    expect(r.stdout).toContain('No side effects');
  });

  it('the executable exits USAGE on an unknown argument', () => {
    const r = spawnSync(process.execPath, [SCHED, '--bogus'], { cwd: process.cwd(), encoding: 'utf8' });
    expect(r.status).toBe(EXIT.USAGE);
  });
});
