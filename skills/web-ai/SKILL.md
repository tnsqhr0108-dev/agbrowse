---
name: web-ai
description: "Standalone agbrowse web-ai workflow for ChatGPT, Gemini, and Grok with structured prompt envelopes, file/context uploads, model selection, polling, and opt-in copy-markdown fallback."
---

# Web AI

Use this skill when an agent needs to drive AI provider websites through the
standalone `agbrowse` Chrome/CDP runtime.

## Preconditions

- Use the existing headed Chrome profile when provider login is required.
- Do not start a separate Chrome/profile unless the user explicitly asks for an
  isolated run.
- Prefer `agbrowse status` before mutation.
- For live provider smoke tests, pass `--url` so the runtime verifies the
  provider host before sending.

## Commands

```bash
agbrowse web-ai render
agbrowse web-ai status
agbrowse web-ai send
agbrowse web-ai poll
agbrowse web-ai query
agbrowse web-ai stop
agbrowse web-ai context-dry-run
agbrowse web-ai context-render
```

Direct script form is equivalent:

```bash
node skills/browser/browser.mjs web-ai query ...
```

## Provider Matrix

| Provider | Inline | File upload | Context package upload | Model select | Copy fallback |
| --- | ---: | ---: | ---: | ---: | ---: |
| ChatGPT | yes | yes | yes | yes | yes |
| Gemini | yes | yes | yes | yes | yes |
| Grok | yes | yes | avoid (see below) | yes | yes |

Unsupported vendors or unsupported model aliases must fail before browser
mutation.

### Grok: do not use context packaging

Do not package files for Grok. The runtime still allows it for parity, but
agents must prefer inline prompts and per-call `--file <path>` uploads instead
of `--context-from-files` / `--context-file` / `--context-transport upload`
when `--vendor grok`.

Why: Grok's web composer attachment surface is less predictable than ChatGPT
and Gemini, the package upload path frequently degrades response quality, and
Grok already accepts long inline prompts well. Use ChatGPT or Gemini when the
prompt genuinely needs a packaged context bundle.

Grok context packages fail closed by default. If `web-ai send/query --vendor grok`
is invoked with `--context-from-files` / `--context-file` /
`--context-transport upload` and `--allow-grok-context-pack` is not passed,
the runtime throws with `stage: 'grok-context-pack-not-allowed'`. Pass
`--allow-grok-context-pack` to override deliberately; the runtime still
emits the `grok-context-pack-not-recommended` warning when the override is
used.

## Polling Timeouts

`web-ai poll` and `web-ai query` accept `--timeout <seconds>`. When omitted,
the runtime uses these defaults so heavy reasoning models (ChatGPT Pro/Heavy,
Gemini Deep Think, Grok Expert/Heavy) have room to finish:

| Vendor | Default `--timeout` | Roughly |
| --- | ---: | --- |
| ChatGPT | 1200 | 20 minutes |
| Gemini | 1200 | 20 minutes |
| Grok | 600 | 10 minutes |

Pass `--timeout 1800` (30 min) or higher for unusually long Pro/Deep Think
runs. The provider tab and the agbrowse Chrome process stay open across a
poll timeout — only the polling loop gives up.

## Render First

Use render to inspect the exact structured prompt shape:

```bash
agbrowse web-ai render \
  --vendor chatgpt \
  --project "project name" \
  --goal "what the provider should do" \
  --prompt "question"
```

Envelope shape:

```text
[SYSTEM]
...

[USER]
## Project
...

## Goal
...

## Question
...
```

## Live Query Examples

ChatGPT Pro:

```bash
agbrowse web-ai query \
  --vendor chatgpt \
  --url https://chatgpt.com/ \
  --model pro \
  --inline-only \
  --allow-copy-markdown-fallback \
  --prompt "Reply exactly CHATGPT_OK"
```

Gemini:

```bash
agbrowse web-ai query \
  --vendor gemini \
  --url https://gemini.google.com/app \
  --model fast \
  --inline-only \
  --prompt "Reply exactly GEMINI_OK"
```

Grok:

```bash
agbrowse web-ai query \
  --vendor grok \
  --url https://grok.com/ \
  --model expert \
  --inline-only \
  --prompt "Reply exactly GROK_OK"
```

## File Upload

```bash
agbrowse web-ai query \
  --vendor gemini \
  --url https://gemini.google.com/app \
  --model fast \
  --file /tmp/context.txt \
  --prompt "Read the attached file and reply with its sentinel."
```

Upload must verify visible attachment evidence and sent-turn evidence where the
provider exposes it. Input-only success is not enough.

## Context Package Upload

Use ChatGPT or Gemini for context packaging. Do not pick `--vendor grok`
here; Grok should use inline prompts plus optional single `--file` uploads
only.

```bash
agbrowse web-ai query \
  --vendor chatgpt \
  --url https://chatgpt.com/ \
  --context-from-files "web-ai/*.mjs" \
  --context-transport upload \
  --prompt "Reply exactly CONTEXT_OK if the package contains question.mjs."
```

Use `context-dry-run --json` before live mutation when the file set is large:

```bash
agbrowse web-ai context-dry-run \
  --vendor chatgpt \
  --prompt "Review this context" \
  --context-from-files "web-ai/*.mjs" \
  --json
```

## Model Aliases

ChatGPT:

- `instant`, `fast`, `gpt-5.3`
- `thinking`, `think`, `gpt-5.5-thinking`
- `pro`, `gpt-5.5-pro`

2026-04-30 ChatGPT UI note:

- The visible model opener can be a bottom composer pill labeled `Heavy`
  instead of the older top `model-switcher-dropdown-button`.
- Treat a visible `Heavy` model pill as the active ChatGPT Pro/Heavy state.
- For direct DOM fallback, open the model pill and select
  `[data-testid="model-switcher-gpt-5-5-pro-thinking-effort"]` for Pro.
- If selector automation fails, inspect with `agbrowse snapshot --interactive`
  and click the visible `Heavy` model pill before sending.

Gemini:

- `fast`, `flash`, `gemini-fast`
- `thinking`, `think`, `gemini-thinking` selects the Gemini 3 Flash Thinking model
- `pro`, `gemini-pro`, `3.1-pro`

Gemini Deep Think tool aliases:

- `deepthink`, `deep-think`, `deep_think`, `deep think`

Gemini `deepthink` activates the visible `Deep think` tool before submitting
the prompt. It is intentionally separate from the `thinking` model alias.

Grok:

- `auto`, `automatic`
- `fast`, `quick`
- `expert`, `thinking`, `think`
- `grok-4.3`, `grok43`, `grok-43`, `beta`
- `heavy`

## Copy Markdown Fallback

Use only when explicitly needed:

```bash
agbrowse web-ai query \
  --vendor chatgpt \
  --inline-only \
  --allow-copy-markdown-fallback \
  --prompt "Return a markdown table."
```

The runtime intercepts the page's `navigator.clipboard.writeText/write` during
the provider Copy button click. It does not read the OS clipboard.

## Safety

- Never claim live web-ai success from render/dry-run alone.
- Headed Chrome is the valid path for provider smoke tests.
- Human verification and login screens must be completed by the user.
- If the active tab is ambiguous, run `agbrowse tabs` and
  `agbrowse tab-switch <targetId>` before mutation.
