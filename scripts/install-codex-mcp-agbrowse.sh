#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="${CODEX_CONFIG:-"$HOME/.codex/config.toml"}"
AGBROWSE_CMD="${AGBROWSE_CMD:-agbrowse}"
CDP_PORT_VALUE="${CDP_PORT:-9223}"
CHROME_BINARY_VALUE="${CHROME_BINARY_PATH:-}"

if ! command -v "$AGBROWSE_CMD" >/dev/null 2>&1; then
  echo "AGBROWSE command was not found: $AGBROWSE_CMD. Install it first with npm install -g agbrowse." >&2
  exit 1
fi

mkdir -p "$(dirname "$CONFIG_PATH")"

if [ -f "$CONFIG_PATH" ] && grep -Eq '^\[mcp_servers\.agbrowse_web_ai\][[:space:]]*$' "$CONFIG_PATH"; then
  echo "agbrowse_web_ai MCP server is already configured in $CONFIG_PATH"
  exit 0
fi

{
  printf '\n[mcp_servers.agbrowse_web_ai]\n'
  printf 'command = "%s"\n' "$AGBROWSE_CMD"
  printf 'args = ["web-ai", "mcp-server"]\n'
  printf 'startup_timeout_sec = 20\n'
  printf 'tool_timeout_sec = 1800\n'
  printf 'enabled = true\n'
  printf 'required = false\n'
  printf 'default_tools_approval_mode = "prompt"\n'
  printf '\n[mcp_servers.agbrowse_web_ai.env]\n'
  printf 'CDP_PORT = "%s"\n' "$CDP_PORT_VALUE"
  printf 'AGBROWSE_JSON_ERRORS = "1"\n'
  if [ -n "$CHROME_BINARY_VALUE" ]; then
    printf 'CHROME_BINARY_PATH = "%s"\n' "$CHROME_BINARY_VALUE"
  fi
} >> "$CONFIG_PATH"

echo "Added agbrowse_web_ai MCP server to $CONFIG_PATH"
echo "Restart Codex or start a new Codex session before expecting the new MCP tools."
