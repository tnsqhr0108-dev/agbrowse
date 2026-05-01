import { domHashAround, selectorMatchSummary } from './dom-hash.mjs';
import { findActiveSession } from './session.mjs';
import { CHATGPT_COPY_SELECTORS, GEMINI_COPY_SELECTORS, GROK_COPY_SELECTORS } from './copy-markdown.mjs';

const CHATGPT_FEATURES = [
    { feature: 'composer', selectors: ['#prompt-textarea', '[data-testid="composer-textarea"]', 'div[contenteditable="true"]'] },
    { feature: 'model-picker', selectors: ['button[data-testid="model-switcher-dropdown-button"]', 'button[aria-label="Model selector"]', 'button[aria-label*="model selector" i]'] },
    { feature: 'upload', selectors: ['button[aria-label*="Upload" i]', 'button[aria-label*="Attach" i]', 'button[data-testid*="plus" i]'] },
    { feature: 'response-feed', selectors: ['[data-message-author-role="assistant"]', '[data-turn="assistant"]', 'article[data-testid^="conversation-turn"]'] },
    { feature: 'copy-fallback', selectors: CHATGPT_COPY_SELECTORS.copyButtonSelectors },
    { feature: 'streaming-indicator', selectors: ['button[data-testid="stop-button"]', 'button[aria-label*="Stop" i]'] },
];

const GEMINI_FEATURES = [
    { feature: 'composer', selectors: ['rich-textarea .ql-editor', '[role="textbox"][aria-label*="prompt" i]', 'div[contenteditable="true"]'] },
    { feature: 'model-picker', selectors: ['button[data-test-id="bard-mode-menu-button"]', 'button[aria-label="Open mode picker"]'] },
    { feature: 'upload', selectors: ['button[aria-label="Open upload file menu"]', 'button[aria-label*="upload file menu" i]'] },
    { feature: 'response-feed', selectors: ['model-response', '[data-response-index]'] },
    { feature: 'copy-fallback', selectors: GEMINI_COPY_SELECTORS.copyButtonSelectors },
    { feature: 'streaming-indicator', selectors: ['.response-footer.complete', 'message-actions', '[aria-label*="Good response" i]'] },
];

const GROK_FEATURES = [
    { feature: 'composer', selectors: ['.ProseMirror[contenteditable="true"]', '[contenteditable="true"].ProseMirror'] },
    { feature: 'model-picker', selectors: ['button[aria-label="Model select"]', 'button[aria-label*="Model select" i]'] },
    { feature: 'upload', selectors: ['button[aria-label*="Upload" i]', 'button[aria-label*="Attach" i]', 'button[data-testid*="plus" i]'] },
    { feature: 'response-feed', selectors: ['[data-testid="assistant-message"]', '[id^="response-"]:has([data-testid="assistant-message"])'] },
    { feature: 'copy-fallback', selectors: GROK_COPY_SELECTORS.copyButtonSelectors },
    { feature: 'streaming-indicator', selectors: ['button[aria-label*="Stop" i]', 'button:has-text("Stop")'] },
];

const DEFAULT_MAX_REPORT_BYTES = 4096;
const FULL_MAX_REPORT_BYTES = 16384;

export function featureDefinitionsForVendor(vendor) {
    switch (vendor) {
        case 'chatgpt': return CHATGPT_FEATURES;
        case 'gemini': return GEMINI_FEATURES;
        case 'grok': return GROK_FEATURES;
        default: return [];
    }
}

export async function diagnoseFeature(page, feature, options = {}) {
    const matches = await selectorMatchSummary(page, feature.selectors);
    const anyVisible = matches.some(m => m.visible);
    const anyMatched = matches.some(m => m.matched > 0);
    return {
        feature: feature.feature,
        selectorsTried: feature.selectors,
        selectorMatches: matches.filter(m => m.matched > 0),
        state: anyVisible ? 'ok' : anyMatched ? 'warn' : 'fail',
        domHash: await domHashAround(page, feature.selectors, options),
    };
}

export async function runDoctor(deps, options = {}) {
    const page = await deps.getPage();
    const vendor = options.vendor || 'chatgpt';
    const features = await Promise.all(
        featureDefinitionsForVendor(vendor).map(f => diagnoseFeature(page, f, options))
    );
    const url = await page.url();
    const lastSession = findActiveSession({ vendor, conversationUrl: url });
    const report = {
        vendor,
        url,
        capturedAt: new Date().toISOString(),
        features,
        lastSession: lastSession ? summarizeSessionForDoctor(lastSession) : null,
        warnings: [],
    };
    const maxBytes = options.full ? FULL_MAX_REPORT_BYTES : DEFAULT_MAX_REPORT_BYTES;
    return clampReport(report, maxBytes);
}

function summarizeSessionForDoctor(session) {
    return {
        sessionId: session.sessionId,
        status: session.status,
        deadlineAt: session.deadlineAt || null,
        composerBefore: session.composerBefore || null,
        composerAfter: session.composerAfter || null,
    };
}

function clampReport(report, maxBytes) {
    const raw = JSON.stringify(report);
    if (raw.length <= maxBytes) return report;
    const clamped = { ...report };
    clamped.features = clamped.features.map(f => ({
        ...f,
        selectorMatches: f.selectorMatches.slice(0, 3),
    }));
    if (clamped.lastSession) {
        if (clamped.lastSession.composerBefore?.length > 200) {
            clamped.lastSession.composerBefore = clamped.lastSession.composerBefore.slice(0, 200) + '…';
        }
        if (clamped.lastSession.composerAfter?.length > 200) {
            clamped.lastSession.composerAfter = clamped.lastSession.composerAfter.slice(0, 200) + '…';
        }
    }
    clamped.warnings = [...(clamped.warnings || []), `report-clamped:${raw.length}→${maxBytes}`];
    return clamped;
}
