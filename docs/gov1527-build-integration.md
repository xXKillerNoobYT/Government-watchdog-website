# GOV-1527 — Website build integration (Phase 1c of GOV-1523)

Consumer half of the pinned backend web-artifact contract
(`Docs/gov1523-artifact-contract-spec.md` in the backend repo, Phase 1a).
Architecture: **Option C — pinned backend web-artifact contract**.

The website never imports backend Python. For private-runtime development it
builds a versioned, deny-list-scanned artifact from an explicit local backend
checkout, talks to the auth/notification service only through a same-origin
`/api/*` proxy, and fails **closed** on any hosted/public artifact ref.

As of issue #291, the backend repository and GitHub Releases are public. A token
cannot make a public Release asset private. Commit and tag pins are therefore
rejected before any download; only `BACKEND_REF=local:PATH` may produce the v2
`private-runtime` profile until a protected, authenticated channel exists.

## The one command (acceptance test)

```bash
npm run e2e:local        # == bash scripts/local_e2e.sh
```

Everything runs on `127.0.0.1`; no deploy token, no network beyond localhost for
the run (a one-time `pip`/`venv` setup may fetch). It proves, end to end:

1. Resolve `BACKEND_REF=local:<checkout>` → build the artifact with the pinned
   backend's **own** `scripts/export_web_artifact.py` → run the §2 deny-list
   tests against it.
2. Verify the manifest — format v2, profile `private-runtime`, `backend_commit`
   matches `HEAD`, `artifact_sha256` recomputed (NUL-separated content digest,
   manifest excluded), known `schema_version`, exact reviewer row count, no
   public lane, and only the private data/service member roots.
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
| `BACKEND_REF` | the future compatibility pin. Its current commit value is deliberately rejected for private-runtime transport; `local:PATH` is the only accepted private mode. |
| `scripts/fetch-artifact.mjs` | reject commit/tag before network → build explicit local v2 `private-runtime` → validate archive paths/types and extracted profile/commit/digest/counts → stage. `LANDING_ONLY=1` remains the artifact-free escape hatch. |
| `scripts/check-no-direct-exposure.mjs` | §5 build check — fails the build if the loopback service port leaks into any client/static/deploy surface. Runs in `npm run build` + CI. |
| `vite.config.ts` | same-origin `/api` proxy (dev + preview) → `127.0.0.1:$GW_SERVICE_PORT`. |
| `src/data/api.ts` | same-origin client + `{reviewer_internal_records}` → read-model adapter + `LANDING_ONLY` flag. |
| `scripts/local_e2e.sh` | the §8 one-command demo above. |
| `scripts/seed_demo_session.py` | demo-only: seed one approved reviewer session so the gated `/api` path can be exercised without a live mail flow. |

## Fail-closed behavior (§6)

| Condition | Behavior |
|---|---|
| commit or tag `BACKEND_REF` | **build fails before network**; a public Release is never accepted as private transport. |
| local profile / archive member / sha / commit / row-count / schema mismatch | **build fails** — no stale/cached reuse (`fetch-artifact.mjs` aborts non-zero). |
| protected private channel absent | Private Docker/hosted integration stays intentionally unavailable. The public-free Sites build remains independent and artifact-free. |
| feature flags off (append-only, no row = off) | gated endpoints answer constant `404`; deploying activates nothing. |
| service down / unreachable from proxy | `/api/*` → 502; the public landing stays fully functional. |
| unauthenticated / unapproved user | existing gated-beta states only; **no** civic data on any pre-auth surface. |

## Boundaries

No deployment, access, DNS, or hosting mutation is authorized by this source
change. The gated `reviewer_internal.json` lane is served **only** by the local
private service through `/api/*` after session auth; it is never copied to the
browser artifact or committed. The public backend repository cannot be used as
its delivery channel.

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
