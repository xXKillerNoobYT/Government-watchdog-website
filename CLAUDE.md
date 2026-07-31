# CLAUDE.md — Government Watchdog website

Orientation for any agent starting cold in this repository. This file is deliberately
**thin**: it carries only what you need *before* you know where to look, then points at the
document that actually owns each rule. Where this file and a linked document disagree, the
linked document wins — say so in your PR rather than editing this file to match.

---

## 1. Which repo is this

```bash
git remote get-url origin   # must print xXKillerNoobYT/Government-watchdog-website
```

Run that before any work. **Three near-identical names exist** and they are different
codebases:

| Remote | What it is |
|---|---|
| `xXKillerNoobYT/Government-watchdog-website` | **This repo** — the private-beta website (Vite + TypeScript) |
| `xXKillerNoobYT/Government-watchdog` | The **backend** — same words, one letter's case apart. **Public.** |
| `Government-Watchdog` (local only) | A local-first tooling workspace with unrelated history |

Identify a repo by its remote, never by its directory name.

This repo also contains a small native companion app under `ios/GovWatchdogApp/`
(SwiftUI, its own `.xcodeproj` and test target). It is **not** wired into any npm script
and is not part of the web build. There is no Tauri target anywhere in this repo.

---

## 2. The binding contract — the rule that outranks everything

Every information slot on a reviewed page renders **exactly one** declared class:

| Code | Class | Meaning |
|---|---|---|
| **RV** | Reviewed value | An exact value from an admitted, web-safe reviewed response |
| **DG** | Designed gap | The slot stays visible and states which capability is unavailable |
| **DL** | Device-local | A browser-only preference; creates no account, coverage, or delivery |
| **GS** | Gated synthetic | Fixture data, only behind reviewer admission **and** an explicit fixture flag, under the `SYNTHETIC DESIGN FIXTURE — not a live read` notice |

> **Real value, designed slot, explicit gap.**

**No civic claim is ever invented** — not to fill a layout, not to make a screenshot look
finished, not "just for the fixture lane." A missing backend product changes the *content*
of a slot, not the *existence* of the slot.

`COMING SOON` marks an unbuilt **feature**. Gap copy marks missing civic **data**. They are
different states and must not collapse into one affordance.

**Owner of this rule:** [`docs/design-information-type-matrix.md`](docs/design-information-type-matrix.md)
— the per-page ledger binding the shell and all ten baseline pages to a class. Read it
before changing what any slot renders. Do not restate its table anywhere else.

---

## 3. Verify with all three commands, every time

```bash
npm test && npx tsc --noEmit && npm run build
```

Non-negotiable, and all three — a change can be green in one and broken in another. When
touching the build guards or either lane's output, also run `npm run build:all`, which
builds the public and private-beta lanes and runs the exposure and public-bundle guards on
each emitted artifact.

**The suite asserts exact user-visible copy.** `grep test/` before changing any string a
person can read; assertions like `.toBe('Saved view: Jackson, Wyoming')` are common
(`test/gov658-app-shell.test.ts`). Changing a string without grepping first will go red.
Every file under `test/` is plain text and greppable (#112 removed the last raw NUL bytes);
if that ever stops being true, a clean `grep test/` sweep is silently not a sweep.

---

## 4. Two lanes, and the guards between them

The public lane and the private-beta lane are built separately and must not leak into each
other. Four independent guards enforce this, all wired into `package.json` build scripts:

| Guard | What it answers |
|---|---|
| `scripts/check-no-direct-exposure.mjs` | Source/config scan: does anything name an off-origin destination? |
| `scripts/check-no-direct-exposure.mjs --emitted <dir>` | The same question against the **emitted artifact** — the resolved module graph, after Rollup rewrites |
| `scripts/check-public-bundle.mjs` | Does any emitted file carry a private marker? Reads **every** file as `latin1`, not a text-extension allow-list |
| `publicModuleBoundary()` in `vite.config.ts` | Rollup `moduleParsed` hook — fails the public build the moment a disallowed local module is pulled in |

These are defense-in-depth with deliberately different blind spots. **A finding in one is
not covered by another.** When a guard has a hole, prefer deleting the enumeration that
caused it over extending the enumeration.

Guards are split **pure-decision / filesystem-walk** on purpose: this repo carries no
`@types/node`, so `.mjs` guards may use `Buffer` freely (they are never typechecked) but a
`.ts` test may not. Test the pure half; build byte strings in tests with `TextEncoder` +
`String.fromCharCode`. Follow that split or the TypeScript suite cannot reach your code.

---

## 5. Branching and merging

- **Never commit to `main`.** Branch, push, open a PR.
- Automated-loop branches use `auto-go/<topic>`.
- New issues carry one `area:*` label (taxonomy created 2026-07-30, mirrors the ten
  heartbeat areas) plus `owner-decision` when blocked on the owner. Priority stays in the
  title (`[P2][Security] …`) — there are no priority labels.
- Stack a branch on an open PR only when the work genuinely depends on it; say so in the
  PR body, because stacks can only merge bottom-up.

**Merging.** The AUTO GO loop holds merge authority on this repo (granted by the owner
2026-07-29; it did not before). If you are not that loop, assume you do not — ask.

Whoever merges, the bar is the same: the full suite, `tsc --noEmit`, `npm run build`, and CI
all green, with the acceptance criteria mapped to tests. Never merge to clear a backlog,
never merge to make a red thing disappear, and never merge a PR you have not read.
**Merging is not deploying** — nothing outward-facing without the owner.

---

## 6. Hard stops

- **Never stub a fake backend response** outside the gated fixture lane. If a backend
  contract has not shipped, render a designed gap and file/annotate the blocking issue on
  the backend repo.
- **Never bump `BACKEND_REF`** (the pin in the repo-root `BACKEND_REF` file) while
  publication/immutability setup is recorded incomplete.
- **Never open Stage 98** (public release).
- **Nothing outward-facing without the owner** — no deploy, no publish, no send.
- **Never invent** a civic fact, source, vote count, date, or official's position.

---

## 7. Where things live

| Path | What it holds |
|---|---|
| `src/gate/` | Reviewer admission and access lanes |
| `src/ui/` | Shell, router, page renderers |
| `src/data/`, `src/types/` | Response contracts, `assertWebSafe`, reviewer-normalize |
| `src/fixtures/` | Gated synthetic data — never reachable from the public lane |
| `scripts/` | Build guards, artifact fetch, sites worker, local e2e |
| `test/` | Exact-copy assertions. Don't cite a file count here — it goes stale silently; `ls test/*.test.ts \| wc -l` is always right |
| `docs/` | Specs and contracts (see below) |
| `ios/GovWatchdogApp/` | Native companion app, separate from the web build |

Key documents: [`docs/design-information-type-matrix.md`](docs/design-information-type-matrix.md)
(binding ledger) · [`docs/public-private-asset-lanes.md`](docs/public-private-asset-lanes.md)
(lane separation) · [`docs/deployment-sites.md`](docs/deployment-sites.md) (hosting and the
server-side access boundary) · [`docs/ui-design-system.md`](docs/ui-design-system.md).

**Note:** the client-side gate (`?gate=approved`, `?reviewer=1`) is **UI scaffolding, not
the confidentiality boundary** — it intentionally fails open. Confidentiality rests on the
server-side Sites custom-access worker. Do not "fix" the client bypasses as if they were
the boundary, and do not weaken the server-side assumption.

---

*Maintained by the AUTO GO loop (`docs/auto-go-*.md`) and the owner. When
`docs/company-os/AGENT-RULEBOOK.md` lands, it becomes the authority on process and this
file should shrink to point at it rather than duplicate it.*
