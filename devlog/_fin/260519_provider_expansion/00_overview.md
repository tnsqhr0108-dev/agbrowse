# Provider Expansion Plan — Overview

> Priority: P1 (immediate after P0 skill trigger patch)
> Goal: Perplexity + Claude + NotebookLM providers → 10x-chat feature parity (6 providers)
> Date: 2026-05-19

## Current State

| Provider | agbrowse | 10x-chat | Gap |
|----------|----------|----------|-----|
| ChatGPT | YES | YES | - |
| Gemini | YES | YES | - |
| Grok | YES | YES | - |
| **Claude** | **NO** | YES | **GAP** |
| **Perplexity** | **NO** | YES | **GAP** |
| **NotebookLM** | **NO** | YES | **GAP** |
| Google Flow (video) | NO | YES | low priority |

## Architecture Difference: agbrowse vs 10x-chat

| Aspect | agbrowse | 10x-chat |
|--------|----------|----------|
| Browser | **CDP-attach** (user's Chrome) | Playwright own browser |
| Lang | ESM JavaScript (.mjs) | TypeScript |
| Provider pattern | `{vendor}-live.mjs` + `{vendor}-model.mjs` | `{vendor}.ts` + registry |
| Interface | Implicit (6 exported functions) | Explicit (`ProviderActions` interface) |
| Effort | Normalized `--effort low/standard/extended/heavy` | Raw model names |
| Session | Tab lease + session store + conversation resume | Persistent browser profile |
| Extraction | DOM → copy button → copy-markdown fallback chain | Direct DOM extraction |
| Bot detection | N/A (user's real browser) | Patchright stealth fork |

## Key Advantage: CDP-Attach Means Less Work

10x-chat must handle:
- Bot detection bypass (Patchright)
- Login flow automation
- Browser lifecycle management
- Profile persistence

agbrowse skips ALL of this — user is already logged in. We only need:
1. DOM selectors for composer/response
2. Model selection UI automation
3. Response extraction logic

## Implementation Priority

1. **Claude** (doc 01) — largest user demand, claude.ai DOM is stable
2. **Perplexity** (doc 02) — search+AI hybrid, unique value prop
3. **NotebookLM** (doc 03) — RPC-based (no DOM), existing `notebooklm-py` library available

## Per-Provider Deliverables

Each provider needs:

```
web-ai/{vendor}-live.mjs      — capabilities + status/send/poll/query/stop
web-ai/{vendor}-model.mjs     — model aliases, effort mapping, UI selection
cli.mjs                       — dispatch block + VENDOR_DEFAULT_URLS + validation
test/                          — unit tests + DOM fixtures
```

## Shared Infrastructure (No Changes Needed)

These existing modules work for any provider:
- `session.mjs` / `session-store.mjs` — session lifecycle
- `tab-lease-store.mjs` / `tab-pool.mjs` — tab management
- `answer-artifact.mjs` — copy-markdown extraction
- `copy-markdown.mjs` — fallback chain
- `capability.mjs` — `defineCapability()` framework
- `source-audit.mjs` — claim verification
- `navigation-ready.mjs` — page load detection

## 10x-chat Code Reference (analyzed 2026-05-19)

Repo: `MikeChongCan/10x-chat` (v0.10.13, 36 stars)
Key files analyzed:
- `src/providers/claude.ts` — Claude DOM selectors, model picker, thinking strip
- `src/providers/perplexity.ts` — Perplexity DOM selectors, overlay dismiss, URL change detection
- `src/providers/notebooklm.ts` — Pure RPC via `NotebookLMClient`, no DOM
- `src/providers/registry.ts` — `ProviderConfig` + `ProviderActions` interface
- `src/providers/submit.ts` — shared composer submit helper
- `src/types.ts` — full type definitions

## Existing Asset: notebooklm-py

Location: `/Users/jun/Developer/new/_INBOX/notebooklm-py`
- Full Python async client for NotebookLM undocumented RPC
- 60+ RPC methods reverse-engineered
- Smoke test: `scripts/check_rpc_health.py`
- Can be ported to JS or called as subprocess

## Document Index

- `00_overview.md` — this file
- `01_claude.md` — Claude provider implementation plan
- `02_perplexity.md` — Perplexity provider implementation plan
- `03_notebooklm.md` — NotebookLM provider implementation plan
- `04_cli_integration.md` — cli.mjs dispatch + validation changes
- `05_10x_chat_reference.md` — 10x-chat code analysis & reusable patterns
