#!/bin/sh
# GOV-1544 — container entrypoint (GOV-1543 §2 runbook step 1).
# Starts the loopback-only artifact service, then Caddy in the foreground
# (PID 1). If the service dies, /api/* degrades to 502 while the public
# landing keeps serving (contract §6) — the platform health check on
# /api/health surfaces it.
set -eu

DB="${GW_DB_PATH:-/data/gw.db}"

if [ -d /srv/artifact ]; then
  # First boot on a fresh volume: initialize the EMPTY accounts/flags/outbox
  # DB from the artifact's seedless schema (zero rows, zero civic data —
  # migrations never ship). Every feature flag starts absent = off.
  if [ ! -f "$DB" ]; then
    python3 - "$DB" <<'PY'
import sqlite3
import sys

conn = sqlite3.connect(sys.argv[1])
conn.executescript(open("/srv/artifact/service/schema.sql").read())
conn.commit()
conn.close()
PY
  fi
  # GW_VERIFY_BASE_URL (runtime env): public origin baked into magic-link
  # emails. GW_SMTP_* runtime secrets are read by the service itself —
  # credentials only; activation stays the owner-gated DB flag.
  python3 /srv/artifact/service/run.py --db "$DB" --port 8100 \
    ${GW_VERIFY_BASE_URL:+--verify-base-url "$GW_VERIFY_BASE_URL"} &
else
  echo "no staged artifact (LANDING_ONLY build) — serving static landing only, no /api" >&2
fi

exec caddy run --config /etc/caddy/Caddyfile
