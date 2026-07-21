#!/usr/bin/env bash
#
# GOV-1527 §8 — one-command local end-to-end demo of the gated site on 127.0.0.1.
#
#   npm run e2e:local      (or)      bash scripts/local_e2e.sh
#
# Everything is loopback; no deploy token, no network beyond localhost for the
# RUN (venv/pip setup may fetch once). Proves the full 1a contract on the local
# machine:
#   1. Resolve BACKEND_REF=local:<checkout> -> build the artifact with the
#      pinned backend's OWN builder -> run the §2 deny-list tests against it.
#   2. Verify the manifest (commit match vs HEAD, artifact_sha256, schema_version).
#   3. Start service/run.py on loopback; assert a non-loopback bind is refused.
#   4. Build the site + start `vite preview` (127.0.0.1:4173) with /api proxied.
#   5. Smoke: (a) unauth -> landing only, gated -> 403, /api/notifications -> 404
#      while off; (b) an approved session sees reviewer-internal data via /api
#      only; (c) the built static output has zero reviewer-internal / deny-listed
#      content.
#   6. Exit non-zero on any failure; print the artifact manifest as the run record.
#
# Config (env, all optional):
#   GW_BACKEND_CHECKOUT  backend checkout at (or past) $(cat BACKEND_REF); auto-detected
#   GW_REGISTRY_DB       DB the lanes are projected from (read-only); default <checkout>/Database/gov_watchdog.db
#   GW_SERVICE_PORT      loopback service port (default: a free port)
#   GW_PREVIEW_PORT      vite preview port (default 4173)
#   PYTHON               python3 interpreter (default python3)
#   GW_KEEP_UP=1         leave the service + preview running after smoke (for screenshots)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PY="${PYTHON:-python3}"
PIN="$(tr -d '[:space:]' < BACKEND_REF)"

say()  { printf '\n\033[1m[e2e] %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m[e2e] FAIL: %s\033[0m\n' "$*" >&2; exit 1; }

# --- locate a backend checkout with the pinned builder ----------------------
BACKEND="${GW_BACKEND_CHECKOUT:-}"
if [ -z "$BACKEND" ]; then
  for c in /Users/IA/Code/Government-watchdog /Users/IA/GitHub/Government-watchdog /Users/IA/GitHub/Government-Watchdog; do
    if [ -f "$c/scripts/export_web_artifact.py" ]; then BACKEND="$c"; break; fi
  done
fi
[ -n "$BACKEND" ] && [ -f "$BACKEND/scripts/export_web_artifact.py" ] \
  || fail "no backend checkout with scripts/export_web_artifact.py — set GW_BACKEND_CHECKOUT to a checkout at ref $PIN"
REGISTRY_DB="${GW_REGISTRY_DB:-$BACKEND/Database/gov_watchdog.db}"
[ -f "$REGISTRY_DB" ] || fail "registry DB not found at $REGISTRY_DB (set GW_REGISTRY_DB)"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/gov1527-e2e.XXXXXX")"
SERVICE_DB="$WORK/e2e-service.db"
free_port() { $PY -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()'; }
# Free ports by default (never collide with a long-lived local demo, e.g. the
# gov798 preview that persists on 4173).
SERVICE_PORT="${GW_SERVICE_PORT:-$(free_port)}"
PREVIEW_PORT="${GW_PREVIEW_PORT:-$(free_port)}"
export GW_SERVICE_PORT="$SERVICE_PORT"

SERVICE_PID=""; PREVIEW_PID=""
cleanup() {
  [ -n "$PREVIEW_PID" ] && kill "$PREVIEW_PID" 2>/dev/null || true
  [ -n "$SERVICE_PID" ] && kill "$SERVICE_PID" 2>/dev/null || true
  rm -rf "$WORK"
}
[ "${GW_KEEP_UP:-}" = "1" ] || trap cleanup EXIT

# --- isolated python env (accounts code needs argon2-cffi) -------------------
say "python env (argon2-cffi for the account closure; pytest for the deny-list suite)"
$PY -m venv "$WORK/venv"
# shellcheck disable=SC1091
. "$WORK/venv/bin/activate"
pip install -q --disable-pip-version-check argon2-cffi pytest >/dev/null 2>&1 \
  || say "warning: could not install argon2-cffi/pytest (offline?) — continuing; some legs may fail"

# --- step 1: build + deny-list-test + stage the artifact --------------------
say "1/6 build artifact from local:$BACKEND (registry DB read-only) + verify + stage"
BACKEND_REF="local:$BACKEND" GW_DEMO_DB="$REGISTRY_DB" node scripts/fetch-artifact.mjs

say "1b/6 run the §2 deny-list / service tests against the pinned backend"
if ( cd "$BACKEND" && "$WORK/venv/bin/python" -m pytest -q tests/test_gov1526_export_web_artifact.py ); then
  say "deny-list tests PASS"
else
  fail "deny-list tests failed (§2) — artifact would not ship"
fi

ART="$ROOT/.artifact/artifact"
SERVICE_DIR="$ART/service"
[ -f "$SERVICE_DIR/run.py" ] || fail "staged artifact missing service/run.py"

# --- step 2: manifest already verified by fetch-artifact --------------------
say "2/6 manifest verified (commit/sha/schema) — see .artifact/INTEGRATION.json"

# --- step 3: seed service DB, assert loopback-only, start service -----------
say "3/6 migrate throwaway service DB + seed an approved reviewer session"
# Migrations live in the backend checkout (never shipped in the artifact — the
# artifact carries only the runtime service closure). Apply them from there.
"$WORK/venv/bin/python" -c "import sys,pathlib; sys.path.insert(0,'$BACKEND/scripts'); import db; db.apply_migrations(pathlib.Path('$SERVICE_DB'))"
TOKEN="$("$WORK/venv/bin/python" scripts/seed_demo_session.py --db "$SERVICE_DB" --service-dir "$SERVICE_DIR" | tail -1)"
[ -n "$TOKEN" ] || fail "seed produced no session token"

say "3b/6 assert the service refuses a non-loopback bind"
"$WORK/venv/bin/python" - "$SERVICE_DIR" "$SERVICE_DB" <<'PY' || fail "service did NOT refuse a non-loopback bind (§5)"
import sys, pathlib
sys.path.insert(0, sys.argv[1])
import run
try:
    run.serve(pathlib.Path(sys.argv[2]), host="0.0.0.0")
    print("bound to 0.0.0.0 — CONTRACT VIOLATION"); sys.exit(1)
except run.BindError:
    print("ok: non-loopback bind refused"); sys.exit(0)
PY

say "3c/6 start loopback service on 127.0.0.1:$SERVICE_PORT"
"$WORK/venv/bin/python" "$SERVICE_DIR/run.py" --db "$SERVICE_DB" --port "$SERVICE_PORT" &
SERVICE_PID=$!
for _ in $(seq 1 40); do
  curl -sf "http://127.0.0.1:$SERVICE_PORT/api/health" >/dev/null 2>&1 && break
  sleep 0.25
done
curl -sf "http://127.0.0.1:$SERVICE_PORT/api/health" >/dev/null 2>&1 || fail "service health never came up"

# --- step 4: build the site + start preview with /api proxy -----------------
say "4/6 build site + start vite preview (127.0.0.1:$PREVIEW_PORT, /api -> service)"
npm run build >/dev/null
npm run preview -- --port "$PREVIEW_PORT" --strictPort >/dev/null 2>&1 &
PREVIEW_PID=$!
for _ in $(seq 1 40); do
  curl -sf "http://127.0.0.1:$PREVIEW_PORT/" >/dev/null 2>&1 && break
  sleep 0.25
done
BASE="http://127.0.0.1:$PREVIEW_PORT"
curl -sf "$BASE/" >/dev/null 2>&1 || fail "preview never came up"
# Wait for the /api proxy path to be live end-to-end (proxy + service), so the
# smoke never races the SPA fallback answering an /api route before the proxy
# is wired.
for _ in $(seq 1 40); do
  curl -s "$BASE/api/health" | grep -q '"status": "ok"' && break
  sleep 0.25
done
# Require the REAL service JSON (not an SPA-fallback HTML 200) — proves the proxy
# path actually reached the loopback service.
curl -s "$BASE/api/health" | grep -q '"status": "ok"' \
  || fail "same-origin /api proxy never reached the service (no health JSON through preview)"

# --- step 5: smoke assertions (through the preview /api proxy) --------------
say "5/6 smoke assertions (all through the same-origin proxy)"

# (a) unauthenticated surfaces
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")
[ "$code" = "200" ] || fail "landing not 200 (got $code)"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/reviewer-internal")
[ "$code" = "403" ] || fail "unauth /api/reviewer-internal expected 403, got $code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/notifications")
[ "$code" = "404" ] || fail "/api/notifications expected 404 while flag off, got $code"
say "  (a) unauth: landing 200, gated 403, notifications 404 — OK"

# (b) approved session sees the gated lane via /api ONLY
body=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/reviewer-internal")
rows=$("$WORK/venv/bin/python" -c "import sys,json;d=json.loads(sys.stdin.read());print(len(d.get('reviewer_internal_records',[])))" <<<"$body")
[ "${rows:-0}" -gt 0 ] || fail "approved session saw 0 reviewer-internal rows (expected gated data)"
say "  (b) approved session: /api/reviewer-internal 200 with $rows gated rows — OK"

# (c) the gated lane is never a static asset, and no raw absolute paths ride the
#     static bundle (§2 clause 1/2). Field-NAME identifiers in app code (e.g.
#     `statement_text`) are fine — we check for leaked DATA, not for code symbols.
if find dist/client -name 'reviewer_internal*.json' | grep -q .; then
  fail "gated lane shipped as a static asset (§2 clause 2)"
fi
# A real leak is a POPULATED path (`/Users/<name>/...`), not the bare prefix the
# web-safe sweeper carries as a detector constant. Require a named segment.
LEAK_RE='/(Users|home|private)/[A-Za-z0-9._-]+/[A-Za-z0-9._ -]|Obsidian Vault/[A-Za-z0-9._ -]'
if grep -RElE "$LEAK_RE" dist/client >/dev/null 2>&1; then
  grep -REnoE "$LEAK_RE" dist/client >&2
  fail "built static output contains a real raw absolute/vault path (§2 clause 1)"
fi
say "  (c) static output clean: no gated lane asset, no populated raw/vault paths — OK"

# --- step 6: run record ------------------------------------------------------
say "6/6 DONE — artifact manifest / integration record:"
cat "$ROOT/.artifact/INTEGRATION.json"

if [ "${GW_KEEP_UP:-}" = "1" ]; then
  printf '\n[e2e] GW_KEEP_UP=1 — service (pid %s) + preview %s left running. Token: %s\n' \
    "$SERVICE_PID" "$BASE" "$TOKEN"
  printf '[e2e] Ctrl-C to stop; then: kill %s %s; rm -rf %s\n' "$SERVICE_PID" "$PREVIEW_PID" "$WORK"
fi
say "local e2e PASSED ✓"
