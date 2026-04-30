import { describe, expect, it } from 'vitest';
import { DEFAULT_RESEARCH_INSTRUCTIONS, normalizeEnvelope, renderQuestionEnvelope, renderQuestionEnvelopeWithContext } from '../../web-ai/question.mjs';
import { ATTACHMENT_POLICY, WEB_AI_STATUS, WEB_AI_VENDOR } from '../../web-ai/types.mjs';

describe('web-ai question envelope', () => {
    it('renders structured sections', () => {
        const rendered = renderQuestionEnvelope({
            vendor: 'chatgpt',
            project: 'cli-jaw',
            goal: 'review PRD32',
            context: '30_browser standalone first',
            prompt: 'What are the blockers?',
            output: 'blockers/tests',
            constraints: 'inline only',
        });

        expect(rendered.composerText).toContain('[USER]');
        expect(rendered.composerText).toContain('## Project\ncli-jaw');
        expect(rendered.composerText).toContain('## Question\nWhat are the blockers?');
        expect(rendered.estimatedChars).toBe(rendered.composerText.length);
    });

    it('appends a default web-search and source-citation instruction block to every render path', () => {
        for (const vendor of ['chatgpt', 'gemini', 'grok']) {
            const rendered = renderQuestionEnvelope({ vendor, prompt: 'What is the latest stable Node version?' });
            expect(rendered.composerText).toContain('[INSTRUCTIONS]');
            expect(rendered.composerText).toContain(DEFAULT_RESEARCH_INSTRUCTIONS);
        }
        const renderedWithContext = renderQuestionEnvelopeWithContext(
            { vendor: 'chatgpt', prompt: 'review' },
            '[CONTEXT PACKAGE]\nfile blob\n[USER REQUEST]\nreview',
        );
        expect(renderedWithContext.composerText).toContain('[INSTRUCTIONS]');
        expect(renderedWithContext.composerText).toContain(DEFAULT_RESEARCH_INSTRUCTIONS);
    });

    it('rejects empty prompts', () => {
        expect(() => normalizeEnvelope({ vendor: 'chatgpt', prompt: '   ' })).toThrow(/prompt required/);
    });

    it('rejects over-budget inline prompts', () => {
        expect(() => renderQuestionEnvelope({ prompt: 'x'.repeat(50001) })).toThrow(/inline prompt too large/);
    });

    it('rejects future-scope attachments', () => {
        expect(() => normalizeEnvelope({ prompt: 'hello', attachmentPolicy: 'future-upload-disabled' })).toThrow(/unsupported attachment policy/);
    });

    it('exports standalone type constants', () => {
        expect(WEB_AI_VENDOR.CHATGPT).toBe('chatgpt');
        expect(WEB_AI_VENDOR.GROK).toBe('grok');
        expect(WEB_AI_STATUS.COMPLETE).toBe('complete');
        expect(ATTACHMENT_POLICY.INLINE_ONLY).toBe('inline-only');
    });

    it('supports Grok envelopes', () => {
        expect(normalizeEnvelope({ vendor: 'grok', prompt: 'hello' }).vendor).toBe('grok');
    });

    it('throws WebAiError with provider.runtime-disabled for unsupported vendor', () => {
        let captured;
        try { normalizeEnvelope({ vendor: 'claude', prompt: 'x' }); } catch (e) { captured = e; }
        expect(captured?.errorCode).toBe('provider.runtime-disabled');
        expect(captured?.stage).toBe('provider-runtime-gate');
        expect(captured?.retryHint).toBe('enable-or-skip');
    });

    it('throws WebAiError with context.over-budget for empty prompt and oversize prompt', () => {
        let emptyErr;
        try { normalizeEnvelope({ vendor: 'chatgpt', prompt: '   ' }); } catch (e) { emptyErr = e; }
        expect(emptyErr?.errorCode).toBe('context.over-budget');
        expect(emptyErr?.stage).toBe('context-preflight');

        let bigErr;
        try { renderQuestionEnvelope({ prompt: 'x'.repeat(50001) }); } catch (e) { bigErr = e; }
        expect(bigErr?.errorCode).toBe('context.over-budget');
        expect(bigErr?.evidence?.length).toBeGreaterThan(50000);
    });

    it('throws WebAiError with provider.attachment-preflight for unknown attachmentPolicy', () => {
        let captured;
        try { normalizeEnvelope({ vendor: 'chatgpt', prompt: 'x', attachmentPolicy: 'future-disabled' }); } catch (e) { captured = e; }
        expect(captured?.errorCode).toBe('provider.attachment-preflight');
        expect(captured?.stage).toBe('attachment-preflight');
    });
});
