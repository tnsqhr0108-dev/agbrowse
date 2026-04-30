export const GEMINI_MODEL_ALIASES = {
    fast: 'fast',
    flash: 'fast',
    'gemini-fast': 'fast',
    thinking: 'thinking',
    think: 'thinking',
    'gemini-thinking': 'thinking',
    pro: 'pro',
    'gemini-pro': 'pro',
    '3.1-pro': 'pro',
};

export const GEMINI_DEEP_THINK_ALIASES = new Set([
    'deepthink',
    'deep-think',
    'deep_think',
    'deep think',
    'gemini-deepthink',
    'gemini-deep-think',
]);

const MODE_BUTTONS = [
    'button[data-test-id="bard-mode-menu-button"]',
    'button[aria-label="Open mode picker"]',
    'button[aria-label*="mode picker" i]',
];

const MODE_OPTIONS = {
    fast: { testId: 'bard-mode-option-fast', labels: ['Fast'] },
    thinking: { testId: 'bard-mode-option-thinking', labels: ['Thinking'] },
    pro: { testId: 'bard-mode-option-pro', labels: ['Pro'] },
};

export function normalizeGeminiModelChoice(model) {
    const key = String(model || '').trim().toLowerCase();
    if (!key) return null;
    return GEMINI_MODEL_ALIASES[key] || null;
}

export function isGeminiDeepThinkChoice(model) {
    const key = String(model || '').trim().toLowerCase();
    return GEMINI_DEEP_THINK_ALIASES.has(key);
}

export async function selectGeminiModel(page, model) {
    if (isGeminiDeepThinkChoice(model)) return null;
    const requested = normalizeGeminiModelChoice(model);
    if (!requested) {
        if (model) throw new Error(`unsupported Gemini model selection: ${model}`);
        return null;
    }
    const usedFallbacks = [];
    const before = await readGeminiModel(page);
    if (before === requested) return { requested, selected: before, alreadySelected: true, usedFallbacks };
    await openGeminiModelMenu(page, usedFallbacks);
    const option = await findGeminiModelOption(page, requested);
    if (!option) throw new Error(`Gemini model option not found: ${requested}`);
    await option.click({ timeout: 5_000 });
    await page.waitForTimeout(700).catch(() => undefined);
    const after = await readGeminiModel(page);
    if (after !== requested) throw new Error(`Gemini model verification failed: expected ${requested}, got ${after || 'none'}`);
    return { requested, selected: after, alreadySelected: false, usedFallbacks };
}

async function openGeminiModelMenu(page, usedFallbacks) {
    const modeItems = page.locator('[data-test-id^="bard-mode-option-"], [role="menuitem"]').filter({ hasText: /^Fast\b|^Thinking\b|^Pro\b/i });
    if (await modeItems.first().isVisible().catch(() => false)) return;
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
        for (const selector of MODE_BUTTONS) {
            const loc = page.locator(selector).first();
            if (!await loc.isVisible().catch(() => false)) continue;
            await loc.click({ timeout: 5_000 });
            await page.waitForTimeout(350).catch(() => undefined);
            if (await modeItems.first().isVisible().catch(() => false)) return;
        }
        await page.waitForTimeout(150).catch(() => undefined);
    }
    usedFallbacks.push('mode-menu-text-button');
    const textButton = page.locator('button').filter({ hasText: /^Fast$|^Thinking$|^Pro$/i }).first();
    if (await textButton.isVisible().catch(() => false)) {
        await textButton.click({ timeout: 5_000 });
        await page.waitForTimeout(350).catch(() => undefined);
        if (await page.locator('[data-test-id^="bard-mode-option-"], [role="menuitem"]').first().isVisible().catch(() => false)) return;
    }
    throw new Error(`Gemini mode selector not found. Tried: ${MODE_BUTTONS.join(', ')}`);
}

async function findGeminiModelOption(page, choice) {
    const option = MODE_OPTIONS[choice];
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
        const byTestId = page.locator(`[data-test-id="${option.testId}"]`).first();
        if (await byTestId.isVisible().catch(() => false)) return byTestId;
        const candidates = await page.locator('[role="menuitem"], button').all().catch(() => []);
        for (const label of option.labels) {
            const pattern = new RegExp(`^${label}\\b`, 'i');
            for (const candidate of candidates) {
                if (!await candidate.isVisible().catch(() => false)) continue;
                const text = (await candidate.innerText({ timeout: 500 }).catch(() => '')).trim().replace(/\s+/g, ' ');
                if (pattern.test(text)) return candidate;
            }
        }
        await page.waitForTimeout(150).catch(() => undefined);
    }
    return null;
}

async function readGeminiModel(page) {
    for (const selector of MODE_BUTTONS) {
        const loc = page.locator(selector).first();
        if (!await loc.isVisible().catch(() => false)) continue;
        return normalizeGeminiModelChoice(await loc.innerText({ timeout: 1_000 }).catch(() => ''));
    }
    return null;
}
