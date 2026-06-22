/**
 * Frontend web-safe guard — defense-in-depth mirror of the backend transport
 * sweep (`read_api.assert_no_raw_paths`, GOV-34).
 *
 * The backend already strips raw/private locators at two layers. This client
 * re-runs an equivalent body sweep on whatever it receives (live API OR
 * fixture) so a mis-allowlisted field or a hand-edited fixture can never paint
 * a vault/absolute path into the reviewer-internal UI. Standing gate: server
 * raw-path stripping verified at transport — we also fail loud on the client.
 */

/**
 * Raw-path / private-locator field names that must NEVER appear in any web-safe
 * payload (keys or nested). This is the raw-path/private-locator SUBSET of the
 * backend `WEB_UNSAFE_FIELDS` (GOV-98) — deliberately NOT a 1:1 mirror. The
 * backend's purely operational reviewer-state fields (e.g. `raw_preservation_status`,
 * `robots_policy`, `registered_utc`) are not raw-path locators and are kept off the
 * wire by the backend's fail-closed allowlist (`to_web_safe`), not by this denylist.
 * Adding them here would be a category error; this list stays scoped to leak-bearing
 * locators. (Per GOV-108 SecurityPrivacy consult.)
 */
export const RAW_PATH_FORBIDDEN_KEYS = [
  'transcript_path',
  'deep_link',
  'raw_local_path',
  'raw_sha256',
  'segment_id',
  'local_ref',
  'localRef',
  'source_ref_local_ref',
  'owner_agent',
  'created_by',
  'notes',
  'note',
  'review_state',
  'local_note_path',
] as const;

/** Substrings that mark a raw/vault/private locator leaking into a value. */
const RAW_PATH_MARKERS = [
  '/Users/',
  '/home/',
  '/var/',
  '/tmp/',
  '/private/',
  '/Volumes/',
  '\\Users\\',
  'Obsidian Vault',
  'Source-Data',
  'TownOfAlpine',
  'Raw-PDFs',
  '.sha256',
  'transcript_path',
  'raw_local',
  'local_note',
] as const;

const URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const WIN_ABS_RE = /^[A-Za-z]:[\\/]/;

export class RawPathLeak extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RawPathLeak';
  }
}

function looksLikeUrl(value: string): boolean {
  return URL_RE.test(value.trim());
}

function isFilesystemPath(value: string): boolean {
  const s = value.trim();
  if (!s || looksLikeUrl(s)) return false;
  return s.startsWith('/') || WIN_ABS_RE.test(s);
}

/**
 * Transport-level (raw-bytes) leak scan. Operates on the response body TEXT —
 * the bytes on the wire, before any parse — so it catches a raw locator even if
 * it hides in a field the structural walk does not name. Returns the list of
 * offending markers/keys found (empty array = clean). This mirrors the backend's
 * `assert_no_raw_paths` transport sweep on the client side (standing gate:
 * server-side raw-path stripping verified AT TRANSPORT) and is what the GOV-104
 * integration smoke asserts as "zero raw/absolute paths in the response body".
 */
export function findRawPathLeaksInText(text: string): string[] {
  const hits: string[] = [];
  for (const key of RAW_PATH_FORBIDDEN_KEYS) {
    if (text.includes(`"${key}"`)) hits.push(`forbidden raw field key "${key}"`);
  }
  for (const marker of RAW_PATH_MARKERS) {
    if (text.includes(marker)) hits.push(`raw marker "${marker}"`);
  }
  return hits;
}

/**
 * Walk every string (keys + values, nested) in `body`. Throw {@link RawPathLeak}
 * if any is an absolute/filesystem path or carries a raw marker, or if any
 * object key is in {@link RAW_PATH_FORBIDDEN_KEYS}. Public URLs are allowed.
 * Returns `body` unchanged on success so it can wrap a response inline.
 */
export function assertWebSafe<T>(body: T): T {
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      if (isFilesystemPath(value)) {
        throw new RawPathLeak(`absolute/filesystem path in response body: ${JSON.stringify(value)}`);
      }
      if (!looksLikeUrl(value)) {
        for (const marker of RAW_PATH_MARKERS) {
          if (value.includes(marker)) {
            throw new RawPathLeak(`raw marker ${JSON.stringify(marker)} in response body: ${JSON.stringify(value)}`);
          }
        }
      }
    } else if (Array.isArray(value)) {
      for (const item of value) visit(item);
    } else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if ((RAW_PATH_FORBIDDEN_KEYS as readonly string[]).includes(key)) {
          throw new RawPathLeak(`forbidden raw field key in response body: ${JSON.stringify(key)}`);
        }
        visit(key);
        visit(child);
      }
    }
  };
  visit(body);
  return body;
}

/**
 * App-relative reviewer-internal route prefix. The ONLY non-web, leading-`/`
 * strings the 4.05 digest object carries are item `links.*` route references
 * (`/alpine/timeline?card=...`, `/alpine/sources/...`). These are frontend ROUTE
 * references, not filesystem paths — so they are exempt from the absolute-path
 * rule, but NOT from the raw-marker scan or the `..` path-traversal check. This
 * mirrors the backend's `stage4_newsletter_feed._assert_local_safe` exemption
 * EXACTLY (same `/alpine/` prefix, same `..` rejection), so the two transport
 * guards single-source one leak vocabulary and cannot drift.
 */
const APP_ROUTE_PREFIX = '/alpine/';

/**
 * Route-aware web-safe sweep for the newsletter digest object (GOV-462). Same
 * leak vocabulary as {@link assertWebSafe} — forbidden raw keys, raw markers,
 * absolute/Windows filesystem paths — with ONE difference: a genuine
 * `/alpine/...` in-app route value is allowed (after a `..` traversal check),
 * because the digest item `links` carry reviewer-internal routes by design (§3).
 * Everything else stays as strict as `assertWebSafe`; `localSourcePath` is always
 * null, so a non-null value carrying a path still fails loud. Returns `body`
 * unchanged on success so it can wrap a response inline.
 */
export function assertDigestWebSafe<T>(body: T): T {
  const checkString = (value: string): void => {
    if (looksLikeUrl(value)) return; // public http(s) URL — exempt
    for (const marker of RAW_PATH_MARKERS) {
      if (value.includes(marker)) {
        throw new RawPathLeak(`raw marker ${JSON.stringify(marker)} in digest body: ${JSON.stringify(value)}`);
      }
    }
    if (value.startsWith(APP_ROUTE_PREFIX)) {
      if (value.includes('..')) {
        throw new RawPathLeak(`path traversal in reviewer-internal route: ${JSON.stringify(value)}`);
      }
      return; // a clean /alpine/ route is exempt from the filesystem-path rule
    }
    if (isFilesystemPath(value)) {
      throw new RawPathLeak(`absolute/filesystem path in digest body: ${JSON.stringify(value)}`);
    }
  };
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      checkString(value);
    } else if (Array.isArray(value)) {
      for (const item of value) visit(item);
    } else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if ((RAW_PATH_FORBIDDEN_KEYS as readonly string[]).includes(key)) {
          throw new RawPathLeak(`forbidden raw field key in digest body: ${JSON.stringify(key)}`);
        }
        checkString(key);
        visit(child);
      }
    }
  };
  visit(body);
  return body;
}
