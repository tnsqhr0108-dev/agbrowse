#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if command -v sudo >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    git \
    jq \
    unzip \
    xauth \
    xvfb
else
  echo "sudo is not available; skipping system package installation." >&2
fi

npm install
npm link

if command -v agbrowse >/dev/null 2>&1; then
  agbrowse --help >/dev/null
fi

if command -v codex >/dev/null 2>&1; then
  bash ./scripts/install-codex-mcp-agbrowse.sh
else
  cat <<'MSG'
Codex CLI was not found in this container, so MCP registration was skipped.
Install/sign in to Codex in this environment, then run:

  bash ./scripts/install-codex-mcp-agbrowse.sh

AGBROWSE itself is installed and linked.
MSG
fi

cat <<'MSG'

AGBROWSE Codespaces bootstrap complete.

Suggested smoke checks:

  agbrowse status --json
  CHROME_HEADLESS=1 agbrowse start --port 9223
  agbrowse navigate https://example.com
  agbrowse snapshot --interactive --max-nodes 40

For ChatGPT/Gemini/Grok web-ai, a logged-in provider browser profile is still
required. Codespaces is best for repository work and headless smoke checks; use
a real always-on desktop/VPS when provider login or CAPTCHA checks need a
visible browser.
MSG
