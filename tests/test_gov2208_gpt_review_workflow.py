"""GOV-2208 — structural guards on the GPT-review workflow (advisory website leg).

These bind the SPA conditions into the workflow file itself, so a future edit that
would make the lane a merge gate (C2), add a path filter, drop the pre-transmit
scan (C1), feed it more than the diff (C5), or attach billing (C3) trips a test.

Website-leg specifics (GOV-2214): this repo is PUBLIC, so the header declares the
public posture and the lane carries NO C4 zero-retention pin (that belongs to the
private backend leg). runs-on stays ubuntu-latest — a PUBLIC repo gets free hosted
minutes, and a diff POST needs no self-hosted Mac.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKFLOW = ROOT / ".github/workflows/gpt-review.yml"
SELFTEST = ROOT / ".github/workflows/gpt-review-selftest.yml"
LANE = ROOT / "scripts/gpt_review/lane.py"
SCAN = ROOT / "scripts/gpt_review/scan.py"


def _wf() -> str:
    return WORKFLOW.read_text(encoding="utf-8")


def _wf_code() -> str:
    """Workflow with full-line ``#`` comments stripped.

    Negative assertions ("self-hosted must NOT appear") target the executable
    YAML, not the header prose that *explains why* a thing is absent — the
    comments legitimately say "needs no self-hosted Mac", "alongside the
    Claude/VSR review", "never a required check".
    """
    lines = WORKFLOW.read_text(encoding="utf-8").splitlines()
    return "\n".join(ln for ln in lines if not ln.lstrip().startswith("#"))


def test_workflow_and_modules_exist() -> None:
    assert WORKFLOW.is_file()
    assert SELFTEST.is_file()
    assert LANE.is_file()
    assert SCAN.is_file()


def test_triggers_on_pull_request_with_no_path_filter() -> None:
    text = _wf()
    assert "pull_request:" in text
    # "all updates" — no path filter narrowing which PRs are reviewed.
    assert "paths:" not in text


def test_runs_on_hosted_runner_not_self_hosted() -> None:
    # PUBLIC repo => free hosted minutes ($0); no dependency on the gov-website Mac.
    assert "runs-on: ubuntu-latest" in _wf()
    assert "self-hosted" not in _wf_code()


def test_advisory_only_never_a_gate_C2() -> None:
    text = _wf()
    # The review step and comment step both refuse to fail the PR.
    assert text.count("continue-on-error: true") >= 2
    assert "if: always()" in text
    # No branch-protection / required-status machinery in the workflow.
    assert "required" not in _wf_code().lower()


def test_least_privilege_permissions() -> None:
    text = _wf()
    assert "contents: read" in text
    assert "pull-requests: write" in text
    # Never grant write to the repo contents from this advisory job.
    assert "contents: write" not in text


def test_scan_runs_before_transmit_C1() -> None:
    text = _wf()
    # The lane entrypoint is invoked (which scans before it transmits), and the
    # scan module is the one that gates it.
    assert "gpt_review.lane" in text
    # And the module actually orders scan-before-send.
    lane = LANE.read_text(encoding="utf-8")
    scan_at = lane.find("scan_payload(payload)")
    send_at = lane.find("send(model, messages, api_key)")
    assert scan_at != -1 and send_at != -1 and scan_at < send_at


def test_diff_only_input_C5() -> None:
    text = _wf()
    # Only diff + title + body are passed to the lane.
    assert "--diff-file pr.diff" in text
    assert "--title" in text and "--body" in text
    # No repository/agent/Claude/VSR context is fed to the lane (comments that
    # explain the independence are stripped; only executable YAML is checked).
    code = _wf_code().lower()
    for forbidden in ("claude", "vsr", "review-notes", "agents.md"):
        assert forbidden not in code


def test_key_is_actions_secret_no_billing_C3() -> None:
    text = _wf()
    assert "secrets.OPENROUTER_API_KEY" in text
    # The key is never printed/committed, and the file documents the no-billing rule.
    assert "no billing" in text.lower() or "NO billing" in text
    assert "OPENROUTER_API_KEY: sk-" not in text  # never a literal key


def test_comment_is_upserted_not_stacked() -> None:
    text = _wf()
    assert "gpt-independent-review-lane" in text  # the upsert marker
    assert "-X PATCH" in text  # updates the existing comment
    assert "-X POST" in text   # or creates the first one


# --- website-leg (GOV-2214) posture ---------------------------------------------

def test_header_declares_public_website_leg_no_c4() -> None:
    text = _wf()
    assert "PUBLIC" in text
    assert "website" in text.lower()
    # The header states, in prose, that C4 does not apply to this leg.
    assert "C4" in text
    assert "does NOT need C4" in text or "does not need C4" in text.lower()


def test_selftest_is_scoped_to_lane_changes() -> None:
    st = SELFTEST.read_text(encoding="utf-8")
    # The self-test only fires on lane code / test / workflow changes — it must
    # NOT gate unrelated website PRs.
    assert "paths:" in st
    assert "scripts/gpt_review/**" in st
    assert "pytest" in st
