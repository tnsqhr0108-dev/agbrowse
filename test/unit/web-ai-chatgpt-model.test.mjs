import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const modelSrc = readFileSync(join(process.cwd(), 'web-ai', 'chatgpt-model.mjs'), 'utf8');

describe('web-ai ChatGPT model selector policy', () => {
    it('supports the observed Heavy/Pro effort UI', () => {
        expect(modelSrc).toContain('model-switcher-gpt-5-5-pro-thinking-effort');
        expect(modelSrc).toContain('model-switcher-gpt-5-5-thinking-thinking-effort');
        expect(modelSrc).toContain('Extended Pro');
        expect(modelSrc).toContain('Heavy');
        expect(modelSrc).toContain('readActiveModelPill');
    });

    it('normalizes observed ChatGPT effort aliases', async () => {
        const {
            CHATGPT_MODEL_EFFORT_OPTIONS,
            isChatGptEffortSupported,
            normalizeChatGptEffortChoice,
        } = await import('../../web-ai/chatgpt-model.mjs');

        expect(Object.keys(CHATGPT_MODEL_EFFORT_OPTIONS.pro.efforts)).toEqual(['standard', 'extended']);
        expect(Object.keys(CHATGPT_MODEL_EFFORT_OPTIONS.thinking.efforts)).toEqual(['light', 'standard', 'extended', 'heavy']);
        expect(normalizeChatGptEffortChoice('regular')).toBe('standard');
        expect(normalizeChatGptEffortChoice('high')).toBe('extended');
        expect(isChatGptEffortSupported('pro', 'standard')).toBe(true);
        expect(isChatGptEffortSupported('pro', 'heavy')).toBe(false);
        expect(isChatGptEffortSupported('thinking', 'heavy')).toBe(true);
    });

    it('wires ChatGPT effort options through the CLI surface', () => {
        const cliSrc = readFileSync(join(process.cwd(), 'web-ai', 'cli.mjs'), 'utf8');
        const chatgptSrc = readFileSync(join(process.cwd(), 'web-ai', 'chatgpt.mjs'), 'utf8');

        expect(cliSrc).toContain("effort: { type: 'string' }");
        expect(cliSrc).toContain("'reasoning-effort': { type: 'string' }");
        expect(cliSrc).toContain('reasoningEffort: values.effort');
        expect(chatgptSrc).toContain("selectChatGptModel(page, input.model, { effort: input.reasoningEffort })");
    });
});
