# Provider Expansion — Claude (claude.ai)

> Priority: 1st (highest user demand)
> URL: https://claude.ai/new
> Complexity: MEDIUM — stable DOM, model picker exists, thinking blocks need stripping

## 1. Architecture

### Files to Create

```
web-ai/claude-live.mjs     — capabilities + status/send/poll/query/stop (NEW)
web-ai/claude-model.mjs    — model aliases + effort mapping + UI selection (NEW)
```

### Files to Modify

```
web-ai/cli.mjs             — add Claude dispatch block + vendor URL + validation
```

## 2. DOM Selectors (from 10x-chat analysis + live inspection)

```javascript
const CLAUDE_HOSTS = ['claude.ai'];

const SELECTORS = {
    // Composer
    composer: '[contenteditable="true"].ProseMirror, div[enterkeyhint="enter"]',

    // Send button
    sendButton: [
        'button[aria-label="Send message"]',
        'button[aria-label="Send Message"]',
        'button[data-testid="send-message"]',
    ].join(', '),

    // Response container — multiple fallbacks
    responseTurn: [
        '[data-is-streaming]',
        '.font-claude-message',
        '.font-claude-response',
        '[data-testid="assistant-message"]',
        '[data-testid="user-message"] ~ div',
    ].join(', '),

    // Model picker
    modelPicker: 'button[data-testid="model-selector-dropdown"]',
    modelOption: '[role="menuitem"]',

    // Model dropdown scope containers
    modelOptionScope: [
        '[role="menu"]',
        '[role="listbox"]',
        '[data-radix-popper-content-wrapper]',
        '[data-headlessui-portal]',
        '[data-floating-ui-portal]',
        '[role="dialog"]',
    ],

    // File upload
    fileInput: '[data-testid="file-upload"], #chat-input-file-upload-onpage',

    // Streaming indicator
    streamingIndicator: '[data-is-streaming]',

    // Thinking blocks to strip from response
    thinkingBlocks: [
        'details',
        '[data-testid*="thinking"]',
        '[class*="thinking"]',
        'button[aria-expanded]',
    ],
};
```

## 3. Model Aliases & Effort Mapping

### claude-model.mjs

```javascript
// Model alias normalization
export const CLAUDE_MODEL_ALIASES = {
    'opus': 'opus-4.6',
    'opus-4': 'opus-4.6',
    'opus-4.6': 'opus-4.6',
    'opus-4.7': 'opus-4.7',
    'sonnet': 'sonnet-4.6',
    'sonnet-4': 'sonnet-4.6',
    'sonnet-4.6': 'sonnet-4.6',
    'haiku': 'haiku-4.5',
    'haiku-4': 'haiku-4.5',
    'haiku-4.5': 'haiku-4.5',
    'fast': 'haiku-4.5',       // effort normalization
    'thinking': 'opus-4.6',    // effort normalization
    'pro': 'opus-4.7',         // effort normalization
    'extended': 'opus-4.6',    // extended thinking
};

// Model display names (what appears in Claude's model picker UI)
export const CLAUDE_MODEL_DISPLAY = {
    'opus-4.6': 'Opus 4.6',
    'opus-4.7': 'Opus 4.7',
    'sonnet-4.6': 'Sonnet 4.6',
    'haiku-4.5': 'Haiku 4.5',
};

// Effort mapping — Claude doesn't have per-model effort sliders like ChatGPT.
// Instead, effort maps to model selection:
// - low/fast → Haiku (fastest, cheapest)
// - standard → Sonnet (balanced)
// - extended → Opus (deepest reasoning)
// - heavy → Opus with extended thinking enabled (if available in UI)
export const CLAUDE_EFFORT_TO_MODEL = {
    low: 'haiku-4.5',
    light: 'haiku-4.5',
    fast: 'haiku-4.5',
    standard: 'sonnet-4.6',
    normal: 'sonnet-4.6',
    default: 'sonnet-4.6',
    extended: 'opus-4.6',
    high: 'opus-4.6',
    heavy: 'opus-4.7',
};
```

### Design Decision: Effort → Model Mapping

Claude's web UI doesn't have effort sliders — it has model tiers. So agbrowse's
`--effort` flag maps to model selection for Claude:

| agbrowse effort | Claude model | Rationale |
|-----------------|-------------|-----------|
| `low` / `fast` | Haiku 4.5 | Fastest responses |
| `standard` | Sonnet 4.6 | Balanced quality/speed |
| `extended` | Opus 4.6 | Deep reasoning |
| `heavy` | Opus 4.7 | Maximum capability |

This maintains agbrowse's cross-vendor effort normalization promise.

## 4. Capability Probes

```javascript
export const claudeCapabilities = [
    defineCapability('claude-active-tab-verification',
        async (deps) => probeHostMatches(await deps.getPage(), CLAUDE_HOSTS)),

    defineCapability('claude-composer-visible',
        async (deps) => probeFirstVisibleSelector(await deps.getPage(), SELECTORS.composer)),

    defineCapability('claude-model-alias-selectable',
        async (deps, input) => claudeModelCapabilityProbe(await deps.getPage(), input.model)),

    defineCapability('claude-upload-surface-visible',
        async (deps) => probeFirstVisibleSelector(await deps.getPage(), SELECTORS.fileInput)),

    defineCapability('claude-copy-button-present',
        async (deps) => probeFirstVisibleSelector(await deps.getPage(),
            'button[aria-label="Copy"]')),

    defineCapability('claude-response-streaming',
        async (deps) => probeFirstVisibleSelector(await deps.getPage(),
            SELECTORS.streamingIndicator)),
];
```

## 5. Key Implementation Details

### 5.1 Thinking Block Stripping

Claude shows "thinking" blocks (collapsible `<details>` or `[class*="thinking"]` divs)
before the actual response. Must strip these from captured text.

10x-chat's approach (reusable):
```javascript
// Clone response node, remove thinking elements, extract remaining text
const clone = responseEl.cloneNode(true);
for (const sel of SELECTORS.thinkingBlocks) {
    clone.querySelectorAll(sel).forEach(el => el.remove());
}
return clone.innerText.trim();
```

Also strip leading thinking prefixes via regex:
```javascript
const THINKING_PREFIX_RE = /^(thinking(?: about)?\b|thought for\b|pondering\b|analyzing\b|considering\b|evaluating\b|processing\b|synthesized?\b|let me\b|stand by\b)/i;
```

### 5.2 Model Picker Automation

Claude's model picker uses Radix UI popover:
1. Click `button[data-testid="model-selector-dropdown"]`
2. Wait for `[role="menu"]` or `[data-radix-popper-content-wrapper]`
3. Find `[role="menuitem"]` matching model name
4. Click it
5. Verify picker text changed

Fallback: if exact model not found, try fuzzy match (e.g., "Opus" matches "Claude Opus 4.6").

### 5.3 Streaming Detection

Claude uses `[data-is-streaming]` attribute on the response container while generating.
Poll until this attribute disappears + text stabilizes.

### 5.4 Composer Handling

Claude uses ProseMirror (`[contenteditable="true"].ProseMirror`).
- Must use `insertText` (not `fill`) for contenteditable
- Clear with Ctrl+A → Backspace first
- Fallback: `element.innerText = text` + dispatch `input` event

### 5.5 CDP-Attach Advantage

Unlike 10x-chat which must handle Cloudflare on claude.ai login,
agbrowse attaches to user's already-authenticated Chrome session.
No bot detection, no login flow, no Patchright dependency.

## 6. Response Extraction Chain

```
1. DOM: querySelector(responseTurn) → strip thinking → innerText
2. Copy button: click button[aria-label="Copy"] → clipboard read
3. copy-markdown fallback: existing agbrowse chain
```

## 7. Test Plan

### Unit Tests
- `test/unit/claude-model.test.mjs` — alias normalization, effort mapping
- `test/unit/claude-selectors.test.mjs` — DOM fixture parsing

### DOM Fixtures
- `test/fixtures/provider-dom/claude/new-conversation.html`
- `test/fixtures/provider-dom/claude/streaming-response.html`
- `test/fixtures/provider-dom/claude/thinking-block.html`
- `test/fixtures/provider-dom/claude/model-picker-open.html`

### Smoke Test
- Navigate to claude.ai/new → verify composer visible
- Select model → verify picker reflects change
- Send test prompt → verify response captured
- Verify thinking blocks stripped from output

## 8. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Claude UI redesign | MEDIUM | Multiple selector fallbacks, data-testid preferred |
| Rate limiting | LOW | User's own account, subject to their plan limits |
| Thinking block format change | LOW | Regex + DOM stripping dual approach |
| Extended thinking toggle | MEDIUM | May need separate UI path if toggle exists |
| Artifacts panel | LOW | Response extraction targets message, not artifact |

## 9. Estimated Effort

- `claude-model.mjs`: ~150 lines (model aliases, effort mapping, picker automation)
- `claude-live.mjs`: ~350 lines (capabilities, status/send/poll/query/stop)
- `cli.mjs` changes: ~30 lines (dispatch block, URL, validation set)
- Tests: ~200 lines
- **Total: ~730 lines, ~1 day**
