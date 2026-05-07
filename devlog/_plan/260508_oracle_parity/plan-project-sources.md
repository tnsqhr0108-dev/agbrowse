# Plan: ChatGPT Project Sources Management

**Issue: #73** | **Priority: P3** | **Status: planned**

## Problem

Oracle supports non-destructive ChatGPT Project Sources management. agbrowse has no Project Sources support.

## Files

| File | Action | Description |
|------|--------|-------------|
| `web-ai/chatgpt-project-sources.mjs` | NEW | Project Sources list/add via DOM |
| `web-ai/cli.mjs` | MODIFY | `project-sources list\|add` subcommand |

## Diff Plan

### NEW `web-ai/chatgpt-project-sources.mjs`

```javascript
export async function listProjectSources(cdpSession)
// Navigate to project settings
// Extract existing sources from DOM
// Return: [{ name, type, url }]

export async function addProjectSource(cdpSession, { name, content })
// Navigate to project settings
// Click "Add source"
// Fill in source details
// Non-destructive: never remove existing sources
```

## Test Plan

1. List sources on empty project → verify empty array
2. Add source → verify appears in list
3. Add duplicate → verify no error, no duplicate
