import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error The repository intentionally carries no global Node typings;
// this test needs only the executable subprocess seam for output-boundary proof.
import { spawnSync } from 'node:child_process';

declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
  execPath: string;
};

// The production checker is an executable JavaScript module rather than app code.
// @ts-expect-error No declaration file is needed for this workflow helper.
import { aggregateCleanupReport, removeRawReport } from '../scripts/prepare-cleanup-report.mjs';

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

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function runHelper(contents: Record<string, unknown>) {
  const cwd = mkdtempSync(join(tmpdir(), 'gw-cleanup-report-'));
  roots.push(cwd);
  mkdirSync(join(cwd, 'Logs'));
  const relativeReport = 'Logs/post-merge-cleanup-20260822T120000Z.json';
  const rawReport = join(cwd, relativeReport);
  const output = join(cwd, 'github-output.txt');
  writeFileSync(rawReport, JSON.stringify(contents));
  writeFileSync(output, '');

  const result = spawnSync(process.execPath, [SCRIPT, relativeReport], {
    cwd,
    env: { ...process.env, GITHUB_OUTPUT: output },
    encoding: 'utf8',
  });
  const outputs = readFileSync(output, 'utf8');
  const artifact = outputs.match(/^artifact=(.+)$/m)?.[1];
  const publicArtifact = artifact ? JSON.parse(readFileSync(join(cwd, artifact), 'utf8')) : null;
  return {
    artifact,
    outputs,
    publicArtifact,
    rawExists: existsSync(rawReport),
    result,
  };
}

describe('#218 cleanup report privacy boundary', () => {
  it('copies exactly the aggregate allowlist and no backend-owned strings', () => {
    const aggregate = aggregateCleanupReport(report({
      candidates: [{
        branch: 'private-person@example.com/secret-investigation',
        reason: 'runner at /Applications/Private.app and /usr/local/private',
        worktree: 'C:\\Users\\reviewer\\repo',
      }],
      future_private_field: 'not-for-publication',
    }));
    expect(aggregate).toEqual({
      report_format_version: 1,
      privacy_status: 'aggregate-only',
      total_candidates: 3,
      would_remove_branches: 1,
      would_remove_worktrees: 1,
      preserved_count: 2,
      failed_count: 0,
    });
  });

  it('rejects malformed or untrusted aggregate counts', () => {
    expect(() => aggregateCleanupReport(report({ failed_count: -1 }))).toThrow();
    expect(() => aggregateCleanupReport(report({ total_candidates: '3' }))).toThrow();
    expect(() => aggregateCleanupReport([])).toThrow();
  });

  it('deletes raw evidence and emits only a new aggregate artifact', () => {
    const privateMarkers = [
      'private-person@example.com',
      'secret-investigation',
      '/Applications/Private.app',
      '/Library/Private',
      '/usr/local/private',
      '/Users/reviewer/Code/repo',
      'C:\\Users\\reviewer\\repo',
      '\\\\runner-host\\share\\repo',
      'file:///private/tmp/repo',
    ];
    const { artifact, outputs, publicArtifact, rawExists, result } = runHelper(report({
      candidates: privateMarkers,
      arbitrary_private_note: privateMarkers.join(' | '),
    }));
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
    expect(rawExists).toBe(false);
    expect(outputs).toContain('total_candidates=3');
    expect(outputs).toContain('report_status=aggregate-only');
    expect(artifact).toBe('Logs/post-merge-cleanup-20260822T120000Z-summary.json');
    expect(publicArtifact).toEqual({
      report_format_version: 1,
      privacy_status: 'aggregate-only',
      total_candidates: 3,
      would_remove_branches: 1,
      would_remove_worktrees: 1,
      preserved_count: 2,
      failed_count: 0,
    });
    const publicSurface = `${outputs}\n${JSON.stringify(publicArtifact)}`;
    for (const marker of privateMarkers) expect(publicSurface).not.toContain(marker);
  });

  it('deletes malformed raw evidence without setting an artifact output', () => {
    const { artifact, outputs, rawExists, result } = runHelper(report({ failed_count: -1 }));
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('Cleanup report validation failed; raw output withheld.\n');
    expect(rawExists).toBe(false);
    expect(outputs).toBe('');
    expect(artifact).toBeUndefined();
  });

  it('fails closed when raw evidence still exists after a deletion error', () => {
    expect(() => removeRawReport('Logs/private.json', {
      unlinkFile: () => { throw new Error('planted deletion failure'); },
      fileExists: () => true,
    })).toThrow('Raw cleanup report could not be deleted');

    expect(() => removeRawReport('Logs/already-gone.json', {
      unlinkFile: () => { throw new Error('already absent'); },
      fileExists: () => false,
    })).not.toThrow();
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

  it('aggregates before exposing the artifact and keeps upload fail-closed', () => {
    const validation = WORKFLOW.indexOf('node scripts/prepare-cleanup-report.mjs "$out"');
    const upload = WORKFLOW.indexOf('actions/upload-artifact@v4');
    expect(validation).toBeGreaterThan(-1);
    expect(upload).toBeGreaterThan(validation);
    expect(WORKFLOW).toContain("if: always() && steps.sweep.outputs.artifact != ''");
    expect(WORKFLOW).toContain('rm -f "$out"');
    expect(WORKFLOW).toContain('post-merge-cleanup-dry-run-summary');
  });

  it('masks runner roots before checkout and never persists the private script path', () => {
    const mask = WORKFLOW.indexOf('- name: Mask private runner paths');
    const checkout = WORKFLOW.indexOf('uses: actions/checkout@v7');
    const resolve = WORKFLOW.indexOf('script="$checkout/$rel"');
    const invoke = WORKFLOW.indexOf('python3 "$script"');
    expect(mask).toBeGreaterThan(-1);
    expect(checkout).toBeGreaterThan(mask);
    expect(resolve).toBeGreaterThan(checkout);
    expect(invoke).toBeGreaterThan(resolve);
    expect(WORKFLOW).toContain('mask_path "$HOME"');
    expect(WORKFLOW).toContain('escaped="${value//\\//\\\\/}"');
    expect(WORKFLOW).toContain('persist-credentials: false');
    expect(WORKFLOW).toContain('permissions:\n  contents: read');
    expect(WORKFLOW).not.toContain('>> "$GITHUB_ENV"');
    expect(WORKFLOW).not.toContain('GW_CLEANUP_SCRIPT=');
  });
});
