import { describe, expect, it } from 'vitest';
import {
    fromBrowserResult,
    fromFetchResult,
    fromMetadataResult,
    fromNetworkCandidate,
    fromPublicEndpointResult,
    normalizeReaderCandidates,
} from '../../skills/browser/adaptive-fetch/reader-adapters.mjs';

describe('adaptive fetch reader adapters', () => {
    it('normalizes fetch HTML into a reader candidate with metadata evidence', () => {
        const candidate = fromFetchResult({
            ok: true,
            status: 200,
            finalUrl: 'https://example.com/a',
            contentType: 'text/html',
            text: '<title>Hello</title><meta name="description" content="Desc"><article>Readable body</article>',
            evidence: ['http-200'],
        }, { source: 'fetch', label: 'direct-fetch' });
        expect(candidate.source).toBe('fetch');
        expect(candidate.label).toBe('direct-fetch');
        expect(candidate.title).toBe('Hello');
        expect(candidate.text).toContain('Readable body');
        expect(candidate.evidence).toContain('description');
    });

    it('normalizes all planned candidate families into one shape', () => {
        const candidates = normalizeReaderCandidates([
            fromMetadataResult({ finalUrl: 'https://example.com/meta', title: 'Meta', text: 'Metadata text' }),
            fromPublicEndpointResult({ finalUrl: 'https://api.example.com/a', text: 'Public JSON', evidence: ['api'] }),
            fromBrowserResult({ finalUrl: 'https://example.com/browser', text: 'Browser text' }),
            fromNetworkCandidate({ finalUrl: 'https://example.com/data.json', text: 'Network JSON' }),
        ]);
        expect(candidates.map(c => c.source)).toEqual(['metadata', 'public_endpoint', 'browser', 'network_api']);
        expect(candidates.every(c => typeof c.text === 'string')).toBe(true);
    });
});

