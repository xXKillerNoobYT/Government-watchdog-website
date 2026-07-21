#!/usr/bin/env python3
"""GOV-1527 local e2e demo — seed one approved reviewer session (LOCAL ONLY).

Simulates the owner-side of the gated-beta flow so the local demo can prove the
gated `/api/reviewer-internal` path end to end, WITHOUT standing up a real
magic-link mail flow. It uses ONLY the pinned backend's own account primitives
(imported from the artifact's ``service/`` tree — nothing is re-implemented):

    create_user -> approve (owner_decision_ref) -> issue_session -> raw token

and optionally appends the ``notifications_http_enabled`` feature flag so the
demo can also exercise the notifications lane. The raw session token is printed
to stdout (the caller's only copy); it is never logged elsewhere.

This is demo scaffolding: it writes to a throwaway service DB, never the
registry. The registry/vault is read-only and only the BUILD step touches it.

Usage:
    python3 scripts/seed_demo_session.py --db <service.db> [--email x] [--enable-notifications]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

OWNER_DECISION_REF = "gov1527-local-e2e-demo"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True, type=Path, help="throwaway service DB (migrated)")
    parser.add_argument("--service-dir", required=True, type=Path,
                        help="artifact service/ dir (provides the account import closure)")
    parser.add_argument("--email", default="reviewer@demo.local")
    parser.add_argument("--enable-notifications", action="store_true")
    args = parser.parse_args(argv)

    # Import the pinned backend's account code from the artifact service tree.
    sys.path.insert(0, str(args.service_dir.resolve()))
    import db  # noqa: E402
    from accounts import service, sessions  # noqa: E402

    conn = db.open_db(args.db)
    try:
        user_id = service.find_user_by_email(conn, args.email)
        if user_id is None:
            user_id = service.create_user(conn, email=args.email)
        # Owner decision: promote to approved (fail-closed gate opens only here).
        service.approve(conn, user_id, owner_decision_ref=OWNER_DECISION_REF)
        _session_id, raw_token = sessions.issue_session(conn, user_id)

        if args.enable_notifications:
            from email_gateway import flags  # noqa: E402
            flags.set_flag(conn, "notifications_http_enabled", enabled=True,
                           owner_decision_ref=OWNER_DECISION_REF)
    finally:
        conn.close()

    # stdout = the raw token ONLY, so the caller can capture it cleanly.
    print(raw_token)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
