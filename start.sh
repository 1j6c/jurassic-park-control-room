#!/usr/bin/env bash
# Jurassic Park System Control — local server + browser in kiosk (full screen) mode.
# macOS / Linux. Quit the browser (Cmd+Q / Ctrl+Q) and the server stops with it.
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8765}"
URL="http://localhost:$PORT/"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to serve the files (it ships with macOS; on Linux: apt/dnf install python3)."
  exit 1
fi

SERVER=""
if ! (command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1); then
  (cd "$DIR" && python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1) &
  SERVER=$!
  sleep 0.7
fi
trap '[[ -n "$SERVER" ]] && kill "$SERVER" 2>/dev/null' EXIT

# A dedicated profile: kiosk/autoplay flags are ignored if the browser is already running with your normal profile.
PROFILE="${TMPDIR:-/tmp}/jp-control-room-profile"
FLAGS=(--user-data-dir="$PROFILE" --no-first-run --no-default-browser-check --kiosk --autoplay-policy=no-user-gesture-required "$URL")

CANDIDATES=(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  "/Applications/Chromium.app/Contents/MacOS/Chromium"
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  google-chrome google-chrome-stable chromium chromium-browser brave-browser microsoft-edge
)
for c in "${CANDIDATES[@]}"; do
  if [[ -x "$c" ]] || command -v "$c" >/dev/null 2>&1; then
    "$c" "${FLAGS[@]}" >/dev/null 2>&1
    exit 0
  fi
done

echo "No Chromium-based browser found — opening $URL in your default browser."
echo "Full screen: Toolchest → System → Full screen.  Press Enter here to stop the server."
if command -v open >/dev/null 2>&1; then open "$URL"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"; fi
read -r
