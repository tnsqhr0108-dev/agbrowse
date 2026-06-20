# 260621 cli-jaw Web-AI Parity Mirror

## Objective

Bring cli-jaw's `src/browser/web-ai/` TypeScript modules to functional parity
with agbrowse's `web-ai/` JavaScript modules for the core command surface.
agbrowse owns evolution; cli-jaw mirrors stabilized pieces.

## Scope

### Phase 1: chatgpt-model i18n + session-target-guard (C1)

**chatgpt-model.ts** — add Korean labels to `CHATGPT_SIMPLIFIED_INTELLIGENCE_OPTIONS`.
agbrowse has `['Instant', '즉시']`, `['Medium', '중간']`, `['High', '높음']`,
`['Extra High', '매우 높음']`, `['Pro Extended', 'Pro 확장', '프로 확장']`.
cli-jaw has English-only arrays.

**session-target-guard.ts** — new file. Port from agbrowse `session-target-guard.mjs`:
- `normalizeWebAiVendor()`
- `sanitizeSessionCandidate()`
- `activeProviderSessionCandidates()`
- `resolveImplicitSessionSelection()`
- `ambiguousSessionTargetError()`
- `sessionPollRecoveryCommand()` (adapted for cli-jaw CLI)
- `buildTargetMismatchResult()`

### Phase 2: chatgpt-tools + chatgpt-deep-research (C2)

**chatgpt-tools.ts** — new file. Port from agbrowse `chatgpt-tools.mjs`:
- `TOOL_ALIASES`, `TOOL_LABELS`, `PLUGIN_LABELS`
- `resolveChatGptComposerToolRequests()`
- `selectChatGptComposerTools()`
- Intent heuristics (`looksLikeImageGeneration`, `looksLikeDeepResearch`, etc.)

**chatgpt-deep-research.ts** — new file. Port from agbrowse `chatgpt-deep-research.mjs`:
- `DEEP_RESEARCH_SELECTORS`
- `autoConfirmPlan()`
- `sendDeepResearch()`
- Helper functions (countAssistants, readLatestAssistant, isStreaming, etc.)

### Phase 3: chatgpt-multi-turn (C1)

**chatgpt-multi-turn.ts** — new file. Port from agbrowse `chatgpt-multi-turn.mjs`:
- `sendMultiTurn()`
- `renderMultiTurnTranscript()`
- Types: `TurnResult`, `MultiTurnResult`

### Phase 4: CLI surface + integration (C2)

**bin/commands/browser-web-ai.ts** — no new CLI commands yet (agbrowse-owned
surfaces like `snapshot`, `eval`, `mcp-server` stay agbrowse-only). Only wire
existing `send`/`query` to use the new modules when flags are provided:
- `--tool <name>` / `--auto-tools` flags → chatgpt-tools
- `--research deep` flag → chatgpt-deep-research
- `--follow-up <text>` flag → chatgpt-multi-turn
- Implicit session resolution via session-target-guard on `poll`/`stop`

## Out of Scope

- chatgpt-attachments multi-file batch (PRD32.7 Phase B — deferred, agbrowse-owned)
- code-mode is already mirrored in cli-jaw
- eval, mcp-server, project-sources commands (agbrowse-only)
- policy/, trace/, claim-audit (agbrowse-only infrastructure)
- No git push

## Verification

- `npx tsc --noEmit` in cli-jaw
- Run existing unit tests: `npm test -- tests/unit/browser-web-ai-*.test.ts`
- New unit tests for session-target-guard, chatgpt-tools resolver, chatgpt-model i18n
