# Plan: Multi-Turn Follow-Up Prompts

**Issue: #69** | **Priority: P2** | **Status: planned** | **Depends: #71**

## Problem

agbrowse is single-shot: each `send` starts fresh or reuses a tab without follow-up capability. Oracle supports `--browser-follow-up` for multiple prompts in one conversation.

## Reference Implementation

Oracle 0.11.0 `--browser-follow-up` / MCP `browserFollowUps` (commit `c888fd3`)

## Files

| File | Action | Description |
|------|--------|-------------|
| `web-ai/chatgpt.mjs` | MODIFY | Follow-up send loop after initial response |
| `web-ai/cli.mjs` | MODIFY | `--follow-up "prompt"` flag (repeatable) |
| `web-ai/session.mjs` | MODIFY | Track turnIndex per session |
| `web-ai/gemini-live.mjs` | MODIFY | Follow-up support for Gemini |
| `web-ai/grok-live.mjs` | MODIFY | Follow-up support for Grok |

## Diff Plan

### MODIFY `web-ai/cli.mjs`

```javascript
// Add --follow-up flag (repeatable):
// agbrowse web-ai send chatgpt "initial prompt" --follow-up "clarify X" --follow-up "now do Y"
// Parse as array, pass to provider send function
```

### MODIFY `web-ai/chatgpt.mjs`

```javascript
// After initial send+poll completes:
// For each follow-up prompt:
//   1. Wait for promptReady state (send button visible, no stop button)
//   2. Type follow-up into composer
//   3. Submit
//   4. Poll for response (scoped to new turnIndex)
//   5. Collect images if any (minTurnIndex)
//   6. Append to session result
// Return combined result with all turns
```

### MODIFY `web-ai/session.mjs`

```javascript
// Add turnIndex tracking:
// session.turnIndex starts at 0
// Increment after each successful send+poll
// Used by image collection and response scoping
```

## Guardrails

- Only send caller-provided follow-up prompts — never autonomous
- Each follow-up waits for previous response to complete
- Timeout per turn, not per conversation
- On any turn failure, return partial results (completed turns)

## Test Plan

1. Single follow-up → verify both responses captured
2. Multiple follow-ups → verify all turns in order
3. Follow-up with image generation → verify minTurnIndex scoping
4. Mid-conversation failure → verify partial results returned
