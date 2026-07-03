import { describe, expect, it } from 'vitest';
import {
    isProviderPageDriveable,
    isProviderUrl,
    shouldNavigateToRequestedProviderUrl,
    waitForPageUrl,
} from '../../web-ai/navigation-ready.mjs';

describe('web-ai provider navigation readiness', () => {
    it('does not re-navigate a freshly created provider root tab', () => {
        expect(shouldNavigateToRequestedProviderUrl('https://chatgpt.com/', 'https://chatgpt.com/')).toBe(false);
        expect(shouldNavigateToRequestedProviderUrl('https://chatgpt.com/?model=auto', 'https://chatgpt.com/')).toBe(false);
    });

    it('navigates blank or mismatched provider pages to the requested URL', () => {
        expect(shouldNavigateToRequestedProviderUrl('', 'https://chatgpt.com/')).toBe(true);
        expect(shouldNavigateToRequestedProviderUrl('about:blank', 'https://chatgpt.com/')).toBe(true);
        expect(shouldNavigateToRequestedProviderUrl('https://chatgpt.com/c/abc', 'https://chatgpt.com/')).toBe(true);
        expect(shouldNavigateToRequestedProviderUrl('https://gemini.google.com/app', 'https://chatgpt.com/')).toBe(true);
    });

    it('recognizes supported provider URLs', () => {
        expect(isProviderUrl('https://chatgpt.com/')).toBe(true);
        expect(isProviderUrl('https://example.com/')).toBe(false);
    });

    it('waits for a newly created page URL before navigation decisions', async () => {
        let loaded = false;
        const page = {
            url: () => loaded ? 'https://chatgpt.com/' : '',
            waitForLoadState: async state => {
                expect(state).toBe('domcontentloaded');
                loaded = true;
            },
        };

        await expect(waitForPageUrl(page)).resolves.toBe('https://chatgpt.com/');
    });

    it('accepts provider pages only when Playwright page APIs respond', async () => {
        const page = {
            url: () => 'https://chatgpt.com/',
            title: async () => 'ChatGPT',
        };

        await expect(isProviderPageDriveable(page, 'https://chatgpt.com/')).resolves.toBe(true);
    });

    it('rejects stale provider pages whose Playwright probe does not respond', async () => {
        const page = {
            url: () => 'https://chatgpt.com/',
            title: () => new Promise(() => {}),
        };

        await expect(isProviderPageDriveable(page, 'https://chatgpt.com/', { probeTimeoutMs: 10 })).resolves.toBe(false);
    });
});
