# Automation recommendations — Government Watchdog website

Output of the `claude-automation-recommender` meta-check. **Recommendations sit dormant
until the owner approves them** — each one has a matching APPROVE/DEFER/REJECT question in
`docs/dev-qa.md`. AUTO GO does not implement an unapproved recommendation.

---

## Global scan — 2026-07-29 (iteration 4, first run)

Scope: `package.json` (all scripts), `vite.config.ts`, all 9 files in `scripts/`, all 3
workflows in `.github/workflows/`, `.claude/`, `test/` (54 files), local git hooks.

### Already adequately automated — no action needed

Recording these so a later pass does not "discover" them again:

- **Typecheck, unit tests, integration smoke, dual-lane build, public-bundle scan** — all
  wired into `.github/workflows/ci.yml` and triggered on every push and PR to any branch.
- **Public/private lane boundary — enforced twice, independently.** (1) the source-tree and
  `--emitted` scans via `scripts/check-no-direct-exposure.mjs`, chained into `build:public`
  and `build:private-beta` both before and after `vite build`; (2) `publicModuleBoundary()`
  in `vite.config.ts`, a Rollup `moduleParsed` hook that hard-fails the public build the
  instant a disallowed local module is discovered, independent of minification. Genuine
  defense-in-depth, already build-time enforced.
- **Public downloadable-asset safety** — `scripts/check-public-bundle.mjs` runs in-chain via
  `--package` and again standalone in CI.
- **Post-merge worktree/branch cleanup** — `.github/workflows/post-merge-cleanup.yml`,
  dry-run only by design.

### Gaps, ranked by value / risk

**A1 — `npm run e2e:local` is defined but never called anywhere.**
`scripts/local_e2e.sh` is the **only** test that exercises the GOV-1527 §5 same-origin
`/api` contract end to end (gated-access 403/404 behavior, proxy contract, and the
zero-reviewer-content-in-static-output assertion). Evidence:
`grep -rn "e2e:local\|local_e2e" .github package.json` matches only the script's own
definition at `package.json:22` — **zero hits in any workflow**. It runs only if a human
remembers. Proposed: a separate workflow on the same self-hosted runner (which already has
the backend checkouts `local_e2e.sh` auto-detects), kept out of the blocking `ci.yml` path.
*Risk: medium* — depends on a co-located backend checkout and port allocation.
**Filed as issue #104.**

**A2 — CI runs `tsc --noEmit` three times and the integration-smoke suite twice per push.**
`npm run typecheck` runs standalone in `ci.yml`, then again inline inside both
`build:public` and `build:private-beta` during `npm run build:all`. Separately,
`test/integration-smoke.test.ts` is matched by `npm test` (`vitest run`) and then booted
again by the dedicated `test:smoke` step — the file's own header says so. Each smoke boot
loads the whole ~70-module app in jsdom. *Risk: low.* This is the same runner that produced
the #59 timeout flake, so removing duplicated work directly reduces the load that caused
it. Keep the inline checks in the npm scripts (they protect anyone building outside CI);
drop only the redundant standalone CI steps.
**Filed as issue #105.**

**A3 — No repo-level Claude Code automation exists.** `find .claude -type f` returns only
`.claude/settings.local.json` (a bash-permission allowlist). No `settings.json`, hooks,
skills, agents, or commands. Given this repo's non-obvious build-time security contracts, an
agent editing `src/` has no fast feedback short of the full build chain. Proposed: a
PostToolUse hook or a `/verify` skill that reuses the already-exported `PUBLIC_LOCAL_MODULES`
set and `check-no-direct-exposure.mjs` for instant local feedback. *Risk: low* — purely
additive and reuses existing logic rather than reimplementing it, so no second source of
truth. **Needs owner approval before building — see `docs/dev-qa.md` Q4.**

**A4 — `build:integrated` / `fetch:artifact` are not exercised in CI.** Confirmed:
`grep -rn "build:integrated\|fetch:artifact" .github` returns nothing. Deliberately **not**
recommended for per-push CI — it would make backend availability a hard CI dependency, and
it is deploy-time integration rather than a correctness guard. Flagged only.

### Explicitly not recommended

A **pre-commit hook running the three-command ritual**. It would duplicate CI's work on the
same already-variance-prone self-hosted runner, compounding the exact problem #59 was filed
for. A3's lighter hook is the better answer to "faster local feedback."

## Daily pass — 2026-07-30 (iteration 7)

Scoped to what changed since the 2026-07-29 broad scan rather than re-deriving it.

**A5 — The `area:*` label taxonomy now exists and closes A-series gap 0.** 12 labels
created and all 33 open issues classified this iteration, so `C2b`/`C11` finally have a
selector and `gh issue list --label area:X` is a real query. No further automation needed;
the check bindings in the heartbeat's `area_bindings` are the wiring. Recorded so a later
broad scan does not re-recommend "adopt labels".

**A6 — `.claude/launch.json` (uncommitted, local-only) was written this session** so the
preview server can start the dev server by name (`npm run dev`, port 5178 with
`--strictPort` because a Paperclip agent's server already holds 5173). Worth committing if
the owner wants one-keystroke previews for every agent; left local otherwise since it
encodes a port choice that is session-circumstantial. **Owner call — low stakes either way.**

### Explicitly not recommended (this pass)

An automated "`.env.example` keys must all be read by code" guard, considered while closing
#97. It needs an enumeration of read keys that goes stale exactly the way the allow-lists
this area keeps deleting did, for a hygiene (not security) property: the exposure guard
already catches any *armed* revival of a dead key regardless of key name (#101, red-proved
on the real file this iteration). Deletion beat automation; one dead key in 30 months does
not justify a new enumeration.

## Area: honesty-ledger — 2026-07-31 (iteration 18, C13)

Scoped to `src/ui/{coming-soon,info-note,explainer,private-info-note}.ts`.

**A7 — CS-copy-literal source scan. CONSIDERED AND DECLINED, with a trigger condition.**
C7b established that all seven `comingSoonNote`/`comingSoonChip` call sites pass authored
literal strings (zero `${…}` interpolation). A source-scanning guard could enforce that
permanently. Declined for now on the standing precedent *measure the speculative hole before
building for it*: the violation count is **0 of 7**, the rule is now written into the
matrix's reviewer checklist where a reviewer already looks, and a new scanner is a system to
maintain. **Build it if the count ever becomes non-zero** — that is the trigger, stated so
the next pass does not have to re-derive the judgement.

**A8 — the CS-inertness sweep is the automation this area needed, and it already shipped**
(iteration 16, `test/design-routes.test.ts`). It runs in the normal suite, needs no new
scheduled task, and covers 11 routes × 2 lanes. Recorded so a later broad scan does not
recommend building something equivalent.

### Explicitly not recommended (this area)

A per-marker snapshot test. The inertness sweep asserts the *properties* that matter
(no operable control, label present, no contract sentence); snapshots would additionally
lock exact copy, which the suite already does where it matters and which would make every
honest copy improvement a test churn.

## Area: intake-upload — 2026-07-31 (iteration 21, C13)

Scoped to `src/ui/{gated-upload,supplied-files,supersede-view}.ts`.

**A9 — no new automation recommended, and the reason is worth recording.** The C4 mutation
sweep found **every** export covered (10 of 10 produced failures), and the hostile-input hunt
found no defect. The gap this area actually had was in a guard *belonging to another area* —
the CS-inertness sweep covered 11 of 22 routes — and that was fixed structurally by deriving
the route list rather than by adding a scanner. **The lesson generalises: when a check finds
nothing in its own area, look at whether an existing cross-cutting guard silently excludes
that area.** That is where this iteration's only real finding came from.

**A10 — `test/gov1569-upload-hostile-input.test.ts` is the automation this area gained**
(this iteration). It locks three properties nothing else asserted for a surface that accepts
files from a person: validation never throws on hostile values, error copy never echoes raw
input back, and error copy stays bounded. It runs in the normal suite; no scheduled task.

### Explicitly not recommended (this area)

A filename-content validator (length limits, path-shape rejection). Spec §3.2 defines
validation as **mechanical** — type, size, required provenance — and nothing else. The name
renders as text (`el()` uses `createTextNode`) and the **backend is the sanitising boundary**,
exactly as the client gate is not the confidentiality boundary. Adding a content judgement
here would move a security boundary into the browser, which is the opposite of this repo's
standing architecture.
