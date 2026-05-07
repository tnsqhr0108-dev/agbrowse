# Plan: Session Artifacts

**Issue: #72** | **Priority: P2** | **Status: planned** | **Depends: #68**

## Problem

agbrowse only persists session metadata and baselines. Oracle saves durable artifacts per session: transcripts, Deep Research reports, generated images.

## Files

| File | Action | Description |
|------|--------|-------------|
| `web-ai/session-artifacts.mjs` | NEW | Artifact storage and retrieval |
| `web-ai/tab-finalizer.mjs` | MODIFY | Save artifacts on finalization |
| `web-ai/session.mjs` | MODIFY | Artifact path in session metadata |
| `web-ai/cli.mjs` | MODIFY | `artifacts` subcommand for listing |

## Diff Plan

### NEW `web-ai/session-artifacts.mjs`

```javascript
// Artifacts directory: DATA_DIR/artifacts/<sessionId>/
// Types: transcript.md, report.md, image-*.png, metadata.json

export function resolveArtifactsDir(sessionId)
export async function saveTranscript(sessionId, markdown)
export async function saveReport(sessionId, { text, html, sources })
export async function listArtifacts(sessionId)
export async function cleanupOldArtifacts({ maxAgeMs })
```

### MODIFY `web-ai/tab-finalizer.mjs`

```javascript
// After session completion:
// 1. Save conversation transcript as markdown
// 2. Save any collected images (from #68)
// 3. Save Deep Research report if applicable (from #70)
// 4. Record artifact paths in session metadata
```

## Storage Layout

```
~/.browser-agent/artifacts/
  <sessionId>/
    metadata.json     # { sessionId, vendor, completedAt, artifacts: [...] }
    transcript.md     # Conversation turns in markdown
    report.md         # Deep Research report (if applicable)
    image-1.png       # Generated images
    image-2.jpg
```

## Test Plan

1. Complete session → verify transcript saved
2. Image generation session → verify images in artifacts dir
3. Cleanup old artifacts → verify only old ones removed
4. List artifacts → verify correct metadata returned
