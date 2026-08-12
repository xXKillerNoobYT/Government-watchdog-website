/**
 * GOV-1527 (Phase 1c of GOV-1523): resolve the BACKEND_REF pin, obtain the
 * matching PRIVATE-RUNTIME artifact, verify it, and stage it for the website
 * build/service.
 *
 * Implements the consumer half of `Docs/gov1523-artifact-contract-spec.md`
 * (§3 pin, §6 fail-closed). NOTHING here is re-implemented from the backend:
 * the reviewer lane and service are produced and canonically verified by the pinned
 * backend's own `scripts/export_web_artifact.py` in explicit `local:` mode.
 * The public GitHub Release channel is never a valid transport for the private
 * runtime: a commit/tag pin fails before any network request.
 *
 * Fail-closed contract (§6): any hosted ref / missing artifact / profile or
 * commit mismatch / sha mismatch / unknown schema_version aborts non-zero
 * — never a stale/cached artifact, never a half-open app.
 *
 * Usage:
 *   node scripts/fetch-artifact.mjs                 # fails while pin is hosted
 *   BACKEND_REF=local:/path/to/backend node scripts/fetch-artifact.mjs
 *
 * Env:
 *   BACKEND_REF              override the ./BACKEND_REF file (SHA, tag, or local:PATH)
 *   GW_DEMO_DB               registry/demo DB the local builder projects lanes from
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const ARTIFACT_FORMAT_VERSION = 2;
const KNOWN_SCHEMA_VERSIONS = new Set([1]);
const PRIVATE_RUNTIME_PROFILE = 'private-runtime';
const ARTIFACT_PREFIX = 'gw-private-runtime-';
const MANIFEST_KEYS = new Set([
  'artifact_format_version',
  'artifact_profile',
  'artifact_sha256',
  'backend_commit',
  'gate_functions',
  'generated_at_utc',
  'row_counts',
  'schema_version',
]);

function die(msg) {
  // Fail closed: loud, non-zero, no partial artifact left staged.
  console.error(`\n✗ artifact fetch FAILED (fail-closed): ${msg}\n`);
  process.exit(1);
}

/** Resolve the pin: explicit env override wins, else the committed ./BACKEND_REF. */
export function resolveBackendRef(env = process.env, root = REPO_ROOT) {
  const override = (env.BACKEND_REF ?? '').trim();
  if (override) return override;
  const pinFile = join(root, 'BACKEND_REF');
  if (!existsSync(pinFile)) die('no BACKEND_REF override and no ./BACKEND_REF pin file');
  const pin = readFileSync(pinFile, 'utf8').trim();
  if (!pin) die('./BACKEND_REF is empty');
  return pin;
}

/**
 * Classify a pin. `local:PATH` builds from a checkout; a bare 40-char hex is a
 * commit; anything else is treated as an annotated tag (resolved by the host).
 * No ranges, no branch names (§3) — a branch-looking value is rejected.
 */
export function classifyRef(ref) {
  if (ref.startsWith('local:')) return { mode: 'local', path: ref.slice('local:'.length) };
  if (/^[0-9a-f]{40}$/.test(ref)) return { mode: 'commit', commit: ref };
  if (/^[\w.\-/]+$/.test(ref) && !ref.includes(' ')) return { mode: 'tag', tag: ref };
  die(`unrecognized BACKEND_REF ${JSON.stringify(ref)} — expected a 40-char SHA, a tag, or local:PATH`);
}

/** Private data may not cross the repository's public hosted Release channel. */
export function privateArtifactTransportViolation(kind) {
  if (kind.mode === 'local') return null;
  return 'hosted public Release refs cannot transport a private-runtime artifact';
}

/**
 * Content digest — MUST byte-match the backend's `_content_digest`
 * (export_web_artifact.py): sha256 over sorted (relpath, bytes) pairs, each
 * emitted as `<relpath>\0<bytes>\0` (NUL-separated), EXCLUDING manifest.json.
 * Hashing contents (not the gzip stream) keeps the digest reproducible across
 * machines (gzip embeds a timestamp; file contents do not).
 */
export function contentDigest(fileRoot) {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const stat = lstatSync(full);
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile()) files.push(full);
      else throw new Error(`artifact contains a non-regular member: ${relative(fileRoot, full)}`);
    }
  };
  walk(fileRoot);
  const rels = files
    .map((f) => relative(fileRoot, f).split('\\').join('/'))
    .filter((rel) => rel !== 'manifest.json')
    .sort();
  const hasher = createHash('sha256');
  const NUL = Buffer.from([0]);
  for (const rel of rels) {
    hasher.update(Buffer.from(rel, 'utf8'));
    hasher.update(NUL);
    hasher.update(readFileSync(join(fileRoot, rel)));
    hasher.update(NUL);
  }
  return hasher.digest('hex');
}

function artifactFiles(root) {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const stat = lstatSync(full);
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile()) files.push(relative(root, full).split('\\').join('/'));
      else files.push(`!non-regular:${relative(root, full).split('\\').join('/')}`);
    }
  };
  walk(root);
  return files.sort();
}

/** Pure contract audit for one extracted private-runtime artifact. */
export function privateRuntimeContractViolations(root, { expectCommit } = {}) {
  const violations = [];
  const manifestPath = join(root, 'manifest.json');
  if (!existsSync(manifestPath)) return ['artifact has no manifest.json'];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    return [`manifest.json is not valid JSON: ${e.message}`];
  }

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest))
    return ['manifest.json is not a JSON object'];

  const keys = Object.keys(manifest).sort();
  if (keys.length !== MANIFEST_KEYS.size || keys.some((key) => !MANIFEST_KEYS.has(key)))
    violations.push('manifest.json does not have the exact v2 field set');
  if (manifest.artifact_format_version !== ARTIFACT_FORMAT_VERSION)
    violations.push(`artifact_format_version must be ${ARTIFACT_FORMAT_VERSION}`);
  if (manifest.artifact_profile !== PRIVATE_RUNTIME_PROFILE)
    violations.push(`artifact_profile must be ${JSON.stringify(PRIVATE_RUNTIME_PROFILE)}`);
  if (!KNOWN_SCHEMA_VERSIONS.has(manifest.schema_version))
    violations.push(`unknown schema_version ${JSON.stringify(manifest.schema_version)}`);

  if (!/^[0-9a-f]{40}$/.test(manifest.backend_commit ?? ''))
    violations.push('manifest.backend_commit is not a lowercase 40-char SHA');

  if (expectCommit && manifest.backend_commit !== expectCommit)
    violations.push(`commit mismatch: expected ${expectCommit}, found ${manifest.backend_commit}`);

  if (JSON.stringify(manifest.gate_functions) !== JSON.stringify(['read_api.reviewer_internal_records']))
    violations.push('gate_functions do not match the private-runtime profile');
  if (typeof manifest.generated_at_utc !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(manifest.generated_at_utc))
    violations.push('generated_at_utc is not an explicit ISO-8601 datetime');

  const counts = manifest.row_counts;
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)
    || Object.keys(counts).length !== 1
    || !Number.isSafeInteger(counts.reviewer_internal)
    || counts.reviewer_internal < 0)
    violations.push('row_counts must contain one non-negative reviewer_internal count');

  const files = artifactFiles(root);
  for (const file of files) {
    if (file.startsWith('!non-regular:')) violations.push(file.slice(1));
    else if (file === 'data/published.json') violations.push('private runtime contains public lane');
    else if (file !== 'manifest.json' && file !== 'data/reviewer_internal.json'
      && !file.startsWith('service/')) violations.push(`unexpected artifact member ${file}`);
  }
  for (const required of ['manifest.json', 'data/reviewer_internal.json', 'service/run.py', 'service/schema.sql'])
    if (!files.includes(required)) violations.push(`artifact missing required member ${required}`);

  let reviewerRows;
  try {
    reviewerRows = JSON.parse(readFileSync(join(root, 'data/reviewer_internal.json'), 'utf8'));
  } catch (e) {
    violations.push(`data/reviewer_internal.json is not valid JSON: ${e.message}`);
  }
  if (!Array.isArray(reviewerRows)) violations.push('data/reviewer_internal.json is not a JSON array');
  else if (counts?.reviewer_internal !== reviewerRows.length)
    violations.push('row_counts.reviewer_internal does not match the private lane');

  try {
    const recomputed = contentDigest(root);
    if (recomputed !== manifest.artifact_sha256)
      violations.push(`artifact_sha256 mismatch: manifest says ${manifest.artifact_sha256}, recomputed ${recomputed}`);
  } catch (e) {
    violations.push(e.message);
  }

  return violations;
}

/** Verify a staged, extracted private-runtime tree against the v2 contract. */
export function verifyArtifact(root, { expectCommit } = {}) {
  const violations = privateRuntimeContractViolations(root, { expectCommit });
  if (violations.length) die(`private-runtime artifact contract failed:\n- ${violations.join('\n- ')}`);
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  return manifest;
}

/** local:PATH — build the artifact from a checkout using ITS OWN builder. */
function buildFromLocal(checkout, outDir) {
  const abs = resolve(checkout);
  const builder = join(abs, 'scripts', 'export_web_artifact.py');
  if (!existsSync(builder))
    die(`local backend checkout ${abs} has no scripts/export_web_artifact.py — `
      + `is it at (or past) the pinned ref?`);
  const db = process.env.GW_DEMO_DB;
  const args = [builder, '--profile', PRIVATE_RUNTIME_PROFILE, '--out-dir', outDir];
  if (db) args.push('--db', db);
  let stdout;
  try {
    stdout = execFileSync('python3', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  } catch (e) {
    die(`local builder exited non-zero (deny-list or build failure): ${e.message}`);
  }
  // stdout is the manifest JSON; the tarball lands in outDir.
  const tarball = readdirSync(outDir).find((f) => f.startsWith(ARTIFACT_PREFIX) && f.endsWith('.tar.gz'));
  if (!tarball) die(`local builder produced no ${ARTIFACT_PREFIX}*.tar.gz in ${outDir}`);
  return { tarball: join(outDir, tarball), builderManifest: safeJson(stdout) };
}

function localCheckoutCommit(checkout) {
  let commit;
  let status;
  try {
    commit = execFileSync('git', ['-C', resolve(checkout), 'rev-parse', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
    status = execFileSync('git', [
      '-C', resolve(checkout), 'status', '--porcelain=v1', '--untracked-files=all', '--',
      'scripts', 'requirements.txt', 'Database/migrations',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
  } catch (e) {
    die(`cannot resolve exact local backend source identity: ${e.message}`);
  }
  if (!/^[0-9a-f]{40}$/.test(commit)) die('local backend HEAD is not a full commit SHA');
  if (status) {
    const count = status.split('\n').filter(Boolean).length;
    die(`local backend artifact source is dirty in contract-relevant paths (${count} entries); `
      + 'commit or isolate the exact source before integration');
  }
  return commit;
}

/** Ask the exact local backend contract implementation to verify archive bytes. */
function verifyArchiveWithLocalBackend(checkout, tarball, expectedCommit) {
  const code = [
    'import sys',
    'from pathlib import Path',
    'sys.path.insert(0, sys.argv[1])',
    'import export_web_artifact as artifact',
    'artifact.inspect_artifact(Path(sys.argv[2]),',
    '    expected_profile=artifact.PRIVATE_RUNTIME_PROFILE,',
    '    expected_commit=sys.argv[3])',
  ].join('\n');
  try {
    execFileSync('python3', [
      '-c', code,
      join(resolve(checkout), 'scripts'),
      resolve(tarball),
      expectedCommit,
    ], { stdio: ['ignore', 'ignore', 'inherit'] });
  } catch (e) {
    die(`exact local backend rejected private-runtime archive bytes: ${e.message}`);
  }
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}

export function archiveMemberViolations(tarball) {
  let names;
  let verbose;
  try {
    names = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
      .split('\n').filter(Boolean);
    verbose = execFileSync('tar', ['-tvzf', tarball], { encoding: 'utf8' })
      .split('\n').filter(Boolean);
  } catch (e) {
    return [`archive listing failed: ${e.message}`];
  }
  const violations = [];
  if (names.length !== verbose.length) violations.push('archive listing count is inconsistent');
  if (new Set(names).size !== names.length) violations.push('archive contains duplicate members');
  for (const name of names) {
    const parts = name.split('/');
    if (!name || name.startsWith('/') || name.includes('\\')
      || parts.some((part) => !part || part === '.' || part === '..'))
      violations.push(`archive contains unsafe member ${JSON.stringify(name)}`);
    else if (name === 'data/published.json') violations.push('archive contains the public lane');
    else if (name !== 'manifest.json' && name !== 'data/reviewer_internal.json'
      && !name.startsWith('service/')) violations.push(`archive contains unexpected member ${name}`);
  }
  for (const line of verbose) {
    if (!line.trimStart().startsWith('-'))
      violations.push('archive contains a non-regular entry');
  }
  return violations;
}

function extract(tarball, into) {
  const violations = archiveMemberViolations(tarball);
  if (violations.length) die(`unsafe private-runtime archive:\n- ${violations.join('\n- ')}`);
  rmSync(into, { recursive: true, force: true });
  mkdirSync(into, { recursive: true });
  try {
    execFileSync('tar', ['-xzf', tarball, '-C', into], { stdio: ['ignore', 'ignore', 'inherit'] });
  } catch (e) {
    die(`could not extract ${tarball}: ${e.message}`);
  }
}

async function main() {
  // Reject every unsupported transport/mode before changing generated output.
  // This ordering is load-bearing: a typo or hostile caller must not be able to
  // use a rejected request to delete an arbitrary directory or source-tree file.
  if ((process.env.LANDING_ONLY ?? '').trim()) {
    die('LANDING_ONLY is disabled for artifact integration: use the independent `npm run build` public-free lane');
  }
  if ((process.env.GW_ARTIFACT_TARBALL ?? '').trim()) {
    die('GW_ARTIFACT_TARBALL is disabled: an untrusted prebuilt archive cannot prove source origin');
  }
  if ((process.env.GW_ARTIFACT_DIR ?? '').trim()) {
    die('GW_ARTIFACT_DIR is disabled: private integration may replace only the repository-owned .artifact output');
  }

  const ref = resolveBackendRef();
  const kind = classifyRef(ref);
  if (privateArtifactTransportViolation(kind)) {
    die(`BACKEND_REF=${JSON.stringify(ref)} names a hosted public Release channel; `
      + 'private-runtime artifacts require explicit local:PATH until a protected, '
      + 'authenticated delivery channel is implemented and verified');
  }

  // Validate the exact source before cleaning the script-owned generated output.
  const expectCommit = localCheckoutCommit(kind.path);
  const legacyPublished = join(REPO_ROOT, 'public', 'data', 'published.json');
  if (existsSync(legacyPublished)) {
    die('legacy public/data/published.json exists; refusing to overwrite or delete source-tree bytes — inspect and remove it explicitly');
  }

  const artifactDir = join(REPO_ROOT, '.artifact');
  const work = join(artifactDir, '.download');
  rmSync(artifactDir, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  console.log(`BACKEND_REF=local:${kind.path} — building artifact from clean local checkout (no token).`);
  // The local source must be clean in every contract-relevant path. The builder
  // stamps that exact HEAD, and the consumer cross-checks it below.
  const { tarball } = buildFromLocal(kind.path, work);
  const postBuildCommit = localCheckoutCommit(kind.path);
  if (postBuildCommit !== expectCommit) {
    die(`local backend HEAD moved during artifact build: ${expectCommit} -> ${postBuildCommit}`);
  }

  // The producer's v2 verifier proves exact canonical gzip/tar bytes, including
  // normalized metadata and absence of PAX/trailing data. The consumer then
  // independently checks paths and extracted semantics below.
  verifyArchiveWithLocalBackend(kind.path, tarball, expectCommit);
  const staged = join(artifactDir, 'artifact');
  extract(tarball, staged);
  const manifest = verifyArtifact(staged, { expectCommit });

  writeFileSync(join(artifactDir, 'INTEGRATION.json'), JSON.stringify({
    mode: kind.mode, staged: true, backend_ref: ref,
    backend_commit: manifest.backend_commit,
    artifact_sha256: manifest.artifact_sha256,
    artifact_format_version: manifest.artifact_format_version,
    artifact_profile: manifest.artifact_profile,
    schema_version: manifest.schema_version,
    row_counts: manifest.row_counts,
    service_entry: 'service/run.py',
    gated_lane: 'artifact/data/reviewer_internal.json (local/private service-only, never static)',
  }, null, 2) + '\n');

  console.log('✓ artifact verified & staged:');
  console.log(JSON.stringify(manifest, null, 2));
}

// Only run when invoked directly (keeps the pure fns unit-testable).
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  await main();
}
