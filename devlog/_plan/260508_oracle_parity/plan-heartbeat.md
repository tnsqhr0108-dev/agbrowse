# Plan: Heartbeat/Liveness During Responses

**Issue: #75** | **Priority: P3** | **Status: planned**

## Problem

agbrowse poll loop is silent until completion. Long ChatGPT responses (especially Pro/Deep Research) give no feedback.

## Files

| File | Action | Description |
|------|--------|-------------|
| `web-ai/poll-heartbeat.mjs` | NEW | Heartbeat emitter during poll |
| `web-ai/chatgpt.mjs` | MODIFY | Integrate heartbeat into poll loop |
| `web-ai/cli.mjs` | MODIFY | `--heartbeat` / `--quiet` flags |

## Diff Plan

### NEW `web-ai/poll-heartbeat.mjs`

```javascript
export function createHeartbeat(interval = 5000)
// Emit periodic status: { elapsed, thinking, partialLength, state }
// Safe metadata only — never log thinking/reasoning text
// Return { tick(status), stop() }
```

### MODIFY `web-ai/chatgpt.mjs`

```javascript
// In poll loop, every N seconds:
// heartbeat.tick({ thinking: isThinking, partialLength: text.length })
// Output: [heartbeat] 15s elapsed, thinking, ~2400 chars
```

## Test Plan

1. Long response → verify periodic heartbeat output
2. --quiet flag → verify no heartbeat
3. Thinking indicator → verify "thinking" state reported without content
