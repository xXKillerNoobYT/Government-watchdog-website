import { afterEach, describe, expect, it } from 'vitest';

// The heartbeat guard is an executable build/ops module, not app code, and this
// repo carries no `@types/node`, so all process/socket/fs work lives inside the
// `.mjs` (including `getFreePort`) and this test asserts only on the plain values
// it returns. The import is a single line so the `@ts-expect-error` directly
// above the module specifier suppresses the "no declaration file" diagnostic.
// prettier-ignore
// @ts-expect-error No declaration file is needed for this build-time module.
import { acquireLease, currentPid, DEFAULT_INTERVAL_MS, denverLabel, getFreePort, humanDuration, isLeaseExpired, killProcessGroup, makeTempStateDir, nodeExecPath, pgidAlive, readLease, readSessions, reconcileCadence, recoverStale, rmStateDir, runBounded, spawnDetachedGroup, waitForPort, writeLease } from '../scripts/heartbeat-guard.mjs';

const freePort = (): Promise<number> => getFreePort();

const HANG = new URL('../scripts/heartbeat-guard-hang.mjs', import.meta.url).pathname;

const tempDirs: string[] = [];
const tmp = (): string => {
  const d = makeTempStateDir('vitest-hbg');
  tempDirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of tempDirs.splice(0)) rmStateDir(d);
});

// ---------------------------------------------------------------------------
// AC1 + AC2 + AC7 — hard wall-clock cancellation and recursive cleanup of a
// call that ignores cooperative timeout and spawns a child server.
// ---------------------------------------------------------------------------

describe('hard cancellation of an uncancellable browser-audit stand-in (website#229 AC1/AC2/AC7)', () => {
  it('kills the whole process group even though SIGTERM is ignored, and frees the child-bound port', async () => {
    const port = await freePort();
    const pgid = spawnDetachedGroup(nodeExecPath(), [HANG, String(port)]);
    try {
      // The child "server" (Vite-child stand-in) actually bound the port.
      expect(await waitForPort(port, { listening: true, timeoutMs: 4000 })).toBe(true);

      const kill = await killProcessGroup(pgid, { graceMs: 150 });
      expect(kill.killed).toBe(true);
      // SIGTERM is ignored by the workload, so cancellation MUST escalate.
      expect(kill.sigkill).toBe(true);
      expect(kill.groupGone).toBe(true);

      // Recursive cleanup: the child's port is released and the group is gone.
      expect(await waitForPort(port, { listening: false, timeoutMs: 4000 })).toBe(true);
      expect(pgidAlive(pgid)).toBe(false);
    } finally {
      await killProcessGroup(pgid, { graceMs: 50 });
    }
  }, 20000);

  it('runBounded returns a timeout with the group gone and owned ports freed', async () => {
    const port = await freePort();
    const res = await runBounded({
      command: nodeExecPath(),
      args: [HANG, String(port)],
      deadlineMs: 700,
      graceMs: 150,
      ports: [port],
    });
    expect(res.status).toBe('timeout');
    expect(res.killed).toBe(true);
    expect(res.escalatedToSigkill).toBe(true);
    expect(res.groupGone).toBe(true);
    expect(res.portsFreed).toBe(true);
    expect(res.cleanExit).toBe(true);
    // The deadline fired well before an unbounded call would (the incident ran hours).
    expect(res.elapsedMs).toBeLessThan(5000);
  }, 20000);

  it('lets a command that finishes before the deadline complete on its own', async () => {
    const res = await runBounded({ command: nodeExecPath(), args: ['-e', 'process.exit(0)'], deadlineMs: 8000, ports: [] });
    expect(res.status).toBe('completed');
    expect(res.code).toBe(0);
    expect(res.killed).toBe(false);
  }, 15000);

  it('reports a non-zero exit-code command as failed, not completed', async () => {
    const res = await runBounded({ command: nodeExecPath(), args: ['-e', 'process.exit(7)'], deadlineMs: 8000, ports: [] });
    expect(res.status).toBe('failed');
    expect(res.code).toBe(7);
  }, 15000);
});

// ---------------------------------------------------------------------------
// AC3 + AC4 + AC6 — durable lease that expires independently of the worker,
// next-heartbeat recovery, and the append-only Session record.
// ---------------------------------------------------------------------------

describe('durable lease, expiry, and stale-run recovery (website#229 AC3/AC4/AC6)', () => {
  it('expires a lease on wall-clock deadline regardless of the worker', () => {
    const start = 1_700_000_000_000;
    const lease = { deadlineEpochMs: start + 90_000 };
    expect(isLeaseExpired(lease, start + 89_000)).toBe(false);
    expect(isLeaseExpired(lease, start + 91_000)).toBe(true);
  });

  it('refuses a second acquisition while a live-deadline lease is held', () => {
    const dir = tmp();
    const now = 1_700_000_000_000;
    const first = acquireLease(
      dir,
      { runId: 'a', owner: 'AOE', lane: 'gate', startEpochMs: now, deadlineEpochMs: now + 90_000, ports: [], pgid: currentPid() },
      { nowEpochMs: now },
    );
    expect(first.acquired).toBe(true);
    const second = acquireLease(
      dir,
      { runId: 'b', owner: 'AOE', lane: 'gate', startEpochMs: now, deadlineEpochMs: now + 90_000, ports: [], pgid: currentPid() },
      { nowEpochMs: now + 1_000 },
    );
    expect(second.acquired).toBe(false);
    expect(second.reason).toBe('live-lease-held');
  });

  it('recovers an expired lease: marks stale, writes a Session, clears the lease', async () => {
    const dir = tmp();
    const start = 1_700_000_000_000;
    writeLease(dir, {
      runId: 'r-stale',
      owner: 'AutomationOpsEngineer',
      lane: 'a11y-responsive',
      step: 'viewport-audit',
      startEpochMs: start,
      deadlineEpochMs: start + 90_000,
      ports: [],
      pgid: 2_147_480_000, // not a live group
    });
    const now = start + 60 * 60 * 1000; // one hour later — long past the 90s deadline

    // Dry-run must not clear anything.
    const dry = await recoverStale({ dir, nowEpochMs: now, apply: false });
    expect(dry.stale).toBe(true);
    expect(dry.action).toBe('would-recover');
    expect(readLease(dir)).not.toBe(null);

    const rep = await recoverStale({ dir, nowEpochMs: now, apply: true });
    expect(rep.stale).toBe(true);
    expect(rep.action).toBe('recovered');
    expect(rep.reason).toBe('deadline-exceeded');
    expect(rep.session.type).toBe('stale-run-recovery');
    expect(rep.session.nextDue).toBe('a11y-responsive');
    // The Session record invalidates the missing evidence rather than trusting it.
    expect(rep.session.evidenceInvalidated).toMatch(/must NOT be treated as release evidence/);
    expect(readLease(dir)).toBe(null);

    const sessions = readSessions(dir);
    expect(sessions.filter((s: { type: string }) => s.type === 'stale-run-recovery')).toHaveLength(1);

    // Idempotent: a second recovery on the now-clean state does nothing.
    const again = await recoverStale({ dir, nowEpochMs: now + 1000, apply: true });
    expect(again.stale).toBe(false);
    expect(again.action).toBe('none');
  }, 15000);

  it('recovers a lease whose worker died even before its deadline', async () => {
    const dir = tmp();
    const start = 1_700_000_000_000;
    writeLease(dir, {
      runId: 'r-dead-worker',
      owner: 'AOE',
      lane: 'ci-tooling',
      startEpochMs: start,
      deadlineEpochMs: start + 90_000,
      ports: [],
      pgid: 2_147_480_001, // dead group
    });
    // now is BEFORE the deadline, so staleness comes from the dead worker, not expiry.
    const rep = await recoverStale({ dir, nowEpochMs: start + 10_000, apply: true });
    expect(rep.stale).toBe(true);
    expect(rep.reason).toBe('worker-dead');
    expect(readLease(dir)).toBe(null);
  }, 15000);
});

// ---------------------------------------------------------------------------
// AC5 — America/Denver cadence reconciliation with deterministic, deduped
// catch-up that never overlaps or duplicates work.
// ---------------------------------------------------------------------------

describe('America/Denver cadence reconciliation (website#229 AC5)', () => {
  const anchor = 1_700_000_000_000;
  const iv = DEFAULT_INTERVAL_MS;

  it('records every missed lane and dedupes the catch-up plan to one entry per lane', () => {
    const r = reconcileCadence({
      lanes: ['a', 'b', 'c'],
      anchorEpochMs: anchor,
      intervalMs: iv,
      // a completed at pulse 3, c at pulse 5; b never ran.
      lastCompleted: { a: anchor + 3 * iv, c: anchor + 5 * iv },
      nowEpochMs: anchor + Math.floor(5.5 * iv),
    });
    // pulses 0..5 -> a b c a b c ; only b's two pulses (1,4) are unmet.
    expect(r.missed.map((m: { lane: string }) => m.lane)).toEqual(['b', 'b']);
    expect(r.catchUp).toHaveLength(1);
    expect(r.catchUp[0].lane).toBe('b');
    expect(r.catchUp[0].missedCount).toBe(2);
  });

  it('excludes an in-progress lane from catch-up so work is never duplicated', () => {
    const r = reconcileCadence({
      lanes: ['a', 'b', 'c'],
      anchorEpochMs: anchor,
      intervalMs: iv,
      lastCompleted: {},
      nowEpochMs: anchor + Math.floor(2.5 * iv), // pulses 0(a) 1(b) 2(c)
      inProgressLanes: ['b'],
    });
    const lanes = r.catchUp.map((c: { lane: string }) => c.lane);
    expect(lanes).toContain('a');
    expect(lanes).toContain('c');
    expect(lanes).not.toContain('b');
  });

  it('reports zero missed lanes when every due pulse has a recent completion', () => {
    const r = reconcileCadence({
      lanes: ['a', 'b'],
      anchorEpochMs: anchor,
      intervalMs: iv,
      lastCompleted: { a: anchor + 100 * iv, b: anchor + 100 * iv }, // completed after every pulse
      nowEpochMs: anchor + Math.floor(3.5 * iv),
    });
    expect(r.missed).toHaveLength(0);
    expect(r.catchUp).toHaveLength(0);
  });

  it('labels the incident window in America/Denver (MDT, -06:00)', () => {
    // 2026-08-16 06:16 MDT — the pulse from which cadence was starved.
    expect(denverLabel(Date.UTC(2026, 7, 16, 12, 16, 0))).toBe('2026-08-16 06:16:00 -06:00');
    // 2026-08-18 18:19 MDT — the rebaseline.
    expect(denverLabel(Date.UTC(2026, 7, 19, 0, 19, 0))).toBe('2026-08-18 18:19:00 -06:00');
  });

  it('formats elapsed durations the Session log uses', () => {
    expect(humanDuration(215_179_000)).toBe('59h 46m 19s'); // the ~59.8h incident call
    expect(humanDuration(90_000)).toBe('0h 1m 30s');
  });
});
