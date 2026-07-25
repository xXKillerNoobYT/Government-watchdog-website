# Remaining work — ordered backlog of record

> Written 2026-07-24 (America/Denver). Supersedes the "Pending tasks" section of the
> session plan `~/.claude/plans/fluttering-weaving-sphinx.md`, which was written before
> the audit found the design zip was already vendored and before the campaign company
> existed.
>
> **Date convention:** Paperclip stores timestamps in UTC. Records created during this
> session read `2026-07-25T04:xx:xxZ`, which is `2026-07-24` evening Mountain. Bill flagged
> the apparent one-day skew; both readings are correct. Anywhere this document says a date
> without a zone, it means **America/Denver**.

---

## 0. Where things actually stand

### Website — branch `claude/gov-watchdog-design-audit-d686a9`
Six commits on top of `origin/main` (`bb415a3`). **626 tests / 45 files green**, `tsc --noEmit`
clean, `npm run build` succeeds.

| Commit | What landed |
|---|---|
| `8050699` | Adopted the untracked `docs/product/` + `docs/prompts/` specs |
| `6594378` | `coming-soon.ts`, `modal.ts`, `local-store.ts`, `--gw-radius-md` |
| `40f4395` | `kanban.ts`, `timeline-lanes.ts`, `diff-view.ts`, `debate-player.ts` |
| `10a1778` | `minmax(0,1fr)` grid fix adopted from PR #45 |
| `0e67580` | Eight-tab shell IA, header Alerts chip, ▶ Demo, `/explainer` |
| `d8bb3c6` | Gated synthetic Timeline fixture on the three-lane primitive |

### Paperclip — Government Watchdog company `bcac096e-…` (prefix `GOV`)
- B1–B6 of the original plan are done: permissions fixed, `MOTY_GOAL_ID` `2d9611c1-…`
  created, project goal links pruned 155→7 and 209→10, 11 operating goals re-levelled
  task→agent, GOV-1520 and GOV-1571 answered, GOV-1593/1594/1595 filed.
- 14 D&D-style class sheets written to each agent's `instructions/AGENTS.md`
  (16–24 KB each) referencing `docs/company-os/AGENT-RULEBOOK.md` and `stage-gates.md`.

### Paperclip — Isaac4Alpine company (new, created this session)
| Thing | ID |
|---|---|
| Company `Isaac4Alpine`, prefix `ISA` | `26683153-85d3-440a-a2e9-9ebc0b8f63c2` |
| Root goal — *ROOT — Isaac Aznoe for Mayor of Alpine* | `d5e0d63e-1f9d-4337-bcb7-53755568d816` |
| Project — *Isaac4Alpine Website* | `902f97ed-01f3-437f-bd33-d78dcbb221ac` |
| Agent — *Bill — Campaign Manager* | `5d5048b1-3d2c-43e1-843c-c87f96491539` |

Bill's agent record runs the **existing** `hermes -p bill` profile with cwd
`/Users/IA/Documents/Bill`, via `hermesCommand: /Users/IA/.local/bin/bill`. It is the same
Bill, not a second one. The GOV copies (project `5a2564df`, goal `746b65e6`) are `cancelled`
with descriptions pointing here.

**Deliberately left in GOV:** GOV-821, GOV-1596, GOV-806 (cross-meeting linking) and
GOV-1597 (liveness incident). The code pipeline is done; only ledger *data* authoring
remains, owned by BackendCrawlerEngineer with CTO on the writer and FTE on the renderer.
Isaac4Alpine has no engineering staff. Re-filing under Bill would strand nearly finished
work. They close under their GOV numbers; everything opened after 2026-07-24 goes to ISA.

---

## 1. Do these first (they unblock or de-risk everything else)

### 1.1 Split commit `d8bb3c6` — **defect, fix before the PR**
`d8bb3c6` is titled "gated synthetic Timeline fixture" but also carries 1,982 lines of
company-OS documentation that has nothing to do with the Timeline:

```
docs/company-os/AGENT-RULEBOOK.md      494 +
docs/company-os/beta-release-plan.md   728 +
docs/company-os/stage-gates.md         760 +
```

A reviewer reading that commit cannot tell what the Timeline change actually was. Rebase and
split into `docs: company operating system` and the Timeline commit proper. Do it before
anything is pushed — after the PR opens, this is a force-push instead of a rebase.

### 1.2 Finish landing the company-OS docs
`docs/company-os/project-descriptions.md` (39 KB) is still untracked; the authoring workflow
was writing it as of 22:58. Confirm the workflow finished, review the file, then commit it
with the split above.

### 1.3 File the 54 audit gaps as GitHub issues
The batched drafting workflow completed. **28 website + 26 backend** filing-ready bodies are
in `…/tasks/wn8g1vnch.output` (229 KB JSON, key `toFile[]`, each entry `{slug, repo, title,
labels, body}`).

Before filing:
- **Skip gaps my own commits already closed** — the eight-tab shell IA and the `/explainer`
  route were both drafted as open P0/P1 gaps and are now shipped (`0e67580`).
- Dedupe against the 15 existing website and 9+ backend issues.
- Website → `xXKillerNoobYT/Government-watchdog-website`, backend →
  `xXKillerNoobYT/Government-Watchdog`. **Both repos are live on GitHub and `gh` reaches
  both.** An earlier draft of this document said backend filing was blocked for want of a
  remote; that was wrong. The *local clone* at `/Users/IA/GitHub/Government-Watchdog` has no
  remote (§5.2 still applies to it), but the GitHub repo exists and is actively merging.
- **Re-dedupe against work that shipped 2026-07-24 evening before filing anything.** Four
  backend PRs merged during the authoring session and may close or shrink drafts:
  `#141` (B3, gated supplied-file intake API, fail-closed), `#139` (B4, linkage +
  gap-detection, closes `no_primary_source`), `#140` (B5, versioning + red-flag on supersede,
  both versions retained), `#142` (B6, web-safe supplied-file read projection — the sole
  Backend→Website crossing). Prime suspects among the drafts:
  `source-version-history-and-deterministic-diff`, `public-content-digest-and-vault-ledger`,
  `v1-view-api-envelope`. Version history shipping does **not** mean a deterministic diff
  shipped — check the diff, not the title.
- Skip website drafts this branch already closed: `timeline-lanes-primitive-wiring` and
  `timeline-issue-deeplink` both shipped in `cfbd9e6`. `explainer-route-and-demo-chip` is
  *partial* — the route and the ▶ Demo control shipped in `0e67580`, the Home widget link
  did not.
- File with `gh issue create` from the terminal, one at a time, capturing numbers.
  `gh issue create` **fails on an unknown label**, so confirm labels exist first.

---

## 2. Website — the remaining MOTY fidelity work

Every page below keeps the binding contract: each slot renders a **reviewed value**, an
explicit **designed gap**, or **gated synthetic** content behind reviewer access + the fixture
flag + the `SYNTHETIC DESIGN FIXTURE — not a live read` banner. `COMING SOON` marks an unbuilt
*feature*; designed-gap copy marks missing civic *data*. Never the reverse.

| # | Page | Work | Notes |
|---|---|---|---|
| 2.1 | **Home** `src/ui/home.ts` | Civic-weather restyle, fixture deep links, GS promise-conflict/verdict + language-watch tiles, lens teasers | `$25/yr` upsell → Coming Soon chip |
| 2.2 | **Fast Agenda** `src/ui/fast-agenda-design.ts` | NEXT MEETING board, full municode agenda, 17-card 7-column Issue Tracker, issue-card modal | **Wires `kanban.ts`**, which is currently built-but-unused. "Remind me" → Coming Soon |
| 2.3 | **Boards** `renderBoardsDirectory` | 18-body directory + detail pane | Add `/boards` to `SHELL_DESIGN_FIXTURE_ROUTES` or the origin banner lies |
| 2.4 | **Power Tracker** `design-pages.ts:729` | 10 placeholder officials, score donut, consent interstitial, vote-detail modal, quote ledger | Reviewed branch must keep `not.toMatch(/score\|verdict\|influence\|pledge/i)` |
| 2.5 | **Source Vault** | Stat chips, transparency alerts, version compare via `diff-view.ts`, vault ledger | PR #67 is now `OPEN`/`MERGEABLE` and its backend dependency (B6, backend `#142`) **merged 2026-07-24**. It adds a 5th `suppliedFiles` param to `renderSourceVault` — build on that contract, don't rewrite it. Rebase once #67 lands |
| 2.6 | **Newsletter** new `src/ui/newsletter-design.ts` | Issue No. 21, Roundtable via `debate-player.ts`, municode story with v1/v2 diff, 6-lens grid | |
| 2.7 | **Location** `design-pages.ts:1542` | USA/WY/town grids, lean colouring, selection ring | "fund your area" → Coming Soon |
| 2.8 | **Alerts + Watchlist** `design-pages.ts:2027/1182` | Severity cards, read persistence, consume `alerts-fixture.ts` | DELIVERY toggles → Coming Soon notes |

### 2.9 Cleanup commit
Delete the orphaned `pages-program.ts` `renderPowerTracker` / `renderWatchlist` /
`renderLocation`. **Do not delete `test/gov671-wave4-pages.test.ts` while PRs #57/#58 are
open** — that is a modify/delete conflict. Port its invariants into `design-pages.test.ts`
and leave a shim behind.

### 2.10 Final sweep + PR
Ledger roll-up, screenshots at 1440/768/390, build proof, push, open the PR.

### 2.11 Standing hazards
- Never write `expect(fetchMock).toHaveBeenCalledTimes(1)` — after #58 lands the shell fires
  a real `/api/notifications` fetch. Filter calls instead.
- Grep `test/` before changing any user-visible string; the suite asserts exact copy.

---

## 3. Paperclip company OS — finish what the workflow started

### 3.1 The other sheets in each agent folder ← **owner-flagged**
Each agent directory is `…/companies/bcac096e-…/agents/<id>/instructions/`, and `AGENTS.md`
is only one of thirteen sheets. The other twelve are **untouched from June** and were written
before the rulebook existed:

```
AGENTS.md  COMPANY.md  SOUL.md  TOOLS.md  HEARTBEAT.md  WORKFLOW_GOVERNANCE.md
CEO_STAGING_WORKFLOW.md  RISK_ASSESSMENT_WORKFLOW.md  STAGE0_EXECUTION_WORKFLOW.md
AI_GATEWAY_PROCESSING_WORKFLOW.md  BACKEND_FRONTEND_EVIDENCE_WORKFLOW.md
GATED_BETA_ACCESS_WORKFLOW.md   + one role sheet (CEO_WORKFLOWS, CTO_WORKFLOWS,
FRONTEND_TIMELINE_WORKFLOWS, BACKEND_CRAWLER_WORKFLOWS, UX_PRODUCT_WORKFLOWS,
NEWSLETTER_WORKFLOWS, SECURITY_PRIVACY_WORKFLOWS, VERIFICATION_SAFETY_WORKFLOWS,
SOURCE_ARCHIVIST_WORKFLOWS, AUTOMATION_OPS_WORKFLOWS, FOUNDING_ENGINEER_WORKFLOWS)
```

To do:
- **Reconcile, don't duplicate.** Read all twelve per agent and check them against the new
  `AGENTS.md`, `AGENT-RULEBOOK.md` and `stage-gates.md`. Anything that contradicts the
  rulebook is now a live conflict an agent will hit mid-task.
- **Point them at the rulebook.** The shared sheets predate it and cite no Prime Directives.
- **Fix the two starved agents.** `a6619a2d` (Hermes GW Assistant) and `ba93049f`
  (Reflection Coach) have **only** `AGENTS.md` — no `COMPANY.md`, `SOUL.md`, `TOOLS.md`,
  `HEARTBEAT.md`, or `WORKFLOW_GOVERNANCE.md`. They are running on a fraction of the context
  every other agent gets.
- **Verify nothing was destroyed.** All 14 `AGENTS.md` were rewritten 22:49–22:57 today. Confirm
  no prior content of value was overwritten; restore anything that was.

### 3.2 Apply the stage-gate spec
Entry/exit criteria, deterministic advancement rule, the 1–5 concurrency budget, the
regression rule, the dependency graph, and the Stage 98 checklist from `stage-gates.md` all
need to become actual Paperclip goal state, not just a document.

### 3.3 Apply the project descriptions
`project-descriptions.md` covers Website / Backend / Heart Beat / Isaac4Alpine.
**Owner reviews before these overwrite live project descriptions.** The Isaac4Alpine section
was authored before the campaign company existed and will need rewriting against §0 above.

### 3.4 Intake and planning pipeline
How a problem becomes an issue, gets triaged, gets an owner, and gets a stage.

### 3.5 Skills
Attach the role-appropriate skill matrix to all 14 agents via `agent skills:sync`.
**`skills:sync` is FULL-REPLACE** — read the current `entries[].key` list first, or you will
silently drop skills. Reflection Coach must keep its existing `reflection-coach` key.

---

## 4. Isaac4Alpine campaign — equip, do not execute

Isaac's scoping was explicit: *"the campaign thing is making sure paperclip does it right, not
that you have to do it."* Everything here is preparing instructions and structure. **No email
is drafted-and-sent, no resident is contacted, no list is modified.**

### 4.1 What Bill confirmed (answered via terminal, 2026-07-24)
His response is at `/Users/IA/Documents/Bill/CLAUDE_CODE_PAPERCLIP_HANDOFF_RESPONSE.md`.

- **Campaign domain is `isaac4alpine.com`.** `beside.com` is not a stale README typo —
  Beside is the campaign **phone / AI-receptionist service**. The `README.md:16` reference is
  still wrong *as a website reference* and should be corrected, but the underlying fact isn't
  what the handoff assumed.
- **Disclaimer to use:** `Paid for by Isaac Aznoe, Candidate for Mayor of Alpine`. Sourced
  from the campaign's own Wyoming reference (2026 WY SoS Campaign Guide, W.S. 22-25-102–115).
- **Postal address:** `PO Box 3252, Alpine, WY 83128` — the address published in the official
  Lincoln County municipal candidate listing. Confirm it is still current and Isaac-controlled
  before any send.
- **Signup path is the dedicated "Stay Informed" form** at `isaac4alpine.com/forms.html`,
  not the legacy Get Involved form.
- **Megan's 2026-06-24 record selected all six categories**, so it covers both lanes. Restate
  it in two-list format; **do not re-contact her to re-consent**.
- **The live form does not implement dual opt-in.** It offers six optional checkboxes, calls
  campaign updates something that "may be included", lets someone submit with no category at
  all, and never promises the two content types stay in separate sends.
- **The WY email question is open.** The campaign's reference covers newspaper, mailers,
  social ads, radio, and paid online placements — it does **not** say whether ordinary
  campaign email or a civic-only newsletter is a "campaign advertisement" requiring the state
  disclosure. Disclaiming every send is the conservative operating rule, not a settled answer.
  It also does not resolve unsubscribe timing, record retention, suppression, whether a
  civic-only newsletter is commercial or political, or whether Isaac has since formed a named
  committee (which would change the paid-for line to the committee name).

### 4.2 Still to do
- Rewrite the Isaac4Alpine section of `project-descriptions.md` against the real operation.
- Restate Megan's consent record in two-list format in `campaign/email-list.md`.
- Land a Wyoming election-law framework into `Bill/campaign/compliance/`, marking clearly
  which parts are verified and which need an election attorney.
- Rebuild the Stay Informed form as true dual opt-in: two named lists, two consent records,
  a stated promise that campaign and civic content never ship together, and a required choice.
- Draft the ≤3 email sequence — **drafted only, never sent**, each send individually approved.
- Correct `Bill/README.md:16`.
- Reconcile the campaign artifacts the company-OS workflow produced; they were authored
  before Bill's operation was discovered and read like a greenfield rebuild.

### 4.3 Owner decisions Isaac still owns
1. Confirm PO Box 3252 is current and Isaac-controlled.
2. Has a named campaign committee been formed? (Changes the paid-for line.)
3. Approve the dual opt-in checkbox wording once drafted.
4. Keep the Google-Form-backed signup, or move it on-site for a cleaner consent record?
5. Approve each email individually, at send time.

---

## 5. Hygiene, backups, memory bank

### 5.1 Website agent clone `/Users/IA/GitHub/Government-watchdog-website`
Push `GOV-658-design-tokens` and `GOV-658-pr-29` (unpushed at `3d6518a`) as an off-machine
backup. After the MOTY PR merges: `git fetch && git switch main && git merge --ff-only` —
**never `reset --hard`**. Rescue `stash@{0}` via `git stash branch rescue/pr-31-codex-wip`.
Wait for agents to be idle before touching their working directories.

### 5.2 Backend clone `/Users/IA/GitHub/Government-Watchdog` — **has no git remote**
`git bundle create ~/Backups/gov-watchdog-backend-$(date +%F).bundle --all` **first**; this
clone is the only copy. Then rescue the real untracked deliverables, delete the six 15-byte
goal-UUID junk files and `.DS_Store`, and gitignore `.playwright-mcp/`. Creating a private
GitHub remote is a board decision, and it gates §1.3's backend issue filing.

### 5.3 Obsidian vault memory bank
Write `2026-07-24-company-refresh-goals-skills-clones.md` recording every Paperclip change,
the campaign company migration with IDs, and the clone states. Append a design-of-record
section to the existing design-layout inventory note.

### 5.4 Parent-clone doc drift
`docs/product/` and `docs/prompts/` in `/Users/IA/Code/Government-watchdog-website` — 3 files
identical to what was committed, 8 drifting by 2–10 lines. Reconcile or delete.

---

## 6. Beta release

Not started. Detailed in `docs/company-os/beta-release-plan.md`.

- Public waitlist page + gated app; **Stage 98 stays CLOSED** until its checklist passes.
- Waitlist signup flow, backend `/v1/access-requests`.
- Beta-tester onboarding lifecycle.

The backend `/v1` transport and the deterministic diff / version-history layer dominate the
backend gap list, and they are what unblock most of the website's designed gaps. Sequence
them before the fidelity work that depends on real reads.

---

## 6.5. Pipeline tuning pass — *low priority, do after the beta ships*

A method Isaac has already used successfully elsewhere, recorded here verbatim in intent so it
can be run against this system when there is slack. **Not scheduled. Do not start it while
§1–§4 are open** — tuning a pipeline that is still changing shape wastes the pass.

### The principle
**The best optimization is deletion.** Before automating any step, first ask whether it needs
to exist at all.

> **Remove > merge > simplify > automate — in that order.**

Never add new tools, layers, or complexity in the name of automation. If a "speedup" makes the
system bigger or harder to understand, it is not less-is-more and we do not do it.

### The pass, run continuously in one sitting
1. **Map the full pipeline.** Every step start to finish, in order. For each: automated or
   manual, how long it takes, and *what breaks if it is removed*.
2. **Delete the waste.** Remove every step whose answer to "what breaks without it" is
   "nothing." Merge steps that always run together. Kill duplicate work — anything checked,
   generated, or processed twice.
3. **Close the gaps.** Find every pause, wait, and handoff delay. Classify each:
   - **Dead pauses** — waiting on nothing; a step simply does not trigger the next one.
     Eliminate, so each step auto-triggers its successor.
   - **Load-bearing pauses** — a check that actually catches errors before they spread.
     Keep, but make as fast and automatic as possible. **Never silently deleted.** If a check
     is removed, name it and say why removal was safe.
4. **Automate the manual.** Every remaining human-touch step: automate it if routine, or batch
   it into a single review point if it genuinely needs judgment. Target: runs start-to-finish
   on its own, with **at most one place a human looks at anything**.
5. **Prove it.** Run the streamlined pipeline end to end once. Confirm output quality is
   *unchanged* — same results, just faster and simpler. If anything degraded, restore the
   smallest thing that fixes it.

### Report format (short)
Steps before → steps after · what was deleted · what was automated · where the one human
touchpoint is · any check removed and why · the biggest remaining bottleneck not fixed.

### Where it would apply here
The candidate pipeline is: **audit gap → GitHub issue → Paperclip issue → agent checkout →
work → review → PR → merge → deploy**, plus the heartbeat/wake layer that moves issues between
those states. Known suspects going in, to be confirmed by the map rather than assumed:

- Gaps are currently written up **twice** — once as a GitHub issue, once as a Paperclip issue.
  That is duplicate work by the step-2 test unless one of them is load-bearing.
- Only the CEO has a timed heartbeat (12 h); every other agent is wake-on-demand. Any state
  transition that depends on the CEO waking is a **dead pause up to 12 hours long**.
- `GOV-1597` exists solely because `GOV-821` was blocked with nothing owning the next action —
  a liveness incident is evidence of a dead pause the system had to detect after the fact.
- Stage 5 is `active` with zero active sub-goals. A stage that cannot advance is a stall the
  gate logic should have caught at entry.
- Isaac is currently the review point for design, deploy go/no-go, campaign sends, and project
  descriptions. Step 4 says those should collapse toward **one** batched touchpoint — with the
  explicit carve-out that **per-send email approval is legally load-bearing and is never
  batched or automated** (see §4.1).

---

## 7. New since the original plan — needs planning, not just doing

These surfaced during execution and have no plan section yet:

1. **Instruction-sheet coherence** (§3.1). Thirteen sheets per agent, twelve of them
   pre-rulebook. Nobody has decided whether they get rewritten, deprecated, or folded into
   `AGENTS.md`. This is a design decision, not a chore.
2. **Two under-provisioned agents.** Hermes GW Assistant and Reflection Coach need the full
   sheet set — or an explicit decision that they don't.
3. **The Isaac4Alpine company has exactly one agent.** Bill cannot review his own work. If
   ISA is going to run real issues, it needs at least a reviewer, or an explicit cross-company
   arrangement where a GOV agent reviews campaign work.
4. **Campaign/product boundary in practice.** The campaign site is the product prototype, and
   GOV engineers are still building on it. The company split fixes the books; it does not
   answer who pays for engineering time spent on the campaign site. That needs a rule.
5. **Backend repo has no remote.** Everything downstream — issue filing, CI, agent PRs —
   assumes it does.
6. **PR collision management.** #45 adopted, #67 blocking Source Vault, #57/#58 blocking a
   test deletion, #47 touching `timelineSearchHash`. Needs a merge-order decision rather than
   per-page discovery.
7. **Wyoming email law is genuinely unresolved** (§4.1) and is the one item on this list that
   may need a licensed attorney rather than more research.
