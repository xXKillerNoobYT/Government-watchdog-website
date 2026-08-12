# GOV-1544 — deploy implementation status (superseded private transport)

This document originally described the Phase-3 private Docker deployment built
from a combined backend artifact downloaded through the public GitHub Release
channel. That transport is unsafe and is superseded by backend issue #291 and
website issue #95.

## Current fail-closed state

| Surface | Current behavior |
|---|---|
| Default `npm run build` | Builds and verifies the civic-data-empty public-free Sites package. It does not fetch a backend artifact. |
| `scripts/fetch-artifact.mjs` | Rejects commit/tag refs before network. It accepts only a clean explicit `local:PATH`, builds the backend format-v2 `private-runtime` profile, invokes the backend canonical archive verifier, then independently verifies the extracted contract. |
| `Dockerfile` | Private-runtime image definition only. It deliberately fails with the committed hosted `BACKEND_REF`; no deploy token, prebuilt archive, or landing-only bypass exists. |
| `deploy/Caddyfile` / `deploy/entrypoint.sh` | Retained for local topology verification only; they authorize no hosted deployment. |

Do not pass a GitHub token or legacy Release asset to this build. A token cannot
make a public asset private. Do not restore `GW_ARTIFACT_TARBALL`,
`GW_BACKEND_DEPLOY_TOKEN`, or a public-Release download path as a workaround.

## Local verification

```bash
# Public artifact-free lane:
npm run build

# Private integration against an exact clean backend checkout carrying the
# format-v2 split contract (currently backend PR #294):
BACKEND_REF=local:/absolute/path/to/clean/backend \
GW_DEMO_DB=/absolute/path/to/registry.db \
npm run build:integrated

# Full loopback authorization and static-boundary proof:
GW_BACKEND_CHECKOUT=/absolute/path/to/clean/backend npm run e2e:local
```

These commands create local build artifacts only. They do not save or deploy a
Sites version, create infrastructure, change access, spend money, or contain the
legacy exposed asset.

## Activation prerequisites

Private hosting remains blocked until all of the following have issue-backed,
exact-version evidence:

1. the affected legacy public asset is contained through an explicitly
   authorized incident-response action;
2. reviewer-runtime artifacts use an authenticated, revocable, non-public
   delivery channel;
3. the website carries the reviewed compatibility/snapshot/profile lock from
   #95 rather than trusting only a self-declared artifact manifest;
4. a new unique immutable public artifact is built from non-empty,
   owner-approved published data and passes exact archive scans;
5. anonymous and authorized retrieval, revocation, rollback, and deployment
   smokes pass for the exact candidate; and
6. separate owner approval covers platform, spend, credentials, access, and
   deployment.

The earlier SMTP/session configuration notes remain historical input only; they
are not a live deployment runbook while the private artifact channel is blocked.
