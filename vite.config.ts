/// <reference types="vitest/config" />
import { defaultExclude, defineConfig } from 'vitest/config';
import type { TestProjectConfiguration } from 'vitest/config';
import type { Plugin } from 'vite';

// Minimal ambient `process` — this config runs in Node, but the repo omits
// @types/node on purpose (tests read source-as-text without node types). We only
// touch env here, so a one-field declaration keeps `tsc --noEmit` clean.
declare const process: { env: Record<string, string | undefined> };

// Neutral build/dev config. No visual-style or framework commitments here —
// Isaac's design direction refines visuals in a later slice (GOV-99 scope note).
//
// GOV-1527 §5 — same-origin /api proxy. The browser talks ONLY to this origin;
// `/api/*` is forwarded to the loopback auth/notification service (the artifact's
// service/run.py). The service is never a second public hostname and never an
// exposed port — it binds 127.0.0.1 only, and the proxy is the sole bridge.
// Port is env-overridable so local_e2e.sh can pick a free one.
const SERVICE_PORT = Number(process.env.GW_SERVICE_PORT ?? 8791);
// GOV-2180 — same-origin `/v1` bridge to the loopback view-API service
// (`scripts/view_api.py`, GOV-1816/GOV-1817), which binds 127.0.0.1 only on its
// own port. The browser still talks ONLY to this origin; the proxy is the sole
// bridge, exactly like `/api`. Dev/preview only — production must forward `/v1`
// to the view-API service in the hosting layer (tracked in the cutover issue).
const VIEW_API_PORT = Number(process.env.GW_VIEW_API_PORT ?? 8792);
const apiProxy = {
  '/api': {
    target: `http://127.0.0.1:${SERVICE_PORT}`,
    changeOrigin: false, // same-origin contract: do not rewrite Host
  },
  '/v1': {
    target: `http://127.0.0.1:${VIEW_API_PORT}`,
    changeOrigin: false, // same-origin contract: do not rewrite Host
  },
};

/**
 * Test files whose cases boot the entire application inside jsdom.
 *
 * Each of these calls `await import('../src/main')` from a case whose `beforeEach`
 * runs `vi.resetModules()`, so every case re-executes the whole ~70-module app graph
 * and re-renders. The slowest single case sweeps 44 route renders (22 registered
 * routes x 2 lanes) and costs ~14.4s on an idle machine — 72% of `testTimeout`
 * before any contention exists.
 *
 * Everything else in `test/` is milliseconds per case. That order-of-magnitude gap is
 * the whole of issue #110: a 3x contention penalty on a 12ms case is 36ms, but on a
 * 14.4s case it is a red build. So these files get `groupOrder: 1` below and run one
 * at a time with the machine to themselves, after the other suites have finished at
 * `groupOrder: 0` with full file parallelism.
 *
 * The invariant is about scheduling, not patience: bound concurrency only where
 * per-case cost is within one order of magnitude of the timeout. #98 already showed
 * that raising `testTimeout` against a load problem only buys headroom until the
 * headroom runs out, and this list is deliberately NOT a second place to do that.
 *
 * `test/app-boot-suite-registry.test.ts` fails the build if a file that boots the app
 * is missing here, so the list cannot silently rot as suites are added.
 */
export const APP_BOOT_SUITES = [
  'test/design-routes.test.ts',
  'test/gov2256-upload-route-heading.test.ts',
  'test/gov658-home-dashboard.test.ts',
  'test/gov668-wave3-pages.test.ts',
  'test/gov671-wave4-pages.test.ts',
  'test/reviewer-context-routes.test.ts',
  'test/sites-auth-entry.test.ts',
  'test/timeline-route-loading.test.ts',
] as const;

/**
 * #110 — two test groups run one after the other rather than all 79 files at once.
 *
 * `sequence.groupOrder` is what makes this a scheduling fix and not a throttle: group 0
 * finishes completely before group 1 starts, so the app-boot suites get the whole machine
 * instead of a share of it. No timeout is raised and no worker count is guessed, which is
 * the distinction from #98 — a threshold fix against a load problem only buys headroom
 * until the headroom runs out, and this is the third time that would have been tried.
 *
 * Group 1 is serialized by pool assignment, which is a detour worth explaining because
 * the two obvious spellings both fail:
 *
 * - `fileParallelism: false` on the project is a NO-OP. Vitest lists `fileParallelism`,
 *   `maxWorkers` and `minWorkers` in `NonProjectOptions`; a project may not set them, and
 *   before this array was annotated `TestProjectConfiguration[]` the compiler accepted it
 *   silently. Measured with it in place: the seven suites still ran concurrently — 190s of
 *   file time inside an 80s wall clock — and the flake reproduced inside the group. The
 *   annotation now makes that a type error, so nobody repeats it.
 * - `poolOptions.forks.singleFork` IS project-scoped and does serialize them, but it puts
 *   all seven in ONE reused process. Measured: `design-routes` went from 28.9s to 99.3s
 *   and two cases failed. Ninety app boots of accumulated jsdom in a single process is its
 *   own load problem — these suites need a fresh worker per file, not a shared one.
 *
 * So: `pool` IS project-scoped, and the root caps the `threads` pool at one worker. The
 * app-boot project is the only user of that pool, so the cap reaches it alone while the
 * parallel project keeps the default `forks` pool at full width. One worker at a time,
 * `isolate` still default-true, fresh environment per file.
 */
export const TEST_PROJECTS: TestProjectConfiguration[] = [
  {
    extends: true,
    test: {
      name: 'parallel',
      pool: 'forks',
      include: ['test/**/*.test.ts'],
      exclude: [...defaultExclude, ...APP_BOOT_SUITES],
      sequence: { groupOrder: 0 },
    },
  },
  {
    extends: true,
    test: {
      name: 'app-boot',
      include: [...APP_BOOT_SUITES],
      // Root `poolOptions` below caps this pool at one worker. `pool` IS project-
      // scoped; `maxWorkers`/`maxThreads` are not, which is why the cap lives at the
      // root and the two groups are told apart by which pool they use.
      pool: 'threads',
      sequence: { groupOrder: 1 },
    },
  },
];

export const PUBLIC_LOCAL_MODULES = new Set([
  '/public-entry/index.html',
  '/src/public-main.ts',
  '/src/ui/fonts.ts',
  '/src/ui/info-note.ts',
  '/src/ui/public-landing.ts',
  '/src/ui/tokens.ts',
]);

/** Return the repository-local portion of a Vite/Rollup module ID, if any. */
export function publicRepositoryModulePath(id: string, repositoryRoot: string): string | null {
  const normalized = id.replaceAll('\\', '/').split('?', 1)[0] ?? id;
  const normalizedRoot = repositoryRoot.replaceAll('\\', '/').replace(/\/+$/, '');
  if (!normalized.startsWith(`${normalizedRoot}/`)) return null;
  const localPath = normalized.slice(normalizedRoot.length);
  if (localPath.startsWith('/node_modules/')) return null;
  return localPath;
}

/**
 * Enforce the public graph from Rollup's parsed-module hook. This catches a
 * newly imported private helper even when minification removes every marker the
 * completed-asset denylist knows about.
 */
export function publicModuleBoundary(): Plugin {
  let repositoryRoot = '';
  return {
    name: 'government-watchdog-public-module-boundary',
    apply: 'build',
    configResolved(config) {
      const normalizedRoot = config.root.replaceAll('\\', '/').replace(/\/+$/, '');
      repositoryRoot = normalizedRoot.endsWith('/public-entry')
        ? normalizedRoot.slice(0, -'/public-entry'.length)
        : normalizedRoot;
    },
    moduleParsed(moduleInfo) {
      const localPath = publicRepositoryModulePath(moduleInfo.id, repositoryRoot);
      if (localPath && !PUBLIC_LOCAL_MODULES.has(localPath)) {
        this.error(
          `Public build discovered disallowed local module ${localPath}. `
          + 'Add public behavior through the reviewed public entry graph; do not import private application modules.',
        );
      }
    },
  };
}

/**
 * Default origin for absolute URLs in the emitted sitemap. Override with
 * GW_SITE_ORIGIN when the custom domain is attached — a sitemap must use the
 * host that serves it, so a stale value is worse than none.
 */
export const DEFAULT_SITE_ORIGIN = 'https://alpine-government-watchdog-beta.weirdtoocompany.chatgpt.site';

/** Substitute the build-time origin, refusing to ship an unresolved placeholder. */
export function renderCrawlAsset(source: string, origin: string): string {
  const trimmed = origin.replace(/\/+$/, '');
  if (!/^https?:\/\/[^/\s]+$/.test(trimmed)) {
    throw new Error(
      `GW_SITE_ORIGIN must be a bare absolute origin like https://example.com — got "${origin}"`,
    );
  }
  const rendered = source.replaceAll('__SITE_ORIGIN__', trimmed);
  if (rendered.includes('__SITE_ORIGIN__')) {
    throw new Error('crawl-control asset still contains __SITE_ORIGIN__ after substitution');
  }
  return rendered;
}

/**
 * Emit robots.txt and sitemap.xml into BOTH build lanes.
 *
 * Why a plugin rather than `public/`: the public lane sets `publicDir: false`
 * (see below), so an asset dropped in `public/` reaches the private-beta build
 * ONLY — and the public lane is precisely the one that faces crawlers. Placing
 * them in `public/` would fail silently in the only case that matters.
 *
 * These files are crawl hygiene, never a security boundary. The gate is.
 */
export function crawlControl(): Plugin {
  return {
    name: 'government-watchdog-crawl-control',
    apply: 'build',
    async generateBundle() {
      const origin = process.env.GW_SITE_ORIGIN ?? DEFAULT_SITE_ORIGIN;
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      const here = fileURLToPath(new URL('.', import.meta.url));
      for (const fileName of ['robots.txt', 'sitemap.xml']) {
        const source = await readFile(`${here}crawl-control/${fileName}`, 'utf8');
        this.emitFile({ type: 'asset', fileName, source: renderCrawlAsset(source, origin) });
      }
    },
  };
}

/**
 * The public and private-beta builds intentionally start from different module
 * graphs. Hiding private routes in the DOM is not an asset boundary: if both
 * lanes shared `src/main.ts`, Rollup would still package reviewer fixtures and
 * local bypass code into browser-downloadable JavaScript.
 *
 * `mode` is selected by the build command running on the server/CI. It is never
 * read from a browser URL, local storage, or a visual Simple/Advanced toggle.
 */
export default defineConfig(({ mode }) => {
  const publicLane = mode === 'public';

  return {
    // Crawl control ships in BOTH lanes: the public lane faces crawlers, and
    // the private lane is what Sites serves today. The module boundary is
    // public-only because only that lane must exclude private modules.
    plugins: publicLane ? [publicModuleBoundary(), crawlControl()] : [crawlControl()],
    // A real HTML root selects the module graph before Rollup discovers imports.
    // An HTML transform is too late for this security boundary: it can rewrite
    // the generated tag while leaving the already-discovered private graph.
    root: publicLane ? 'public-entry' : '.',
    publicDir: publicLane ? false : 'public',
    // Private development stays loopback-only. The public lane is a static
    // production artifact; choosing it does not expose the local API proxy.
    server: { host: '127.0.0.1', port: 5173, proxy: apiProxy },
    preview: { host: '127.0.0.1', port: 4173, proxy: apiProxy },
    build: {
      outDir: publicLane ? '../dist/public' : 'dist/client',
      emptyOutDir: true,
      sourcemap: false,
    },
    test: {
      globals: true,
      environment: 'node',
      // `include` is deliberately NOT set here. `extends: true` MERGES array options
      // into each project rather than replacing them, so a root-level glob would union
      // itself onto the app-boot project's explicit file list and hand that project all
      // 79 suites — silently undoing the split while still reporting two projects.
      // Each project therefore owns its own `include`.
      //
      // #110 — the timeout flake is contention, not slowness. See TEST_PROJECTS.
      // The cap is here rather than in the app-boot project because `maxThreads` is a
      // root-only option; the `threads` pool is used by that project alone.
      poolOptions: { threads: { maxThreads: 1, minThreads: 1 } },
      projects: TEST_PROJECTS,
      // Unchanged by #110, and deliberately so. Vitest's 5s default is tuned for unit
      // tests; the app-boot suites do genuinely seconds of work per case, so 20s is the
      // ceiling that still fails a true hang while letting a correct-but-slow
      // integration case finish. #59 and #98 raised this once already — the scheduling
      // change above exists precisely so it never has to be raised a second time.
      testTimeout: 20_000,
    },
  };
});
