# GOV-462 — Stage 4.06 gated Alpine newsletter archive/detail (impl evidence)

Implements `docs/stage4-06-newsletter-archive-detail-frontend-contract.md` (GOV-461).
Renders the Stage 4.05 deterministic digest object verbatim (no client recompute),
gated behind the existing gated-beta gate, reviewer-internal + Alpine-only.

## Local-runner result (worktree)

- `npm run typecheck` → rc=0
- `npm test` → **284 passed** (20 files), incl. the new `test/gov462-newsletter-digest.test.ts` (23 tests covering contract §6.1–§6.7)
- `npm run build` → rc=0 (`tsc --noEmit` + `vite build`)

## Fixture provenance (real assembler capture)

`src/fixtures/alpine-newsletter-digest.json` is a verbatim capture of
`scripts/stage4_newsletter_digest_assembler.py::assemble_digests(...)` at backend
`origin/main` PR #79 / `cf61ea5`, over the exact reviewer-internal Alpine seed from
`tests/test_stage4_newsletter_digest_assembler.py::_seed` (5 human + 1 AI + 1
corrected promoted statements over source `alpine_packet`; one `no_primary_source`
completeness gap). Deterministic (no clock/network/AI).

- Reproducible fingerprint: `f3d7f09a7acf5deed6a14bc8702eb8558b7c22e7ff52f59c8fc0b15cb6d9be2d`
- 2 digests (coverage periods `2026-18`, `2026-19`); claim states present:
  `unverified`, `corrected`, `ai_presented`; `localSourcePath` always null.
- Web-safe by construction at the assembler boundary; re-swept on load by the
  route-aware `assertDigestWebSafe` (mirrors backend `_assert_local_safe`:
  `/alpine/` routes exempt from the absolute-path rule, `..` rejected).

## 3-viewport screenshots

| # | Viewport | Surface |
|---|---|---|
| 01 | desktop 1440×900 | archive list (label-state summaries) |
| 02 | desktop 1440×900 | digest detail — all 11 GOV-15 sections, label states, "none in this digest", source trail |
| 03 | desktop 1440×900 | gated (denied) — gate panel, **zero** digest data |
| 04 | tablet 768×1024 | archive list |
| 05 | tablet 768×1024 | digest detail |
| 06 | tablet 768×1024 | gated (anonymous) — gate panel, zero data |
| 07 | mobile 390×844 | archive list |
| 08 | mobile 390×844 | digest detail |
| 09 | mobile 390×844 | gated (anonymous) — gate panel, zero data |

Label states visible across archive + detail: `Unverified` (caution), `Corrected`
(neutral), and the locked `AI — not independently verified` label on the
AI-presented record (per-record, never merged into a verified row). Only `verified`
reads as the trusted (ok) tone.

## Gate enforcement (§5 / AC#3)

Both `#/newsletter` and `#/newsletter?id=...` route through the existing `gated()`
wrapper (`resolveAccess`/`isApproved`, `src/gate/access.ts` 0-diff). For every
non-approved `AccessState` the route renders the gate panel and **no** digest data
node (test §6.6 + screenshots 03/06/09). `?gate=` override wins so any gate state is
screenshotable; reviewer bypass reveals the routes locally.

## Route / no-public-path audit

- `#/newsletter` routes wire NO email/sender/publish/public-deploy call — asserted by
  test §6.7 (DOM: no `mailto:`/external sender; in-app deep links point only at
  `#/alpine/...` reviewer-internal hashes; source grep: no
  `mailto:|nodemailer|sendgrid|smtp|sendEmail|publishNewsletter|deploy(|window.location=`).
- `index.html` `noindex, nofollow` intact (untouched).
- Public deploy stays GOV-420 / Isaac-gated; 4.07–4.15 remain `planned`.
