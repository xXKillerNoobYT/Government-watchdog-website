/**
 * GOV-1527 §5 "same-origin /api" enforcement — direct-exposure build check.
 *
 * The browser must reach the auth/notification service ONLY through the
 * website origin's `/api/*` path; the service binds loopback and is never a
 * second public hostname or an exposed port (`Docs/gov1523-artifact-contract-spec.md`
 * §5). This check FAILS THE BUILD if the loopback service host:port leaks into
 * any surface a browser or deploy platform could route to directly:
 *
 *   - client/static sources (`src/`, `public/`, `index.html`)  -> would create a
 *     direct cross-origin call, bypassing the proxy (CORS surface / leak).
 *   - deploy/hosting config (`.openai/`, `deploy/`)            -> would map the
 *     internal port to the public internet.
 *
 * The port may ONLY be named where it legitimately belongs: the Vite dev/preview
 * proxy target (`vite.config.ts`) and the orchestration scripts (`scripts/`).
 * This is the website half of the §5 double-enforcement (the service itself
 * refuses non-loopback binds — `ALLOWED_BIND_HOSTS`).
 *
 * Pure + side-effect-free scan; runs in the default build and in CI (no backend
 * required). Exit non-zero on any violation.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');

/** The loopback service the /api proxy forwards to (default per 1b run.py),
 * plus the fixed in-container service port from the GOV-1543 deploy runbook
 * (deploy/entrypoint.sh starts run.py on 8100; only Caddy's 8080 is mapped). */
const SERVICE_PORTS = [...new Set([Number(process.env.GW_SERVICE_PORT ?? 8791), 8100])];
const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '0.0.0.0', '::1'];

// Surfaces a browser or the deploy platform could route to directly. The port
// must NOT appear here. (scripts/ and vite.config.ts are the sanctioned homes.)
// GOV-1544: the deploy config joins the scan — fly.toml/Dockerfile must never
// map the service port; the two sanctioned in-container references are below.
const SCANNED = ['src', 'public', 'index.html', '.openai', 'deploy', 'Dockerfile', 'fly.toml'];

// The ONLY sanctioned service-port references inside the deploy surface: the
// edge server's loopback reverse-proxy target and the entrypoint's --port arg.
// Both are in-container loopback wiring — nothing the platform maps publicly.
const SANCTIONED = [
  { file: /(^|\/)deploy\/Caddyfile$/, line: /^\s*reverse_proxy 127\.0\.0\.1:\d+\s*$/ },
  { file: /(^|\/)deploy\/entrypoint\.sh$/, line: /--port \d+/ },
];

// A direct address to the service: `<loopback>:<port>` or a bare `:<port>` in a
// public-port / expose list. We match the port next to a host or an "expose"/
// "port(s)" key so an unrelated number can't trip it.
function violationsIn(text, relPath) {
  const hits = [];
  const sanctioned = SANCTIONED.filter((s) => s.file.test(relPath));
  for (const port of SERVICE_PORTS.map(String)) {
    const hostAddr = new RegExp(`(?:${LOOPBACK_HOSTS.map((h) => h.replace(/\./g, '\\.')).join('|')})[:\\s]${port}\\b`);
    const exposeList = new RegExp(`"?(?:expose|public_?ports?|ports?|external_?port)"?\\s*[:=].*\\b${port}\\b`, 'i');
    for (const line of text.split('\n')) {
      if (!hostAddr.test(line) && !exposeList.test(line)) continue;
      if (sanctioned.some((s) => s.line.test(line))) continue;
      hits.push(line.trim().slice(0, 160));
    }
  }
  return hits;
}

function* files(root) {
  if (!existsSync(root)) return;
  if (statSync(root).isFile()) { yield root; return; }
  for (const name of readdirSync(root)) {
    if (name === 'node_modules' || name === '.artifact' || name === 'dist') continue;
    const full = join(root, name);
    if (statSync(full).isDirectory()) yield* files(full);
    else yield full;
  }
}

function main() {
  const violations = [];
  for (const target of SCANNED) {
    for (const file of files(join(REPO_ROOT, target))) {
      // only text-ish files
      if (/\.(png|jpg|jpeg|gif|woff2?|ico|gz|zip|map)$/i.test(file)) continue;
      let text;
      try { text = readFileSync(file, 'utf8'); } catch { continue; }
      for (const line of violationsIn(text, relative(REPO_ROOT, file)))
        violations.push(`${relative(REPO_ROOT, file)}: ${line}`);
    }
  }

  if (violations.length) {
    console.error('\n✗ direct-exposure check FAILED (§5): a loopback service port '
      + `(${SERVICE_PORTS.join('/')}) is reachable outside the /api proxy:\n`);
    for (const v of violations) console.error('  ' + v);
    console.error('\nThe browser must talk only to the website origin via /api/*. '
      + 'Route through the proxy; never address the service host:port from client/static/deploy config.\n');
    process.exit(1);
  }
  console.log(`✓ direct-exposure check passed: no client/static/deploy reference to the loopback service ports ${SERVICE_PORTS.join('/')} (§5).`);
}

main();
