"""C1 — pre-transmit secret/PII scanner for the GPT independent review lane.

ADR §7 C1: *before any diff or PR title/body leaves the runner for OpenRouter,
scan the exact payload; on any hit, do not transmit, post "review unavailable —
payload withheld", and never echo the detected value (W1/F5).*

Design rules, each load-bearing:

- **Fail-closed.** Any match means WITHHOLD. The caller transmits only when
  :func:`scan_payload` returns an empty list.
- **Never echo the value.** A :class:`Finding` carries the *rule id* and a
  *redacted mask* — never enough of the matched text to reconstruct the secret.
  The CI job must not become the second copy of a leak.
- **Low false-negative over low false-positive.** A false positive costs one
  "review unavailable" note on an advisory lane (harmless); a false negative
  transmits a secret. When unsure, match.
- **Do not match git object hashes.** This repo's diffs are full of 40/64-char
  lowercase-hex shas (migration/manifest hashes). The generic-assignment rule
  requires a mixed character class so an all-hex sha never trips it — otherwise
  every PR would be withheld and the lane would be useless *and* safe, which is
  the wrong kind of safe.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Finding:
    """One scanner hit. ``redacted`` NEVER reconstructs the matched value."""

    rule: str
    redacted: str


# Strong, prefix-anchored credential shapes. These have near-zero false-positive
# rates because the prefix + length is distinctive.
_TOKEN_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("openrouter-or-openai-key", re.compile(r"sk-(?:or-v1-)?[A-Za-z0-9]{20,}")),
    ("aws-access-key-id", re.compile(r"\b(?:AKIA|ASIA|AGPA|AIDA|AROA)[0-9A-Z]{16}\b")),
    ("github-token", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b")),
    ("github-fine-grained-pat", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{22,}\b")),
    ("slack-token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b")),
    ("google-api-key", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b")),
    ("stripe-key", re.compile(r"\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b")),
    ("private-key-block",
     re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----")),
    ("jwt",
     re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}")),
)

# Civic PII: SSN. Specific enough to keep false positives rare; a false positive
# only costs a "review unavailable" note.
_PII_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("us-ssn", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
)

# Generic ``key = "value"`` assignment. Requires a MIXED character class in the
# value (at least one lowercase, one uppercase, and one digit) so a lowercase-hex
# git sha or an all-caps constant does not trip it.
_ASSIGNMENT_RULE = (
    "generic-secret-assignment",
    re.compile(
        r"""(?ix)
        \b(?:api[_-]?key|secret|token|password|passwd|pwd|access[_-]?key|
            client[_-]?secret|auth[_-]?token|private[_-]?key)\b
        \s* [:=] \s*
        ['"]?
        (?P<val>[A-Za-z0-9+/_\-]{16,})
        ['"]?
        """,
    ),
)


def _redact(value: str) -> str:
    """A mask that proves a match without disclosing the secret.

    Shows at most the first 3 characters and the length; everything else is
    masked. ``"AKIAIOSFODNN7EXAMPLE"`` -> ``"AKI***(len=20)"``.
    """
    head = value[:3]
    return f"{head}***(len={len(value)})"


def _looks_mixed(value: str) -> bool:
    """True when ``value`` has lower + upper + digit — i.e. not a hex sha."""
    return (
        any(c.islower() for c in value)
        and any(c.isupper() for c in value)
        and any(c.isdigit() for c in value)
    )


def scan_payload(payload: str) -> list[Finding]:
    """Return every secret/PII finding in ``payload`` (empty == safe to send).

    Order is deterministic (rule declaration order, then match order) so callers
    and tests get a stable list. Values are never included — only redacted masks.
    """
    findings: list[Finding] = []

    for rule, pattern in _TOKEN_RULES:
        for m in pattern.finditer(payload):
            findings.append(Finding(rule=rule, redacted=_redact(m.group(0))))

    for rule, pattern in _PII_RULES:
        for m in pattern.finditer(payload):
            findings.append(Finding(rule=rule, redacted=_redact(m.group(0))))

    rule, pattern = _ASSIGNMENT_RULE
    for m in pattern.finditer(payload):
        val = m.group("val")
        if _looks_mixed(val):
            findings.append(Finding(rule=rule, redacted=_redact(val)))

    return findings


def is_clean(payload: str) -> bool:
    """True when nothing matched — the ONLY condition under which C1 permits a send."""
    return not scan_payload(payload)


def matched_rules(payload: str) -> list[str]:
    """De-duplicated, sorted rule ids that hit — safe to show a human (no values)."""
    return sorted({f.rule for f in scan_payload(payload)})
