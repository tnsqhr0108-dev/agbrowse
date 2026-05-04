import { describe, expect, it } from 'vitest';
import { redactTraceValue } from '../../web-ai/trace/redact.mjs';

describe('web-ai trace redaction', () => {
    it('removes emails, tokens, cookies, storage values, prompt and answer text', () => {
        const redacted = redactTraceValue({
            prompt: 'secret prompt',
            answerText: 'secret answer',
            nested: {
                message: 'email alice@example.com token sk_1234567890abcdef and sk-1234567890abcdef',
                cookie: 'session=abc',
                localStorage: { token: 'abc' },
                evidence: {
                    pageText: 'secret page',
                    pageHtml: '<html>secret</html>',
                    providerOutput: 'secret output',
                    sourceContext: 'secret source',
                },
            },
        });
        expect(redacted.prompt).toBe('[redacted]');
        expect(redacted.answerText).toBe('[redacted]');
        expect(redacted.nested.message).toContain('[redacted-email]');
        expect(redacted.nested.message).toContain('[redacted-key]');
        expect(redacted.nested.message).not.toContain('sk-1234567890abcdef');
        expect(redacted.nested.cookie).toBe('[redacted]');
        expect(redacted.nested.localStorage).toBe('[redacted]');
        expect(redacted.nested.evidence.pageText).toBe('[redacted]');
        expect(redacted.nested.evidence.pageHtml).toBe('[redacted]');
        expect(redacted.nested.evidence.providerOutput).toBe('[redacted]');
        expect(redacted.nested.evidence.sourceContext).toBe('[redacted]');
    });
});
