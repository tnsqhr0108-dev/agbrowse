import { describe, expect, it } from 'vitest';
import { defineCapability, probeFirstVisibleSelector, probeHostMatches, runCapabilities, worstCapabilityState } from '../../web-ai/capability.mjs';

const CHATGPT_HOSTS = new Set(['chatgpt.com', 'chat.openai.com']);

function fakePage(url) {
    return { url: () => url };
}

function fakePageWithLocators(map) {
    return {
        url: () => 'https://example.com/',
        locator: (selector) => ({
            first: () => ({
                isVisible: async () => Boolean(map[selector]),
            }),
        }),
        waitForTimeout: async () => undefined,
    };
}

describe('web-ai capability runtime', () => {
    it('defineCapability requires a probe function', () => {
        expect(() => defineCapability('x', null)).toThrow(/probe function/);
        const cap = defineCapability('chatgpt-composer-visible', () => ({ state: 'ok' }));
        expect(cap.capabilityId).toBe('chatgpt-composer-visible');
    });

    it('runCapabilities runs every probe and never aborts on a thrown probe', async () => {
        const caps = [
            defineCapability('a', () => ({ state: 'ok', evidence: { tag: 'a' }, next: 'send' })),
            defineCapability('b', () => { throw new Error('boom'); }),
            defineCapability('c', () => ({ state: 'warn' })),
        ];
        const rows = await runCapabilities({}, caps);
        expect(rows.length).toBe(3);
        expect(rows[0]).toEqual({ capabilityId: 'a', state: 'ok', evidence: { tag: 'a' }, next: 'send' });
        expect(rows[1].state).toBe('unknown');
        expect(rows[1].evidence.error).toBe('boom');
        expect(rows[2].state).toBe('warn');
    });

    it('runCapabilities filters when input.probe is set', async () => {
        const caps = [
            defineCapability('a', () => ({ state: 'ok' })),
            defineCapability('b', () => ({ state: 'fail' })),
        ];
        const rows = await runCapabilities({}, caps, { probe: 'b' });
        expect(rows.length).toBe(1);
        expect(rows[0].capabilityId).toBe('b');
    });

    it('worstCapabilityState aggregates fail > warn > ok > unknown', () => {
        expect(worstCapabilityState([])).toBe('unknown');
        expect(worstCapabilityState([{ state: 'ok' }])).toBe('ok');
        expect(worstCapabilityState([{ state: 'ok' }, { state: 'warn' }])).toBe('warn');
        expect(worstCapabilityState([{ state: 'warn' }, { state: 'fail' }])).toBe('fail');
        expect(worstCapabilityState([{ state: 'ok' }, { state: 'unknown' }])).toBe('unknown');
    });

    it('probeHostMatches returns ok for known host and fail for foreign host', async () => {
        expect(await probeHostMatches(fakePage('https://chatgpt.com/c/x'), CHATGPT_HOSTS))
            .toMatchObject({ state: 'ok', next: 'send' });
        expect(await probeHostMatches(fakePage('https://example.com/'), CHATGPT_HOSTS))
            .toMatchObject({ state: 'fail', next: 'tab-switch' });
    });

    it('probeFirstVisibleSelector returns ok for first visible selector', async () => {
        const page = fakePageWithLocators({ '#a': false, '#b': true });
        const result = await probeFirstVisibleSelector(page, ['#a', '#b'], { timeoutMs: 50 });
        expect(result.state).toBe('ok');
        expect(result.evidence.matched).toBe('#b');
    });

    it('probeFirstVisibleSelector returns fail when none match within timeout', async () => {
        const page = fakePageWithLocators({});
        const result = await probeFirstVisibleSelector(page, ['#missing'], { timeoutMs: 50 });
        expect(result.state).toBe('fail');
        expect(result.evidence.selectorsTried).toEqual(['#missing']);
    });
});

describe('web-ai per-vendor capability arrays exported from provider modules', () => {
    it('chatgpt exports chatGptCapabilities with hyphenated IDs', async () => {
        const mod = await import('../../web-ai/chatgpt.mjs');
        const ids = mod.chatGptCapabilities.map(c => c.capabilityId);
        expect(ids).toEqual([
            'chatgpt-active-tab-verification',
            'chatgpt-composer-visible',
            'chatgpt-model-alias-selectable',
            'chatgpt-upload-surface-visible',
            'chatgpt-copy-button-present',
            'chatgpt-response-streaming',
        ]);
    });

    it('gemini exports geminiCapabilities with hyphenated IDs', async () => {
        const mod = await import('../../web-ai/gemini-live.mjs');
        const ids = mod.geminiCapabilities.map(c => c.capabilityId);
        expect(ids).toEqual([
            'gemini-active-tab-verification',
            'gemini-composer-visible',
            'gemini-model-alias-selectable',
            'gemini-upload-surface-visible',
            'gemini-copy-button-present',
            'gemini-response-streaming',
        ]);
    });

    it('grok exports grokCapabilities with hyphenated IDs', async () => {
        const mod = await import('../../web-ai/grok-live.mjs');
        const ids = mod.grokCapabilities.map(c => c.capabilityId);
        expect(ids).toEqual([
            'grok-active-tab-verification',
            'grok-composer-visible',
            'grok-model-alias-selectable',
            'grok-upload-surface-visible',
            'grok-copy-button-present',
            'grok-response-streaming',
        ]);
    });
});

describe('web-ai model capability probes', () => {
    it('chatGptModelCapabilityProbe returns unknown when no model given', async () => {
        const { chatGptModelCapabilityProbe } = await import('../../web-ai/chatgpt-model.mjs');
        const result = await chatGptModelCapabilityProbe(fakePage('https://chatgpt.com/'), undefined);
        expect(result.state).toBe('unknown');
        expect(result.next).toBe('send');
    });

    it('chatGptModelCapabilityProbe returns fail for unsupported alias', async () => {
        const { chatGptModelCapabilityProbe } = await import('../../web-ai/chatgpt-model.mjs');
        const result = await chatGptModelCapabilityProbe(fakePage('https://chatgpt.com/'), 'nonexistent-model');
        expect(result.state).toBe('fail');
        expect(result.next).toBe('model-fallback');
    });

    it('geminiModelCapabilityProbe returns unknown for deepthink', async () => {
        const { geminiModelCapabilityProbe } = await import('../../web-ai/gemini-model.mjs');
        const result = await geminiModelCapabilityProbe(fakePage('https://gemini.google.com/'), 'deepthink');
        expect(result.state).toBe('unknown');
        expect(result.evidence.tool).toBe('deepthink');
    });

    it('geminiModelCapabilityProbe returns fail for unsupported alias', async () => {
        const { geminiModelCapabilityProbe } = await import('../../web-ai/gemini-model.mjs');
        const result = await geminiModelCapabilityProbe(fakePage('https://gemini.google.com/'), 'nonexistent');
        expect(result.state).toBe('fail');
    });

    it('grokModelCapabilityProbe returns unknown when no model given', async () => {
        const { grokModelCapabilityProbe } = await import('../../web-ai/grok-model.mjs');
        const result = await grokModelCapabilityProbe(fakePage('https://grok.com/'), undefined);
        expect(result.state).toBe('unknown');
    });

    it('grokModelCapabilityProbe returns fail for unsupported alias', async () => {
        const { grokModelCapabilityProbe } = await import('../../web-ai/grok-model.mjs');
        const result = await grokModelCapabilityProbe(fakePage('https://grok.com/'), 'nonexistent');
        expect(result.state).toBe('fail');
    });
});

describe('web-ai cli --probe flag wiring', () => {
    const cliSrc = require('node:fs').readFileSync(require('node:path').join(process.cwd(), 'web-ai/cli.mjs'), 'utf8');
    it('declares --probe option and pipes it into input.probe', () => {
        expect(cliSrc).toMatch(/probe: \{ type: 'string' \}/);
        expect(cliSrc).toMatch(/probe: values\.probe/);
    });
});
