# AUTO GO — Memory (Government Watchdog website)

*Compressed wisdom from prior iterations. Seeded 2026-07-28 on first run.*

## Decisions

- **[2026-07-28]** First run found no trackers and 28 open issues. Rather than start the
  area rotation at area 1, I triaged the backlog against open PR #68 first. That reordering
  was the whole value of the iteration — see Patterns.
- **[2026-07-28]** Chose issue #55 (build-guard generalization) over the higher-priority
  P0 #69 because #69's acceptance criteria name files that do not exist on `main`. Priority
  is meaningless if the work is not yet possible; availability gates priority.

- **[2026-07-28]** Extended issue #55 on a branch **stacked on the open PR #96** rather than
  pushing more commits into #96 itself. #96 was green and waiting on the owner; growing it
  would have delayed a mergeable PR and enlarged its review. The remaining work also depended
  on #96's code, so basing on `main` would have guaranteed a conflict. Stack when the next
  step depends on an open PR that is already ready to merge.
- **[2026-07-28]** Emitted-artifact rules key on **dial position** (`fetch(`, `<link href>`,
  CSS `url(`), never on "contains an absolute URL". Fixtures cite real public records and are
  bundled verbatim; a shape-only rule would have failed the build on honest civic data — the
  exact outcome the honesty contract exists to prevent. A citation is evidence; a dial is a
  destination. `<a href>` is deliberately not matched for the same reason.
- **[2026-07-29]** Closed a guard's blind spot by **deleting the list that caused it**, not by
  extending it. `scanPublicBundle` skipped everything outside a nine-entry text-extension
  allow-list; adding `.woff2`, `.png`, `.wasm` would have left the next new extension blind.
  Reading every file as `latin1` removes the list entirely — one path, nothing to go stale.
  When a guard's hole is "the enumeration is incomplete", ask whether the enumeration is
  needed at all before growing it.
- **[2026-07-29]** Marked C8 **`blocked`, not `done`**, with issue #55 at 7 of 8 AC. The last
  criterion needs a hosted deploy this loop may not perform. `done` would claim something
  nobody verified; `in_progress` would imply the loop is still working it. `blocked` + reason
  is the only honest state, and unlike `in_progress` it lets the rotation advance.
- **[2026-07-29]** Filed the ASCII-escape blind spot as **#102** instead of fixing it inside
  the AC4 change. It is a different criterion (encoding form, not import form), it is not
  live today, and covering only the `\uXXXX` variant would have produced a guard that reads
  as complete and still misses `\xXX`. A half guard is worse than a filed issue.

- **[2026-07-29]** Wrote a root `CLAUDE.md` as a **thin router**, not a rulebook. The standing
  principle is that systems shrink; a CLAUDE.md restating
  `docs/design-information-type-matrix.md` or the incoming `AGENT-RULEBOOK.md` would be a
  second source of truth that rots silently. It carries only what an agent needs *before* it
  knows where to look, then points — and says outright that the linked document wins on
  conflict, and that it should shrink further once the rulebook lands.
- **[2026-07-29]** `loop-self-improve` applied **zero mutations on purpose**. Every trigger
  the loop defines is specified over weeks ("3+ consecutive weeks", ">10 findings/week",
  "14+ days") and only 4 rows over 2 days existed. Doing nothing and writing down *why*, plus
  what to watch for, is the correct output of a self-improvement pass with insufficient data —
  and `~/.claude/commands/auto-go.md` is shared with the backend routine, so a mutation
  inferred from website data alone would silently retune a second, actively-running loop.
- **[2026-07-29]** Filed the two structural loop defects (C3 no-op, C7/C10 unsatisfiable) as
  **Q&A + issue rather than fixing them**, even though the self-improve pass is nominally
  allowed to toggle a check. Both change what a *required* check means, which is the
  graduation bar itself — that is the owner's decision, not a tuning knob.

- **[2026-07-30]** Refused to merge five `MERGEABLE/CLEAN` PRs on their existing green checks.
  Every check predated the owner's #68 merge, and the stack base was 5 commits behind `main`.
  **`MERGEABLE` is a statement about textual conflict, not about correctness**, and a
  `pull_request` check proves only what was true when it ran. Rebased and re-verified first;
  the discipline immediately earned its keep when #103's fresh check went red.
- **[2026-07-30]** Merged the stack with a bare `--merge` after `--delete-branch` auto-closed
  the next PR. Chose to **resurrect the deleted branch** rather than close #96 and open a
  replacement PR: a new PR would have lost the review thread, the issue links, and the
  authored description, to save one `git push`.
- **[2026-07-30]** Corrected #55's auto-close by **recording the evidence on the closed issue
  and re-filing only the unmet criterion (#109)**, instead of reopening. Reopening would have
  made seven genuinely-complete criteria read as unfinished; a successor issue names the one
  real gap and its blocker (the owner, not code). A closing keyword in a PR body is not a
  judge of completeness.

- **[2026-07-30]** Closed #102 by **decoding the haystack, not enumerating escaped needles** —
  and by reusing the sibling guard's `decodeObfuscation` rather than writing a second decoder.
  The issue itself proposed a per-marker `\uXXXX`/`\xXX` variant list; that is the same
  allow-list shape iteration 3 already had to delete from this very file. One transformation
  covers every marker and every future escape form; a needle list goes blind at the next one.
- **[2026-07-30]** Filed the NUL-byte finding as **#112 instead of fixing it inline**, though it
  is a two-character change. The lines belong to #55's AC4 tests, not to #102, and the fix has to
  preserve a specific two-character byte form (`\xc3\xbf`, U+00FF read back as latin1) — an
  easy thing to get subtly wrong in a drive-by edit inside an unrelated PR.

- **[2026-07-30]** Resolved #97 by **removal without an owner answer**, after two iterations
  recorded it as "owner-shaped, cannot self-clear." What changed: reading the issue *against
  the code* showed the decision was already made — `readConfig` derives the endpoint from
  `apiBase(env)` and a test asserts the key is ignored, so "wire it up" would mean adding a
  second way to name a destination the design deliberately single-sources. **"Needs an owner
  decision" deserves re-derivation before another deferral: if the shipped design already
  embodies one option, reconciling the doc to it is drift-cleanup, not decision-making.**
  Kept trivially revertible and said so everywhere it is recorded.
- **[2026-07-30]** Marked C8 `done` while its successor issue #109 stays open, by relabelling
  the criterion to the area it is actually a property of (`area:deploy-release` — anonymous
  probes test the hosted origin, not this area's source). The alternative — build-guards held
  hostage by a deploy that is owner-gated — punished the wrong area. A criterion belongs to
  the area whose artifact it measures, not the area whose issue first named it.

- **[2026-07-31]** Advanced the area off `build-guards` at **15/16** rather than idling on a
  check blocked by an owner decision, and **skipped `deploy-release` on measurement** rather
  than by rotation order: 2 of 4 issues `owner-decision`, one `blocked-by` a backend issue
  that does not exist, one gated on the pinned `BACKEND_REF`. **Rotation order is a default
  for avoiding spray, not a rule that outranks availability** — the loop already spent 10
  iterations in one area while the P0 sat untouched in area 5. Check the next area's issues
  before entering it; entering a fully-gated area just relocates the block.
- **[2026-07-31]** Recorded #69's AC6 as **pre-satisfied by #68** instead of editing something
  to tick it. The issue's line reference had drifted because #68 edited that file after filing.
  **When an AC cites a line number, verify the phrase still exists before "fixing" it** — an
  invented edit to satisfy a checkbox is worse than an unticked box with a reason.

## What worked

- **[2026-07-28]** `gh pr view <n> --json files` cross-referenced against
  `git cat-file -e main:<path>` is the fast, reliable way to tell "available work" from
  "work queued behind an unmerged PR". Do this before picking an item, every time.
- **[2026-07-29] Measure the speculative hole before deciding whether to build for it.** The
  ASCII-escape risk looked urgent until two greps settled it: the bundle contains the literal
  `·` and **zero** `\uXXXX` escapes anywhere. That turned an invented emergency into a filed
  issue (#102) with the exact trigger condition written down. Two greps, one right decision.
- **[2026-07-29] A table-driven test over a constant list catches assumptions, not just code.**
  Asserting "planting marker X yields exactly 1 violation" failed — because several markers
  nest inside others (`reviewer_internal` ⊂ `reviewer_internal_records`). The code was right
  and the test's arithmetic was wrong. Over a list of literals, assert **membership**, never
  cardinality.

- **[2026-07-29] A checklist item can be green with no artifact behind it, and nothing notices.**
  `C1_plan_complete` was recorded `done` from iteration 1 while `docs/plans/` did not exist at
  all. Four of the six tracker paths the checklist writes to had never been created here, so
  C1, C2, C11b, and C13 could not persist anything — each pass re-derived the same findings
  and dropped them. **Before trusting a check's recorded state, verify its artifact exists.**
- **[2026-07-29] Verify the resemblance before filing the finding.** `EMITTED_TEXT_EXTENSIONS`
  in the exposure guard looks exactly like the `TEXT_EXTENSIONS` allow-list deleted from
  `check-public-bundle.mjs` in iteration 3, and reading two comments settled that it is the
  structural opposite: unlisted files are **not skipped**, they are read as `latin1` and
  scanned with the high-signal subset. Recorded in the area plan as an explicit non-finding so
  a later pass does not "discover" it a second time.

- **[2026-07-30] Compare the merged tree against the tree you actually tested.**
  `git rev-parse origin/main^{tree}` vs the locally verified rebase tip came out **identical**
  (`d578e5f5`), which upgrades "I tested something like this" into "what shipped is exactly
  what passed". One command, and it is the only check that closes the gap between local
  verification and what the merge really produced.
- **[2026-07-30] Writing a duplicate fix byte-identical to the other PR's is what made the
  rebase free.** Iteration 4b copied #68's `push: branches: [main]` hunk verbatim rather than
  wording it better. When #68 landed first, git recognised the patch as already applied and
  **dropped the commit silently** — 13 commits rebased as 12, zero conflicts, in the file that
  gates all CI. An equivalent-but-reworded fix would have conflicted there instead.
- **[2026-07-30] Drain the CI queue before triggering the next check.** After #103's
  load-induced failure, every subsequent merge waited for `main`'s runs to complete before
  reopening the next PR. Both remaining PRs passed first time. Cheap, and it removes the
  variable rather than arguing about it.

- **[2026-07-30] Two encoding spaces means two needles, and mixing them yields a silent no-op.**
  In `publicMarkerViolationsIn` the raw text is a `latin1` read (byte space) so its needle is
  `byteForm(marker)`, while the decoded text is code-point space so its needle is the **plain**
  marker. Feeding `byteForm` to the decoded variant produces a guard that reads every file and
  never matches — the exact failure iteration 3 hit from the other direction. When a scan gains
  a second variant, ask what space that variant is in before reusing the old needle.
- **[2026-07-30] Measure the bundler instead of trusting the issue's prediction.** #102 stated
  `charset: 'ascii'` would emit `\u00b7`. One `esbuild.transform` against 0.21.5 — the version
  actually in this repo — showed it emits `\xB7` (uppercase, single-byte) and `\u2014` for the
  em-dash. The issue's own suggested needle list would have missed the real form. Two lines of
  measurement turned a guessed threat model into a pinned test.

## What didn't

- **[2026-07-28] Re-running a red CI check to "see if it was flaky" is not evidence and not
  a fix.** Three re-runs of the same commit produced three different failure sets (4 tests,
  then 1, then 2). What actually settled it was a controlled A/B on a clean branch: two full
  suites concurrently, same code, only `--testTimeout` differing — 5s failed both twins, 20s
  passed both. Reproduce the condition, then change one variable.

- **[2026-07-28] A guard that passes on the real artifact has proven nothing yet.** Both
  lanes went green on the first run of the new emitted scan, which is equally consistent with
  "clean bundle" and "rules match nothing". Injecting three destinations into a copy of the
  real 826 kB artifact — a credentialed `fetch`, an off-origin CSS `url()`, and a loopback
  host in a `.woff2`'s bytes — is what turned the pass into evidence. Always pair a green
  guard with a negative control on real output.

- **[2026-07-29] "The timeout fix landed" is not the same as "the timeout is fixed."** #98
  raised `testTimeout` to 20s and the same test failed at **21624ms** nine days later — a
  1.6s miss. A threshold fix against a load problem only buys headroom, and the headroom
  runs out. The tell that it was still load and not the code: a **docs-only commit** went
  red, and the *same sha* passed on the other twin. Fix the load, not the number.
- **[2026-07-29] When another open PR already fixes what you need, copy its diff verbatim.**
  PR #68 makes the identical `push: branches: [main]` change. Writing the fix byte-identical
  and *verifying it with a diff of both hunks* means the two merge cleanly in either order
  and whichever lands first makes the other a no-op. Independently inventing a better-worded
  equivalent would have manufactured a conflict for no gain.

- **[2026-07-30] `--delete-branch` on a stacked PR closes the PR above it, unrecoverably
  forward.** GitHub closes any PR whose base branch vanishes, and a closed PR's base is
  immutable — `gh pr edit --base main` returns *Cannot change the base branch of a closed
  pull request*. The only route back is pushing the deleted branch to the remote again, then
  reopen, then retarget. **Never `--delete-branch` while a dependent PR points at it.**
- **[2026-07-30] Retargeting a PR's base does not re-run CI, and GitHub still reports it
  `CLEAN`.** `gh pr edit --base` fires `pull_request: edited`, which is not a default trigger
  type, so #100 sat at `MERGEABLE/CLEAN` on two-day-old checks against a base it had never
  been tested on. `reopened` **is** a default type, so **close+reopen is the lever** that
  forces a real run. A `CLEAN` status is not a claim of freshness — always read
  `statusCheckRollup[].startedAt` against the base's own merge time.

- **[2026-07-30] An optimization whose failure mode is silence has to be obviously correct.**
  While fixing #102 I gated decoding behind `/[\\%]/` to skip binary assets. It silently dropped
  `decodeObfuscation`'s string-concatenation rule, which needs neither character — so
  `"not_" + "publishable"` stopped being reported. **I reintroduced #102's own failure mode inside
  its fix**, and only the negative-control table caught it. The pre-check was also only correct
  if this file correctly enumerated another module's triggers: a second coupled enumeration, in
  the commit whose whole point was deleting one. Measured cost of just not optimizing: 7ms vs
  2ms over the real artifact.

- **[2026-07-30] A chained `cd` persists through the whole command, and it reset the owner's
  working copy.** The Bash tool resets cwd between calls, so this loop compensates by writing
  `cd /Users/IA/Code/Government-watchdog-website && gh ...`. In iteration 6 a cleanup command
  chained `cd <owner clone> && gh push --delete ... && git fetch && git reset --hard origin/main`
  — the `gh` call needed the owner's clone, but the `reset` was meant for the **worktree**. It
  ran where the `cd` had put it. The owner's checkout jumped 97f23d8 → 5ad3eba and the 11
  previously-untracked `docs/product/` + `docs/prompts/` files were overwritten by #68's tracked
  versions. **Three iterations had explicitly refused to do this** ("surfaced, not executed —
  untracked files are unrecoverable once deleted"); a chained `cd` did it by accident.
  **Rule: never put a state-changing git command in the same chain as a `cd` to a different
  clone.** Run `gh` (repo-scoped, cwd only picks the remote) and `git` (cwd IS the target) in
  separate calls, and pass `-C <path>` explicitly to any `git` command that must not guess.
  Mitigating but not exculpating: iteration 3 had measured those 11 files — 3 identical, 8 older
  drafts with nothing worth keeping — and the clone was 22 commits behind and *unable to pull*
  because of exactly those files, so the accident left it current and unblocked. That is luck,
  not a justification.

- **[2026-07-31] The running page catches copy the suite is happy with.** #86 deleted the
  delivery toggles and every test passed — while the page still said *"changing delivery
  toggles only updates this browser"* about controls that no longer existed. Neither string
  had an exact-copy assertion, so the suite could not see it. **After deleting a UI
  affordance, read the rendered page for prose that describes it**, not just the tests.
- **[2026-07-31] Inner double quotes break a `-m` commit message in zsh.** A message
  containing `"expected <button …> to be null"` closed the outer quote and zsh tried to
  redirect from `button`. Use `git commit -F <file>` (heredoc) whenever the message quotes
  test output — same class as the `${b}` history-modifier gotcha already in CLAUDE.md.

- **[2026-07-31] The Vite dev server can serve a STALE module after a scripted write.**
  A live check showed the new slot absent while tests passed and the disk file was correct.
  `curl http://127.0.0.1:<port>/src/ui/<file>.ts | grep <new-symbol>` settles it in one call —
  0 means the server, not the code, is behind. Restart the preview server. **Browser
  verification is only evidence if the server is serving the code you just wrote.**
- **[2026-07-31] Assigning `location.hash` its current value fires no hashchange**, so the
  DOM stays on the previous render and a follow-up query reads stale state. This produced a
  contradictory pair (`advancedHome_upsell: true` alongside `advancedBriefingRendered:
  false`) that looked like a real AC violation. **Contradictory readings mean a broken
  measurement, not a surprising truth** — force a real reload before believing either half.

- **[2026-07-31] Advancing `current_area` without resetting the checklist is silent and
  invisible.** Iteration 11 changed the area and left build-guards' 16 entries in place, so
  iterations 11-13 recorded honesty-ledger work under a checklist whose every note described
  a different area. Nothing flagged it — the file stayed well-formed and plausible.
  **`current_area` and `current_area_checklist` must move together, always**, and the old
  area's state belongs in `parked_areas` rather than being overwritten or discarded.
- **[2026-07-31] A registry row is a claim that something exists — give it a status column.**
  #69's CS registry listed six unbuilt features; an audit found two with no marker. The table
  had no way to say "listed but not yet marked", so it silently implied full coverage.
  Added a `Marked?` column where `pending` must name its issue.
- **[2026-07-31] I copied a registry entry from an issue's prose and it was factually wrong.**
  "⌘K command palette" was listed as CS; the baseline actually designs a *search box with a
  ⌘K shortcut*, which the shell implements and explicitly disclaims as a palette. That
  phantom row put the ledger, the interaction inventory, and the code into a three-way
  conflict — and *this loop wrote the conflicting inventory row itself* one iteration
  earlier. **Verify each registry entry against the baseline and the code; an issue's prose
  is a claim, not a source.**

- **[2026-07-31] Measure coverage by mutation, not by grep.** Five honesty-ledger exports had
  zero direct references in `test/`; four were fully covered *behaviourally* through route and
  page tests that never import them by name (breaking them failed 7, 5, 47 and 1 tests).
  A reference count would have prompted four redundant tests. **Break it to a no-op and run
  the suite — that is what "is it tested?" actually means.**
- **[2026-07-31] When the coverage gap is dead code, delete it — do not test it.**
  `renderPrivateDefinedInfoNote` survived mutation with 980/980 green and had exactly one
  reference repo-wide: its own definition. A test there would have been a guard protecting
  something nothing uses. Deletion also orphaned a type import, which `tsc` flagged (TS6133)
  — a free confirmation that the export was genuinely unwired.

- **[2026-07-31] A vacuous sweep is the failure mode of any "check every X" test.** The CS
  inertness sweep loops over 11 routes x 2 lanes; if the selector ever stops matching, every
  assertion is skipped and the test passes while checking nothing. Fixed by counting matches
  and asserting `markersSeen > 0`. **Any loop-over-collection test needs a non-empty
  assertion, or it silently becomes decoration** — the same failure class as the
  `filterwarnings` guard that reported green with the defect present.
- **[2026-07-31] Binding a check means translating its INTENT, not its wording.** C7's
  `usability-enforcer` is written over "iOS pages". Of its eight scanners, one was n/a here
  (SQL vs schema, no SQL), one belonged to another check (plan alignment = C1b), and two
  collapsed into a single property worth enforcing on this product — a CS marker must be
  inert. **Translate scanner by scanner and say which ones do not apply and why**; a blanket
  n/a and a blanket port are both wrong.

- **[2026-07-31] A Q&A parked in an agent-facing file is not actually being asked.** `dev-qa.md`
  Q5 sat "pending" for two days while the owner never reads that file. Worse, its premise had
  **silently expired**: it assumed "the PR is the ratification" and merge authority moved to
  this loop the next day, so the thing landed unratified. **When a question needs the owner,
  put it in the owner's lane; and re-read a pending question's premise before counting it as
  still-open — the world may have moved under it.**
- **[2026-07-31] Correct a stale fact in the LIVE layer; never rewrite a dated log.** The
  "90 Swift files" claim (actually 15) appeared in `dev-qa.md`, memory, an iteration-4
  heartbeat entry, and a self-improvements record. Fixed the first two; left the last two
  alone and said so in memory. **A log is a record of what was believed then — rewriting it
  to match present knowledge destroys the reasoning trail that makes the log worth keeping.**

- **[2026-07-31] The "assert over the real list" lesson did not transfer on its own.** Iteration 3
  learned it in `check-public-bundle.mjs`; iteration 19 found the identical shape in
  `gov1569-gated-upload.test.ts` — an invariant defined over `PUBLICATION_ELIGIBLE_UI_STATUSES`
  but tested against one of its three members plus an invented value. **When a spec names a
  CONSTANT as the forbidden set, the test must import that constant**, or it proves nothing
  about the values added to it later.
- **[2026-07-31] `// @vitest-environment` only works in the file's FIRST comment block.** An
  import placed above it silently disables the environment, and a green run will not tell you
  — DOM-free assertions still pass while every DOM test in the file quietly loses jsdom. Tell
  by the run summary: a real jsdom setup shows a non-trivial `environment Nms`. Check it after
  touching the head of any test file.

- **[2026-07-31] I committed the hand-picked-list failure while criticising it.** Iteration 19
  flagged a test that proved an invariant over 1 of 3 constant members; iteration 20 found my
  own iteration-16 sweep covering **11 of 22 routes**, missing the route of the very area I had
  just entered. **A completeness guard must DERIVE its scope, never enumerate it** — the route
  list now comes from `main.ts`'s `router.register()` calls. And a derived scope needs its own
  guard: if the derivation returns nothing the sweep goes vacuous in a way the hardcoded
  version could not, so assert the derived count.
- **[2026-07-31] Read source in tests with Vite `?raw` / `import.meta.glob`, never `node:fs`.**
  This repo carries no `@types/node` on purpose, so `readFileSync` in a test breaks typecheck.
  The established pattern is `import src from '../src/x.ts?raw'` (see `gov658-fonts.test.ts`).
  I nearly reached for `readFileSync` on the strength of a half-remembered grep hit.

- **[2026-07-31] The graduation gate caught an omission I would have shipped.** Iteration 20
  did partial C8 work and never marked the check; iteration 21's graduation test reported
  `C8: pending` and refused the area. **A checklist is only worth having if you let it refuse
  you** — the temptation is to reason "I did some C8 work, close enough". Don't.
- **[2026-07-31] Same surface shape, opposite right answer — check WHY the constant is absent.**
  Iteration 19: a spec named `PUBLICATION_ELIGIBLE_UI_STATUSES`, so the test must import it.
  Iteration 21: `projectBackendReviewState` looks identical but there is deliberately **no**
  mirrored constant of the backend's internal `review_state`, because importing it would BE
  the leak the denylist prevents. A hand-picked hostile set is correct there. Before
  "fixing" an enumeration into a constant, ask whether the constant's absence is the design.
- **[2026-07-31] Check reachability before believing a hunt finding.** A probe throwing a
  TypeError and emitting scientific notation looked like two defects; both came from *my*
  inputs violating the type contract (`{}` with no `provenance`) or being physically
  impossible (`File.size` near 1e308). **A crash on input the type system forbids and the
  call sites cannot produce is a bad test, not a bug.**

- **[2026-07-31] I shipped a guard that could never fail, three times in a row, and only a
  VERIFIED red proof found it.** GOV-73's "provenance is never hidden" assertion was vacuous
  in three successive forms: (1) `block.slice(i - 400, i)` where `i` was 231 — a negative
  start makes `String.slice` count from the END, so the window was always `''` and
  `expect('').not.toContain(x)` always passes; (2) parsing rules with `([^{}]+)\{([^}]*)\}`
  — `[^}]*` does not exclude `{`, so the first match treats `@media print ` as the selector
  list and swallows the whole first rule; (3) only after stripping the at-rule wrapper did it
  fire. **Two compounding lessons: a red proof whose MUTATION silently no-ops proves nothing
  either — always assert the mutation applied (`assert old in s; assert s2 != s`) — and when
  an assertion refuses to fail, measure the value it is asserting on rather than reasoning
  about it.**
- **[2026-07-31] Backticks inside a CSS comment terminate the enclosing template literal.**
  Writing ``/* at <=760px `.gw-shell-tabs` is fixed */`` inside `SHELL_STYLE` produced five
  cryptic TS1005 errors. Style constants are template literals — no backticks in their
  comments, ever.

- **[2026-07-31] Run the A/B in the live DOM instead of arguing it.** For #88 I injected
  option B (wrap to rows) into the running page and measured the bar growing **45px → 133px**
  — 16% of a phone viewport. That number decided the choice in seconds and is now on the
  issue, so the owner can overrule with the real cost in front of them rather than my prose.
- **[2026-07-31] A correct technique can still be decorative — check it in the DEFAULT theme.**
  My scroll shadow used `rgba(0,0,0,.20)`: invisible on the dark theme's `#0D1218` bar, which
  is what ships by default. Tests passed, technique was right, affordance did not exist for
  most users. **A screenshot caught it; no assertion would have.** Use theme-adaptive tokens
  for anything whose job is to be *seen*.
- **[2026-07-31] Scope a style assertion to the RULE, never to the region.** `toContain` over
  a whole media-query tail passed with `overflow-x:auto` deleted from the tab bar, because
  `.gw-shell-actions` also declares it. Third vacuous assertion this session, all the same
  shape: too-wide a slice. Extract the specific rule body first.

- **[2026-07-31] Audit the RUNNING page, not the source, for accessibility.** The C7 sweep
  measured 77 live controls and found `.gw-shell-search-input` rendering 19px tall inside a
  46px row — invisible to any style-text check, because the *rule* looked fine and only the
  computed geometry was wrong. The row met the tap floor; the input did not, and it is not
  label-wrapped, so the padding focused nothing.
- **[2026-07-31] When a hunt reports a defect, verify the DETECTOR before believing it.**
  Second false positive of the session: my "unnamed control" check tested `aria-label`,
  `title` and text content but never looked for a `<label for>` — so it accused a correctly
  labelled input. Pair with the iteration-21 case where type-invalid probe inputs produced a
  phantom TypeError.
- **[2026-07-31] A token existing is not the same as a class using it.** Both accessibility
  floors (13px type, 44px tap) had tests asserting the TOKEN, and both shipped violated —
  an 11.5px banner and a 19px input. **Assert the usage, per class, or the guard is about
  the design system rather than the product.**

- **[2026-07-31] "Wire the missing test into CI" is sometimes the wrong fix — check what it
  DEPENDS on first.** #104's script hard-fails without a backend checkout at a hardcoded
  absolute path and without a **gitignored** DB that is a disclosure boundary on a public
  repo. On a self-hosted runner that is the owner's own machine it might have gone green —
  **because of untracked machine state**, which is worse than no job. Declined with the
  measurement and linked to the storage-bus work that would make it legitimate.
- **[2026-07-31] Check the real latest version instead of incrementing.** `actions/checkout`
  was on v4; the obvious guess was v5. Latest is **v7.0.1**. `gh api repos/OWNER/REPO/releases/latest`
  costs one call and would have left the repo two majors behind otherwise.
- **[2026-07-31] "Duplicated" is not the same as "wasteful".** #105 correctly identified three
  duplications; measurement showed only one was waste. The standalone typecheck buys fast-fail
  before an 11s suite, and the two inline ones keep each lane script independently safe.
  **Measure each duplicate's purpose before deleting it, and leave the measurement where the
  next person will look.**

- **[2026-07-31] An area can graduate with ZERO code changed, and that can be the right
  answer.** `gate`'s only issue is a P0 whose own closing line warns not to close it because
  browser tests pass. Triage showed 8 of 9 criteria are server-side by definition. The
  temptation was to build a client-side `revoke()` — it would have *looked* like progress on
  a release gate while changing nothing about the boundary. **When most of an issue is
  outside the repo, measure the part that is inside, record it as partial evidence, and
  refuse to half-build the rest.**
- **[2026-07-31] Verify that a documented posture is real, not aspirational.** CLAUDE.md says
  the client gate is scaffolding that fails open. C1b confirmed it by inspection: `access.ts`
  is pure and synchronous, references **no** civic records, stores no credential, touches no
  `localStorage`. A doc claiming a security posture is worth exactly as much as the check
  that it still matches the code.

- **[2026-07-31] A registry is audited by USING it, not by re-reading it.** Both phantom rows
  in the CS registry were found by working the issue that referenced them — never by
  re-reading the table, which I did several times without noticing either. **Schedule the
  audit as "work an item that cites this table", not "check the table".**
- **[2026-07-31] The tell for a misclassification can be inside the issue's own ACs.** #71
  was filed as CS but its acceptance criteria require the copy to *name the awaited
  contract* — which CS forbids. **When an issue's ACs contradict its stated class, the ACs
  usually describe the truth**, because they were written against the behaviour.
- **[2026-07-31] Scope a structural guard to the function, not the module — twice now.**
  The freshness clock-guard failed instantly over the whole of `shell.ts` because a
  *legitimate* clock read exists (`shell-local-date`, the reader's own date). Broadening
  would have banned correct code and been weaker. Same shape as the earlier
  region-vs-rule CSS assertion.

- **[2026-07-31] Do not let "deferred" launder "not started".** `data-contract` reached 16/17
  with only #70 left. Marking C11 `done` was available and would have produced a seventh
  graduation — but #70 is **agent-reachable work I chose not to begin**, not an owner gate
  like #49/#54/#104/#109. Blurring the two would make every other graduation mean less.
  Left `in_progress`; the area does not graduate. **A checklist is only worth the times it
  says no to you.**
- **[2026-07-31] Check an issue's stated blocker before honouring it.** #70 said "land after
  PR #57". #57 was **closed, never merged** — the blocker had been stale for weeks and the
  capability it described shipped by another route. One `gh pr view` settled it.
- **[2026-07-31] Two issues editing one file, neither citing the other, is invisible until
  someone looks.** #70 and #85 both restructure `pages-program.ts`. Checked they do not
  destroy each other, then recorded the cheaper order (#85 first, it deletes ~340 lines the
  other would have to migrate) on both. **When picking up an issue, grep the other open
  issues for its primary file.**

## Patterns

- **[2026-07-28] The MOTY backlog is a dependency fan, not a flat list.** Issues #69, #70,
  #75, #76, #80, #82–#87 all cite `src/ui/coming-soon.ts`, `timeline-lanes.ts`,
  `diff-view.ts`, or `docs/product/design-reference-inventory.md` — none of which exist on
  `main`. All of them are introduced by **open PR #68**. Until the owner merges #68, that
  entire P0/P1 block is unstartable, and any attempt to start it would either duplicate #68
  or create a guaranteed conflict. The genuinely open lanes on `main` are the ones #68 never
  touches: `scripts/` build guards, `deploy/`, `vite.config.ts`, `.github/workflows/`.
- **[2026-07-28] The repo has three near-identical names.** Always `git remote get-url origin`
  before any work. The website is `Government-watchdog-website`; the backend is
  `Government-watchdog` (same words, one letter's case apart).

## Per-area notes

### the loop itself
- **C3 has never run.** It invokes `/hunt-fix-loop`, which does not exist anywhere on disk
  (`hunt-fix.md` is the separate peer routine, not a callable body). Required for graduation.
  Issue #106 / `dev-qa.md` Q1.
- **C7 and C10 can never go green here** — specified over "iOS pages" and "iOS native ↔
  Tauri", and this repo has zero Tauri references. It *does* have `ios/GovWatchdogApp/`
  (**15** Swift files: 13 Sources, 2 Tests — corrected 2026-07-31 by count; iterations 4's
  heartbeat entry and `auto-go-self-improvements.md` still say 90 and are left alone on
  purpose, because those are dated records of what was believed then, not live knowledge)
  but that is a thin auth companion in no npm script. `dev-qa.md` Q2.
- **`auto-go.md` was generalized to multi-project on 2026-07-27; the SKILL.md bodies it
  dispatches to were not.** `plan-enforcer`, `usability-enforcer`, and `dev-pipeline-manager`
  still carry `Features/<area>/`, `swift build`, and "iOS page" verbatim.
- **Eight scheduled-task scanners are orphaned, and three lie about it** in their own
  frontmatter ("Wires into C8 dispatch" when the target never mentions them). Do not treat a
  scanner's self-description as evidence of coverage.

### build-guards
- `scripts/check-no-direct-exposure.mjs` is a *source-and-config* scan, not a bundle scan —
  it never reads `dist/`. `scripts/check-public-bundle.mjs` is the bundle scan. They are
  separate guards with separate blind spots; a finding in one is not covered by the other.
- The exposure guard's original design was deliberately narrow (two known loopback ports)
  so an unrelated number could not trip it. Generalizing it means *adding* rules beside that
  one, not loosening it — the port rule must keep its exact original behavior.
- **The two guards had a seam, not a hole.** Source scan skips `dist/`; bundle scan reads
  `dist/` only for private markers. Closed by giving the exposure guard an `--emitted <dir>`
  mode rather than adding a third script — both modes answer the same question from one rule
  vocabulary, and splitting them would let the definitions drift apart.
- **A production bundle is one line**, so the line-oriented `violationsIn` is useless on it;
  emitted scanning has to be whole-text with a windowed excerpt for reporting. That is the
  real reason `emittedViolationsIn` is a separate function and not a flag on the old one.
- **A byte-oriented read needs a byte-oriented needle.** Reading files as `latin1` (one byte,
  one char) and then searching for the marker's own JS string misses every marker with a
  non-ASCII character: `Workspace · Home · Alpine` is 25 chars in source, 27 bytes on disk.
  The needle must be `Buffer.from(marker, 'utf8').toString('latin1')`. Getting the read right
  and the needle wrong produces a guard that scans everything and finds nothing.
- **`Buffer` does not typecheck in `test/`, only in `scripts/`.** No `@types/node` means the
  `.mjs` guards may use `Buffer` freely (they are never typechecked) but a `.ts` test may not.
  Build the same latin1 string there with `TextEncoder` + `String.fromCharCode`.
- **Test the pure half only.** This repo carries no `@types/node` on purpose, so every guard
  is split pure-decision / filesystem-walk (`violationsIn`+`scanDirectExposure`,
  `privateSiblingLanes`+`privateSiblingArtifacts`, `emittedViolationsIn`+`scanEmittedArtifact`).
  Follow that split or the TypeScript suite cannot reach the new code.

- **Guards may now share a decoder.** `check-public-bundle.mjs` imports `decodeObfuscation`
  from `check-no-direct-exposure.mjs` (#102). This is deliberate: one definition of "obfuscated"
  for both guards rather than two that drift. It does **not** merge their scopes — source scan,
  emitted scan, and marker scan still answer different questions with different blind spots, and
  CLAUDE.md's "a finding in one is not covered by another" still holds.
- **`test/public-bundle-markers.test.ts` WAS binary to grep** (#112, 4 NUL bytes from #55's AC4
  tests) — **fixed 2026-07-30 (iteration 10)**: the raw NULs are now written as `\x00` source
  escapes, so the runtime strings are byte-identical and the file is plain UTF-8 on disk. The
  whole `test/` tree is greppable again; CLAUDE.md's `grep test/` step is honest without `-a`.

### gate
- Per GOV-SPA's 2026-07-28 adversarial sweep: the **client gate is UI scaffolding, not the
  confidentiality boundary**. `?gate=approved` and `?reviewer=1` intentionally fail *open*.
  Confidentiality rests on the server-side Sites custom-access worker. Do not "fix" the
  client bypasses as if they were the boundary; do not weaken the server-side assumption.

### ci-tooling
- **The CI runner is self-hosted and single-machine, and every PR push starts TWO concurrent
  full suites** (`on:` lists `push` and `pull_request` both on `["**"]`). Route-integration
  tests each `await import('../src/main')`, booting the whole 70-module app in jsdom —
  ~3.6s idle against Vitest's 5s default. Under the doubled load they time out
  non-deterministically. Signature: the same sha green on one twin, red on the other.
  Fixed by `testTimeout: 20_000` in `vite.config.ts` (#59 / PR #98). PR #68 independently
  removes the doubled trigger; the two fixes compose and neither replaces the other.
- **Before blaming your own branch for a red check, compare which commit went red.** Here
  the code commit passed twice and a markdown-only commit failed — that alone ruled the
  branch out in one look at `gh run list`.

### honesty-ledger
- GOV-SPA observed the app has **no literal COMING SOON label** — unbuilt-feature states and
  missing-data states are both rendered through the designed-gap mechanism, collapsing GS
  and DG into one affordance. Issue #69 is the fix, and it is blocked behind PR #68.

## About the owner

- *(nothing beyond CLAUDE.md recorded yet)*
