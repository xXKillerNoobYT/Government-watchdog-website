import { describe, expect, it } from 'vitest';
import { APP_BOOT_SUITES } from '../vite.config';

/**
 * #110 guard. `APP_BOOT_SUITES` in `vite.config.ts` is the list of suites that run
 * one-at-a-time instead of in parallel, because each of their cases re-boots the whole
 * app in jsdom and so costs seconds rather than milliseconds.
 *
 * A hand-maintained list inside a determinism fix is exactly the thing that rots: the
 * next route-integration suite someone adds would silently rejoin the parallel pool and
 * bring the 20s timeout flake back, and the only symptom would be an intermittent red
 * build on an unrelated PR. So the list is derived-checked here rather than trusted.
 *
 * The marker is a dynamic `import()` of the app entry — that is what makes a case pay
 * the full ~70-module graph execution under the suites' `vi.resetModules()` beforeEach.
 *
 * Source text arrives via `import.meta.glob` + `?raw` rather than `node:fs`: the repo
 * omits `@types/node` on purpose, and this is the same idiom `gov658-fonts` and
 * `gov70-single-source-strings` already use to read files as text.
 */
const SUITE_SOURCES = import.meta.glob('./*.test.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** `./design-routes.test.ts` -> `test/design-routes.test.ts`, matching APP_BOOT_SUITES. */
const toRepoPath = (globKey: string) => globKey.replace(/^\.\//, 'test/');

/**
 * This file is excluded from its own sweep. The pattern below appears here only as a
 * regex literal (`import\(` — a backslash, not a parenthesis, follows `import`), so it
 * does not match today; excluding it explicitly means a future edit to the comment or
 * the pattern cannot accidentally enrol the guard in the list it is guarding.
 */
const SELF = 'test/app-boot-suite-registry.test.ts';

const APP_ENTRY_IMPORT = /import\(\s*['"]\.\.\/src\/main(\.ts)?['"]\s*\)/;

const bootingSuites = () =>
  Object.entries(SUITE_SOURCES)
    .map(([key, source]) => [toRepoPath(key), source] as const)
    .filter(([path, source]) => path !== SELF && APP_ENTRY_IMPORT.test(source))
    .map(([path]) => path)
    .sort();

describe('#110 app-boot suite registry', () => {
  it('lists every suite that boots the app, so none silently rejoins the parallel pool', () => {
    const booting = bootingSuites();

    // Guard the guard: if the glob or the marker ever stops matching, the comparison
    // below would pass vacuously against two empty lists and the registry would stop
    // being checked at all.
    expect(Object.keys(SUITE_SOURCES).length).toBeGreaterThan(1);
    expect(booting.length).toBeGreaterThan(0);

    expect(booting).toEqual([...APP_BOOT_SUITES].sort());
  });

  it('names only suites that exist, so a renamed file cannot leave a dead entry behind', () => {
    // A stale entry is not harmless. Vitest's `exclude` would still drop the old path
    // from the parallel group while the app-boot group's `include` matches nothing, so
    // the renamed suite would vanish from the run rather than fail.
    const present = new Set(Object.keys(SUITE_SOURCES).map(toRepoPath));
    for (const listed of APP_BOOT_SUITES) {
      expect(present.has(listed), listed).toBe(true);
    }
  });
});
