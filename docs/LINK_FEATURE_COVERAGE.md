# AGBROWSE And Jawcode Link Feature Coverage

This document maps the public reference pages the user asked to apply into the
local, verifiable AGBROWSE/Codex/Jawcode workflow.

Sources checked:

- DCInside post 1259871, `https://m.dcinside.com/board/thesingularity/1259871`
- Jawcode landing page, `https://lidge-jun.github.io/jawcode/`

The mapped features are implemented as local repository capabilities, Codex
skills, installer scripts, and verification commands. They do not modify
OpenAI, ChatGPT, Codex, Gemini, Grok, GitHub, or Hugging Face hosted services.

## Feature Matrix

| Source feature | Local coverage | Verification |
| --- | --- | --- |
| AGBROWSE installation and skill setup | `npm install -g agbrowse`, bundled `browser`, `web-ai`, and `vision-click` skills, Codex MCP installer scripts | `agbrowse --help`, `agbrowse skills list --json`, `scripts/install-codex-mcp-agbrowse.*` |
| ChatGPT login through the user's browser | AGBROWSE headed Chrome profile plus `web-ai status` checks | `agbrowse web-ai status --vendor chatgpt --url https://chatgpt.com/ --json` |
| Multi-tab web-ai sessions | new-tab default, tab pool, session-to-tab binding, session resume, watch/poll | `agbrowse tabs --json`, `agbrowse web-ai sessions list --json`, `agbrowse web-ai watch --session <id>` |
| 1 WEB AI general mode | `web-ai query/send/poll` for ChatGPT, Gemini, and Grok | `agbrowse web-ai query --vendor chatgpt --inline-only --prompt "..."` |
| 1-1 question/review mode | context package upload with model/effort selection for ChatGPT/Gemini, plus Grok inline policy | `agbrowse web-ai context-dry-run ...`, `agbrowse web-ai query --context-from-files ...` |
| 1-2 code mode | ChatGPT-only code artifact contract with zip extraction and plan-file gate | `agbrowse web-ai code --vendor chatgpt --output-zip result.zip ...` |
| Search mode | research planning, result normalization, enrichment fetch, browse plan, adaptive URL fetch | `agbrowse research plan --query "..." --json`, `agbrowse fetch <url> --json` |
| Web manipulation mode | CDP navigation, ref snapshots, click/type/press/scroll, screenshot, console/network, guarded JS evaluate | `agbrowse navigate`, `agbrowse snapshot --interactive`, `agbrowse click e1`, `agbrowse evaluate "document.title"` |
| Mobile/PC-off smoke checks | GitHub Actions `AGBROWSE Remote Smoke` workflow and Codespaces devcontainer | `.github/workflows/agbrowse-remote-smoke.yml`, `.devcontainer/devcontainer.json` |
| Codex MCP persistence | `agbrowse web-ai mcp-server` and Codex config installers | `npm run test:mcp` |
| Jawcode IPABCD workflow | local `jawcode-quality-workflow` skill plus MasterBook Jawcode setup docs | MasterBook `docs/AGBROWSE_JAWCODE_CODEX_SETUP.md` |
| Jawcode role-agent behavior | executor/planner/critic/architect concepts mapped to Codex plan/audit/build/check workflow | apply `jawcode-quality-workflow` skill on complex tasks |
| Subscription-only web model lane | `jawcode-subscription-web` skill routes model work through ChatGPT web instead of API keys | `jaw-sub status`, `jaw-sub review`, `jaw-sub code` when installed |

## Practical Commands

General provider question:

```bash
agbrowse web-ai query --vendor chatgpt --url https://chatgpt.com/ \
  --model thinking --effort heavy --inline-only \
  --prompt "Review this failure and propose a fix."
```

Review current workspace with a context package:

```bash
agbrowse web-ai context-dry-run --vendor chatgpt \
  --context-from-files "web-ai/**/*.mjs" \
  --prompt "Review this code." --json

agbrowse web-ai query --vendor chatgpt --url https://chatgpt.com/ \
  --model thinking --effort heavy \
  --context-from-files "web-ai/**/*.mjs" \
  --context-transport upload \
  --prompt "Review bugs, risks, and missing tests."
```

ChatGPT code mode:

```bash
agbrowse web-ai code --vendor chatgpt \
  --model thinking --effort standard \
  --prompt "Build the requested app." \
  --output-zip ./result.zip
```

Search and fetch:

```bash
agbrowse research plan --query "Korean search question" --json
agbrowse fetch "https://example.com/source" --json
```

Web manipulation:

```bash
agbrowse start --headed
agbrowse navigate "https://example.com"
agbrowse snapshot --interactive
agbrowse click e1
agbrowse type e2 "text" --submit
```

Mobile-triggered smoke run:

```text
GitHub -> tnsqhr0108-dev/agbrowse -> Actions
  -> AGBROWSE Remote Smoke -> Run workflow
```

## Boundaries

- ChatGPT/Gemini/Grok login, CAPTCHA, security prompts, and model limits remain
  provider-controlled.
- Code mode is ChatGPT-only in this release.
- Grok should use inline prompts or direct file uploads, not context packages by
  default.
- GitHub Actions proves remote headless AGBROWSE execution, not an interactive
  logged-in ChatGPT browser session.
- For durable provider-web login while the daily PC is off, use a real
  always-on host with a visible display path.
