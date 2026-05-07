# Plan: ChatGPT Generated Image Collection

**Issue: #68** | **Priority: P1** | **Status: planned**

## Problem

ChatGPT generates DALL-E images inline in responses. agbrowse only captures text — generated images are silently discarded.

## Reference Implementation

Oracle `src/browser/chatgptImages.ts` (commit `9b84357`):
- DOM evaluation finds `<img>` with `backend-api/estuary/content?id=file_` URLs
- Dedupes by fileId, picks highest resolution (naturalWidth × naturalHeight)
- Downloads via fetch with ChatGPT cookies from `Network.getCookies()`
- Saves to session artifacts dir with content-type-based extension

## Files

| File | Action | Description |
|------|--------|-------------|
| `web-ai/chatgpt-images.mjs` | NEW | Image detection, download, save |
| `web-ai/chatgpt.mjs` | MODIFY | Integrate image collection into poll completion |
| `web-ai/tab-finalizer.mjs` | MODIFY | Include image paths in finalization result |
| `web-ai/cli.mjs` | MODIFY | `--output-image <path>` flag |

## Diff Plan

### NEW `web-ai/chatgpt-images.mjs`

```javascript
// Key functions:

export async function detectGeneratedImages(cdpSession, { minTurnIndex } = {})
// Evaluate JS expression in page to find generated image elements
// Pattern: img[src*="backend-api/estuary/content?id=file_"]
// Additional hints: alt="generated image", id^="image-", class="imagegen-image"
// Scan assistant turns in reverse order from minTurnIndex
// Return: [{ url, alt, width, height, fileId }]

export async function downloadGeneratedImages(cdpSession, images, outputDir)
// Get ChatGPT cookies via Network.getCookies({ urls: ["https://chatgpt.com/"] })
// Build cookie header string
// fetch each image URL with cookie + user-agent headers
// Detect extension from content-type (png/jpg/webp/gif)
// Save to outputDir with deduped filenames
// Return: [{ path, mimeType, sizeBytes, sourceUrl, fileId }]

export async function collectImages(cdpSession, { minTurnIndex, outputDir, waitTimeoutMs })
// Detect → if empty and outputDir specified, poll (1.5s interval, 15s-15m timeout)
// Download if found
// Return: { images, savedPaths, markdownSuffix }
```

### MODIFY `web-ai/chatgpt.mjs` — poll completion

```javascript
// After answer text extraction, before finalization:
const imageResult = await collectImages(cdpSession, {
    minTurnIndex: session.turnIndex,
    outputDir: opts.outputImage ? dirname(opts.outputImage) : null,
    waitTimeoutMs: 60_000,
});
if (imageResult.savedPaths.length > 0) {
    answerText += imageResult.markdownSuffix;
}
```

## Test Plan

1. Send image generation prompt → verify images detected and downloaded
2. Send text-only prompt → verify no image collection attempted
3. Follow-up turn → verify minTurnIndex scopes correctly
4. Cookie expiry → verify graceful error (not crash)
