# GOV-1568 · F0 — Upload UX spec (gated intake surface)

**Status:** design spec · **Owner:** UXProductDesigner · **Parent:** GOV-1566 ·
**Feeds:** F1 (Gated upload UI, FrontendTimelineEngineer) · **Merges by:** CTO

This spec defines the **gated file-intake surface** and its **honest review-state
display**. It is implementation-ready for F1. It invents no new visual system:
every state reuses an existing, shipped pattern (gate panels, source drawer,
verbatim trust labels). Where this spec and the code disagree, the code
(`src/gate/access.ts`, `src/ui/statement-presenter.ts`, `src/types/read-api.ts`)
is authoritative and F1 must escalate rather than diverge.

---

## 0. Principles carried from the parent plan (non-negotiable)

From GOV-1566 §plan: **fail-closed & private-by-default; review-before-AI and
review-before-display; preserve versions; provenance mandatory; web-safe
transport only.** For the *upload surface* specifically, that reduces to four
copy/behaviour laws the whole surface obeys:

1. **Gate-first.** The intake form does not exist for anyone who is not in the
   authorized cohort. Non-authorized states render **zero** upload affordance and
   **zero** file content — same rule the beta gate already enforces for civic data
   (`access.ts`: "Every non-`approved` state renders ZERO civic data").
2. **Never imply verification before review.** A just-uploaded file is `received`
   → `review_pending`. It is **never** shown as verified, source-backed,
   published, or "in Government Watchdog" as fact. (§4, §5.)
3. **Honest placeholder, no content echo.** A pending/held file shows a
   *"review pending"* placeholder with **no rendered content, no AI summary, no
   extracted claims** — because review-before-display means there is nothing
   trustworthy to show yet.
4. **Web-safe transport only.** The surface never displays, and the wire never
   carries, a raw path, local note, hash, reviewer note, or the internal
   `review_state` value. These are on the forbidden-keys denylist
   (`read-api.ts:17-20`). The uploader sees a *projected* status, never the
   internal one. (§6.)

---

## 1. Reused patterns (the AC's "reference existing patterns")

| Concern | Existing pattern this spec reuses | File |
|---|---|---|
| Who may see the surface | 6-state `AccessState` gate + pure `resolveAccess()` + `?gate=` screenshot override + `SCAFFOLDING_NOTE` | `src/gate/access.ts` |
| Gate copy that never implies standing | `gatePanelContent()` denial/revoked copy ("does not reflect anything about you, your community, or your standing") | `src/gate/access.ts:128-155` |
| Honest, never-recomputed status labels | `verificationStatusLabel()` / `confidenceLabel` — verbatim 1:1 mapping, frontend never derives trust | `src/ui/statement-presenter.ts:96-116` |
| "Not verified yet" already modelled | `pending-review` ∈ `UiStatus` but **∉** `PUBLICATION_ELIGIBLE_UI_STATUSES` | `src/types/read-api.ts:40,55,64-69` |
| Provenance shown, raw locators stripped | source drawer field list has **no** reviewer-note/raw-path accessor; `assertWebSafe` / `RAW_PATH_FORBIDDEN_KEYS` | `src/ui/statement-presenter.ts:7-14`, `src/data/web-safe.ts` |

**F1 rule:** import `AccessState`, `resolveAccess`, `isApproved`, and the gate
panel copy from `src/gate/access.ts`. Do **not** fork a second gate. The upload
surface is a new *body* rendered only when the existing gate resolves to the
authorized state; the gated-out body is the existing gate panel unchanged.

---

## 2. Authorized cohort — who gets the form

The upload surface is **authorized-cohort-only**. Reuse the beta gate's approved
lane as the authorization signal; there is **no separate uploader allowlist UI**
in this slice.

- **Authorized (`approved`)** → the intake surface renders (states in §3–§5).
- **Every other `AccessState`** (`anonymous`, `waitlisted`, `pending`, `denied`,
  `revoked`) → render the **existing gate panel verbatim** (`gatePanelContent`)
  with **no upload form, no dropzone, no file list**. This is the *gated-out*
  state (§3.0).
- Screenshot/review override: honor the existing `?gate=` param so every state,
  including gated-out, is capturable exactly as the gate states are today.

> Backend note for F1 wiring (from B3 "gated intake API, fail-closed"): the
> client gate is **UX only**. The intake API must independently reject
> unauthorized uploads server-side — the front-end gate is never the security
> boundary. Mirror the `SCAFFOLDING_NOTE` honesty: if the real intake backend is
> not yet wired at F1 build time, the form is labelled non-functional scaffolding,
> exactly as the beta gate labels itself today.

---

## 3. State catalogue

The surface is a small state machine. Exactly one state is visible at a time. All
six required states are covered: **gated-out, upload form, validating,
in-progress, success = pending-review, error.**

### 3.0 Gated-out  (`unauthorized`)
- **Trigger:** `resolveAccess(...) !== 'approved'`.
- **Render:** existing gate panel for the resolved state. **No** intake affordance.
- **Copy:** unchanged from `gatePanelContent`. Never implies the person's civic
  standing or that withholding the form is a judgement about them.
- **Test id:** `upload-gated-out` on the wrapper (in addition to the gate panel's
  own ids).

### 3.1 Upload form  (`idle`)
- **Trigger:** authorized **and** no upload in flight.
- **Render:** heading, one-line honest purpose, dropzone / file picker, an
  explicit **constraints line** (accepted types, max size — values owned by B3),
  and a **pre-submission honesty note** (§5, copy rule C1). Submit disabled until
  at least one valid file is staged.
- **Provenance capture:** the form collects the mandatory provenance the plan
  requires (where the file came from / what it is). Provenance is **required** to
  submit — mirror "provenance mandatory". Exact fields owned by B2's record model;
  F0 mandates the field exists and is required, not its schema.
- **Test id:** `upload-form`.

### 3.2 Validating  (`validating`) — client-side, pre-transfer
- **Trigger:** user staged a file / pressed submit; client checks run before any
  bytes leave the browser.
- **Render:** inline, per-field validation. Errors are **specific and
  actionable** (wrong type, too large, missing provenance) — never a bare "invalid".
- **Does NOT** claim anything about the file's truth or content; validation is
  purely mechanical (format/size/required-fields).
- **Failure → error sub-state** (§3.6) rendered inline on the form (form stays,
  file not sent). **Pass → in-progress.**
- **Test id:** `upload-validating`; each error `upload-error-<field>`.

### 3.3 In-progress  (`uploading`)
- **Trigger:** validation passed; bytes transferring to the intake API.
- **Render:** progress affordance (indeterminate is acceptable), a **cancel**
  control, and a status line: *"Uploading… don't close this tab."* Form inputs
  disabled/locked to prevent double-submit.
- **Honesty:** progress describes **transfer only**. It must not say "processing",
  "analyzing", "verifying", or anything implying review/AI has begun. (Copy rule C2.)
- **Interrupt:** cancel or network failure → **error** (§3.6) with a retry path;
  no partial file is presented as saved.
- **Test id:** `upload-inprogress`.

### 3.4 Success = **pending review**  (`received`)  ← the load-bearing state
- **Trigger:** intake API accepted the file (bytes stored in the raw-preservation
  store, B1).
- **This is a *receipt*, NOT a verification.** Success means **"we received it and
  it's queued for review"** — nothing more.
- **Render:**
  - Confirmation heading: *"Received — queued for review."*
  - An **honest review-state chip**: `Review pending` (§6 vocabulary), styled like
    the *not-yet-trusted* end of the trust legend, **never** like `source-backed`.
  - A **"review pending" placeholder** where the file's content/summary *would*
    later appear — **empty of content**: no preview, no AI summary, no extracted
    claims, no "we found X". Placeholder copy: *"This file hasn't been reviewed
    yet. Nothing from it is shown or used until a reviewer checks it."*
  - The provenance the uploader entered, echoed back read-only (their own input is
    safe to show; it is not a verification).
  - A path to submit another file.
- **Explicitly forbidden here:** any ✓/verified iconography, any "added to
  Government Watchdog", any claim the file is now a source, any rendered file
  content, any AI-derived text. (Copy rules C2–C4.)
- **Test id:** `upload-success-pending`; chip `review-state-chip`; placeholder
  `review-pending-placeholder`.

### 3.5 Held  (`held`) — pending's stricter sibling
- **Trigger:** the file is accepted but flagged (e.g. supersede red-flag from B5,
  or moderation hold). Surfaced to the uploader as an even more conservative
  pending.
- **Render:** identical honest placeholder as §3.4 with a calmer status line —
  *"Received. Held for additional review."* **No** reason detail is projected to
  the uploader (reason lives reviewer-internal; see §6 forbidden keys). No content.
- Distinct from `denied`/`revoked` **access** states (those are about *entry*,
  handled by the gate). `held` is about a *file*, not a person, and its copy must
  not imply the person did anything wrong.
- **Test id:** `upload-held`.

### 3.6 Error  (`error`)
- **Trigger:** validation failure (client), transfer failure, or a **fail-closed**
  server rejection (unauthorized, unsupported, quota, backend down).
- **Render:** specific, recoverable message + retry (and/or back-to-form). The
  **fail-closed default**: if the surface cannot positively confirm the file was
  received and queued, it shows **error/not-saved**, never a success. Ambiguity
  resolves to "not saved," never to "saved/verified."
- **Never** leaks server internals, stack traces, raw paths, or reviewer notes in
  the message.
- **Test id:** `upload-error`.

### State transition summary
```
gated-out ──(authorized)──► idle ──► validating ──(pass)──► uploading ──► received
   ▲                          ▲          │(fail)               │(fail/cancel)   │(flagged)
   │(deauthorized)            └──────────┴─────────────────────┴──► error       ▼
   │                                                                            held
```

---

## 4. The core honesty invariant (AC: "never shown as verified")

> **A file's most-optimistic display state on this surface is `Review pending`.**

- The uploader can **never** drive a file to a verified/published/source-backed
  state by uploading. Those states are reachable only through the reviewer lane,
  downstream, and are backend-owned.
- Mapped to the shipped trust vocabulary: a fresh upload is at worst-case honesty
  `pending-review` (`read-api.ts:40`), which is **deliberately excluded** from
  `PUBLICATION_ELIGIBLE_UI_STATUSES` (`read-api.ts:64-69`). F1 must not render an
  upload with any of the three publication-eligible statuses.
- The frontend **never recomputes** this. It maps a backend-supplied projected
  status to copy 1:1, exactly like `verificationStatusLabel()` — no client-side
  upgrade, ever. If F1 feels it needs to derive trust, that's a pass-up to CTO/CEO
  (same rule as `read-api.ts:22-26`).

---

## 5. Copy rules (explicit — AC: "never imply verification before review")

| # | Rule | Do | Don't |
|---|---|---|---|
| C1 | **Pre-submission honesty.** The form states upfront that uploading ≠ publishing. | "Files are reviewed before anything from them is shown or used." | "Add your document to Government Watchdog." |
| C2 | **Transfer ≠ processing.** In-progress copy describes bytes moving only. | "Uploading…" | "Analyzing / verifying / processing your file…" |
| C3 | **Receipt ≠ verification.** Success copy is a queue receipt. | "Received — queued for review." | "Uploaded and verified ✓" / "Added as a source." |
| C4 | **No content before review.** Pending/held show a placeholder, not content. | "This file hasn't been reviewed yet." | Any preview, AI summary, or extracted claim. |
| C5 | **Files, not people.** `held`/error copy never implies wrongdoing or civic standing. | "Held for additional review." | "Your file was rejected because…" (blaming tone) |
| C6 | **Fail-closed wording.** Uncertain outcome reads as not-saved. | "We couldn't confirm your upload — nothing was saved. Try again." | Optimistic/ambiguous "Done!" on an unconfirmed result. |
| C7 | **No internal leakage.** Never surface raw paths, hashes, reviewer notes, or the internal `review_state`. | Projected status chip only. | Echoing backend `review_state` / note fields. |

Reuse the *tone* already proven in `access.ts` gate copy: plain, reassuring,
capacity/process-framed, never a judgement about the person.

---

## 6. Honest review-state display — the projected vocabulary

The AC calls for "honest `review_state` display." Critical constraint: the raw
backend **`review_state` is a forbidden web-unsafe key** (`read-api.ts:20`,
`RAW_PATH_FORBIDDEN_KEYS`) — it must never reach the client. So the uploader-facing
status is a **separate, deliberately-coarse, web-safe projection**, produced
fail-closed by the backend read-projection (B6) and consumed **verbatim** by F1.

**Proposed uploader-facing vocabulary (web-safe, coarse-by-design):**

| Projected status | Chip copy | Meaning to uploader | Trust-legend position |
|---|---|---|---|
| `received` | "Received" | Bytes stored, entering queue | not-yet-trusted |
| `review_pending` | "Review pending" | Waiting on / under reviewer review | not-yet-trusted |
| `held` | "Held for review" | Accepted but flagged; still no content | not-yet-trusted |
| *(absent)* | — | Never invent one; unknown ⇒ treat as `review_pending` | fail-closed |

Rules:
- This vocabulary is **coarse on purpose** — it collapses many internal
  `review_state` values into a handful of honest public buckets so no
  reviewer-internal nuance leaks (mirrors how the source drawer omits the
  reviewer-note accessor entirely).
- **No published/verified value exists in this uploader vocabulary.** The uploader
  surface can express *pending* and *held*; it cannot express *verified*. Verified
  display, if it ever happens, is a **different downstream surface** (source
  drawer / card feed) with its own gates — never the upload receipt.
- Label mapping is a pure `switch` like `verificationStatusLabel()`; unknown/absent
  ⇒ the most conservative label (`Review pending`), never a blank and never an
  upgrade.
- **Forbidden from the wire and the DOM (F1 must assert, reuse `assertWebSafe`):**
  `raw_local_path`, `transcript_path`, `raw_sha256`, `review_state` (internal),
  `notes`/`note`, `local_note_path`, `owner_agent`, `created_by`.

---

## 7. Accessibility & resident comprehension

- Status chips carry a **text label**, not colour alone (WCAG — reuse the trust
  legend's existing label+swatch pattern, not colour-only).
- Every state change is announced to assistive tech (`aria-live="polite"` on the
  status region; errors `aria-live="assertive"`).
- Dropzone has a real, keyboard-reachable file-input fallback; drag-drop is an
  enhancement, never the only path.
- Reading level: an ordinary resident must understand, from the success screen
  alone, that **their file is not yet public, not yet verified, and not yet used.**
  If a first-time resident could read the success state as "it's live now," the
  copy has failed C3/C4 — that is the acceptance bar for the UX review leg (UXR).

---

## 8. Acceptance criteria mapping (this doc → GOV-1568 AC)

| GOV-1568 AC | Where satisfied |
|---|---|
| Spec covers every state (gated-out, form, validating, in-progress, success=pending-review, error) | §3.0–§3.6 (+ `held` §3.5) |
| Explicit copy rules: never imply verification before review | §4 invariant + §5 copy table (C1–C7) |
| References existing gated-access + source-drawer patterns for consistency | §1 table, §2 (gate reuse), §6 (source-drawer web-safe projection) |
| Honest `review_state` display; just-uploaded never shown verified | §4, §6 (coarse projected vocabulary; internal `review_state` never projected) |
| Pending/held show honest "review pending" placeholder, no content | §3.4, §3.5, C4 |
| Feeds F1 | §1 "F1 rule", §2 backend note, §6 vocabulary hand-off |

---

## 9. Hand-off to F1 (FrontendTimelineEngineer)

1. Render the upload surface **only** when `resolveAccess()==='approved'`; else the
   existing gate panel, unchanged.
2. Build the state machine in §3; one visible state at a time; test ids as listed.
3. Consume the §6 projected status **verbatim**; never recompute trust; never
   render a publication-eligible status for an upload.
4. Reuse `assertWebSafe` / `RAW_PATH_FORBIDDEN_KEYS` so a raw path / note /
   internal `review_state` can never reach the DOM.
5. Copy strings live in one module (like `gatePanelContent`) so the UXR leg and
   Isaac can review wording in one place. Copy must satisfy C1–C7.
6. Blockers per plan §7: F1 is blocked by **B3** (gated intake API) and **F0**
   (this doc). F1 does not ship a real transfer until B3 exists; until then the
   form is labelled non-functional scaffolding (per `SCAFFOLDING_NOTE`).

*End of F0 spec.*
