# Plan: Auto-Archive One-Shot Browser Runs

**Issue: #74** | **Priority: P3** | **Status: planned** | **Depends: #72**

## Problem

Completed one-shot conversations remain open in ChatGPT indefinitely, cluttering the sidebar.

## Files

| File | Action | Description |
|------|--------|-------------|
| `web-ai/chatgpt-archive.mjs` | NEW | Archive conversation via ChatGPT UI |
| `web-ai/tab-finalizer.mjs` | MODIFY | Archive on completion when flag set |
| `web-ai/cli.mjs` | MODIFY | `--archive` flag |

## Diff Plan

### NEW `web-ai/chatgpt-archive.mjs`

```javascript
export async function archiveConversation(cdpSession, targetId)
// Click conversation menu → Archive
// Wait for archive confirmation
// Only after artifacts are saved
```

## Test Plan

1. Send with --archive → verify conversation archived after completion
2. Send without --archive → verify conversation stays open
3. Failed send with --archive → verify no archive attempt
