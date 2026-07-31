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
| 2026-07-30 | 7b | pages-civic | Stage 6 (PR review + merge) | done | 1 | 1 | 0 | 1200 | owner-directed sweep of all open PRs; #45 re-verified against current main and merged; defect found to no longer reproduce pre-fix (recorded on PR) |
