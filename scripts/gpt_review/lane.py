"""GPT independent review lane — orchestration + CLI (website/PUBLIC leg, GOV-2208).

Flow (one PR run):

    build_payload(diff, title, body)   # C5 — these three inputs, nothing else
      -> scan_payload (C1)             # a hit WITHHOLDS; never transmits, never echoes
      -> transmit to OpenRouter        # only when clean AND --transmit AND key present
      -> format ONE advisory comment   # marker for upsert; heading distinct from Claude/VSR

Every review *outcome* — clean, withheld, unavailable, model-error — resolves to
a comment body and **exit code 0**. The lane never fails the PR (C2). Only a
genuine usage error (missing diff file) exits non-zero, and the workflow still
wraps the step in ``continue-on-error`` so even that cannot gate the PR.

The OpenRouter call is injected as ``transport`` so tests run fully offline; the
default transport is the only place a network request is made.

**No C4 pin here, on purpose.** The website repo is PUBLIC (GOV-2214), so this
leg transmits public diffs under C1/C2/C3/C5 with no zero-retention requirement.
C4 (``provider: {data_collection: "deny"}``) attaches to the *private* backend
leg, not this file.
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass, field
from typing import Callable, Optional, Sequence

from .scan import matched_rules, scan_payload

# --- Constants that define the lane's identity on a PR --------------------------

#: Hidden HTML marker used to find-and-update the single advisory comment (upsert).
MARKER = "<!-- gpt-independent-review-lane -->"

#: Human heading — deliberately distinct from the Claude/VSR pass so the two
#: lanes never blur (ADR §"Where findings surface").
HEADING = "🤖 GPT independent review (advisory · gpt-oss via OpenRouter)"

#: Free-tier GPT-class model, then a non-GPT fallback if gpt-oss capacity is out.
#: Pinned against OpenRouter's free list at implementation time (ADR §Provider).
DEFAULT_MODELS: tuple[str, ...] = ("openai/gpt-oss-120b", "mistralai/mistral-nemo")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

#: C5 — an independently-authored rubric. It is fed ONLY the diff + title/body and
#: is never shown Claude's or VSR's output, notes, or system prompt.
SYSTEM_PROMPT = (
    "You are an independent code reviewer. You are given ONLY a pull request's "
    "raw git diff plus its title and body — no other repository context, no notes "
    "from any other reviewer, and no prior review. Review the diff on its own "
    "merits for: correctness bugs, security issues (injection, secret handling, "
    "auth/authorization, unsafe file/path handling), data-integrity and "
    "concurrency hazards, and unclear or risky changes. Be concise and specific: "
    "cite the file and hunk. If the diff looks fine, say so briefly. Do not invent "
    "context you were not given. Your review is advisory."
)

# Fixed advisory footer so a human always knows the lane's posture.
_FOOTER = (
    "\n\n---\n_Advisory only — this comment never blocks the merge (ADR §7 C2). "
    "Independent of the Claude/VSR review: this lane sees only the diff + PR "
    "title/body (C5)._"
)


# --- Result model ---------------------------------------------------------------

@dataclass(frozen=True)
class ReviewResult:
    """The outcome of one lane run. ``comment`` is the exact body to upsert."""

    status: str  # "reviewed" | "withheld" | "unavailable" | "preview"
    comment: str
    model: Optional[str] = None
    rules: tuple[str, ...] = field(default_factory=tuple)


# A transport takes (model, messages, api_key) and returns the model's text, or
# raises on any failure. Injected for tests; the default hits OpenRouter.
Transport = Callable[[str, list[dict], str], str]


def build_payload(diff: str, title: str, body: str) -> str:
    """Assemble the EXACT string that will be scanned and sent — C5 boundary.

    This function is the whole input surface of the lane. It reads its three
    arguments and nothing else — no files, no env, no Claude/VSR artifacts — so
    "zero context bleed" is a property of the call signature, not a promise.
    """
    title = title or "(no title)"
    body = (body or "").strip() or "(no body)"
    return (
        f"PR title:\n{title}\n\n"
        f"PR body:\n{body}\n\n"
        f"Diff:\n{diff}"
    )


def build_messages(payload: str) -> list[dict]:
    """OpenRouter chat messages: the independent rubric + the diff-only payload."""
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": payload},
    ]


def _wrap(body: str) -> str:
    """Prefix the marker + heading and append the advisory footer to any body."""
    return f"{MARKER}\n### {HEADING}\n\n{body}{_FOOTER}"


def _withheld_comment(rules: Sequence[str]) -> str:
    rule_list = ", ".join(f"`{r}`" for r in rules) if rules else "(rule list withheld)"
    return _wrap(
        "⚠️ **Review unavailable — payload withheld.** The pre-transmit "
        "secret/PII scan flagged this PR, so the diff was **not** sent to the "
        "third-party model (ADR §7 C1). No detected value is echoed here.\n\n"
        f"Rules matched: {rule_list}.\n\n"
        "Resolve the flagged content — or, if it is a false positive, note that "
        "on the PR — and push again to re-run the lane."
    )


def _unavailable_comment(reason: str) -> str:
    return _wrap(
        f"ℹ️ **Review unavailable — {reason}.** The advisory lane was skipped; "
        "the merge is unaffected (C2). Persistent unavailability returns to CEO "
        "for a spend decision rather than attaching billing (C3)."
    )


def review(
    diff: str,
    title: str,
    body: str,
    *,
    api_key: Optional[str],
    transmit: bool,
    models: Sequence[str] = DEFAULT_MODELS,
    transport: Optional[Transport] = None,
) -> ReviewResult:
    """Run one review and return the comment body to upsert. Never raises for a
    review outcome — every branch yields a :class:`ReviewResult`.
    """
    payload = build_payload(diff, title, body)

    # C1 — scan the exact payload FIRST. A hit withholds unconditionally.
    findings = scan_payload(payload)
    if findings:
        rules = tuple(sorted({f.rule for f in findings}))
        return ReviewResult(status="withheld", comment=_withheld_comment(rules), rules=rules)

    # Dry-run: prove the payload is clean and buildable without any network.
    if not transmit:
        return ReviewResult(
            status="preview",
            comment=_wrap(
                "✅ **Dry run** — payload scanned clean (C1) and ready to send. "
                "No transmission performed."
            ),
        )

    if not api_key:
        return ReviewResult(
            status="unavailable",
            comment=_unavailable_comment("model not configured (OPENROUTER_API_KEY absent)"),
        )

    messages = build_messages(payload)
    send = transport or _default_transport
    last_err: Optional[Exception] = None
    for model in models:
        try:
            text = send(model, messages, api_key)
        except Exception as exc:  # noqa: BLE001 — advisory: any failure => unavailable
            last_err = exc
            continue
        if text and text.strip():
            return ReviewResult(status="reviewed", comment=_wrap(text.strip()), model=model)
        last_err = RuntimeError(f"{model} returned an empty completion")

    reason = "free-tier model did not respond (rate limit or outage)"
    if last_err is not None:
        # Class name only — never interpolate a provider error body (could echo payload).
        reason = f"{reason} [{type(last_err).__name__}]"
    return ReviewResult(status="unavailable", comment=_unavailable_comment(reason))


def _request_body(model: str, messages: list[dict]) -> dict:
    """The exact JSON body POSTed to OpenRouter. Extracted so the request shape
    is unit-testable offline.

    Public leg (GOV-2214): NO ``provider: {data_collection: "deny"}`` pin — the
    website repo is public, so C4 does not apply. If this file is ever reused for
    a private repo, add that pin here and route to SPA for the C4 co-sign.
    """
    return {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 900,
    }


def _default_transport(model: str, messages: list[dict], api_key: str) -> str:
    """The only network call. Imported lazily so the module loads without requests."""
    import requests  # local import: keeps import-time deps minimal and testable

    resp = requests.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            # Optional attribution headers OpenRouter recommends; harmless if unset.
            "HTTP-Referer": "https://github.com/xXKillerNoobYT/Government-watchdog-website",
            "X-Title": "GW website GPT independent review (advisory)",
        },
        json=_request_body(model, messages),
        timeout=90,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


# --- CLI ------------------------------------------------------------------------

def _parse_args(argv: Optional[Sequence[str]]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="gpt_review.lane",
        description="GPT independent review lane (advisory) — scan, transmit, emit comment body.",
    )
    p.add_argument("--diff-file", required=True, help="path to the raw PR diff")
    p.add_argument("--title", default=os.environ.get("PR_TITLE", ""), help="PR title")
    p.add_argument("--body", default=os.environ.get("PR_BODY", ""), help="PR body")
    p.add_argument("--out", required=True, help="path to write the comment body")
    p.add_argument(
        "--transmit",
        action="store_true",
        help="actually call OpenRouter (default: dry-run, no network)",
    )
    p.add_argument(
        "--model",
        action="append",
        dest="models",
        help="override model(s); repeatable. Default: gpt-oss-120b then nemo.",
    )
    return p.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = _parse_args(argv)
    try:
        diff = _read_diff(args.diff_file)
    except OSError as exc:
        # A usage error, not a review outcome. The workflow still wraps this step
        # in continue-on-error, so this cannot gate the PR (C2).
        print(f"[gpt-review] cannot read diff file {args.diff_file!r}: {exc}", file=sys.stderr)
        return 2

    result = review(
        diff,
        args.title,
        args.body,
        api_key=os.environ.get("OPENROUTER_API_KEY"),
        transmit=args.transmit,
        models=tuple(args.models) if args.models else DEFAULT_MODELS,
    )

    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(result.comment)

    # Status → stdout only (never the comment/values), for the CI log.
    line = f"[gpt-review] status={result.status}"
    if result.model:
        line += f" model={result.model}"
    if result.rules:
        line += f" rules={','.join(result.rules)}"
    print(line)
    return 0


def _read_diff(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        return fh.read()


if __name__ == "__main__":  # pragma: no cover — exercised via subprocess in CI
    raise SystemExit(main())
