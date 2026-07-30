/**
 * GOV-1527 §5 "same-origin /api" enforcement — direct-exposure build check.
 *
 * The browser must reach the auth/notification service ONLY through the
 * website origin's `/api/*` path; the service binds loopback and is never a
 * second public hostname or an exposed port (`Docs/gov1523-artifact-contract-spec.md`
 * §5). This check FAILS THE BUILD if a direct network destination leaks into
 * any surface a browser or deploy platform could route to directly:
 *
 *   - client/static sources (`src/`, `public/`, `public-entry/`, `index.html`)
 *     -> would create a direct cross-origin call, bypassing the proxy.
 *   - deploy/hosting config (`.openai/`, `deploy/`)            -> would map the
 *     internal port to the public internet.
 *   - browser-facing API configuration (`.env*`)               -> Vite inlines
 *     every `VITE_*` value into the shipped bundle, so an absolute or
 *     credential-bearing endpoint there IS a client-side destination.
 *
 * The port may ONLY be named where it legitimately belongs: the Vite dev/preview
 * proxy target (`vite.config.ts`) and the orchestration scripts (`scripts/`).
 * This is the website half of the §5 double-enforcement (the service itself
 * refuses non-loopback binds — `ALLOWED_BIND_HOSTS`).
 *
 * Issue #55 generalized the scan. It previously recognized only two known
 * loopback service ports, so `http://127.0.0.1:8787/read` — a form documented in
 * `.env.example` — would have passed silently. The rules below are stated by
 * *shape* rather than by port number, and each violation names the rule that
 * matched so the failure is actionable rather than a bare grep hit.
 *
 * Pure + side-effect-free scan; runs in the default build and in CI (no backend
 * required). Exit non-zero on any violation.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The loopback service the /api proxy forwards to (default per 1b run.py),
 * plus the fixed in-container service port from the GOV-1543 deploy runbook
 * (deploy/entrypoint.sh starts run.py on 8100; only Caddy's 8080 is mapped). */
const SERVICE_PORTS = [...new Set([Number(process.env.GW_SERVICE_PORT ?? 8791), 8100])];

/** Hosts that are never reachable from a visitor's browser. Naming one of these
 * with a port in a shipped surface is a direct destination by definition — the
 * specific port does not matter, which is the #55 generalization. */
const NON_ROUTABLE_HOSTS = ['127.0.0.1', 'localhost', '0.0.0.0', '::1', '[::1]'];

/** Private, link-local, and metadata ranges, matched structurally rather than
 * enumerated. 169.254.169.254 (cloud instance metadata) falls out of the
 * link-local branch. */
const PRIVATE_HOST_PATTERN = String.raw`(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})`;

// Surfaces a browser or the deploy platform could route to directly. A direct
// destination must NOT appear here. (scripts/ and vite.config.ts are the
// sanctioned homes.) GOV-1544: the deploy config joins the scan — fly.toml and
// Dockerfile must never map the service port; the two sanctioned in-container
// references are below.
export const SCANNED = [
  'src',
  'public',
  'public-entry',
  'index.html',
  '.openai',
  'deploy',
  'Dockerfile',
  'fly.toml',
];

/** Browser-facing API configuration. Vite inlines `VITE_*` into the bundle, so
 * these files configure the client's network destinations even though no
 * browser loads them directly. Scanned with the API-config value rules only. */
export const API_CONFIG_SCANNED = ['.env', '.env.local', '.env.example', '.env.production'];

// The ONLY sanctioned service-port references inside the deploy surface: the
// edge server's loopback reverse-proxy target and the entrypoint's --port arg.
// Both are in-container loopback wiring — nothing the platform maps publicly.
const SANCTIONED = [
  { file: /(^|\/)deploy\/Caddyfile$/, line: /^\s*reverse_proxy 127\.0\.0\.1:\d+\s*$/ },
  { file: /(^|\/)deploy\/entrypoint\.sh$/, line: /--port \d+/ },
];

/** Config keys whose value is a network destination. Other keys (feature flags,
 * ports consumed by `scripts/`) are not browser destinations and are ignored. */
const URL_VALUED_KEY = /(?:URL|BASE|ENDPOINT|ORIGIN|HOST)$/;

const ENCODED_SEPARATOR = /%(?:25)*(?:2f|5c)/i;
/** True when a value carries a C0/DEL control character. Written as a code-point
 * test rather than a regex literal so this source file stays plain ASCII. */
function hasControlChar(value) {
  for (const ch of value) {
    const code = ch.codePointAt(0);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Replace any `user:password@` authority with a fixed marker. AC8: a violation
 * report names the file, the matched value, and the rule — but a credential
 * that leaked into config must not be reprinted into build logs or CI output.
 */
export function redactCredentials(value) {
  return value.replace(/\/\/[^/\s@]*:[^/\s@]*@/g, '//***:***@');
}

/**
 * Rules applied to a whole line of a shipped/deploy surface.
 *
 * `loopback-host` deliberately supersedes the former port-specific host match:
 * any port on a non-routable host is a direct destination, so enumerating the
 * two known service ports only narrowed the guard without making it safer.
 */
const LINE_RULES = [
  {
    id: 'loopback-host',
    why: 'a non-routable host:port is a direct destination; the browser must use same-origin /api/*',
    pattern: new RegExp(
      `(?:${NON_ROUTABLE_HOSTS.map((h) => h.replace(/[.[\]]/g, '\\$&')).join('|')}|${PRIVATE_HOST_PATTERN})[:\\s]\\d{2,5}\\b`,
    ),
  },
  {
    id: 'url-userinfo',
    why: 'credentials embedded in a URL are shipped to the browser and logged by intermediaries',
    pattern: /[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/\s"'`]*:[^/\s"'`]*@/,
  },
  {
    id: 'service-port-exposed',
    why: 'the deploy platform would map the internal service port to the public internet',
    pattern: new RegExp(
      `"?(?:expose|public_?ports?|ports?|external_?port)"?\\s*[:=].*\\b(?:${SERVICE_PORTS.join('|')})\\b`,
      'i',
    ),
  },
];

/**
 * Rules applied to the *value* of a browser-facing API configuration key.
 *
 * The contract is narrow on purpose: a browser-facing endpoint is a root-relative
 * path with no authority component. Everything else — a scheme, a network-path
 * reference, a backslash, an encoded separator, a port — describes a destination
 * off this origin, which the same-origin contract forbids regardless of host.
 * `src/data/api.ts#safeApiBase` enforces the same shape at runtime; this makes
 * the build say so out loud instead of silently falling back to `/api`.
 *
 * Order matters only for which rule is *named* first; every form is rejected.
 */
const VALUE_RULES = [
  {
    id: 'api-config-network-path',
    why: 'a `//host` value is a protocol-relative reference the browser resolves off-origin',
    test: (v) => v.startsWith('//'),
  },
  {
    id: 'api-config-backslash',
    why: 'browsers normalize `\\` to `/`, so a backslash form becomes a network-path reference',
    test: (v) => v.includes('\\'),
  },
  {
    id: 'api-config-userinfo',
    why: 'credentials in an endpoint are inlined into the shipped bundle',
    test: (v) => v.includes('@'),
  },
  {
    id: 'api-config-encoded-separator',
    why: 'an encoded `/` or `\\` can become a network-path reference after a decode or rewrite layer',
    test: (v) => ENCODED_SEPARATOR.test(v),
  },
  {
    id: 'api-config-control-char',
    why: 'control characters split or smuggle a second destination past naive parsers',
    test: (v) => hasControlChar(v),
  },
  {
    id: 'api-config-absolute',
    why: 'an absolute or ported endpoint leaves this origin; the same-origin contract allows only a root-relative path',
    test: (v) => !v.startsWith('/') || v.includes(':'),
  },
];

/**
 * Violations on one line of a shipped or deploy surface.
 *
 * Returns `{rule, why, value}` objects. The array shape is unchanged from the
 * original string-returning version, so `violationsIn(...).length` still reads
 * as "is this line clean?".
 */
export function violationsIn(text, relPath) {
  const hits = [];
  const sanctioned = SANCTIONED.filter((s) => s.file.test(relPath));
  for (const line of text.split('\n')) {
    if (sanctioned.some((s) => s.line.test(line))) continue;
    for (const rule of LINE_RULES) {
      if (!rule.pattern.test(line)) continue;
      hits.push({ rule: rule.id, why: rule.why, value: redactCredentials(line.trim().slice(0, 160)) });
    }
  }
  return hits;
}

/**
 * Violations in a browser-facing API configuration file (`.env*` shape).
 *
 * Only assignments are evaluated — a commented example is documentation, not a
 * shipped destination, and an empty value means "unset".
 */
export function apiConfigViolationsIn(text) {
  const hits = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at <= 0) continue;
    const key = line.slice(0, at).replace(/^export\s+/, '').trim();
    if (!URL_VALUED_KEY.test(key)) continue;
    const value = line.slice(at + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!value) continue; // unset
    const rule = VALUE_RULES.find((r) => r.test(value));
    if (rule) hits.push({ rule: rule.id, why: rule.why, value: `${key}=${redactCredentials(value)}` });
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

export function scanDirectExposure(repoRoot = REPO_ROOT) {
  const violations = [];
  for (const target of SCANNED) {
    for (const file of files(join(repoRoot, target))) {
      // only text-ish files
      if (/\.(png|jpg|jpeg|gif|woff2?|ico|gz|zip|map)$/i.test(file)) continue;
      let text;
      try { text = readFileSync(file, 'utf8'); } catch { continue; }
      const relPath = relative(repoRoot, file);
      for (const hit of violationsIn(text, relPath)) violations.push({ file: relPath, ...hit });
    }
  }
  for (const target of API_CONFIG_SCANNED) {
    const file = join(repoRoot, target);
    if (!existsSync(file)) continue;
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    for (const hit of apiConfigViolationsIn(text)) violations.push({ file: target, ...hit });
  }
  return violations;
}

function main() {
  const violations = scanDirectExposure();
  if (violations.length) {
    console.error('\n✗ direct-exposure check FAILED (§5): a browser-reachable surface names a '
      + 'destination off this origin:\n');
    for (const v of violations) {
      console.error(`  [${v.rule}] ${v.file}\n      ${v.value}\n      ${v.why}\n`);
    }
    console.error('The browser must talk only to the website origin via /api/*. '
      + 'Route through the proxy; never address a service host:port or an absolute '
      + 'endpoint from client/static/deploy config or from a VITE_* value.\n');
    process.exit(1);
  }
  console.log('✓ direct-exposure check passed: no client/static/deploy surface and no '
    + 'browser-facing API configuration names an off-origin destination (§5).');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
