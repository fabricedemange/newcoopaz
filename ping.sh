#!/bin/bash

URL="https://cde.coopaz.fr/"   # ← remplace par l'URL à ping
INTERVAL=60                    # intervalle en secondes (ici 5 minutes)

while true; do
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  if curl -fsS "$URL" -o /dev/null; then
    echo "[$timestamp] Ping OK"
  else
    echo "[$timestamp] Échec du ping" >&2
  fi
  sleep "$INTERVAL"
done