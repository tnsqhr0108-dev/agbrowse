import { describe, expect, it } from 'vitest';
import {
    normalizeDeepResearchReportText,
    isIncompleteDeepResearchText,
    chooseDeepResearchReportRead,
} from '../../web-ai/chatgpt-deep-research-report.mjs';

const REAL_REPORT = [
    '# Market Analysis: Electric Vehicles 2026',
    '',
    'The global EV market grew 28% year-over-year, driven by falling battery',
    'costs and expanded charging infrastructure across North America and the EU.',
    'Key findings below summarize adoption, pricing, and policy trends with',
    'citations to primary sources and manufacturer disclosures.',
].join('\n');

describe('normalizeDeepResearchReportText', () => {
    it('normalizes CRLF, collapses blank lines, and trims', () => {
        expect(normalizeDeepResearchReportText('\r\n a \r\n\r\n\r\n b \r\n')).toBe('a \n\n b');
    });
    it('returns empty string for non-string input', () => {
        // @ts-expect-error intentional wrong type
        expect(normalizeDeepResearchReportText(null)).toBe('');
        // @ts-expect-error intentional wrong type
        expect(normalizeDeepResearchReportText(42)).toBe('');
    });
});

describe('isIncompleteDeepResearchText', () => {
    it('treats short text as incomplete', () => {
        expect(isIncompleteDeepResearchText('Researched 12 sources')).toBe(true);
        expect(isIncompleteDeepResearchText('')).toBe(true);
        expect(isIncompleteDeepResearchText('Done.')).toBe(true);
    });

    it('treats planning / progress / status leads as incomplete', () => {
        const padded = (lead) => `${lead}\n` + 'x'.repeat(200);
        expect(isIncompleteDeepResearchText(padded('Researching the web for relevant data'))).toBe(true);
        expect(isIncompleteDeepResearchText(padded('Thinking about how to approach this'))).toBe(true);
        expect(isIncompleteDeepResearchText(padded('Starting deep research now'))).toBe(true);
        expect(isIncompleteDeepResearchText(padded("I'll research the latest figures"))).toBe(true);
        expect(isIncompleteDeepResearchText(padded("Here's my research plan"))).toBe(true);
        expect(isIncompleteDeepResearchText(padded('Research plan'))).toBe(true);
    });

    it('treats a long-form report without a status lead as complete', () => {
        expect(isIncompleteDeepResearchText(REAL_REPORT)).toBe(false);
    });
});

describe('chooseDeepResearchReportRead', () => {
    it('prefers a completed target read over a completed frame read', () => {
        const chosen = chooseDeepResearchReportRead(
            { text: REAL_REPORT, sources: ['https://a'], from: 'target' },
            { text: REAL_REPORT + '\n\nframe copy', sources: [], from: 'frame' },
        );
        expect(chosen).not.toBeNull();
        expect(chosen.from).toBe('target');
        expect(chosen.completed).toBe(true);
        expect(chosen.sources).toEqual(['https://a']);
    });

    it('falls back to a completed frame when the target is missing or incomplete', () => {
        const chosen = chooseDeepResearchReportRead(
            { text: 'Researching...', from: 'target' },
            { text: REAL_REPORT, sources: ['https://b'], from: 'frame' },
        );
        expect(chosen.from).toBe('frame');
        expect(chosen.completed).toBe(true);
    });

    it('never treats planning/status text as completed', () => {
        const chosen = chooseDeepResearchReportRead(
            { text: 'Starting deep research now', from: 'target' },
            { text: 'Reading sources', from: 'frame' },
        );
        expect(chosen).not.toBeNull();
        expect(chosen.completed).toBe(false);
        // returns the longer of the two incomplete candidates
        expect(chosen.text).toBe('Starting deep research now');
    });

    it('returns null when both reads are empty', () => {
        expect(chooseDeepResearchReportRead({ text: '' }, { text: '   ' })).toBeNull();
        expect(chooseDeepResearchReportRead(null, null)).toBeNull();
    });

    it('defaults the `from` label when not provided', () => {
        const chosen = chooseDeepResearchReportRead({ text: REAL_REPORT }, null);
        expect(chosen.from).toBe('target');
        expect(chosen.completed).toBe(true);
    });
});
