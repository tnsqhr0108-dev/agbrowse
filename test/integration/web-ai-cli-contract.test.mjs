import { describe, expect, it } from 'vitest';
import { execBrowser } from '../helpers/exec-browser.mjs';

describe('web-ai CLI contract', () => {
    it('shows detailed web-ai help without requiring a prompt', async () => {
        const result = await execBrowser(['web-ai', '--help']);
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stdout).toContain('Provider options:');
        expect(result.stdout).toContain('--context-from-files');
        expect(result.stdout).toContain('agbrowse web-ai query --vendor grok');
    });

    it('supports render command without a running browser', async () => {
        const result = await execBrowser(['web-ai', 'render', '--vendor', 'chatgpt', '--prompt', 'hello']);
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('[USER]');
        expect(result.stdout).toContain('## Question');
    });

    it('supports Gemini render without a running browser', async () => {
        const result = await execBrowser(['web-ai', 'render', '--vendor', 'gemini', '--prompt', 'hello']);
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('[USER]');
        expect(result.stdout).toContain('## Question');
    });

    it('supports Grok render without a running browser', async () => {
        const result = await execBrowser(['web-ai', 'render', '--vendor', 'grok', '--prompt', 'hello']);
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('[USER]');
        expect(result.stdout).toContain('## Question');
    });

    it('rejects unknown vendor', async () => {
        const result = await execBrowser(['web-ai', 'render', '--vendor', 'claude', '--prompt', 'hello']);
        expect(result.code).not.toBe(0);
        expect(result.stderr).toContain('unsupported vendor');
    });

    it('requires inline-only for send/query', async () => {
        const result = await execBrowser(['web-ai', 'send', '--vendor', 'chatgpt', '--prompt', 'hello']);
        expect(result.code).not.toBe(0);
        expect(result.stderr).toContain('--inline-only');
    });

    it('allows send/query preflight when context packaging will upload an attachment', async () => {
        const result = await execBrowser([
            'web-ai',
            'query',
            '--vendor',
            'chatgpt',
            '--prompt',
            'hello',
            '--context-from-files',
            'web-ai/question.mjs',
            '--model',
            'deepthink',
        ]);
        expect(result.code).not.toBe(0);
        expect(result.stderr).toContain('unsupported ChatGPT model selection');
        expect(result.stderr).not.toContain('--inline-only');
    });

    it('rejects unsupported ChatGPT model choices', async () => {
        const result = await execBrowser(['web-ai', 'query', '--vendor', 'chatgpt', '--inline-only', '--prompt', 'hello', '--model', 'deepthink']);
        expect(result.code).not.toBe(0);
        expect(result.stderr).toContain('unsupported ChatGPT model selection');
    });

    it('accepts observed Gemini and Grok model choices in CLI preflight', async () => {
        const gemini = await execBrowser(['web-ai', 'render', '--vendor', 'gemini', '--prompt', 'hello', '--model', 'thinking']);
        expect(gemini.stderr).not.toContain('unsupported gemini model selection');
        expect(gemini.code).toBe(0);

        const geminiDeepThink = await execBrowser(['web-ai', 'render', '--vendor', 'gemini', '--prompt', 'hello', '--model', 'deepthink']);
        expect(geminiDeepThink.stderr).not.toContain('unsupported gemini model selection');
        expect(geminiDeepThink.code).toBe(0);

        const grok = await execBrowser(['web-ai', 'render', '--vendor', 'grok', '--prompt', 'hello', '--model', 'expert']);
        expect(grok.stderr).not.toContain('unsupported grok model selection');
        expect(grok.code).toBe(0);
    });

    it('parses copy markdown fallback flag for query preflight', async () => {
        const result = await execBrowser([
            'web-ai',
            'query',
            '--vendor',
            'chatgpt',
            '--inline-only',
            '--prompt',
            'hello',
            '--allow-copy-markdown-fallback',
            '--model',
            'deepthink',
        ]);
        expect(result.code).not.toBe(0);
        expect(result.stderr).toContain('unsupported ChatGPT model selection');
        expect(result.stderr).not.toContain('Unknown option');
    });

    it('supports context dry-run without a running browser', async () => {
        const result = await execBrowser([
            'web-ai',
            'context-dry-run',
            '--vendor',
            'chatgpt',
            '--prompt',
            'review context',
            '--context-from-files',
            'web-ai/question.mjs',
            '--json',
        ]);
        expect(result.code).toBe(0);
        const parsed = JSON.parse(result.stdout);
        expect(parsed.status).toBe('dry-run');
        expect(parsed.transport).toBe('upload');
        expect(parsed.attachments).toHaveLength(1);
        expect(parsed.files[0].relativePath).toBe('web-ai/question.mjs');
        expect(parsed.composerText).toBeUndefined();
    });

    it('supports context render with full composer text', async () => {
        const result = await execBrowser([
            'web-ai',
            'context-render',
            '--vendor',
            'chatgpt',
            '--prompt',
            'review context',
            '--context-from-files',
            'web-ai/question.mjs',
        ]);
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('[CONTEXT PACKAGE]');
        expect(result.stdout).toContain('### File: web-ai/question.mjs');
        expect(result.stdout).not.toContain('[USER REQUEST]');
    });
});
