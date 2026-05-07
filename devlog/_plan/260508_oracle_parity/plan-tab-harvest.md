# Plan: Rich Tab State Model + Harvest/Reattach

**Issue: #71** | **Priority: P1** | **Status: planned**

## Problem

agbrowse's tab-manager tracks lease metadata (targetId, vendor, url, owner) but can't inspect live tab content. Oracle's `liveTabs.ts` inspects model label, button states, auth status, response text, and classifies tab state.

## Reference Implementation

Oracle `src/browser/liveTabs.ts` (commit `d376a3b`):
- `ChatGptTabSummary`: 20+ fields including model label, stop/send/prompt states, auth, fingerprint
- `classifyTabState()`: detached → running → completed → stalled
- `harvestChatGptTab()`: extracts response markdown from existing tab
- `inspectChatGptTab()`: DOM evaluation for full tab state

## Files

| File | Action | Description |
|------|--------|-------------|
| `web-ai/tab-inspect.mjs` | NEW | Tab state inspection + harvest |
| `web-ai/tab-inspect-expressions.mjs` | NEW | DOM evaluation JS expressions |
| `skills/browser/browser.mjs` | MODIFY | `tabs --inspect` enriched output |
| `web-ai/cli.mjs` | MODIFY | `--tab <ref>` flag for tab reuse |

## Diff Plan

### NEW `web-ai/tab-inspect.mjs`

```javascript
// Key types and functions:

// TabSummary: { targetId, title, url, vendor, modelLabel, stopExists,
//   sendExists, promptReady, authenticated, assistantCount,
//   lastAssistantText, lastAssistantSnippet, conversationId,
//   fingerprint, state }

export async function inspectTab(port, targetId)
// Connect CDP to target, evaluate inspection expression
// Return TabSummary

export function classifyTabState(summary)
// !authenticated → 'detached'
// stopExists → 'running'
// sendExists || promptReady || assistantCount > 0 → 'completed'
// else → 'detached'

export async function harvestTab(port, targetId, { stallWindowMs } = {})
// inspectTab + extract assistant markdown
// If running + stallWindowMs: wait, re-inspect, compare fingerprint → 'stalled'
// Return TabSummary with lastAssistantMarkdown

export async function collectTabs(port)
// List all ChatGPT/Gemini/Grok targets
// inspectTab each, sort by focused + conversation URL
```

### MODIFY `skills/browser/browser.mjs` — tabs command

```javascript
// Add --inspect flag to tabs command
// When --inspect: call inspectTab for each tab, show enriched state
// Output: targetId, url, state (running/completed/detached), model, snippet
```

## Dependencies

None — can be implemented independently. Foundational for #69 (multi-turn) and #70 (deep research).

## Test Plan

1. ChatGPT tab with completed response → verify state='completed', text extracted
2. ChatGPT tab mid-generation (stop button visible) → verify state='running'
3. Non-ChatGPT tab → verify filtered out or state='detached'
4. Stall detection: running tab with no fingerprint change → verify state='stalled'
