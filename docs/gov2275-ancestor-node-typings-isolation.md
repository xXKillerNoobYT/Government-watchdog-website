# GOV-2275 — Isolate TypeScript from ancestor Node typings (website #254)

A lockfile-clean website checkout must resolve TypeScript declarations only from
its own reviewed dependency graph. Typecheck and build must be identical whether
or not an unrelated ancestor directory happens to carry Node typings.

## The defect

Website CI candidate checkouts run in **nested worktrees**
(`.paperclip/worktrees/<branch>/`). Vite's published declarations
(`node_modules/vite/dist/node/index.d.ts`) carry a `/// <reference types="node" />`.
With TypeScript's default type-root search, that reference walks **up** the
directory tree looking for an `@types/node` package — so when a parent directory
held an unrelated `@types/node 22.19.18`, the reference bound to it and pulled its
`node:*` ambient modules into the program.

The repo carries **no** `@types/node` on purpose (browser-only discipline; see
`types/node-shims.d.ts`). Two build-time tests import `node:child_process` behind a
deliberate `@ts-expect-error`, because the narrow shim did not declare that module.
When the ancestor leaked in, `node:child_process` suddenly resolved, the two
suppressions became **unused**, and the required typecheck failed with **TS2578**
at `test/cleanup-report-safety.test.ts` and
`test/gov291-private-artifact-boundary.test.ts`. The exact same source passed in a
filesystem-isolated checkout — the failure was environment-dependent, so it could
falsely block or misclassify an exact release candidate.

## The fix (three coupled changes)

1. **`types/node/index.d.ts`** — a deliberately empty, global-free local `node`
   type library.
2. **`tsconfig.json`** — `"typeRoots": ["./types", "./node_modules", "./node_modules/@types"]`.
   `./types` is searched **first**, so the `/// <reference types="node" />` binds to
   the empty local stub and TypeScript never walks up to an ancestor `@types/node`.
   `./node_modules` keeps the `vite/client` and `vitest/globals` type-library
   entries in `types` resolving.
3. **`types/node-shims.d.ts`** — declares `node:child_process`
   (`spawnSync`, `execFileSync`) exactly as narrowly as the other node built-ins,
   so those imports resolve **locally and deterministically**. The two tests drop
   their now-unused `@ts-expect-error`.

No global Node typings are added: the stub declares nothing, and the shim still
exposes only the members the build-time tooling actually calls. An un-shimmed
`node:*` import (e.g. `node:crypto`) now fails **identically** with or without an
ancestor, which is the guarantee this change exists to provide.

## Validation

```bash
npm test && npx tsc --noEmit && npm run build   # 1,192 tests; typecheck; public build + guards
npm run build:all                               # public + private-beta lanes, all four guards
```

Red proof: `test/gov2275-ancestor-node-typings-isolation.test.ts` builds a nested
fixture with a planted ancestor `@types/node` and runs the repo's own `tsc`:

- **control** (default type roots) — the ancestor is reachable; proves the hazard
  is real, so the isolation assertion is never vacuous.
- **isolated** (the repo's pinned `typeRoots`, read live from `tsconfig.json`) — the
  ancestor is unreachable: `node:crypto` cannot be found while `node:child_process`
  still resolves from the shim.

The isolated leg reads `typeRoots` and the two shim/stub files straight from the
repo, so removing the pin turns the test **red** (verified: stripping `typeRoots`
fails the isolated + structural assertions while control stays green).

Manual reproduction of the original defect and its fix:

```bash
# from the worktree, with deps installed. The ancestor is one directory ABOVE the
# checkout, mirroring a nested worktree; @types/node ships its node:* modules as
# ambient declarations, so declare them directly in an ambient index.d.ts.
mkdir -p ../node_modules/@types/node
printf '{"name":"@types/node","version":"22.19.18","types":"index.d.ts"}' > ../node_modules/@types/node/package.json
printf "declare module 'node:child_process'{export function spawnSync(c:string,a?:string[],o?:unknown):{status:number|null;stdout:string;stderr:string};export function execFileSync(c:string,a?:string[],o?:unknown):string;}" > ../node_modules/@types/node/index.d.ts
npx tsc --noEmit        # exit 0 — the planted ancestor does not change the result
rm -rf ../node_modules  # clean up the planted ancestor
```

To see the **original** TS2578 failure, run the same three `printf`/`mkdir` lines
against the parent commit (`git stash` or check out `HEAD~1`), where the shim did
not declare `node:child_process` and the two tests still carried the
`@ts-expect-error` suppressions. On the fixed tree the ancestor is inert.

## Rollback

The change is three files plus one new stub and one new test; there is no data or
runtime migration.

```bash
git revert <this-commit>     # or, to hand-revert:
git checkout HEAD~1 -- tsconfig.json types/node-shims.d.ts \
  test/cleanup-report-safety.test.ts test/gov291-private-artifact-boundary.test.ts
git rm -r types/node test/gov2275-ancestor-node-typings-isolation.test.ts
```

Reverting restores the prior `@ts-expect-error` suppressions. The build then
passes only in filesystem-isolated checkouts and regains the environment-dependent
TS2578 in any nested worktree whose ancestor carries `@types/node` — i.e. it
reintroduces exactly this defect. Prefer fixing forward.
