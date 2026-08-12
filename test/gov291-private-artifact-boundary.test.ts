import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The production verifier is an executable JavaScript module rather than app code.
// @ts-expect-error No declaration file is needed for this build-time module.
import * as artifactModule from '../scripts/fetch-artifact.mjs';

const {
  classifyRef,
  contentDigest,
  privateArtifactTransportViolation,
  privateRuntimeContractViolations,
} = artifactModule;

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function privateArtifactRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'gw-private-artifact-'));
  roots.push(root);
  mkdirSync(join(root, 'data'), { recursive: true });
  mkdirSync(join(root, 'service'), { recursive: true });
  const rows = [{ statement_id: 'safe-test-id', publication_state: 'unreviewed' }];
  writeFileSync(join(root, 'data/reviewer_internal.json'), `${JSON.stringify(rows)}\n`);
  writeFileSync(join(root, 'service/run.py'), '# local private runtime\n');
  writeFileSync(join(root, 'service/schema.sql'), 'CREATE TABLE example(id TEXT);\n');
  const manifest = {
    artifact_format_version: 2,
    artifact_profile: 'private-runtime',
    artifact_sha256: contentDigest(root),
    backend_commit: 'a'.repeat(40),
    gate_functions: ['read_api.reviewer_internal_records'],
    generated_at_utc: '2026-08-12T00:00:00+00:00',
    row_counts: { reviewer_internal: rows.length },
    schema_version: 1,
  };
  writeFileSync(join(root, 'manifest.json'), `${JSON.stringify(manifest)}\n`);
  return root;
}

describe('issue #291 private-runtime artifact boundary', () => {
  it('accepts only the exact v2 private profile produced locally', () => {
    const root = privateArtifactRoot();
    expect(privateRuntimeContractViolations(root, { expectCommit: 'a'.repeat(40) })).toEqual([]);
  });

  it('rejects a legacy or combined artifact even when its digest is recomputed', () => {
    const root = privateArtifactRoot();
    writeFileSync(join(root, 'data/published.json'), '[]\n');
    const manifestPath = join(root, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest.artifact_format_version = 1;
    manifest.artifact_sha256 = contentDigest(root);
    writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);

    const violations = privateRuntimeContractViolations(root);
    expect(violations).toContain('artifact_format_version must be 2');
    expect(violations).toContain('private runtime contains public lane');
  });

  it('rejects profile confusion, extra top-level members, and count drift', () => {
    const root = privateArtifactRoot();
    const manifestPath = join(root, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest.artifact_profile = 'public';
    manifest.row_counts = { reviewer_internal: 9 };
    writeFileSync(join(root, 'unexpected.txt'), 'not allowed\n');
    manifest.artifact_sha256 = contentDigest(root);
    writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);

    const violations = privateRuntimeContractViolations(root);
    expect(violations.some((item: string) => item.includes('artifact_profile'))).toBe(true);
    expect(violations).toContain('unexpected artifact member unexpected.txt');
    expect(violations).toContain('row_counts.reviewer_internal does not match the private lane');
  });

  it('rejects a non-object manifest and a non-datetime generation identity', () => {
    const root = privateArtifactRoot();
    const manifestPath = join(root, 'manifest.json');
    writeFileSync(manifestPath, 'null\n');
    expect(privateRuntimeContractViolations(root)).toEqual([
      'manifest.json is not a JSON object',
    ]);

    const replacement = {
      artifact_format_version: 2,
      artifact_profile: 'private-runtime',
      artifact_sha256: contentDigest(root),
      backend_commit: 'a'.repeat(40),
      gate_functions: ['read_api.reviewer_internal_records'],
      generated_at_utc: 'sometime',
      row_counts: { reviewer_internal: 1 },
      schema_version: 1,
    };
    writeFileSync(manifestPath, `${JSON.stringify(replacement)}\n`);
    expect(privateRuntimeContractViolations(root)).toContain(
      'generated_at_utc is not an explicit ISO-8601 datetime',
    );
  });

  it('allows local checkout transport and denies both hosted pin forms', () => {
    expect(privateArtifactTransportViolation(classifyRef('local:/tmp/backend'))).toBeNull();
    expect(privateArtifactTransportViolation(classifyRef('b'.repeat(40)))).toContain('hosted');
    expect(privateArtifactTransportViolation(classifyRef('web-artifact-deadbeef'))).toContain('hosted');
  });

  it('contains no hosted download implementation or deploy-token path', () => {
    const source = readFileSync(new URL('../scripts/fetch-artifact.mjs', import.meta.url), 'utf8');
    expect(source).not.toContain('downloadRelease(');
    expect(source).not.toContain('GW_BACKEND_DEPLOY_TOKEN');
    expect(source).not.toContain("execFileSync('gh'");
    expect(source).toContain("'--profile', PRIVATE_RUNTIME_PROFILE");
    expect(source.indexOf('if (privateArtifactTransportViolation(kind))'))
      .toBeLessThan(source.indexOf('GW_ARTIFACT_TARBALL is disabled'));
    expect(source.indexOf('verifyArchiveWithLocalBackend(kind.path, tarball, expectCommit)'))
      .toBeLessThan(source.indexOf('extract(tarball, staged)'));
    expect(source).toContain('GW_ARTIFACT_TARBALL is disabled');
    expect(source).toContain("'status', '--porcelain=v1', '--untracked-files=all'");
    expect(source).toContain('LANDING_ONLY is disabled for artifact integration');
    expect(source).toContain('const postBuildCommit = localCheckoutCommit(kind.path)');
  });
});
