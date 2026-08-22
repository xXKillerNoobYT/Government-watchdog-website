import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error The repository intentionally carries no global Node typings;
// this test needs only the executable subprocess seam for output-boundary proof.
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
  execPath: string;
};

// The production checker is an executable JavaScript module rather than app code.
// @ts-expect-error No declaration file is needed for this workflow helper.
import { containsPrivateAbsolutePath, inspectCleanupReport } from '../scripts/prepare-cleanup-report.mjs';

const WORKFLOW = readFileSync('.github/workflows/post-merge-cleanup.yml', 'utf8');
const SCRIPT = join(process.cwd(), 'scripts/prepare-cleanup-report.mjs');

function report(overrides: Record<string, unknown> = {}) {
  return {
    total_candidates: 3,
    would_remove_branches: 1,
    would_remove_worktrees: 1,
    preserved_count: 2,
    failed_count: 0,
    candidates: [],
    ...overrides,
  };
}

function runHelper(contents: Record<string, unknown>) {
  const cwd = mkdtempSync(join(tmpdir(), 'gw-cleanup-report-'));
  mkdirSync(join(cwd, 'Logs'));
  const relativeReport = 'Logs/post-merge-cleanup-20260822T120000Z.json';
  const output = join(cwd, 'github-output.txt');
  writeFileSync(join(cwd, relativeReport), JSON.stringify(contents));
  writeFileSync(output, '');

  const result = spawnSync(process.execPath, [SCRIPT, relativeReport], {
    cwd,
    env: { ...process.env, GITHUB_OUTPUT: output },
    encoding: 'utf8',
  });
  return { result, outputs: readFileSync(output, 'utf8') };
}

describe('#218 cleanup report privacy boundary', () => {
  it('detects nested macOS, Linux, Windows, UNC, and file-URL paths', () => {
    for (const value of [
      '/Users/reviewer/Code/Government-watchdog',
      'worktree path /home/runner/work/repo',
      'C:\\Users\\reviewer\\repo',
      '\\\\runner-host\\share\\repo',
      'file:///private/tmp/repo',
    ]) {
      expect(containsPrivateAbsolutePath(value), value).toBe(true);
    }
    expect(inspectCleanupReport(report({ nested: { path: '/private/tmp/repo' } })).publishable)
      .toBe(false);
  });

  it('does not confuse public URLs, refs, and relative paths with runner paths', () => {
    for (const value of [
      'https://github.com/example/repo/actions/runs/1',
      'origin/main',
      'scripts/cleanup_merged_worktrees.py',
      'GOV-218',
    ]) {
      expect(containsPrivateAbsolutePath(value), value).toBe(false);
    }
    expect(inspectCleanupReport(report({ evidence: 'origin/main' })).publishable).toBe(true);
  });

  it('rejects malformed or untrusted aggregate counts', () => {
    expect(() => inspectCleanupReport(report({ failed_count: -1 }))).toThrow();
    expect(() => inspectCleanupReport(report({ total_candidates: '3' }))).toThrow();
    expect(() => inspectCleanupReport([])).toThrow();
  });

  it('writes safe counts but leaves artifact unset for a planted absolute path', () => {
    const { result, outputs } = runHelper(report({ repo: '/Users/reviewer/Code/repo' }));
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
    expect(outputs).toContain('total_candidates=3');
    expect(outputs).toContain('report_status=withheld');
    expect(outputs).not.toContain('artifact=');
    expect(outputs).not.toContain('/Users/');
  });

  it('sets a relative artifact only after a safe report validates', () => {
    const { result, outputs } = runHelper(report());
    expect(result.status).toBe(0);
    expect(outputs).toContain('report_status=publishable');
    expect(outputs).toContain('artifact=Logs/post-merge-cleanup-20260822T120000Z.json');
  });
});

describe('#218 post-merge workflow publication contract', () => {
  it('contains no empty Actions expression in a rendered run scalar', () => {
    expect(WORKFLOW).not.toMatch(/\$\{\{\s*\}\}/);
  });

  it('captures raw output file-only and never tees or cats it to the public log', () => {
    expect(WORKFLOW).toContain('--json >"$out" 2>"$err"');
    expect(WORKFLOW).not.toContain('tee "$out"');
    expect(WORKFLOW).not.toContain('cat "$out"');
  });

  it('validates before exposing the artifact and keeps upload fail-closed', () => {
    const validation = WORKFLOW.indexOf('node scripts/prepare-cleanup-report.mjs "$out"');
    const upload = WORKFLOW.indexOf('actions/upload-artifact@v4');
    expect(validation).toBeGreaterThan(-1);
    expect(upload).toBeGreaterThan(validation);
    expect(WORKFLOW).toContain("if: always() && steps.sweep.outputs.artifact != ''");
    expect(WORKFLOW).toContain('rm -f "$out"');
  });
});
