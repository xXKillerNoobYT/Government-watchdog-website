# Memory-authority runbook — Government Watchdog automation

**Owner:** AutomationOpsEngineer · **Reviewer:** VerificationSafetyReviewer ·
**Filed for:** GOV-2258 / website #250 (`[Scheduled Sync] stop active routine from writing
frozen Obsidian memory`).

This is a *versioned* automation contract. It states one rule, names the automation it
governs, gives the fail-closed replacement, and records how it is validated and rolled back.
It deliberately carries **no absolute filesystem paths** — this repository is public
(`test/no-user-specific-paths.test.ts`); the exact machine-local locators live on the
Paperclip issue thread, which is private.

---

## 1. The rule

The active shared-memory decision (2026-07-26), unsuperseded on the memory-destination
question, plus the scheduled-sync hard gate:

- **Notion is the SOLE current Government Watchdog memory destination.** Durable facts,
  project state, and cross-agent handoffs are written to the Agent Memory Hub in Notion.
- **The Obsidian vault is FROZEN — read-only history.** No active routine may **write,
  move, rename, quarantine, or conflict-copy** anything inside it. It may be *read* as
  supporting reference material.
- **Omi is never written by automation.** No `create`, `edit`, or `delete` of Omi memory
  from any scheduled routine.

A missing or ambiguous authority read does not relax this. If a routine cannot confirm the
current memory decision, it treats every frozen store as read-only and escalates — it does
not fall back to a legacy write path.

This rule governs **memory destinations only**. It changes nothing about the technical
release, access, provenance, and publication-safety gates: `BACKEND_REF` stays pinned, Stage
98 stays closed, the lane-exposure guards stay in force, and nothing outward-facing happens
without the owner.

---

## 2. What this runbook governs (the automation definitions it would replace)

The 2026-08-24 scheduled-sync audit found one active routine still carrying legacy
frozen-store write steps. Because the offending definition is a **machine-local, owner-
delegated** routine — not a file in this repository — this runbook does **not** silently
patch it. It supplies the compliant replacement and the enforcement; the live change is
applied only under §5.

| Definition (role-level; exact locator on the Paperclip issue) | Legacy step | Disposition |
|---|---|---|
| The machine-local **daily 24/7 backend routine**, per-beat sweep step | "Vault conflict sweep" — runs a conflict-copy quarantine script that *moves* byte-identical sync duplicates into a vault trash folder | Replace with the §3 read-only step; live edit is **owner-gated** (§5) |
| The AutomationOps **backup workflow** (`AUTOMATION_OPS_WORKFLOWS.md`) | Names an Obsidian "Paperclip-Backups" write target | Backups belong outside the frozen vault; re-point to a non-vault location under the same owner gate |

The Government Watchdog *repo* routine (`auto-go-gov-website`) was inspected and is already
compliant — it reads and writes Notion and touches no frozen store.

> **Measured, not assumed:** the conflict-copy script only *moves files that are
> byte-identical to a canonical twin* and merely *reports* differing or orphaned copies — it
> does not rewrite vault history. It is nonetheless a **move/quarantine mutation inside the
> frozen vault**, which this rule forbids. "Safe hygiene" is still a write.

---

## 3. The fail-closed replacement step

Any routine that wants visibility into vault sync-conflict junk uses a **report-only**
step, never a mutating one:

- Run the conflict scan in **read-only / dry-run** mode: it *reports* conflict copies,
  merge candidates, and orphans and **never moves, renames, or deletes** anything in the
  vault.
- Emit the report to the routine's own log / Notion, not into the vault.
- If a real mutation ever looks necessary (e.g. a genuinely lost canonical file), the
  routine **STOPS and escalates to the owner** with the report attached. It does not mutate
  the frozen store on its own authority.
- Omi is never written.

This preserves the one legitimate value of the old step — *knowing* the vault has sync junk
— while removing its authority to change frozen history.

---

## 4. Enforcement — the dry-run / no-write proof

`scripts/check-no-frozen-memory-writes.mjs` (unit-tested by
`test/gov2258-frozen-memory-guard.test.ts`, run in CI via `npm test`):

- **Default mode** — scans the *versioned* Government Watchdog automation surface (build /
  guard scripts, GitHub workflows, the `company-os` and `auto-go-*` runbooks) for any step
  that references a frozen store **and** a mutation verb without a read-only marker. Any hit
  fails the build (`npm run check:memory-authority`). The scan itself only reads — it can
  never mutate a frozen store, which is the "no-write" guarantee.
- **`--audit-local` mode** — additionally reads the machine-local scheduled-routine store
  and **reports** (does not fix) any live drift, so the owner can see exactly which routine
  still needs the §3 replacement. Report-only because those files are owner-owned.

**What the proof covers:** the versioned automation surface cannot ship a frozen-store write
step, and the detector demonstrably fires when one is (re)introduced (see the test's
synthetic reproduction of the audited sweep line). **What it does not cover:** it cannot, by
itself, edit the owner-owned live routine — that is §5.

---

## 5. Applying the live change — owner-gated

**A genuine conflict exists and must be resolved by the owner, not by an agent.** The
2026-07-26 freeze says the vault is read-only. *Later* owner delegations (2026-08-11 and
2026-08-25) hand "Mac vault + file syncs" and "the memory is 100% yours" to the backend
routine's operator, and that routine still lists the vault sweep as a standing duty. Whether
the delegated machine-hygiene sweep is exempt from the freeze, or must adopt the §3 read-only
form, is an **owner decision**.

Until the owner directs otherwise:

1. The versioned rule, replacement, and enforcement (this doc + the guard + the test) ship
   now — they are inside AutomationOps authority and touch nothing outward-facing.
2. The machine-local routine is **not edited** by this repo or this agent.
3. The decision is escalated to the owner (via CTO/CEO) with the exact locator and the §3
   replacement wording, so a single "yes" applies it.

**Rollback:** revert the PR. The guard is a pure read; removing it changes no data and no
frozen store. No live routine was mutated, so there is nothing to restore.

**Post-change verification (no publish / no deploy / no exposure):** run
`node scripts/check-no-frozen-memory-writes.mjs --audit-local`. Before the owner applies the
fix it lists the live drift; after the owner applies the §3 replacement it reports the
machine-local store clean. Neither run writes anything.

### 5.1 Resolution — owner-authorized and applied (2026-08-25)

The owner accepted the direction request (Paperclip GOV-2258 confirmation
`confirmation:GOV-2258:memory-authority-live-apply`): **adopt the §3 read-only/report-only
replacement and re-point AutomationOps backups off the vault.** With that "yes", the three
machine-local instruction surfaces were updated (locators live on the private Paperclip
thread, not here — this repo is public):

1. The daily 24/7 backend routine's per-beat sweep step now runs the conflict scan in its
   **default dry-run** mode, explicitly forbids `--apply`, emits the report to the run
   log / Notion, and **stops and escalates** rather than mutating the frozen vault.
2. **All three** AutomationOps instruction surfaces that named a backup destination now name
   the **non-vault** location; the frozen vault is retired as a backup write target. The
   re-point covers the backup-workflow playbook (`AUTOMATION_OPS_WORKFLOWS.md`), the agent
   domain sheet (`AGENTS.md`), **and** the company source-of-truth sheet (`COMPANY.md`). The
   last was missed in the first pass and re-pointed on VSR re-review — see the coverage note
   below for why the automated audit did not catch it.

**Verified after applying — two distinct checks, because two distinct surfaces changed:**

- *Scheduled-routine store (executable sweep step):*
  `node scripts/check-no-frozen-memory-writes.mjs --audit-local --strict-local` exits `0` —
  *no* machine-local scheduled routine carries a frozen-store write step.
- *Static instruction sheets (backup-destination declarations):* a direct sweep —
  `grep -rn "Paperclip-Backups" <instruction dir> | grep "Obsidian Vault" | grep -v retired`
  — returns **no match**: every remaining vault mention is an explicitly-retired annotation,
  not an active write target.

Both checks are pure reads; applying the fix published nothing, deployed nothing, changed no
visibility, and exposed no private memory.

> **Coverage note (why the first pass missed `COMPANY.md`).** `--audit-local` scans only the
> scheduled-routine `SKILL.md` store and fires only on a frozen-store reference paired with an
> explicit **mutation verb**. A *verb-less* destination line — `backups: <vault path>` in a
> static instruction sheet — is neither a `SKILL.md` file nor verb-bearing, so it escapes the
> audit by design. The audit's exit-0 therefore proves the executable routines are clean; it
> is **not** proof that the instruction sheets are clean. That second surface is covered by the
> `grep` sweep above, which is the check that must accompany any future backup-destination
> re-point.
