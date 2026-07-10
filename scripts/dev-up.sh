#!/usr/bin/env bash
# Starts all 3 local services: Centrifugo (Podman), realtime-server, web app.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env — copy the example and fill in your keys first:"
  echo "  cp .env.example .env"
  exit 1
fi

set -a
source .env
set +a

echo "==> Centrifugo (Podman, :8000)"
if ! command -v podman >/dev/null 2>&1; then
  echo "Podman not found — install: https://podman.io/docs/installation"
  exit 1
fi
if podman ps -a --format '{{.Names}}' 2>/dev/null | grep -qx mp-centrifugo; then
  podman start mp-centrifugo >/dev/null
else
  podman run -d --name mp-centrifugo -p 8000:8000 \
    -v "$PWD/centrifugo:/centrifugo:ro" \
    -e CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY="${CENTRIFUGO_HMAC_SECRET:-change-me-long-random}" \
    -e CENTRIFUGO_HTTP_API_KEY="${CENTRIFUGO_API_KEY:-change-me-api-key}" \
    centrifugo/centrifugo:v6 centrifugo -c /centrifugo/config.json >/dev/null
fi || { echo "Could not reach Podman — on macOS/Windows run: podman machine start"; exit 1; }

echo "==> realtime-server (:3001)"
[ -f services/realtime-server/.env ] || cp .env services/realtime-server/.env
(cd services/realtime-server && nohup npm run dev >/tmp/stt-meeting-realtime.log 2>&1 &)

echo "==> web app (:5173)"
nohup npm run dev >/tmp/stt-meeting-web.log 2>&1 &

sleep 2
cat <<EOF

Ready:
  Web app      -> http://localhost:5173
  Centrifugo   -> http://localhost:8000
  Realtime WS  -> ws://localhost:3001/realtime

Logs: /tmp/stt-meeting-web.log , /tmp/stt-meeting-realtime.log
Stop everything: ./scripts/dev-down.sh
EOF
