# Area plan — `build-guards`

**Owns:** `scripts/check-*.mjs`, exposure scanning, public↔private lane separation,
`vite.config.ts` build-time boundary enforcement.

Written 2026-07-29 (iteration 4). This is the area's first plan file — `docs/plans/` did not
exist, yet `C1_plan_complete` had been recorded `done` since iteration 1. That is the drift
this plan exists to end: a checklist item that can be marked green with no artifact behind it
measures nothing.

---

## What this does

Four independent guards keep two build lanes from leaking into each other. They are
deliberately **not** one guard: each answers a different question and each has a different
blind spot, so a finding in one is not covered by another.

| Guard | Question it answers | Runs |
|---|---|---|
| `scripts/check-no-direct-exposure.mjs` (bare) | Does the **source tree or `.env*` config** name a destination off this origin? | before `vite build`, both lanes |
| `scripts/check-no-direct-exposure.mjs --emitted <dir>` | Does the **emitted artifact** — the resolved module graph after Rollup rewrites — dial off-origin? | after `vite build`, both lanes |
| `scripts/check-public-bundle.mjs` | Does any emitted file carry a **private marker**? | in-chain via `--package`, and standalone in CI |
| `publicModuleBoundary()` in `vite.config.ts` | Is a **disallowed local module** being pulled into the public graph? | Rollup `moduleParsed`, during the public build |

## Why

The public lane is anonymous; the private-beta lane is reviewer-gated. A destination, a
fixture, or a reviewer marker that survives into the public artifact is a disclosure. The
guards make the build refuse rather than the reviewer discover.

## Current state

Issue **#55** is the area's governing card: **7 of 8 acceptance criteria are implemented**,
across PRs #96 → #100 → #103 (a bottom-up stack, each genuinely dependent on the one below).

| # | Acceptance criterion | State | Evidence |
|---|---|---|---|
| AC1 | Reject absolute, protocol-relative, backslash, encoded network-path, non-approved port, and userinfo URL forms in every browser-facing API configuration | **done** | six `api-config-*` rules, `check-no-direct-exposure.mjs:158-186` |
| AC2 | Scan source, module graph, emitted JS/CSS/HTML/JSON/maps, workers, manifests, deployment packages | **done** | `scanEmittedArtifact` (`:495`); auditing the artifact subsumes the module graph — Rollup rewrites dynamic `import()` and `new URL(..., import.meta.url)` into emitted files, so the artifact *is* the resolved graph |
| AC3 | Credentials, bearer headers, cookies never attached to an off-origin destination | **done** | `emitted-off-origin-xhr`, `emitted-url-userinfo` (`:247-271`) |
| AC4 | Public build rejects any private fixture/reviewer/bypass marker **regardless of import form** | **done** | `TEXT_EXTENSIONS` allow-list deleted; every emitted file read as `latin1` and matched against each marker's UTF-8 bytes (`check-public-bundle.mjs:59-105`) |
| AC5 | Tests cover normal + dynamic imports, `new URL(..., import.meta.url)`, CSS URLs, binary/image assets, obfuscated encodings | **done** | `decodeObfuscation` (`:326`) + `test/emitted-artifact-exposure.test.ts` |
| AC6 | A public deployment package fails if it contains a sibling private client artifact | **done** | `privateSiblingLanes` / `assertPublicPackage` (`check-public-bundle.mjs:142-194`) |
| AC7 | Hosted anonymous probes confirm no direct backend hostname/port and no source-map or asset escape | **BLOCKED — owner-gated** | needs a hosted deploy; deploy is HOLD per GOV-420. Not reachable from this loop at all. |
| AC8 | Report names the exact file, matched value, and rule **without printing credentials** | **done** | `redactCredentials` applied at every hit site (`:387`, `:394`, `:421`, `:445`) |

**Verification for this area** — all three, plus the dual-lane build:
`npm test` · `npx tsc --noEmit` · `npm run build` · `npm run build:all`.

## Design rules this area follows

These are load-bearing. Breaking one produces a guard that looks complete and catches nothing.

1. **Rules key on dial position, never on "contains an absolute URL."** `fetch(`,
   `<link href>`, CSS `url(` are destinations; a citation of a public record inside a fixture
   is evidence. `<a href>` is deliberately unmatched. A shape-only rule would fail the build
   on honest civic data — the exact outcome the honesty contract exists to prevent.
2. **Split every guard pure-decision / filesystem-walk.** This repo carries no
   `@types/node`, so `.mjs` guards may use `Buffer` freely (never typechecked) but a `.ts`
   test may not. Untestable code is the alternative.
3. **A byte-oriented read needs a byte-oriented needle.** `latin1` reads must be matched
   against `Buffer.from(marker,'utf8').toString('latin1')` — `Workspace · Home · Alpine` is
   25 chars in source and 27 bytes on disk.
4. **Allow-list text, never binary.** A list of binary extensions goes stale; an allow-list
   of *text* extensions does not, because anything unlisted is still read as bytes and still
   scanned with the high-signal rule subset. Nothing is ever skipped.
5. **Pair every green guard with a negative control on real output.** A pass is equally
   consistent with "clean bundle" and "rules match nothing" until a planted violation is
   caught.
6. **When a guard's hole is "the enumeration is incomplete," ask whether the enumeration is
   needed at all** before growing it.

## Test plan

Unit tests over the pure halves (`violationsIn`, `apiConfigViolationsIn`,
`emittedViolationsIn`, `publicMarkerViolationsIn`, `privateSiblingLanes`), plus negative
controls that plant a violation into a copy of the **real** built artifact and assert it is
named with its exact file. Assert **membership**, never cardinality, over a marker list —
markers nest (`reviewer_internal` ⊂ `reviewer_internal_records`).

## Security

This area *is* the security boundary for the public lane. Note what it is **not**: the
client-side gate (`?gate=approved`, `?reviewer=1`) is UI scaffolding that intentionally fails
open. Confidentiality rests on the server-side Sites custom-access worker.

---

## C1b — plan-vs-code drift, 2026-07-29

Comparing declared intent against implemented behavior.

### D1 — `apiConfigViolationsIn` docstring and code disagree — **FIXED this iteration**

The function's docstring justifies scanning `.env*` because **"Vite inlines every `VITE_*`
value into the bundle."** The code then value-scanned only keys matching
`/(?:URL|BASE|ENDPOINT|ORIGIN|HOST)$/`, so most `VITE_*` keys were never examined —
`VITE_READ_API=https://evil.example` would be inlined verbatim and pass every rule.

A fail-open in the guard, not an open door: the one consumed key, `VITE_API_BASE`, ends in
`BASE` and is covered, and `safeApiBase` ignores unknown keys at runtime. Tracked as **#101**
and fixed here — see that issue and the code comment for the shape.

The filter could not simply be deleted: `api-config-absolute` tests
`!v.startsWith('/') || v.includes(':')`, which rejects any non-path value, so applying the
full rule set to every `VITE_*` key would fail `VITE_USE_FIXTURES=false`. The fix instead
applies the five destination-specific rules to every `VITE_*` value and replaces only the
catch-all with a test that requires a real authority.

### D2 — `EMITTED_TEXT_EXTENSIONS` is **not** the blind spot it resembles — no drift

Checked because it looks like the `TEXT_EXTENSIONS` allow-list iteration 3 deleted from the
sibling guard. It is structurally the opposite: unlisted files are **not skipped**, they are
read as `latin1` and scanned with `BINARY_RULE_IDS`. Recorded so a later pass does not
re-raise it as a finding.

Residual, deliberate: a *text* format not on the list gets the two-rule binary subset rather
than all eight. A degradation, not a hole, and the documented tradeoff in design rule 4.

### D3 — AC7 is unreachable, and the area cannot fully graduate on it

Not drift — a permanent, honestly recorded gap. C8 is `blocked`, not `done`.

### D4 — Two open issues in this area are known drift, deferred with reason

**#102** — the public-bundle marker match is blind to ASCII-escaped forms. Measured before
filing: the current build emits UTF-8 literally with **zero** `\uXXXX` escapes, so it is
latent, one `esbuild.charset: 'ascii'` away from live. Deliberately not half-fixed —
covering only `\uXXXX` and not `\xXX` yields a guard that reads complete and misses.

**#97** — RESOLVED 2026-07-30 (iteration 7): the key is **removed**, not wired. This stopped
being an open design decision on inspection: the shipped GOV-1527 design already derives the
read endpoint from `apiBase(env)` in `readConfig` (`src/data/client.ts:31`) and
`test/client.test.ts` asserts a cross-origin `VITE_READ_API_URL` is *ignored* — the code had
already decided; only `.env.example` was stale. Removal reconciles the doc with the shipped
single-source contract (remove > merge > simplify). A second key naming the same destination
would be a second way to point it off-origin. Red-proved on the real file: re-adding
`VITE_READ_API_URL=http://127.0.0.1:8787/read` fails the exposure guard
(`api-config-absolute`, exit 1) because #101 made the rule key-agnostic — the deleted key
cannot come back armed.

### D5 — Structural blocker on graduation, outside this area's control

C7 (`usability-enforcer`, "iOS pages") and C10 (`cross-platform-qa`, "iOS native ↔ Tauri")
are unsatisfiable here — `grep -ril tauri .` returns zero hits repo-wide. Both are required
for graduation, so `build-guards` **cannot** graduate as the checklist stands. Filed as
`docs/dev-qa.md` Q2.
