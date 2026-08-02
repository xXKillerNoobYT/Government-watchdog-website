# GOV-49 — Code-split the private-beta bundle

**Pipeline stage: 1 (plan) + 2 (acceptance criteria). Not implemented.**
Written 2026-08-02 by the AUTO GO loop. Every number below was measured on that date
against `origin/main`, not estimated — re-measure before acting, because a plan whose
premise has decayed is worse than no plan (the lesson from GOV-70).

---

## What this does

Splits the single private-beta JavaScript chunk so a reviewer opening a page loads only
what that page needs, instead of the whole application plus every gated fixture.

## Why

Filed under `area:build-guards` as *"before multi-location expansion"*. Today the app
serves one town. Each additional location adds fixture and projection data to the same
single chunk, so the cost is paid by every visitor on every route, and it grows linearly
with coverage. The issue's framing is right: this is cheaper to fix before expansion than
after.

## Current state — measured 2026-08-02

`npm run build:private-beta`, emitted into `dist/`:

| Artifact | Raw | Gzipped |
| --- | --- | --- |
| `dist/client/assets/index-*.js` | **878.0 KB** | **191.0 KB** |
| `dist/client/assets/index-*.css` | 2.3 KB | — |
| `dist/server/index.js` | 3.9 KB | — |

**There is exactly one client chunk.** No `manualChunks`, no dynamic `import()` in the
route table — `src/main.ts` imports every page renderer eagerly at module scope.

Source contributors, largest first:

| Source | Size |
| --- | --- |
| `src/fixtures/` (11 JSON files) | **352.4 KB** |
| ↳ `alpine-sample.json` alone | 198.4 KB |
| ↳ `alpine-card-feed.json` | 91.9 KB |
| `src/ui/design-pages.ts` | 125.4 KB |
| `src/ui/pages-program.ts` | 104.4 KB |
| `src/ui/fast-agenda-design.ts` | 88.5 KB |
| `src/ui/private-info-note-definitions.ts` | 85.0 KB |

Fixture markers are present in the emitted chunk (`concept-graph-real`, `alpine-newsletter`
and seven `SYNTHETIC DESIGN FIXTURE` occurrences), confirming the fixture JSON ships rather
than being tree-shaken away.

**So the dominant cost is not route code — it is gated-synthetic data that only ever
renders behind reviewer admission plus an explicit `demo=` flag.** A reviewer who never
opens a fixture lane downloads all of it anyway, and so does every ordinary admitted user.

## The constraint that governs this work

This repo's lane separation is enforced by four independent guards. Code-splitting changes
the *shape* of the emitted artifact they inspect, so the first question is whether they
still cover it. **Measured, not assumed:**

| Guard | Survives splitting? | Why |
| --- | --- | --- |
| `check-no-direct-exposure.mjs --emitted <dir>` | **Yes** | recursive `readdirSync` walk over the whole directory, not the entry file |
| `check-public-bundle.mjs` | **Yes** | same recursive walk, and reads every file as `latin1` rather than by extension allow-list |
| `publicModuleBoundary()` in `vite.config.ts` | **Yes** | Rollup `moduleParsed` — fires per module as it is discovered, independent of how modules are grouped into chunks |
| source-tree exposure scan | **Yes** | unaffected; reads source |

This is the single most important finding in this plan. Had any guard inspected only the
entry chunk, splitting would have opened a lane-leak hole while every check stayed green —
the exact failure class this repo's guards exist to prevent. **Re-verify this table if the
guards change before the work is done.**

## Proposed change

Three steps, in dependency order. Steps 1 and 2 are independent of each other.

**1 — Defer the fixture JSON behind dynamic `import()`.** The largest win by a wide margin
and the lowest risk, because fixtures are already reachable only through
`designPreviewActive` / `demo=` branches. Converting those branches to `await import(...)`
moves ~352 KB of source JSON out of the initial chunk. The gate stays where it is; only the
*fetch* becomes lazy.

*Watch item:* the GS lanes currently render **synchronously** on purpose
(`docs/design-information-type-matrix.md`, "Shipping a GS lane"). A dynamic import makes
them asynchronous. That is acceptable — awaiting a local chunk is not awaiting a backend —
but the route handlers and their tests both assume synchronous render today, so this is the
step that actually costs effort.

**2 — Split the design-fixture renderers into their own chunk.** `design-pages.ts`,
`fast-agenda-design.ts`, `newsletter-design.ts` and the other `*-design` modules are only
reachable under design preview. Same argument as step 1, applied to code rather than data.

**3 — Only then consider per-route splitting.** Deliberately last. The remaining route
modules are shared across pages, so splitting them yields far less than steps 1–2 and
risks a waterfall of chunk requests. Do not start here just because "code-split" sounds
like "split by route".

## Acceptance criteria (stage 2)

- [ ] Initial client chunk is measurably smaller; record raw and gzipped before/after in
      the PR. **State the number, do not claim "smaller".**
- [ ] `npm run build:all` passes, i.e. all four guards green against the **multi-chunk**
      artifact, not just the entry.
- [ ] A test asserts the emitted artifact has more than one client chunk, so a config
      change cannot silently re-merge them and regress this work invisibly.
- [ ] No fixture string is reachable from the **public** lane — unchanged requirement, but
      re-proved against the new chunk layout rather than inherited from the old one.
- [ ] Every design/fixture route still renders behind reviewer admission plus its explicit
      flag, and still declares fixture origin in the shell.
- [ ] Red proof: force the split off (or point a route at the wrong chunk) and watch the
      new chunk-count assertion fail.

## Test plan

Existing coverage carries most of this — `design-routes.test.ts` sweeps every route in both
lanes and `test/` already asserts lane separation. New work needed:

1. A build-artifact test asserting chunk count > 1 and that no chunk carries a private
   marker. It must **derive** the chunk list from the emitted directory, never enumerate
   filenames, since Vite hashes them.
2. Async-render coverage for any route converted in step 1 — the existing tests call
   renderers synchronously and will need `await`.

## Not in scope

- The public lane. It is already tiny and is governed by `PUBLIC_LOCAL_MODULES`.
- `BACKEND_REF` or artifact fetching (#95, #119). Different concern, and both are under a
  hard stop while #123 is incomplete.

## Sequencing note

This plan does **not** claim the work should start now. At the time of writing the loop's
pace verdict is EASE OFF and this is the largest remaining item; it is written so that
whoever picks it up — a later iteration or the owner — starts from measurements rather than
from the guesswork this document replaces.
