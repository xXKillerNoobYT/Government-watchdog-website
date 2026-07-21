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

Force the full-app data state for review/screenshots: `#/app?state=loading|empty|error`
(see "Preview launch vs full app" below for how to reach the gated app).

### MOTY visual handoff preview

The owner-approved July 2026 design handoff is integrated as a reviewer-only,
tab-scoped preview. Start at:

`/#/agenda?reviewer=1&demo=design`

Normal shell navigation then keeps the design preview active for that browser
tab. Use `?demo=live` on a route to leave it. July 21 agenda content, placeholder
officials, coverage figures, alerts, and delivery settings are always labelled
`SYNTHETIC DESIGN FIXTURE — not a live read`; they are visual/interaction
examples, not reviewed civic facts.

The Timeline is intentionally hybrid: it keeps the existing reviewed-record
cards, trust/provenance labels, protected reveal behavior, and safe data adapter,
while adopting the handoff's denser header, search/filter bar, grouped layout,
and responsive visual language. It does not substitute a synthetic timeline for
the reviewed projection.

The frontend/backend boundary and required production endpoints are recorded in
[`docs/design-handoff-integration.md`](docs/design-handoff-integration.md).

## Preview launch vs full app (GOV-419)

The default entry is a **preview-launch landing**, not the app. The full
reviewer-internal app (timeline / cards / trust matrix) is revealed only past a
**gated-beta** entry (implements `GATED_BETA_ACCESS_WORKFLOW`). There is **no real
auth backend** in this slice — the gate is non-functional UI scaffolding.

**Default route**

| Surface | URL | What it shows |
|---|---|---|
| Preview-launch landing | `/` (or `#/`) | Neutral mission teaser + Alpine scope + "beta access is gated" messaging and a request-access affordance. **No civic data** — no timeline, cards, or source drawers pre-gate. |

**Gate states** — force any one for review/screenshots with `?gate=`:

| State | URL | Meaning |
|---|---|---|
| Not signed in | `#/?gate=anonymous` (default) | Request-access affordance shown. |
| Waitlisted / pending | `#/?gate=pending` | Request received, pending reviewer approval. |
| Denied / needs info | `#/?gate=denied` | Not approved yet — framed as capacity/process only; **says nothing about civic standing**. |
| Approved | `#/?gate=approved` | Approved; offers "Open the full app". |

**Reviewer bypass (local walkthrough — see the full app behind the gate)**

Isaac can see the full app locally WITHOUT shipping public access:

- Persistent: set `VITE_REVIEWER_BYPASS=true` in `.env`, then every full-app
  route opens (timeline `#/app`, cards `#/cards`, matrix `#/app?demo=matrix`).
- Per-URL: append `?reviewer=1` to any full-app route, e.g. **`#/app?reviewer=1`**.
  It is sticky for the browser session so in-app links keep working.

An explicit `?gate=` override still wins over the bypass, so a gated state can be
screenshotted even with the bypass on (e.g. `#/app?gate=pending`).

### Launch the whole system app (owner walkthrough — GOV-410 / GOV-415 / GOV-419)

`main` is the single canonical, runnable surface — no branch-picking needed.
After `npm install && npm run dev`, open `http://127.0.0.1:5173`. The landing
loads first; to walk the full app, use the reviewer bypass:

| Surface | URL (with bypass) | What it shows |
|---|---|---|
| Timeline | `/#/app?reviewer=1` | Reviewer-internal Alpine timeline over the real reviewed records, with trust / verification / correction labels and source drawers |
| Card feed | `/#/cards?reviewer=1` | The GOV-347 card-feed capture rendered as cards |
| Trust matrix | `/#/app?demo=matrix&reviewer=1` | One labeled card per record-level trust state (demo scaffolding, not real data) |

Every full-app surface carries the **`OFFLINE SAMPLE — not a live read`** banner and
keeps AI-produced rows under their own per-record label. This is reviewer-internal /
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
