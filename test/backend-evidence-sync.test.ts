import { describe, expect, it } from 'vitest';
// @ts-expect-error The repository intentionally carries no global Node typings;
// this test needs only the executable subprocess seam for scope-rejection proof.
import { spawnSync } from 'node:child_process';

declare const process: {
  cwd(): string;
  execPath: string;
};

// The production reader is an executable JavaScript module rather than app code.
// @ts-expect-error No declaration file is needed for this workflow helper.
import { ALLOWED_REPO, EXIT, VERDICT, classifyHealth, isFeatureDisabled, logLine, parseArgs, sanitizeIssue, sanitizePull, verdictExit, _setClock } from '../scripts/backend-evidence-sync.mjs';

const SCRIPT = 'scripts/backend-evidence-sync.mjs';

describe('GOV-2274 backend-evidence-sync — health classification (pure)', () => {
  it('maps an unusable token to AUTH_FAILURE, before any repo status', () => {
    expect(classifyHealth({ tokenValid: false, repoStatus: 200 })).toBe(VERDICT.AUTH_FAILURE);
    expect(classifyHealth({ tokenValid: true, repoStatus: 401 })).toBe(VERDICT.AUTH_FAILURE);
  });

  it('distinguishes FORBIDDEN (authorized-but-denied) from NOT_FOUND (absent/hidden)', () => {
    expect(classifyHealth({ tokenValid: true, repoStatus: 403, repoMessage: 'Must have admin rights' }))
      .toBe(VERDICT.FORBIDDEN);
    expect(classifyHealth({ tokenValid: true, repoStatus: 404 })).toBe(VERDICT.NOT_FOUND);
  });

  it('treats a "feature not enabled" 403 on the repo probe as non-fatal, not FORBIDDEN', () => {
    // A 403 whose message says the feature is off is a config state, not a denial.
    expect(classifyHealth({ tokenValid: true, repoStatus: 403, repoMessage: 'Advanced Security is not enabled' }))
      .not.toBe(VERDICT.FORBIDDEN);
  });

  it('is HEALTHY only when repo=200 and no surface errored', () => {
    expect(classifyHealth({ tokenValid: true, repoStatus: 200, surfaceErrors: 0 })).toBe(VERDICT.HEALTHY);
    expect(classifyHealth({ tokenValid: true, repoStatus: 200, surfaceErrors: 1 })).toBe(VERDICT.DEGRADED);
    expect(classifyHealth({ tokenValid: true, repoStatus: 500 })).toBe(VERDICT.DEGRADED);
  });

  it('every verdict maps to a distinct, fail-closed (non-zero except HEALTHY) exit code', () => {
    expect(verdictExit(VERDICT.HEALTHY)).toBe(EXIT.HEALTHY);
    expect(verdictExit(VERDICT.AUTH_FAILURE)).toBe(EXIT.AUTH_FAILURE);
    expect(verdictExit(VERDICT.FORBIDDEN)).toBe(EXIT.FORBIDDEN);
    expect(verdictExit(VERDICT.NOT_FOUND)).toBe(EXIT.NOT_FOUND);
    expect(verdictExit(VERDICT.DEGRADED)).toBe(EXIT.DEGRADED);
    // Access-failure and absence are DIFFERENT codes — the acceptance criterion.
    expect(EXIT.AUTH_FAILURE).not.toBe(EXIT.NOT_FOUND);
    expect(EXIT.FORBIDDEN).not.toBe(EXIT.NOT_FOUND);
    for (const v of Object.values(VERDICT)) {
      if (v === VERDICT.HEALTHY) continue;
      expect(verdictExit(v)).not.toBe(0);
    }
  });
});

describe('GOV-2274 backend-evidence-sync — isFeatureDisabled (pure)', () => {
  it('recognises the code-scanning / advanced-security disabled shapes', () => {
    expect(isFeatureDisabled(403, 'Code scanning is not enabled for this repository.')).toBe(true);
    expect(isFeatureDisabled(403, 'Advanced Security must be enabled')).toBe(true);
  });
  it('does not treat a genuine denial or a non-403 as feature-disabled', () => {
    expect(isFeatureDisabled(403, 'Resource not accessible by personal access token')).toBe(false);
    expect(isFeatureDisabled(404, 'Not Found')).toBe(false);
    expect(isFeatureDisabled(200, '')).toBe(false);
  });
});

describe('GOV-2274 backend-evidence-sync — sanitization (pure, PUBLIC-repo safety)', () => {
  it('sanitizeIssue keeps triage metadata but never carries a body', () => {
    const out = sanitizeIssue({
      number: 5,
      state: 'open',
      title: 'A private title',
      body: 'SECRET private issue body that must never surface',
      labels: [{ name: 'bug' }, 'area:x'],
      user: { login: 'someone' },
      created_at: 't1',
      updated_at: 't2',
    });
    expect(out.number).toBe(5);
    expect(out.labels).toEqual(['bug', 'area:x']);
    expect(JSON.stringify(out)).not.toContain('SECRET');
    expect(JSON.stringify(out)).not.toContain('body');
    expect(JSON.stringify(out)).not.toContain('someone'); // author identity dropped
  });

  it('sanitizePull reports head by SHA only — never the head ref (branch name) or body', () => {
    const out = sanitizePull(
      {
        number: 9,
        state: 'open',
        draft: true,
        title: 'PR title',
        body: 'private PR body',
        base: { ref: 'main' },
        head: { ref: 'feature/secret-codename', sha: 'deadbeef00' },
      },
      [{ state: 'APPROVED' }, { state: 'APPROVED' }, { state: 'CHANGES_REQUESTED' }],
      { total: 3, by_conclusion: { success: 3 } },
      { mergeable: true, mergeable_state: 'clean' },
    );
    expect(out.head_sha).toBe('deadbeef00');
    expect(out.base_ref).toBe('main');
    expect(out.review_states).toEqual({ APPROVED: 2, CHANGES_REQUESTED: 1 });
    expect(out.mergeable_state).toBe('clean');
    const s = JSON.stringify(out);
    expect(s).not.toContain('secret-codename'); // branch name never leaks
    expect(s).not.toContain('private PR body');
    expect(s).not.toContain('head_ref');
  });
});

describe('GOV-2274 backend-evidence-sync — log line format (pure)', () => {
  it('emits the AOE [YYYY-MM-DD HH:MM:SS] [LEVEL] shape', () => {
    _setClock(() => new Date(Date.UTC(2026, 7, 25, 4, 5, 6)));
    try {
      expect(logLine('INFO', 'hello')).toBe('[2026-08-25 04:05:06] [INFO] hello');
    } finally {
      _setClock(null);
    }
  });
});

describe('GOV-2274 backend-evidence-sync — argument scope lock (pure)', () => {
  it('accepts the two subcommands against the backend by default', () => {
    expect(parseArgs(['health'])).toMatchObject({ cmd: 'health', repo: ALLOWED_REPO });
    expect(parseArgs(['collect', '--out', '/tmp/x.json'])).toMatchObject({ cmd: 'collect', out: '/tmp/x.json' });
  });
  it('rejects any repo other than the backend, and unknown subcommands', () => {
    expect(parseArgs(['health', '--repo', 'xXKillerNoobYT/Government-watchdog-website']).error).toBe(EXIT.SCOPE_REJECTED);
    expect(parseArgs(['bogus']).error).toBe(EXIT.USAGE);
    expect(parseArgs(['collect', '--nope']).error).toBe(EXIT.USAGE);
  });
});

describe('GOV-2274 backend-evidence-sync — CLI seam (out-of-scope rejected with non-zero exit)', () => {
  it('the executable refuses an alternate repository and exits SCOPE_REJECTED', () => {
    const r = spawnSync(
      process.execPath,
      [SCRIPT, 'health', '--repo', 'xXKillerNoobYT/Government-watchdog-website'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    expect(r.status).toBe(EXIT.SCOPE_REJECTED);
    expect(r.stderr).toContain('out of scope');
  });

  it('the executable exits USAGE on an unknown subcommand', () => {
    const r = spawnSync(process.execPath, [SCRIPT, 'wat'], { cwd: process.cwd(), encoding: 'utf8' });
    expect(r.status).toBe(EXIT.USAGE);
  });
});
