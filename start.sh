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

"$PYTHON" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
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
npm run dev
