#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CODEX_HOME_VALUE="${CODEX_HOME:-"$HOME/.codex"}"
INSTALL_CHROME=0
INSTALL_AGBROWSE=1

usage() {
  cat <<'USAGE'
Usage: bootstrap-always-on-codex-host.sh [--install-chrome] [--skip-agbrowse-install]

Prepare an always-on Linux/SSH Codex host for AGBROWSE MCP use.

This script does not create a VPS, sign in to Codex, or sign in to ChatGPT.
Run it on the always-on host after Node.js 18+ and Codex are available.

Options:
  --install-chrome        Install google-chrome-stable with apt on Debian/Ubuntu.
  --skip-agbrowse-install Do not run npm install -g agbrowse.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --install-chrome) INSTALL_CHROME=1 ;;
    --skip-agbrowse-install) INSTALL_AGBROWSE=0 ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

node_major() {
  node -p "Number(process.versions.node.split('.')[0])"
}

install_browser_debian() {
  need_cmd sudo
  need_cmd curl
  local arch
  arch="$(dpkg --print-architecture)"
  if [ "$arch" = "amd64" ]; then
    need_cmd gpg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
      | sudo gpg --dearmor -o /etc/apt/keyrings/google-linux.gpg
    echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-linux.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
      | sudo tee /etc/apt/sources.list.d/google-chrome.list >/dev/null
    sudo apt-get update
    sudo apt-get install -y google-chrome-stable xvfb xauth
  elif [ "$arch" = "arm64" ]; then
    sudo apt-get update
    sudo apt-get install -y chromium-browser chromium xvfb xauth || sudo apt-get install -y chromium-browser xvfb xauth
  else
    echo "Unsupported browser install architecture: $arch" >&2
    exit 1
  fi
}

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ is required before running this bootstrap." >&2
  exit 1
fi

if [ "$(node_major)" -lt 18 ]; then
  echo "Node.js 18+ is required. Current version: $(node -v)" >&2
  exit 1
fi

need_cmd npm
need_cmd codex

if [ "$INSTALL_CHROME" -eq 1 ]; then
  if command -v google-chrome-stable >/dev/null 2>&1; then
    echo "google-chrome-stable already installed."
  elif command -v chromium >/dev/null 2>&1 || command -v chromium-browser >/dev/null 2>&1; then
    echo "Chromium already installed."
  elif command -v apt-get >/dev/null 2>&1; then
    install_browser_debian
  else
    echo "--install-chrome currently supports Debian/Ubuntu apt hosts only." >&2
    exit 1
  fi
fi

if [ "$INSTALL_AGBROWSE" -eq 1 ]; then
  npm install -g agbrowse
fi

need_cmd agbrowse

mkdir -p "$CODEX_HOME_VALUE/skills"
agbrowse skills install --target "$CODEX_HOME_VALUE/skills" --force --json >/dev/null

if command -v google-chrome-stable >/dev/null 2>&1; then
  export CHROME_BINARY_PATH="${CHROME_BINARY_PATH:-$(command -v google-chrome-stable)}"
elif command -v chromium >/dev/null 2>&1; then
  export CHROME_BINARY_PATH="${CHROME_BINARY_PATH:-$(command -v chromium)}"
elif command -v chromium-browser >/dev/null 2>&1; then
  export CHROME_BINARY_PATH="${CHROME_BINARY_PATH:-$(command -v chromium-browser)}"
fi

export CODEX_CONFIG="${CODEX_CONFIG:-"$CODEX_HOME_VALUE/config.toml"}"
export AGBROWSE_CMD="${AGBROWSE_CMD:-$(command -v agbrowse)}"
export CDP_PORT="${CDP_PORT:-9223}"

bash "$SCRIPT_DIR/install-codex-mcp-agbrowse.sh"

agbrowse --help >/dev/null

cat <<SUMMARY
Always-on Codex host bootstrap complete.

Configured:
- CODEX_HOME: $CODEX_HOME_VALUE
- Codex config: $CODEX_CONFIG
- AGBROWSE command: $AGBROWSE_CMD
- CDP_PORT: $CDP_PORT

Next manual steps on this always-on host:
1. Sign in to Codex with the same ChatGPT account/workspace.
2. Start a new Codex session so the agbrowse_web_ai MCP server loads.
3. Start headed AGBROWSE Chrome and complete ChatGPT web login:
   agbrowse start --headed --port "$CDP_PORT"
   agbrowse navigate https://chatgpt.com/
4. Verify:
   agbrowse web-ai status --vendor chatgpt --url https://chatgpt.com/ --json

Mobile can use AGBROWSE only while this always-on host stays awake and online.
SUMMARY
