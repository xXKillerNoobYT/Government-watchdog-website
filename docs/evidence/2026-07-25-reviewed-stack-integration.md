# Reviewed frontend stack integration evidence — 2026-07-25

## Exact inputs

- Current `main` base: `3c8b579747d421c22d19c0f73febf6b4f558804e`
- Reviewed stack tip: `94d3bd2b2f615866be5b0b4d2bc7e7890bc0f57c`
- Included pull requests: `#47`, `#50`, `#57`, `#58`, and `#65`
- Integration branch: `agent/issue-66-integrate-reviewed-frontend-stack`

The stack could not be merged blindly after `main` added the GOV-1566 upload,
supplied-files, and supersede work. Its shared reviewer-context bootstrap
conflicted semantically in `src/main.ts`.

## Conflict decision

The resolved router preserves both feature sets and both trust boundaries:

- Normal `/vault` and `/sources` routes consume only the same-origin,
  server-authorized reviewer context.
- Supplied-file and supersede contract fixtures render only on the visibly
  labeled `?demo=sample` route.
- `/upload` remains gated and uses the fail-closed authenticated intake
  transport; an unavailable backend cannot create a fake receipt.
- Live reviewer failures never substitute a capture or contract fixture.

Integration regressions prove the live/sample distinction and that the upload
route survived the router reconciliation.

## Independent-review findings resolved

1. PostCSS `8.5.15` was affected by high-severity
   `GHSA-r28c-9q8g-f849`. The lockfile now resolves the patched `8.5.18`
   release through a root override.
2. Reviewer responses were unbounded. The client now requires JSON, stops a
   streamed body above 64 MiB, and rejects empty or invalid declared lengths.
   The limit clears the measured 38,209,903-byte Alpine service envelope.
   Normalization caps 50,000 records, 2,000 evidence rows per record, 32 JSON
   levels, and 2 million JSON values. The measured corpus contains 34,696
   records, a maximum of one evidence row per record, and about 1.35 million
   JSON values.
3. Two literal NUL bytes in `src/ui/supplied-files.ts` were replaced by a named
   text sentinel without changing untied-file grouping.
4. Info-note observer cleanup now tolerates an already-destroyed window without
   emitting an uncaught lifecycle error.

## Verification

- Clean `npm ci --no-audit --no-fund`: passed.
- Live `npm audit --audit-level=high --json`: `0` vulnerabilities.
- `npm run typecheck`: passed.
- Focused integration/security suite: `6` files, `144` tests passed.
- Full Vitest suite: `50` files, `796` tests passed.
- Integration smoke suite: `5` tests passed.
- Public build and public-bundle boundary scan: passed (`17` modules).
- Private-beta build and direct-exposure scan: passed (`70` modules).
- Local E2E against exact backend `0597802db7df12eec604ec6b4bab42b449398683`:
  passed with `34,696` reviewer rows and `0` published rows.
- Backend deny-list/service suite within E2E: `18` tests passed.
- Verified artifact SHA-256:
  `3703de0cfc731d1e626050f05df8e9912c403bc6e65e7381726d1ef94b391f2a`.
- E2E verified unauthenticated `403`, authorized reviewer access, loopback-only
  binding, no gated static asset, no populated raw path, flag-off beta `404`,
  Strict session cookie, sign-out, hash-only logs, and an empty public lane.
- `git diff --check`: passed.

## Release boundary

This evidence supports review and merge of the exact integration commit. It
does not authorize public access, beta-cohort expansion, or a claim that the
open live-auth/backend gates are complete. Any Sites reconciliation must be
built from the exact merged `main` commit and retain custom owner-only access.
