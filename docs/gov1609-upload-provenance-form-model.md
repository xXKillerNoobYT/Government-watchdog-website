# GOV-1609 — Upload provenance form model (reconciling F0/F1 with B3's schema)

**Owner:** UXProductDesigner · **Implementer:** FrontendTimelineEngineer (FTE)
**Status:** decided (this doc is the SPEC) · **Priority:** low, non-blocking
**Parent:** GOV-1566 · **Refs:** GOV-1568 (F0 spec `docs/gov1568-upload-ux-spec.md`),
GOV-1569 (F1, `src/ui/gated-upload.ts` + `src/types/upload-intake.ts`), GOV-1576 (B3, done).

---

## 1. The problem (verified against live code, not description)

F0 §3.1 deliberately deferred the provenance *schema* — "the field exists and is
required, not its schema." B3 (GOV-1576) has since landed the durable record, so
the schema is now known and the form model can be reconciled.

**What F0/F1 collect** (two prose fields, both required to submit):

| Form field | Label (F1 `UPLOAD_COPY`) | Wired to B3 body |
| --- | --- | --- |
| `provenance.description` | "What is this file?" | `source_type` (required) |
| `provenance.sourceOrigin` | "Where did this file come from?" | `origin_url` (optional) |

**What B3 stores** (`Database/migrations/0028_supplied_file_records.sql`,
`scripts/beta/intake_api.py`, projected in `src/ui/gated-upload.ts`):

| Column | Shape | B3 intent |
| --- | --- | --- |
| `area` | `TEXT NOT NULL` | jurisdiction scope; F1 sends the constant `'alpine'` |
| `source_type` | `TEXT NOT NULL` | a document **kind** (docstring example: `agenda_packet`) |
| `origin_url` | `TEXT` (optional) | a **locator** (a URL) |
| `captured_at` | ISO date (optional; server defaults to now) | when the source was captured |
| — | *(no column)* | there is **no** free-text description/notes column |

**The defect is semantic typing, not safety.** Nothing breaks and nothing is
fabricated today: B3 accepts any non-empty text and every value sent is the
uploader's own words. But (a) a prose "what is this?" sentence pollutes
`source_type`, which is meant to *cluster* files by kind — prose there can never
be grouped or filtered; and (b) non-URL prose ("Town of Alpine clerk, emailed
2026-06-09") lands in a field named `origin_url`, which any downstream surface
might try to render as a hyperlink.

---

## 2. Decision

**Option (a), scoped.** Not a blanket rebuild of the form; the two fields get
different treatment because their B3 targets differ:

1. **`source_type` → bounded kind picker.** A taxonomy field fed prose is data
   that can never do its job. Convert "What is this file?" from a free-text input
   to a closed-list `<select>` of document kinds. This is the one change with a
   durable payoff and it is cheap to implement.
2. **`origin_url` → keep the free-text provenance field, unchanged copy.** Most
   beta uploads are emailed or handed documents with **no URL**. Forcing a URL
   would empty the field for real uploads — strictly worse. Keep collecting the
   prose; add a **display-safety rule** so no surface renders it as a bare
   hyperlink; and file the clean long-term shape as a **non-blocking BCE contract
   question** (§5).
3. **`captured_at` → not collected in the beta.** Deferred (§6).

Rejected: **Option (b)** (keep prose→`source_type`, just document it). It leaves
the taxonomy field permanently un-groupable and would require re-classifying
every beta record by hand later. The picker costs FTE less than that cleanup.

This is a form-IA / copy decision, squarely UXD's per the issue. No product
direction changes; no civic data is invented — the kind is uploader-*selected*
input, exactly as honest as the free text it replaces (§4).

---

## 3. Spec — `source_type` kind picker

### 3.1 The closed kind list (uploader-asserted, not civic data)

Generic municipal-document kinds. Each is a **claim the uploader makes about
their own file**, like choosing the file itself — it asserts nothing about the
document's *content truth*, and none of these are values copied from any fixture
or `.dc.html` reference (W1-safe). The list is intentionally short with an
always-available escape hatch so no upload is ever blocked by taxonomy:

1. Meeting minutes
2. Agenda or meeting packet
3. Ordinance or resolution
4. Notice or public announcement
5. Correspondence (letter or email)
6. Financial or budget document
7. Report or study
8. Other document

The control's initial option is a **non-value placeholder** — `Choose a kind…` —
with no selected kind. **No kind is preselected** (a preselected default would be
a fabricated assertion about the file: W1). Submit stays disabled until the
uploader actively chooses one of 1–8 (this preserves B3's `source_type NOT NULL`
and F0's "provenance required to submit").

`Other document` is a valid terminal choice; it does **not** open a secondary
free-text field (that would re-introduce prose into the taxonomy column and
recreate the original defect). If a reviewer needs more nuance than the kind
list carries, that lives in the free-text origin field (§4.2) or in reviewer
tooling — not in `source_type`.

### 3.2 Copy

- Label (replaces `descriptionLabel`): **"What kind of file is this?"**
- Placeholder option: **"Choose a kind…"**
- Missing-selection error (replaces `descriptionError`):
  **"Pick what kind of file this is before uploading."**
- The purpose note (C1) and all other upload copy are unchanged.

### 3.3 State / validation table (the picker's states, all enumerated)

| State | Condition | Render |
| --- | --- | --- |
| `unselected` (initial) | placeholder option active | `Choose a kind…` shown; submit disabled; no error until submit attempted |
| `invalid` | submit pressed with placeholder still active | inline error `upload-error-description` (id kept for continuity): *"Pick what kind of file this is before uploading."* — text **+ icon + colour**, never colour alone |
| `selected` | one of kinds 1–8 chosen | error cleared; submit enabled once file + origin also valid |
| `echoed` (on receipt) | after accept | the chosen kind label echoed read-only in the receipt provenance summary (§3.4 of F0), exactly as prose was before |

### 3.4 Accessibility (stated, not assumed)

- Native `<select>` (or an ARIA-complete listbox); **labelled** by the visible
  label via `for`/`id`. Keyboard: focusable in tab order, opens/selects with
  keyboard, `focus-visible` ring from `GW_TOKENS`.
- Tap target height ≥ `DRAWER_TAP_MIN_PX` (44px). Option/label text ≥
  `BADGE_MIN_FONT_PX` floor is not applicable (body text), but the control font
  must not drop below the form's existing input size.
- The invalid state carries **text + icon + colour** — colour is never the sole
  carrier of the error (W6/A4).
- `aria-invalid` + `aria-describedby` wiring to `upload-error-description` when
  in the `invalid` state, matching the existing free-text error pattern.

---

## 4. Slot typing (RV / DG / DL / GS)

These are **write-side, uploader-supplied input** slots, not read-side civic
display slots — so the RV/DG/DL/GS taxonomy applies only to how they are *echoed
back*:

| Slot | Class | Note |
| --- | --- | --- |
| `source_type` kind (chosen) | **uploader input** → echoed **DL-equivalent** | The uploader's own assertion. Echoed read-only on the receipt. **Never** promoted to a Reviewed Value, a trust chip, or a source label. It is not verified by being stored. |
| `origin` free text | **uploader input** → echoed **DL-equivalent** | Same. Safe to show back to the person who typed it; it is not a verification (F0 §3.4). |

**Hard rule (W3/W7):** neither field's presence upgrades the upload's review
state. The receipt's most-optimistic value remains `received`/`review_pending`/
`held` (per `src/types/upload-intake.ts`). A chosen kind is not evidence.

### 4.2 `origin_url` display-safety rule (I own this on the read projection)

Because the beta stores prose in `origin_url`, **no surface may auto-linkify
`origin_url`** unless the value parses as an `http(s)` URL. A non-URL value
renders as plain text. This is a B6/read-projection rule (`src/ui/supplied-files.ts`
and any future provenance render path), pinned by test (§7). It prevents a prose
provenance note from rendering as a broken hyperlink.

---

## 5. Backend contract question (BCE, non-blocking)

The clean long-term shape is a durable record that separates a **real URL
locator** from a **free-text provenance note**. B3 currently has only
`origin_url`. File a low-priority BCE issue asking: *should the supplied-file
record carry a distinct `provenance_note TEXT` (free text) alongside `origin_url`
(a validated URL)?* Until then the beta keeps prose→`origin_url` with the §4.2
display-safety rule. **This does not block the §3 picker work** — the picker
ships against B3 as-is.

---

## 6. `captured_at` — deferred, documented

Not collected in the beta form. Rationale:

- It is optional and the server defaults it to upload-time. An empty input means
  the record's `captured_at` reads as **"received at," not "document date."**
  Adding an optional date input invites the uploader to believe it is the
  document's date, which the server default silently contradicts — a subtle
  misrepresentation for a low-value field in a 2–15 person beta.
- Data-minimisation posture: collect the least that does the job.

**This is a documented deferral, not a Coming Soon marker** (W2): Coming Soon
names an unbuilt *feature*; this is simply a field we choose not to collect yet.
Revisit post-beta if reviewers report they need a real document date. Until then,
downstream copy must never label `captured_at` as the document's date.

---

## 7. Test to pin the rule (name it, file it with the impl)

`test/gov1609-provenance-form-model.test.ts` — asserts:

1. The kind `<select>` renders with **no preselected kind** (placeholder option
   active) and submit is disabled in the `unselected` state.
2. Submitting with the placeholder still active produces the
   `upload-error-description` message and does **not** call the transport.
3. The closed kind list contains exactly the eight kinds in §3.1 (guards against
   silent list drift / an invented civic value creeping in).
4. Choosing a kind and a valid file enables submit and sends the chosen kind
   label as `source_type` — verbatim, no transformation.
5. `origin_url` display-safety: a non-URL `origin` value is **not** rendered as an
   anchor (`<a>`) on the receipt/read path; a valid `http(s)` value may be.

---

## 8. Acceptance criteria for FTE (checkable by a stranger)

- [ ] "What is this file?" free-text input is replaced by a labelled `<select>`
      ("What kind of file is this?") with the eight kinds of §3.1 and a
      `Choose a kind…` placeholder option that carries no value.
- [ ] No kind is preselected; submit is disabled until a kind is chosen; the
      missing-selection error copy matches §3.2 and renders text + icon + colour.
- [ ] The chosen kind label is sent as `source_type` verbatim; `area`,
      `origin_url` (optional), `original_filename`, `mime`, `content_base64`
      wiring is otherwise unchanged from `createHttpIntakeTransport`.
- [ ] The receipt echoes the chosen kind read-only; no trust/verified iconography
      is attached to it (F0 §3.4 unchanged).
- [ ] `origin_url` is never auto-linkified unless it parses as `http(s)` (§4.2).
- [ ] `captured_at` is **not** collected; no date input is added.
- [ ] `test/gov1609-provenance-form-model.test.ts` covers §7 and passes; existing
      `test/gov1569-gated-upload.test.ts` stays green.
- [ ] Accessibility per §3.4; screenshots at 1440 / 768 / 390 under
      `docs/evidence/GOV-16xx/` with no horizontal body scroll.
- [ ] Reviewed by VSR before merge; UXD does not self-certify.
