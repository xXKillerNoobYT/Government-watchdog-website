"""GOV-2208 — GPT independent code-review lane (WEBSITE / PUBLIC leg).

Implements the website leg of the ADR
``Docs/company-os/adr-gpt-independent-review-lane.md`` (GOV-2202): a CI job sends
the raw PR diff (+ title/body) to a GPT-class model on OpenRouter's free tier and
posts ONE upserted, clearly-labelled **advisory** review comment, independent of
the Claude/VSR pass.

**Repo-visibility note (measured 2026-08-22, ruled in GOV-2214):** the website
repo ``xXKillerNoobYT/Government-watchdog-website`` is **PUBLIC**. Under the
GOV-2214 re-adjudication the public leg carries C1/C2/C3/C5 and **does NOT need
C4** (the zero-retention pin) — C4 attaches to the *private* backend leg. This
package is therefore identical in shape to the backend leg minus any C4 wiring.

The SPA-binding conditions live in code here, not in prose:

- **C1** — :mod:`gpt_review.scan` secret/PII-scans the *exact payload* before any
  transmit; a hit withholds the send and never echoes the value.
- **C2** — :mod:`gpt_review.lane` never signals failure for a review outcome; the
  comment can never fail the PR.
- **C5** — the payload is built from diff + title + body only; no Claude/VSR
  artifact is ever read (asserted structurally and by test).

C3 (free-tier key, no billing) is a workflow/owner concern, not this package's.
C4 does not apply to this (public) leg.
"""
