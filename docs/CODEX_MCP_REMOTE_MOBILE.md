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

For PC-off coding from a phone without maintaining a host, use official Codex
web/cloud at `https://chatgpt.com/codex` with GitHub connected. For a custom
ChatGPT mobile tool surface, use a ChatGPT App connector backed by an HTTPS MCP
server that dispatches work to GitHub Actions, Codespaces, or an always-on
host. See `docs/MOBILE_CODEX_BRIDGE.md`.

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

For a fresh always-on Linux/SSH host with Node.js 18+ and Codex already
available:

```bash
bash ./scripts/bootstrap-always-on-codex-host.sh --install-chrome --install-systemd-service
node ./scripts/verify-always-on-codex-host.mjs --require-service --headless-smoke
```

On AMD64 Debian/Ubuntu hosts, `--install-chrome` installs Google Chrome. On
ARM64 hosts such as OCI Ampere A1, it installs Chromium and sets
`CHROME_BINARY_PATH` to the detected browser path.

For a VPS or always-on machine, install Codex and AGBROWSE on that host, sign in
to Codex, and complete the ChatGPT web login in the browser profile controlled
by AGBROWSE. Keep the host awake and online. A headless-only VPS still needs a
visible display path such as a desktop session, SSH X forwarding, or another
secured remote-display method for the one-time ChatGPT web login and any later
provider security checks.

For the concrete SSH/VPS host flow, including the user-level systemd service
and verifier, see `docs/ALWAYS_ON_HOST_RUNBOOK.md`.

## SSH Does Not Replace An Awake Host

SSH is the right way to move the project and shell work onto a server, but SSH
does not make a powered-off PC keep running Codex. If Codex App on the PC is the
client that owns the SSH connection, turning that PC off still stops the mobile
remote-control path.

For phone-first use while the daily PC is off, use one of these layouts:

- Dedicated always-on Mac or Windows host running Codex App, AGBROWSE, browser
  login, and the `agbrowse_web_ai` MCP server.
- Dedicated always-on Mac or Windows host running Codex App, connected through
  SSH to a Linux/VPS project host that has AGBROWSE installed.
- Linux/VPS SSH host for shell/repository work, with a separate supported Codex
  App host kept online to expose it to ChatGPT mobile.

Pure Linux SSH is still useful, but it is not by itself a mobile Codex host for
official ChatGPT mobile remote control.

If a free VPS signup is unavailable, use GitHub Codespaces as the first
zero-cost fallback for repository work and headless AGBROWSE smoke checks. It
is not an always-on browser host, but it is enough to edit, test, and register
MCP inside that remote development environment when Codex CLI is installed
there. See `docs/FREE_REMOTE_ALTERNATIVES.md`.

Example SSH config on the Codex App host:

```text
Host agbrowse-vps
  HostName 203.0.113.10
  User ubuntu
  IdentityFile ~/.ssh/id_ed25519
```

Then verify:

```bash
ssh agbrowse-vps
```

After that, add the SSH host in Codex App settings and choose the remote project
folder.

## Deploy To An Existing SSH Host

When the host is already reachable by SSH from a Codex App machine:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-always-on-codex-host.ps1 `
  -HostAlias agbrowse-vps `
  -InstallChrome `
  -InstallSystemdService `
  -Verify `
  -HeadlessSmoke
```

The deploy script:

- connects with `ssh <HostAlias>`
- clones or fast-forwards the AGBROWSE repository on the remote host
- runs `scripts/bootstrap-always-on-codex-host.sh`
- registers the `agbrowse_web_ai` MCP server in the remote host's Codex config
- optionally installs `agbrowse-cdp.service`
- optionally runs `scripts/verify-always-on-codex-host.mjs`

It requires the remote host to already have SSH access, Node.js 18+, npm, git,
bash, and Codex CLI available. It does not buy or create a VPS, and it does not
complete Codex or ChatGPT login for you.

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

If the goal is simply Codex-level coding from a phone while the PC is off, the
lowest-friction path is official Codex web/cloud plus GitHub. Use the AGBROWSE
MCP path when the task specifically needs the host's browser profile, local
tools, or provider-web automation.
