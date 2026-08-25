import { afterEach, describe, expect, it } from 'vitest';
// The subprocess seam is declared in types/node-shims.d.ts (GOV-2275); this proof
// runs the repo's own tsc through it, so the fix guards itself.
import { execFileSync } from 'node:child_process';
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

declare const process: {
  cwd(): string;
  execPath: string;
  env: Record<string, string | undefined>;
};

const ROOT = process.cwd();
const TSC = join(ROOT, 'node_modules/typescript/bin/tsc');

// The three shipped artifacts this proof protects. They are copied verbatim into
// the fixture so the fixture can never quietly drift from what the repo ships.
const REAL_STUB = readFileSync(join(ROOT, 'types/node/index.d.ts'), 'utf8');
const REAL_SHIM = readFileSync(join(ROOT, 'types/node-shims.d.ts'), 'utf8');
const REAL_TSCONFIG = JSON.parse(readFileSync(join(ROOT, 'tsconfig.json'), 'utf8')) as {
  compilerOptions: { moduleResolution?: string; typeRoots?: string[] };
};

// An unrelated ancestor @types/node, laid out the way the real package is: an
// ambient (non-module) declaration file, so its `node:*` modules are genuinely
// in scope for anything that pulls the "node" type library in.
const ANCESTOR_TYPINGS = [
  "declare module 'node:child_process' {",
  '  export function spawnSync(c: string, a?: string[], o?: unknown):',
  '    { status: number | null; stdout: string; stderr: string };',
  '  export function execFileSync(c: string, a?: string[], o?: unknown): string;',
  '}',
  "declare module 'node:crypto' { export function randomUUID(): string; }",
  'declare const __ANCESTOR_NODE_GLOBAL__: number;',
  '',
].join('\n');

// A stand-in for vite's published declarations, which carry exactly this line and
// are what drag the "node" type library into the program in the real build.
const VITE_LIKE_REFERENCE = '/// <reference types="node" />\n';

// child_process must resolve from the local shim; crypto is deliberately NOT
// shimmed, so it resolves ONLY if an ancestor leaks in. That makes crypto the
// litmus test for isolation.
const PROBE = [
  "import { spawnSync } from 'node:child_process';",
  "import { randomUUID } from 'node:crypto';",
  'export const a = spawnSync;',
  'export const b = randomUUID;',
  '',
].join('\n');

const CRYPTO_UNREACHABLE = "Cannot find module 'node:crypto'";
const CHILD_PROCESS_UNREACHABLE = "Cannot find module 'node:child_process'";

let workspace: string | undefined;

function makeWorkspace(typeRoots: string[] | undefined): string {
  const rootDir = mkdtempSync(join(tmpdir(), 'gov2275-'));
  workspace = rootDir;
  // Ancestor sits one level ABOVE the project, exactly like a nested worktree.
  const ancestorDir = join(rootDir, 'node_modules/@types/node');
  mkdirSync(ancestorDir, { recursive: true });
  writeFileSync(join(ancestorDir, 'index.d.ts'), ANCESTOR_TYPINGS);

  const project = join(rootDir, 'project');
  mkdirSync(join(project, 'types/node'), { recursive: true });
  writeFileSync(join(project, 'types/node/index.d.ts'), REAL_STUB);
  writeFileSync(join(project, 'types/node-shims.d.ts'), REAL_SHIM);
  writeFileSync(join(project, 'vite-ref.d.ts'), VITE_LIKE_REFERENCE);
  writeFileSync(join(project, 'probe.ts'), PROBE);

  const compilerOptions: Record<string, unknown> = {
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: REAL_TSCONFIG.compilerOptions.moduleResolution ?? 'bundler',
    lib: ['ES2022', 'DOM'],
    types: [],
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  };
  if (typeRoots) compilerOptions.typeRoots = typeRoots;
  writeFileSync(
    join(project, 'tsconfig.json'),
    JSON.stringify({ compilerOptions, include: ['probe.ts', 'vite-ref.d.ts', 'types'] }, null, 2),
  );
  return project;
}

function typecheck(project: string): string {
  try {
    execFileSync(process.execPath, [TSC, '--project', join(project, 'tsconfig.json')], {
      cwd: project,
      encoding: 'utf8',
    });
    return '';
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    return `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
}

afterEach(() => {
  if (workspace) {
    rmSync(workspace, { recursive: true, force: true });
    workspace = undefined;
  }
});

describe('GOV-2275: ancestor Node typings cannot change website typecheck', () => {
  // Integrity guard: prove the hazard is real. With the default type-root search
  // (what a lockfile-clean checkout gets before this fix), the unrelated ancestor
  // IS reachable and its node:crypto resolves. If this ever stops being true the
  // isolation assertion below would be vacuous, so we assert the leak here first.
  it('control: without pinned typeRoots the ancestor leaks in', () => {
    const project = makeWorkspace(undefined);
    const out = typecheck(project);
    expect(out).not.toContain(CRYPTO_UNREACHABLE);
    expect(out).not.toContain(CHILD_PROCESS_UNREACHABLE);
  });

  // The proof: with the repo's own pinned typeRoots, the ancestor is unreachable.
  // child_process still resolves — from the local shim — while the un-shimmed
  // crypto does not, demonstrating no ancestor typings entered the program.
  it('isolated: the repo typeRoots make the ancestor unreachable', () => {
    const project = makeWorkspace(REAL_TSCONFIG.compilerOptions.typeRoots);
    const out = typecheck(project);
    expect(out).toContain(CRYPTO_UNREACHABLE);
    expect(out).not.toContain(CHILD_PROCESS_UNREACHABLE);
  });

  // Structural guards on the shipped artifacts, cheap and independent of tsc.
  it('tsconfig pins typeRoots with the local ./types root first', () => {
    const roots = REAL_TSCONFIG.compilerOptions.typeRoots;
    expect(Array.isArray(roots)).toBe(true);
    expect(roots?.[0]).toBe('./types');
  });

  it('the local node stub exists and declares nothing (no global surface)', () => {
    expect(existsSync(join(ROOT, 'types/node/index.d.ts'))).toBe(true);
    expect(REAL_STUB).not.toMatch(/\bdeclare\b/);
  });

  it('the narrow shim declares both synchronous subprocess seams', () => {
    expect(REAL_SHIM).toContain("declare module 'node:child_process'");
    expect(REAL_SHIM).toContain('spawnSync');
    expect(REAL_SHIM).toContain('execFileSync');
  });

  it('the affected tests no longer suppress the child_process import', () => {
    for (const file of [
      'test/cleanup-report-safety.test.ts',
      'test/gov291-private-artifact-boundary.test.ts',
    ]) {
      const source = readFileSync(join(ROOT, file), 'utf8');
      const importLine = source.indexOf("from 'node:child_process'");
      expect(importLine).toBeGreaterThan(-1);
      const before = source.slice(0, importLine);
      const lastExpectError = before.lastIndexOf('@ts-expect-error');
      const lastImportKeyword = before.lastIndexOf('import ');
      // No @ts-expect-error may sit between the import keyword and this specifier.
      expect(lastExpectError).toBeLessThan(lastImportKeyword);
    }
  });
});
