# GOV-1544 — deploy implementation (P3b of GOV-1523)

Implements the GOV-1543 execution plan (`docs/gov1543-deploy-execution-plan.md`)
§2 runbook step 1–2 on the website side. **Committed but inert**: nothing is
deployed, no account exists, zero spend, until the P3d owner card is accepted.

## Pieces

| File | Role |
|---|---|
| `Dockerfile` | multi-stage: node build (fetch+verify pinned artifact, fail-closed) → python3.12-slim + caddy runtime. Deploy token only via BuildKit secret mount — never a layer. |
| `deploy/Caddyfile` | edge on :8080 — serves `dist/`, proxies `/api/*` → `127.0.0.1:8100` (the one sanctioned service-port reference). |
| `deploy/entrypoint.sh` | first boot: init empty DB from the artifact's seedless `service/schema.sql`; start service on loopback :8100; exec caddy (PID 1). |
| `fly.toml` | one machine, one mapped port (8080), `/api/health` check, `/data` volume. Placeholder app name until P3d. |
| `scripts/dev_smtp_sink.py` | loopback SMTP sink for the e2e magic-link leg (dev-adapter path; nothing leaves the machine). |

## Build verification (all local, no token, no spend)

```bash
# fail-closed proof: no token, no tarball -> the build MUST die at fetch
DOCKER_BUILDKIT=1 docker build .

# full local verification from a pre-built tarball (pin still enforced:
# manifest commit cross-check + sha256 recompute happen in-build)
DOCKER_BUILDKIT=1 docker build \
  --build-arg BACKEND_REF=<backend-sha> \
  --build-arg GW_ARTIFACT_TARBALL=.artifact-local/gw-web-artifact-<short>.tar.gz .

# hosted (P3c only): fly deploy --build-secret gw_deploy_token=<PAT>
```

`scripts/check-no-direct-exposure.mjs` now also scans `Dockerfile`, `fly.toml`
and `deploy/` — mapping the service port (8100/8791) anywhere outside the two
sanctioned in-container references fails the build (§5 double enforcement).

## e2e (extended)

`npm run e2e:local` step 5d, when the pinned artifact carries the GOV-1544
wiring: flag-off constant 404 on `/api/beta/*` → owner-gated enable (throwaway
DB) → waitlist + magic-link request (neutral 200s) → REAL `SmtpAdapter` SMTP
handshake to the loopback sink → verify 302 `/#/app` + `SameSite=Strict`
HttpOnly Secure cookie → sign-out → service-log sweep (hash-only, no plaintext
address) → `published.json` honestly empty. Skips loudly on a pre-GOV-1544
artifact.

## Runtime env (service process only, set at P3c)

`GW_SMTP_HOST/PORT/USERNAME/PASSWORD`, `GW_MAIL_FROM` (credentials only —
activation stays the owner-gated DB flags), optional `GW_SMTP_SECURITY`
(`starttls` default; `none` refused off-loopback), `GW_VERIFY_BASE_URL`
(public origin in magic-link emails), `GW_DB_PATH` (default `/data/gw.db`).
