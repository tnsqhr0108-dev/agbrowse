# Plan: Browser Control Plan Output

**Issue: #76** | **Priority: P3** | **Status: planned**

## Problem

agbrowse launches browser runs without preview. Oracle prints a control plan before execution.

## Files

| File | Action | Description |
|------|--------|-------------|
| `web-ai/control-plan.mjs` | NEW | Pre-run plan formatting |
| `web-ai/chatgpt.mjs` | MODIFY | Print plan before send |
| `web-ai/cli.mjs` | MODIFY | `--dry-run` flag |

## Diff Plan

### NEW `web-ai/control-plan.mjs`

```javascript
export function formatControlPlan({ vendor, model, prompt, files, followUps, research })
// Return formatted plan string:
// [plan] vendor=chatgpt model=gpt-5.5-pro
// [plan] prompt: "..." (42 chars)
// [plan] files: 2 (context.zip, spec.md)
// [plan] follow-ups: 1
// [plan] research: none
// [plan] flow: type → submit → poll → finalize
```

### MODIFY `web-ai/cli.mjs`

```javascript
// --dry-run: print plan, exit without executing
// Default: print plan, then execute
```

## Test Plan

1. Normal send → verify plan printed before execution
2. --dry-run → verify plan printed, no execution
3. With files and follow-ups → verify all details in plan
