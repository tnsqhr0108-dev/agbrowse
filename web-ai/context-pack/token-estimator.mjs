import {
    DEFAULT_BROWSER_INLINE_CHAR_BUDGET,
    DEFAULT_MODEL_INPUT_BUDGETS,
    DEFAULT_TOKEN_WARNING_RATIO,
} from './constants.mjs';

const SECTION_OVERHEAD_TOKENS = 16;

export function estimateTokens(text = '', sectionCount = 1) {
    const chars = String(text || '').length;
    return Math.ceil(chars / 3) + Math.max(0, sectionCount) * SECTION_OVERHEAD_TOKENS;
}

export function resolveMaxInputTokens(input = {}) {
    const explicit = Number(input.maxInput || 0);
    if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);

    const vendor = String(input.vendor || 'chatgpt').toLowerCase();
    const model = String(input.model || 'default').toLowerCase();
    const vendorBudgets = DEFAULT_MODEL_INPUT_BUDGETS[vendor] || DEFAULT_MODEL_INPUT_BUDGETS.chatgpt;
    return vendorBudgets[model] || vendorBudgets.default || DEFAULT_MODEL_INPUT_BUDGETS.chatgpt.default;
}

export function buildBudgetReport(input = {}, composerText = '', files = []) {
    const maxInputTokens = resolveMaxInputTokens(input);
    const estimatedTokens = estimateTokens(composerText, files.length + 2);
    const inlineCharLimit = Number(input.inlineCharLimit || DEFAULT_BROWSER_INLINE_CHAR_BUDGET);
    const inlineChars = composerText.length;
    const status = estimatedTokens > maxInputTokens || inlineChars > inlineCharLimit
        ? 'over-budget'
        : estimatedTokens >= maxInputTokens * DEFAULT_TOKEN_WARNING_RATIO
            ? 'warning'
            : 'ok';

    return {
        status,
        estimatedTokens,
        maxInputTokens,
        inlineChars,
        inlineCharLimit,
    };
}
