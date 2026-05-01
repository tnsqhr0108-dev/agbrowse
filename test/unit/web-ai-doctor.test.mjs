import { describe, expect, it } from 'vitest';
import { featureDefinitionsForVendor, diagnoseFeature, runDoctor } from '../../web-ai/doctor.mjs';

function fakePageForDoctor(locatorMap = {}) {
    return {
        url: () => 'https://chatgpt.com/c/test-123',
        evaluate: async () => '<div>fake</div>',
        locator: (selector) => ({
            count: async () => locatorMap[selector]?.count ?? 0,
            first: () => ({
                isVisible: async () => locatorMap[selector]?.visible ?? false,
            }),
        }),
    };
}

describe('web-ai doctor', () => {
    it('featureDefinitionsForVendor returns features for each vendor', () => {
        expect(featureDefinitionsForVendor('chatgpt').length).toBe(6);
        expect(featureDefinitionsForVendor('gemini').length).toBe(6);
        expect(featureDefinitionsForVendor('grok').length).toBe(6);
        expect(featureDefinitionsForVendor('unknown').length).toBe(0);
    });

    it('featureDefinitionsForVendor includes all expected features', () => {
        const names = featureDefinitionsForVendor('chatgpt').map(f => f.feature);
        expect(names).toEqual(['composer', 'model-picker', 'upload', 'response-feed', 'copy-fallback', 'streaming-indicator']);
    });

    it('diagnoseFeature returns ok when selector is visible', async () => {
        const page = fakePageForDoctor({
            'div[contenteditable="true"]': { count: 1, visible: true },
        });
        const feature = { feature: 'composer', selectors: ['#missing', 'div[contenteditable="true"]'] };
        const result = await diagnoseFeature(page, feature);
        expect(result.feature).toBe('composer');
        expect(result.state).toBe('ok');
        expect(result.selectorMatches.length).toBeGreaterThan(0);
        expect(result.domHash).toMatch(/^sha1:/);
    });

    it('diagnoseFeature returns warn when matched but not visible', async () => {
        const page = fakePageForDoctor({
            'button.copy': { count: 1, visible: false },
        });
        const feature = { feature: 'copy', selectors: ['button.copy'] };
        const result = await diagnoseFeature(page, feature);
        expect(result.state).toBe('warn');
    });

    it('diagnoseFeature returns fail when nothing matches', async () => {
        const page = fakePageForDoctor({});
        const feature = { feature: 'upload', selectors: ['button.upload'] };
        const result = await diagnoseFeature(page, feature);
        expect(result.state).toBe('fail');
        expect(result.selectorMatches).toEqual([]);
    });

    it('runDoctor produces a complete report', async () => {
        const page = fakePageForDoctor({
            'div[contenteditable="true"]': { count: 1, visible: true },
        });
        const deps = { getPage: async () => page };
        const report = await runDoctor(deps, { vendor: 'chatgpt' });

        expect(report.vendor).toBe('chatgpt');
        expect(report.url).toBe('https://chatgpt.com/c/test-123');
        expect(report.capturedAt).toBeTruthy();
        expect(report.features.length).toBe(6);
        expect(report.lastSession === null || typeof report.lastSession === 'object').toBe(true);
        expect(Array.isArray(report.warnings)).toBe(true);
    });

    it('runDoctor report is parseable JSON under 4KB by default', async () => {
        const page = fakePageForDoctor({});
        const deps = { getPage: async () => page };
        const report = await runDoctor(deps, { vendor: 'chatgpt' });
        const json = JSON.stringify(report);
        expect(json.length).toBeLessThan(4096);
        expect(JSON.parse(json)).toBeTruthy();
    });

    it('each feature has required keys', async () => {
        const page = fakePageForDoctor({});
        const deps = { getPage: async () => page };
        const report = await runDoctor(deps, { vendor: 'gemini' });
        for (const f of report.features) {
            expect(f).toHaveProperty('feature');
            expect(f).toHaveProperty('selectorsTried');
            expect(f).toHaveProperty('selectorMatches');
            expect(f).toHaveProperty('state');
            expect(f).toHaveProperty('domHash');
        }
    });
});
