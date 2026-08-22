# GOV-2208 — GPT independent review lane, website (PUBLIC) leg — contract

Implements the **website leg** of ADR `company-os/adr-gpt-independent-review-lane.md`
(GOV-2202). Mirrors the backend leg (GOV-2205) minus C4.

## Repo-visibility premise (measured, ruled)

- `xXKillerNoobYT/Government-watchdog-website` = **PUBLIC** (`gh repo view … --json visibility` → `PUBLIC`, 2026-08-22).
- SPA ruling **GOV-2214**: the public leg carries **C1/C2/C3/C5** and **does NOT need C4** (the zero-retention pin). C4 attaches to the *private* backend leg (GOV-2216), not this repo.
- This supersedes the ADR's `verified 2026-07-28` snapshot, which had the visibility labels swapped (backend was public then). The ADR correction is owned by CTO in GOV-2216.

## What runs

| Field | Value |
|---|---|
| Target | Every PR to this repo |
| Trigger | `.github/workflows/gpt-review.yml` — `on: pull_request [opened, synchronize, reopened]`, no path filter |
| Runner | `ubuntu-latest` (PUBLIC repo → free hosted minutes; no self-hosted Mac dependency) |
| Input contract | git diff `base...head` + PR title + PR body **only** (C5) |
| Output contract | ONE upserted advisory PR comment (marker `<!-- gpt-independent-review-lane -->`) |
| Model | OpenRouter free `openai/gpt-oss-120b`, fallback `mistralai/mistral-nemo` |
| Key | `secrets.OPENROUTER_API_KEY` — free-tier, **no billing** (C3). Absent ⇒ posts "review unavailable", exit 0 |
| Failure behaviour | Every review outcome ⇒ comment + exit 0; steps are `continue-on-error` (C2, never a merge gate). Missing diff file ⇒ exit 2, still wrapped by `continue-on-error` |
| Self-test | `.github/workflows/gpt-review-selftest.yml` — runs `tests/test_gov2208_gpt_review_*.py`, scoped by `paths:` to lane changes only |

## SPA conditions (in code, not prose)

- **C1** `scripts/gpt_review/scan.py` — fail-closed secret/PII scan of the exact payload before transmit; a hit withholds and never echoes the value.
- **C2** `scripts/gpt_review/lane.py` — no review outcome fails the PR; both workflow steps `continue-on-error`.
- **C3** free-tier Actions secret, no billing; header forbids attaching payment (→ CEO).
- **C4** — **N/A for this leg** (public repo). `lane._request_body()` carries **no** `provider.data_collection` pin; a runtime test asserts its absence.
- **C5** — `build_payload()` reads only its three args; the transport receives exactly two messages (rubric + diff-only payload), asserted by equality.

## Acceptance (run 2026-08-22, offline, injected transport)

- `python -m pytest tests/test_gov2208_gpt_review_*.py` → **32 passed**.
- CLI: dry-run ⇒ `status=preview` exit 0 (no network); planted key + `--transmit` ⇒ `status=withheld`, value not echoed, exit 0; missing diff ⇒ exit 2; twice-run identical (idempotent).

## Reviewer / owner

- **VSR `3f95c8ce`** verifies the workflow + tests (independent of AOE).
- Maintenance owner: **AutomationOpsEngineer `b9611d2e`**.
- Live key provisioning (adding the free-tier `OPENROUTER_API_KEY` Actions secret) is a separate C3 step; until then the lane is inert-but-safe.
