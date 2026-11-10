/**
 * GOV-2274 ([GH WEB#255]) — restore private-backend GitHub evidence access for
 * the scheduled synchronization lane.
 *
 * WHY THIS EXISTS
 * ---------------
 * The backend repo `xXKillerNoobYT/Government-watchdog` is PRIVATE (re-measured
 * 2026-08-25: `isPrivate:true`). The sync lane's previous GitHub connector path
 * returned a sanitized not-found for it, so backend issue / PR / review / check /
 * mergeability / alert evidence could not refresh and every backend PR decision
 * was stuck HOLD. The authenticated `gh` CLI (token scope `repo`, viewer
 * permission ADMIN on the backend) reads all of those surfaces cleanly — the
 * failing connector was simply a different, unauthorized path.
 *
 * This module routes the sync lane's *read-only* backend evidence through the
 * authenticated `gh` transport, deterministically, with two hard boundaries:
 *
 *   1. SANITIZED OUTPUT. This website repo is PUBLIC. Private issue/PR *bodies*
 *      and *titles*, author logins, and head *branch names* must never reach a
 *      log line or the console — only counts, numbers, opaque SHAs, states,
 *      booleans, enums, severities and timestamps do. The evidence bundle file
 *      (written to a gitignored / scratch path, never committed) may carry
 *      titles for triage but NEVER bodies.
 *
 *   2. FAIL-CLOSED. Any auth failure, forbidden, not-found, or unexpected error
 *      on a required surface exits non-zero. The caller MUST treat a non-zero
 *      exit as "evidence unavailable → keep HOLD". Only exit 0 means the bundle
 *      is complete and fresh. There is no cached/partial fallback here.
 *
 * SCOPE LOCK. The only repository this script will ever read is the backend
 * pinned in ALLOWED_REPO. `--repo` anything-else is rejected with a logged
 * reason and a non-zero exit — the issue's safety section explicitly forbids
 * "alternate repository routing".
 *
 * READ-ONLY. No endpoint here mutates. There is deliberately no `--apply`; the
 * only side effect is writing a sanitized JSON bundle to a caller-chosen path.
 *
 * Usage:
 *   node scripts/backend-evidence-sync.mjs health
 *       Sanitized health probe. Exit 0 = reachable & readable; non-zero = a
 *       specific fail-closed verdict (see EXIT). Distinguishes connector access
 *       failure from repository absence.
 *
 *   node scripts/backend-evidence-sync.mjs collect [--out PATH]
 *       Collect the sanitized evidence bundle (repo metadata, issue summary,
 *       open PRs with base/head SHA + draft + reviews + required checks +
 *       mergeability, recent merges, dependabot alert metadata) and write JSON
 *       to PATH. Default PATH: $PAPERCLIP_RUN_SCRATCH_DIR/backend-evidence.json
 *       else ./.backend-evidence/latest.json (gitignored). Fails closed.
 *
 * Env:
 *   GH_TOKEN / GITHUB_TOKEN   optional; otherwise `gh`'s own keyring auth is used.
 *   BACKEND_EVIDENCE_OUT      default --out path override.
 *
 * EXIT codes (all non-zero = fail-closed, caller keeps HOLD):
 *   0  HEALTHY        repo metadata + issues + pulls all readable
 *   2  USAGE          bad arguments / unknown subcommand
 *   3  SCOPE_REJECTED --repo names something other than the backend
 *   10 AUTH_FAILURE   token invalid/expired (`gh api user` fails, or 401)
 *   11 FORBIDDEN      token valid but 403 on the repo (authorized-but-denied)
 *   12 NOT_FOUND      404 on repo with a valid token (absent / renamed / hidden)
 *   13 DEGRADED       repo readable but a required surface errored unexpectedly
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

/** The one repository this lane is authorized to read. Nothing else, ever. */
export const ALLOWED_REPO = 'xXKillerNoobYT/Government-watchdog';

export const EXIT = Object.freeze({
  HEALTHY: 0,
  USAGE: 2,
  SCOPE_REJECTED: 3,
  AUTH_FAILURE: 10,
  FORBIDDEN: 11,
  NOT_FOUND: 12,
  DEGRADED: 13,
});

/** Health verdicts, one per non-DEGRADED terminal state, plus HEALTHY. */
export const VERDICT = Object.freeze({
  HEALTHY: 'HEALTHY',
  AUTH_FAILURE: 'AUTH_FAILURE',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  DEGRADED: 'DEGRADED',
});

const VERDICT_EXIT = Object.freeze({
  HEALTHY: EXIT.HEALTHY,
  AUTH_FAILURE: EXIT.AUTH_FAILURE,
  FORBIDDEN: EXIT.FORBIDDEN,
  NOT_FOUND: EXIT.NOT_FOUND,
  DEGRADED: EXIT.DEGRADED,
});

export function verdictExit(verdict) {
  return Object.prototype.hasOwnProperty.call(VERDICT_EXIT, verdict)
    ? VERDICT_EXIT[verdict]
    : EXIT.DEGRADED;
}

// ---------------------------------------------------------------------------
// PURE CLASSIFIERS (unit-tested; no I/O, no `gh`)
// ---------------------------------------------------------------------------

/**
 * True when a 403 is GitHub telling us a *feature* is off for the repo (e.g.
 * code scanning / secret scanning not enabled) rather than denying access. This
 * is a repo configuration state, NOT an access failure, and must not fail the
 * health verdict or trigger HOLD on its own.
 */
export function isFeatureDisabled(status, message) {
  if (status !== 403) return false;
  const m = String(message || '').toLowerCase();
  return (
    m.includes('not enabled') ||
    m.includes('disabled') ||
    m.includes('must enable') ||
    m.includes('advanced security')
  );
}

/**
 * Map the result of the repo-metadata probe to a health verdict.
 *
 * @param {{tokenValid:boolean, repoStatus:number, repoMessage?:string,
 *          surfaceErrors?:number}} probe
 *   tokenValid   — did `gh api user` succeed (is the token itself usable)?
 *   repoStatus   — HTTP status of GET repos/{ALLOWED_REPO} (200 on success).
 *   surfaceErrors— count of required non-repo surfaces (issues, pulls) that
 *                  errored unexpectedly after the repo read succeeded.
 */
export function classifyHealth(probe) {
  const {
    tokenValid = false,
    repoStatus = 0,
    repoMessage = '',
    surfaceErrors = 0,
  } = probe || {};

  // The token itself is unusable → the connector cannot authenticate at all.
  if (!tokenValid || repoStatus === 401) return VERDICT.AUTH_FAILURE;

  // Token is valid but GitHub actively denies this resource.
  if (repoStatus === 403 && !isFeatureDisabled(repoStatus, repoMessage)) {
    return VERDICT.FORBIDDEN;
  }

  // Token is valid but the repo is not there for us: genuinely absent, renamed,
  // or hidden from this token. We do NOT assert which — that is the honest,
  // fail-closed distinction the sanitized health check owes the caller.
  if (repoStatus === 404) return VERDICT.NOT_FOUND;

  if (repoStatus !== 200) return VERDICT.DEGRADED;

  // Repo read fine, but a required evidence surface broke unexpectedly.
  if (surfaceErrors > 0) return VERDICT.DEGRADED;

  return VERDICT.HEALTHY;
}

/**
 * Reduce an issue object to sanitized metadata. Keeps title (triage) but NEVER
 * body, and drops author identity. Bundle-only; not for logs.
 */
export function sanitizeIssue(issue) {
  return {
    number: issue.number,
    state: issue.state,
    title: issue.title, // bundle-only; never emitted to a log line
    labels: (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name)),
    is_pull_request: Boolean(issue.pull_request),
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    closed_at: issue.closed_at || null,
  };
}

/**
 * Reduce a PR + its review/check evidence to sanitized metadata. Head is
 * reported by SHA only — the head *ref* (branch name) can leak intent and is
 * dropped. Body is never included.
 */
export function sanitizePull(pr, reviews = [], checks = {}, merge = {}) {
  const reviewStates = {};
  for (const r of reviews) {
    const s = r.state || 'UNKNOWN';
    reviewStates[s] = (reviewStates[s] || 0) + 1;
  }
  return {
    number: pr.number,
    state: pr.state,
    draft: Boolean(pr.draft),
    title: pr.title, // bundle-only
    base_ref: pr.base?.ref ?? null, // typically "main"; safe
    head_sha: pr.head?.sha ?? null, // opaque hash, not the branch name
    merged: Boolean(pr.merged_at) || Boolean(merge.merged),
    merged_at: pr.merged_at || null,
    mergeable: merge.mergeable ?? pr.mergeable ?? null,
    mergeable_state: merge.mergeable_state ?? pr.mergeable_state ?? null,
    review_states: reviewStates,
    check_summary: checks,
    updated_at: pr.updated_at,
  };
}

/**
 * A log line for a PUBLIC repo's console/CI. Only structural metadata is
 * allowed. Titles/bodies/logins/branch names must never be passed here; this
 * helper additionally strips anything that looks like prose by refusing to
 * echo caller-supplied free text — callers pass a fixed label + numeric/enum
 * fields, never raw GitHub content.
 */
export function logLine(level, message) {
  const ts = timestamp();
  return `[${ts}] [${level}] ${message}`;
}

let _clock = null; // test seam
export function _setClock(fn) {
  _clock = fn;
}
function timestamp() {
  const d = _clock ? _clock() : new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  );
}

// ---------------------------------------------------------------------------
// IMPURE: `gh` transport + CLI (not unit-tested; exercised by real runs)
// ---------------------------------------------------------------------------

function log(level, message) {
  const stream = level === 'ERROR' ? process.stderr : process.stdout;
  stream.write(logLine(level, message) + '\n');
}

/**
 * Call `gh api PATH`. Returns { ok, status, message, json }. Never throws for
 * an HTTP error — the status is classified by the caller. Throws only if `gh`
 * itself is missing (that is an environment fault, surfaced loudly).
 */
function ghApi(apiPath) {
  const args = ['api', '-i', apiPath];
  let raw;
  try {
    raw = execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('`gh` CLI not found on PATH — cannot read backend evidence.');
    }
    // gh exits non-zero on HTTP >= 400 but still writes the full `-i` response
    // (headers + JSON body) to STDOUT; the human "gh: … (HTTP nnn)" line goes to
    // STDERR. Never merge them — that trailing prose breaks JSON.parse. Prefer
    // stdout; only fall back to stderr when stdout is empty (a real gh fault).
    const out = err.stdout && err.stdout.length ? err.stdout : err.stderr || '';
    if (!out) {
      return { ok: false, status: 0, message: String(err.message || 'gh failed'), json: null };
    }
    raw = out;
  }
  return parseGhResponse(raw);
}

/** Split `gh api -i` output into status + JSON body. */
function parseGhResponse(raw) {
  const headerEnd = raw.indexOf('\n\n') >= 0 ? raw.indexOf('\n\n') : raw.indexOf('\r\n\r\n');
  let status = 0;
  let bodyText = raw;
  if (headerEnd >= 0) {
    const header = raw.slice(0, headerEnd);
    bodyText = raw.slice(headerEnd).trim();
    const statusLine = header.split(/\r?\n/)[0] || '';
    const m = statusLine.match(/HTTP\/[\d.]+\s+(\d{3})/);
    if (m) status = Number(m[1]);
  }
  let json = null;
  let message = '';
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
    if (json && !Array.isArray(json) && typeof json.message === 'string') message = json.message;
  } catch {
    /* non-JSON body (rare for the api paths we use) */
  }
  return { ok: status >= 200 && status < 300, status, message, json };
}

/** Is the token itself usable at all? */
function probeToken() {
  const r = ghApi('user');
  return r.ok;
}

function runHealth() {
  const tokenValid = probeToken();
  const repo = ghApi(`repos/${ALLOWED_REPO}`);

  let surfaceErrors = 0;
  const surfaces = {};
  if (repo.ok) {
    for (const [name, path] of [
      ['issues', `repos/${ALLOWED_REPO}/issues?state=open&per_page=1`],
      ['pulls', `repos/${ALLOWED_REPO}/pulls?state=open&per_page=1`],
    ]) {
      const s = ghApi(path);
      surfaces[name] = s.ok ? 'ok' : `error:${s.status}`;
      if (!s.ok) surfaceErrors += 1;
    }
    // code scanning is allowed to be "not enabled" — reported, never fatal
    const cs = ghApi(`repos/${ALLOWED_REPO}/code-scanning/alerts?per_page=1`);
    surfaces.code_scanning = cs.ok
      ? 'ok'
      : isFeatureDisabled(cs.status, cs.message)
        ? 'feature_disabled'
        : `error:${cs.status}`;
  }

  const verdict = classifyHealth({
    tokenValid,
    repoStatus: repo.status,
    repoMessage: repo.message,
    surfaceErrors,
  });
  const exit = verdictExit(verdict);

  const level = exit === EXIT.HEALTHY ? 'INFO' : 'ERROR';
  log(level, `health: repo=${ALLOWED_REPO} token=${tokenValid ? 'valid' : 'INVALID'} ` +
    `repo_status=${repo.status} verdict=${verdict} exit=${exit}`);
  if (repo.ok) {
    log('INFO', `surfaces: ${Object.entries(surfaces).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  }
  if (verdict === VERDICT.NOT_FOUND) {
    log('ERROR', 'NOT_FOUND: token is valid but the backend repo is absent, renamed, ' +
      'or hidden from this token. This is NOT the same as an access failure. Keeping HOLD.');
  }
  if (verdict === VERDICT.AUTH_FAILURE) {
    log('ERROR', 'AUTH_FAILURE: the connector token is invalid/expired. Rotate/re-scope it. Keeping HOLD.');
  }
  if (verdict === VERDICT.FORBIDDEN) {
    log('ERROR', 'FORBIDDEN: token authenticates but is not authorized for the backend repo. Keeping HOLD.');
  }
  return exit;
}

function ghJson(apiPath) {
  const r = ghApi(apiPath);
  if (!r.ok) {
    const kind = isFeatureDisabled(r.status, r.message) ? 'feature_disabled' : 'error';
    return { ok: false, kind, status: r.status, data: null };
  }
  return { ok: true, kind: 'ok', status: r.status, data: r.json };
}

function collectBundle() {
  // Repo metadata first — this gates everything and drives the health verdict.
  const tokenValid = probeToken();
  const repo = ghJson(`repos/${ALLOWED_REPO}`);
  const verdict = classifyHealth({
    tokenValid,
    repoStatus: repo.status,
    repoMessage: repo.data?.message || '',
  });
  if (verdict !== VERDICT.HEALTHY) {
    log('ERROR', `collect aborted (fail-closed): verdict=${verdict}. No bundle written.`);
    return { exit: verdictExit(verdict), bundle: null };
  }

  const meta = repo.data;
  const issuesRes = ghJson(`repos/${ALLOWED_REPO}/issues?state=open&per_page=100`);
  const pullsRes = ghJson(`repos/${ALLOWED_REPO}/pulls?state=open&per_page=100`);
  if (!issuesRes.ok || !pullsRes.ok) {
    log('ERROR', `collect aborted (fail-closed): issues=${issuesRes.status} pulls=${pullsRes.status}. No bundle written.`);
    return { exit: EXIT.DEGRADED, bundle: null };
  }

  // issues endpoint returns PRs too; split them.
  const rawIssues = (issuesRes.data || []).filter((i) => !i.pull_request);
  const issues = rawIssues.map(sanitizeIssue);

  const pulls = [];
  for (const pr of pullsRes.data || []) {
    const reviews = ghJson(`repos/${ALLOWED_REPO}/pulls/${pr.number}/reviews?per_page=100`);
    const detail = ghJson(`repos/${ALLOWED_REPO}/pulls/${pr.number}`); // mergeable + mergeable_state
    let checks = { total: null };
    if (pr.head?.sha) {
      const cr = ghJson(`repos/${ALLOWED_REPO}/commits/${pr.head.sha}/check-runs`);
      if (cr.ok) {
        checks = summarizeChecks(cr.data);
      } else if (cr.kind === 'feature_disabled') {
        checks = { total: null, note: 'checks_unavailable' };
      } else {
        // A required surface for this PR errored → fail closed for the whole bundle.
        log('ERROR', `collect aborted (fail-closed): check-runs for PR #${pr.number} status=${cr.status}.`);
        return { exit: EXIT.DEGRADED, bundle: null };
      }
    }
    const detailData = detail.ok ? detail.data : {};
    pulls.push(sanitizePull(pr, reviews.ok ? reviews.data : [], checks, {
      mergeable: detailData.mergeable,
      mergeable_state: detailData.mergeable_state,
      merged: detailData.merged,
    }));
  }

  // Recently merged PRs (last 20 closed that were merged).
  const closedRes = ghJson(`repos/${ALLOWED_REPO}/pulls?state=closed&per_page=20&sort=updated&direction=desc`);
  const recentMerges = (closedRes.ok ? closedRes.data : [])
    .filter((p) => p.merged_at)
    .map((p) => ({ number: p.number, base_ref: p.base?.ref ?? null, merged_at: p.merged_at }));

  // Dependabot alert metadata (severity only, never secret values). "Disabled"
  // is a benign state, not an error.
  const depRes = ghJson(`repos/${ALLOWED_REPO}/dependabot/alerts?state=open&per_page=100`);
  let dependabot;
  if (depRes.ok) {
    const bySeverity = {};
    for (const a of depRes.data || []) {
      const sev = a.security_advisory?.severity || a.security_vulnerability?.severity || 'unknown';
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
    }
    dependabot = { available: true, open_count: (depRes.data || []).length, by_severity: bySeverity };
  } else {
    dependabot = { available: false, reason: depRes.kind === 'feature_disabled' ? 'disabled' : `error:${depRes.status}` };
  }

  const bundle = {
    schema_version: 1,
    generated_by: 'scripts/backend-evidence-sync.mjs (GOV-2274)',
    repo: {
      full_name: meta.full_name,
      private: meta.private,
      default_branch: meta.default_branch,
      pushed_at: meta.pushed_at,
    },
    counts: { open_issues: issues.length, open_pulls: pulls.length },
    issues,
    pulls,
    recent_merges: recentMerges,
    dependabot,
    health: { verdict: VERDICT.HEALTHY },
  };
  return { exit: EXIT.HEALTHY, bundle };
}

function summarizeChecks(payload) {
  const runs = payload?.check_runs || [];
  const byConclusion = {};
  for (const r of runs) {
    const c = r.conclusion || r.status || 'unknown';
    byConclusion[c] = (byConclusion[c] || 0) + 1;
  }
  return { total: payload?.total_count ?? runs.length, by_conclusion: byConclusion };
}

function resolveOutPath(argOut) {
  if (argOut) return isAbsolute(argOut) ? argOut : resolve(process.cwd(), argOut);
  if (process.env.BACKEND_EVIDENCE_OUT) return resolve(process.env.BACKEND_EVIDENCE_OUT);
  const scratch = process.env.PAPERCLIP_RUN_SCRATCH_DIR || process.env.PAPERCLIP_SCRATCH_DIR;
  if (scratch) return join(scratch, 'backend-evidence.json');
  return resolve(process.cwd(), '.backend-evidence', 'latest.json');
}

function runCollect(outPath) {
  const { exit, bundle } = collectBundle();
  if (exit !== EXIT.HEALTHY || !bundle) return exit;
  const dir = dirname(outPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(outPath, JSON.stringify(bundle, null, 2) + '\n');
  log('INFO', `collect: verdict=HEALTHY open_issues=${bundle.counts.open_issues} ` +
    `open_pulls=${bundle.counts.open_pulls} recent_merges=${bundle.recent_merges.length} ` +
    `dependabot=${bundle.dependabot.available ? bundle.dependabot.open_count : bundle.dependabot.reason}`);
  log('INFO', `bundle written: ${outPath}`);
  return EXIT.HEALTHY;
}

/** Parse argv into { cmd, repo, out }. Exits (via return code) on scope/usage. */
export function parseArgs(argv) {
  const args = argv.slice();
  const cmd = args.shift();
  let repo = ALLOWED_REPO;
  let out = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo') repo = args[++i];
    else if (args[i] === '--out') out = args[++i];
    else return { error: EXIT.USAGE, reason: `unknown argument: ${args[i]}` };
  }
  if (cmd !== 'health' && cmd !== 'collect') {
    return { error: EXIT.USAGE, reason: `unknown subcommand: ${cmd || '(none)'}` };
  }
  if (repo !== ALLOWED_REPO) {
    return { error: EXIT.SCOPE_REJECTED, reason: `--repo ${repo} is out of scope; only ${ALLOWED_REPO} is authorized` };
  }
  return { cmd, repo, out };
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    log('ERROR', parsed.reason);
    if (parsed.error === EXIT.USAGE) {
      log('INFO', 'usage: node scripts/backend-evidence-sync.mjs <health|collect> [--out PATH]');
    }
    process.exit(parsed.error);
  }
  const exit = parsed.cmd === 'health' ? runHealth() : runCollect(resolveOutPath(parsed.out));
  process.exit(exit);
}

// Only run the CLI when executed directly, not when imported by tests.
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
const selfPath = resolve(dirname(new URL(import.meta.url).pathname), 'backend-evidence-sync.mjs');
if (invokedPath === selfPath) main();
