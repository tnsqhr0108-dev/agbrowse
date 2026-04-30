import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    CHATGPT_COPY_SELECTORS,
    GEMINI_COPY_SELECTORS,
    captureCopiedResponseText,
    preferCopiedText,
} from '../../web-ai/copy-markdown.mjs';

describe('web-ai copy markdown helper', () => {
    it('documents observed provider copy selectors', () => {
        expect(CHATGPT_COPY_SELECTORS.copyButtonSelectors).toContain('button[data-testid="copy-turn-action-button"]');
        expect(GEMINI_COPY_SELECTORS.turnSelectors).toContain('model-response');
        expect(GEMINI_COPY_SELECTORS.copyButtonSelectors).toContain('button[data-test-id="copy-button"]');
    });

    it('captures intercepted clipboard text without OS clipboard read', async () => {
        const page = { evaluate: async () => ({ ok: true, text: 'copied markdown' }) };
        await expect(captureCopiedResponseText(page, CHATGPT_COPY_SELECTORS)).resolves.toEqual({ ok: true, text: 'copied markdown' });

        const src = readFileSync(new URL('../../web-ai/copy-markdown.mjs', import.meta.url), 'utf8');
        expect(src).toContain('writeText');
        expect(src).toContain("Object.defineProperty(clipboard, 'write'");
        expect(src).not.toMatch(/readText\s*\(/);
    });

    it('rejects copied text that is probably truncated', () => {
        expect(preferCopiedText('a'.repeat(200), { ok: true, text: 'short' })).toBeUndefined();
        expect(preferCopiedText('dom answer', { ok: true, text: 'copied answer' })).toBe('copied answer');
    });
});
