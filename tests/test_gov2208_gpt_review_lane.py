"""GOV-2208 — the lane orchestrator (scripts/gpt_review/lane.py), website leg.

Covers the SPA conditions that live in this module:
  C1  — a planted secret is WITHHELD (never transmitted), the comment says
        "review unavailable", and the value is never echoed (AC #2).
  C2  — every review outcome yields a comment and exit 0; the lane never fails.
  C5  — diff-only input: the transport receives ONLY the diff + title/body, and
        build_payload reads nothing but its three arguments (AC #4).

Plus one website-leg (GOV-2214) assertion: the OpenRouter request body carries
NO C4 zero-retention pin — the website repo is PUBLIC, so C4 does not apply here.

The OpenRouter call is injected, so these run fully offline.
"""

from __future__ import annotations

from pathlib import Path

from gpt_review import lane
from gpt_review.lane import ReviewResult, build_payload, review

PLANTED_KEY = "sk-or-v1-abcdef0123456789abcdef0123456789abcdef0123456789"
CLEAN_DIFF = "diff --git a/x.py b/x.py\n+def add(a, b):\n+    return a + b\n"


class _Recorder:
    """A fake transport that records exactly what the lane tried to send."""

    def __init__(self, reply: str = "Looks fine. `x.py` add() is correct.") -> None:
        self.reply = reply
        self.calls: list[tuple[str, list[dict], str]] = []

    def __call__(self, model: str, messages: list[dict], api_key: str) -> str:
        self.calls.append((model, messages, api_key))
        return self.reply


# --- C1 -------------------------------------------------------------------------

def test_planted_secret_is_withheld_not_transmitted() -> None:
    rec = _Recorder()
    diff = f"+OPENROUTER_API_KEY = '{PLANTED_KEY}'\n"
    result = review(diff, "add key", "wire it up", api_key="k", transmit=True, transport=rec)

    assert result.status == "withheld"
    assert rec.calls == [], "a flagged payload must NEVER reach the transport"
    assert "review unavailable" in result.comment.lower()
    assert "withheld" in result.comment.lower()


def test_withheld_comment_never_echoes_the_secret() -> None:
    result = review(
        f"token = {PLANTED_KEY}", "t", "b", api_key="k", transmit=True, transport=_Recorder()
    )
    assert PLANTED_KEY not in result.comment
    assert PLANTED_KEY[4:] not in result.comment


# --- C5 -------------------------------------------------------------------------

def test_transport_receives_only_diff_title_body() -> None:
    rec = _Recorder()
    review(CLEAN_DIFF, "My PR title", "My PR body", api_key="k", transmit=True, transport=rec)
    assert len(rec.calls) == 1
    _model, messages, _key = rec.calls[0]

    # EXACTLY two messages: the fixed rubric and the diff-only payload — nothing
    # else. Asserting equality (not substring) is what catches context bleed
    # injected into either message; a substring check would let extra content
    # through (measured: it did).
    assert len(messages) == 2
    assert messages[0] == {"role": "system", "content": lane.SYSTEM_PROMPT}
    assert messages[1] == {
        "role": "user",
        "content": build_payload(CLEAN_DIFF, "My PR title", "My PR body"),
    }
    # And the rubric never names the other lane (it may say it gets "no prior
    # review" — describing what it lacks — but must not reference Claude/VSR).
    assert "claude" not in lane.SYSTEM_PROMPT.lower()
    assert "vsr" not in lane.SYSTEM_PROMPT.lower()


def test_build_payload_is_a_pure_function_of_its_args() -> None:
    # No file/env/other-reviewer input: same args => same payload, and the diff
    # text is present verbatim. This is the structural "no context bleed" proof.
    p1 = build_payload(CLEAN_DIFF, "t", "b")
    p2 = build_payload(CLEAN_DIFF, "t", "b")
    assert p1 == p2
    assert CLEAN_DIFF in p1


# --- website leg (GOV-2214): NO C4 pin ------------------------------------------

def test_request_body_has_no_c4_zero_retention_pin_public_leg() -> None:
    # The website repo is PUBLIC, so the request body must NOT carry a provider
    # data-collection pin. (A private leg would add provider.data_collection=deny
    # and route to SPA — that is not this file.)
    body = lane._request_body("openai/gpt-oss-120b", lane.build_messages("payload"))
    assert "provider" not in body
    assert body["model"] == "openai/gpt-oss-120b"
    assert body["messages"][0]["role"] == "system"


# --- C2 / outcomes --------------------------------------------------------------

def test_reviewed_outcome_wraps_model_text_with_marker_and_footer() -> None:
    rec = _Recorder(reply="Found a bug in add().")
    result = review(CLEAN_DIFF, "t", "b", api_key="k", transmit=True, transport=rec)
    assert result.status == "reviewed"
    assert result.model == lane.DEFAULT_MODELS[0]
    assert lane.MARKER in result.comment
    assert "Found a bug in add()." in result.comment
    assert "Advisory only" in result.comment


def test_missing_key_is_unavailable_not_an_error() -> None:
    result = review(CLEAN_DIFF, "t", "b", api_key=None, transmit=True, transport=_Recorder())
    assert result.status == "unavailable"
    assert "OPENROUTER_API_KEY absent" in result.comment
    assert lane.MARKER in result.comment


def test_dry_run_makes_no_network_call() -> None:
    rec = _Recorder()
    result = review(CLEAN_DIFF, "t", "b", api_key="k", transmit=False, transport=rec)
    assert result.status == "preview"
    assert rec.calls == []
    assert "Dry run" in result.comment


def test_transport_error_falls_back_then_reports_unavailable() -> None:
    class _Boom:
        def __init__(self) -> None:
            self.models: list[str] = []

        def __call__(self, model, messages, api_key):
            self.models.append(model)
            raise RuntimeError("secret-bearing provider error should not surface")

    boom = _Boom()
    result = review(CLEAN_DIFF, "t", "b", api_key="k", transmit=True, transport=boom)
    assert result.status == "unavailable"
    # It tried every configured model before giving up.
    assert boom.models == list(lane.DEFAULT_MODELS)
    # The provider error message is NOT echoed — only its class name.
    assert "secret-bearing provider error" not in result.comment
    assert "RuntimeError" in result.comment


def test_empty_completion_is_unavailable() -> None:
    result = review(CLEAN_DIFF, "t", "b", api_key="k", transmit=True, transport=_Recorder(reply="  "))
    assert result.status == "unavailable"


# --- CLI ------------------------------------------------------------------------

def test_cli_writes_comment_and_exits_zero(tmp_path: Path, monkeypatch) -> None:
    diff = tmp_path / "pr.diff"
    diff.write_text(CLEAN_DIFF, encoding="utf-8")
    out = tmp_path / "comment.md"
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    # Default (no --transmit) is a dry run: no network, exit 0.
    rc = lane.main(["--diff-file", str(diff), "--title", "t", "--body", "b", "--out", str(out)])
    assert rc == 0
    body = out.read_text(encoding="utf-8")
    assert lane.MARKER in body
    assert "Dry run" in body


def test_cli_missing_diff_file_is_usage_error() -> None:
    # A usage error (not a review outcome) returns non-zero; the workflow still
    # wraps the step in continue-on-error so this cannot gate a PR.
    rc = lane.main(["--diff-file", "/no/such/file.diff", "--out", "/dev/null"])
    assert rc == 2
