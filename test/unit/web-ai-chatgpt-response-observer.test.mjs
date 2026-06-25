import { describe, expect, it } from 'vitest';
import {
    buildResponseObserverExpression,
    observeAssistantResponse,
    recoverAssistantResponse,
} from '../../web-ai/chatgpt-response-observer.mjs';

describe('buildResponseObserverExpression', () => {
    it('embeds clamped baseline / quiet / timeout literals', () => {
        const expr = buildResponseObserverExpression({ baselineAssistantCount: 2, quietMs: 800, timeoutMs: 5_000 });
        expect(expr).toContain('const MIN = 2;');
        expect(expr).toContain('const QUIET = 800;');
        expect(expr).toContain('const HARD = 5000;');
    });

    it('clamps invalid inputs to safe minimums', () => {
        const expr = buildResponseObserverExpression({ baselineAssistantCount: -3, quietMs: 1, timeoutMs: 1 });
        expect(expr).toContain('const MIN = 0;');
        expect(expr).toContain('const QUIET = 200;');
        expect(expr).toContain('const HARD = 1000;');
    });

    it('installs a MutationObserver and resolves null on timeout (never rejects)', () => {
        const expr = buildResponseObserverExpression();
        expect(expr).toContain('new MutationObserver');
        expect(expr).toContain('setTimeout(() => finish(null), HARD)');
        expect(expr).toContain('new Promise((resolve)');
    });
});

describe('observeAssistantResponse', () => {
    it('returns the in-page settle result', async () => {
        const page = { evaluate: async () => ({ settled: true }) };
        expect(await observeAssistantResponse(page, { timeoutMs: 1_000 })).toEqual({ settled: true });
    });

    it('returns null when already aborted (no evaluate)', async () => {
        let evaluated = false;
        const page = { evaluate: async () => { evaluated = true; return { settled: true }; } };
        const ac = new AbortController();
        ac.abort();
        expect(await observeAssistantResponse(page, { signal: ac.signal })).toBeNull();
        expect(evaluated).toBe(false);
    });

    it('returns null when the page evaluate throws', async () => {
        const page = { evaluate: async () => { throw new Error('detached'); } };
        expect(await observeAssistantResponse(page)).toBeNull();
    });
});

describe('recoverAssistantResponse', () => {
    const pageWith = (texts) => ({ evaluate: async () => texts });

    it('returns the latest assistant turn when it passes isFinalAnswer', async () => {
        const r = await recoverAssistantResponse(pageWith(['old', 'the real final answer']), {
            isFinalAnswer: (t) => !/^answer now$/i.test(t),
        });
        expect(r).toEqual({ from: 'recovery', text: 'the real final answer', recovered: true });
    });

    it('rejects a placeholder latest turn', async () => {
        const r = await recoverAssistantResponse(pageWith(['Answer now']), {
            isFinalAnswer: (t) => !/^answer now$/i.test(t),
        });
        expect(r).toBeNull();
    });

    it('returns null when there are no assistant turns', async () => {
        expect(await recoverAssistantResponse(pageWith([]))).toBeNull();
    });

    it('returns the latest turn when no predicate is supplied', async () => {
        const r = await recoverAssistantResponse(pageWith(['x', 'y']));
        expect(r?.text).toBe('y');
    });

    it('returns null when the page evaluate throws', async () => {
        const r = await recoverAssistantResponse({ evaluate: async () => { throw new Error('boom'); } });
        expect(r).toBeNull();
    });
});
