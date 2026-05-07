import { describe, expect, it } from 'vitest';
import { validateWebAiToolInput, isKnownWebAiTool } from '../../web-ai/tool-schema.mjs';

describe('web-ai tool input validation', () => {
    it('accepts valid web_ai_submit_prompt input', () => {
        expect(validateWebAiToolInput('web_ai_submit_prompt', {
            provider: 'chatgpt',
            prompt: 'hello',
        })).toBe(true);
    });

    it('rejects web_ai_submit_prompt without required prompt', () => {
        expect(() => validateWebAiToolInput('web_ai_submit_prompt', {
            provider: 'chatgpt',
        })).toThrow(/prompt.*required/i);
    });

    it('rejects invalid provider enum', () => {
        expect(() => validateWebAiToolInput('web_ai_submit_prompt', {
            provider: 'bard',
            prompt: 'hello',
        })).toThrow(/not in enum/i);
    });

    it('accepts valid web_ai_copy_markdown input', () => {
        expect(validateWebAiToolInput('web_ai_copy_markdown', {
            provider: 'grok',
        })).toBe(true);
    });

    it('accepts web_ai tools with extra fields like policy (additionalProperties relaxed)', () => {
        expect(validateWebAiToolInput('web_ai_submit_prompt', {
            provider: 'chatgpt',
            prompt: 'hello',
            policy: { version: 1 },
        })).toBe(true);
    });

    it('throws for unknown tool name', () => {
        expect(() => validateWebAiToolInput('fake_tool', {})).toThrow('unknown web-ai tool');
    });

    it('isKnownWebAiTool correctly identifies web-ai tools', () => {
        expect(isKnownWebAiTool('web_ai_submit_prompt')).toBe(true);
        expect(isKnownWebAiTool('web_ai_copy_markdown')).toBe(true);
        expect(isKnownWebAiTool('browser_click_ref')).toBe(false);
    });
});
