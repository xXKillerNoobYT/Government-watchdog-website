# GOV-49 — Code-split the private-beta bundle

**Pipeline stage: 1 (plan) + 2 (acceptance criteria).**
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

### Sharpening measured 2026-08-02 (iteration 56) — start with ONE line, not eleven files

`alpine-sample.json` is 198.4 KB, the single largest item, and **it is never used in any real
build.** Traced end to end:

- Its only runtime consumer is `if (config.useFixtures) { … FIXTURE … }` in
  `src/data/client.ts`.
- `useFixtures` reads `VITE_USE_FIXTURES`, defaulting to `'false'`. **No `.env` file exists**
  (only `.env.example`, which sets `false`), no build script sets it, and CI does not set it.
  Only test files set it to `'true'`.
- The exported `FIXTURE` const is referenced as a value by **zero** source modules. Its five
  importers are all under `test/`.

**And yet it ships** — three distinctive fixture strings were found verbatim in the emitted
chunk. The reason is one line:

```ts
export const FIXTURE: ReadApiResponse = assertWebSafe(fixtureData as ReadApiResponse);
```

That is a **side-effecting call at module scope**, so Rollup cannot tree-shake the import even
though nothing reads the result. One line pins ~198 KB of source JSON into every build, and the
sweep also costs **~3.7 ms** (median of 5, range 2.3–5.4) on every page load for every user.

**Do not simply delete it.** The eager sweep is deliberate — the comment above it says a hand
edit painting an absolute path into the sample must fail loud immediately. That guard has to be
preserved, moved to a test rather than dropped.

This splits into two independently shippable pieces, which is why it belongs above the original
step 1:

- **1a — the startup cost.** Move the eager `assertWebSafe` off module scope.
- **1b — the 198 KB.** Convert to `await import(...)` inside the `useFixtures` branch.

#### ⚠️ 1a WAS ATTEMPTED AND REVERTED. Read this before trying it again.

Implemented and reverted in iteration 56. Moving the sweep into the `useFixtures` branch and
leaving `export const FIXTURE = fixtureData as ReadApiResponse` looks correct, typechecks, and
passes the **entire 1099-test suite**. Measured effect on the default build:

| | before | after |
| --- | --- | --- |
| raw | 878.0 KB | **736.3 KB** |
| gzipped | 191.0 KB | **180.4 KB** |
| fixture strings in bundle | 3/3 | **0/3** |

It appears to be a free 141 KB win. **It is not.** Building with fixtures actually enabled —
a real `.env` carrying `VITE_USE_FIXTURES=true` — also produced **0/3**: the fixture lane ships
with its data tree-shaken away, so the one build that needs the sample is the one that loses it.
Reverting restores 3/3.

Nothing in the test suite catches this, because no test builds with fixtures on; the suite runs
against source, where `FIXTURE` resolves fine. **Only building both ways and grepping the
emitted chunk exposes it.**

The mechanism was not fully isolated, and the plan deliberately does not guess: what is measured
is that removing the module-scope side effect makes the JSON eliminable in *both* builds, not
just the one where it is unused. The eager `assertWebSafe` was, incidentally, the thing keeping
the fixture lane working at all.

#### ✅ THE ISOLATED EXPERIMENT WAS RUN (iteration 59). Two of three unknowns are now closed.

The previous section asked one question first: *does a dynamic `import()` of any JSON here
produce a separate chunk?* Answered by building throwaway modules behind a condition Rollup
cannot statically decide (`window.location.hash === '__zz_probe_never__'`).

**Result 1 — splitting works, including for JSON.** Three chunks emitted; the throwaway JSON
landed in its own `zz-probe-data-*.js` with its marker inside it. So *"the build config
forbids splitting"* is **false** and can be struck from the hypothesis list. Nothing in
`vite.config.ts` needs changing.

**Result 2 — and this is the one that matters.** Re-pointing the same dynamic import at the
**real** `alpine-sample.json` produced **no chunk for it**: the fixture stayed in the entry,
which grew to 879.4 KB carrying 3/3 fixture strings, while the throwaway `.ts` module still
split fine.

The difference is not the file's size or contents. It is that `src/data/client.ts` **also
statically imports it**. A module reachable through a static import cannot be moved into a
lazy chunk — Rollup must keep it in the static graph, and the dynamic import simply
references it there. **A dynamic import added *alongside* a static one buys nothing.**

That retroactively explains 1a: moving only the sweep left the static import in place, so the
bytes could never leave the entry regardless.

**What remains unexplained — exactly one thing.** Iteration 58 *did* remove the static import
and *did* use a dynamic one, which by Results 1 and 2 is the structurally correct shape, and
it still emitted 0/3 in the fixtures-on build. Two candidate explanations remain, and the next
attempt should separate them before writing any code:

1. **The default build's 0/3 is correct and expected.** With `useFixtures` provably false,
   the branch is dead and the chunk is rightly never emitted. Only the *fixtures-on* reading
   was ever anomalous.
2. **The fixtures-on build may not have been reading `.env` in that invocation.** It was run
   as a bare `npx vite build`, not through `npm run build:private-beta`. On unmodified `main`
   the flag does change the output hash, so the flag works in general — but that was measured
   through the npm script, not the bare invocation.

**Check (2) first — it is one command** and would mean iteration 58's implementation was
correct all along and only its verification was faulty. Do not rewrite `client.ts` again
before settling it.

#### ⚠️ 1b WAS ALSO ATTEMPTED AND REVERTED (iteration 58). Two formulations, same failure.

Implemented properly this time — no static import at all:

```ts
async function loadSampleFixture(): Promise<ReadApiResponse> {
  const module = await import('../fixtures/alpine-sample.json');
  return assertWebSafe(module.default as unknown as ReadApiResponse);
}
```

with the five `FIXTURE` importers repointed to a `test/sample-fixture.ts` helper so production
code kept no module-scope reference. `tsc` clean, **all 1101 tests green**.

**Both builds emitted 0/3 fixture strings and ONE chunk.** The dynamic import produced no
separate chunk at all, so the JSON was eliminated rather than deferred — the same end state as
the 1a attempt, reached by a different route. `json: { stringify: true }` was tried as a probe
(the theory being that Vite's per-key named exports let Rollup shake the object); it changed
nothing: still 1 chunk, still 0/3.

**Mechanism NOT isolated. Do not treat this section as a diagnosis.** What is established:

- `vite.config.ts` sets no `inlineDynamicImports`, no `manualChunks`, no lib mode, so nothing
  obvious forbids splitting.
- The flag *is* wired: on unmodified `main`, default and `VITE_USE_FIXTURES=true` builds have
  **different** JS hashes. So the earlier finding stands — this is a real regression, not a
  measurement artifact. (That doubt was raised and checked rather than assumed.)
- Whatever drops the JSON acts on **both** builds and survives both a lazy-sweep formulation
  and a true dynamic import.

**What the next attempt should do differently.** Stop optimising and first answer one question
in isolation: *does a dynamic `import()` of any JSON in this project produce a separate chunk?*
Build a one-line throwaway case and look at `dist/client/assets/`. If it does not, the problem
is the build configuration, not `client.ts`, and no amount of rewriting the client will fix it.
Two iterations have now rewritten the consumer without establishing that the mechanism they
depend on works here at all.

#### The pattern is systemic, not one line (measured iteration 57)

Checked every fixture for the same shape. **350.6 of 352.4 KB — 99.5% — is pinned by a
module-scope `assertWebSafe` call**, in 11 of 12 files:

| fixture | KB | module scope |
| --- | --- | --- |
| `alpine-sample.json` | 198.4 | `const FIXTURE = assertWebSafe(...)` in `client.ts` |
| `alpine-card-feed.json` | 91.9 | `const CARD_FEED = assertWebSafe(...)` in `main.ts` |
| `alpine-newsletter-digest.json` | 17.7 | side effect |
| `concept-graph-demo.json` | 14.3 | side effect |
| `concept-graph-real.json` | 12.7 | side effect |
| `state-matrix.json` | 5.7 | side effect |
| `agenda-board-projection.sample.dev.json` | 4.7 | side effect |
| `alpine-supersede-events.json` | 2.0 | side effect |
| `agenda-board-projection.json` | 1.4 | side effect |
| `alpine-supplied-files.json` | 1.1 | side effect |
| `alpine-upload-intake.json` | 0.8 | bare `assertWebSafe(x);` statement |
| `notifications.sample.json` | 1.8 | **plain binding — the only one** |

Two forms appear and both count: `const X = assertWebSafe(data)` and a bare
`assertWebSafe(data);` statement. A first pass matched only the assignment form and
misclassified `alpine-upload-intake` as plain; a planted negative control caught it. Any
future audit of this must match both.

**What this means for the work.** The eager sweep is a deliberate, repo-wide honesty habit —
every fixture is proved web-safe before it can be rendered — and it is *also* the single
reason none of it tree-shakes. Those are the same line. So 1b is not "add one dynamic
import": it is a decision about **where the web-safe proof lives** for all 12 fixtures, with
the 1a experiment showing that moving it naively drops data the fixtures-on build needs.

That is an architecture question, not a refactor, and it is worth the owner's eye before
anyone starts.

**So 1a and 1b are not separable after all.** Whoever does this must do 1b — an explicit
`await import(...)` inside the branch, which creates a real reference the bundler cannot drop —
and must verify **both** builds by grepping the emitted artifact. Add that to the acceptance
criteria; the suite alone will not tell you.

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


---

## Step 1b — WORKS, is CORRECT, and is blocked on test-suite cost (iteration 60)

Iterations 56 and 58 both reverted this change after seeing the fixture disappear from the
`VITE_USE_FIXTURES=true` build, and both called that a regression. **A control build on
unmodified `main` disproved it.** `FIXTURE_NOTICE` is absent from main's bundle too, in *both*
builds — the `if (config.useFixtures)` branch is eliminated from every production bundle
already (filed as **#194**). The fixture lane is dev-only and always has been.

So the 3/3 fixture strings on `main` were never evidence the lane worked. They were the static
import being un-shakeable. **Bytes present ≠ feature reachable**, and conflating the two cost
two iterations.

**What was built and measured.** `src/data/client.ts` holding no static reference to
`alpine-sample.json`, the sample reached through `await import(...)`, tests reading it from a
`test/sample-fixture.ts` helper. Result: **878.0 → 736.3 KB raw, 191.0 → 180.4 KB gzipped**,
1101 tests green locally, `build:all` clean.

**CORRECTION 2026-08-02 (iteration 61) — the "2.4x cost" below was over-read from a single
comparison, and is NOT established.** Re-measured with three alternating runs per side on one
machine: `main` gave 8.56 / 6.60 / 6.58 / 6.82 / 7.07 / 9.45 s; 1b gave 6.50 / 6.41 / 6.52 /
11.97 / 19.39 / 25.21 s. 1b measured both **faster and slower** than main, and the second 1b
block escalates monotonically — that is machine load drifting during the run, not a property
of the change. `vite.config.ts` already documents this runner as varying **2.3x in identical
runs**, which is precisely what was reproduced.

So the CI timeout in iteration 60 cannot be attributed to this change on the evidence
available. The honest position is that the cost is **unmeasured**, not proven. The table below
is kept as the original single-shot reading, marked as such.

*(original, single-shot, unreliable:)*

| | `design-routes.test.ts` file | the COMING SOON sweep |
| --- | --- | --- |
| `main` | 9.15 s | 1472 ms |
| with 1b | 21.88 s | 3634 ms |

On the shared runner that crossed the sweep's 20 s ceiling — 30 s, CI red. The cause is that
the dynamic import makes the 198 KB JSON a separate module vitest transforms on demand, and
`design-routes.test.ts` re-imports `src/main` repeatedly under `vi.resetModules()`.

**This is a solvable problem, not a dead end**, and it is squarely a test-infrastructure
question rather than a product one. Options for whoever picks it up, cheapest first:
inline the JSON for the test environment (`test.server.deps`), give that one sweep a longer
budget the way its neighbour already has, or make the sweep stop re-importing `src/main` per
route. **Do not re-attempt 1b without addressing the transform cost first** — the source
change itself is already proven correct by the red proof below.

**Red proof.** Re-adding the old shape — static import plus module-scope `assertWebSafe` —
restores exactly 878.0 KB and 3/3 fixture strings; removing it returns 736.3 KB and 0/3. The
static import is the pin, confirmed by mutation rather than argument.

**Remaining upside:** ~152 KB of fixture JSON still statically imported by `main.ts`
(`alpine-card-feed.json` 91.9 KB and eight smaller files), each pinned by the same
module-scope-sweep pattern. Steps 2 and 3 are untouched.


---

## Step 2 — the remaining upside is 18.9 KB, not ~152 KB (measured iteration 62)

Earlier notes said roughly 152 KB of fixture JSON remained "statically imported by `main.ts`,
same pattern". **That overstated the opportunity by about 8x**, because it counted bytes rather
than checking reachability. Classified every use site:

| fixture | KB | const | reachable without a demo/design flag? |
| --- | --- | --- | --- |
| `alpine-card-feed.json` | 91.9 | `CARD_FEED` | **always used** — `renderHomeRoute` |
| `alpine-newsletter-digest.json` | 17.7 | `NEWSLETTER_DIGEST` | **always used** |
| `concept-graph-real.json` | 12.7 | `GRAPH_REAL` | **always used** (10 sites) |
| `state-matrix.json` | 5.7 | `STATE_MATRIX` | **always used** |
| `alpine-supersede-events.json` | 2.0 | `SUPERSEDE_EVENTS` | **always used** |
| `agenda-board-projection.json` | 1.4 | `BOARD_PROJECTION` | **always used** |
| `alpine-supplied-files.json` | 1.1 | `SUPPLIED_FILES` | **always used** |
| `alpine-upload-intake.json` | 0.8 | — | **always used** |
| `concept-graph-demo.json` | 14.3 | `GRAPH_DEMO` | GATED — lazy-loadable |
| `agenda-board-projection.sample.dev.json` | 4.7 | `BOARD_SAMPLE` | GATED — lazy-loadable |

**Lazy-loadable: 18.9 KB. Always reachable: 133.3 KB.**

`CARD_FEED` is the clearest case: `renderHomeRoute` passes `cardFeed: CARD_FEED` on every
`/home` render and reads `CARD_FEED.access` to decide the access state. The code comment says
so plainly — *"Real widgets consume existing reviewed Alpine projections (card feed / digest /
board)"*. This is **not** gated-synthetic dead weight; it is the data the reviewed Home page
renders.

### What that means

**Step 2 as originally framed is mostly not available.** Those 133.3 KB cannot move to a lazy
chunk without converting synchronous route handlers to async — a much larger change than 1b,
touching the router rather than one module, for data the first paint needs anyway. Lazy-loading
data the initial render requires trades bundle size for a waterfall and is usually a loss.

**The real question underneath is architectural, not a code-split:** the reviewed pages ship
their content as bundled JSON rather than fetching it. Whether Home should read its projection
from the API instead of a bundled fixture is a product decision about how this site is
supposed to work — worth asking, but not something to resolve inside a bundle-size issue.

### Recommendation

1. **Do the 18.9 KB** (`concept-graph-demo`, `agenda-board-projection.sample.dev`) with the
   pattern 1b established. Small, and genuinely demo-gated.
2. **Do not attempt the 133.3 KB as a code-split.** Raise the architectural question separately
   if bundle size matters more than it currently appears to.
3. Step 3 (per-route splitting) is unaffected and still last.

*Method note: the first classification pass reported `state-matrix.json` as having **zero** use
sites. That was a probe bug — the filter excluded any line matching `const`, and its only use
is `const matrix = narrowToRequestedAccess(STATE_MATRIX, query)`. `noUnusedLocals: true` is
enabled in `tsconfig.json`, so a genuinely unused const could not compile — which made the
result impossible on its face and should have been caught before it was believed.*


---

## CORRECTION 2026-08-02 (iteration 63) — `BOARD_SAMPLE` is NOT gated, and the classifier that said so is not trustworthy

The step-2 table above marks `agenda-board-projection.sample.dev.json` (4.7 KB) as
**GATED — lazy-loadable**. **That is wrong.** Its line 953 use site is inside
`renderHomeRoute`, the unconditional `/home` handler:

```ts
sampleBoard: requestedAccess ? { ...BOARD_SAMPLE, access: requestedAccess } : BOARD_SAMPLE,
```

It is passed on every render, exactly like `CARD_FEED`. The classifier marked it gated
because it tests each use line for the substrings `demo|design|sample`, and the **property
name** `sampleBoard` contains "sample". That is name matching, not gate detection.

**So the lazy-loadable total is at most 14.3 KB, not 18.9 KB** — and even that is unconfirmed.
`GRAPH_DEMO` has two real sites: line 549 is genuinely behind `if (demo === 'graph-synthetic')`,
but line 304 sits in `completeDemoBody()`, whose reachability was **not** traced. Its name
suggests a demo path; name-based inference is exactly what produced this correction and the
previous one, so it does not count as evidence.

### The standing lesson for this issue

**Every reachability claim in this plan was produced by substring heuristics, and three of them
have now been wrong** — `state-matrix` ("zero use sites", impossible under `noUnusedLocals`),
`BOARD_SAMPLE` (above), and the original "~152 KB remaining" (bytes counted without
reachability at all).

**Do not act on any GATED/ALWAYS-USED label in this document without reading the use site.**
The remaining opportunity is small enough — at most 14.3 KB against a 736 KB bundle, under 2% —
that the measurement cost has clearly exceeded the value. Treat steps 2 and 3 as **closed
unless the architectural question is taken up**: whether reviewed pages should fetch their
projections instead of bundling them. That question is worth more than every remaining byte
here, and it is the owner's to answer.
