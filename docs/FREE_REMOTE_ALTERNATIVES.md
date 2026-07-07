# Free Remote Alternatives For AGBROWSE

This guide covers no-cost fallbacks when Oracle Cloud Free Tier is unavailable.
It is intentionally conservative: free platforms can help with repository work,
headless browser smoke checks, and mobile-triggered control panels, but they do
not modify official ChatGPT/Codex services and do not bypass provider limits,
CAPTCHA, security checks, or login requirements.

## Recommendation

0. Use official Codex web/cloud first when the goal is coding from a phone while
   the daily PC is off and the project is in GitHub.
1. Use GitHub Codespaces next for zero-cost remote development and AGBROWSE
   smoke checks.
2. Use GitHub Actions manual workflow dispatch when you only need a mobile
   button to run a headless AGBROWSE smoke check.
3. Use a Hugging Face Space only as an optional lightweight control panel or
   demo surface.
4. Use Google Cloud Always Free only if you can create a billing account and can
   tolerate the small `e2-micro` machine shape.

For stable ChatGPT web automation while the daily PC is off, a real always-on
host is still the correct architecture. Free ephemeral runtimes are not the same
as a dedicated remote desktop or VPS.

For the full mobile decision tree, see `docs/MOBILE_CODEX_BRIDGE.md`.

## Option 1: GitHub Codespaces

Best fit:

- editing and testing the AGBROWSE repository from a browser or phone
- running CLI tests and headless Chromium smoke checks
- keeping the project setup reproducible with `.devcontainer/devcontainer.json`

Limits:

- it is not an always-on server
- monthly included usage is finite
- human provider login in a visible browser is awkward compared with a desktop
  or VPS with a remote display

Official GitHub docs currently state that personal accounts include free
Codespaces compute and storage quota, and that personal Free accounts include
15 GB-month storage and 120 hours compute time per month.

### Start

1. Open the repository on GitHub.
2. Choose `Code` -> `Codespaces` -> `Create codespace`.
3. Wait for the devcontainer post-create command to finish.
4. Run the smoke check:

```bash
agbrowse status --json
CHROME_HEADLESS=1 agbrowse start --port 9223
agbrowse navigate https://example.com
agbrowse snapshot --interactive --max-nodes 40
```

If Codex CLI is installed in that Codespace, register MCP:

```bash
bash ./scripts/install-codex-mcp-agbrowse.sh
```

## Option 2: GitHub Actions Mobile Trigger

Best fit:

- running AGBROWSE from a phone while the daily PC is off
- opening one public URL in a headless browser
- collecting status, active tab, snapshot, and screenshot evidence from the
  workflow log/artifact

Limits:

- it is a short-lived CI job, not an interactive desktop
- it does not keep a logged-in ChatGPT/Gemini/Grok browser profile
- it is suitable for general browser smoke checks, not provider web-ai sessions

Use the included workflow:

```text
GitHub repository
  -> Actions
  -> AGBROWSE Remote Smoke
  -> Run workflow
  -> enter URL
```

The workflow is defined at `.github/workflows/agbrowse-remote-smoke.yml`.
It installs Chromium, starts AGBROWSE in headless mode, navigates to the input
URL, prints an interactive snapshot, and uploads smoke evidence.

## Option 3: Hugging Face Space Control Panel

Best fit:

- a public or private web UI that shows AGBROWSE status
- a simple mobile button surface for read-only diagnostics
- demos that can restart when the Space wakes

Limits:

- default CPU Spaces are not persistent storage
- free `cpu-basic` Spaces pause after inactivity
- a public Space must not expose a logged-in provider browser profile
- this is not a secure replacement for a private VPS

Official Hugging Face docs currently state that default Spaces provide 2 CPU
cores, 16 GB RAM, and 50 GB non-persistent disk at no charge. Free CPU hardware
cannot configure custom sleep time and is paused after 48 hours of inactivity.

Use the example under `examples/hf-space-control-panel/` only as a starting
point. Keep `AGBROWSE_PANEL_TOKEN` set if the Space is public.

## Option 4: Google Cloud Always Free

Best fit:

- a small Linux VM when Oracle is unavailable
- simple shell tasks and light browser checks

Limits:

- sign-up may require a billing account
- `e2-micro` is weak for Chromium and provider web UIs
- network, disk, region, and quota restrictions still apply

Official Google Cloud docs currently describe an Always Free `e2-micro` usage
quota equivalent to running one eligible VM for the month, plus limits around
disk and network usage.

## What Not To Expect

- A free Space or Codespace cannot make a powered-off PC run AGBROWSE.
- MCP registration persists only where it is installed.
- ChatGPT mobile does not run AGBROWSE locally on the phone.
- Provider accounts still enforce their own plan, model, usage, login, and
  security controls.

## Practical Free Setup

Use this stack when no card-backed VPS is available:

```text
GitHub repository
  -> GitHub Codespaces devcontainer
  -> npm install/link agbrowse
  -> optional Codex CLI + MCP registration
  -> headless browser smoke checks

GitHub Actions
  -> manual workflow_dispatch from phone
  -> short-lived AGBROWSE headless smoke check
  -> logs and screenshot artifact

Optional Hugging Face Space
  -> lightweight status/control page
  -> no provider credentials
  -> no promise of always-on runtime
```

Move to an always-on desktop, VPS, or remote display host only when the workflow
requires durable ChatGPT/Gemini/Grok web login and long-running browser
automation while the daily PC is off.
