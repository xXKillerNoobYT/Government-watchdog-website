# Government Watchdog Website

Private frontend website project for Government Watchdog.

## Role

This repository is the **frontend** for Government Watchdog:

- homepage timeline
- Wyoming → county → town filters
- topic timeline pages
- meeting pages
- source drawers
- newsletter views
- AI/verified/unverified/corrected visual states
- gated/blurred AI-presented or unverified content blocks
- public audit trail presentation

## Backend

Backend/core/crawler/API repository:

- https://github.com/xXKillerNoobYT/Government-watchdog

## Starting scope

Start with **Town of Alpine** as the first walkthrough/prototype.

The product should be designed to scale:

1. Town of Alpine
2. Wyoming towns/counties/statewide
3. Potentially all United States jurisdictions if the model works well

## Source of truth

Planning source of truth currently lives in the Obsidian vault:

`/Users/IA/Documents/Obsidian Vault/01_projects/Government-Watchdog/Docs/`

Important setup note:

`2026-06-06-Paperclip-Company-Setup-Summary.md`

## Privacy / launch status

This repository is private for now.

---

## Local development (Stage 1 · Slice 4 · A skeleton — GOV-99)

Reviewer-internal/local only. **No public exposure**, no deploy, no accounts —
Alpine-only (GOV-94 owner conditions). The current skeleton is intentionally
**neutral, with no visual-style commitments**; Isaac's design direction refines
visuals in a later slice.

```bash
npm install            # first time
cp .env.example .env   # optional; defaults to fixture mode
npm run dev            # vite dev server at http://127.0.0.1:5173
npm run typecheck      # tsc --noEmit
npm test               # vitest (web-safe, adapter, state, render)
npm run build          # tsc + vite production build
npm run preview        # serve the production build locally
```

Force a state for review/screenshots: `#/?state=loading|empty|error`.

### Launch the whole system app (owner walkthrough — GOV-410 / GOV-415)

`main` is the single canonical, runnable surface — no branch-picking needed.
After `npm install && npm run dev`, open `http://127.0.0.1:5173` and visit:

| Surface | URL | What it shows |
|---|---|---|
| Timeline | `/` | Reviewer-internal Alpine timeline over the real reviewed records, with trust / verification / correction labels and source drawers |
| Card feed | `/#/cards` | The GOV-347 card-feed capture rendered as cards |
| Trust matrix | `/#/?demo=matrix` | One labeled card per record-level trust state (demo scaffolding, not real data) |

Every surface carries the **`OFFLINE SAMPLE — not a live read`** banner and keeps
AI-produced rows under their own per-record label. This is reviewer-internal /
fixture-only: **no public exposure, no live read, Alpine-only** (GOV-94 owner
condition). The frontend never recomputes trust — labels are consumed verbatim
from the backend read-API (see the two hard invariants below).

### Stack

Vite + TypeScript, framework-agnostic DOM rendering (a heavy UI framework would
be a visual/architectural commitment Isaac may want to weigh in on later).

### What this skeleton provides

| Piece | File |
|---|---|
| Web-safe types mirroring the read-API allowlist (statement/evidence, agenda-thread, topic-tree, label layer) | `src/types/read-api.ts` |
| Typed data-access client: read-API → labeled-fixture fallback | `src/data/client.ts` |
| Frontend raw-path transport sweep (defense-in-depth) | `src/data/web-safe.ts` |
| Loading / empty / error state primitives (BEH-STATE) | `src/state/async-state.ts`, `src/ui/state-view.ts` |
| Labeled fixture (`FIXTURE MODE — Not real data`, historical/sample only) | `src/fixtures/alpine-sample.json` |
| Neutral DOM renderer + minimal styling | `src/ui/render.ts` |
| Hash-router shell | `src/router.ts` |

### Data contract & two hard invariants

The client reads **only** the reviewer-internal read-API (backend
[GOV-98](https://github.com/xXKillerNoobYT/Government-watchdog), spec
`Docs/stage1-slice4-prereq0-read-api-concept-map.md`) or the labeled fixture.

1. **No raw-path / private fields exist in the type surface.** Types mirror the
   backend allowlist only; `assertWebSafe` re-sweeps every payload (live or
   fixture) and fails loud on a vault/absolute path or forbidden key.
2. **The frontend never recomputes trust.** `ui_status` / `verification_status`
   / `correction_status` / `produced_by` are produced fail-closed by the backend
   and consumed verbatim. Any need to recompute publication state on the client
   is a pass-up trigger → escalate to CTO/CEO/Isaac.

`test/read-api-sample.json` is a real `read_api.build_response(...)` capture used
by the adapter test.
