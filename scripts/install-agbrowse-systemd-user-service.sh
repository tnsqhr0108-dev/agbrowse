#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CDP_PORT_VALUE="${CDP_PORT:-9223}"
HEADED=0
START_NOW=1
ENABLE_LINGER=0

usage() {
  cat <<'USAGE'
Usage: install-agbrowse-systemd-user-service.sh [--port 9223] [--headed] [--no-start] [--enable-linger]

Install a user-level systemd service that keeps an AGBROWSE CDP browser running
on an always-on Linux host.

Options:
  --port <port>       CDP port to use. Default: 9223 or CDP_PORT.
  --headed            Start headed Chrome. Requires a working DISPLAY/session.
  --no-start          Install and enable the service, but do not start it now.
  --enable-linger     Attempt loginctl enable-linger for the current user.
  --help, -h          Show this help.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --port)
      CDP_PORT_VALUE="${2:?--port requires a value}"
      shift
      ;;
    --headed)
      HEADED=1
      ;;
    --no-start)
      START_NOW=0
      ;;
    --enable-linger)
      ENABLE_LINGER=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_cmd agbrowse
need_cmd node
need_cmd systemctl

if [ "$HEADED" = "1" ] && [ -z "${DISPLAY:-}" ]; then
  echo "--headed requires DISPLAY to be set. Use headless mode or configure a remote desktop first." >&2
  exit 1
fi

mkdir -p "$HOME/.local/bin" "$HOME/.config/agbrowse" "$HOME/.config/systemd/user"
install -m 0755 "$SCRIPT_DIR/agbrowse-cdp-service-loop.sh" "$HOME/.local/bin/agbrowse-cdp-service-loop"

cat > "$HOME/.config/agbrowse/agbrowse-cdp.env" <<EOF
CDP_PORT=$CDP_PORT_VALUE
AGBROWSE_JSON_ERRORS=1
AGBROWSE_SERVICE_HEADED=$HEADED
AGBROWSE_SERVICE_CHECK_INTERVAL=30
EOF

if [ -n "${CHROME_BINARY_PATH:-}" ]; then
  printf 'CHROME_BINARY_PATH=%s\n' "$CHROME_BINARY_PATH" >> "$HOME/.config/agbrowse/agbrowse-cdp.env"
fi

cat > "$HOME/.config/systemd/user/agbrowse-cdp.service" <<'EOF'
[Unit]
Description=AGBROWSE CDP browser
After=network-online.target

[Service]
Type=simple
EnvironmentFile=%h/.config/agbrowse/agbrowse-cdp.env
ExecStart=%h/.local/bin/agbrowse-cdp-service-loop
ExecStop=/usr/bin/env bash -lc 'agbrowse stop || true'
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable agbrowse-cdp.service >/dev/null

if [ "$START_NOW" = "1" ]; then
  systemctl --user restart agbrowse-cdp.service
fi

if [ "$ENABLE_LINGER" = "1" ]; then
  if command -v loginctl >/dev/null 2>&1; then
    if command -v sudo >/dev/null 2>&1; then
      sudo loginctl enable-linger "$USER"
    else
      loginctl enable-linger "$USER"
    fi
  else
    echo "loginctl was not found; skipping linger enablement." >&2
  fi
fi

systemctl --user --no-pager status agbrowse-cdp.service || true

cat <<SUMMARY
AGBROWSE systemd user service installed.

Service:
  systemctl --user status agbrowse-cdp.service

Verify:
  node scripts/verify-always-on-codex-host.mjs --require-service

Mobile can use this host only while the host is online and reachable through
Codex/SSH/MCP. Provider web-ai still requires a logged-in browser profile.
SUMMARY
