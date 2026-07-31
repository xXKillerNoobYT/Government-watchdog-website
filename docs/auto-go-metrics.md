# AUTO GO — Metrics (Government Watchdog website)

One row per iteration. Read by the weekly `loop-self-improve` pass.

| date | iteration | area | check | status | findings | fixes_applied | tests_added | duration_sec | meta_checks_fired |
|---|---|---|---|---|---|---|---|---|---|
| 2026-07-28 | 1 | build-guards | C8 | in_progress | 4 | 3 | 25 | 1980 | github-issues-sync (global), first-run tracker seeding |
| 2026-07-28 | 1b | ci-tooling | C5 | done | 1 | 1 | 0 | 1500 | unplanned — CI-blocked follow-through on #59 |
| 2026-07-28 | 2 | build-guards | C8 | in_progress | 3 | 3 | 31 | 2400 | none fired — carry-over work took the iteration (see heartbeat) |
| 2026-07-29 | 3 | build-guards | C8 | blocked | 4 | 1 | 11 | 2100 | Notion hub read (Gate C kickoff); five others still not fired — see heartbeat |
| 2026-07-29 | 4 | build-guards | C1b | in_progress | 8 | 1 | 5 | 2700 | ALL SIX — github-issues-sync, recommender, revise-claude-md, improver, self-audit, self-improve |
| 2026-07-29 | 4b | ci-tooling | C5 | done | 1 | 1 | 0 | 900 | unplanned — CI-blocked follow-through; #98's timeout raise proved insufficient, fixed the doubled trigger at the root |
| 2026-07-30 | 5 | build-guards | Stage 6 (merge) | done | 5 | 5 | 0 | 2400 | Notion hub read (Gate C kickoff); other five inside their 20h windows, not due |
| 2026-07-30 | 6 | build-guards | C1b | in_progress | 2 | 1 | 9 | 1500 | github-issues-sync (global); recommender + revise deferred with reason, not silently skipped |
| 2026-07-30 | 7 | build-guards | C1b | done | 3 | 1 | 0 | 2000 | github-issues-sync (labels created, 33/33 classified), recommender (delta-scoped), revise-claude-md; shared-file reconciliation: C3 retired, C7/C10 n/a, C8 done, area_bindings for all ten areas |
| 2026-07-30 | 7b | pages-civic | Stage 6 (PR review + merge) | done | 1 | 1 | 0 | 1200 | owner-directed sweep of all open PRs; #45 re-verified against current main and merged; defect found to no longer reproduce pre-fix (recorded on PR) |
| 2026-07-30 | 8 | build-guards | C4 | done | 2 | 1 | 5 | 900 | none due; C4 audit caught #112 trap live (grep vs grep -a) and closed the untested guard-#4 decision hook |
| 2026-07-30 | 9 | ci-tooling | owner-pinned #110 | done | 1 | 1 | 0 | 600 | owner decision batch recorded (5 decisions); GOV Q&A Notion page created; storage-bus design note + issues #195/#119 |
| 2026-07-30 | 10 | build-guards | C5,C7b,C9,C11,C11b,C12,C13 | done (C6 blocked) | 4 | 3 | 0 | 1800 | area-scoped C13; #112 closed; #49 measured and routed to owner Q&A rather than silenced |
| 2026-07-31 | 11 | honesty-ledger | C1/area entry — #69 P0 | done | 3 | 1 | 0 | 2400 | Gate C kickoff; area advanced off parked build-guards; deploy-release skipped on measurement; CLAUDE.md drift fixed |
| 2026-07-31 | 12 | honesty-ledger | #86 P1 (CS applied) | done | 3 | 1 | 1 | 2100 | none due; browser check caught two stale copy strings the suite could not see |
| 2026-07-31 | 13 | honesty-ledger | #75 + #87 P1 (CS applied) | done | 2 | 2 | 2 | 2400 | none due; two measurement artifacts diagnosed (stale dev-server module, no-op hash assignment) |
| 2026-07-31 | 14 | honesty-ledger | C1b (CS registry audit) | done | 3 | 3 | 0 | 1500 | none due; found the checklist described the wrong area, and a phantom CS registry row this loop had introduced |
| 2026-07-31 | 15 | honesty-ledger | C4 (coverage by mutation) | done | 1 | 1 | 0 | 1500 | none due; mutation testing beat grep — 4 of 5 "untested" exports were covered behaviourally, the 5th was dead code and was deleted |
| 2026-07-31 | 16 | honesty-ledger | C7 (bound to web surface) | done | 0 | 0 | 1 | 1500 | none due; C7 re-bound per the iteration-10 commitment; CS-inertness sweep over 11 routes x 2 lanes, red-proved |
| 2026-07-31 | 17 | honesty-ledger | C7b + C8 + C9 | done | 1 | 1 | 0 | 1200 | none due; hunting mandate discharged; zero unsafe sinks, CS copy proven literal, style idempotency measured under 10k calls |
| 2026-07-31 | 18 | honesty-ledger | C11b + C12 + C13 → ✅ GRADUATED | done | 3 | 3 | 0 | 1500 | none due; FIRST area graduation on either GOV repo (17/17); advanced to intake-upload past two measured-blocked areas |
| 2026-07-31 | 19 | intake-upload | C1 + C1b | done | 2 | 1 | 1 | 1500 | none due; invariant was proven by example not over its own constant; also caught a self-inflicted @vitest-environment placement bug a green run would have hidden |
| 2026-07-31 | 20 | intake-upload | C2,C2b,C4,C5,C6,C7,C11 | done | 2 | 2 | 2 | 2100 | none due; C4 mutation sweep clean on all 10 exports; C7 found my own iteration-16 sweep covered 11 of 22 routes, now derived from the router |
| 2026-07-31 | 21 | intake-upload | C7b,C8,C9,C11b,C12,C13 → ✅ GRADUATED | done | 2 | 2 | 8 | 2400 | none due; SECOND graduation (17/17); graduation gate caught an unmarked C8; hostile-input suite added |
| 2026-07-31 | 22 | a11y-responsive | C1 + #73 print stylesheet | done | 3 | 1 | 4 | 2400 | none due; shipped a vacuous guard 3x, caught only by a VERIFIED red proof (negative slice, then at-rule parse bug) |
| 2026-07-31 | 23 | a11y-responsive | #74 type floor | done | 2 | 2 | 4 | 2100 | none due; audit found a LIVE defect (origin banner at 11.5px), not just a missing doc; stale dev server caught again |
| 2026-07-31 | 24 | a11y-responsive | #88 tab overflow (A/B) | done | 3 | 2 | 4 | 2700 | none due; A/B measured in the live DOM (B costs 133px bar); screenshot caught my shadow being invisible in the default dark theme |

## Findings this iteration

1. **Backlog dependency fan** — ten P0/P1 MOTY issues are unstartable until PR #68 merges.
2. **Exposure guard was port-enumerating** — `http://127.0.0.1:8787/read`, a form the repo's
   own `.env.example` documented, passed the check. Fixed (#55 AC1).
3. **`dist/` after `build:all` is a clean-looking unsafe package** — `dist/public` passes every
   content check while `dist/client` sits beside it. Fixed (#55 AC6).
5. **CI timeout flake (#59)** — PR #96 went red on a pre-existing non-deterministic timeout in two route-integration files. Isolated by A/B on clean `main` and fixed in PR #98; PR #96 stacked on it and now green.
4. **`.env.example` documented a form the guard now rejects**, and `VITE_READ_API_URL` is no
   longer read by `readConfig` at all. Comment corrected; the dead-key drift filed separately.

## Findings — iteration 2

6. **The two build guards had a seam between them.** `check-no-direct-exposure.mjs` scans
   source and explicitly skips `dist/`; `check-public-bundle.mjs` reads `dist/` but only for
   literal private markers. Nothing ever asked whether an off-origin *destination* survived
   bundling — so a destination introduced by a dependency, a dynamic import, or a rewritten
   asset reference would ship unseen. Fixed (#55 AC2/AC3).
7. **`\uXXXX` is exactly four hex digits.** A `{1,6}` decode pattern eats the next character
   whenever it is also a hex digit, so `/` + `evil` decoded to one wrong code point and
   the obfuscated-URL test failed. Only the braced `\u{...}` form is variable-length.
8. **Deduplicating findings by report excerpt does not deduplicate.** The excerpt carries
   surrounding context, so one destination repeated across minified chunks produced one
   finding per copy. The key has to be the matched destination itself.

## Findings — iteration 3

9. **The public-bundle guard read nine file extensions and called it "the artifact".**
   `scanPublicBundle` filtered on a `TEXT_EXTENSIONS` allow-list, so a private marker
   carried in an emitted font, image, `.bin`, or `.wasm` was never read. Demonstrated on the
   real public artifact before the fix: `reviewer_internal` appended to a shipped `.woff2`
   and `Workspace · Home · Alpine` written to a `.bin` scored **0 violations**. Fixed by
   deleting the allow-list entirely and reading every emitted file as `latin1` (#55 AC4).
10. **A byte-oriented read needs a byte-oriented needle.** Reading files as `latin1` and then
    searching for the marker's own JavaScript string silently misses every marker containing
    a non-ASCII character — `Workspace · Home · Alpine` is 25 characters in the source and
    27 bytes in the artifact. The needle has to be the marker's UTF-8 bytes read as `latin1`.
    Half of this fix would have looked complete and caught nothing.
11. **Markers nest inside other markers.** `reviewer_internal` ⊂ `reviewer_internal_records`
    and `reviewer-internal` ⊂ `/api/reviewer-internal`, so planting one marker legitimately
    reports two. A table-driven test asserting a count of exactly 1 failed on the *test's*
    assumption, not on the code — assert membership, not cardinality, over a marker list.
12. **The marker match is blind to ASCII-escaped forms** — filed as **#102**, deliberately not
    fixed. Measured rather than assumed: the current build emits UTF-8 literally and contains
    no `\uXXXX` escapes at all, so this is a latent trap, not a live leak.

## Findings — iteration 4

13. **A checklist item was green with no artifact behind it.** `C1_plan_complete` was recorded
    `done` from iteration 1 while `docs/plans/` did not exist. Four of the six tracker paths
    the checklist writes to (`dev-qa.md`, `plans/`, `automation-recommendations.md`,
    `auto-go-self-improvements.md`) had never been created for this project, so C1, C2, C11b
    and C13 had nowhere to persist — each pass re-derived findings and dropped them.
14. **C3 has never run.** It invokes `/hunt-fix-loop`, verified missing everywhere on disk. A
    check required for area graduation, silently doing nothing. Filed #106.
15. **C7 and C10 are structurally unsatisfiable on this repo**, so no area can graduate.
    `grep -ril tauri .` → zero hits. `dev-qa.md` Q2.
16. **Eight orphaned scanners; three falsely advertise their own wiring** in frontmatter.
    A scanner's self-description is not evidence of coverage.
17. **The guard's docstring and code disagreed about scope (#101).** `apiConfigViolationsIn`
    justified scanning `.env*` because "Vite inlines every `VITE_*` value" while value-scanning
    only five key suffixes — `VITE_READ_API=https://evil.example` would ship inlined and pass.
    Fail-open in the guard, not an open door. Fixed and red-proved.
18. **`EMITTED_TEXT_EXTENSIONS` is a non-finding** — investigated because it resembles the
    allow-list deleted in iteration 3, and it is the structural opposite: unlisted files are
    read as bytes and still scanned. Recorded so it is not re-raised.
19. **`npm run e2e:local` is called by nothing** (#104) — the only end-to-end test of the
    same-origin `/api` contract.
20. **CI typechecks 3× and boots the smoke suite 2× per push** (#105), on the same
    single-machine runner whose concurrent load caused #59.
21. **The public-bundle marker scan was blind to every encoding form but literal UTF-8**
    (#102, closed this iteration). AC4 removed the file-*type* blindness; the charset
    assumption outlived it. Fixed by decoding the haystack, not by enumerating needles.
22. **`test/public-bundle-markers.test.ts` carries 4 raw NUL bytes** (#112) — pre-existing
    from #55's AC4 tests. `file` reports `data`, plain `grep` finds nothing in it, and
    CLAUDE.md section 3's mandated `grep test/` step therefore skips it silently.
