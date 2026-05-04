import { afterEach, describe, expect, it } from 'vitest';
import { commandNeedsHeadedBrowser, ensureHeadedBrowserForWebAi } from '../../web-ai/cli.mjs';

const ORIGINAL_AUTO_START = process.env.AGBROWSE_WEB_AI_AUTO_START;

afterEach(() => {
    if (ORIGINAL_AUTO_START === undefined) delete process.env.AGBROWSE_WEB_AI_AUTO_START;
    else process.env.AGBROWSE_WEB_AI_AUTO_START = ORIGINAL_AUTO_START;
});

describe('web-ai headed browser preflight', () => {
    it('requires a browser for provider commands but not render/context commands', () => {
        expect(commandNeedsHeadedBrowser('send')).toBe(true);
        expect(commandNeedsHeadedBrowser('query')).toBe(true);
        expect(commandNeedsHeadedBrowser('poll')).toBe(true);
        expect(commandNeedsHeadedBrowser('status')).toBe(true);
        expect(commandNeedsHeadedBrowser('watch')).toBe(true);
        expect(commandNeedsHeadedBrowser('doctor')).toBe(true);
        expect(commandNeedsHeadedBrowser('sessions', ['sessions', 'resume'])).toBe(true);
        expect(commandNeedsHeadedBrowser('render')).toBe(false);
        expect(commandNeedsHeadedBrowser('context-dry-run')).toBe(false);
        expect(commandNeedsHeadedBrowser('sessions', ['sessions', 'list'])).toBe(false);
    });

    it('auto-starts headed Chrome when provider command runs without CDP', async () => {
        const calls = [];
        const result = await ensureHeadedBrowserForWebAi({
            getPort: () => 9777,
            getBrowserStatus: async () => ({ running: false, tabs: 0 }),
            ensureStarted: async (options) => calls.push(options),
            readBrowserState: () => null,
        }, 'query', ['query']);
        expect(result).toEqual({ ok: true, status: 'started', port: 9777 });
        expect(calls).toEqual([{ port: 9777, headed: true }]);
    });

    it('fails closed when auto-start is disabled', async () => {
        process.env.AGBROWSE_WEB_AI_AUTO_START = '0';
        await expect(ensureHeadedBrowserForWebAi({
            getPort: () => 9777,
            getBrowserStatus: async () => ({ running: false, tabs: 0 }),
            ensureStarted: async () => {
                throw new Error('should not start');
            },
        }, 'send', ['send'])).rejects.toMatchObject({
            errorCode: 'cdp.unreachable',
            retryHint: 'start-headed',
        });
    });

    it('rejects existing agbrowse headless Chrome for provider commands', async () => {
        await expect(ensureHeadedBrowserForWebAi({
            getPort: () => 9777,
            getBrowserStatus: async () => ({ running: true, tabs: 1 }),
            readBrowserState: () => ({ headless: true }),
        }, 'poll', ['poll'])).rejects.toMatchObject({
            errorCode: 'cdp.headless',
            retryHint: 'restart-headed',
        });
    });
});
