#!/bin/sh
# GOV-1544 — container entrypoint (GOV-1543 §2 runbook step 1).
# Starts the loopback-only artifact service, then Caddy in the foreground
# (PID 1). This is the private-runtime image only: a missing artifact is fatal,
# never an implicit public/landing-only mode. The independent public-free Sites
# package is built with `npm run build` and does not use this entrypoint.
set -eu

DB="${GW_DB_PATH:-/data/gw.db}"

if [ ! -d /srv/artifact ]; then
  echo "fatal: verified private-runtime artifact is missing; refusing to start" >&2
  exit 1
fi

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

exec caddy run --config /etc/caddy/Caddyfile
