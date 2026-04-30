---
name: web-ai
description: "Standalone agent-browser web-ai workflow for ChatGPT, Gemini, and Grok with Oracle-style prompt envelopes, file/context uploads, model selection, polling, and opt-in copy-markdown fallback."
---

# Web AI

Use this skill when an agent needs to drive AI provider websites through the
standalone `agent-browser` Chrome/CDP runtime.

## Preconditions

- Use the existing headed Chrome profile when provider login is required.
- Do not start a separate Chrome/profile unless the user explicitly asks for an
  isolated run.
- Prefer `agent-browser status` before mutation.
- For live provider smoke tests, pass `--url` so the runtime verifies the
  provider host before sending.

## Commands

```bash
agent-browser web-ai render
agent-browser web-ai status
agent-browser web-ai send
agent-browser web-ai poll
agent-browser web-ai query
agent-browser web-ai stop
agent-browser web-ai context-dry-run
agent-browser web-ai context-render
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
| Grok | yes | yes | yes | yes | yes |

Unsupported vendors or unsupported model aliases must fail before browser
mutation.

## Render First

Use render to inspect the exact Oracle-style prompt shape:

```bash
agent-browser web-ai render \
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
agent-browser web-ai query \
  --vendor chatgpt \
  --url https://chatgpt.com/ \
  --model pro \
  --inline-only \
  --allow-copy-markdown-fallback \
  --prompt "Reply exactly CHATGPT_OK"
```

Gemini:

```bash
agent-browser web-ai query \
  --vendor gemini \
  --url https://gemini.google.com/app \
  --model fast \
  --inline-only \
  --prompt "Reply exactly GEMINI_OK"
```

Grok:

```bash
agent-browser web-ai query \
  --vendor grok \
  --url https://grok.com/ \
  --model expert \
  --inline-only \
  --prompt "Reply exactly GROK_OK"
```

## File Upload

```bash
agent-browser web-ai query \
  --vendor gemini \
  --url https://gemini.google.com/app \
  --model fast \
  --file /tmp/context.txt \
  --prompt "Read the attached file and reply with its sentinel."
```

Upload must verify visible attachment evidence and sent-turn evidence where the
provider exposes it. Input-only success is not enough.

## Context Package Upload

```bash
agent-browser web-ai query \
  --vendor grok \
  --url https://grok.com/ \
  --context-from-files "web-ai/*.mjs" \
  --context-transport upload \
  --prompt "Reply exactly CONTEXT_OK if the package contains question.mjs."
```

Use `context-dry-run --json` before live mutation when the file set is large:

```bash
agent-browser web-ai context-dry-run \
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

Gemini:

- `fast`, `flash`, `gemini-fast`
- `thinking`, `think`, `gemini-thinking`
- `pro`, `gemini-pro`, `3.1-pro`

Grok:

- `auto`, `automatic`
- `fast`, `quick`
- `expert`, `thinking`, `think`
- `grok-4.3`, `grok43`, `grok-43`, `beta`
- `heavy`

## Copy Markdown Fallback

Use only when explicitly needed:

```bash
agent-browser web-ai query \
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
- If the active tab is ambiguous, run `agent-browser tabs` and
  `agent-browser tab-switch <targetId>` before mutation.
