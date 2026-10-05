"""GOV-2208 C1 — the pre-transmit secret/PII scanner (scripts/gpt_review/scan.py).

The scanner is the fail-closed boundary from ADR §7 C1: a hit must WITHHOLD the
send and must NEVER echo the detected value. These tests pin both halves, plus
the false-positive floor that keeps the lane usable (git shas must NOT trip it).
"""

from __future__ import annotations

from gpt_review import scan


# A planted OpenRouter-style key (fake, well-formed shape). Used across files.
PLANTED_KEY = "sk-or-v1-abcdef0123456789abcdef0123456789abcdef0123456789"
PLANTED_AWS = "AKIAIOSFODNN7EXAMPLE"


def test_clean_payload_has_no_findings() -> None:
    payload = "diff --git a/x.py b/x.py\n+def add(a, b):\n+    return a + b\n"
    assert scan.scan_payload(payload) == []
    assert scan.is_clean(payload) is True


def test_planted_openrouter_key_is_flagged() -> None:
    findings = scan.scan_payload(f"+OPENROUTER_API_KEY = '{PLANTED_KEY}'\n")
    assert findings, "planted key must be detected"
    assert scan.is_clean(f"x = {PLANTED_KEY}") is False


def test_planted_aws_key_is_flagged() -> None:
    findings = scan.scan_payload(f"+aws_key = {PLANTED_AWS}\n")
    assert any(f.rule == "aws-access-key-id" for f in findings)


def test_finding_never_echoes_the_raw_value() -> None:
    # The whole point of C1/W1: the redacted mask must not reconstruct the secret.
    for value in (PLANTED_KEY, PLANTED_AWS):
        findings = scan.scan_payload(f"secret = {value}")
        assert findings
        for f in findings:
            assert value not in f.redacted
            # At most the first 3 chars survive.
            assert value[3:] not in f.redacted
            assert "len=" in f.redacted


def test_private_key_block_is_flagged() -> None:
    payload = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n"
    assert any(f.rule == "private-key-block" for f in scan.scan_payload(payload))


def test_us_ssn_is_flagged_as_pii() -> None:
    assert any(f.rule == "us-ssn" for f in scan.scan_payload("SSN: 123-45-6789"))


def test_git_sha_is_not_a_false_positive() -> None:
    # This repo's diffs are full of lowercase-hex shas near "hash"/"sha" words.
    # An all-hex value must NOT trip the generic-assignment rule, or every PR is
    # withheld and the lane is useless.
    sha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    sha40 = "6d5c3410000000000000000000000000deadbeef"
    for text in (
        f"manifest_sha256 = {sha256}",
        f"root_commit = {sha40}",
        f"token = {sha256}",  # even keyed as 'token', hex-only must not match
    ):
        assert scan.scan_payload(text) == [], f"false positive on: {text!r}"


def test_generic_mixed_case_secret_is_flagged() -> None:
    # A mixed-class value (lower+upper+digit) keyed as a secret SHOULD match.
    findings = scan.scan_payload("client_secret = 'Ab3Xy9Qr7Lm2Kp8Zt4'")
    assert any(f.rule == "generic-secret-assignment" for f in findings)


def test_matched_rules_is_deduped_and_valueless() -> None:
    payload = f"k1 = {PLANTED_KEY}\nk2 = {PLANTED_AWS}\nk3 = {PLANTED_AWS}\n"
    rules = scan.matched_rules(payload)
    assert rules == sorted(set(rules))
    assert all(PLANTED_KEY not in r and PLANTED_AWS not in r for r in rules)
