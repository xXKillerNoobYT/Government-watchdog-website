// A deliberately empty local "node" type library. GOV-2275 / website #254.
//
// Vite's published declarations (node_modules/vite/dist/node/index.d.ts) carry a
// `/// <reference types="node" />`. With the default `typeRoots`, TypeScript
// satisfies that reference by walking UP the directory tree looking for an
// `@types/node` package — so in a nested worktree it would bind to an unrelated
// ancestor installation and pull that package's `node:*` ambient modules into
// scope. Typecheck then depended on what happened to sit in a parent directory
// (e.g. a stray `@types/node 22.19.18`), which silently flipped the two narrow
// subprocess `@ts-expect-error` seams from "used" to "unused" (TS2578).
//
// `tsconfig.json` pins `typeRoots` to `./types` (this stub) first, so the "node"
// reference resolves HERE — a global-free, member-free package — and TypeScript
// never consults any ancestor `@types/node`. The real Node built-ins the build
// tooling and its tests touch are declared, member by member, in
// ../node-shims.d.ts. That keeps the browser-only compiler boundary intact:
// nothing here puts `process`, `Buffer`, `fs`, or `child_process` in global scope.
//
// Do not add declarations to this file. Add them to ../node-shims.d.ts, as a
// small deliberate decision, exactly as that file's header describes.
export {};
