# GOV-1543 — Phase-3 deploy execution plan (P3a)

**Program:** GOV-1523 Option C — pinned backend web-artifact contract (accepted plan rev `07bce814-3dc1-4737-8244-b4982f093c86`, Isaac card `ca9b16ce`).
**Authorization:** Isaac answered deploy card `87c0cd91` (`questions:GOV-1523:deploy:v1`) 2026-07-22T00:17Z: **approve-deploy**. Platform and domain were NOT selected; owner summary on record: *"do not incur spend or configure DNS until the separate final go/no-go card."*
**Status:** execution **plan only**. Nothing in this doc is an action. **HARD RULE for every Phase-3 leg: zero spend, zero DNS/registrar/domain action, zero new hosted accounts, nothing publicly reachable until the P3d owner card is accepted.**
**Repos:** website `xXKillerNoobYT/Government-watchdog-website` · backend `xXKillerNoobYT/Government-watchdog` (both private, proprietary LICENSE per GOV-1529).
**Inputs this plan is built from:** Phase-1a contract `Docs/gov1523-artifact-contract-spec.md` (backend, merged `273d195`/PR #118) · Phase-1b builder (merged `73c2224`/PR #119) · Phase-1c website integration `docs/gov1527-build-integration.md` (merged, PR #40) · GOV-799/801 front door (backend PR #116, **still open**) · GOV-802/804 SecPriv passes.

> Note on `docs/deployment-sites.md`: that file describes the legacy ChatGPT-Sites private-beta surface. It remains valid for that surface, but Phase 3 targets real hosting with the gated front door; on P3c cutover the Sites doc becomes historical. This plan does not modify it.

---

## 1. Deploy topology (from the Phase-1 pinned-artifact contract)

**One deployment unit** runs the whole site. Two processes inside it; exactly one is reachable from the internet.

```
                    internet
                       │  :443 (platform TLS)
              ┌────────▼─────────┐
              │  edge web server │   serves dist/ (static: landing, app shell,
              │  (Caddy or nginx)│   published.json — honestly empty until P8)
              │                  │   reverse-proxies /api/* ──┐
              └──────────────────┘                            │ 127.0.0.1:$GW_SERVICE_PORT
                                                     ┌────────▼─────────┐
                                                     │ service/run.py   │  loopback ONLY
                                                     │ (from artifact)  │  ALLOWED_BIND_HOSTS
                                                     └────────┬─────────┘  guard refuses else
                                                              │
                                                       /data/gw.db (volume)
                                                       accounts/flags/outbox DB only —
                                                       raw registry/corpus NEVER deploys
```

Build chain (all fail-closed, already implemented in Phase 1):

1. Backend CI (`.github/workflows/web-artifact-release.yml`) builds `gw-web-artifact-<sha>.tar.gz` with `scripts/export_web_artifact.py` on a deliberate `web-artifact-*` tag; deny-list scan (§2 of the 1a contract) is a build gate — a hit deletes the tarball (fail closed by absence).
2. Website build resolves the single pin line `BACKEND_REF` (currently `73c2224e82d9ea0f1da35dc90bf63832c02ce713`) → `scripts/fetch-artifact.mjs` downloads the Release using `GW_BACKEND_DEPLOY_TOKEN`, verifies `manifest.backend_commit` == pin, recomputes `artifact_sha256`, checks `schema_version`. Any mismatch/missing token = **build fails** (explicit `LANDING_ONLY=1` fallback produces landing+waitlist with zero `/api` surface — a choice, never an auto-degrade).
3. `scripts/check-no-direct-exposure.mjs` fails the build if the loopback service port leaks into any client/static/deploy surface.
4. Runtime: the platform exposes only the edge server's port. The service binds loopback only (bind guard in the generated `run.py` and in `scripts/beta/http_api.py::serve`); the deploy config maps **no** second port. Double enforcement per §5 of the 1a contract.
5. Activation is flag-gated and append-only (`scripts/email_gateway/flags.py`, no row = off): while `beta_gate_enabled` / `notifications_http_enabled` / `email_adapter_enabled` are off, every gated route answers constant 404. **Deploying activates nothing** — flags are flipped only by an owner-gated `set_flag` append with `owner_decision_ref` after P3d.

Routes at the edge after full Phase-3 wiring (all same-origin `/api/*`, no CORS, no second hostname):

| Route | Source |
|---|---|
| `GET /api/health` | generated `run.py` (GOV-1526) — liveness, zero civic data, answers even with no DB |
| `GET /api/notifications` | GOV-771 endpoint, flag + session gated |
| `GET /api/reviewer-internal` | approved-tier gated lane (never a static asset) |
| `POST /api/beta/magic-link/request` | `scripts/beta/http_api.py` (PR #116) — neutral 200, never reveals allowlist |
| `GET /api/beta/magic-link/verify` | `scripts/beta/http_api.py` — 302 `/#/app` + Set-Cookie, or 302 back |
| `POST /api/beta/waitlist` | `scripts/beta/http_api.py` — neutral 200 |
| `DELETE /api/beta/sessions/current` | `scripts/beta/http_api.py` — sign-out, clears cookie |

**Wiring dependency (P3b sequencing, do not duplicate GOV-1538):** the beta routes above exist only on backend PR #116 (open) and are not yet in the artifact's generated router. Order for P3b: (a) squash-merge PR #116 (CI green precondition); (b) extend `scripts/export_web_artifact.py` — add `scripts/beta/` to the service import-closure roots and register the four routes in the `RUN_PY` router (the entrypoint is a generated string at `scripts/export_web_artifact.py:241`, **not** a checked-in server file); (c) bump `BACKEND_REF` via the standard one-line PR. GOV-1538 owns the backend magic-link-route wiring leg; P3b consumes its result rather than re-implementing.

## 2. Platform plan (costed July 2026; pick deferred to the P3d card)

All three candidates satisfy the required shape (build-time secrets, one unit running static + private server process, private-repo artifact fetch, no forced public port exposure). Default spend cap for whichever is picked: **≤ $15/mo**.

| Platform | Shape | Est. monthly | Notes |
|---|---|---|---|
| **Fly.io** (CTO-recommended) | one `shared-cpu-1x` machine (edge + loopback service in one VM — the most direct match to the loopback contract) + 1 GB volume for SQLite | ~$5–8 | machine-level control; scale fixed at 1; volume snapshots built in |
| **Render** | Web Service (Starter) running edge+service; static from the same service | ~$7 | fixed price; simplest dashboard; disk add-on for SQLite |
| **Railway** | Hobby plan, single service + volume | ~$5–10 | $5 base + usage; needs the usage cap set |

### Concrete runbook — Fly.io (recommended; **executed only in P3b/P3c after P3d acceptance**)

1. **Image (multi-stage Dockerfile, website repo):**
   - Stage 1 (node:22): `npm ci` → run `scripts/fetch-artifact.mjs` with `GW_BACKEND_DEPLOY_TOKEN` supplied as a **BuildKit secret mount** (`RUN --mount=type=secret,id=gw_deploy_token …` — never an `ARG`/`ENV`, so it cannot persist in a layer) → `npm run build` (runs the §5 exposure check) → outputs `dist/` + staged `service/` + seedless accounts DB schema.
   - Stage 2 (runtime): `python:3.12-slim` + `caddy`. Copy `dist/`, `service/`, a `Caddyfile` (`root dist/; handle /api/* { reverse_proxy 127.0.0.1:8100 }`), and `entrypoint.sh` that starts `python service/run.py --db /data/gw.db --port 8100` (loopback) then `exec caddy run` (foreground, PID 1).
2. **`fly.toml`:** one app, `primary_region` US; `[http_service] internal_port = 8080` (Caddy only), `force_https = true`, `min_machines_running = 1`, `auto_stop_machines = false` (SQLite service should not cold-stop mid-session); `[mounts] source = "gw_data", destination = "/data"`. **No** `[[services]]` entry for 8100 — the service port is never mapped (§5 double enforcement; `check-no-direct-exposure.mjs` also greps deploy config).
3. **Secrets:** `fly secrets set GW_SMTP_HOST=… GW_SMTP_PORT=587 GW_SMTP_USERNAME=… GW_SMTP_PASSWORD=… GW_MAIL_FROM=…` (runtime, service only — §4); deploy with `fly deploy --build-secret gw_deploy_token=<PAT>` (build-time only).
4. **Health checks:** platform HTTP check on `/api/health` through Caddy (proves edge + proxy + service in one probe). Landing stays up even if the service dies (`/api/*` → 502, static unaffected).
5. **Spend guard:** single machine, autoscaling off; Isaac sets the billing alert/cap at account creation (owner step O-F3). Projected ~$5–8/mo, hard default cap $15/mo.

### Render runbook (equivalent, kept viable)

Starter Web Service from the same Dockerfile (Render supports Docker + secret files/env for the build token via env groups — token scoped to build only), 1 GB persistent disk at `/data`, health check path `/api/health`, no secondary port exposed (Render only routes the declared port → Caddy). Fixed ~$7/mo.

### Railway runbook (equivalent, kept viable)

Single service from the Dockerfile, volume at `/data`, `PORT`→Caddy, healthcheck `/api/health`, build secret via Railway build-time variables (marked non-runtime), usage cap set to $15 in project settings. ~$5–10/mo.

## 3. The two mandated fixes (spec'd here; implemented in P3b **before any real user email flows**)

Both were promised inside this chain at the GOV-802 SecPriv pass (recorded as pre-activation conditions in `Docs/gov1523-artifact-contract-spec.md` §6, backend repo).

### F1 — session-cookie `SameSite` alignment (Lax → Strict)

- **Where (backend repo, PR #116 branch until merged):** `scripts/beta/http_api.py`
  - `build_session_cookie()` (≈line 55–59): `"… HttpOnly; Secure; SameSite=Lax"` → `SameSite=Strict`
  - `clear_session_cookie()` (≈line 62–65): same change
  - module docstring (≈line 19): update the cookie contract line
  - cookie constants stay: `COOKIE_NAME = "gw_beta_session"`, HttpOnly + Secure + `Max-Age=<sessions.BETA_TTL_SECONDS>` + `Path=/`
- **Tests:** `tests/test_gov801_beta_gate.py:305` asserts `SameSite=Lax` — flip the assertion to `Strict`; add a regression test that **no** Set-Cookie emitted anywhere in the module contains `SameSite=Lax` or omits `SameSite`.
- **Why Strict is safe here:** the app shell is a static SPA. The only navigation that carries the cookie cross-context is the magic-link click from the user's mail client — a top-level GET to `/api/beta/magic-link/verify`. *Setting* a cookie during that response's 302 is not restricted by SameSite; the subsequent document request for `/#/app` is a static fetch that needs no cookie; every authenticated call afterwards is a same-origin `fetch('/api/…')`, where Strict cookies are always sent. Nothing in the GOV-758 gated flows relies on cross-site cookie sends, so Strict costs nothing and aligns the implementation to the GOV-802 acceptance criteria (AC said Strict; implementation shipped Lax).
- **Acceptance (P3b):** grep of the merged tree shows zero `SameSite=Lax` in `scripts/beta/`; the local e2e (`npm run e2e:local`, website repo) still passes its approved-session smoke (b) with the Strict cookie.

### F2 — replace placeholder email adapter with a real provider adapter + hash-only email logging

- **Where (backend repo):** `scripts/email_gateway/adapters.py`
  - `NullAdapter.send()` line 54 currently logs plaintext: `logger.info("null adapter: suppressed send to=%s subject=%r", to_email, subject)`. **Fix regardless of adapter choice:** log `to_hash=<sha256(lowercased email)[:12]>` — never the address. Subject may stay (templates are ours, never user-derived).
  - Add `SmtpAdapter` — a provider-agnostic SMTP-submission adapter (STARTTLS, port 587) registered via the existing `register_adapter()`; resolution stays exclusively through `resolve_adapter()` and its INV-5 fail-closed truth table (flag `email_adapter_enabled` absent/disabled/unregistered ⇒ `NullAdapter`). SMTP rather than a vendor SDK keeps the provider swappable and the owner-account decision (which provider) inside the P3d card, not the code.
  - Config: `GW_SMTP_HOST` / `GW_SMTP_PORT` / `GW_SMTP_USERNAME` / `GW_SMTP_PASSWORD` / `GW_MAIL_FROM`, read from the service process environment (platform secrets, §4) at adapter construction. Missing any var ⇒ the factory refuses to register (falls back to Null, warning logged) — fail closed, consistent with the D1 no-env-flag rule: the env supplies *credentials only*; *activation* remains the DB flag with `owner_decision_ref`.
- **Send path:** `scripts/email_gateway/outbox.py` (≈line 108 `adapter.send(to_email=email, …)`) — audit that no log statement on this path prints `email`; the outbox/delivery-log rows already store `user_id`/`template_id`/`subject` and account/audit records store only `email_hash` (GOV-802 baseline; deny-list clause 3 enforces no RFC-5322 strings in artifact data lanes). The plaintext address may exist **only in memory** at send time.
- **Tests (P3b):** truth-table cases for `SmtpAdapter` registration/refusal; a log-capture test asserting no handler on `email_gateway` ever emits a string matching an email regex; smoke against a local debug SMTP sink (e.g. `aiosmtpd`) — no real provider needed pre-P3d.
- **Acceptance (P3b):** `python3.12 -m pytest tests/test_gov721_email.py tests/test_gov801_beta_gate.py` green plus the new adapter/log tests; grep shows no `to=%s` (or any plaintext-address format) in `scripts/email_gateway/`.

## 4. Secrets, health-check, rollback

**Secrets inventory (complete — nothing else exists):**

| Secret | Scope | Where it lives | Notes |
|---|---|---|---|
| `GW_BACKEND_DEPLOY_TOKEN` | **build-time only** | platform build secret (BuildKit secret mount / Render env group / Railway build var) | GitHub fine-grained PAT, resource = backend repo only, permission = Contents: **Read-only** (Releases download). Never an ARG/ENV, never in image layers, `fetch-artifact.mjs` never echoes it. Revocation breaks the *next* build only (fail closed), never the running site. |
| `GW_SMTP_*` + `GW_MAIL_FROM` | runtime, service process only | platform runtime secrets | consumed by F2 adapter; absent ⇒ NullAdapter (fail closed). Never reach the edge process or client. |

No session-signing secret exists or is needed: session tokens are random values whose sha256 is the only stored copy (`scripts/beta/sessions.py` / `scripts/accounts/sessions.py`).

Rules: no secrets in either repo, ever (existing hard stop); no secrets in logs (CI + fetch script already silent; F2 adds the email-regex log test); artifact fetch is private-Release only.

**Health checks:** platform probe on `GET /api/health` through the edge proxy — one probe proves TLS → edge → proxy → service. `/api/health` serves zero civic data and answers even with no DB. Static landing is health-independent: service death degrades `/api/*` to 502 while the public landing keeps serving (contract §6).

**Rollback plan:**
- Code/image: platform-native release rollback (`fly releases` + redeploy prior image / Render "Rollback" / Railway redeploy previous build). Because every image embeds one pinned artifact, a rollback is bit-for-bit the previous known-good site+service pair — no partial-version skew is possible.
- Pin: a bad backend artifact is rolled back by reverting the one-line `BACKEND_REF` PR and rebuilding.
- Data: `/data/gw.db` holds only accounts/waitlist/flags/outbox (append-only tables). Code rollback never rewrites data; schema is additive-only through Phase 3 — any future destructive migration is its own reviewed leg.
- Kill switch without redeploy: append a disabled flag row (owner-gated `set_flag`) → gated surface returns to constant 404 within one request; sessions can be revoked DB-side.
- Volume snapshots (Fly automatic daily / platform equivalent) cover the DB; snapshot restore is the disaster path.

## 5. OWNER-STEP INVENTORY (the only steps Isaac can do; P3d card is armed **verbatim** from this list, click-Done per step)

Notation: O-Fn = Fly, O-Rn = Render, O-Wn = Railway, O-Gn = GitHub (platform-independent), O-Dn = domain. Exactly one platform column and one domain option get armed on the P3d card, plus the O-G steps which apply to every combination.

**GitHub (required for any platform):**
- **O-G1.** Create the fine-grained PAT: GitHub → Settings → Developer settings → Fine-grained tokens → *Generate new token*; Resource owner `xXKillerNoobYT`; Repository access: **only** `Government-watchdog`; Permissions: Contents **Read-only**; expiry 90 days. Copy the token once. (CTO cannot mint tokens on the owner account.)
- **O-G2.** Paste the token into the chosen platform's build-secret field (named `GW_BACKEND_DEPLOY_TOKEN` / `gw_deploy_token`) when P3c asks — do not send it through the issue board or email.

**Fly.io (if picked):**
- **O-F1.** Create the Fly.io account at fly.io with your email; verify the email.
- **O-F2.** Add the payment method (card) — Fly requires it even at ~$5/mo usage.
- **O-F3.** In Billing, set the spend notification/limit to **$15/month**.
- **O-F4.** Create an org API token (Dashboard → Tokens → *Create deploy token*, org-scoped) and hand it to the CTO leg for `fly deploy` — or run the two commands P3c prints, your choice on the card.

**Render (if picked):**
- **O-R1.** Create the Render account; verify email.
- **O-R2.** Add the payment method (Starter is $7/mo fixed — no separate cap setting exists; the fixed price is the cap).
- **O-R3.** Either connect the GitHub app to the **website repo only** (Render builds from repo) or create a deploy hook and hand it to the CTO leg.

**Railway (if picked):**
- **O-W1.** Create the Railway account; verify email.
- **O-W2.** Add the payment method; choose the Hobby plan ($5 base).
- **O-W3.** Project settings → Usage Limits: set the hard limit to **$15/month**.
- **O-W4.** Connect the GitHub app to the website repo only, or create a project token for the CTO leg.

**Domain — Option A: free subdomain of `isaac4alpine.com` (no new spend):**
- **O-D1a.** Type the exact subdomain you want on the P3d card (e.g. `watch.isaac4alpine.com` — your exact string; nothing is registered until you type it).
- **O-D2a.** At the `isaac4alpine.com` registrar/DNS panel, add the one record P3c prints: a `CNAME` from that subdomain to the platform target (Fly: `<app>.fly.dev`; Render: `<service>.onrender.com`; Railway: `<service>.up.railway.app`).
- **O-D3a.** Click the platform's "verify domain / issue certificate" button (or click Done and the CTO leg confirms TLS issued — read-only check).

**Domain — Option B: new domain (~$10–15/yr):**
- **O-D1b.** Type the exact new domain name on the P3d card (your exact string).
- **O-D2b.** Purchase it at your registrar of choice (~$10–15/yr; this is the only recurring non-platform spend).
- **O-D3b.** Add the `A`/`CNAME` record(s) P3c prints for the chosen platform.
- **O-D4b.** Confirm TLS issuance as in O-D3a.

Everything not listed above (Dockerfile, fly.toml/render.yaml, Caddyfile, secrets wiring except the paste, flag flips, BACKEND_REF bumps, health checks, e2e verification, screenshots) is agent work in P3b/P3c and requires no Isaac action.

---

## Boundaries and unlock

- This leg took **no** action: no accounts created, no payments, no DNS/registrar changes, nothing deployed, nothing publicly reachable. All runbooks above are inert until the P3d owner card is accepted with a platform + domain choice.
- Flag flips (`beta_gate_enabled`, `email_adapter_enabled`, `notifications_http_enabled`) remain owner-gated appends with `owner_decision_ref` — deploy alone activates nothing.
- **Unlock:** GOV-1543 completion unblocks **P3b** (implementation leg: merge PR #116, F1+F2 fixes, artifact router extension in coordination with GOV-1538, Dockerfile/Caddyfile/platform config committed but not deployed). P3c (execution) additionally waits on the P3d owner card.
