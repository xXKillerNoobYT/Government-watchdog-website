/**
 * Scheduled-sync quota preflight, fail-over/defer policy, and reset-aware catch-up.
 *
 * GOV-2259 (GH website#249). Scheduled Government Watchdog operations (the
 * auto-go/sync/scanner lanes) were spawning turns that hit an agent's *weekly*
 * model allowance, failing in under four seconds with `acpx_turn_failed`
 * `exitCode=1` and `issueId=null`, leaving no durable owner for the skipped work
 * and re-selecting the same exhausted adapter on retry. This module converts that
 * repeated judgement call into a deterministic, logged, idempotent decision.
 *
 * WHAT THIS IS — and is NOT.
 *   - It is the *deterministic core* a scheduled run consults BEFORE it starts
 *     issue work, plus a durable deferral ledger and the catch-up query. All
 *     decision functions are pure: they take an explicit `nowMs` and a ledger
 *     object, never `Date.now()`, so a synthetic exhausted-quota test can drive
 *     every branch reproducibly (`test/scheduled-sync-guard.test.ts`).
 *   - It is NOT the control-plane admission itself. WHERE the harness/scheduler
 *     invokes this preflight is owner-delegated machine-local wiring, escalated
 *     separately — this file does not, and must not, spawn runs, publish, send,
 *     or select real credentials. See
 *     `docs/company-os/scheduled-sync-quota-failover-runbook.md`.
 *
 * SAFETY. Failure output is sanitized: `sanitizeForOperator` collapses a raw
 * provider payload to a single allowed classification line and strips anything
 * resembling a credential, path, URL, email, or civic record. No provider
 * payload, token, private path, or civic value is ever written to the ledger or
 * the log. `--apply` is explicit; the default is a read-only dry run.
 *
 * The `.mjs`/`.ts` split (CLAUDE.md §4): this file is never typechecked, so it
 * uses `node:*` freely; the pure decision functions it exports are imported by
 * the `.ts` test, which stays within the no-@types/node rule.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const LEDGER_VERSION = 1;

/**
 * The one reset-time timezone the platform reasons in. Provider messages quote
 * America/Denver; catch-up pulses and operator reports are stated in it too.
 */
export const RESET_TIME_ZONE = 'America/Denver';

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// ---------------------------------------------------------------------------
// Timezone: wall-clock in a named zone -> absolute instant (no library).
// ---------------------------------------------------------------------------

/**
 * Offset in ms such that `utcMs = localWallMs - offset`, for `instantMs` viewed
 * in `timeZone`. Computed by formatting the instant into the zone and diffing.
 */
function zoneOffsetMs(instantMs, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const p = {};
  for (const part of dtf.formatToParts(instantMs)) p[part.type] = part.value;
  // `hour` can format midnight as '24' in some engines; normalise.
  const hour = p.hour === '24' ? 0 : Number(p.hour);
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour, Number(p.minute), Number(p.second));
  return asUtc - instantMs;
}

/**
 * Convert a wall-clock time in `timeZone` to an absolute epoch-ms instant.
 * DST-correct: computes the offset at a first guess, then re-checks once at the
 * candidate instant so a reading near a spring-forward/fall-back boundary lands
 * on the right side.
 */
export function zonedWallClockToInstantMs({ year, month, day, hour, minute = 0 }, timeZone) {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let offset = zoneOffsetMs(naiveUtc, timeZone);
  let instant = naiveUtc - offset;
  const offset2 = zoneOffsetMs(instant, timeZone);
  if (offset2 !== offset) {
    offset = offset2;
    instant = naiveUtc - offset;
  }
  return instant;
}

/** Format an instant as a wall-clock string in `timeZone` for operator reports. */
export function formatInZone(instantMs, timeZone = RESET_TIME_ZONE) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p = {};
  for (const part of dtf.formatToParts(instantMs)) p[part.type] = part.value;
  const hour = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day} ${hour}:${p.minute} (${timeZone})`;
}

// ---------------------------------------------------------------------------
// Sanitization — nothing but an allowed classification reaches ledger or log.
// ---------------------------------------------------------------------------

const SECRET_LIKE = [
  /https?:\/\/\S+/gi,                     // URLs
  /[\w.+-]+@[\w-]+\.[\w.-]+/gi,           // emails
  /(?:\/[\w.-]+){2,}/g,                   // absolute-ish paths
  /\b[A-Za-z0-9_-]{24,}\b/g,              // long tokens / keys / hashes
  /(?:sk|pk|ghp|gho|xox[baprs])[-_][A-Za-z0-9]{8,}/gi, // known token prefixes
];

/**
 * Reduce any raw provider text to a safe single line. We never echo the payload;
 * we emit only the classification and, when present, the parsed reset wall-clock.
 * Everything else is dropped, not merely masked, so a novel secret shape can't
 * ride through in an unexpected field. `nowMs` is threaded to
 * `classifyProviderError` so the reset year is chosen relative to the caller's
 * clock, never `Date.now()` at read time — the output is fully deterministic
 * under a fixed `nowMs` and cannot rot as wall-clock time passes.
 */
export function sanitizeForOperator(rawMessage, nowMs = Date.now()) {
  const cls = classifyProviderError(rawMessage, nowMs);
  if (cls.kind === 'weekly_limit_exhausted') {
    return cls.resetInstantMs != null
      ? `weekly model allowance exhausted; resets ${formatInZone(cls.resetInstantMs)}`
      : 'weekly model allowance exhausted; reset time not stated';
  }
  // Non-quota: report the classification only, never the raw text.
  return 'non-quota failure classification; details withheld';
}

/** True if `text` still carries anything secret-shaped. For the leak test. */
export function hasSecretLikeContent(text) {
  return SECRET_LIKE.some((re) => {
    re.lastIndex = 0;
    return re.test(String(text));
  });
}

// ---------------------------------------------------------------------------
// Classification — is this a weekly-limit exhaustion, and when does it reset?
// ---------------------------------------------------------------------------

/**
 * Classify a (already provider-sanitized) error message.
 *   { kind: 'weekly_limit_exhausted', resetLocal, timeZone, resetInstantMs }
 *   { kind: 'other' }
 *
 * `nowMs` disambiguates the year, which provider messages omit: the reset is the
 * first occurrence of the stated month/day/time at or after `nowMs`.
 */
export function classifyProviderError(rawMessage, nowMs = Date.now()) {
  const text = String(rawMessage ?? '');
  const isWeekly = /weekly\s+limit/i.test(text) || /weekly\s+(model\s+)?allowance/i.test(text);
  if (!isWeekly) return { kind: 'other' };

  // e.g. "resets Aug 24 at 10am (America/Denver)"
  const m = text.match(
    /resets?\s+([A-Za-z]{3,9})\.?\s+(\d{1,2})\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );
  if (!m) return { kind: 'weekly_limit_exhausted', resetLocal: null, timeZone: RESET_TIME_ZONE, resetInstantMs: null };

  const monthKey = m[1].slice(0, 3).toLowerCase();
  const month = MONTHS[monthKey];
  const day = Number(m[2]);
  let hour = Number(m[3]);
  const minute = m[4] ? Number(m[4]) : 0;
  const ampm = m[5] ? m[5].toLowerCase() : null;
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  if (!month || day < 1 || day > 31 || hour > 23) {
    return { kind: 'weekly_limit_exhausted', resetLocal: null, timeZone: RESET_TIME_ZONE, resetInstantMs: null };
  }

  const zoneMatch = text.match(/\(([A-Za-z]+\/[A-Za-z_]+)\)/);
  const timeZone = zoneMatch ? zoneMatch[1] : RESET_TIME_ZONE;

  // Choose the year that puts the reset at/after now (weekly resets are near).
  const nowYear = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric' }).format(nowMs),
  );
  let resetInstantMs = zonedWallClockToInstantMs({ year: nowYear, month, day, hour, minute }, timeZone);
  if (resetInstantMs < nowMs - 36 * 3600 * 1000) {
    // Rolled past year boundary (e.g. Jan reset seen from December).
    resetInstantMs = zonedWallClockToInstantMs({ year: nowYear + 1, month, day, hour, minute }, timeZone);
  }
  const resetLocal = formatInZone(resetInstantMs, timeZone);
  return { kind: 'weekly_limit_exhausted', resetLocal, timeZone, resetInstantMs };
}

// ---------------------------------------------------------------------------
// Catch-up pulse — first cadence-aligned wake strictly after the reset.
// ---------------------------------------------------------------------------

/**
 * First eligible catch-up pulse: the earliest instant that is (a) strictly after
 * the reset and (b) on the lane's cadence grid measured from the reset. With no
 * cadence, the pulse is the reset instant plus a one-minute settle.
 */
export function nextCatchUpPulseMs(resetInstantMs, cadenceMinutes = 0) {
  if (!Number.isFinite(resetInstantMs)) return null;
  if (!cadenceMinutes || cadenceMinutes <= 0) return resetInstantMs + 60_000;
  return resetInstantMs + cadenceMinutes * 60_000;
}

// ---------------------------------------------------------------------------
// Ledger — durable, idempotent deferral records.
// ---------------------------------------------------------------------------

export function emptyLedger() {
  return { version: LEDGER_VERSION, deferrals: [] };
}

/** Stable identity of a deferral: one lane + one reset instant = one record. */
function deferralKey(lane, resetInstantMs) {
  return `${lane}::${resetInstantMs}`;
}

/**
 * Insert or refresh a deferral. Idempotent by (lane, resetInstantMs): recording
 * the same exhaustion twice changes nothing and reports `changed:false`, which is
 * how "one bounded policy, not repeated invocation of the same unavailable
 * adapter" (AC2) is proven. Returns a NEW ledger; the input is not mutated.
 */
export function upsertDeferral(ledger, entry) {
  const base = ledger && Array.isArray(ledger.deferrals) ? ledger : emptyLedger();
  const key = deferralKey(entry.lane, entry.resetInstantMs);
  const deferrals = base.deferrals.map((d) => ({ ...d }));
  const idx = deferrals.findIndex((d) => deferralKey(d.lane, d.resetInstantMs) === key);
  const record = {
    lane: entry.lane,
    reason: entry.reason ?? 'weekly_limit_exhausted',
    resetLocal: entry.resetLocal ?? null,
    timeZone: entry.timeZone ?? RESET_TIME_ZONE,
    resetInstantMs: entry.resetInstantMs,
    evidenceInvalidated: entry.evidenceInvalidated ?? [],
    catchUpPulseMs: entry.catchUpPulseMs ?? nextCatchUpPulseMs(entry.resetInstantMs),
    recordedAtMs: entry.recordedAtMs,
    reconciledAtMs: null,
  };
  if (idx === -1) {
    deferrals.push(record);
    return { ledger: { version: LEDGER_VERSION, deferrals }, changed: true, created: true };
  }
  // Already deferred for this (lane, reset): keep the original record — its first
  // recordedAtMs, its catch-up pulse, any reconciliation — and change nothing.
  // Same key = same deferral; recording it again is a no-op. This is idempotency.
  return { ledger: base, changed: false, created: false };
}

/**
 * The bounded admission decision a scheduled run makes BEFORE it starts work.
 * Exactly one action, and it never re-selects a known-exhausted adapter:
 *
 *   proceed        primary adapter available, lane not deferred -> run now.
 *   fallback       primary exhausted, an APPROVED fallback is available -> run it.
 *   wait_deferred  lane already deferred, reset not reached -> do nothing (no
 *                  retry, no second invocation of the exhausted adapter).
 *   defer          nothing available and no live deferral -> record ONE deferral.
 *   catch_up       lane was deferred and the reset has passed -> reconcile.
 */
export function decideAdmission({
  lane,
  nowMs,
  ledger,
  primaryAvailable,
  fallbackAvailable = false,
}) {
  const deferrals = ledger && Array.isArray(ledger.deferrals) ? ledger.deferrals : [];
  const live = deferrals
    .filter((d) => d.lane === lane && d.reconciledAtMs == null)
    .sort((a, b) => b.resetInstantMs - a.resetInstantMs)[0];

  if (live) {
    if (nowMs >= live.resetInstantMs) return { action: 'catch_up', deferral: live };
    return { action: 'wait_deferred', deferral: live };
  }
  if (primaryAvailable) return { action: 'proceed', adapter: 'primary' };
  if (fallbackAvailable) return { action: 'fallback', adapter: 'fallback' };
  return { action: 'defer' };
}

/**
 * Deferrals whose reset has passed and that are not yet reconciled — the missed
 * lanes to catch up. `activeLanes` are lanes with a live Codex/Paperclip run;
 * a due catch-up on an active lane is HELD, not returned, so reconciliation
 * never overlaps an active run (AC5).
 */
export function dueCatchUps(ledger, nowMs, activeLanes = []) {
  const active = new Set(activeLanes);
  const deferrals = ledger && Array.isArray(ledger.deferrals) ? ledger.deferrals : [];
  const due = [];
  const held = [];
  for (const d of deferrals) {
    if (d.reconciledAtMs != null) continue;
    if (nowMs < d.resetInstantMs) continue;
    if (active.has(d.lane)) held.push(d);
    else due.push(d);
  }
  return { due, held };
}

export function markReconciled(ledger, lane, resetInstantMs, nowMs) {
  const base = ledger && Array.isArray(ledger.deferrals) ? ledger : emptyLedger();
  const key = deferralKey(lane, resetInstantMs);
  let changed = false;
  const deferrals = base.deferrals.map((d) => {
    if (deferralKey(d.lane, d.resetInstantMs) === key && d.reconciledAtMs == null) {
      changed = true;
      return { ...d, reconciledAtMs: nowMs };
    }
    return { ...d };
  });
  return { ledger: { version: LEDGER_VERSION, deferrals }, changed };
}

// ---------------------------------------------------------------------------
// I/O + CLI (impure; not exercised by the typed test, run at the shell).
// ---------------------------------------------------------------------------

function stateDir() {
  return process.env.GW_SCHED_SYNC_STATE_DIR
    ? resolve(process.env.GW_SCHED_SYNC_STATE_DIR)
    : resolve(REPO_ROOT, '.scheduled-sync-state');
}
function ledgerPath() { return join(stateDir(), 'deferral-ledger.json'); }
function logPath() { return join(stateDir(), 'scheduled-sync-guard.log'); }

function ts(nowMs) {
  // `[YYYY-MM-DD HH:MM:SS]` wall-clock, stated in the platform's reset zone so
  // every scheduled-sync log line reads in the same timezone as the reset times.
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: RESET_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const p = {};
  for (const part of dtf.formatToParts(nowMs)) p[part.type] = part.value;
  const hour = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day} ${hour}:${p.minute}:${p.second}`;
}

function logLine(level, message, nowMs = Date.now()) {
  const line = `[${ts(nowMs)}] [${level}] ${message}`;
  process.stdout.write(line + '\n');
  try {
    mkdirSync(stateDir(), { recursive: true });
    appendFileSync(logPath(), line + '\n');
  } catch {
    // Logging must never mask the primary decision; stdout already carried it.
  }
  return line;
}

export function loadLedger() {
  const p = ledgerPath();
  if (!existsSync(p)) return emptyLedger();
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf8'));
    if (!parsed || !Array.isArray(parsed.deferrals)) return emptyLedger();
    return parsed;
  } catch {
    return emptyLedger();
  }
}

function saveLedger(ledger) {
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(ledgerPath(), JSON.stringify(ledger, null, 2) + '\n');
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { args[key] = true; }
      else { args[key] = next; i++; }
    } else { args._.push(a); }
  }
  return args;
}

function requireLane(args, nowMs) {
  const lane = typeof args.lane === 'string' ? args.lane.trim() : '';
  if (!lane) {
    logLine('ERROR', 'rejected: --lane is required and must be a non-empty cadence-lane id', nowMs);
    process.exit(2);
  }
  return lane;
}

function main(argv) {
  const args = parseArgs(argv);
  const nowMs = args.now ? Date.parse(String(args.now)) : Date.now();
  if (Number.isNaN(nowMs)) {
    logLine('ERROR', 'rejected: --now is not a parseable timestamp', Date.now());
    process.exit(2);
  }
  const apply = args.apply === true;

  if (args.preflight) {
    const lane = requireLane(args, nowMs);
    const ledger = loadLedger();
    const primaryAvailable = !(args['primary-exhausted'] === true);
    const fallbackAvailable = args['fallback-available'] === true;
    const decision = decideAdmission({ lane, nowMs, ledger, primaryAvailable, fallbackAvailable });
    logLine('INFO', `preflight lane=${lane} -> ${decision.action}`, nowMs);
    process.stdout.write(JSON.stringify(decision) + '\n');
    process.exit(0);
  }

  if (args['record-deferral']) {
    const lane = requireLane(args, nowMs);
    let raw = '';
    if (typeof args['message-file'] === 'string') {
      try { raw = readFileSync(resolve(String(args['message-file'])), 'utf8'); }
      catch { logLine('ERROR', 'rejected: --message-file unreadable', nowMs); process.exit(2); }
    } else if (typeof args.message === 'string') { raw = args.message; }
    else { logLine('ERROR', 'rejected: provide --message or --message-file', nowMs); process.exit(2); }

    const cls = classifyProviderError(raw, nowMs);
    if (cls.kind !== 'weekly_limit_exhausted') {
      // Out-of-scope input rejected with a logged reason; not silently accepted.
      logLine('INFO', 'not a weekly-limit exhaustion; no deferral recorded (out of scope)', nowMs);
      process.exit(0);
    }
    const cadence = args['cadence-min'] ? Number(args['cadence-min']) : 0;
    const evidence = typeof args.evidence === 'string' ? String(args.evidence).split(',').map((s) => s.trim()).filter(Boolean) : ['scheduled-sync'];
    const entry = {
      lane, reason: 'weekly_limit_exhausted',
      resetLocal: cls.resetLocal, timeZone: cls.timeZone, resetInstantMs: cls.resetInstantMs,
      evidenceInvalidated: evidence,
      catchUpPulseMs: nextCatchUpPulseMs(cls.resetInstantMs, cadence),
      recordedAtMs: nowMs,
    };
    const before = loadLedger();
    const { ledger, created } = upsertDeferral(before, entry);
    const summary = sanitizeForOperator(raw, nowMs);
    if (!apply) {
      logLine('INFO', `dry-run: would ${created ? 'record' : 'keep existing'} deferral lane=${lane} (${summary}); catch-up ${formatInZone(entry.catchUpPulseMs)}`, nowMs);
      process.exit(0);
    }
    if (created) { saveLedger(ledger); logLine('INFO', `recorded deferral lane=${lane} (${summary}); catch-up ${formatInZone(entry.catchUpPulseMs)}`, nowMs); }
    else { logLine('INFO', `idempotent: deferral already recorded lane=${lane} (${summary}); no change`, nowMs); }
    process.exit(0);
  }

  if (args['catch-up']) {
    const ledger = loadLedger();
    const activeLanes = typeof args['active-lane'] === 'string' ? String(args['active-lane']).split(',').map((s) => s.trim()).filter(Boolean) : [];
    const { due, held } = dueCatchUps(ledger, nowMs, activeLanes);
    logLine('INFO', `catch-up: ${due.length} due, ${held.length} held (overlap-guarded)`, nowMs);
    process.stdout.write(JSON.stringify({ due, held }) + '\n');
    process.exit(0);
  }

  if (args.reconcile) {
    const lane = requireLane(args, nowMs);
    const ledger = loadLedger();
    const live = ledger.deferrals.filter((d) => d.lane === lane && d.reconciledAtMs == null).sort((a, b) => b.resetInstantMs - a.resetInstantMs)[0];
    if (!live) { logLine('INFO', `nothing to reconcile for lane=${lane}`, nowMs); process.exit(0); }
    const { ledger: next, changed } = markReconciled(ledger, lane, live.resetInstantMs, nowMs);
    if (!apply) { logLine('INFO', `dry-run: would reconcile lane=${lane}`, nowMs); process.exit(0); }
    if (changed) { saveLedger(next); logLine('INFO', `reconciled lane=${lane}`, nowMs); }
    process.exit(0);
  }

  process.stdout.write(
    'scheduled-sync-guard — GOV-2259 quota preflight / defer / catch-up\n' +
    'usage:\n' +
    '  --preflight --lane <lane> [--primary-exhausted] [--fallback-available] [--now <iso>]\n' +
    '  --record-deferral --lane <lane> (--message <s> | --message-file <p>) [--cadence-min N] [--evidence a,b] [--apply]\n' +
    '  --catch-up [--active-lane a,b] [--now <iso>]\n' +
    '  --reconcile --lane <lane> [--apply]\n' +
    'Default is a read-only dry run; state under $GW_SCHED_SYNC_STATE_DIR or <repo>/.scheduled-sync-state\n',
  );
  process.exit(0);
}

// Only run the CLI when invoked directly, never on import (keeps the test pure).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
