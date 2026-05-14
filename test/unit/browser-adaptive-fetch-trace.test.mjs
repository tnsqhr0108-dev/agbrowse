import { describe, expect, it } from 'vitest';
import { appendAttempt, createAttemptTrace, summarizeAttempts } from '../../skills/browser/adaptive-fetch/trace.mjs';

describe('adaptive fetch trace', () => {
    it('redacts sensitive URL and header material in attempts', () => {
        const trace = createAttemptTrace({
            url: 'https://example.com/?token=secret&client_secret=hidden',
            browserMode: 'auto',
            browserSession: 'none',
        });
        appendAttempt(trace, {
            source: 'fetch',
            verdict: 'blocked',
            url: 'https://example.com/?api_key=abc&X-Amz-Signature=sig&AWSAccessKeyId=key',
            requestHeaders: {
                authorization: 'Bearer abc',
                accept: 'text/html',
            },
        });
        expect(trace.url).toContain('token=[redacted]');
        expect(trace.url).toContain('client_secret=[redacted]');
        expect(trace.attempts[0].url).toContain('api_key=[redacted]');
        expect(trace.attempts[0].url).toContain('X-Amz-Signature=[redacted]');
        expect(trace.attempts[0].url).toContain('AWSAccessKeyId=[redacted]');
        expect(trace.attempts[0].requestHeaders.authorization).toBe('[redacted]');
        expect(trace.attempts[0].requestHeaders.accept).toBe('text/html');
    });

    it('summarizes recorded attempts for human output', () => {
        const trace = createAttemptTrace({ url: 'https://example.com/' });
        appendAttempt(trace, { source: 'validation', verdict: 'unsupported' });
        expect(summarizeAttempts(trace.attempts)).toContain('last source=validation');
    });
});
