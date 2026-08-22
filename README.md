# Government Watchdog Website

Frontend website project for Government Watchdog. It contains separate Anonymous
Free and private/reviewer artifacts. The deployed Alpine beta was observed publicly
accessible on 2026-08-11 while still serving the private client, so the live release
remains blocked.

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

`~/Documents/Obsidian Vault/01_projects/Government-Watchdog/Docs/`

Important setup note:

`2026-06-06-Paperclip-Company-Setup-Summary.md`

## Baseline design and deployment status

The owner-approved MOTY July 2026 handoff is the product's visual baseline,
especially for layout, spacing, information density, shared tooling, and the
Simple/Advanced skins. The immutable source archive and extracted reference
files are preserved in
[`design/baseline/moty-government-watchdog-2026-07/`](design/baseline/moty-government-watchdog-2026-07/README.md).
Its prototype behavior is illustrative; production behavior still follows the
safe frontend/backend contracts.

The Alpine Sites beta is deployed at
[`alpine-government-watchdog-beta.weirdtoocompany.chatgpt.site`](https://alpine-government-watchdog-beta.weirdtoocompany.chatgpt.site/)
and was observed with public access on 2026-08-11 while live v9 still served
the private client. That mismatch is a blocked incident, not a public launch.
The default build now fails closed to the Anonymous Free artifact; exact access,
release, rollback, and remaining product gates are recorded in
[`docs/deployment-sites.md`](docs/deployment-sites.md).

A future hosted private beta requires Sites custom access as the static root and
asset boundary. The server worker separately checks the managed reviewer
allowlist only on requests Sites dispatches through it; current public-provider
behavior proves that check is not a static-asset boundary by itself. The
email-address/magic-link panel remains development scaffolding, not hosted login.

The minimum standard for any civic content shown in the beta is recorded in
[`docs/content-quality-baseline.md`](docs/content-quality-baseline.md). Evidence,
review state, AI disclosure, freshness, corrections, accessibility, and access
eligibility are release gates; visual polish cannot substitute for them.

---

## Local development

The app is Alpine-first while backend authorization and the public projection
are completed. It now has an isolated Anonymous Free artifact plus the existing
private-beta artifact. The MOTY baseline defines the visual direction; fixture
behavior remains explicitly separated from reviewed data.

```bash
npm install            # first time
cp .env.example .env   # optional; defaults to fixture mode
npm run dev            # vite dev server at http://127.0.0.1:5173
npm run typecheck      # tsc --noEmit
npm test               # vitest (web-safe, adapter, state, render)
npm run build          # Sites-shaped artifact containing only Anonymous Free
npm run build:public   # Anonymous Free artifact + compiled-asset safety scan
npm run build:private-beta # explicit reviewer artifact; never deploy while Sites is public
npm run build:all      # build and verify both isolated browser lanes
npm run preview        # serve the production build locally
```

Private-runtime integration is deliberately local-only while backend issue
#291 is open. `npm run build:integrated` requires
`BACKEND_REF=local:/absolute/backend/checkout`; commit/tag refs fail before any
GitHub Release download. The default `npm run build` remains the independent,
civic-data-empty Sites public-free package and does not fetch a backend artifact.
The private Dockerfile has no landing-only fallback: it fails until a protected
private artifact channel can be verified. Use the default Sites build for the
artifact-free public shell.

The lane boundary and its asset-level acceptance check are documented in
[`docs/public-private-asset-lanes.md`](docs/public-private-asset-lanes.md).
Simple/Advanced remains a reading-layout preference; it cannot switch the build
lane, plan, account entitlement, geographic grant, or public coverage state.

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

The original handoff is preserved as immutable baseline source in
[`design/baseline/moty-government-watchdog-2026-07/`](design/baseline/moty-government-watchdog-2026-07/README.md).

The Timeline is intentionally hybrid: it keeps the existing reviewed-record
cards, trust/provenance labels, protected reveal behavior, and safe data adapter,
while adopting the handoff's denser header, search/filter bar, grouped layout,
and responsive visual language. It does not substitute a synthetic timeline for
the reviewed projection.

The frontend/backend boundary and required production endpoints are recorded in
[`docs/design-handoff-integration.md`](docs/design-handoff-integration.md).

## Preview launch vs full app (GOV-419)

For local development, the default entry is a **preview-launch landing**, not
the app. The full reviewer-internal app is revealed only past a **gated-beta**
entry. The landing's magic-link form is non-functional UI scaffolding. On the
hosted beta, Sites custom access provides the real authentication boundary. On
the exact owner-only production host, the private-beta build opens Home without
going through the duplicate form; the server worker retains an additional
allowlist check for requests dispatched through it.

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

Every gated full-app surface carries an explicit **`REVIEWED SNAPSHOT`** or
**`SYNTHETIC DESIGN FIXTURE`** origin banner and keeps AI-produced rows under
their own per-record label. This remains reviewer-internal: **no public exposure,
no live read, Alpine-only**. The frontend never recomputes trust — labels are
consumed verbatim from the backend read-API (see the two hard invariants below).

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

## Licensing

This repository is proprietary and private. All rights reserved. See [LICENSE](LICENSE) for terms; no use, copying, or distribution is permitted without the owner's prior written permission.
