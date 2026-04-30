import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    parseAriaYaml,
    parseCdpAxTree,
    annotateNodeOccurrences,
    filterRequests,
    dedupeRequests,
} from '../../skills/browser/browser-core.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '..', 'fixtures');

const ariaFixture = readFileSync(join(FIXTURES_DIR, 'aria-snapshot.yaml'), 'utf8');
const cdpFixture = JSON.parse(readFileSync(join(FIXTURES_DIR, 'cdp-ax-tree.json'), 'utf8'));

describe('browser-core', () => {
    it('parseAriaYaml parses roles, names, and depths', () => {
        const nodes = parseAriaYaml(ariaFixture);
        expect(nodes).toHaveLength(9);
        expect(nodes[0]).toEqual({ ref: 'e1', role: 'navigation', name: '', depth: 0 });
        expect(nodes[1]).toEqual({ ref: 'e2', role: 'link', name: 'Home', depth: 1 });
        expect(nodes[3]).toEqual({ ref: 'e4', role: 'textbox', name: 'Search', depth: 0 });
        expect(nodes[4]).toEqual({ ref: 'e5', role: 'button', name: 'Submit', depth: 0 });
        expect(nodes[5]).toEqual({ ref: 'e6', role: 'link', name: '', depth: 0 });
        expect(nodes[8]).toEqual({ ref: 'e9', role: 'button', name: 'Nested', depth: 2 });
    });

    it('parseAriaYaml returns empty array for blank input', () => {
        expect(parseAriaYaml('')).toEqual([]);
    });

    it('parseCdpAxTree skips ignored nodes and keeps values', () => {
        const nodes = parseCdpAxTree(cdpFixture);
        expect(nodes).toHaveLength(4);
        expect(nodes[0]).toEqual({ ref: 'e1', role: 'RootWebArea', name: 'Fixture Root', depth: 0 });
        expect(nodes[1]).toEqual({ ref: 'e2', role: 'textbox', name: 'Search', value: 'hello', depth: 1 });
        expect(nodes[2]).toEqual({ ref: 'e3', role: 'generic', name: '', depth: 1 });
        expect(nodes[3]).toEqual({ ref: 'e4', role: 'link', name: 'Nested Link', depth: 2 });
    });

    it('filterRequests filters by URL substring', () => {
        const requests = [
            { url: 'https://example.com/api' },
            { url: 'https://example.com/assets/app.js' },
        ];
        expect(filterRequests(requests, '/api')).toEqual([{ url: 'https://example.com/api' }]);
        expect(filterRequests(requests)).toEqual(requests);
    });

    it('dedupeRequests removes duplicate method/type/url/source combinations', () => {
        const requests = [
            { method: 'GET', type: 'document', url: 'https://example.com', source: 'performance' },
            { method: 'GET', type: 'document', url: 'https://example.com', source: 'performance' },
            { method: 'GET', type: 'document', url: 'https://example.com', source: 'live' },
        ];
        expect(dedupeRequests(requests)).toEqual([
            { method: 'GET', type: 'document', url: 'https://example.com', source: 'performance' },
            { method: 'GET', type: 'document', url: 'https://example.com', source: 'live' },
        ]);
    });

    it('annotateNodeOccurrences tracks duplicate role and name combinations', () => {
        const nodes = annotateNodeOccurrences([
            { ref: 'e1', role: 'button', name: 'Save' },
            { ref: 'e2', role: 'button', name: 'Save' },
            { ref: 'e3', role: 'button', name: '' },
            { ref: 'e4', role: 'button', name: '' },
        ]);
        expect(nodes.map(node => ({ ref: node.ref, occurrence: node.occurrence }))).toEqual([
            { ref: 'e1', occurrence: 0 },
            { ref: 'e2', occurrence: 1 },
            { ref: 'e3', occurrence: 0 },
            { ref: 'e4', occurrence: 1 },
        ]);
    });
});
