import { describe, expect, it } from 'vitest';
import {
    ActionTranscript,
    BrowserCapabilityError,
    captureTextBaseline,
    findVisibleCandidate,
    waitForStableTextAfterBaseline,
} from '../../web-ai/browser-primitives.mjs';

describe('browser primitives', () => {
    it('findVisibleCandidate prefers visible candidate over first hidden match', async () => {
        const page = fakePage({
            '.candidate': [
                fakeLocator({ text: 'hidden', visible: false }),
                fakeLocator({ text: 'visible', visible: true }),
            ],
        });
        const result = await findVisibleCandidate(page, ['.candidate']);
        expect(result.index).toBe(1);
        await expect(result.locator.innerText()).resolves.toBe('visible');
    });

    it('findVisibleCandidate only falls back to first candidate when explicitly allowed', async () => {
        const page = fakePage({ '.candidate': [fakeLocator({ text: 'hidden', visible: false })] });
        await expect(findVisibleCandidate(page, ['.candidate'])).resolves.toBeNull();
        const fallback = await findVisibleCandidate(page, ['.candidate'], { allowFirstCandidateFallback: true });
        expect(fallback.index).toBe(0);
        expect(fallback.visible).toBe(false);
    });

    it('ActionTranscript and BrowserCapabilityError expose portable action metadata', () => {
        const transcript = new ActionTranscript();
        transcript.warn('slow');
        transcript.fallback('copy');
        expect(transcript.toJSON()).toEqual({ warnings: ['slow'], usedFallbacks: ['copy'] });
        const err = new BrowserCapabilityError('blocked', { capabilityId: 'x', stage: 'preflight' });
        expect(err.capabilityId).toBe('x');
        expect(err.stage).toBe('preflight');
    });

    it('captureTextBaseline and waitForStableTextAfterBaseline detect new text', async () => {
        const locators = [fakeLocator({ text: 'old', visible: true })];
        const page = fakePage({ '.message': locators });
        const baseline = await captureTextBaseline(page, ['.message']);
        locators.push(fakeLocator({ text: 'new answer', visible: true }));
        const result = await waitForStableTextAfterBaseline(page, ['.message'], baseline, {
            timeoutMs: 200,
            stableWindowMs: 20,
            pollIntervalMs: 10,
        });
        expect(result.ok).toBe(true);
        expect(result.latestText).toBe('new answer');
    });
});

function fakePage(map) {
    return {
        locator(selector) {
            const locators = map[selector] || [];
            return {
                count: async () => locators.length,
                nth: (index) => locators[index],
                first: () => locators[0],
                all: async () => locators,
            };
        },
        waitForTimeout: async () => undefined,
    };
}

function fakeLocator(input) {
    return {
        waitFor: async () => {
            if (!input.visible) throw new Error('hidden');
        },
        boundingBox: async () => input.visible ? { width: 10, height: 10 } : null,
        evaluate: async () => input.visible,
        innerText: async () => input.text,
    };
}
