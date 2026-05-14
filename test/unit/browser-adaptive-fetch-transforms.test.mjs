import { describe, expect, it } from 'vitest';
import { runAdaptiveFetch } from '../../skills/browser/adaptive-fetch/index.mjs';
import { extractMetadataFromHtml } from '../../skills/browser/adaptive-fetch/metadata.mjs';
import { dedupeCandidateUrls, htmlToReadableText } from '../../skills/browser/adaptive-fetch/transforms.mjs';

describe('adaptive fetch transforms and metadata', () => {
    it('extracts readable text without script/style noise', () => {
        const text = htmlToReadableText('<style>.x{}</style><script>alert(1)</script><article><h1>Hello</h1><p>World&nbsp;now</p></article>');
        expect(text).toContain('Hello');
        expect(text).toContain('World now');
        expect(text).not.toContain('alert');
    });

    it('extracts OGP, canonical, and JSON-LD metadata', () => {
        const meta = extractMetadataFromHtml(`
            <title>Fallback title</title>
            <link rel="canonical" href="/article">
            <meta property="og:title" content="OG title">
            <meta name="description" content="Summary">
            <script type="application/ld+json">{"@type":"Article","headline":"JSON title"}</script>
        `, 'https://example.com/base');
        expect(meta.title).toBe('OG title');
        expect(meta.metadata.canonicalUrl).toBe('https://example.com/article');
        expect(meta.metadata.jsonLd[0].headline).toBe('JSON title');
    });

    it('deduplicates valid candidate URLs and drops invalid values', () => {
        expect(dedupeCandidateUrls(['https://example.com/a', 'https://example.com/a', 'not-url'])).toEqual(['https://example.com/a']);
    });

    it('runAdaptiveFetch returns a strong fetch result with injected fetch implementation', async () => {
        const result = await runAdaptiveFetch({
            url: 'https://example.com/article',
            publicEndpoints: false,
            trace: true,
        }, {
            fetch: async () => new Response('<article><h1>Title</h1><p>Readable body '.repeat(120) + '</p></article>', {
                status: 200,
                headers: { 'content-type': 'text/html' },
            }),
        });
        expect(result.ok).toBe(true);
        expect(result.verdict).toBe('strong_ok');
        expect(result.source).toBe('fetch');
        expect(result.content).toContain('Readable body');
        expect(result.attempts.some(a => a.source === 'fetch')).toBe(true);
    });
});

