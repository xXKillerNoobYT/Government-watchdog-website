# SUPERSEDED — Beta release plan (historical record only)

> **Do not operate from any section of this document.** The entire plan was
> superseded on 2026-08-12 after current provider evidence showed Sites access
> is public and backend issue #291 proved the legacy combined Release artifact
> anonymously exposed reviewer-internal bytes. Its private-access assumptions,
> empty-public-artifact procedure, source-pin deployment steps, and combined
> image/`BACKEND_REF` rollback are unsafe and invalid. They remain below only as
> historical decision context.
>
> Current fail-closed source guidance is `docs/deployment-sites.md`,
> `docs/gov1527-build-integration.md`, `docs/gov1543-deploy-execution-plan.md`,
> and `docs/gov1544-deploy-config.md`. The public lane is the independent
> civic-data-empty default Sites build. Private runtime has no hosted, prebuilt,
> token, landing-only, or legacy rollback path until a protected channel exists.
> No release, rollback, access, save, deployment, DNS, credential, or spending
> action is authorized by this archived document.

---

## 1. Current state — what is public, what is gated, and how

### 1.1 Nothing is public today

`docs/deployment-sites.md` records the hosted surface as Sites access `custom`
/ private beta, owner-only allowlist, custom domain none. `index.html:9` ships
`<meta name="robots" content="noindex, nofollow">`, and the fallback worker adds
`x-robots-tag: noindex, nofollow, noarchive` plus `cache-control: private,
no-store` to every response (`scripts/sites-worker.mjs:32-34`).

The Fly/Docker deploy path (`fly.toml`, `Dockerfile`, `deploy/Caddyfile`) is
committed but **inert** — `docs/gov1543-deploy-execution-plan.md` states the hard
rule: zero spend, zero DNS, nothing publicly reachable until the P3d owner card
is accepted.

### 1.2 The server boundary (the only real one)

Two server-side layers, in this order:

1. **Sites `custom` access policy** — the actual static-asset boundary. An
   unauthenticated browser never receives `index.html` or the JS bundle.
2. **`scripts/sites-worker.mjs`** — defence in depth for requests Sites
   dispatches through the worker:
   - `sites-worker.mjs:100-103` — allowlist binding empty ⇒ `503`, fail closed.
   - `sites-worker.mjs:105-108` — `oai-authenticated-user-email` header missing
     or not on `GW_APPROVED_REVIEWER_EMAILS` ⇒ non-enumerating `403`.
   - `sites-worker.mjs:114` — the identity header is stripped before the asset
     fetch; only a boolean `<meta name="gw-sites-access" content="approved">` is
     injected (`sites-worker.mjs:51-57`). The email never reaches browser code.

On the Fly path the equivalent server boundary is the flag gate: while
`beta_gate_enabled` / `notifications_http_enabled` / `email_adapter_enabled`
have no enabled row, every gated `/api/*` route answers a constant `404`
(`docs/gov1543-deploy-execution-plan.md` §1 step 5; asserted by
`scripts/local_e2e.sh:206-208`). The loopback service binds `127.0.0.1:8100`
only and its port is never mapped — enforced twice, by the service's own bind
guard and by `scripts/check-no-direct-exposure.mjs` scanning `src/`, `public/`,
`index.html`, `.openai/`, `deploy/`, `Dockerfile`, `fly.toml`.

### 1.3 The client boundary (presentation only — NOT security)

Every civic route is registered through the `gated()` wrapper
(`src/main.ts:729-738`, routes at `src/main.ts:748-769`), which calls
`renderGatedApp` (`src/ui/landing.ts:160-186`). That function renders the app
**only** when `access === 'approved'`; otherwise it replaces the root with the
gate panel. `test/gov419-preview-gate.test.ts` and
`test/gov758-gated-access.test.ts` assert zero civic selectors
(`record-card` / `timeline` / `source-drawer` / `trust-badge` / `card-feed` /
`completeness-gap-card`) in every non-approved state.

That is a **DOM** guarantee, not an access guarantee. Three client-side paths
grant `approved` to whoever asks:

| Path | Code | Effect |
|---|---|---|
| `?gate=approved` on any route | `src/gate/access.ts:87` — `if (isAccessState(gateParam)) return gateParam;` | Any visitor self-selects `approved`. Documented in `README.md` as the screenshot override; it wins over everything. |
| `?reviewer=1` (sticky for the session) | `src/main.ts:643-647`, persisted at `src/main.ts:636-642` | Any visitor grants themselves the reviewer bypass. |
| Host + committed build marker | `src/gate/hosted-access.ts:29-32` + `index.html:11` | Returns `true` for **any** visitor whose hostname is `alpine-government-watchdog-beta.weirdtoocompany.chatgpt.site`, because `gw-sites-private-beta=owner-only` is committed in the HTML. `src/main.ts:710-713` then auto-redirects to `#/home`. |

None of these check identity. `docs/deployment-sites.md` already names two of
them as public-release blockers.

### 1.4 Can civic data leak to an unauthenticated visitor today?

**Today: no — but only because the unauthenticated visitor never receives the
bundle.** There is no in-bundle protection at all.

Every civic fixture is a **static ES-module import** in `src/main.ts:65-71`
(`state-matrix.json`, `concept-graph-demo.json`, `concept-graph-real.json`,
`alpine-card-feed.json`, `alpine-newsletter-digest.json`,
`agenda-board-projection.json`, `agenda-board-projection.sample.dev.json`), so
Vite emits one chunk containing all of it. Verified against the checked-in
build `dist/client/assets/index-DEtGdf1p.js` (656 KB):

```
statement_id:"alpine_local_corpus:ai:00000064:0021"
statement_id:"alpine_local_corpus:ai:01617859:0008"
reviewed_source_linked            (95 occurrences)
alpinewy.gov/minutes/2026-05-08-draft.pdf
```

`assertWebSafe` (`src/data/web-safe.ts`) sweeps raw/vault paths, and
`scripts/local_e2e.sh:195-199` fails the build if a real absolute/vault path
reaches `dist/client` — so what ships is *web-safe*, but web-safe is not the
same as *public*. These are reviewer-internal reviewed Alpine records, and they
are in the downloadable JavaScript.

**Consequence for this release:** the moment the origin serves assets to an
unauthenticated visitor, `curl https://host/assets/index-*.js` returns the
reviewer-internal corpus, regardless of what `gated()` does in the DOM. And on
that same origin, `hosted-access.ts:32` would hand every anonymous visitor an
`approved` state and drop them straight into `#/home`.

`docs/deployment-sites.md` already states the required standard: *"reviewer-only
and synthetic data are excluded from public assets, not merely hidden in the
DOM."* This plan treats that as the load-bearing requirement.

> **Superseded integration note (2026-08-12):** `LANDING_ONLY` is no longer an
> artifact-integration or Docker option. It built the private browser graph and
> therefore could not prove a public lane. The only reviewed artifact-free path
> is the separate default `npm run build` public-free graph; private integration
> fails closed until a verified local or protected private-runtime artifact is
> available. See website #95 and backend #291.

---

## 2. The public surface

### 2.1 Build shape — the zero-content lane (non-negotiable)

The public waitlist page must be a **separate build artifact** whose module graph
provably cannot reach civic data. Not a route inside the current SPA, not a
runtime branch, not a code-split chunk (a chunk is still fetchable by URL).

```
public.html      ->  src/public-main.ts   ->  landing + waitlist + magic-link + legal
                                              (no fixtures, no router registry,
                                               no gated route modules, no shell)
index.html       ->  src/main.ts          ->  the existing gated app (unchanged)
```

Rules for `src/public-main.ts` and everything it imports:

1. No import — direct or transitive — of `src/fixtures/**`, `src/ui/render.ts`,
   `src/ui/board.ts`, `src/ui/pages-program.ts`, `src/ui/design-pages.ts`,
   `src/ui/home.ts`, `src/ui/newsletter.ts`, `src/ui/card-feed.ts`,
   `src/ui/topic-tree*`, `src/ui/timeline*`, `src/data/client.ts`.
2. No `?gate=` override, no `?reviewer=1`, no `VITE_REVIEWER_BYPASS`, no
   `hostedReviewerAccessActive()`. The public entry has no notion of "approved".
3. Reusable safely: `src/ui/tokens.ts`, `src/ui/theme-toggle.ts`,
   `src/ui/fonts.ts`, `src/ui/waitlist-form.ts`, `src/ui/magic-link-form.ts`,
   `src/gate/access.ts` copy strings (data only, no resolver).
4. A build gate (`scripts/check-public-bundle.mjs`, W7 below) greps the emitted
   public chunk for civic markers and fails the build on any hit.

The gated app keeps its own entry and stays behind the server boundary. Two
entries, two origins-of-truth for exposure, one shared design system.

### 2.2 What the page must contain

**A. Value proposition — capability, not civic claim.**
Describe what the product *does*: find, compare and verify government actions
with the source attached; every claim carries its receipt; AI explanation is
labelled and never presented as fact. Do **not** assert anything about Alpine,
any official, any meeting, any decision, or any pattern in the record. No
counts, no "X meetings tracked", no sample cards, no screenshots of civic
content, no example statements — real or synthetic.

**B. Honest beta status.**
Plainly: this is a gated beta for the Town of Alpine, Wyoming; the app is not
open to the public; joining the waitlist is a request, not an entitlement; there
is no timeline commitment; access is admitted in small batches to keep
source-review quality and moderation manageable; access can be paused or ended.

**C. What someone is signing up FOR.**
Exactly: a place in the beta waitlist queue, and email about beta access. Named
explicitly: not a newsletter subscription, not civic alerts, not an account, not
a public product. If a beta newsletter is ever added it is a **separate,
separately-consented** checkbox.

**D. Privacy statement (on-page, not only linked).**
What is collected (email; optional free-text area of interest — nothing else,
per `src/ui/waitlist-form.ts:21-26`), why, how long it is kept, who can see it,
that the address is stored/logged hash-only outside the send path (the F2
contract in `docs/gov1543-deploy-execution-plan.md` §3, asserted by
`scripts/local_e2e.sh:263-268`), that it is never sold or shared, that
unsubscribe/deletion is one click, and a contact address. Plus the existing
non-negotiable line from `src/ui/waitlist-form.ts:170-173`: **joining the
waitlist says nothing about your civic standing.**

**E. Explicit non-claims.**
A short standing block: nothing on this page is a civic record; no government
body endorses or operates this site; `www.alpinewy.gov` is a source we read, not
our domain and not our affiliation (`docs/deployment-sites.md`).

**F. Feature statements that are not yet built** use the COMING SOON primitive
(`src/ui/coming-soon.ts`) — never designed-gap copy, which belongs to missing
civic DATA only.

### 2.3 What the page must NOT contain

No route into the gated app that renders anything (a "Login" affordance that
posts a magic-link request is fine; a link that mounts `#/app` is not). No
`?gate=` / `?reviewer=1` affordance. No civic fixture, sample, screenshot, or
synthetic design fixture. No OG image depicting civic content — the current
`og.png` and the `og:description` in `index.html:14-19` ("Source-backed civic
records and reviewer-gated analysis for the Town of Alpine") must be reviewed
and, if they imply published civic content, replaced for the public entry.

---

## 3. Waitlist signup — end-to-end

### 3.1 Target flow

```
public page
  └─ form: email (required) + area of interest (optional) + consent checkbox (required)
      └─ POST /api/beta/waitlist  {email, area_interest, consent_version}
          └─ neutral 200 ALWAYS (never reveals whether the address is known)
              └─ backend: store pending row (email_hash + consent record)
                  └─ send double-opt-in confirmation email
                      └─ GET /api/beta/waitlist/confirm?token=…   [MISSING]
                          └─ row becomes CONFIRMED  → state `waitlisted`
                              └─ reviewer triage    → state `pending`
                                  └─ owner-gated allowlist.add(owner_decision_ref)
                                                    → state `approved`
                                      └─ POST /api/beta/magic-link/request
                                          └─ GET  /api/beta/magic-link/verify?token=…
                                              └─ 302 /#/app + HttpOnly Secure
                                                 SameSite=Strict cookie
                                                  └─ gated app renders
```

### 3.2 What the frontend can do today

`src/ui/waitlist-form.ts` is complete as a UI: pure `validateWaitlist`
(lines 40-48), full ARIA (labelled inputs, `aria-describedby`, `role="alert"`
error, `role="status"` confirmation), collects email + area only, carries the
privacy line, and exposes a single wiring seam `WaitlistFormOptions.onSubmit`
(lines 50-57). Today `onSubmit` defaults to `demoSubmit()` (line 71-77), which
just sets `window.location.hash = '#/?gate=waitlisted'` — a client-side
walkthrough, no network call, no storage.

`src/ui/magic-link-form.ts` is the same shape: pure `validateMagicLink`
(lines 26-32), an `onSubmit` seam (line 40), and a default `demoSubmit`
(lines 55-61) that shows the correct **enumeration-neutral** copy — *"If your
email is approved for beta, check your inbox"* — and disables the form. The file
already names its target: `POST /api/beta/magic-link/request`.

Both forms therefore need **wiring, not redesign**.

### 3.3 What is missing on the frontend

- No `fetch` to `/api/beta/waitlist` or `/api/beta/magic-link/request`
  (`src/data/api.ts` implements only `/health` and `/reviewer-internal`).
- **No consent checkbox.** The form has privacy *copy* but no affirmative,
  unticked, required consent control and no `consent_version` sent.
- No double-opt-in messaging ("check your inbox to confirm") — the current
  confirmation says *"you're on the waitlist"* immediately, which is not true
  under double opt-in.
- No confirmation-landing state for the emailed confirm link.
- No error/rate-limit/offline states — a failed POST currently cannot surface.
- No unsubscribe / delete-my-data affordance.
- Access state is derived client-side (`src/main.ts:699-701`), so
  `waitlisted` / `pending` / `denied` / `revoked` are reachable **only** via
  `?gate=`. There is no server-authoritative session state.

### 3.4 The backend contract — what exists, what is missing

Two contract families exist in the repo and must be reconciled:

| Contract | Where named | Status |
|---|---|---|
| `POST /api/beta/waitlist` | `docs/gov1543-deploy-execution-plan.md:52`, exercised by `scripts/local_e2e.sh:206,227` | Implemented in backend `scripts/beta/http_api.py` on **PR #116 (open)**; **not** registered in the artifact's generated router. |
| `POST /api/beta/magic-link/request` | plan §1 table, `src/ui/magic-link-form.ts:13` | Same — PR #116, not in the router. |
| `GET /api/beta/magic-link/verify` | plan §1 table | Same. 302 `/#/app` + Set-Cookie. |
| `DELETE /api/beta/sessions/current` | plan §1 table | Same. |
| `POST /v1/access-requests` | `docs/design-handoff-integration.md:90` | **Design-contract only.** Nothing implements it. |
| `GET /v1/session` | `docs/design-handoff-integration.md:89` | **Design-contract only.** Nothing implements it. |

**Decision required (B6):** `/api/beta/waitlist` and `POST /v1/access-requests`
are the same intent expressed twice. Pick one surface — recommendation: keep the
implemented `/api/beta/*` family as the transport and record `/v1/access-requests`
+ `/v1/session` in `docs/design-handoff-integration.md` as their design aliases,
so the frontend has exactly one contract to code against.

**Wiring dependency (verbatim from `docs/gov1543-deploy-execution-plan.md:55`):**
the four beta routes exist only on backend PR #116 and are *not* in the
artifact's generated router. Order: (a) squash-merge PR #116; (b) extend
`scripts/export_web_artifact.py` — add `scripts/beta/` to the service
import-closure roots and register the four routes in the generated `RUN_PY`
router; (c) bump `BACKEND_REF` via the one-line PR. GOV-1538 owns that leg.

### 3.5 Consent, privacy, double opt-in — requirements

1. **Affirmative consent.** Unticked checkbox, required, wording on the page (not
   in a linked policy): *"Email me about Government Watchdog beta access. I've
   read how my email is handled."* Store `consent_version` + UTC timestamp with
   the row.
2. **Double opt-in is mandatory.** A row is `pending_confirmation` until the
   emailed link is consumed. No un-confirmed address is ever mailed again except
   one re-send on request.
3. **Enumeration neutrality.** Every waitlist/magic-link response is a neutral
   `200` regardless of whether the address is known, confirmed, allowlisted, or
   denied. Already the contract at `scripts/local_e2e.sh:227-231`.
4. **Hash-only at rest and in logs.** Plaintext address exists in memory at send
   time only (F2, `docs/gov1543-deploy-execution-plan.md` §3). The e2e already
   greps the service log for any RFC-5322 string and fails on a hit.
5. **Minimum collection.** Email + optional free-text interest. No name, no
   address, no phone, no IP retained beyond a short abuse window, no third-party
   analytics, no tracking pixel in the confirmation email.
6. **One-click unsubscribe + deletion**, honoured without a login.
7. **No civic-standing inference, ever** — in copy, in storage, in triage notes.

---

## 4. Beta tester onboarding

### 4.1 Signup → access

| # | Step | Actor | System |
|---|---|---|---|
| 1 | Submit the public form with consent | Visitor | `POST /api/beta/waitlist` → neutral 200 |
| 2 | Click the confirmation link | Visitor | `GET /api/beta/waitlist/confirm?token=` → row CONFIRMED |
| 3 | Triage the queue | Reviewer | reads confirmed rows; no civic-standing criteria |
| 4 | Approve into a cohort | **Owner (Isaac)** | `allowlist.add(conn, email, owner_decision_ref=…)` — owner-gated append |
| 5 | Request a login link | Beta tester | `POST /api/beta/magic-link/request` → neutral 200 |
| 6 | Click the link | Beta tester | `GET /api/beta/magic-link/verify` → 302 `/#/app` + HttpOnly Secure SameSite=Strict cookie |
| 7 | Use the gated app | Beta tester | server-authorized `/api/reviewer-internal`; the app renders backend-supplied trust verbatim |
| 8 | Sign out | Beta tester | `DELETE /api/beta/sessions/current` |

**Who approves:** admission to the beta is an **owner decision** — every
allowlist and flag mutation is an append carrying `owner_decision_ref`
(`docs/gov1543-deploy-execution-plan.md` §1 step 5). A reviewer may triage and
recommend; a reviewer may not admit. This preserves the charter rule that public
exposure decisions belong to the owner.

**How access is revoked:** remove the allowlist row and revoke live sessions
DB-side. The kill switch needs no redeploy — appending a disabled
`beta_gate_enabled` flag row returns the entire gated surface to constant `404`
within one request. Revocation is capacity/quality/moderation only; the copy in
`src/gate/access.ts:141-156` already says so and must not change meaning.

### 4.2 The six access states mapped to the lifecycle

| State | Lifecycle position | Source of truth (target) | What renders |
|---|---|---|---|
| `anonymous` | Public visitor, or signed-up but unconfirmed | no session cookie | Public waitlist page. Zero civic content. |
| `waitlisted` | Double-opt-in confirmed, in queue | `GET /api/beta/session` | `src/gate/access.ts:108-117` panel. Zero civic content. |
| `pending` | Reviewer actively evaluating | `GET /api/beta/session` | lines 118-127 panel. Zero civic content. |
| `approved` | On the allowlist, session valid | valid session cookie | The gated app (`renderGatedApp` → `renderShell`). |
| `denied` | Not admitted this cohort | `GET /api/beta/session` | lines 128-140 panel. Capacity/process framing only. Zero civic content. |
| `revoked` | Allowlist row removed / sessions revoked | session invalid + server state | lines 141-156 panel + "request access again". Zero civic content. |

**Required change (W6):** `resolveAccess` (`src/gate/access.ts:83-90`) must take
its non-`anonymous` value from a **server** response, not from `?gate=`. Keep
`?gate=` as a screenshot override compiled out of production builds (see W2).
`isApproved` stays the single client predicate; the server stays the authority.

---

## 5. GAP LIST

Each item is a discrete deliverable with acceptance criteria. Nothing here opens
a civic data lane.

### 5.1 WEBSITE

**W1 — Public zero-content build lane.**
Add `public.html` + `src/public-main.ts` as a second Vite entry; the public
artifact contains landing, waitlist, magic-link, legal/privacy copy and nothing
else.
*AC:* `npm run build` emits a public chunk whose module graph contains no
`src/fixtures/**` and none of the gated render modules listed in §2.1; a
static-import assertion test proves it; the public chunk is < 150 KB;
`grep` for `statement_id` / `reviewed_source_linked` / `alpine_local_corpus` /
`agenda_thread` / `alpinewy.gov` over the public chunk returns zero hits.

**W2 — Remove every client-side self-grant from production builds.**
`?gate=` override, `?reviewer=1`, `VITE_REVIEWER_BYPASS`, and
`hostedReviewerAccessActive()` (host + committed `gw-sites-private-beta` meta)
must be impossible in a production build.
*AC:* a production build defines `import.meta.env.PROD`-guarded dead code such
that `resolveAccess('approved', false)` cannot return `approved` and
`reviewerAccessActive()` is constant `false`; `index.html:11` no longer ships the
private-beta marker on the public entry; a test loads the production bundle text
and asserts the strings `gate=`, `reviewer=1`, `gw-sites-private-beta` are
absent; an anonymous request to `/#/app?gate=approved` renders the gate panel.

**W3 — Public page content.**
Implement §2.2 A–F: value proposition, honest beta status, what you're signing up
for, on-page privacy statement, explicit non-claims, COMING SOON markers for
unbuilt features.
*AC:* content review signs off against `docs/content-quality-baseline.md`; a test
asserts no civic-claim vocabulary (no counts, no meeting/official/decision
assertions) and no designed-gap copy on the public page; every unbuilt-feature
mention uses `src/ui/coming-soon.ts`.

**W4 — Waitlist form wired to the backend, with consent + double opt-in.**
Add a required unticked consent checkbox and `consent_version`; wire
`WaitlistFormOptions.onSubmit` to `POST /api/beta/waitlist`; change the success
copy to the double-opt-in message.
*AC:* submit posts once with `{email, area_interest, consent_version}`; submit is
blocked with an announced error until consent is ticked; success renders
*"Check your inbox to confirm"* and never claims a queue position; every
response (200/4xx/5xx/offline) has a distinct accessible state; unit tests cover
all branches with an injected fetch.

**W5 — Magic-link form wired.**
Wire `MagicLinkFormOptions.onSubmit` to `POST /api/beta/magic-link/request`.
*AC:* one POST per submit; the response is ignored for messaging — the neutral
copy at `src/ui/magic-link-form.ts:56-58` renders identically for every outcome;
submit is rate-limit aware (disabled + countdown on 429); tests cover 200 / 429 /
network failure producing identical user-visible text.

**W6 — Server-authoritative access state.**
Add `getSession()` to `src/data/api.ts` reading the state endpoint (B3); feed
`resolveAccess` from it; render the matching panel.
*AC:* with no session the app renders `anonymous`; each server state renders its
`gatePanelContent` panel; an unknown/malformed state fails closed to `anonymous`
(never `approved`); zero civic selectors in every non-approved state (extend
`test/gov758-gated-access.test.ts`).

**W7 — Public-bundle exposure gate.**
New `scripts/check-public-bundle.mjs`, wired into `npm run build` next to
`check-no-direct-exposure.mjs`.
*AC:* fails non-zero if the public artifact contains any civic marker (see W1
list), any `SYNTHETIC DESIGN FIXTURE` string, any fixture filename, or any
`/api/reviewer-internal` reference; passes on a clean public build; runs in CI
with no backend.

**W8 — Confirmation / verification landing states.**
Public routes for `confirm` (double opt-in consumed) and for a failed/expired
magic link.
*AC:* confirmed, already-confirmed, expired-token, and invalid-token each render
a distinct accessible state with no enumeration (never reveals whether the
address exists); no civic content on any of them.

**W9 — Privacy + terms pages.**
Standalone public pages: data collected, retention, hash-only handling, no sale
or sharing, deletion/unsubscribe route, contact address, non-affiliation with the
Town of Alpine.
*AC:* reachable from every public page; reviewed against §3.5; deletion path is
usable without an account.

**W10 — Public-entry metadata split.**
The public entry drops `noindex`, gets its own title/description/OG image; the
gated entry keeps `noindex, nofollow` and `x-robots-tag`.
*AC:* public entry indexable with non-civic OG copy; gated entry and every
`/api/*` response still `noindex`; `robots.txt` disallows every gated path; the
gated `og:description` no longer implies published civic records.

**W11 — Sign-out and revoked handling.**
`DELETE /api/beta/sessions/current` from the shell; on 401/403 from any gated
call, drop to the server-supplied state.
*AC:* sign-out clears local state and lands on the public page; a revoked session
renders the `revoked` panel, never a stale approved shell; no civic data survives
in the DOM after sign-out.

**W12 — Accessibility + responsive pass on the public lane.**
*AC:* keyboard-only completion of both forms; visible focus on every control;
`prefers-reduced-motion` honoured; contrast ≥ 4.5:1 in light and dark; tap
targets ≥ `--gw-tap-min`; no horizontal scroll at 320 px; errors announced via the
existing `role="alert"` / `role="status"` regions; heading order correct;
screen-reader pass recorded.

**W13 — Abuse and error UX.**
*AC:* per-form client throttle; 429 renders a neutral retry state; repeated
submits cannot double-post; no CAPTCHA that requires a third-party beacon (the
zero-third-party-beacon rule from the self-hosted-font decision,
`src/main.ts:21-23`, still applies).

**W14 — Test + docs.**
*AC:* new `test/beta-public-lane.test.ts` covering W1/W2/W3/W6/W7 invariants;
`README.md` and `docs/deployment-sites.md` updated to describe two lanes; this
plan referenced from both.

### 5.2 BACKEND

**B1 — Land the beta routes in the artifact router.**
Squash-merge PR #116; add `scripts/beta/` to the service import-closure roots in
`scripts/export_web_artifact.py`; register the four routes in the generated
`RUN_PY` router; bump `BACKEND_REF`.
*AC:* a built artifact serves all four routes; with flags off every one answers a
constant `404`; `npm run e2e:local` step 5d passes end to end (it currently skips
loudly on a pre-GOV-1544 artifact).

**B2 — Double opt-in.**
Add `pending_confirmation` → `confirmed` transition, a confirmation token
(single-use, short TTL), a confirmation email template, and
`GET /api/beta/waitlist/confirm?token=`.
*AC:* an unconfirmed row is never mailed again except one explicit re-send;
tokens are single-use and expire; consuming an invalid/expired token returns a
neutral non-enumerating response; the stored row carries `consent_version` +
UTC timestamp; no plaintext address in any log (existing e2e regex gate).

**B3 — `GET /api/beta/session` (server-authoritative state).**
Returns exactly one of the six states plus `asOf`, and nothing else — no email,
no queue position, no cohort name.
*AC:* no cookie ⇒ `anonymous`; each lifecycle position returns its state; the
response contains zero civic data and zero PII; a revoked session returns
`revoked`, never `approved`; flag-off ⇒ constant `404` like the rest of the
gated surface.

**B4 — Approval / cohort admission path.**
Owner-gated `allowlist.add` with `owner_decision_ref`, plus the reviewer triage
transitions `waitlisted → pending → approved|denied`.
*AC:* every transition is an append-only audited row carrying the decision
reference; no transition is possible without one; triage records carry no
civic-standing field; an approval immediately makes a magic-link request succeed
for that address.

**B5 — Revocation + kill switch.**
Allowlist removal, session revocation, and the flag-off path.
*AC:* removing the row invalidates live sessions within one request; appending a
disabled `beta_gate_enabled` row returns the whole gated surface to `404` without
a redeploy; a revoked user's next call returns the `revoked` state, never data.

**B6 — Reconcile `/v1/access-requests` + `/v1/session` with `/api/beta/*`.**
*AC:* `docs/design-handoff-integration.md` records one canonical transport and
names the other as its design alias; the frontend codes against exactly one path;
no second implementation is created.

**B7 — Rate limiting + abuse controls.**
On `/api/beta/waitlist`, `/magic-link/request`, and `/waitlist/confirm`.
*AC:* per-address and per-source-IP limits; limits are enumeration-neutral (a
limited request is indistinguishable from an accepted one to the caller except
for 429 timing); IP retained only for the abuse window then dropped; limits
survive process restart.

**B8 — Consent record storage.**
*AC:* each row stores `email_hash`, `consent_version`, consent UTC timestamp,
confirmation UTC timestamp, optional free-text interest, and nothing else;
schema change is additive-only; an export for a data-subject request is possible
without a schema migration.

**B9 — Unsubscribe / deletion endpoint.**
*AC:* one-click, no login; deletes or tombstones the row and all queued sends;
returns a neutral response; deletion is recorded as an append-only audit event
with no plaintext address.

**B10 — F1 + F2 (pre-activation conditions, already spec'd).**
`SameSite=Lax → Strict` in `scripts/beta/http_api.py`; real `SmtpAdapter` +
hash-only email logging in `scripts/email_gateway/`.
*AC:* verbatim from `docs/gov1543-deploy-execution-plan.md` §3 — zero
`SameSite=Lax` in `scripts/beta/`; no plaintext-address format string in
`scripts/email_gateway/`; adapter truth-table and log-capture tests green;
`scripts/local_e2e.sh:249-268` passes.

**B11 — Public data lane stays honestly empty.**
*AC:* `dist/client/data/published.json` remains `0` rows (already asserted at
`scripts/local_e2e.sh:270-271`); no public civic projection endpoint exists; the
deny-list scan in the artifact build stays a hard gate.

**B12 — Flags default off; activation is owner-gated only.**
*AC:* a fresh deploy activates nothing; every flag flip is an append with
`owner_decision_ref`; no environment variable can activate a gated surface (env
supplies credentials only).

---

## 6. RELEASE CHECKLIST

Run in order. Any failure stops the release; there is no partial ship.

### 6.1 Build

- [ ] Clean worktree from `origin/main`; `git status --short` empty.
- [ ] `npm ci`
- [ ] `npm run typecheck` — clean.
- [ ] `npm run build` — includes `scripts/check-no-direct-exposure.mjs`.
- [ ] `scripts/check-public-bundle.mjs` (W7) passes.
- [ ] `BACKEND_REF` pin matches the intended backend commit; artifact
      `manifest.backend_commit` and recomputed `sha256` both verify (fail-closed
      by construction in `scripts/fetch-artifact.mjs`).
- [ ] Docker build reproduces the image; the fail-closed proof (build with no
      token, no tarball) still dies at fetch.

### 6.2 Tests

- [ ] `npm test` — full Vitest suite green.
- [ ] `test/gov419-preview-gate.test.ts` + `test/gov758-gated-access.test.ts`
      green (zero civic selectors in all non-approved states).
- [ ] New public-lane suite (W14) green.
- [ ] `npm run e2e:local` green **including** step 5d: flag-off 404 → owner-gated
      enable → waitlist + magic-link neutral 200s → real SMTP handshake → 302
      `/#/app` with `SameSite=Strict` → sign-out → hash-only log sweep →
      `published.json` honestly empty.
- [ ] Backend: `test_gov721_email.py`, `test_gov801_beta_gate.py`, plus the new
      adapter/log/rate-limit/double-opt-in tests green.

### 6.3 Exposure scan (the load-bearing gate)

- [ ] Public artifact grep: zero hits for `statement_id`, `alpine_local_corpus`,
      `reviewed_source_linked`, `agenda_thread`, `topic_rollup`, `alpinewy.gov`,
      `SYNTHETIC DESIGN FIXTURE`, any `src/fixtures` filename.
- [ ] Public artifact grep: zero hits for `gate=`, `reviewer=1`,
      `gw-sites-private-beta`, `VITE_REVIEWER_BYPASS`, `/api/reviewer-internal`.
- [ ] No absolute/vault path anywhere in the built output
      (`scripts/local_e2e.sh:195-199` rule).
- [ ] Service port `8100` / `8791` absent from every client, static and deploy
      surface except the two sanctioned in-container references.
- [ ] Every secret is a platform secret; nothing in either repo.

### 6.4 Public zero-content lane (adversarial, anonymous)

Performed from a clean incognito profile with no cookies, plus `curl`:

- [ ] The public page loads and shows the waitlist. No civic content anywhere.
- [ ] `/#/app`, `/#/home`, `/#/agenda`, `/#/timeline`, `/#/vault`, `/#/topics`,
      `/#/newsletter`, `/#/power`, `/#/watchlist`, `/#/location`, `/#/alerts`
      all render the gate panel and zero civic selectors.
- [ ] `/#/app?gate=approved` renders the gate panel (W2 proven in production).
- [ ] `/#/app?reviewer=1` renders the gate panel.
- [ ] `curl` every asset URL under the public artifact and grep it — no civic
      record text.
- [ ] `curl /api/reviewer-internal` with no session ⇒ 403/404, never data.
- [ ] `curl /api/beta/waitlist` with a known-approved address and an unknown
      address ⇒ byte-identical responses.
- [ ] `curl /api/beta/magic-link/request` for an unknown address ⇒ neutral 200,
      no email sent, no enumeration signal in timing or body.
- [ ] `robots.txt` disallows every gated path; the gated entry is `noindex`.

### 6.5 Accessibility

- [ ] Keyboard-only completion of the waitlist and magic-link forms.
- [ ] Visible focus on every interactive control; tap targets ≥ `--gw-tap-min`.
- [ ] Contrast ≥ 4.5:1 in light and dark; `prefers-reduced-motion` honoured.
- [ ] Errors and confirmations announced (`role="alert"` / `role="status"`).
- [ ] No horizontal scroll at 320 px; layout checked at 390 / 768 / 1440.
- [ ] Screen-reader pass recorded (page structure, form labels, error recovery).

### 6.6 Privacy copy

- [ ] Consent checkbox present, unticked by default, required, versioned.
- [ ] Double-opt-in copy is truthful (no "you're on the waitlist" before
      confirmation).
- [ ] On-page privacy statement covers collection, purpose, retention,
      hash-only handling, no sale/sharing, deletion, contact.
- [ ] "Joining the waitlist says nothing about your civic standing" present.
- [ ] Denial and revocation copy still frame everything as capacity/process and
      say nothing about civic standing (`src/gate/access.ts:128-156`).
- [ ] Explicit non-affiliation with the Town of Alpine; `www.alpinewy.gov` named
      as a source, never as our domain.
- [ ] No third-party beacon: no external font, script, pixel, or analytics.

### 6.7 Rollback

- [ ] Previous image/version identified and redeployable (platform-native
      rollback; each image embeds one pinned artifact, so rollback is
      bit-for-bit a known-good site+service pair).
- [ ] Pin rollback rehearsed: revert the one-line `BACKEND_REF` PR, rebuild.
- [ ] Kill switch rehearsed: append a disabled `beta_gate_enabled` row ⇒ the
      gated surface returns to constant 404 within one request, no redeploy.
- [ ] Full-public-page takedown rehearsed: revert to the private access policy /
      remove the public route in one step.
- [ ] `/data/gw.db` snapshot taken before cutover; restore path verified.
- [ ] Rollback does not delete waitlist rows or consent records.

### 6.8 Sign-off

| Gate | Signer | Signs off on |
|---|---|---|
| Build + tests + exposure scan | CTO agent | §6.1–6.3 all green, evidence attached to the release ticket |
| Public zero-content lane | Reviewer (independent of the implementer) | §6.4 performed anonymously, transcript attached |
| Accessibility | Design/a11y reviewer | §6.5 |
| Privacy, consent, copy | SecPriv pass | §6.6, plus B7–B9 acceptance |
| Backend activation flags | **Owner (Isaac)** | every `set_flag` / `allowlist` append carries `owner_decision_ref` |
| **Go / no-go: make the waitlist page publicly reachable** | **Owner (Isaac), explicit card** | spend, DNS/domain, and the access-policy change — none of which any agent performs |

No agent may flip an activation flag, change the hosting access policy, register
a domain, or incur spend. Those are owner steps, armed verbatim on an owner card
(the O-step inventory pattern in `docs/gov1543-deploy-execution-plan.md` §5).

---

## 7. What this explicitly does NOT do

**Stage 98 — full public release — stays CLOSED.** This plan opens one
unauthenticated marketing surface with zero civic content. It does not make any
civic record, agenda, statement, source, profile, newsletter, alert, or
AI-generated analysis publicly readable, in any lane, in any state.

Specifically, after this release:

- No public civic projection endpoint exists. `published.json` stays honestly
  empty (0 rows) and is asserted so by the e2e.
- The six interpretation lenses remain unbuilt and unexposed.
- Every civic route stays behind the server boundary *and* the DOM gate.
- Reviewer-internal fixtures leave the shipped public artifact entirely — they
  are not "hidden", they are absent.
- No claim about the Town of Alpine, any official, or any decision appears on
  any publicly reachable page.

### 7.1 What would have to be true to open Stage 98 later

Every one of these, plus explicit owner approval of an exact version:

1. A separately reviewed **public authorization and data path** exists —
   distinct from the private owner/reviewer worker policy.
2. The backend exposes a separately authorized, **web-safe public projection**;
   protected rows are never bundled into public JavaScript and hidden after
   download.
3. Production builds **cannot** enable `?reviewer=1`, `VITE_REVIEWER_BYPASS`,
   `?gate=`, or the host+meta hosted-access path (W2 — a prerequisite of this
   plan, and re-verified at Stage 98).
4. The private-beta host marker and its automatic Home entry are removed.
5. Reviewer-only and synthetic data are **excluded from public assets**, not
   merely hidden in the DOM (W1/W7 — likewise re-verified).
6. Public-lane and raw/private-field tests pass against the **production**
   build.
7. Every published item meets `docs/content-quality-baseline.md`: resolvable
   source/receipt linkage, exact backend-supplied review state, AI disclosure in
   the same block, freshness, corrections, accessibility.
8. Source-version preservation is live: a material or late agenda change shows
   as a visible red flag with an old/new comparison and reprocessing.
9. The six lenses, if published, are isolated — shared canonical evidence, never
   shared output — and no lens can alter a fact, source, verification state, or
   publication state.
10. An anonymous/incognito smoke test proves protected routes and assets remain
    inaccessible.
11. A named legal/defamation and takedown/correction process exists, with a
    reachable contact and a published correction policy.
12. The **owner explicitly approves the exact version** for public access on a
    dedicated Stage 98 card. Nothing else — no agent, no flag, no config —
    constitutes that approval.

The first eleven are engineering preconditions. The twelfth is the gate itself,
and it is not delegable.
