# GOV-1543 — Phase-3 deployment plan (superseded)

The original Phase-3 plan used a combined backend artifact downloaded from a
public GitHub Release and treated an access token plus runtime authorization as
protection for reviewer data. That assumption is false. Backend issue #291
confirmed reviewer-internal bytes were anonymously downloadable from the
Release asset. Website issue #95 separately requires a reviewed,
machine-readable compatibility and snapshot lock.

The old platform commands, token instructions, prebuilt-archive path, pin-bump
procedure, and owner-step checklist have been removed from the active runbook.
They remain available in Git history for incident analysis, but **must not be
executed or reconstructed from older commits**.

## Current status

- The default website build is the independent, civic-data-empty public-free
  Sites package. It fetches no backend artifact.
- Private-runtime integration rejects commit and tag refs before network.
- Local development may use only an explicit clean backend checkout, which
  builds the backend format-v2 `private-runtime` profile and passes both the
  producer's canonical archive verifier and the website's extracted-contract
  verifier.
- The private Docker image deliberately has no public-Release, token,
  prebuilt-archive, or landing-only bypass. It remains unbuildable with the
  committed hosted `BACKEND_REF`.
- No platform, account, payment, DNS, credential, access, release, save, or
  deployment action is authorized by this document.

## Replacement plan gates

A new deployment plan may be written only after all of these have exact,
issue-linked evidence:

1. An explicitly authorized incident-response action contains the affected
   legacy Release asset and records audit and rollback evidence.
2. Reviewer-runtime artifacts use an authenticated, revocable, non-public
   delivery channel with anonymous-denial and authorized-retrieval tests.
3. The website checks in the public-safe compatibility/snapshot/profile lock
   required by #95 and rejects same-commit/different-byte candidates.
4. The backend creates a unique immutable public artifact identity from
   non-empty, owner-approved published data; exact archive scans prove no
   reviewer/service members or private markers.
5. Private-runtime and public artifacts have separate provenance, retention,
   rollback, and access-control evidence.
6. Exact integration, authorization, accessibility, route, mobile, recovery,
   and hosted smoke tests pass for the reviewed candidate.
7. A separate owner approval names platform, spend cap, credentials, access,
   DNS/domain scope, release identity, rollback target, and deployment timing.

Until then, the safe public lane is the artifact-free Sites build and the safe
private lane is fail closed.
