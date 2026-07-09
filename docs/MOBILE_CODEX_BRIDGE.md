# Mobile Codex Bridge

This document defines the supported upgrade path for using Codex-level coding
workflows from ChatGPT mobile or ChatGPT web while the daily PC may be off.

It separates three different surfaces that are often confused:

1. Official Codex cloud/web tasks.
2. ChatGPT mobile remote control of a Codex App host.
3. A custom ChatGPT App or MCP connector that dispatches work to a hosted
   runner.

AGBROWSE can participate in each surface, but it cannot make a powered-off
computer run browser automation. The compute must exist somewhere: OpenAI Codex
cloud, a reachable Codex App host, GitHub Actions, Codespaces, or another
always-on host.

## Recommended Path

Use this order:

1. For PC-off coding from a phone without managing a server, use official Codex
   web/cloud at `https://chatgpt.com/codex` and connect GitHub.
2. For using the exact local Codex setup, plugins, browser profile, and
   AGBROWSE sessions from a phone, pair ChatGPT mobile with a Codex App host.
   The host must stay awake and online.
3. For a ChatGPT mobile tool that can start remote checks or jobs, build a
   ChatGPT App connector backed by an HTTPS MCP server. That server should
   dispatch to GitHub Actions, Codespaces, or an always-on host.

## Architecture Options

| Option | Phone experience | PC can be off | AGBROWSE support | Main limit |
| --- | --- | --- | --- | --- |
| Codex web/cloud | Open ChatGPT/Codex and work on a GitHub repo | Yes | Repo setup and commands only | Hosted cloud task, not the local browser profile |
| Codex mobile remote control | ChatGPT mobile controls the paired Codex host | No, unless the host is a separate always-on machine | Full host AGBROWSE, MCP, browser profile | Host must be awake, signed in, and reachable |
| SSH remote project | Codex App host runs work over SSH on a remote project | Daily PC can be off only if another Codex App host is online | Good for shell/repo work; browser needs remote display | SSH alone does not expose a phone endpoint |
| GitHub Actions dispatch | Phone starts an action from GitHub or an MCP connector | Yes | Headless public-page smoke checks | Short-lived CI job, no durable logged-in browser |
| ChatGPT App MCP bridge | ChatGPT web/mobile calls MCP tools | Yes if hosted remotely | Can dispatch AGBROWSE jobs to a runner/host | Needs HTTPS MCP hosting and auth |
| Always-on desktop/VPS | Phone talks to hosted Codex/App/MCP stack | Yes | Best for logged-in provider web automation | Needs a real host and secure remote access |

For the concrete always-on SSH/VPS host setup, use
`docs/ALWAYS_ON_HOST_RUNBOOK.md`.

## What The ChatGPT App MCP Bridge Should Expose

A minimal private connector should expose narrow tools:

- `start_agbrowse_smoke`: dispatch the existing `AGBROWSE Remote Smoke`
  workflow for a public URL.
- `start_codex_task`: dispatch a Codex GitHub Action or enqueue work on an
  always-on host.
- `get_task_status`: return workflow run status, logs URL, artifacts URL, and
  final summary.
- `cancel_task`: cancel a queued or running job.

Keep the bridge as a dispatcher. Do not expose arbitrary shell execution from
ChatGPT. The target runner should own repository checkout, sandboxing,
allowlists, secrets, and artifact retention.

## Required Auth And Secrets

- GitHub dispatch requires a GitHub token scoped to the repository.
- Codex GitHub Action requires `OPENAI_API_KEY` as a GitHub secret.
- ChatGPT web subscription login does not transfer to GitHub-hosted runners.
- AGBROWSE web-ai sessions that use ChatGPT/Gemini/Grok login need a host with
  a durable browser profile and a display path for login/security checks.
- Public MCP endpoints must use HTTPS and authentication. OAuth is preferred for
  shared use; a bearer token is acceptable for a private prototype.

## No-API-Key Lane

If the user wants to avoid API keys, the realistic PC-off lane is official
Codex web/cloud with GitHub connected. The custom MCP bridge can still start
AGBROWSE smoke checks, but it cannot run Codex GitHub Action without an API key
and cannot reuse a ChatGPT subscription session inside GitHub Actions.

## API-Key Or Always-On Host Lane

Use this lane when the user wants one mobile prompt to start deeper automated
coding work:

```text
ChatGPT mobile/web
  -> private ChatGPT App connector
  -> HTTPS MCP bridge
  -> GitHub Actions with OPENAI_API_KEY
     or always-on Codex host over a private job queue
  -> commits, PRs, artifacts, and status back to ChatGPT
```

For provider-web AGBROWSE code/review mode:

```text
ChatGPT mobile/web
  -> private connector or Codex mobile remote control
  -> always-on host with Codex + AGBROWSE + browser profile
  -> agbrowse web-ai query/review/code
  -> result summary, zip artifact, PR, or commit
```

## Mobile Setup Checklist

Official no-server path:

1. Open `https://chatgpt.com/codex`.
2. Connect GitHub.
3. Select the repository and branch.
4. Ask Codex to edit, test, and open a PR.

Remote-control path:

1. Keep a Codex App host awake and online.
2. Install AGBROWSE on that host.
3. Register `agbrowse_web_ai` with Codex MCP.
4. Complete provider web login on that host when needed.
5. Pair ChatGPT mobile with the host through Codex mobile setup.

Connector path:

1. Host an HTTPS MCP endpoint.
2. Add auth and narrow tools.
3. Link the connector in ChatGPT web developer mode.
4. Confirm it appears in ChatGPT mobile.
5. Test only non-destructive jobs first.

## Verification

Run:

```bash
npm run verify:mobile-codex-bridge
```

The verifier checks that this repository documents the official Codex cloud
path, Codex mobile remote-control path, ChatGPT App MCP bridge path, existing
AGBROWSE remote smoke workflow, and the API-key/no-API-key boundary.
