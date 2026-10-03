/**
 * GOV-2259 — synthetic exhausted-quota proof for the scheduled-sync guard.
 *
 * Drives the deterministic core through the full failure-and-recovery arc a
 * scheduled Government Watchdog run takes when an agent's weekly model allowance
 * is exhausted, and asserts each acceptance criterion the issue names:
 *   preflight detection · bounded fallback-or-defer (no repeat) · durable owner
 *   before execution · reset-aware deferral record · idempotency · reset-time
 *   wake · overlap-guarded catch-up · sanitized output.
 *
 * Pure functions only — no filesystem, no `node:*` — so it stays within the
 * repo's no-@types/node test rule (CLAUDE.md §4). Every clock is an explicit
 * `nowMs`; nothing here reads the wall clock.
 */
import { describe, it, expect } from 'vitest';
// The guard is an executable build-time module, not typed app code (CLAUDE.md §4).
// @ts-expect-error No declaration file is needed for this build-time module.
import { classifyProviderError, sanitizeForOperator, hasSecretLikeContent, zonedWallClockToInstantMs, nextCatchUpPulseMs, emptyLedger, upsertDeferral, decideAdmission, dueCatchUps, markReconciled, RESET_TIME_ZONE } from '../scripts/scheduled-sync-guard.mjs';

// The exact sanitized provider message the issue recorded, plus a decoy year.
const QUOTA_MSG =
  "Internal error: You've hit your weekly limit · resets Aug 24 at 10am (America/Denver)";

// A fixed observation instant: 2026-08-23 08:23 America/Denver (MDT, UTC-6).
const OBSERVED_MS = zonedWallClockToInstantMs(
  { year: 2026, month: 8, day: 23, hour: 8, minute: 23 },
  RESET_TIME_ZONE,
);
const LANE = 'auto-go-gov-website';

describe('classification + reset-time parsing', () => {
  it('detects a weekly-limit exhaustion and parses the Denver reset instant', () => {
    const c = classifyProviderError(QUOTA_MSG, OBSERVED_MS);
    expect(c.kind).toBe('weekly_limit_exhausted');
    expect(c.timeZone).toBe('America/Denver');
    // Aug 24 10:00 MDT == 16:00 UTC.
    const expected = zonedWallClockToInstantMs(
      { year: 2026, month: 8, day: 24, hour: 10, minute: 0 },
      'America/Denver',
    );
    expect(c.resetInstantMs).toBe(expected);
    expect(c.resetInstantMs).toBeGreaterThan(OBSERVED_MS);
  });

  it('classifies an unrelated failure as other, with no reset time', () => {
    const c = classifyProviderError('Internal error: connection reset by peer', OBSERVED_MS);
    expect(c.kind).toBe('other');
  });
});

describe('bounded admission policy (AC1, AC2, AC3)', () => {
  it('defers exactly once when nothing is available, and never re-selects the exhausted adapter', () => {
    let ledger = emptyLedger();
    // Preflight sees the primary exhausted and no fallback -> defer.
    const first = decideAdmission({
      lane: LANE, nowMs: OBSERVED_MS, ledger,
      primaryAvailable: false, fallbackAvailable: false,
    });
    expect(first.action).toBe('defer');

    // Record the durable deferral (the durable owner of the skipped work).
    const c = classifyProviderError(QUOTA_MSG, OBSERVED_MS);
    ({ ledger } = upsertDeferral(ledger, {
      lane: LANE, resetLocal: c.resetLocal, timeZone: c.timeZone,
      resetInstantMs: c.resetInstantMs, evidenceInvalidated: ['scheduled-sync'],
      catchUpPulseMs: nextCatchUpPulseMs(c.resetInstantMs), recordedAtMs: OBSERVED_MS,
    }));
    expect(ledger.deferrals).toHaveLength(1);

    // Second attempt BEFORE reset must NOT retry the exhausted adapter: it waits.
    const second = decideAdmission({
      lane: LANE, nowMs: OBSERVED_MS + 30_000, ledger,
      primaryAvailable: false, fallbackAvailable: false,
    });
    expect(second.action).toBe('wait_deferred');
    expect(second.deferral.lane).toBe(LANE);
  });

  it('takes an approved available fallback instead of deferring when one exists', () => {
    const d = decideAdmission({
      lane: LANE, nowMs: OBSERVED_MS, ledger: emptyLedger(),
      primaryAvailable: false, fallbackAvailable: true,
    });
    expect(d.action).toBe('fallback');
    expect(d.adapter).toBe('fallback');
  });

  it('proceeds when the primary adapter is available', () => {
    const d = decideAdmission({
      lane: LANE, nowMs: OBSERVED_MS, ledger: emptyLedger(),
      primaryAvailable: true,
    });
    expect(d.action).toBe('proceed');
  });
});

describe('durable deferral record + idempotency (AC4, AC7)', () => {
  it('records the lane, reset time, evidence invalidated, and first catch-up pulse', () => {
    const c = classifyProviderError(QUOTA_MSG, OBSERVED_MS);
    const { ledger } = upsertDeferral(emptyLedger(), {
      lane: LANE, resetLocal: c.resetLocal, timeZone: c.timeZone,
      resetInstantMs: c.resetInstantMs, evidenceInvalidated: ['scheduled-sync', 'issue-reconciliation'],
      catchUpPulseMs: nextCatchUpPulseMs(c.resetInstantMs, 720), recordedAtMs: OBSERVED_MS,
    });
    const [d] = ledger.deferrals;
    expect(d.lane).toBe(LANE);
    expect(d.timeZone).toBe('America/Denver');
    expect(d.resetInstantMs).toBe(c.resetInstantMs);
    expect(d.evidenceInvalidated).toEqual(['scheduled-sync', 'issue-reconciliation']);
    expect(d.catchUpPulseMs).toBe(c.resetInstantMs + 720 * 60_000);
    expect(d.reconciledAtMs).toBeNull();
  });

  it('is idempotent: recording the same exhaustion twice yields one record and no change', () => {
    const c = classifyProviderError(QUOTA_MSG, OBSERVED_MS);
    const entry = {
      lane: LANE, resetLocal: c.resetLocal, timeZone: c.timeZone,
      resetInstantMs: c.resetInstantMs, evidenceInvalidated: ['scheduled-sync'],
      catchUpPulseMs: nextCatchUpPulseMs(c.resetInstantMs), recordedAtMs: OBSERVED_MS,
    };
    const first = upsertDeferral(emptyLedger(), entry);
    expect(first.created).toBe(true);
    // A later re-observation of the same reset must not duplicate or reset it.
    const second = upsertDeferral(first.ledger, { ...entry, recordedAtMs: OBSERVED_MS + 90_000 });
    expect(second.created).toBe(false);
    expect(second.changed).toBe(false);
    expect(second.ledger.deferrals).toHaveLength(1);
    expect(second.ledger.deferrals[0].recordedAtMs).toBe(OBSERVED_MS); // original preserved
  });
});

describe('reset-time wake + overlap-guarded catch-up (AC5)', () => {
  function deferredLedger() {
    const c = classifyProviderError(QUOTA_MSG, OBSERVED_MS);
    return upsertDeferral(emptyLedger(), {
      lane: LANE, resetLocal: c.resetLocal, timeZone: c.timeZone,
      resetInstantMs: c.resetInstantMs, evidenceInvalidated: ['scheduled-sync'],
      catchUpPulseMs: nextCatchUpPulseMs(c.resetInstantMs), recordedAtMs: OBSERVED_MS,
    }).ledger;
  }

  it('is not eligible for catch-up before the reset instant', () => {
    const ledger = deferredLedger();
    const beforeReset = ledger.deferrals[0].resetInstantMs - 60_000;
    const { due } = dueCatchUps(ledger, beforeReset);
    expect(due).toHaveLength(0);

    const decision = decideAdmission({
      lane: LANE, nowMs: beforeReset, ledger, primaryAvailable: false,
    });
    expect(decision.action).toBe('wait_deferred');
  });

  it('wakes the correct lane for catch-up once the reset has passed', () => {
    const ledger = deferredLedger();
    const afterReset = ledger.deferrals[0].resetInstantMs + 60_000;
    const { due } = dueCatchUps(ledger, afterReset);
    expect(due).toHaveLength(1);
    expect(due[0].lane).toBe(LANE);

    const decision = decideAdmission({
      lane: LANE, nowMs: afterReset, ledger, primaryAvailable: true,
    });
    expect(decision.action).toBe('catch_up');
  });

  it('holds a due catch-up when its lane has an active run, avoiding overlap', () => {
    const ledger = deferredLedger();
    const afterReset = ledger.deferrals[0].resetInstantMs + 60_000;
    const { due, held } = dueCatchUps(ledger, afterReset, [LANE]);
    expect(due).toHaveLength(0);
    expect(held).toHaveLength(1);
    expect(held[0].lane).toBe(LANE);
  });

  it('clears the deferral after reconciliation so it stops firing', () => {
    const ledger = deferredLedger();
    const afterReset = ledger.deferrals[0].resetInstantMs + 60_000;
    const { ledger: next, changed } = markReconciled(ledger, LANE, ledger.deferrals[0].resetInstantMs, afterReset);
    expect(changed).toBe(true);
    expect(next.deferrals[0].reconciledAtMs).toBe(afterReset);
    expect(dueCatchUps(next, afterReset + 3600_000).due).toHaveLength(0);
  });
});

describe('sanitized operator output (AC6)', () => {
  it('emits only the classification and reset time, never the raw provider payload', () => {
    // Home-path account is the neutral sentinel `someone` — a real contributor
    // path would (rightly) trip the #218 public-repo path guard on this file.
    const dirty =
      "Internal error at /Users/someone/private/path token=ghp_ABCDEFGHIJKLMNOP1234567890 " +
      "for admin@example.gov https://api.internal/quota — You've hit your weekly limit " +
      "· resets Aug 24 at 10am (America/Denver)";
    // Drive with a fixed observation instant so the resolved reset year is
    // deterministic and this assertion cannot rot into 2027 as wall-clock time
    // passes (the sanitizer no longer reads Date.now() — see the case below).
    const clean = sanitizeForOperator(dirty, OBSERVED_MS);
    expect(clean).toContain('weekly model allowance exhausted');
    expect(clean).toContain('resets 2026-08'); // reset wall-clock survives
    expect(hasSecretLikeContent(clean)).toBe(false);
    // None of the dangerous fragments leak through.
    for (const secret of ['/Users/someone', 'ghp_', 'admin@example.gov', 'https://', 'api.internal']) {
      expect(clean).not.toContain(secret);
    }
  });

  it('resolves the reset year from the supplied nowMs, not the wall clock (no time-bomb)', () => {
    // The same message observed a year later resolves to the year that tracks
    // nowMs. This proves the sanitizer is clock-independent: its output is a
    // pure function of (message, nowMs), so it can never turn CI red on its own
    // as real time advances — the defect VSR flagged on 2026-08-25.
    const nextYearObserved = zonedWallClockToInstantMs(
      { year: 2027, month: 8, day: 20, hour: 8, minute: 23 },
      RESET_TIME_ZONE,
    );
    expect(sanitizeForOperator(QUOTA_MSG, OBSERVED_MS)).toContain('resets 2026-08');
    expect(sanitizeForOperator(QUOTA_MSG, nextYearObserved)).toContain('resets 2027-08');
  });

  it('withholds detail entirely for a non-quota failure', () => {
    const clean = sanitizeForOperator('boom at /Users/someone/x with token sk-ABCDEFGHIJKLMNOPQRSTUV');
    expect(clean).toBe('non-quota failure classification; details withheld');
    expect(hasSecretLikeContent(clean)).toBe(false);
  });
});
