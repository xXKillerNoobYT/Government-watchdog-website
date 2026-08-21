/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
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
      include: ['test/**/*.test.ts'],
      // Vitest's 5s default is tuned for unit tests. Several suites here are
      // full route integrations: each case does `await import('../src/main')`,
      // which transforms and boots the entire 70-module app inside jsdom, then
      // waits for a render. That is genuinely seconds of work — the slowest
      // observed case is ~3.6s on an idle machine, leaving under 1.4s of margin.
      //
      // The self-hosted CI runner erases that margin. Every PR push currently
      // triggers `push` and `pull_request` together, so two full suites run
      // concurrently on one physical machine; identical local runs already vary
      // 2.3x in total test time (8.8s / 11.1s / 20.3s). The result is #59: the
      // same commit goes green on one twin and red on the other, and the failing
      // case differs between runs.
      //
      // 20s keeps a true hang failing — well inside the job budget — while
      // giving a correct-but-slow integration case room to finish under load.
      // This is headroom for real work, not suppression: the assertions pass
      // whenever they are allowed to run to completion.
      testTimeout: 20_000,
    },
  };
});
