/**
 * Minimal ambient shapes for the handful of Node built-ins the build config and
 * build-config tests touch.
 *
 * WHY NOT `@types/node`: the repo omits it on purpose — see the note in
 * vite.config.ts. Several suites read source files *as text* and assert on their
 * contents; pulling in the full Node typings would put `fs`, `child_process`,
 * `process` and friends in scope for every `src/` module and quietly weaken the
 * browser-only discipline those tests exist to protect.
 *
 * So: declare exactly the members used, and nothing else. Adding a member here
 * should feel like a small deliberate decision, which is the point.
 *
 * WHY `node:child_process` IS declared (GOV-2275 / WEB#254): the two subprocess
 * tests used `@ts-expect-error` on their `node:child_process` imports because the
 * repo carries no Node typings. But `vite/client` transitively references
 * `@types/node`, so in a nested automation worktree TypeScript would resolve an
 * *ancestor* `@types/node`, type `node:child_process`, make those suppressions
 * unused, and fail the required typecheck with TS2578 — while an isolated
 * checkout passed. `typeRoots` can't fix this without breaking `vite/client`.
 * Declaring the exact two subprocess members here makes resolution deterministic:
 * typecheck now behaves identically with or without ancestor Node typings, and no
 * environment-dependent suppression is needed.
 */

declare module 'node:fs' {
  export function existsSync(path: string | URL): boolean;
  export function mkdtempSync(prefix: string): string;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
  export function readFileSync(path: string | URL, encoding: 'utf8'): string;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  export function writeFileSync(path: string, data: string): void;
}

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'node:path' {
  export function isAbsolute(path: string): boolean;
  export function join(...paths: string[]): string;
}

declare module 'node:fs/promises' {
  export function readFile(path: string | URL, encoding: 'utf8'): Promise<string>;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

declare module 'node:child_process' {
  interface NarrowSubprocessOptions {
    cwd?: string;
    encoding?: 'utf8';
    env?: Record<string, string | undefined>;
    stdio?: 'pipe' | 'inherit' | 'ignore';
  }
  export function spawnSync(command: string, args?: string[], options?: NarrowSubprocessOptions): {
    status: number | null;
    stdout: string;
    stderr: string;
  };
  export function execFileSync(command: string, args?: string[], options?: NarrowSubprocessOptions): string;
}
