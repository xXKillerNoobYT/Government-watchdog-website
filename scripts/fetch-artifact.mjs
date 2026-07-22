/**
 * GOV-1527 (Phase 1c of GOV-1523): resolve the BACKEND_REF pin, obtain the
 * matching web artifact, verify it, and stage it for the website build/service.
 *
 * Implements the consumer half of `Docs/gov1523-artifact-contract-spec.md`
 * (§3 pin, §4 token, §6 fail-closed). NOTHING here is re-implemented from the
 * backend: the two data lanes and the service are produced by the pinned
 * backend's own `scripts/export_web_artifact.py` (local mode) or downloaded
 * from its GitHub Release (hosted mode). This script only fetches + VERIFIES.
 *
 * Fail-closed contract (§6): any missing token / missing artifact / commit
 * mismatch / sha mismatch / unknown schema_version aborts with a non-zero exit
 * — never a stale/cached artifact, never a half-open app. The single documented
 * escape hatch is an explicit `LANDING_ONLY=1`, which stages NO /api surface.
 *
 * Usage:
 *   node scripts/fetch-artifact.mjs                 # read ./BACKEND_REF
 *   BACKEND_REF=local:/path/to/backend node scripts/fetch-artifact.mjs
 *   LANDING_ONLY=1 node scripts/fetch-artifact.mjs  # public landing only
 *
 * Env:
 *   BACKEND_REF              override the ./BACKEND_REF file (SHA, tag, or local:PATH)
 *   GW_BACKEND_DEPLOY_TOKEN  fine-grained Contents:read PAT (hosted download only; never logged)
 *   GW_DEMO_DB               registry/demo DB the local builder projects lanes from
 *   LANDING_ONLY             "1"/"true" => stage nothing, fail-closed landing build
 *   GW_ARTIFACT_DIR          output stage dir (default ./.artifact)
 *   GW_ARTIFACT_TARBALL      pre-built gw-web-artifact-*.tar.gz to stage instead of
 *                            building/downloading (GOV-1544: offline Docker/CI
 *                            verification). Verification is NOT weakened: the
 *                            manifest commit is still cross-checked against the
 *                            pin and the sha256 recomputed — a wrong tarball fails.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync,
  statSync, writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const KNOWN_SCHEMA_VERSIONS = new Set([1]);
const ARTIFACT_PREFIX = 'gw-web-artifact-';

function die(msg) {
  // Fail closed: loud, non-zero, no partial artifact left staged.
  console.error(`\n✗ artifact fetch FAILED (fail-closed): ${msg}\n`);
  process.exit(1);
}

/** Truthy env flag: "1"/"true"/"yes" (case-insensitive). */
function flag(name) {
  return ['1', 'true', 'yes'].includes(String(process.env[name] ?? '').trim().toLowerCase());
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
      if (statSync(full).isDirectory()) walk(full);
      else files.push(full);
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

/** Verify a staged, extracted artifact tree against the contract (§3/§6). */
export function verifyArtifact(root, { expectCommit } = {}) {
  const manifestPath = join(root, 'manifest.json');
  if (!existsSync(manifestPath)) die('artifact has no manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    die(`manifest.json is not valid JSON: ${e.message}`);
  }

  if (!KNOWN_SCHEMA_VERSIONS.has(manifest.schema_version))
    die(`unknown schema_version ${JSON.stringify(manifest.schema_version)} `
      + `(website knows ${[...KNOWN_SCHEMA_VERSIONS].join(', ')})`);

  if (!/^[0-9a-f]{40}$/.test(manifest.backend_commit ?? ''))
    die(`manifest.backend_commit is not a 40-char SHA: ${JSON.stringify(manifest.backend_commit)}`);

  if (expectCommit && manifest.backend_commit !== expectCommit)
    die(`commit mismatch: BACKEND_REF resolves to ${expectCommit} but artifact was built from `
      + `${manifest.backend_commit}`);

  const recomputed = contentDigest(root);
  if (recomputed !== manifest.artifact_sha256)
    die(`artifact_sha256 mismatch: manifest says ${manifest.artifact_sha256}, recomputed ${recomputed}`);

  // The gated lane must never be reachable as a static asset (§2 clause 2 /
  // §5). It lives only under the service dir tree at rest; the build must not
  // copy it into the static output — enforced by the build (see package.json)
  // and asserted by local_e2e.sh step 5c.
  for (const required of ['data/published.json', 'data/reviewer_internal.json', 'service/run.py'])
    if (!existsSync(join(root, required))) die(`artifact missing required member ${required}`);

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
  const args = [builder, '--out-dir', outDir];
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

/** commit/tag — download the Release asset for the ref (token never logged). */
async function downloadRelease(ref, outDir) {
  const token = (process.env.GW_BACKEND_DEPLOY_TOKEN ?? '').trim();
  const short = /^[0-9a-f]{40}$/.test(ref) ? ref.slice(0, 12) : ref;
  const asset = `${ARTIFACT_PREFIX}${short}.tar.gz`;
  const dest = join(outDir, asset);
  // Prefer gh (ambient auth); fall back to a token-authenticated API download
  // (GOV-1544: the Docker build stage has no gh). Either way the token rides
  // env/headers only — never argv, never echoed.
  try {
    if (token) process.env.GH_TOKEN = token;
    execFileSync('gh', [
      'release', 'download', ref,
      '--repo', 'xXKillerNoobYT/Government-watchdog',
      '--pattern', asset, '--dir', outDir, '--clobber',
    ], { stdio: ['ignore', 'ignore', 'inherit'] });
  } catch {
    try {
      await downloadReleaseViaApi(ref, asset, dest, token);
    } catch (e) {
      die(`could not download ${asset} for ref ${ref} — missing GW_BACKEND_DEPLOY_TOKEN or `
        + `no Release asset (fail closed, no stale reuse). ${e.message}`);
    }
  }
  if (!existsSync(dest)) die(`release download reported success but ${asset} is absent`);
  return { tarball: dest };
}

/** GitHub REST fallback: find the Release carrying `asset`, stream it to `dest`. */
async function downloadReleaseViaApi(ref, asset, dest, token) {
  if (!token) throw new Error('no gh CLI and no GW_BACKEND_DEPLOY_TOKEN');
  const api = 'https://api.github.com/repos/xXKillerNoobYT/Government-watchdog';
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  // A pin that is a tag maps directly; a 40-char commit pin is located by its
  // asset name across recent releases (backend CI names assets by short sha).
  let release = null;
  const byTag = await fetch(`${api}/releases/tags/${encodeURIComponent(ref)}`, { headers });
  if (byTag.ok) {
    release = await byTag.json();
  } else {
    const list = await fetch(`${api}/releases?per_page=100`, { headers });
    if (!list.ok) throw new Error(`releases list HTTP ${list.status}`);
    release = (await list.json()).find((r) => (r.assets ?? []).some((a) => a.name === asset)) ?? null;
  }
  if (!release) throw new Error(`no Release found for ${ref}`);
  const found = (release.assets ?? []).find((a) => a.name === asset);
  if (!found) throw new Error(`Release ${release.tag_name} has no asset ${asset}`);
  const download = await fetch(found.url, {
    headers: { ...headers, Accept: 'application/octet-stream' },
    redirect: 'follow',
  });
  if (!download.ok) throw new Error(`asset download HTTP ${download.status}`);
  writeFileSync(dest, Buffer.from(await download.arrayBuffer()));
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function extract(tarball, into) {
  rmSync(into, { recursive: true, force: true });
  mkdirSync(into, { recursive: true });
  try {
    execFileSync('tar', ['-xzf', tarball, '-C', into], { stdio: ['ignore', 'ignore', 'inherit'] });
  } catch (e) {
    die(`could not extract ${tarball}: ${e.message}`);
  }
}

async function main() {
  const artifactDir = resolve(process.env.GW_ARTIFACT_DIR ?? join(REPO_ROOT, '.artifact'));

  // Fail-closed escape hatch (§6): explicit landing-only, zero /api surface.
  if (flag('LANDING_ONLY')) {
    rmSync(artifactDir, { recursive: true, force: true });
    mkdirSync(artifactDir, { recursive: true });
    writeFileSync(join(artifactDir, 'INTEGRATION.json'), JSON.stringify({
      mode: 'landing_only', staged: false,
      note: 'LANDING_ONLY=1 — public landing + waitlist only, no gated data, no service, no /api.',
    }, null, 2) + '\n');
    console.log('LANDING_ONLY=1 — staged public landing only (no /api surface). This is an explicit choice, not a degrade.');
    return;
  }

  const ref = resolveBackendRef();
  const kind = classifyRef(ref);
  const work = join(artifactDir, '.download');
  rmSync(artifactDir, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  let tarball;
  let expectCommit;
  const preBuilt = (process.env.GW_ARTIFACT_TARBALL ?? '').trim();
  if (preBuilt) {
    // GOV-1544: offline Docker/CI verification from a pre-built tarball. The
    // pin still decides which commit is acceptable — verifyArtifact below
    // cross-checks manifest.backend_commit and recomputes the sha256, so a
    // stale or tampered tarball fails the build exactly like a bad download.
    if (!existsSync(preBuilt)) die(`GW_ARTIFACT_TARBALL=${preBuilt} does not exist`);
    console.log(`GW_ARTIFACT_TARBALL — staging pre-built tarball (pin ${ref} still enforced).`);
    tarball = resolve(preBuilt);
    expectCommit = kind.mode === 'commit' ? kind.commit : undefined;
  } else if (kind.mode === 'local') {
    console.log(`BACKEND_REF=local:${kind.path} — building artifact from local checkout (no token).`);
    // For local mode the "resolved ref" is the checkout HEAD; the builder stamps
    // it into manifest.backend_commit, so we cross-check against git HEAD.
    try {
      expectCommit = execFileSync('git', ['-C', resolve(kind.path), 'rev-parse', 'HEAD'],
        { encoding: 'utf8' }).trim();
    } catch { expectCommit = undefined; }
    ({ tarball } = buildFromLocal(kind.path, work));
  } else {
    expectCommit = kind.mode === 'commit' ? kind.commit : undefined; // tag -> host resolves
    console.log(`BACKEND_REF=${ref} (${kind.mode}) — downloading Release artifact.`);
    ({ tarball } = await downloadRelease(ref, work));
  }

  const staged = join(artifactDir, 'artifact');
  extract(tarball, staged);
  const manifest = verifyArtifact(staged, { expectCommit });

  // Publish the public lane to the static layer; keep the gated lane + service
  // OUT of the static bundle (served only through /api by the service).
  const publicData = join(REPO_ROOT, 'public', 'data');
  mkdirSync(publicData, { recursive: true });
  cpSync(join(staged, 'data', 'published.json'), join(publicData, 'published.json'));

  writeFileSync(join(artifactDir, 'INTEGRATION.json'), JSON.stringify({
    mode: kind.mode, staged: true, backend_ref: ref,
    backend_commit: manifest.backend_commit,
    artifact_sha256: manifest.artifact_sha256,
    schema_version: manifest.schema_version,
    row_counts: manifest.row_counts,
    service_entry: 'service/run.py',
    gated_lane: 'artifact/data/reviewer_internal.json (service-only, never static)',
  }, null, 2) + '\n');

  console.log('✓ artifact verified & staged:');
  console.log(JSON.stringify(manifest, null, 2));
}

// Only run when invoked directly (keeps the pure fns unit-testable).
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  await main();
}
