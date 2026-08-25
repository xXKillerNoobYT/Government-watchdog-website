import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// GOV-2275 / WEB#254 — required-check reliability.
//
// A nested isolated automation worktree let TypeScript resolve an unrelated
// ANCESTOR `@types/node` (pulled transitively by `vite/client`) and type the
// bare `node:child_process` imports in the two subprocess tests. That made their
// `@ts-expect-error` guards unused and failed the required typecheck with TS2578,
// even though the same source passed in a filesystem-isolated checkout.
//
// The fix declares the two subprocess members in the narrow Node shim so
// `node:child_process` resolution is deterministic regardless of ancestor typings,
// and removes the now-unnecessary environment-dependent suppressions. This suite
// is the red proof: it fails if the deterministic declaration is dropped or if an
// environment-dependent suppression is reintroduced on either subprocess import.

const SHIM = readFileSync('types/node-shims.d.ts', 'utf8');
const SUBPROCESS_TESTS = [
  'test/cleanup-report-safety.test.ts',
  'test/gov291-private-artifact-boundary.test.ts',
];

describe('GOV-2275 typecheck isolation from ancestor Node typings', () => {
  it('declares node:child_process deterministically in the narrow shim', () => {
    expect(SHIM).toMatch(/declare module ['"]node:child_process['"]/);
    expect(SHIM).toMatch(/export function spawnSync\(/);
    expect(SHIM).toMatch(/export function execFileSync\(/);
  });

  it('keeps the shim narrow — no full @types/node reference', () => {
    // Deterministic resolution must come from the narrow shim, never from pulling
    // the full Node typings back in (which is what the browser-only discipline forbids).
    expect(SHIM).not.toMatch(/reference types=['"]node['"]/);
    expect(SHIM).not.toMatch(/from ['"]@types\/node['"]/);
  });

  it('carries no environment-dependent suppression on the child_process imports', () => {
    // An `@ts-expect-error` immediately before the child_process import is exactly
    // the environment-dependent suppression that TS2578 turned red. It must stay gone.
    for (const path of SUBPROCESS_TESTS) {
      const source = readFileSync(path, 'utf8');
      expect(source).toMatch(/import\s*\{[^}]*\}\s*from\s*['"]node:child_process['"]/);
      expect(source).not.toMatch(/@ts-expect-error[^\n]*\n(?:\/\/[^\n]*\n)*import\s*\{[^}]*\}\s*from\s*['"]node:child_process['"]/);
    }
  });
});
