import { describe, expect, it } from 'vitest';
import { domHashAround, normalizeDomForHash, selectorMatchSummary } from '../../web-ai/dom-hash.mjs';

function fakePage(evalResult, locatorMap = {}) {
    return {
        evaluate: async () => evalResult,
        locator: (selector) => ({
            count: async () => locatorMap[selector]?.count ?? 0,
            first: () => ({
                isVisible: async () => locatorMap[selector]?.visible ?? false,
            }),
        }),
    };
}

describe('dom-hash', () => {
    it('normalizeDomForHash strips cosmetic attributes', () => {
        const raw = '<div data-message-id="abc" aria-busy="true" style="color:red">hello  world</div>';
        expect(normalizeDomForHash(raw)).toBe('<div>hello world</div>');
    });

    it('normalizeDomForHash preserves structural differences', () => {
        const a = normalizeDomForHash('<div><button>Copy</button></div>');
        const b = normalizeDomForHash('<div><span>Copy</span></div>');
        expect(a).not.toBe(b);
    });

    it('domHashAround returns stable hash for same content', async () => {
        const page = fakePage('<div style="color:red" data-message-id="x">content</div>');
        const h1 = await domHashAround(page, ['div.foo']);
        const h2 = await domHashAround(page, ['div.bar']);
        expect(h1).toBe(h2);
        expect(h1).toMatch(/^sha1:[0-9a-f]{40}$/);
    });

    it('domHashAround returns different hash for different structure', async () => {
        const page1 = fakePage('<div><button>Copy</button></div>');
        const page2 = fakePage('<div><span>Copy</span></div>');
        const h1 = await domHashAround(page1, ['div']);
        const h2 = await domHashAround(page2, ['div']);
        expect(h1).not.toBe(h2);
    });

    it('domHashAround handles missing element', async () => {
        const page = fakePage('missing');
        const hash = await domHashAround(page, ['div.nonexistent']);
        expect(hash).toMatch(/^sha1:/);
    });

    it('selectorMatchSummary returns counts and visibility', async () => {
        const page = fakePage(null, {
            'button.copy': { count: 2, visible: true },
            'button.upload': { count: 0, visible: false },
        });
        const result = await selectorMatchSummary(page, ['button.copy', 'button.upload']);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ selector: 'button.copy', matched: 2, visible: true });
        expect(result[1]).toEqual({ selector: 'button.upload', matched: 0, visible: false });
    });
});
