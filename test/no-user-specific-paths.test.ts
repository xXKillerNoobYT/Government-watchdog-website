import { describe, expect, it } from 'vitest';

/**
 * #218 guard — this repository is **PUBLIC**, so tracked source, workflow definitions
 * and documentation must not disclose a contributor's absolute filesystem layout.
 *
 * A home path is not a secret in the credential sense, but it discloses identity and
 * host topology, and a public Actions workflow that hard-codes one will echo it into
 * public logs and step summaries on every run. #218 found 23 such occurrences across 13
 * files; without a guard the count simply grows again, because writing the path you are
 * standing in is the natural thing to do.
 *
 * The rule is an ALLOWLIST of neutral sentinels rather than a denylist of real accounts:
 * a denylist would have to name the account it is protecting, in a public file, which is
 * self-defeating. Anything outside the allowlist fails.
 */
const SOURCES = import.meta.glob(
  [
    '../scripts/**/*',
    '../.github/**/*',
    '../docs/**/*.md',
    '../test/**/*.ts',
    '../src/**/*.ts',
    '../*.md',
    '../*.ts',
    '../*.json',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/**
 * Fictional account names used deliberately as fixtures — `web-safe` proves a raw
 * filesystem path is REJECTED, which needs a raw filesystem path to reject. Add to this
 * list only names that cannot belong to a real contributor.
 */
const SENTINEL_ACCOUNTS = new Set(['reviewer', 'isaac', 'vault', 'secret', 'user', 'someone']);

/** Matches a macOS home path and captures the account segment. */
const HOME_PATH = /\/Users\/([A-Za-z0-9_.-]+)\//g;

/** This file is excluded from its own sweep — it necessarily contains the pattern. */
const SELF = 'test/no-user-specific-paths.test.ts';

/** `../scripts/local_e2e.sh` -> `scripts/local_e2e.sh` */
const toRepoPath = (key: string) => key.replace(/^\.\.\//, '');

function offenders(): string[] {
  const found: string[] = [];
  for (const [key, source] of Object.entries(SOURCES)) {
    const path = toRepoPath(key);
    if (path === SELF) continue;
    for (const [, account] of source.matchAll(HOME_PATH)) {
      // The account name is NOT included in the failure message. Naming it here would
      // reproduce the disclosure in CI output — the exact thing being prevented.
      if (!SENTINEL_ACCOUNTS.has(account)) found.push(path);
    }
  }
  return [...new Set(found)].sort();
}

describe('#218 no user-specific absolute paths in a public repository', () => {
  it('scans a non-trivial corpus, so a green result means something', () => {
    // Guard the guard: a mistyped glob would make every assertion below pass vacuously.
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50);
    const paths = Object.keys(SOURCES).map(toRepoPath);
    expect(paths).toContain('scripts/local_e2e.sh');
    expect(paths.some((p) => p.startsWith('.github/'))).toBe(true);
  });

  it('still sees the sentinel fixtures, so the allowlist is doing real work', () => {
    // If the fixtures ever disappear, the allowlist silently stops being exercised and
    // the next real path could be waved through by a broken matcher.
    const corpus = Object.values(SOURCES).join('\n');
    expect(corpus).toMatch(/\/Users\/reviewer\//);
  });

  it('finds no contributor home path outside the sentinel allowlist', () => {
    expect(offenders()).toEqual([]);
  });
});
