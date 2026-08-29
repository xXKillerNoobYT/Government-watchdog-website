/**
 * GOV-2283 ([GH WEB#255] follow-up) — scheduled fail-closed entrypoint for the
 * read-only backend evidence lane (`scripts/backend-evidence-sync.mjs`).
 *
 * WHY THIS EXISTS
 * ---------------
 * GOV-2274 shipped the read capability + a sanitized, fail-closed `collect`. It
 * runs only on manual invocation. This wrapper is the single, host-independent
 * command a *scheduler* calls, and it exists to close exactly one gap that a
 * bare cron leaves open:
 *
 *   A2 / F3 — a scheduled job whose failure nobody is woken for. The base script
 *   already exits non-zero on any fail-closed verdict, but "surface that to an
 *   owner" is otherwise the host's job to remember. This wrapper makes it
 *   deterministic: on ANY non-zero collect, it writes a SANITIZED alert record
 *   to a private sink AND re-exits with the same non-zero code, so every host
 *   (backend CI cron → red run, machine-local cron → `|| notify`, an agent
 *   scheduled-task → files an issue) surfaces the failure the same way.
 *
 * IT ADDS NO CAPABILITY AND NO BOUNDARY CHANGE:
 *   - It only ever calls `collect` on the base script. No `--apply` exists here
 *     or there, and none is ever added (A3).
 *   - It is scope-locked by delegation: the base script rejects any `--repo`
 *     other than the one backend it is authorized to read; this wrapper never
 *     forwards a `--repo` override.
 *   - It writes NOTHING private to a log or a committed path. The alert record
 *     carries only an exit code, a derived verdict enum, a fixed lane label, a
 *     timestamp, and authored literal copy — never a title, body, head ref,
 *     author login, or any GitHub free text. The evidence bundle itself is
 *     written by the base script to a gitignored / scratch path, unchanged.
 *
 * Usage:
 *   node scripts/backend-evidence-sync-scheduled.mjs [--dry-run] [--out PATH] [--lane LABEL]
 *
 *   --dry-run   Print the plan (command, out path, alert path, lane) and exit 0
 *               WITHOUT running collect. No side effects — no `gh` call, no file
 *               written, no alert. This is the "scheduled dry-run has no side
 *               effects" acceptance property.
 *   --out PATH  Bundle output path (default: $BACKEND_EVIDENCE_OUT, else scratch,
 *               else ./.backend-evidence/latest.json — all gitignored/scratch).
 *   --lane STR  Fixed lane label for the alert record (default gov-backend-evidence).
 *
 * Exit codes: propagated verbatim from the base `collect` (0 = HEALTHY & fresh;
 * any non-zero = fail-closed, caller keeps HOLD). `--dry-run` always exits 0.
 * Usage errors exit 2.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXIT } from './backend-evidence-sync.mjs';

/** Absolute path to the base read-only lane this wrapper drives. */
const HERE = dirname(fileURLToPath(import.meta.url));
export const BASE_SCRIPT = join(HERE, 'backend-evidence-sync.mjs');

/** Default fixed lane label — an enum, never derived from GitHub content. */
export const DEFAULT_LANE = 'gov-backend-evidence';

/**
 * Fixed exit-code → verdict-enum map. This is the ONLY interpretation the
 * scheduled wrapper puts on a run; it never reads the bundle to build an alert,
 * so a private value cannot reach the alert by construction.
 */
const EXIT_VERDICT = Object.freeze({
  [EXIT.HEALTHY]: 'HEALTHY',
  [EXIT.USAGE]: 'USAGE',
  [EXIT.SCOPE_REJECTED]: 'SCOPE_REJECTED',
  [EXIT.AUTH_FAILURE]: 'AUTH_FAILURE',
  [EXIT.FORBIDDEN]: 'FORBIDDEN',
  [EXIT.NOT_FOUND]: 'NOT_FOUND',
  [EXIT.DEGRADED]: 'DEGRADED',
});

export function verdictForExit(exit) {
  return Object.prototype.hasOwnProperty.call(EXIT_VERDICT, exit)
    ? EXIT_VERDICT[exit]
    : 'UNKNOWN';
}

export function isSuccess(exit) {
  return exit === EXIT.HEALTHY;
}

// ---------------------------------------------------------------------------
// PURE CORE (unit-tested; no I/O, no spawn)
// ---------------------------------------------------------------------------

/**
 * Build the sanitized alert record for a failed scheduled run. The shape is
 * FIXED and closed: only an exit code, a derived verdict enum, a fixed lane
 * label, a timestamp, an action, and authored literal copy. There is no field
 * into which a GitHub title/body/branch/login could be placed, and this
 * function accepts none.
 */
export function buildAlertRecord(exit, { lane = DEFAULT_LANE, ts } = {}) {
  return {
    schema_version: 1,
    kind: 'scheduled-evidence-sync-alert',
    lane,
    exit,
    verdict: verdictForExit(exit),
    action: 'HOLD',
    ts: ts || new Date().toISOString(),
    note:
      'Scheduled backend evidence refresh failed fail-closed. Backend PR/sync ' +
      'decisions stay on HOLD until a HEALTHY run. See docs/gov2283-scheduled-evidence-sync.md.',
  };
}

/** A sanitized, structural log line (mirrors the base script's discipline). */
export function schedLogLine(level, message, ts = new Date().toISOString()) {
  return `[${ts}] [${level}] ${message}`;
}

/**
 * Orchestrate one scheduled run. Pure of process concerns: `run`, `writeAlert`,
 * `clearAlert`, and `emit` are injected so the fail-closed contract is testable
 * without spawning `gh` or touching disk.
 *
 * @returns {number} exit code to propagate to the host.
 */
export function runScheduled({
  dryRun = false,
  outPath,
  alertPath,
  lane = DEFAULT_LANE,
  run,
  writeAlert,
  clearAlert,
  emit = () => {},
  now = () => new Date().toISOString(),
}) {
  if (dryRun) {
    emit(schedLogLine('INFO',
      `dry-run: would run \`collect --out ${outPath}\` lane=${lane}; ` +
      `on non-zero would write alert=${alertPath}. No side effects.`, now()));
    return EXIT.HEALTHY;
  }

  const { exit } = run();

  if (isSuccess(exit)) {
    // Clear any stale alert so a recovered lane does not look failed. Idempotent:
    // clearing an absent alert is a no-op.
    clearAlert();
    emit(schedLogLine('INFO', `scheduled evidence refresh OK: exit=${exit} lane=${lane}`, now()));
    return EXIT.HEALTHY;
  }

  const record = buildAlertRecord(exit, { lane, ts: now() });
  writeAlert(record);
  emit(schedLogLine('ERROR',
    `scheduled evidence refresh FAILED (fail-closed): exit=${exit} ` +
    `verdict=${record.verdict} lane=${lane} → HOLD. alert=${alertPath}`, now()));
  return exit;
}

// ---------------------------------------------------------------------------
// CLI wiring (not unit-tested; exercised by real runs)
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  let dryRun = false;
  let out = null;
  let lane = DEFAULT_LANE;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') dryRun = true;
    else if (a === '--out') out = argv[++i];
    else if (a === '--lane') lane = argv[++i];
    else return { error: EXIT.USAGE, reason: `unknown argument: ${a}` };
  }
  return { dryRun, out, lane };
}

function resolveOutPath(argOut) {
  if (argOut) return isAbsolute(argOut) ? argOut : resolve(process.cwd(), argOut);
  if (process.env.BACKEND_EVIDENCE_OUT) return resolve(process.env.BACKEND_EVIDENCE_OUT);
  const scratch = process.env.PAPERCLIP_RUN_SCRATCH_DIR || process.env.PAPERCLIP_SCRATCH_DIR;
  if (scratch) return join(scratch, 'backend-evidence.json');
  return resolve(process.cwd(), '.backend-evidence', 'latest.json');
}

function resolveAlertPath() {
  if (process.env.BACKEND_EVIDENCE_ALERT) return resolve(process.env.BACKEND_EVIDENCE_ALERT);
  const scratch = process.env.PAPERCLIP_RUN_SCRATCH_DIR || process.env.PAPERCLIP_SCRATCH_DIR;
  if (scratch) return join(scratch, 'backend-evidence-alert.json');
  // Under the existing gitignored /.backend-evidence/ stanza — never committed.
  return resolve(process.cwd(), '.backend-evidence', 'alert.json');
}

function realRun(outPath) {
  // spawnSync (not execFileSync) so a non-zero exit is a value, not a throw.
  // stdio inherit lets the base script's ALREADY-SANITIZED stdout/stderr pass
  // straight through; this wrapper never re-logs GitHub content itself.
  const res = spawnSync('node', [BASE_SCRIPT, 'collect', '--out', outPath], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (res.error) {
    // Failure to even launch node/base is a fail-closed DEGRADED, not a green.
    process.stderr.write(schedLogLine('ERROR', `failed to launch base lane: ${res.error.code || 'spawn error'}`) + '\n');
    return { exit: EXIT.DEGRADED };
  }
  return { exit: res.status ?? EXIT.DEGRADED };
}

function realWriteAlert(alertPath) {
  return (record) => {
    const dir = dirname(alertPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(alertPath, JSON.stringify(record, null, 2) + '\n');
  };
}

function realClearAlert(alertPath) {
  return () => {
    if (existsSync(alertPath)) rmSync(alertPath);
  };
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    process.stderr.write(schedLogLine('ERROR', parsed.reason) + '\n');
    process.stderr.write(schedLogLine('INFO',
      'usage: node scripts/backend-evidence-sync-scheduled.mjs [--dry-run] [--out PATH] [--lane LABEL]') + '\n');
    process.exit(EXIT.USAGE);
  }
  const outPath = resolveOutPath(parsed.out);
  const alertPath = resolveAlertPath();
  const exit = runScheduled({
    dryRun: parsed.dryRun,
    outPath,
    alertPath,
    lane: parsed.lane,
    run: () => realRun(outPath),
    writeAlert: realWriteAlert(alertPath),
    clearAlert: realClearAlert(alertPath),
    emit: (line) => process.stdout.write(line + '\n'),
  });
  process.exit(exit);
}

// Only run the CLI when executed directly, not when imported by tests.
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
const selfPath = resolve(fileURLToPath(import.meta.url));
if (invokedPath === selfPath) main();
