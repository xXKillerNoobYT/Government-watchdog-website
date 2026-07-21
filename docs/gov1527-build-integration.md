# GOV-1527 — Website build integration (Phase 1c of GOV-1523)

Consumer half of the pinned backend web-artifact contract
(`Docs/gov1523-artifact-contract-spec.md` in the backend repo, Phase 1a).
Architecture: **Option C — pinned backend web-artifact contract**.

The website never imports backend Python. It consumes a versioned, deny-list-
scanned tarball keyed by a single pin line, talks to the auth/notification
service only through a same-origin `/api/*` proxy, and fails **closed** on any
missing token / artifact / flag.

## The one command (acceptance test)

```bash
npm run e2e:local        # == bash scripts/local_e2e.sh
```

Everything runs on `127.0.0.1`; no deploy token, no network beyond localhost for
the run (a one-time `pip`/`venv` setup may fetch). It proves, end to end:

1. Resolve `BACKEND_REF=local:<checkout>` → build the artifact with the pinned
   backend's **own** `scripts/export_web_artifact.py` → run the §2 deny-list
   tests against it.
2. Verify the manifest — `backend_commit` matches `HEAD`, `artifact_sha256`
   recomputed (NUL-separated content digest, manifest excluded), known
   `schema_version`.
3. Start `service/run.py` on loopback; assert a **non-loopback bind is refused**.
4. Build the site + start `vite preview` (`127.0.0.1`) with `/api/*` proxied to
   the loopback service.
5. Smoke through the same-origin proxy:
   - **(a)** unauthenticated → landing `200`, `/api/reviewer-internal` `403`,
     `/api/notifications` `404` while the flag is off;
   - **(b)** an approved session → `/api/reviewer-internal` `200` with gated rows
     (via `/api` only);
   - **(c)** the built static output ships **no** gated-lane asset and **no**
     populated raw/vault path.
6. Print the artifact manifest; exit non-zero on any failure.

Config (all optional): `GW_BACKEND_CHECKOUT`, `GW_REGISTRY_DB`,
`GW_SERVICE_PORT`, `GW_PREVIEW_PORT`, `PYTHON`, `GW_KEEP_UP=1` (leave the service
+ preview up for screenshots).

## Pieces (website side)

| File | Role |
|---|---|
| `BACKEND_REF` | the single pin line (40-char SHA or tag; `local:PATH` override for dev). Bump = a one-line PR. |
| `scripts/fetch-artifact.mjs` | resolve the pin → build (`local:`) or download the Release (`GW_BACKEND_DEPLOY_TOKEN`) → extract → verify commit/sha/schema → stage. Fail-closed; `LANDING_ONLY=1` escape hatch. |
| `scripts/check-no-direct-exposure.mjs` | §5 build check — fails the build if the loopback service port leaks into any client/static/deploy surface. Runs in `npm run build` + CI. |
| `vite.config.ts` | same-origin `/api` proxy (dev + preview) → `127.0.0.1:$GW_SERVICE_PORT`. |
| `src/data/api.ts` | same-origin client + `{reviewer_internal_records}` → read-model adapter + `LANDING_ONLY` flag. |
| `scripts/local_e2e.sh` | the §8 one-command demo above. |
| `scripts/seed_demo_session.py` | demo-only: seed one approved reviewer session so the gated `/api` path can be exercised without a live mail flow. |

## Fail-closed behavior (§6)

| Condition | Behavior |
|---|---|
| `GW_BACKEND_DEPLOY_TOKEN` missing/invalid (hosted) | **build fails**; documented fallback `LANDING_ONLY=1` → public landing + waitlist, **zero** `/api` surface (an explicit choice, never an auto-degrade). |
| artifact download / sha / commit / `schema_version` mismatch | **build fails** — no stale/cached reuse (`fetch-artifact.mjs` aborts non-zero). |
| feature flags off (append-only, no row = off) | gated endpoints answer constant `404`; deploying activates nothing. |
| service down / unreachable from proxy | `/api/*` → 502; the public landing stays fully functional. |
| unauthenticated / unapproved user | existing gated-beta states only; **no** civic data on any pre-auth surface. |

## Boundaries

No public deploy, no domain/DNS/hosting spend (GOV-420 modified hold — deploy
fires a separate Isaac card later). The gated `reviewer_internal.json` lane is
served **only** by the service through `/api/*` after session auth — it is never
a static asset and never committed. No secrets committed; both repos stay
private.

## Known integration notes (for the GOV-1528 SecPriv review)

- **Magic-link front door.** The 1b service (`service/run.py`) routes
  `/api/health`, `/api/notifications`, `/api/reviewer-internal`. It packages the
  `accounts/` code but does **not** yet expose a magic-link request/consume HTTP
  route. The local demo therefore seeds an approved session directly (owner-side)
  to exercise the security-critical gated path; a full browser magic-link flow
  needs the accounts endpoints wired into the service router (follow-up).
- **Session transport.** The service authorizes via `Authorization: Bearer
  <token>`; the GOV-802/804 front door issues a session **cookie**. Bridging
  cookie→bearer at the proxy (or teaching the service to read the session cookie)
  is the remaining wiring for a cookie-based browser session. Gated data never
  reaches a pre-auth surface either way (fail-closed).
