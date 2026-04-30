export class BrowserCapabilityError extends Error {
    constructor(message, input) {
        super(message);
        this.name = 'BrowserCapabilityError';
        this.capabilityId = input.capabilityId;
        this.stage = input.stage;
        this.mutationAllowed = input.mutationAllowed === true;
    }
}

export class ActionTranscript {
    warnings = [];
    usedFallbacks = [];

    warn(message) {
        this.warnings.push(message);
    }

    fallback(name) {
        this.usedFallbacks.push(name);
    }

    toJSON() {
        return {
            warnings: [...this.warnings],
            usedFallbacks: [...this.usedFallbacks],
        };
    }
}

export async function findVisibleCandidate(page, selectors, options = {}) {
    const timeoutMs = Math.max(0, options.timeoutMs ?? 0);
    const pollIntervalMs = Math.max(25, options.pollIntervalMs ?? 250);
    const deadline = Date.now() + timeoutMs;
    let firstCandidate = null;

    do {
        for (const selector of selectors) {
            const baseLocator = page.locator(selector);
            const count = await baseLocator.count().catch(() => 0);
            for (let index = 0; index < count; index += 1) {
                const locator = typeof baseLocator.nth === 'function' ? baseLocator.nth(index) : baseLocator.first();
                const visible = await isLocatorVisible(locator);
                const candidate = { selector, index, locator, visible };
                firstCandidate ??= candidate;
                if (visible) return candidate;
            }
        }
        if (Date.now() >= deadline) break;
        await page.waitForTimeout?.(pollIntervalMs);
    } while (timeoutMs > 0);

    return options.allowFirstCandidateFallback ? firstCandidate : null;
}

export async function captureTextBaseline(page, selectors) {
    const texts = await readTexts(page, selectors);
    return {
        selectors: [...selectors],
        texts,
        count: texts.length,
        textHash: hashTexts(texts),
        capturedAt: new Date().toISOString(),
    };
}

export async function waitForStableTextAfterBaseline(page, selectors, baseline, options) {
    const timeoutMs = Math.max(1, options.timeoutMs);
    const stableWindowMs = Math.max(100, options.stableWindowMs ?? 1000);
    const pollIntervalMs = Math.max(25, options.pollIntervalMs ?? 250);
    const minCount = Math.max(baseline.count + 1, options.minCount ?? 0);
    const deadline = Date.now() + timeoutMs;
    const warnings = [];
    let stableText;
    let stableSince = null;

    while (Date.now() < deadline) {
        const texts = await readTexts(page, selectors);
        const latestText = texts.slice(baseline.count).filter(Boolean).at(-1);
        if (texts.length >= minCount && latestText) {
            if (latestText === stableText) {
                if (stableSince !== null && Date.now() - stableSince >= stableWindowMs) {
                    return { ok: true, baseline, latestText, warnings };
                }
            } else {
                stableText = latestText;
                stableSince = Date.now();
            }
        } else {
            stableText = undefined;
            stableSince = null;
        }
        await page.waitForTimeout?.(pollIntervalMs);
    }
    warnings.push('stable-text-timeout');
    return { ok: false, baseline, latestText: stableText, warnings };
}

export async function isLocatorVisible(locator) {
    const waited = await locator.waitFor?.({ state: 'visible', timeout: 500 }).then(() => true).catch(() => false);
    if (waited) return true;
    const box = await locator.boundingBox?.().catch(() => null);
    if (box && box.width > 0 && box.height > 0) return true;
    return Boolean(await locator.evaluate?.((node) => {
        if (!node || typeof node.getBoundingClientRect !== 'function') return false;
        const rect = node.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        const style = globalThis.getComputedStyle?.(node);
        return !style || (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0');
    }).catch(() => false));
}

async function readTexts(page, selectors) {
    const evaluated = await page.evaluate?.((innerSelectors) => {
        for (const selector of innerSelectors) {
            const texts = Array.from(document.querySelectorAll(selector))
                .map((el) => String(el.innerText || el.textContent || '').trim())
                .filter(Boolean);
            if (texts.length) return texts;
        }
        return [];
    }, selectors).catch(() => []);
    if (Array.isArray(evaluated) && evaluated.length > 0) return evaluated.map(String);

    for (const selector of selectors) {
        const locators = await page.locator(selector).all().catch(() => []);
        const texts = [];
        for (const locator of locators) {
            const text = String(await locator.innerText?.().catch(() => '') || '').trim();
            if (text) texts.push(text);
        }
        if (texts.length) return texts;
    }
    return [];
}

function hashTexts(texts) {
    let hash = 2166136261;
    for (const text of texts) {
        for (let i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
    }
    return (hash >>> 0).toString(16);
}
