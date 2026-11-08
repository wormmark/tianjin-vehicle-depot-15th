#!/bin/zsh
set -eu

cd "$(dirname "$0")"
SWAP_URL="http://127.0.0.1:4173/素材替换台.html"
STATE_URL="http://127.0.0.1:4173/api/image-state"

if curl -fsS "$STATE_URL" >/dev/null 2>&1; then
  open "$SWAP_URL"
  exit 0
fi

export TJ15_OPEN_BROWSER=1
exec node server.mjs
