#!/usr/bin/env bash
# Stops all 3 local services started by dev-up.sh.
cd "$(dirname "$0")/.."

echo "==> stopping web app (:5173) and realtime-server (:3001)"
lsof -ti:5173 | xargs -r kill 2>/dev/null || true
lsof -ti:3001 | xargs -r kill 2>/dev/null || true

echo "==> stopping Centrifugo"
podman stop mp-centrifugo >/dev/null 2>&1 || true

echo "All stopped."
