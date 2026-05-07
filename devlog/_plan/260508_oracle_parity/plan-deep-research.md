# Plan: ChatGPT Deep Research Mode

**Issue: #70** | **Priority: P2** | **Status: planned** | **Depends: #71, #72**

## Problem

ChatGPT Deep Research takes minutes to complete and renders results in iframes. agbrowse has no Deep Research support — the poll loop would timeout long before research completes.

## Reference Implementation

Oracle 0.11.0 `--browser-research deep` (commit `dff95f2`)

## Files

| File | Action | Description |
|------|--------|-------------|
| `web-ai/chatgpt-deep-research.mjs` | NEW | Deep Research mode orchestration |
| `web-ai/chatgpt.mjs` | MODIFY | Route to deep research when mode specified |
| `web-ai/cli.mjs` | MODIFY | `--research deep` flag |

## Diff Plan

### NEW `web-ai/chatgpt-deep-research.mjs`

```javascript
// Key functions:

export async function sendDeepResearch(cdpSession, prompt, opts)
// 1. Select Deep Research mode in ChatGPT UI
// 2. Type and submit prompt
// 3. Monitor progress (research phase indicators)
// 4. Extended timeout (default 15min, max 30min)
// 5. Detect completion (research report appears)
// 6. Extract report from iframe if applicable
// 7. Save report as artifact

export async function extractResearchReport(cdpSession)
// Find iframe containing research report
// Extract content from iframe document
// Convert to markdown
// Return { text, html, sources }
```

## Key Differences from Normal Send

- Much longer timeout (15-30 min vs 2 min)
- Progress indicators during research phase
- Result may be in iframe, not regular assistant turn
- Reattach recovery needed (connection may drop during long wait)
- Account security blocks must fail fast (not wait full timeout)

## Test Plan

1. Deep Research prompt → verify report captured
2. Connection drop mid-research → verify reattach works
3. Account block during research → verify fast failure
4. Normal prompt with research flag → verify graceful handling
