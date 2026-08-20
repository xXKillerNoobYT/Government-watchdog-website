/**
 * GOV-2135 / website#229 — heartbeat run guard: bound browser-audit calls and
 * recover stale heartbeat runs.
 *
 * WHY THIS EXISTS
 * ---------------
 * Scheduled heartbeats in this repo run browser/viewport audit calls that drive
 * a `vite preview` / `vite` server through Playwright (`scripts/local_e2e.sh`,
 * `scripts/gov1569-shot.mjs`). website#229 recorded the failure this module
 * removes: a viewport-emulation call ran ~59.8h and a later one ~28h despite a
 * nominal 90s *tool* timeout — the tool timeout gave no HARD cancel — and the
 * spawned Vite child survived the owning call, starving the two-hour cadence.
 *
 * The fix is deterministic and lives OUTSIDE the called tool:
 *
 *   1. HARD wall-clock cancellation. `runBounded()` spawns the audit command in
 *      its OWN process group (`detached:true`) and, when a parent-side deadline
 *      shorter than the heartbeat interval fires, kills the WHOLE group
 *      (SIGTERM -> grace -> SIGKILL). The tool cannot opt out — cooperative
 *      cancellation is irrelevant because the group is signalled from the parent.
 *   2. RECURSIVE cleanup. Killing the process group reaches the Vite child (and
 *      any grandchild) because they inherit the group. After the kill the guard
 *      VERIFIES the owned ports are no longer listening.
 *   3. A DURABLE LEASE. `lease.json` records runId, owner, lane, start, deadline,
 *      current step, pgid and owned ports. Its deadline is a wall-clock instant,
 *      so the lease EXPIRES INDEPENDENTLY OF THE WORKER even if the worker wedges.
 *   4. STALE-RUN RECOVERY. The next heartbeat calls `recoverStale()` first: an
 *      expired lease (or one whose worker pgid is dead) is marked stale, its
 *      surviving group killed, its ports freed, an append-only Session record is
 *      written, and the lease is cleared — so the pulse resumes instead of
 *      deferring indefinitely.
 *   5. CADENCE RECONCILIATION. `reconcileCadence()` computes, in America/Denver,
 *      which lane pulses were missed and a DEDUPED catch-up plan (one entry per
 *      lane) so missed lanes are caught up without overlapping or duplicating.
 *
 * SAFETY / SCOPE
 * --------------
 * This module is ADDITIVE. It changes no automation prompt, schedule, authority
 * boundary, private-beta gate, or publication-safety check. It never reaches the
 * network beyond loopback port probes it owns. Destructive actions (killing a
 * group, clearing a lease) require `--apply`; the default is a dry-run plan.
 *
 * This is a build/ops module, never shipped to the browser and never typechecked
 * (no `@types/node` in this repo — see CLAUDE.md §4), so it uses `node:` builtins
 * freely. Its synthetic test is `test/heartbeat-guard.test.ts`, which runs under
 * `npm test` — a required CI check — so a regression in hard cancellation,
 * recursive cleanup, lease expiry, recovery, or catch-up fails the build.
 */

import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The heartbeat cadence: one pulse every two hours. */
export const DEFAULT_INTERVAL_MS = 2 * 60 * 60 * 1000;

/** Grace between the cooperative SIGTERM and the hard SIGKILL. */
export const DEFAULT_GRACE_MS = 5000;

/** IANA zone the cadence is expressed in. */
export const DENVER_TZ = 'America/Denver';

/**
 * Default lane rotation. These mirror the ten heartbeat areas in
 * `docs/auto-go-heartbeat.md`. A caller may pass its own lane list; the
 * reconciliation logic is lane-list-driven and makes no assumption about names.
 */
export const DEFAULT_LANES = [
  'gate',
  'shell-nav',
  'pages-civic',
  'data-contract',
  'honesty-ledger',
  'build-guards',
  'deploy-release',
  'intake-upload',
  'a11y-responsive',
  'ci-tooling',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Time helpers (America/Denver, DST-aware via Intl — no external dependency)
// ---------------------------------------------------------------------------

/** Break an instant into its America/Denver wall-clock components. */
export function zonedParts(epochMs, tz = DENVER_TZ) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p = Object.fromEntries(
    dtf.formatToParts(new Date(epochMs)).filter((x) => x.type !== 'literal').map((x) => [x.type, x.value]),
  );
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Signed zone offset (ms) at a given instant. Negative west of UTC. */
export function zoneOffsetMs(epochMs, tz = DENVER_TZ) {
  const p = zonedParts(epochMs, tz);
  const asUTC = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  return asUTC - epochMs;
}

const pad2 = (n) => String(n).padStart(2, '0');

/** e.g. "2026-08-16 06:16:00 -06:00" — a full, unambiguous Denver stamp. */
export function denverLabel(epochMs) {
  const p = zonedParts(epochMs, DENVER_TZ);
  const off = zoneOffsetMs(epochMs, DENVER_TZ);
  const sign = off <= 0 ? '-' : '+';
  const abs = Math.abs(off);
  const oh = pad2(Math.floor(abs / 3600000));
  const om = pad2(Math.floor((abs % 3600000) / 60000));
  return `${p.y}-${pad2(p.mo)}-${pad2(p.d)} ${pad2(p.h)}:${pad2(p.mi)}:${pad2(p.s)} ${sign}${oh}:${om}`;
}

/** Epoch of 00:00 America/Denver on the day containing `epochMs`. */
export function denverMidnight(epochMs) {
  const p = zonedParts(epochMs, DENVER_TZ);
  const guessUTC = Date.UTC(p.y, p.mo - 1, p.d, 0, 0, 0);
  const off = zoneOffsetMs(guessUTC, DENVER_TZ);
  return guessUTC - off;
}

export function humanDuration(ms) {
  const neg = ms < 0;
  let s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  return `${neg ? '-' : ''}${h}h ${m}m ${s}s`;
}

// ---------------------------------------------------------------------------
// Process-group control — the hard-cancellation primitive
// ---------------------------------------------------------------------------

/** True while the process group `pgid` still has any member. */
export function pgidAlive(pgid) {
  if (!Number.isFinite(pgid) || pgid <= 1) return false;
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (err) {
    // ESRCH -> the group is empty (gone). EPERM -> exists but not ours (alive).
    return err && err.code === 'EPERM';
  }
}

/** Is anything listening on a loopback port? */
export function isPortListening(port, host = '127.0.0.1', timeoutMs = 300) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host });
    let done = false;
    const fin = (v) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(v);
    };
    sock.once('connect', () => fin(true));
    sock.once('error', () => fin(false));
    sock.setTimeout(timeoutMs, () => fin(false));
  });
}

/** Poll until `port` reaches the desired listening state, or time out. */
export async function waitForPort(port, { listening = true, timeoutMs = 3000, host = '127.0.0.1' } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await isPortListening(port, host)) === listening) return true;
    await sleep(25);
  }
  return (await isPortListening(port, host)) === listening;
}

export async function verifyPortsFree(ports = [], host = '127.0.0.1') {
  for (const p of ports) {
    if (await isPortListening(p, host)) return false;
  }
  return true;
}

/**
 * Terminate an entire process group. SIGTERM first (cooperative), then — if the
 * group is still alive after `graceMs`, as it will be for a call that ignores
 * cooperative cancellation — an unconditional SIGKILL. Returns what actually
 * happened so the caller can surface a cleanup failure as a required-check fail.
 */
export async function killProcessGroup(pgid, { graceMs = DEFAULT_GRACE_MS } = {}) {
  if (!pgidAlive(pgid)) return { killed: false, sigterm: false, sigkill: false, groupGone: true };
  try {
    process.kill(-pgid, 'SIGTERM');
  } catch {
    /* group vanished between the check and the signal — fine */
  }
  const softDeadline = Date.now() + graceMs;
  while (Date.now() < softDeadline) {
    if (!pgidAlive(pgid)) return { killed: true, sigterm: true, sigkill: false, groupGone: true };
    await sleep(25);
  }
  // Still alive after the grace window -> escalate. This is the path that
  // actually killed the 59.8h/28h website#229 calls, which ignored the soft signal.
  try {
    process.kill(-pgid, 'SIGKILL');
  } catch {
    /* raced to exit */
  }
  const hardDeadline = Date.now() + 1000;
  while (Date.now() < hardDeadline) {
    if (!pgidAlive(pgid)) return { killed: true, sigterm: true, sigkill: true, groupGone: true };
    await sleep(25);
  }
  return { killed: true, sigterm: true, sigkill: true, groupGone: !pgidAlive(pgid) };
}

/** Spawn `command args` as the leader of a fresh process group; return its pgid. */
export function spawnDetachedGroup(command, args = [], { env, cwd } = {}) {
  const child = spawn(command, args, {
    detached: true, // new session -> child.pid is the new group's id
    stdio: 'ignore',
    env: env || process.env,
    cwd,
  });
  child.unref();
  return child.pid;
}

/** Absolute path to the Node binary running this process (safe for `command`). */
export function nodeExecPath() {
  return process.execPath;
}

/**
 * Run `command args` under a HARD wall-clock deadline enforced from the parent.
 *
 * If the child (and its group) exits on its own before `deadlineMs`, the run is
 * `completed`/`failed` by its exit code. If the deadline fires first, the whole
 * group is killed (SIGTERM -> grace -> SIGKILL), the owned ports are checked, and
 * the run is `timeout`. The tool's own cooperative timeout is never trusted.
 */
export async function runBounded({
  command,
  args = [],
  deadlineMs,
  graceMs = DEFAULT_GRACE_MS,
  ports = [],
  env,
  cwd,
  onSpawn,
} = {}) {
  if (!command) throw new Error('runBounded: command is required');
  if (!Number.isFinite(deadlineMs) || deadlineMs <= 0) throw new Error('runBounded: deadlineMs must be a positive number');

  const start = Date.now();
  let child;
  try {
    child = spawn(command, args, { detached: true, stdio: 'ignore', env: env || process.env, cwd });
  } catch (err) {
    return { status: 'spawn-error', error: String((err && err.message) || err), killed: false, elapsedMs: 0 };
  }
  const pgid = child.pid;
  if (typeof onSpawn === 'function') onSpawn(pgid);

  return await new Promise((resolve) => {
    let settled = false;
    let deadlineHit = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ pgid, elapsedMs: Date.now() - start, ports, ...result });
    };
    const timer = setTimeout(async () => {
      deadlineHit = true;
      const kill = await killProcessGroup(pgid, { graceMs });
      const portsFreed = await verifyPortsFree(ports);
      finish({
        status: 'timeout',
        killed: kill.killed,
        escalatedToSigkill: kill.sigkill,
        groupGone: kill.groupGone,
        portsFreed,
        cleanExit: kill.groupGone && portsFreed,
      });
    }, deadlineMs);
    child.on('exit', (code, signal) => {
      if (deadlineHit) return; // the timeout path owns the resolution
      finish({
        status: code === 0 ? 'completed' : 'failed',
        code,
        signal,
        killed: false,
        groupGone: true,
        portsFreed: true,
        cleanExit: true,
      });
    });
    child.on('error', (err) => {
      if (deadlineHit) return;
      finish({ status: 'spawn-error', error: String((err && err.message) || err), killed: false, cleanExit: false });
    });
  });
}

// ---------------------------------------------------------------------------
// Durable lease + append-only Session log
// ---------------------------------------------------------------------------

export function leasePath(dir) {
  return path.join(dir, 'lease.json');
}
export function sessionsPath(dir) {
  return path.join(dir, 'sessions.jsonl');
}
export function completionsPath(dir) {
  return path.join(dir, 'completions.json');
}

/** Write JSON atomically (tmp + rename) so a lease is never half-written. */
export function atomicWriteJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Math.floor(Date.now())}`;
  fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

export function readLease(dir) {
  const f = leasePath(dir);
  if (!fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
}

export function writeLease(dir, lease) {
  atomicWriteJson(leasePath(dir), lease);
  return lease;
}

export function clearLease(dir) {
  const f = leasePath(dir);
  if (fs.existsSync(f)) fs.rmSync(f);
}

/** A lease is expired once its wall-clock deadline has passed. */
export function isLeaseExpired(lease, nowEpochMs) {
  return !lease || !Number.isFinite(lease.deadlineEpochMs) || nowEpochMs > lease.deadlineEpochMs;
}

/**
 * Acquire the run lease. Refuses only when a lease with a still-future deadline
 * is present (a genuinely live run). An expired lease is superseded and reported
 * so the caller can run recovery on it.
 */
export function acquireLease(dir, lease, { nowEpochMs = Date.now() } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const existing = readLease(dir);
  if (existing && !isLeaseExpired(existing, nowEpochMs)) {
    return { acquired: false, reason: 'live-lease-held', existing };
  }
  writeLease(dir, lease);
  return { acquired: true, lease, supersededStale: existing || null };
}

export function appendSession(dir, record) {
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(sessionsPath(dir), `${JSON.stringify(record)}\n`);
  return record;
}

export function readSessions(dir) {
  const f = sessionsPath(dir);
  if (!fs.existsSync(f)) return [];
  return fs
    .readFileSync(f, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return { malformed: l };
      }
    });
}

export function recordCompletion(dir, lane, epochMs) {
  fs.mkdirSync(dir, { recursive: true });
  let map = {};
  const f = completionsPath(dir);
  if (fs.existsSync(f)) {
    try {
      map = JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch {
      map = {};
    }
  }
  if (!(map[lane] >= epochMs)) map[lane] = epochMs;
  atomicWriteJson(f, map);
  return map;
}

export function readCompletions(dir) {
  const f = completionsPath(dir);
  if (!fs.existsSync(f)) return {};
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return {};
  }
}

export function logLine(logPath, level, msg, nowEpochMs = Date.now()) {
  const p = zonedParts(nowEpochMs);
  const ts = `${p.y}-${pad2(p.mo)}-${pad2(p.d)} ${pad2(p.h)}:${pad2(p.mi)}:${pad2(p.s)}`;
  const line = `[${ts}] [${level}] ${msg}\n`;
  if (logPath) {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, line);
  }
  return line;
}

// ---------------------------------------------------------------------------
// Stale-run recovery — what the next heartbeat runs FIRST
// ---------------------------------------------------------------------------

/**
 * Detect and recover a stale lease. Stale means the deadline has passed OR the
 * worker's process group is dead. With `apply:false` (default) this only reports
 * what it WOULD do. With `apply:true` it kills any survivor, frees the owned
 * ports, writes an append-only Session record, and clears the lease.
 */
export async function recoverStale({ dir, nowEpochMs = Date.now(), apply = false, logPath } = {}) {
  const lease = readLease(dir);
  if (!lease) return { stale: false, action: 'none', reason: 'no-lease' };

  const expired = isLeaseExpired(lease, nowEpochMs);
  const alive = pgidAlive(lease.pgid);
  if (!expired && alive) {
    return { stale: false, action: 'none', reason: 'live', lease };
  }

  const elapsedMs = nowEpochMs - (lease.startEpochMs ?? nowEpochMs);
  const report = {
    stale: true,
    runId: lease.runId,
    lane: lease.lane,
    owner: lease.owner,
    step: lease.step,
    elapsedMs,
    elapsedHuman: humanDuration(elapsedMs),
    deadlineExceededMs: nowEpochMs - lease.deadlineEpochMs,
    workerDead: !alive,
    reason: expired ? 'deadline-exceeded' : 'worker-dead',
  };

  if (!apply) {
    report.action = 'would-recover';
    return report;
  }

  const cleanup = { killed: false, escalatedToSigkill: false, groupGone: true, portsFreed: true };
  if (alive) {
    const k = await killProcessGroup(lease.pgid);
    cleanup.killed = k.killed;
    cleanup.escalatedToSigkill = k.sigkill;
    cleanup.groupGone = k.groupGone;
  }
  if (Array.isArray(lease.ports) && lease.ports.length) {
    cleanup.portsFreed = await verifyPortsFree(lease.ports);
  }

  const session = {
    type: 'stale-run-recovery',
    recoveredAtEpochMs: nowEpochMs,
    recoveredAtDenver: denverLabel(nowEpochMs),
    runId: lease.runId,
    lane: lease.lane,
    owner: lease.owner,
    step: lease.step,
    startedAtDenver: lease.startEpochMs ? denverLabel(lease.startEpochMs) : null,
    elapsedMs,
    elapsedHuman: humanDuration(elapsedMs),
    reason: report.reason,
    ports: lease.ports || [],
    cleanup,
    evidenceInvalidated:
      `heartbeat lane "${lease.lane}" run ${lease.runId} did not complete; any audit result it ` +
      'would have produced is absent and must NOT be treated as release evidence (website#229 safety clause)',
    nextDue: lease.lane,
  };
  appendSession(dir, session);
  clearLease(dir);

  report.action = 'recovered';
  report.cleanup = cleanup;
  report.session = session;
  if (logPath) {
    logLine(
      logPath,
      cleanup.groupGone && cleanup.portsFreed ? 'WARN' : 'ERROR',
      `recovered stale run ${lease.runId} lane=${lease.lane} elapsed=${humanDuration(elapsedMs)} ` +
        `killed=${cleanup.killed} sigkill=${cleanup.escalatedToSigkill} portsFreed=${cleanup.portsFreed}`,
      nowEpochMs,
    );
  }
  return report;
}

// ---------------------------------------------------------------------------
// Cadence reconciliation — America/Denver, deterministic, dedup-ed catch-up
// ---------------------------------------------------------------------------

/**
 * Given the lane rotation, an anchor instant, the pulse interval, and a map of
 * each lane's last-completion instant, compute which pulses were missed up to
 * `nowEpochMs` and a DEDUPED catch-up plan (one entry per lane, earliest missed
 * pulse first) so missed lanes are caught up without overlapping or duplicating.
 * Lanes named in `inProgressLanes` are excluded from catch-up. Pure and total.
 */
export function reconcileCadence({
  lanes = DEFAULT_LANES,
  anchorEpochMs,
  intervalMs = DEFAULT_INTERVAL_MS,
  lastCompleted = {},
  nowEpochMs,
  inProgressLanes = [],
} = {}) {
  if (!Array.isArray(lanes) || lanes.length === 0) throw new Error('reconcileCadence: lanes must be a non-empty array');
  if (!Number.isFinite(anchorEpochMs)) throw new Error('reconcileCadence: anchorEpochMs must be a finite number');
  if (!Number.isFinite(nowEpochMs)) throw new Error('reconcileCadence: nowEpochMs must be a finite number');
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new Error('reconcileCadence: intervalMs must be positive');

  const inProgress = new Set(inProgressLanes);
  const missed = [];
  const lastIdx = Math.floor((nowEpochMs - anchorEpochMs) / intervalMs);
  for (let i = 0; i <= lastIdx; i++) {
    const pulseEpochMs = anchorEpochMs + i * intervalMs;
    if (pulseEpochMs > nowEpochMs) break;
    const lane = lanes[((i % lanes.length) + lanes.length) % lanes.length];
    const done = lastCompleted[lane];
    // A pulse is satisfied only if the lane completed at or after this instant.
    if (done != null && done >= pulseEpochMs) continue;
    missed.push({ pulseIndex: i, pulseEpochMs, pulseDenver: denverLabel(pulseEpochMs), lane });
  }

  const seen = new Set();
  const catchUp = [];
  for (const m of missed) {
    if (inProgress.has(m.lane) || seen.has(m.lane)) continue;
    seen.add(m.lane);
    catchUp.push({
      lane: m.lane,
      earliestMissedPulseEpochMs: m.pulseEpochMs,
      earliestMissedPulseDenver: m.pulseDenver,
      missedCount: missed.filter((x) => x.lane === m.lane).length,
    });
  }

  return {
    nowEpochMs,
    nowDenver: denverLabel(nowEpochMs),
    anchorEpochMs,
    anchorDenver: denverLabel(anchorEpochMs),
    intervalMs,
    lanes,
    inProgressLanes: [...inProgress],
    missed,
    catchUp,
  };
}

// ---------------------------------------------------------------------------
// Test/CLI scaffolding helpers
// ---------------------------------------------------------------------------

export function makeTempStateDir(prefix = 'heartbeat-guard') {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}
/** Bind port 0 on loopback and return the OS-assigned free port. */
export function getFreePort(host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, host, () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
  });
}
export function rmStateDir(dir) {
  if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}
export function currentPid() {
  return process.pid;
}

/** Repo-relative default state dir (durable across heartbeats). Gitignored. */
export function defaultStateDir() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, '..', '.heartbeat-guard');
}

/** Absolute path to the synthetic uncancellable browser-audit stand-in. */
export function hangWorkloadPath() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, 'heartbeat-guard-hang.mjs');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { _: [], cmd: [] };
  let sawDashDash = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (sawDashDash) {
      out.cmd.push(a);
      continue;
    }
    if (a === '--') {
      sawDashDash = true;
      continue;
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function printJson(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

async function cliRun(a) {
  const stateDir = a['state-dir'] || defaultStateDir();
  const logPath = path.join(stateDir, 'guard.log');
  const lane = a.lane || 'unspecified';
  const owner = a.owner || process.env.PAPERCLIP_AGENT_ID || 'AutomationOpsEngineer';
  const deadlineSeconds = Number(a['deadline-seconds'] || 0);
  const graceMs = Number(a['grace-seconds'] || DEFAULT_GRACE_MS / 1000) * 1000;
  const ports = String(a.ports || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const apply = a.apply === true;

  if (!deadlineSeconds || deadlineSeconds <= 0) {
    process.stderr.write('run: --deadline-seconds <N> is required (must be > 0 and < the 2h heartbeat interval)\n');
    return 1;
  }
  const deadlineMs = deadlineSeconds * 1000;
  if (deadlineMs >= DEFAULT_INTERVAL_MS) {
    process.stderr.write(
      `run: --deadline-seconds ${deadlineSeconds} is not shorter than the ${DEFAULT_INTERVAL_MS / 1000}s heartbeat ` +
        'interval; a deadline must fire before the next pulse (website#229 AC1)\n',
    );
    return 1;
  }
  if (a.cmd.length === 0) {
    process.stderr.write('run: a command is required after `--` (e.g. -- node scripts/gov1569-shot.mjs)\n');
    return 1;
  }

  // The next-heartbeat contract: recover any prior stale run FIRST.
  const recovery = await recoverStale({ dir: stateDir, apply, logPath });

  if (!apply) {
    printJson({
      mode: 'dry-run',
      note: 'no process spawned, no lease written, no kill performed; re-run with --apply to execute',
      lane,
      owner,
      deadlineSeconds,
      ports,
      command: a.cmd,
      staleRecovery: recovery,
    });
    return 0;
  }

  const now = Date.now();
  const runId = `${lane}-${now}-${Math.floor(process.pid)}`;
  const acq = acquireLease(
    stateDir,
    {
      runId,
      owner,
      lane,
      step: 'browser-audit',
      startEpochMs: now,
      startDenver: denverLabel(now),
      deadlineEpochMs: now + deadlineMs,
      deadlineDenver: denverLabel(now + deadlineMs),
      ports,
      command: a.cmd,
      pgid: null,
    },
    { nowEpochMs: now },
  );
  if (!acq.acquired) {
    process.stderr.write(`run: a live lease is held (runId=${acq.existing?.runId}); refusing to start a second run\n`);
    printJson({ mode: 'apply', refused: true, existing: acq.existing });
    return 1;
  }
  logLine(logPath, 'INFO', `start run ${runId} lane=${lane} deadline=${deadlineSeconds}s ports=[${ports.join(',')}]`);

  const result = await runBounded({
    command: a.cmd[0],
    args: a.cmd.slice(1),
    deadlineMs,
    graceMs,
    ports,
    onSpawn: (pgid) => {
      const lease = readLease(stateDir);
      if (lease && lease.runId === runId) writeLease(stateDir, { ...lease, pgid });
    },
  });

  const endNow = Date.now();
  const session = {
    type: 'bounded-run',
    runId,
    lane,
    owner,
    startedAtDenver: denverLabel(now),
    endedAtDenver: denverLabel(endNow),
    elapsedHuman: humanDuration(result.elapsedMs),
    status: result.status,
    ports,
    cleanup: {
      killed: !!result.killed,
      escalatedToSigkill: !!result.escalatedToSigkill,
      groupGone: !!result.groupGone,
      portsFreed: !!result.portsFreed,
    },
    evidenceInvalidated:
      result.status === 'completed'
        ? null
        : `lane "${lane}" audit did not complete cleanly (${result.status}); its result is not release evidence`,
    nextDue: result.status === 'completed' ? null : lane,
  };
  appendSession(stateDir, session);
  clearLease(stateDir);

  if (result.status === 'completed') {
    recordCompletion(stateDir, lane, endNow);
    logLine(logPath, 'INFO', `run ${runId} completed in ${humanDuration(result.elapsedMs)}`);
    printJson({ mode: 'apply', result, session, staleRecovery: recovery });
    return 0;
  }
  if (result.status === 'failed') {
    logLine(logPath, 'ERROR', `run ${runId} command exited non-zero (code=${result.code})`);
    printJson({ mode: 'apply', result, session });
    return 2;
  }
  if (result.status === 'timeout') {
    const clean = result.groupGone && result.portsFreed;
    logLine(
      logPath,
      clean ? 'WARN' : 'ERROR',
      `run ${runId} TIMED OUT after ${humanDuration(result.elapsedMs)}; hard-cancelled group ` +
        `killed=${result.killed} sigkill=${result.escalatedToSigkill} portsFreed=${result.portsFreed}`,
    );
    printJson({
      mode: 'apply',
      result,
      session,
      diagnostic: clean
        ? `Audit for lane "${lane}" exceeded its ${deadlineSeconds}s bound and was hard-cancelled. The audit ` +
          'did not finish; its output is not release evidence. Investigate the audit command, then re-run.'
        : `CLEANUP FAILED after hard-cancelling lane "${lane}": groupGone=${result.groupGone} ` +
          `portsFreed=${result.portsFreed}. A survivor process or bound port remains — inspect ` +
          `\`node scripts/heartbeat-guard.mjs status --state-dir ${stateDir}\` and free ports ${ports.join(',')} manually.`,
    });
    return clean ? 3 : 4; // distinct codes: bounded-but-incomplete vs cleanup failure
  }
  logLine(logPath, 'ERROR', `run ${runId} spawn error: ${result.error}`);
  printJson({ mode: 'apply', result, session });
  return 1;
}

async function cliRecover(a) {
  const stateDir = a['state-dir'] || defaultStateDir();
  const logPath = path.join(stateDir, 'guard.log');
  const apply = a.apply === true;
  const rep = await recoverStale({ dir: stateDir, apply, logPath });
  printJson({ mode: apply ? 'apply' : 'dry-run', recovery: rep });
  if (apply && rep.stale && rep.cleanup && !(rep.cleanup.groupGone && rep.cleanup.portsFreed)) return 4;
  return 0;
}

function cliReconcile(a) {
  const stateDir = a['state-dir'] || defaultStateDir();
  const nowEpochMs = a.now ? Date.parse(a.now) : Date.now();
  if (!Number.isFinite(nowEpochMs)) {
    process.stderr.write(`reconcile: --now "${a.now}" is not a parseable timestamp\n`);
    return 1;
  }
  const lanes = a.lanes ? String(a.lanes).split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_LANES;
  const intervalMs = a['interval-seconds'] ? Number(a['interval-seconds']) * 1000 : DEFAULT_INTERVAL_MS;
  const anchorEpochMs = a.anchor ? Date.parse(a.anchor) : denverMidnight(nowEpochMs);
  const lastCompleted = readCompletions(stateDir);
  const lease = readLease(stateDir);
  const inProgressLanes = lease && !isLeaseExpired(lease, nowEpochMs) && lease.lane ? [lease.lane] : [];
  const report = reconcileCadence({ lanes, anchorEpochMs, intervalMs, lastCompleted, nowEpochMs, inProgressLanes });
  printJson({ mode: 'read-only', reconcile: report });
  return 0;
}

function cliStatus(a) {
  const stateDir = a['state-dir'] || defaultStateDir();
  const lease = readLease(stateDir);
  const now = Date.now();
  const sessions = readSessions(stateDir).slice(-5);
  printJson({
    stateDir,
    lease: lease
      ? { ...lease, expired: isLeaseExpired(lease, now), workerAlive: pgidAlive(lease.pgid), nowDenver: denverLabel(now) }
      : null,
    completions: readCompletions(stateDir),
    recentSessions: sessions,
  });
  return 0;
}

/**
 * End-to-end self-check: spawn the synthetic uncancellable workload, bound it,
 * and assert hard cancellation, recursive cleanup, lease expiry, recovery, and
 * catch-up all behave. Exits non-zero on any failure. The vitest test is the
 * required-check version of this; `selfcheck` is for manual verification.
 */
async function cliSelfcheck() {
  const dir = makeTempStateDir('heartbeat-guard-selfcheck');
  const checks = [];
  const ok = (name, cond, detail) => {
    checks.push({ name, pass: !!cond, detail });
    return !!cond;
  };
  try {
    const port = await getFreePort();

    // 1) Hard cancellation + recursive cleanup of an uncancellable workload.
    const run = await runBounded({
      command: nodeExecPath(),
      args: [hangWorkloadPath(), String(port)],
      deadlineMs: 700,
      graceMs: 150,
      ports: [port],
    });
    ok('hard-cancel: status is timeout', run.status === 'timeout', run.status);
    ok('hard-cancel: escalated to SIGKILL (soft signal ignored)', run.escalatedToSigkill === true);
    ok('recursive-cleanup: process group gone', run.groupGone === true);
    ok('recursive-cleanup: owned port freed', run.portsFreed === true);

    // 2) Lease expiry + recovery of a wedged run.
    const start = 1_700_000_000_000;
    writeLease(dir, {
      runId: 'selfcheck-stale',
      owner: 'selfcheck',
      lane: 'ci-tooling',
      step: 'browser-audit',
      startEpochMs: start,
      deadlineEpochMs: start + 90_000,
      ports: [],
      pgid: 2_147_480_000, // not a live group
    });
    const rec = await recoverStale({ dir, nowEpochMs: start + 60 * 60 * 1000, apply: true });
    ok('recovery: stale lease detected', rec.stale === true, rec.reason);
    ok('recovery: lease cleared', readLease(dir) === null);
    ok('recovery: session appended', readSessions(dir).some((s) => s.type === 'stale-run-recovery'));

    // 3) Cadence catch-up is deduped.
    const anchor = 1_700_000_000_000;
    const iv = DEFAULT_INTERVAL_MS;
    const rc = reconcileCadence({
      lanes: ['a', 'b', 'c'],
      anchorEpochMs: anchor,
      intervalMs: iv,
      lastCompleted: { a: anchor + 3 * iv, c: anchor + 5 * iv },
      nowEpochMs: anchor + Math.floor(5.5 * iv),
    });
    ok('catch-up: only lane b is missed', rc.catchUp.length === 1 && rc.catchUp[0].lane === 'b', JSON.stringify(rc.catchUp));
    ok('catch-up: deduped missedCount is 2', rc.catchUp[0] && rc.catchUp[0].missedCount === 2);
  } finally {
    rmStateDir(dir);
  }
  const failed = checks.filter((c) => !c.pass);
  printJson({ selfcheck: failed.length === 0 ? 'PASS' : 'FAIL', checks });
  return failed.length === 0 ? 0 : 1;
}

async function main() {
  const argv = process.argv.slice(2);
  const sub = argv[0];
  const a = parseArgs(argv.slice(1));
  let code = 0;
  switch (sub) {
    case 'run':
      code = await cliRun(a);
      break;
    case 'recover':
      code = await cliRecover(a);
      break;
    case 'reconcile':
      code = cliReconcile(a);
      break;
    case 'status':
      code = cliStatus(a);
      break;
    case 'selfcheck':
      code = await cliSelfcheck();
      break;
    default:
      process.stdout.write(
        [
          'heartbeat-guard — bound browser-audit calls and recover stale heartbeat runs (website#229)',
          '',
          'Usage:',
          '  node scripts/heartbeat-guard.mjs run --lane <L> --deadline-seconds <N> [--ports 4173,8791]',
          '        [--grace-seconds 5] [--owner <id>] [--state-dir <dir>] [--apply] -- <command...>',
          '  node scripts/heartbeat-guard.mjs recover [--apply] [--state-dir <dir>]',
          '  node scripts/heartbeat-guard.mjs reconcile [--now <iso>] [--anchor <iso>] [--lanes a,b,c] [--state-dir <dir>]',
          '  node scripts/heartbeat-guard.mjs status [--state-dir <dir>]',
          '  node scripts/heartbeat-guard.mjs selfcheck',
          '',
          'Defaults are DRY-RUN. `run`/`recover` need --apply to spawn, kill, or clear a lease.',
          'Exit codes for `run --apply`: 0 completed · 2 command-failed · 3 timed-out(clean cancel)',
          '  · 4 cleanup-failure (survivor/port) · 1 usage/spawn error.',
        ].join('\n') + '\n',
      );
      code = sub ? 1 : 0;
  }
  process.exitCode = code;
}

// Only run the CLI when invoked directly, never when imported by the test.
if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  main().catch((err) => {
    process.stderr.write(`heartbeat-guard: fatal: ${(err && err.stack) || err}\n`);
    process.exitCode = 1;
  });
}
