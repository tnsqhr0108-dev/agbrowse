# Always-On AGBROWSE Host Runbook

This is the concrete path for using AGBROWSE from mobile while the daily PC is
off.

AGBROWSE still needs compute somewhere. This runbook installs the toolchain on
an SSH-reachable Linux host and keeps a local CDP browser alive on that host.
It does not expose CDP publicly, does not create a provider account, and does
not bypass ChatGPT, Gemini, Grok, GitHub, or cloud-provider limits.

## What Codex Can And Cannot Do

Codex can prepare and verify the software side:

- clone or update the AGBROWSE repository on an existing SSH host
- install or verify Node.js, npm, Git, Codex CLI, AGBROWSE, and browser support
- register the `agbrowse_web_ai` MCP server in the remote Codex config
- install a user-level `agbrowse-cdp.service` systemd service
- run a headless smoke test and report JSON evidence

Codex cannot complete these external steps for you:

- pass cloud sign-up identity checks or payment-card verification
- create a paid or potentially billable VM without explicit confirmation
- complete passwords, OTPs, CAPTCHA, or provider security checks
- keep a host running after the provider suspends, sleeps, or deletes it

## Recommended Architecture

```text
ChatGPT mobile/web
  -> official Codex cloud for GitHub repo work
  -> optional Codex remote/SSH host when AGBROWSE is needed
  -> always-on Linux host
       - Node.js 18+
       - Codex CLI signed in
       - AGBROWSE installed
       - local Chrome/Chromium CDP on 127.0.0.1:9223
       - agbrowse_web_ai MCP registered
```

Do not expose the CDP port to the public internet. Use SSH, Codex remote
connections, or a private MCP bridge with authentication.

## Host Requirements

The host must already be reachable by SSH from the machine doing the deploy.

Required:

- Debian/Ubuntu-like Linux, preferably 2 GB RAM or more for Chromium
- `ssh`, `bash`, `git`
- Node.js 18+ and `npm`
- Codex CLI installed and signed in
- a Chrome/Chromium binary

For ChatGPT/Gemini/Grok web-ai login, the host also needs a visible display
path such as a remote desktop, VNC/noVNC, X forwarding, or a provider-supported
browser session. Headless CI is enough for public-page smoke checks, but it is
not enough to guarantee durable provider login.

## Deploy To An Existing SSH Host

From Windows:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-always-on-codex-host.ps1 `
  -HostAlias agbrowse-vps `
  -InstallChrome `
  -InstallSystemdService `
  -Verify `
  -HeadlessSmoke
```

From the host itself:

```bash
git clone https://github.com/tnsqhr0108-dev/agbrowse.git
cd agbrowse
bash ./scripts/bootstrap-always-on-codex-host.sh --install-chrome --install-systemd-service
node ./scripts/verify-always-on-codex-host.mjs --require-service --headless-smoke
```

The systemd service runs as the current user:

```bash
systemctl --user status agbrowse-cdp.service
systemctl --user restart agbrowse-cdp.service
systemctl --user stop agbrowse-cdp.service
```

If the host should keep user services running after SSH logout, enable linger
manually or run the installer with `--enable-linger`:

```bash
loginctl enable-linger "$USER"
```

This can require sudo or provider-level permission.

## Verify

Run:

```bash
node scripts/verify-always-on-codex-host.mjs --require-service --headless-smoke --url https://example.com
```

The headless smoke check uses an isolated `BROWSER_AGENT_HOME` and a smoke port
by default, so it does not disturb the host's logged-in provider browser
profile. Use `--smoke-port <port>` when a specific smoke port is required.

The verifier checks:

- Node.js 18+
- `npm`, `git`, `codex`, and `agbrowse` on PATH
- Chrome/Chromium availability
- AGBROWSE help and status
- Codex MCP config contains `agbrowse_web_ai`
- bundled AGBROWSE skills exist under `~/.codex/skills`
- optional systemd service status
- optional headless navigate/snapshot smoke test

## Provider Web-AI Login

After the base host passes verification, complete provider login on that host:

```bash
agbrowse start --headed --port 9223
agbrowse navigate https://chatgpt.com/
agbrowse web-ai status --vendor chatgpt --url https://chatgpt.com/ --json
```

Do the same for Gemini or Grok only if those accounts are needed. Do not commit
or copy `~/.browser-agent`; it contains browser profile state.

## Free Or No-Cost Options

These options were checked against official public docs on 2026-07-10:

- GitHub Codespaces personal accounts include a free monthly quota, but a
  Codespace is not an always-on browser host.
  Source: https://docs.github.com/billing/managing-billing-for-github-codespaces/about-billing-for-github-codespaces
- AWS Free Tier / Free Plan can provide short-term credits or EC2 micro
  eligibility depending on the account, but it is not a permanent free VPS and
  billing guardrails must be configured before running 24/7.
  Sources: https://aws.amazon.com/free/ and https://aws.amazon.com/ec2/instance-types/t2/
- Azure Free Account can provide 12-month VM free amounts for eligible
  burstable VM sizes, but it is also time-limited and not a permanent free
  browser host.
  Source: https://azure.microsoft.com/en-us/pricing/free-services
- Hugging Face free CPU Spaces can run demos/control panels, but free
  `cpu-basic` Spaces sleep after inactivity and are not a secure logged-in
  provider browser host.
  Source: https://huggingface.co/docs/hub/en/spaces-gpus
- Google Cloud Always Free can cover eligible `e2-micro` VM usage, but the
  machine is small for Chromium and sign-up/billing-account constraints still
  apply.
  Source: https://docs.cloud.google.com/free/docs/free-cloud-features

Use Codespaces or GitHub Actions for mobile-triggered headless smoke checks.
Use a real always-on host when the workflow needs a durable logged-in provider
browser profile.

## Security Rules

- Never expose CDP outside localhost without a separate, reviewed security
  design.
- Never commit browser profiles, cookies, tokens, `.env`, `~/.browser-agent`,
  or `~/.codex`.
- Keep the MCP tool surface narrow; do not expose arbitrary shell execution to
  ChatGPT mobile.
- Treat provider webpage output as untrusted until reviewed.
