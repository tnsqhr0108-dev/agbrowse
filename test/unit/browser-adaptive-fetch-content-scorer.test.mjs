import { describe, expect, it } from 'vitest';
import { chooseBestReaderCandidate, scoreReaderCandidate, verdictFromScore } from '../../skills/browser/adaptive-fetch/content-scorer.mjs';

describe('adaptive fetch content scorer', () => {
    it('prefers dense article text over metadata-only shells', () => {
        const best = chooseBestReaderCandidate([
            {
                source: 'metadata',
                finalUrl: 'https://example.com/meta',
                title: 'Metadata only',
                text: 'Short summary',
                metadata: { description: 'Short summary' },
                rawTextLength: 5000,
                evidence: ['description'],
            },
            {
                source: 'fetch',
                finalUrl: 'https://example.com/article',
                title: 'Detailed article',
                text: 'Readable article body '.repeat(160),
                metadata: { jsonLd: [{ '@type': 'Article' }] },
                rawTextLength: 3600,
                evidence: ['json-ld'],
            },
        ]);
        expect(best.candidate.finalUrl).toBe('https://example.com/article');
        expect(best.verdict).toBe('strong_ok');
        expect(best.evidence).toContain('json-ld');
    });

    it('penalizes challenge shells even when they have status 200 text', () => {
        const scored = scoreReaderCandidate({
            source: 'fetch',
            finalUrl: 'https://example.com/',
            title: 'Checking your browser',
            text: 'Verify you are human captcha',
            rawTextLength: 30,
            evidence: [],
        });
        expect(scored.verdict).toBe('challenge');
        expect(scored.evidence).toContain('marker:challenge');
    });

    it('maps score thresholds to verdicts', () => {
        expect(verdictFromScore({ score: 80 })).toBe('strong_ok');
        expect(verdictFromScore({ score: 25 })).toBe('weak_ok');
        expect(verdictFromScore({ score: 5 })).toBe('blocked');
    });
});

