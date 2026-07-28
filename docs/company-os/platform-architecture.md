# Platform architecture — the whole machine, both ends, all clients

> Written 2026-07-27 from Isaac's direction: the MOTY design working on **both** ends —
> the website showing it and the backend feeding it — plus the automation that makes it
> work "properly and cheaply," a control surface spanning several computers, apps, and a
> growth path sized for "huge, lots of users."
>
> Design of record: the vendored MOTY baseline (PR #39, sha256 `c2da1ae0…`) — re-confirmed
> byte-identical against Isaac's re-attached zip on 2026-07-27.
> Build spec of record: the 51 filed gap issues — website `#69–#93`, backend `#143–#168`.
> This document does not replace them; it is the frame they hang on.

---

## 1. The system in one picture

```
            COLLECTORS                    EVIDENCE STORE                 PROCESSING
  town portal ─┐                    ┌──────────────────────┐   ┌─ deterministic (code) ─┐
  county site ─┼─ fetch on change ─▶│ raw/<area>/… (SHA-256)│──▶│ parse · normalize ·    │
  state feeds ─┤   (hash-gated)     │ versioned, both kept  │   │ diff · dedupe · route  │
  YouTube/video┘                    └──────────────────────┘   └───────────┬────────────┘
                                                                           │ only what code
                                                                           │ cannot decide
                                    ┌──────────────────────┐   ┌───────────▼────────────┐
       CLIENTS                      │ REVIEWED PROJECTIONS │   │ AI LANES (context-fed) │
  website (all OS) ◀─┐              │  web-safe, fail-closed│◀──│ six-lens · language    │
  iOS (TestFlight) ◀─┼── /v1 API ◀──│  receipts attached   │   │ watch · roundtable ·   │
  Android (later)  ◀─┤              └──────────▲───────────┘   │ connections            │
  desktop control  ◀─┘                         │ human gate     └───────────▲────────────┘
                                        REVIEW (VSR)                CONTEXT PACKS
                                                                 (pre-loaded, versioned)
```

Everything on the left half already has filed backend issues (#143–#168). The two boxes
this plan adds are **context packs** and the **control plane**.

## 2. Cheap by construction — the cost ladder

Isaac's rule, made mechanical: *code can shortcut AI processing*. Every piece of work
descends this ladder and stops at the first rung that answers:

| Rung | Tool | Examples |
|---|---|---|
| 0 | **Nothing** | Source unchanged since last fetch (SHA-256 match) → no work exists |
| 1 | **Deterministic code** | Parse, normalize, field diff, dedupe, date/number extraction, format checks |
| 2 | **Cache** | Same content hash + same prompt version → reuse the stored answer, never re-ask |
| 3 | **Local model** | Ollama routing already seeded (backend GOV-789) — classification, tagging, first-pass summaries |
| 4 | **Hosted small model** | Structured extraction that local models fumble |
| 5 | **Frontier model** | Judgment: analysis lanes, connections, drafting for review |

Rungs 0–2 are free. The change-detection rung already exists (#154 scheduled re-fetch +
SHA-256 re-verify); the supersede pipeline (backend PRs #139–#142) means *only changed
sources generate downstream work at all*. Machine learning enters at rung 3 as
**embeddings first** — similarity, topic routing, "which issue does this agenda item
belong to" — before any custom training is considered. Training a model is a rung you
climb when embeddings measurably fail, not a starting point.

**Quality standards are code, not vibes:** every AI output lands with its receipts
(source anchors), its prompt version, its model id, and its context-pack version — so a
bad output is reproducible, attributable, and re-runnable. The RV/DG/GS binding contract
stays the floor: nothing synthetic ever presents as a civic record.

## 3. Pre-context loading — context packs

The "think projects" idea, concretely: an AI call never starts cold. A **context pack**
is a versioned bundle assembled by code (rung 1) before any model is invoked:

```
pack: alpine/annexation @ v14
├── area facts        (bodies, officials, meeting cadence — from the area spine #130)
├── issue thread      (every prior reviewed event on this issue, in order)
├── source excerpts   (the changed sections only, from the deterministic diff)
├── style + rules     (lens definitions, name-clearance policy #147, output schema)
└── manifest          (hashes of every input — the pack itself is content-addressed)
```

Packs are cached and shared across lanes: the six-lens run, the language watch, and the
newsletter draft for the same meeting all consume the *same* pack, so the expensive
context assembly happens once. A pack version changing is itself a signal ("the record
this analysis rested on has moved") that feeds the red-flag pipeline shipped in #140.

## 4. Control plane — settings, states, several computers

**Phase 1 (build now): the worker serves its own dashboard.** A local web UI on the
backend process — queue depth, per-source last-fetch/last-change, per-lane spend, error
list, settings file editing. A browser is the one UI every OS already has; this is the
less-is-more answer to "desktop app at minimum to control settings and see the states,"
and it works identically on Mac, Linux, and Windows the day it exists.

**Phase 2 (when phase 1 feels lived-in): wrap the same UI in Tauri** for a tray icon,
auto-start, and native packaging. Nothing is rebuilt — the wrapper points at the same
pages. We do not start with Electron/Tauri because a wrapper with nothing proven inside
it is scaffolding pretending to be product.

**Several computers — coordinator + workers:**

- One machine (this Mac, for now) runs the **coordinator**: the database, the job queue,
  and the dashboard.
- Any number of **workers** (Mac/Linux/Windows) connect over LAN or tailnet, take
  **work leases** (`fetch this source`, `transcribe this video`, `run lens pack X`),
  and report results with hashes. A lease that expires unfinished goes back in the queue —
  a worker dying loses nothing.
- Workers self-describe capability (`has-ollama`, `has-ffmpeg`, `gpu`), so transcription
  lands on the machine that can do it.
- SQLite remains the store until there is more than one *writer*; workers write results
  through the coordinator's API, not the file, so SQLite survives multi-machine phase 1.

## 5. Storage — where the data lives and how it moves

Created 2026-07-27 at Isaac's named path
`~/Library/CloudStorage/OneDrive-Personal/Desktop/Govermint wachDog Storage File for Now`:

```
raw/{alpine,lincoln-county,wyoming}/   immutable originals, content-addressed
derived/                               reproducible — safe to delete, code regenerates it
backups/db/                            dated SQLite backups copied IN
backups/repo-bundles/                  git bundles of remoteless repos
```

A read-only OneDrive share link for the whole folder exists (recorded in the folder's
README and the "Evidence Storage" page in the Government Watchdog Notion teamspace) so any
machine can inspect and verify content without a write path.

Two rules enforced by the README that ships in the folder: **the live SQLite database
never sits inside OneDrive** (sync + SQLite = corruption; the DB lives on local disk and
only dated backups land here), and **raw files are immutable** (a change is a new file
through the supersede pipeline, both versions retained).

Why this shape scales: `raw/<area>/` maps one-to-one onto object-storage prefixes, and
every file's SHA-256 is already in the database — so the future migration (bigger disk,
S3-compatible store, another machine) is a *verifiable copy*, per area, not a leap.
Disk note: this Mac has ~96 GB free; video is the item that will consume it. Transcribe-
then-archive (keep audio + transcript hot, park video in OneDrive) is the standing rule.

## 6. Hosting — every OS, both surfaces

- **Website:** a static Vite build. Any static file server on any OS serves it; the
  repo documents one command per OS (`npx serve dist`, `python -m http.server`, Caddy).
  The public gated path via Fly.io (GOV-1544) is unchanged — that is the *public* lane,
  local serving is the *operator* lane.
- **Backend:** Python 3.12, no OS-specific dependencies permitted in the worker path
  (the one current exception, video tooling, is capability-gated per §4 so a machine
  without ffmpeg simply never takes those leases).
- **The rule that keeps this true:** CI runs the website build and the backend test
  suite on all three OS runners before a release tag. Six self-hosted runners already
  exist; add a Windows and a Linux runner when available, GitHub-hosted until then.

## 7. Apps

- **iOS** — already in flight (GOV-1523 chain: scaffold PR #44, on-device auth PR #56,
  TestFlight-only gated beta per GOV-1530). It consumes the same `/v1` contracts the
  website consumes (#143 envelope, #166 session); nothing app-specific is invented
  server-side.
- **Android** — after iOS reaches TestFlight stability. Decision deferred on purpose:
  by then the `/v1` surface is real, and the choice (Kotlin native vs a thin shell over
  the website) can be made against a working API instead of a guess.
- **Desktop control app** — §4 phase 2, the Tauri wrapper. Not a fourth codebase.

One principle across all clients: **clients render reviewed projections; they never
compute civic claims.** A client is thin or it is wrong.

## 8. Scale and growth — ready to move

| Stage | Where | What changes |
|---|---|---|
| Alpine (now) | this Mac | nothing — current shape |
| + Lincoln County | this Mac | second area on the spine; storage `raw/lincoln-county/` already exists |
| + Wyoming | this Mac | scheduled-fetch volume rises; workers optional |
| Growth trigger | — | any of: >1 writer needed, disk pressure, public traffic beyond static |
| Beyond | server(s) | SQLite→Postgres (schema already relational), raw/→object store (hash-verified copy), coordinator moves, workers multiply, website build unchanged |

The migration is cheap **because** of decisions already made: the area spine (#130) keys
every record to a jurisdiction, content-addressing makes every copy verifiable, and the
`/v1` envelope (#143) means clients never notice the store behind it changed. "Ready to
move and grow, transferring the data as things grow" is a property of those three
decisions, not a future project.

## 9. What this adds to the filed backlog

The 51 issues stand. This plan implies **new** backend issues (to file after Isaac
reads this): collector framework + per-source adapters; scheduler (exists partially,
#154) wired to the cost ladder; context-pack builder + cache; work-lease queue + worker
protocol; coordinator dashboard (phase-1 control plane); prompt/model/pack version
stamping on every AI output; OS-matrix CI. And one website issue: an operator page is
NOT added to the public app — the dashboard lives with the backend, keeping the public
bundle clean.

## 10. Decisions that are Isaac's

1. **Approve this plan's shape** — especially dashboard-first over desktop-app-first (§4).
2. **Video retention** — park in OneDrive after transcription, or keep hot locally (§5).
3. **Windows/Linux runners** — self-hosted machines available, or GitHub-hosted for now (§6).
4. **Android timing** — after iOS TestFlight stability, or sooner (§7).
5. **The growth trigger** — agree the three conditions in §8, so scaling is a checklist
   hit, not a debate.
