#!/usr/bin/env bash
set -euo pipefail

CDP_PORT_VALUE="${CDP_PORT:-9223}"
CHECK_INTERVAL="${AGBROWSE_SERVICE_CHECK_INTERVAL:-30}"
HEADED="${AGBROWSE_SERVICE_HEADED:-0}"

START_ARGS=(start --port "$CDP_PORT_VALUE")
if [ "$HEADED" = "1" ]; then
  START_ARGS+=(--headed)
else
  export CHROME_HEADLESS="${CHROME_HEADLESS:-1}"
  START_ARGS+=(--headless)
fi

echo "Starting AGBROWSE CDP on port $CDP_PORT_VALUE"
agbrowse "${START_ARGS[@]}"

while true; do
  status_json="$(agbrowse status --json 2>/dev/null || true)"
  if ! printf '%s' "$status_json" | node -e '
let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    const status = JSON.parse(input);
    if (status.running === true) process.exit(0);
  } catch {
    if (/running:\s*true/i.test(input)) process.exit(0);
  }
  process.exit(1);
});
'; then
    echo "AGBROWSE CDP health check failed; systemd should restart the service." >&2
    exit 1
  fi
  sleep "$CHECK_INTERVAL"
done
