import { createHash } from 'node:crypto';

export async function domHashAround(page, selectors, options = {}) {
    const maxChars = options.maxChars ?? 8192;
    const html = await page.evaluate((sels) => {
        const node = sels.map(s => document.querySelector(s)).find(Boolean);
        return node ? node.outerHTML : null;
    }, selectors).catch(() => null);
    if (!html) return null;
    return `sha256:${createHash('sha256').update(normalizeDomForHash(html).slice(0, maxChars)).digest('hex').slice(0, 16)}`;
}

export function normalizeDomForHash(html) {
    return String(html)
        .replace(/\sdata-message-id="[^"]*"/g, '')
        .replace(/\saria-busy="[^"]*"/g, '')
        .replace(/\sstyle="[^"]*"/g, '')
        .replace(/>([^<]{1,})</g, '><')
        .replace(/\s+/g, ' ')
        .trim();
}

export async function selectorMatchSummary(page, selectors) {
    return Promise.all(selectors.map(async selector => ({
        selector,
        matched: await page.locator(selector).count().catch(() => 0),
        visible: await page.locator(selector).first().isVisible().catch(() => false),
    })));
}
