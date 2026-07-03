# Provider Expansion — Perplexity (perplexity.ai)

> Priority: 2nd
> URL: https://www.perplexity.ai
> Complexity: MEDIUM — URL navigation pattern, overlay dismiss, search-first UX

## 1. Why Perplexity is Unique

Perplexity is not a pure chatbot — it's **search + AI synthesis**. This gives agbrowse a
differentiated capability: verified web search results with citations, not just LLM generation.

Key UX differences from ChatGPT/Gemini/Claude:
- After submit, **URL changes** from `/` to `/search/<slug>-<id>` (navigation-based)
- Response includes **source citations** (links to real web pages)
- **Overlay popups** (sign-in, onboarding) frequently block interaction
- Works **without login** for basic queries (Pro features need auth)
- Cloudflare bot protection — but CDP-attach bypasses this entirely

## 2. Architecture

### Files to Create

```
web-ai/perplexity-live.mjs     — capabilities + status/send/poll/query/stop (NEW)
web-ai/perplexity-model.mjs    — model aliases + mode mapping (NEW)
```

### Files to Modify

```
web-ai/cli.mjs                 — add Perplexity dispatch block
```

## 3. DOM Selectors (from 10x-chat + live analysis)

```javascript
const PERPLEXITY_HOSTS = ['www.perplexity.ai', 'perplexity.ai'];

const SELECTORS = {
    // Composer
    composer: 'div[role="textbox"][contenteditable="true"]',

    // Submit
    sendButton: 'button[aria-label="Submit"]',

    // Response — prose/markdown container
    responseTurn: '.prose',

    // Login state detection
    loginIndicator: 'a:has-text("Sign In"), button:has-text("Sign In")',

    // Overlay/popup dismissal
    closeButton: 'button[aria-label="Close"]',
    signInPopup: 'button:has-text("Continue with Google")',
    overlayFadeIn: '.animate-in.fade-in',

    // File attachment
    fileButton: 'button[aria-label="Add files or tools"]',
    fileInput: 'input[type="file"]',

    // Focus mode selector (Pro feature)
    focusModeButton: 'button[aria-label="Focus"]',

    // Source citations
    citationLinks: 'a[data-testid="citation"], .citation-link',
};
```

## 4. Model / Mode Mapping

Perplexity doesn't have traditional "models" like ChatGPT. Instead it has:

### Underlying Models (Pro users)
```javascript
export const PERPLEXITY_MODEL_ALIASES = {
    'auto': 'Auto',
    'default': 'Auto',
    'sonar': 'Sonar',
    'sonar-pro': 'Sonar Pro',
    'gpt': 'GPT-4.1',
    'gpt-4.1': 'GPT-4.1',
    'gpt-4': 'GPT-4.1',
    'claude': 'Claude 4 Sonnet',
    'claude-sonnet': 'Claude 4 Sonnet',
    'sonnet': 'Claude 4 Sonnet',
};
```

### Focus Modes (search scope)
```javascript
export const PERPLEXITY_FOCUS_MODES = {
    'all': 'All',           // default web search
    'academic': 'Academic', // scholarly papers
    'writing': 'Writing',   // creative writing (no search)
    'math': 'Math',         // Wolfram Alpha integration
    'video': 'Video',       // YouTube search
    'social': 'Social',     // Reddit/forum search
};
```

### Effort Mapping

Perplexity's "effort" maps to model tier:

| agbrowse effort | Perplexity model | Rationale |
|-----------------|-----------------|-----------|
| `low` / `fast` | Sonar | Fast, basic search |
| `standard` | Auto | Default balanced |
| `extended` | Sonar Pro | Deep search + reasoning |
| `heavy` | GPT-4.1 or Claude 4 Sonnet | Maximum quality |

```javascript
export const PERPLEXITY_EFFORT_TO_MODEL = {
    low: 'Sonar',
    light: 'Sonar',
    fast: 'Sonar',
    standard: 'Auto',
    normal: 'Auto',
    default: 'Auto',
    extended: 'Sonar Pro',
    high: 'Sonar Pro',
    heavy: 'GPT-4.1',
};
```

## 5. Key Implementation Details

### 5.1 URL Navigation Pattern

Unlike other providers where the URL stays the same, Perplexity navigates
from the home page to a search result page after submit:

```
Before: https://www.perplexity.ai/
After:  https://www.perplexity.ai/search/how-does-cdp-attach-work-<id>
```

Must detect this URL change to know the response page has loaded:
```javascript
// Wait for URL to change (from 10x-chat's waitForUrlChange pattern)
async function waitForPerplexityNavigation(page, initialUrl, timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const currentUrl = page.url();
        if (currentUrl !== initialUrl && currentUrl.includes('/search/')) {
            return true;
        }
        await new Promise(r => setTimeout(r, 200));
    }
    return false;
}
```

### 5.2 Overlay Dismissal

Perplexity aggressively shows sign-in popups that block the submit button.
Must dismiss before ANY interaction:

```javascript
async function dismissPerplexityOverlays(page) {
    for (let i = 0; i < 3; i++) {
        // Try close button
        const closeBtn = await page.$(SELECTORS.closeButton);
        if (closeBtn) {
            const visible = await closeBtn.evaluate(el =>
                el.getBoundingClientRect().width > 0);
            if (visible) {
                await closeBtn.click();
                await sleep(500);
                continue;
            }
        }
        // Try Escape
        const overlay = await page.$(SELECTORS.overlayFadeIn);
        if (overlay) {
            await page.keyboard.press('Escape');
            await sleep(300);
            continue;
        }
        break;
    }
}
```

### 5.3 Response Extraction

Perplexity response is in `.prose` container. Includes:
- Main answer text (markdown formatted)
- Inline citations `[1]`, `[2]` etc.
- Source links at bottom

Extraction must preserve citations for source audit:
```javascript
async function extractPerplexityResponse(page) {
    const prose = await page.$('.prose');
    if (!prose) return { text: '', citations: [] };

    const text = await prose.evaluate(el => el.innerText.trim());

    // Extract citation URLs
    const citations = await page.$$eval(
        SELECTORS.citationLinks,
        links => links.map(a => ({
            index: a.textContent?.trim(),
            url: a.href,
            title: a.title || a.textContent,
        }))
    );

    return { text, citations };
}
```

### 5.4 CDP-Attach Advantage for Perplexity

10x-chat marks Perplexity as `headlessBlocked: true` — Cloudflare blocks headless Playwright.
They must run in headed mode (visible browser), which is slower and clunky.

agbrowse with CDP-attach: **zero bot detection issues**. User's real Chrome session
means Cloudflare sees a legitimate human browser. This is a major competitive advantage.

### 5.5 Login Optional

Perplexity works without login for basic queries. Pro features (model selection,
file upload, focus modes) require auth. The capability probe should report:
- `ok` if composer is visible (basic mode)
- `warn` if Sign In button is visible (limited features)

## 6. Capability Probes

```javascript
export const perplexityCapabilities = [
    defineCapability('perplexity-active-tab-verification',
        async (deps) => probeHostMatches(await deps.getPage(), PERPLEXITY_HOSTS)),

    defineCapability('perplexity-composer-visible',
        async (deps) => {
            const page = await deps.getPage();
            await dismissPerplexityOverlays(page);
            return probeFirstVisibleSelector(page, SELECTORS.composer);
        }),

    defineCapability('perplexity-model-selectable',
        async (deps, input) => {
            // Only Pro users can select models
            const page = await deps.getPage();
            const signedIn = !(await page.$(SELECTORS.loginIndicator));
            if (!signedIn) return { status: 'warn', reason: 'not logged in, basic mode only' };
            return { status: 'ok' };
        }),

    defineCapability('perplexity-response-container',
        async (deps) => probeFirstVisibleSelector(await deps.getPage(), SELECTORS.responseTurn)),
];
```

## 7. Source Audit Integration

Perplexity is unique — it provides **real source citations**. This integrates naturally
with agbrowse's `source-audit.mjs`:

```javascript
// After response extraction, feed citations to source audit
const { text, citations } = await extractPerplexityResponse(page);

const auditResult = {
    claims: extractClaims(text),
    sources: citations.map(c => ({
        url: c.url,
        title: c.title,
        citationIndex: c.index,
    })),
    unsourcedClaims: [], // Perplexity citations are inline
};
```

This makes Perplexity the highest-quality provider for fact-checking workflows.

## 8. Test Plan

### Unit Tests
- `test/unit/perplexity-model.test.mjs` — alias normalization, effort mapping
- `test/unit/perplexity-overlay.test.mjs` — overlay dismiss logic
- `test/unit/perplexity-url-detect.test.mjs` — URL navigation detection

### DOM Fixtures
- `test/fixtures/provider-dom/perplexity/home.html`
- `test/fixtures/provider-dom/perplexity/search-result.html`
- `test/fixtures/provider-dom/perplexity/sign-in-overlay.html`

### Smoke Test
- Navigate to perplexity.ai → verify composer visible
- Dismiss any overlay → verify submit button clickable
- Send test query → verify URL changes to /search/*
- Verify response text + citations extracted

## 9. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Overlay pattern changes | MEDIUM | Multiple dismiss strategies (close, Escape, click-outside) |
| URL pattern changes | LOW | Flexible `/search/` prefix match |
| Citation format changes | LOW | Fallback to plain text extraction |
| Model selector UI changes | MEDIUM | Pro-only, degrade gracefully to Auto |
| Rate limiting (free tier) | LOW | User's own account |

## 10. Estimated Effort

- `perplexity-model.mjs`: ~120 lines (model aliases, focus modes, effort mapping)
- `perplexity-live.mjs`: ~400 lines (overlay dismiss, URL nav, citation extraction)
- `cli.mjs` changes: ~25 lines
- Tests: ~200 lines
- **Total: ~745 lines, ~1 day**
