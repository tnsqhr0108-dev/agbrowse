# Codex MCP, Remote, And Mobile Use

AGBROWSE can be exposed to Codex as a persistent MCP server by registering the
existing stdio bridge:

```text
agbrowse web-ai mcp-server
```

This does not install AGBROWSE into OpenAI's hosted ChatGPT service and does not
modify the official ChatGPT or Codex apps. It gives Codex an MCP tool surface on
the host where Codex is running. If the host is reachable from the ChatGPT
mobile app through Codex remote control, mobile prompts can use the host's
AGBROWSE setup.

## What Becomes Persistent

- The MCP registration in `~/.codex/config.toml`.
- The host's installed `agbrowse` package and scripts.
- The host's `BROWSER_AGENT_HOME` session store.
- The host's logged-in Chrome profile, subject to provider security checks.

## What Does Not Become Persistent

- OpenAI servers are not changed.
- ChatGPT mobile does not run AGBROWSE locally on the phone.
- A powered-off host cannot run browser automation.
- Provider limits, CAPTCHA, and login checks are not bypassed.

## Windows Host Setup

```powershell
npm install -g agbrowse
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-codex-mcp-agbrowse.ps1
```

Then restart Codex or start a new Codex session. In Codex, check MCP status with
the MCP tools view or `/mcp` when using the CLI/TUI.

## Linux Or VPS Host Setup

```bash
npm install -g agbrowse
bash ./scripts/install-codex-mcp-agbrowse.sh
```

For a VPS or always-on machine, install Codex and AGBROWSE on that host, sign in
to Codex, and complete the ChatGPT web login in the browser profile controlled
by AGBROWSE. Keep the host awake and online.

## Codex Configuration

The installer appends this MCP server:

```toml
[mcp_servers.agbrowse_web_ai]
command = "agbrowse"
args = ["web-ai", "mcp-server"]
startup_timeout_sec = 20
tool_timeout_sec = 1800
enabled = true
required = false
default_tools_approval_mode = "prompt"

[mcp_servers.agbrowse_web_ai.env]
CDP_PORT = "9223"
AGBROWSE_JSON_ERRORS = "1"
```

On Windows, the installer writes the absolute `agbrowse.cmd` path because that
is more reliable than relying on shell command resolution.

## Mobile Flow

1. Keep Codex App running on a Windows or macOS host, or configure a dedicated
   always-on host.
2. Install AGBROWSE and register `agbrowse_web_ai` MCP on that same host.
3. Complete provider login in the host browser profile.
4. Pair ChatGPT mobile with that host through Codex mobile/remote control.
5. From mobile, ask Codex to use AGBROWSE or the `agbrowse_web_ai` MCP tools.

If the daily PC is off, use a separate always-on PC/VPS/SSH host. MCP cannot
make a powered-off computer execute browser automation.
