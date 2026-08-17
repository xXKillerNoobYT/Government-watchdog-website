// @vitest-environment jsdom
//
// GOV-2024 (GOV-1987 AC#8) — website consumer alignment to `supplied_file_dto/v1`.
//
// This is the SEPARATE exact-version reviewed integration that binds the website
// `SuppliedFilesProjection` / `SuppliedSourceFile` types to the authoritative
// backend DTO (`Docs/gov1987-supplied-file-dto-v1-contract.md`, backend commit
// 89a0ec8da644f93bf23090a83e21e57832085485). It proves, from the consumer side:
//
//   - AC #1/#2 — the envelope classifies as `access: web_safe` (NOT
//     `reviewer_internal`), `scope: alpine`, `dataOrigin: reviewed_snapshot`,
//     `dtoVersion: supplied_file_dto/v1`;
//   - AC #3   — the consumer reads the backend field NAMES verbatim and no
//     forbidden field (`review_state` / `original_filename` / `sha256` /
//     `supplied_by`) is on the wire; `title` is honest-`null`, never back-filled
//     from a raw filename;
//   - AC #4   — the honest-unavailable fields (`title`, `published_by`,
//     `archive_url`) render as an honest state, never a guessed value;
//   - AC #5/#6 — the compatibility fixture is pinned by the SAME sha256 the
//     backend pins, so a drift on either side is loud on both;
//   - AC #7   — Simple vs Advanced presentation cannot alter authorization or
//     publication eligibility, because the render is a pure function of the
//     web-safe projection and the wire carries no eligibility-bearing field for
//     a presentation mode to unlock.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  suppliedFileHeading,
  SUPPLIED_FILE_DTO_VERSION,
} from '../src/ui/supplied-files';
import { renderSuppliedFiles } from '../src/ui/pages-program';
import { assertWebSafe, RAW_PATH_FORBIDDEN_KEYS } from '../src/data/web-safe';
import type { SuppliedFilesProjection } from '../src/types/read-api';
import fixtureData from '../src/fixtures/gov1987-supplied-file-dto-v1.sample.json';
// The EXACT committed bytes (Vite `?raw`) — hashed as-is so the pin is over the
// same canonical JSON the backend fixes, not a JS re-serialization of it.
import fixtureRaw from '../src/fixtures/gov1987-supplied-file-dto-v1.sample.json?raw';

// The pinned content hash the backend contract §4 fixes for the canonical JSON.
// The website compat test pins the SAME value; a drift on either side is loud.
const PINNED_SHA256 =
  'f4b8fcf245a8e47a718d71c4fa0973fc6f19b758376ee9651a8a1aa790f6a6d1';

// The exact DTO v1 field set the consumer binds to (contract §2). Consuming the
// backend field NAMES verbatim means this set — no rename, no client-added key.
const DTO_V1_FILE_KEYS = [
  'file_id',
  'title',
  'source_type',
  'meeting_id',
  'agenda_item_id',
  'source_date',
  'published_by',
  'version_group_id',
  'version',
  'original_url',
  'archive_url',
  'provenance_note',
] as const;

// Never on the wire (contract §2 "Never on the wire" + the frontend denylist).
const NEVER_ON_WIRE = ['sha256', 'supplied_by', 'original_filename', 'review_state'] as const;

const FIXTURE = fixtureData as unknown as SuppliedFilesProjection;

describe('GOV-2024 · AC#5/#6 — pinned compatibility fixture', () => {
  it('the committed fixture bytes hash to the backend-pinned sha256', async () => {
    const bytes = new TextEncoder().encode(fixtureRaw);
    const buffer = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const digest = Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(digest).toBe(PINNED_SHA256);
  });

  it('the sample carries two reviewed files plus a content-free pending count', () => {
    expect(FIXTURE.files).toHaveLength(2);
    expect(FIXTURE.pending_review_count).toBe(2);
  });
});

describe('GOV-2024 · AC#1/#2 — envelope classification', () => {
  it('access is the authoritative web_safe, never reviewer_internal', () => {
    expect(FIXTURE.access).toBe('web_safe');
    expect(FIXTURE.access).not.toBe('reviewer_internal');
  });

  it('scope, dataOrigin and the pinned dtoVersion match the contract', () => {
    expect(FIXTURE.scope).toBe('alpine');
    expect(FIXTURE.dataOrigin).toBe('reviewed_snapshot');
    expect(FIXTURE.dtoVersion).toBe('supplied_file_dto/v1');
    expect(FIXTURE.dtoVersion).toBe(SUPPLIED_FILE_DTO_VERSION);
  });
});

describe('GOV-2024 · AC#3 — backend field names, nothing forbidden on the wire', () => {
  it('every file carries exactly the supplied_file_dto/v1 key set (names verbatim)', () => {
    for (const file of FIXTURE.files) {
      expect(Object.keys(file).sort()).toEqual([...DTO_V1_FILE_KEYS].sort());
    }
  });

  it('no forbidden field appears anywhere in the payload', () => {
    const serialized = JSON.stringify(FIXTURE);
    for (const key of NEVER_ON_WIRE) {
      expect(serialized).not.toContain(`"${key}"`);
    }
    // review_state specifically is on the frontend denylist and would trip the
    // leak guard; prove the guard and the contract agree.
    expect(RAW_PATH_FORBIDDEN_KEYS as readonly string[]).toContain('review_state');
    expect(() => assertWebSafe(FIXTURE)).not.toThrow();
  });
});

describe('GOV-2024 · AC#4 — honest-unavailable, never a guessed value', () => {
  it('title is honest null (no reviewer-title column exists yet)', () => {
    for (const file of FIXTURE.files) {
      expect(file.title).toBeNull();
    }
  });

  it('a null title renders an honest heading, never the raw uploader filename', () => {
    for (const file of FIXTURE.files) {
      const heading = suppliedFileHeading(file);
      expect(heading).toBe('Reviewed source file');
      // Never a guessed title, and never anything that looks like a raw filename.
      expect(heading).not.toMatch(/\.(pdf|docx?|xlsx?|csv|txt)$/i);
    }
  });

  it('published_by / archive_url are honest null, not back-filled', () => {
    for (const file of FIXTURE.files) {
      expect(file.published_by).toBeNull();
      expect(file.archive_url).toBeNull();
    }
  });
});

describe('GOV-2024 · AC#7 — Simple/Advanced cannot alter eligibility', () => {
  const MODE_KEY = 'gw_home_mode';
  const query = new URLSearchParams();

  beforeEach(() => {
    localStorage.clear();
  });

  function renderInMode(mode: 'simple' | 'advanced'): string {
    localStorage.setItem(MODE_KEY, mode);
    return renderSuppliedFiles(FIXTURE, query).outerHTML;
  }

  it('the supplied-file render is byte-identical in Simple and Advanced', () => {
    // Presentation mode selects/formats the SAME web-safe fields; it cannot add,
    // drop, or re-authorize a file. Identical output IS that guarantee — a future
    // change that made file visibility mode-dependent would break this test.
    expect(renderInMode('simple')).toBe(renderInMode('advanced'));
  });

  it('every reviewed file renders in both modes; none is unlocked or hidden', () => {
    for (const mode of ['simple', 'advanced'] as const) {
      localStorage.setItem(MODE_KEY, mode);
      const node = renderSuppliedFiles(FIXTURE, query);
      expect(node.querySelectorAll('[data-test="supplied-file-row"]').length)
        .toBe(FIXTURE.files.length);
    }
  });

  it('no presentation mode can surface an eligibility field the wire does not carry', () => {
    // Publication eligibility is decided server-side by the web_safe state gate
    // BEFORE the DTO is built; the wire has no review_state / private locator for
    // a mode to unlock, so no rendered output can contain one.
    for (const mode of ['simple', 'advanced'] as const) {
      localStorage.setItem(MODE_KEY, mode);
      const html = renderSuppliedFiles(FIXTURE, query).outerHTML;
      for (const key of NEVER_ON_WIRE) {
        expect(html).not.toContain(key);
      }
      expect(html).not.toMatch(/\/Users\/|\/home\/|Obsidian Vault|\.sha256/);
    }
  });
});
