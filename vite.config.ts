/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

// Neutral build/dev config. No visual-style or framework commitments here —
// Isaac's design direction refines visuals in a later slice (GOV-99 scope note).
export default defineConfig({
  // Reviewer-internal/local only: bind to localhost, never expose publicly.
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
