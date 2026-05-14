import { describe, expect, it } from 'vitest';
import { resolvePublicEndpointCandidates } from '../../skills/browser/adaptive-fetch/endpoint-resolvers.mjs';

describe('adaptive fetch endpoint resolvers', () => {
    it('resolves supported public endpoint shapes only', () => {
        expect(resolvePublicEndpointCandidates('https://github.com/org/repo/blob/main/README.md')[0]).toMatchObject({
            label: 'github-raw',
            url: 'https://raw.githubusercontent.com/org/repo/main/README.md',
        });
        expect(resolvePublicEndpointCandidates('https://news.ycombinator.com/item?id=123')[0].url).toContain('/item/123.json');
        expect(resolvePublicEndpointCandidates('https://en.wikipedia.org/wiki/Agentic_AI')[0].url).toContain('/api/rest_v1/page/summary/');
        expect(resolvePublicEndpointCandidates('https://example.com/article')).toEqual([]);
    });

    it('treats reddit json as a candidate without mutating already-json URLs', () => {
        expect(resolvePublicEndpointCandidates('https://www.reddit.com/r/test/comments/abc/title/')[0].url).toContain('.json');
        expect(resolvePublicEndpointCandidates('https://www.reddit.com/r/test/comments/abc/title/.json')).toEqual([]);
    });
});

