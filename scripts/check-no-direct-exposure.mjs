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
 * Issue #55 also gave the check a second mode. `--emitted <dir>` audits a BUILT
 * artifact instead of the source tree: emitted JavaScript, CSS, HTML, JSON,
 * source maps, workers, manifests, and binary assets. Source scanning alone
 * cannot see a destination introduced by a dependency, a dynamic import, or an
 * asset reference Rollup rewrote — and the artifact is what a visitor actually
 * downloads.
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
 * The subset of {@link VALUE_RULES} that judges a value on its *shape as a
 * destination*, rather than on "is this a root-relative path".
 *
 * `api-config-absolute` is the catch-all: it rejects anything not starting with
 * `/`, which is correct for a key that is declared to hold an endpoint and wrong
 * for one that is not — `VITE_USE_FIXTURES=false` would trip it. Everything else
 * in `VALUE_RULES` describes a form that is never legitimate in any value.
 */
const DESTINATION_RULES = VALUE_RULES.filter((r) => r.id !== 'api-config-absolute');

/**
 * Stands in for `api-config-absolute` on keys that are not declared endpoints.
 *
 * Requires a real authority — a scheme with `//`, or a dotted host with a port,
 * or a dotted host followed by a path — so `false`, `8791`, and `local:/path`
 * stay clean while `https://evil.example` and `evil.example:8787/read` do not.
 */
const OFF_ORIGIN_VALUE = [
  /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//,
  /\b[a-z0-9-]+(?:\.[a-z0-9-]+)+:\d{2,5}\b/i,
  /^[a-z0-9-]+(?:\.[a-z0-9-]+)+\//i,
];

const DESTINATION_VALUE_RULE = {
  id: 'api-config-destination-value',
  why: 'Vite inlines every `VITE_*` value into the shipped bundle, and this one names a destination off this origin',
  test: (v) => OFF_ORIGIN_VALUE.some((p) => p.test(v)),
};

/* ------------------------------------------------------------------------- *
 * Emitted-artifact rules (issue #55, AC2/AC3/AC5)
 *
 * The rules above read the *source* tree. `files()` below deliberately skips
 * `dist/`, and the sibling guard (`check-public-bundle.mjs`) reads `dist/` only
 * for literal private markers — so until now nothing asked whether an off-origin
 * *destination* survived bundling. That seam is what these rules close.
 *
 * Auditing the emitted artifact is a stronger claim than walking the
 * Vite/Rollup module graph: Rollup rewrites dynamic `import()` and
 * `new URL(..., import.meta.url)` into emitted files, so the artifact *is* the
 * resolved graph, and it cannot drift from what actually ships.
 *
 * The rules key on *dial position*, never on "contains an absolute URL".
 * Captured civic records legitimately cite `https://alpinewy.gov/...`, and those
 * citations are bundled into the artifact verbatim. A citation is evidence; a
 * `fetch(...)`, `<link href>`, or CSS `url(...)` is a destination. Confusing the
 * two would fail the build on honest data — the exact outcome the honesty
 * contract exists to prevent.
 * ------------------------------------------------------------------------- */

/** A scheme-ful or protocol-relative reference. Both leave this origin; `data:`,
 * `blob:`, and root-relative paths have no `//` authority and are not matched. */
const OFF_ORIGIN = String.raw`(?:[a-zA-Z][a-zA-Z0-9+.-]{1,31}:)?\/\/[^\s"'\`)>]{1,300}`;
const QUOTE = String.raw`["'\`]`;
const HTTP_METHOD = String.raw`(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)`;

/** How far past a dial to look for an attached credential (AC3). Wide enough to
 * span a minified options object, narrow enough that unrelated code nearby does
 * not get blamed. */
const CREDENTIAL_WINDOW = 400;

/** Credentials, bearer headers, and cookies (AC3). Matched only inside a dial's
 * window — `credentials: 'same-origin'` on a `/api` call is the correct pattern
 * and must keep passing. */
const CREDENTIAL_MARKER =
  /credentials\s*:\s*["'`]include["'`]|withCredentials\s*[:=]\s*(?:!0|true)|["'`]?(?:Authorization|Cookie|X-Api-Key)["'`]?\s*:|Bearer\s/i;

const CREDENTIALED_WHY =
  'credentials, a bearer header, or a cookie are attached to an off-origin destination';

/**
 * Rules applied to a whole emitted artifact.
 *
 * `dial: true` marks a rule whose match is a network destination the app
 * addresses. Those get the AC3 credential lookahead; the others are unsafe by
 * shape alone and need no context.
 */
const EMITTED_RULES = [
  {
    id: 'emitted-loopback-host',
    why: 'a non-routable host:port survived bundling; the browser cannot reach it and must use same-origin /api/*',
    pattern: new RegExp(
      `(?:${NON_ROUTABLE_HOSTS.map((h) => h.replace(/[.[\]]/g, '\\$&')).join('|')}|${PRIVATE_HOST_PATTERN})[:\\s]\\d{2,5}\\b`,
      'g',
    ),
  },
  {
    id: 'emitted-url-userinfo',
    why: 'credentials embedded in a URL shipped to the browser and are logged by intermediaries',
    pattern: /[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/\s"'`]*:[^/\s"'`]*@/g,
  },
  {
    id: 'emitted-off-origin-dial',
    why: 'a network API is called with an off-origin destination; the browser must talk only to this origin',
    dial: true,
    pattern: new RegExp(
      `\\b(?:fetch|importScripts|sendBeacon|EventSource|WebSocket|SharedWorker|Worker|import)\\s*\\(\\s*${QUOTE}\\s*(?:${OFF_ORIGIN})`,
      'gi',
    ),
  },
  {
    id: 'emitted-off-origin-xhr',
    why: 'XMLHttpRequest is opened against an off-origin destination',
    dial: true,
    // The method argument is required, which is what distinguishes an XHR open
    // from `window.open(...)` navigating to a cited public record.
    pattern: new RegExp(
      `\\.open\\s*\\(\\s*${QUOTE}${HTTP_METHOD}${QUOTE}\\s*,\\s*${QUOTE}\\s*(?:${OFF_ORIGIN})`,
      'gi',
    ),
  },
  {
    id: 'emitted-off-origin-module',
    why: 'a static import resolves to an off-origin module rather than an emitted local chunk',
    dial: true,
    pattern: new RegExp(`\\bfrom\\s*${QUOTE}\\s*(?:${OFF_ORIGIN})`, 'gi'),
  },
  {
    id: 'emitted-off-origin-asset',
    why: '`new URL(..., import.meta.url)` names an off-origin asset instead of one Rollup emitted locally',
    dial: true,
    pattern: new RegExp(
      `new\\s+URL\\s*\\(\\s*${QUOTE}\\s*(?:${OFF_ORIGIN})[^)]{0,300}?import\\s*\\.\\s*meta\\s*\\.\\s*url`,
      'gi',
    ),
  },
  {
    id: 'emitted-off-origin-css-url',
    why: 'a stylesheet loads an off-origin resource, leaking every visitor\'s IP and referrer to a third party',
    dial: true,
    pattern: new RegExp(`\\burl\\(\\s*${QUOTE}?\\s*(?:${OFF_ORIGIN})`, 'gi'),
  },
  {
    id: 'emitted-off-origin-subresource',
    why: 'a markup subresource is fetched off-origin; only `<a href>` may cite an external record',
    dial: true,
    // `src`/`srcset`/`action` and `<link href>` are loads. A bare `href` is not
    // matched: that is how a civic citation appears in rendered markup.
    pattern: new RegExp(
      `(?:\\b(?:src|srcset|action|formaction|data-src)\\s*=|<link\\b[^>]{0,200}?\\bhref\\s*=)\\s*${QUOTE}?\\s*(?:${OFF_ORIGIN})`,
      'gi',
    ),
  },
];

/** High-signal rules applied to non-text (binary/image/font) emitted assets.
 * Only the two shapes that are never legitimate, so metadata inside a PNG or a
 * font cannot smuggle a destination past the text scan. */
const BINARY_RULE_IDS = new Set(['emitted-loopback-host', 'emitted-url-userinfo']);

/** Emitted files read as text. Anything else is read as bytes and gets the
 * high-signal subset — a list of binary extensions would go stale, an
 * allow-list of text ones does not. */
export const EMITTED_TEXT_EXTENSIONS = new Set([
  '.css', '.htm', '.html', '.js', '.json', '.map', '.mjs', '.cjs',
  '.svg', '.txt', '.webmanifest', '.xml',
]);

/**
 * Undo the escaping a minifier or an attacker can put between a rule and a URL.
 *
 * Rules are written against readable URLs, so every obfuscated form has to be
 * normalized back before matching (AC5). Both the raw and decoded texts are
 * scanned, because decoding can also destroy a match that was plain to begin
 * with.
 */
export function decodeObfuscation(text) {
  let out = text
    // Adjacent string literals joined by `+` — `"htt" + "ps://evil"`.
    .replace(/["'`]\s*\+\s*["'`]/g, '')
    // JSON/JS escapes: \/ \x2f / \u{2f}
    .replace(/\\\//g, '/')
    .replace(/\\x([0-9a-fA-F]{2})/g, (whole, hex) => String.fromCharCode(parseInt(hex, 16)))
    // `\uXXXX` is exactly four hex digits. A variable-length pattern would eat
    // the following character whenever it happens to be a hex digit, so
    // `/evil` would decode to a single wrong code point instead of `/evil`.
    .replace(/\\u([0-9a-fA-F]{4})/g, (whole, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (whole, hex) => {
      const code = parseInt(hex, 16);
      return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    });
  // Percent-encoding, repeatedly, so `%252f` collapses the same as `%2f`.
  for (let pass = 0; pass < 3; pass += 1) {
    const next = out.replace(/%([0-9a-fA-F]{2})/g, (whole, hex) => {
      const code = parseInt(hex, 16);
      // Control characters stay encoded: decoding them would splice lines and
      // manufacture matches that are not in the artifact.
      return code >= 0x20 && code !== 0x7f ? String.fromCharCode(code) : whole;
    });
    if (next === out) break;
    out = next;
  }
  return out;
}

/** A short, readable excerpt centered on a match, for the AC8 report. */
function excerpt(text, at, length) {
  const start = Math.max(0, at - 24);
  const slice = text.slice(start, Math.min(text.length, at + length + 24)).replace(/\s+/g, ' ');
  return `${start > 0 ? '...' : ''}${slice.trim()}`.slice(0, 160);
}

/**
 * Violations in one emitted artifact.
 *
 * Whole-text rather than line-by-line: a production bundle is a single line, so
 * the line-oriented {@link violationsIn} would report the entire chunk as one
 * value. Matches are deduplicated by rule and excerpt, because a minifier can
 * repeat the same destination in many chunks and one finding per destination is
 * what makes the report actionable.
 *
 * @param onlyRules optional set of rule ids, used for the binary subset.
 */
export function emittedViolationsIn(text, relPath = '', onlyRules = null) {
  const hits = [];
  const seen = new Set();
  const variants = [text];
  const decoded = decodeObfuscation(text);
  if (decoded !== text) variants.push(decoded);

  for (const variant of variants) {
    for (const rule of EMITTED_RULES) {
      if (onlyRules && !onlyRules.has(rule.id)) continue;
      const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
      pattern.lastIndex = 0;
      let match = pattern.exec(variant);
      while (match !== null) {
        const value = redactCredentials(excerpt(variant, match.index, match[0].length));
        const credentialed = rule.dial === true
          && CREDENTIAL_MARKER.test(variant.slice(match.index, match.index + CREDENTIAL_WINDOW));
        const id = credentialed ? `${rule.id}-credentialed` : rule.id;
        // Key on the matched destination, not the report excerpt: the excerpt
        // carries surrounding context, so one destination repeated across
        // minified chunks would yield one finding per copy.
        const key = `${id} ${redactCredentials(match[0])}`;
        if (!seen.has(key)) {
          seen.add(key);
          hits.push({ rule: id, why: credentialed ? CREDENTIALED_WHY : rule.why, value });
        }
        if (pattern.lastIndex === match.index) pattern.lastIndex += 1;
        match = pattern.exec(variant);
      }
    }
  }
  return hits;
}

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
 *
 * Which rules a key gets depends on what the key promises (issue #101):
 *
 * - **A declared endpoint** (`*_URL`, `*_BASE`, `*_ENDPOINT`, `*_ORIGIN`, `*_HOST`)
 *   is contracted to hold a root-relative path, so it gets every rule including
 *   the `api-config-absolute` catch-all.
 * - **Any other `VITE_*` key** is still inlined verbatim into the shipped bundle
 *   by Vite, so it is judged on what its value *contains* — the destination-shaped
 *   rules plus {@link DESTINATION_VALUE_RULE}. It is not held to "must be a path",
 *   because most such keys legitimately are not one.
 * - **Everything else** is build-time only and never reaches the browser.
 *
 * That inversion is the point: before, an unrecognized key name was silently
 * trusted; now an unrecognized key name is still judged on what it actually holds.
 */
export function apiConfigViolationsIn(text) {
  const hits = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at <= 0) continue;
    const key = line.slice(0, at).replace(/^export\s+/, '').trim();
    const declaredEndpoint = URL_VALUED_KEY.test(key);
    const inlinedIntoBundle = key.startsWith('VITE_');
    if (!declaredEndpoint && !inlinedIntoBundle) continue;
    const value = line.slice(at + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!value) continue; // unset
    const rules = declaredEndpoint ? VALUE_RULES : [...DESTINATION_RULES, DESTINATION_VALUE_RULE];
    const rule = rules.find((r) => r.test(value));
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

function extension(path) {
  const at = path.lastIndexOf('.');
  return at >= 0 ? path.slice(at).toLowerCase() : '';
}

/**
 * Scan a built artifact directory (`dist/public`, `dist/client`) — AC2.
 *
 * Text artifacts get every emitted rule; everything else is read as bytes and
 * gets the two shapes that are never legitimate, so a destination hidden in
 * image or font metadata is still caught.
 */
export function scanEmittedArtifact(root) {
  const violations = [];
  for (const file of files(root)) {
    const isText = EMITTED_TEXT_EXTENSIONS.has(extension(file));
    let text;
    try {
      text = readFileSync(file, isText ? 'utf8' : 'latin1');
    } catch {
      continue;
    }
    const relPath = relative(root, file);
    const hits = isText
      ? emittedViolationsIn(text, relPath)
      : emittedViolationsIn(text, relPath, BINARY_RULE_IDS);
    for (const hit of hits) violations.push({ file: relPath, ...hit });
  }
  return violations;
}

/** Repo-relative when the target is inside the repo, absolute otherwise — a
 * `../../../..` chain is not "the exact file" AC8 asks the report to name. */
function displayPath(target) {
  const rel = relative(REPO_ROOT, target);
  return rel && !rel.startsWith('..') ? rel : target;
}

function report(violations, headline, remedy) {
  if (!violations.length) return false;
  console.error(`\n✗ ${headline}\n`);
  for (const violation of violations) {
    console.error(`  [${violation.rule}] ${violation.file}\n      ${violation.value}\n      ${violation.why}\n`);
  }
  console.error(`${remedy}\n`);
  return true;
}

/**
 * `--emitted <dir>` audits a built artifact; bare invocation audits the source
 * tree. Two modes rather than two scripts: both answer the same question — does
 * a browser-reachable surface name a destination off this origin — from the same
 * rule vocabulary, and splitting them would let the definitions drift apart.
 */
function mainEmitted(root) {
  if (!existsSync(root)) {
    console.error(`\n✗ emitted-artifact check FAILED: ${root} does not exist. Build before scanning.\n`);
    process.exit(1);
  }
  const violations = scanEmittedArtifact(root);
  const failed = report(
    violations,
    `emitted-artifact check FAILED (§5): the built artifact at ${displayPath(root)} `
    + 'addresses a destination off this origin:',
    'The shipped bundle must dial only this origin via /api/*. Remove the off-origin '
    + 'destination, or route it through the proxy. Citations of public records are fine — '
    + 'only fetches, imports, stylesheet loads, and markup subresources are flagged.',
  );
  if (failed) process.exit(1);
  console.log(`✓ emitted-artifact check passed: ${displayPath(root)} names no `
    + 'off-origin destination in any emitted script, style, markup, map, manifest, or asset (§5).');
}

function main() {
  const emittedAt = process.argv.indexOf('--emitted');
  if (emittedAt >= 0) {
    return mainEmitted(resolve(REPO_ROOT, process.argv[emittedAt + 1] ?? 'dist'));
  }
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
