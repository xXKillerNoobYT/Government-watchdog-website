/**
 * Public asset-lane enforcement.
 *
 * This scans the completed browser artifact, not only the DOM or source tree.
 * A public build fails if private admission code, captured civic rows, design
 * fixtures, or the private Sites marker survived bundling or source mapping.
 *
 * Issue #55 added the package-shape check: a clean `dist/public` is not a safe
 * deployment package if a private client artifact sits beside it in `dist/`.
 * Issue #55 AC4 then removed the text-extension allow-list, so "no private
 * marker survived bundling" covers every emitted file rather than nine types.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_ROOT = resolve(REPO_ROOT, 'dist/public');

export const FORBIDDEN_PUBLIC_MARKERS = [
  'reviewer_internal',
  'reviewer-internal',
  'not_publishable',
  'gw-reviewer-bypass',
  'VITE_REVIEWER_BYPASS',
  'gw-sites-private-beta',
  'demo=design',
  '/api/reviewer-internal',
  'reviewer_internal_records',
  'ReviewerContextStore',
  'gw-reviewer-context-style',
  'LIVE SERVER CONTEXT',
  'concept-graph-demo',
  'concept-graph-real',
  'agenda-board-projection.sample',
  '/api/notifications',
  'ntf_sample_approved',
  'DEVELOPMENT SAMPLE — these are example account-workflow messages',
  'shell-notifications',
  'How your private-beta access is decided',
  'Workspace · Home · Alpine',
  'How future publication-honesty metrics must work',
  'alpine_local_corpus:ai:00000064:0021',
  'stmt-pending',
  'stmt-disputed',
];

/**
 * A marker as it appears when a file is read byte-for-byte (issue #55, AC4).
 *
 * Emitted files are read as `latin1` — the one encoding where a byte maps to
 * exactly one character — so the needle has to be the marker's UTF-8 *bytes*
 * read that same way. Searching for the marker's own JavaScript string would
 * silently miss every marker containing a non-ASCII character: `Workspace ·
 * Home · Alpine` is 25 characters in this file and 27 bytes in the artifact, and
 * `includes` would never match. For a pure-ASCII marker this is the identity.
 */
export function byteForm(marker) {
  return Buffer.from(marker, 'utf8').toString('latin1');
}

/**
 * Forbidden markers present in one emitted file — the pure half of the scan.
 *
 * `text` is the file read as `latin1`. Split from the filesystem walk so the
 * TypeScript suite can reach the decision, matching `privateSiblingLanes` /
 * `privateSiblingArtifacts` and the sibling guard's `violationsIn` /
 * `scanDirectExposure`: this repository intentionally carries no `@types/node`.
 */
export function publicMarkerViolationsIn(text, relPath) {
  const violations = [];
  for (const marker of FORBIDDEN_PUBLIC_MARKERS) {
    if (text.includes(byteForm(marker))) {
      violations.push(`${relPath} contains forbidden marker ${JSON.stringify(marker)}`);
    }
  }
  return violations;
}

function* files(root) {
  if (!existsSync(root)) return;
  if (statSync(root).isFile()) {
    yield root;
    return;
  }
  for (const name of readdirSync(root)) yield* files(join(root, name));
}

/**
 * Every emitted file, whatever its extension (issue #55, AC4).
 *
 * The former text-extension allow-list was the hole AC4 names: a marker carried
 * in an emitted image, font, `.bin`, `.wasm`, or any newly minted extension was
 * never looked at, so "no private marker survived bundling" was only ever a
 * claim about nine file types. Reading everything as `latin1` and matching on
 * {@link byteForm} answers the question for the whole artifact from one code
 * path — there is no list left to go stale.
 *
 * Honest limit: this finds a marker stored verbatim in the emitted bytes. It
 * cannot see inside a compressed container (a `.woff2` table, a zipped asset),
 * because those bytes are not the marker's bytes. Markers are long, specific,
 * private-only strings, so scanning binaries costs no realistic false positive.
 */
export function scanPublicBundle(root = PUBLIC_ROOT) {
  const violations = [];
  for (const file of files(root)) {
    let text;
    try {
      text = readFileSync(file, 'latin1');
    } catch {
      continue;
    }
    violations.push(...publicMarkerViolationsIn(text, relative(root, file)));
  }
  return violations;
}

/** The public-free lane marker the server-selected public index must carry. */
const PUBLIC_LANE_MARKER = 'name="gw-build-lane" content="public-free"';

/**
 * Sibling artifacts inside the same output directory (issue #55).
 *
 * `vite.config.ts` writes the two lanes to `dist/public` and `dist/client`, so a
 * full `build:all` leaves both under one `dist/`. That combined directory is a
 * verification workspace, never a deployment package: uploading its parent would
 * publish the private-beta client alongside the public lane, and every marker
 * check above would still have passed because it only ever read `dist/public`.
 *
 * A sibling is private when it is a browser artifact (`index.html`) that does not
 * carry the public-free lane marker. Detecting it by evidence rather than by the
 * name `client` means a renamed or newly added private lane is caught too.
 *
 * Split pure-decision from filesystem walk, matching `violationsIn` /
 * `scanDirectExposure` in the sibling guard: the repository carries no
 * `@types/node`, so only the pure half is reachable from the TypeScript suite.
 *
 * @param siblings entries beside the public root — `indexHtml` is the sibling's
 *   `index.html` text, or `null` when the entry is not a browser artifact.
 */
export function privateSiblingLanes(siblings) {
  return siblings
    .filter((s) => typeof s.indexHtml === 'string' && !s.indexHtml.includes(PUBLIC_LANE_MARKER))
    .map((s) => s.name);
}

/** Read the siblings of `root` and apply {@link privateSiblingLanes} to them. */
export function privateSiblingArtifacts(root = PUBLIC_ROOT) {
  const parent = dirname(root);
  const self = basename(root);
  if (!existsSync(parent)) return [];
  const siblings = [];
  for (const name of readdirSync(parent)) {
    if (name === self) continue;
    const siblingIndex = join(parent, name, 'index.html');
    let indexHtml = null;
    if (existsSync(siblingIndex)) {
      try { indexHtml = readFileSync(siblingIndex, 'utf8'); } catch { indexHtml = null; }
    }
    siblings.push({ name, indexHtml });
  }
  return privateSiblingLanes(siblings);
}

export function assertPublicBundle(root = PUBLIC_ROOT) {
  const index = join(root, 'index.html');
  if (!existsSync(index)) {
    throw new Error(`public bundle is missing ${relative(REPO_ROOT, index)}`);
  }
  const html = readFileSync(index, 'utf8');
  if (!html.includes(PUBLIC_LANE_MARKER)) {
    throw new Error('public index is missing the server-selected public-free lane marker');
  }
  if (!html.includes('Government Watchdog — Alpine Free Preview')) {
    throw new Error('public index retained the wrong document title');
  }
  const violations = scanPublicBundle(root);
  if (violations.length) {
    throw new Error(
      `public bundle contains protected/private material:\n${violations.map((v) => `  - ${v}`).join('\n')}`,
    );
  }
}

/**
 * Validate a directory that is about to be published as the public package.
 *
 * This is a strictly stronger claim than {@link assertPublicBundle}: the lane's
 * own contents are clean AND nothing private sits beside it. The two are kept
 * separate because `build:all` deliberately produces a combined `dist/` for
 * verification — that workspace has a clean public lane but is not a package.
 */
export function assertPublicPackage(root = PUBLIC_ROOT) {
  assertPublicBundle(root);
  const siblings = privateSiblingArtifacts(root);
  if (siblings.length) {
    throw new Error(
      `${relative(REPO_ROOT, dirname(root))} holds a private client artifact beside the public lane `
      + `and must never be deployed as a public package:\n${siblings.map((s) => `  - ${s}`).join('\n')}\n`
      + `Deploy ${relative(REPO_ROOT, root)} itself, not its parent directory.`,
    );
  }
}

function main() {
  // `--package` asserts the stronger deployment-package claim. Bare invocation
  // keeps the original content-only contract, so it stays meaningful against the
  // combined `dist/` a full `build:all` leaves behind.
  const asPackage = process.argv.includes('--package');
  try {
    if (asPackage) assertPublicPackage(); else assertPublicBundle();
    console.log(
      `✓ public ${asPackage ? 'deployment package' : 'bundle'} boundary passed: `
      + `${relative(REPO_ROOT, PUBLIC_ROOT)} contains no protected markers`
      + `${asPackage ? ' and sits beside no private client artifact' : ''}.`,
    );
  } catch (error) {
    console.error(
      `\n✗ public ${asPackage ? 'deployment package' : 'bundle'} boundary FAILED:\n`
      + `${error instanceof Error ? error.message : error}\n`,
    );
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
