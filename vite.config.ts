/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

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

export default defineConfig({
  // Reviewer-internal/local only: bind to localhost, never expose publicly.
  server: { host: '127.0.0.1', port: 5173, proxy: apiProxy },
  preview: { host: '127.0.0.1', port: 4173, proxy: apiProxy },
  build: { outDir: 'dist/client' },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
