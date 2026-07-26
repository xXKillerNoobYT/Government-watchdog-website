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
const apiProxy = {
  '/api': {
    target: `http://127.0.0.1:${SERVICE_PORT}`,
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
    plugins: publicLane ? [publicModuleBoundary()] : [],
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
    },
  };
});
