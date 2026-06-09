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

/** Field names that must NEVER appear in any web-safe payload (keys or nested). */
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
