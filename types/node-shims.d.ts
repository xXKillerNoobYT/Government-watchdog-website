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
