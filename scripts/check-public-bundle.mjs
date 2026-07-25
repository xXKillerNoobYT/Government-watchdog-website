/**
 * Public asset-lane enforcement.
 *
 * This scans the completed browser artifact, not only the DOM or source tree.
 * A public build fails if private admission code, captured civic rows, design
 * fixtures, or the private Sites marker survived bundling or source mapping.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
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
  'alpine_local_corpus:ai:00000064:0021',
  'stmt-pending',
  'stmt-disputed',
];

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.mjs',
  '.svg',
  '.txt',
  '.xml',
]);

function extension(path) {
  const at = path.lastIndexOf('.');
  return at >= 0 ? path.slice(at).toLowerCase() : '';
}

function* files(root) {
  if (!existsSync(root)) return;
  if (statSync(root).isFile()) {
    yield root;
    return;
  }
  for (const name of readdirSync(root)) yield* files(join(root, name));
}

export function scanPublicBundle(root = PUBLIC_ROOT) {
  const violations = [];
  for (const file of files(root)) {
    if (!TEXT_EXTENSIONS.has(extension(file))) continue;
    const text = readFileSync(file, 'utf8');
    for (const marker of FORBIDDEN_PUBLIC_MARKERS) {
      if (text.includes(marker)) {
        violations.push(`${relative(root, file)} contains forbidden marker ${JSON.stringify(marker)}`);
      }
    }
  }
  return violations;
}

export function assertPublicBundle(root = PUBLIC_ROOT) {
  const index = join(root, 'index.html');
  if (!existsSync(index)) {
    throw new Error(`public bundle is missing ${relative(REPO_ROOT, index)}`);
  }
  const html = readFileSync(index, 'utf8');
  if (!html.includes('name="gw-build-lane" content="public-free"')) {
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

function main() {
  try {
    assertPublicBundle();
    console.log(
      `✓ public bundle boundary passed: ${relative(REPO_ROOT, PUBLIC_ROOT)} contains no protected markers.`,
    );
  } catch (error) {
    console.error(`\n✗ public bundle boundary FAILED:\n${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
