#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PID=""

cleanup() {
  if [[ -n "$BACKEND_PID" ]]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# Local review convenience: show sign-up / sign-in codes on screen when no SMTP server is set.
# Anyone who can reach this server can then read those codes, so never leave this on in production.
if [[ -z "${SMTP_HOST:-}" && -z "${VERDICTLAB_DEV_CODES:-}" ]]; then
  export VERDICTLAB_DEV_CODES=true
  echo "NOTE: no SMTP_HOST set, so verification codes will be shown on screen (VERDICTLAB_DEV_CODES=true)."
fi

echo "== Backend =="
cd "$ROOT_DIR/backend"

if [[ -d .venv ]]; then
  PYTHON=".venv/bin/python"
elif [[ -d venv ]]; then
  PYTHON="venv/bin/python"
else
  python3 -m venv .venv
  PYTHON=".venv/bin/python"
fi

if ! "$PYTHON" -c 'import fastapi, pandas, sentic, textblob, vaderSentiment' >/dev/null 2>&1; then
  echo "Python dependencies are incomplete; installing from requirements.txt."
  "$PYTHON" -m pip install -q -r requirements.txt
fi

"$PYTHON" - <<'PY'
from app.services import sentic
if not sentic.available():
    raise SystemExit("ERROR: SenticNet is not available. Run: pip install sentic")
print("SenticNet OK")
PY

"$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

for attempt in {1..30}; do
  if curl --silent --fail http://127.0.0.1:8000/health >/dev/null; then
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "ERROR: Backend stopped while starting." >&2
    exit 1
  fi
  sleep 1
  if [[ "$attempt" == 30 ]]; then
    echo "ERROR: Backend did not become ready on http://127.0.0.1:8000." >&2
    exit 1
  fi
done
echo "Backend ready at http://127.0.0.1:8000"

echo "== Frontend =="
cd "$ROOT_DIR/frontend"
[ -d node_modules ] || npm install

if [[ -z "${NEXT_PUBLIC_SHARE_ORIGIN:-}" ]]; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
  if [[ -z "$LAN_IP" ]]; then
    LAN_IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
  fi
  if [[ -n "$LAN_IP" ]]; then
    export NEXT_PUBLIC_SHARE_HOST="http://${LAN_IP}"
    echo "Mobile dashboard host: ${NEXT_PUBLIC_SHARE_HOST} (the QR code will use the active frontend port)"
  else
    echo "WARNING: Could not detect a LAN IP. QR codes may only work on this computer." >&2
  fi
fi

npm run dev -- --hostname 0.0.0.0
