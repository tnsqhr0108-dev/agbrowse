import { describe, expect, it, vi } from 'vitest';
import {
    selectRunwayModel,
    setRunwayPrompt,
    setRunwayParams,
    uploadRunwayFile,
    ensureExploreMode,
    clickRunwayGenerate,
    setupRunwayGeneration,
} from '../../skills/browser/runway-generate.mjs';

function makePage(overrides = {}) {
    return {
        url: () => 'https://app.runwayml.com/ai-tools/generate?mode=tools',
        title: async () => 'Runway',
        goto: async () => undefined,
        waitForLoadState: async () => undefined,
        waitForSelector: async () => ({
            click: async () => undefined,
            setInputFiles: async () => undefined,
        }),
        waitForTimeout: async () => undefined,
        keyboard: {
            press: async () => undefined,
            type: async () => undefined,
        },
        evaluate: async () => ({}),
        ...overrides,
    };
}

describe('selectRunwayModel', () => {
    it('returns auto when model is auto', async () => {
        const page = makePage({
            evaluate: async () => 'Seedance 2.0',
        });
        const result = await selectRunwayModel(page, 'auto');
        expect(result.selected).toBe(true);
        expect(result.model).toBe('Seedance 2.0');
    });

    it('returns auto unchanged when model is empty', async () => {
        const page = makePage({
            evaluate: async () => null,
        });
        const result = await selectRunwayModel(page, '');
        expect(result.selected).toBe(true);
    });

    it('clicks dropdown and selects matching model', async () => {
        const clicks = [];
        const page = makePage({
            waitForSelector: async () => ({
                click: async () => clicks.push('dropdown'),
            }),
            waitForTimeout: async () => undefined,
            evaluate: async (fn, arg) => {
                if (typeof arg === 'string') return 'seedance-2';
                return null;
            },
            keyboard: { press: async () => undefined },
        });
        const result = await selectRunwayModel(page, 'seedance-2');
        expect(result.selected).toBe(true);
        expect(clicks).toContain('dropdown');
    });

    it('returns error when model not found', async () => {
        const page = makePage({
            waitForSelector: async () => ({
                click: async () => undefined,
            }),
            waitForTimeout: async () => undefined,
            evaluate: async (fn, arg) => {
                if (typeof arg === 'string') return null;
                return null;
            },
            keyboard: { press: async () => undefined },
        });
        const result = await selectRunwayModel(page, 'nonexistent-model');
        expect(result.selected).toBe(false);
        expect(result.error).toContain('not found');
    });
});

describe('setRunwayPrompt', () => {
    it('types prompt into editor', async () => {
        const typed = [];
        const page = makePage({
            waitForSelector: async () => ({
                click: async () => undefined,
            }),
            waitForTimeout: async () => undefined,
            keyboard: {
                press: async (key) => typed.push(key),
                type: async (text) => typed.push(text),
            },
        });
        const result = await setRunwayPrompt(page, 'A cat in space');
        expect(result.set).toBe(true);
        expect(typed).toContain('A cat in space');
    });

    it('returns error on failure', async () => {
        const page = makePage({
            waitForSelector: async () => { throw new Error('editor not found'); },
        });
        const result = await setRunwayPrompt(page, 'test');
        expect(result.set).toBe(false);
        expect(result.error).toContain('editor not found');
    });
});

describe('setRunwayParams', () => {
    it('clicks duration button when found', async () => {
        const page = makePage({
            evaluate: async () => true,
        });
        const result = await setRunwayParams(page, { duration: 10 });
        expect(result.set).toContain('duration=10');
    });

    it('reports skipped when button not found', async () => {
        const page = makePage({
            evaluate: async () => false,
        });
        const result = await setRunwayParams(page, { duration: 10 });
        expect(result.skipped.length).toBeGreaterThan(0);
    });

    it('handles multiple params', async () => {
        const page = makePage({
            evaluate: async () => true,
        });
        const result = await setRunwayParams(page, { duration: 5, ratio: '16:9', resolution: '1080p' });
        expect(result.set).toContain('duration=5');
        expect(result.set).toContain('ratio=16:9');
        expect(result.set).toContain('resolution=1080p');
    });
});

describe('ensureExploreMode', () => {
    it('reports already in explore mode', async () => {
        const page = makePage({
            evaluate: async () => ({ mode: 'Explore', found: true, switched: false }),
            waitForTimeout: async () => undefined,
        });
        const result = await ensureExploreMode(page);
        expect(result.mode).toBe('Explore');
        expect(result.switched).toBe(false);
    });

    it('switches to explore mode', async () => {
        const page = makePage({
            evaluate: async () => ({ mode: 'Explore', found: true, switched: true }),
            waitForTimeout: async () => undefined,
        });
        const result = await ensureExploreMode(page);
        expect(result.mode).toBe('Explore');
        expect(result.switched).toBe(true);
    });

    it('reports error when toggle not found', async () => {
        const page = makePage({
            evaluate: async () => ({ mode: 'unknown', found: false }),
        });
        const result = await ensureExploreMode(page);
        expect(result.error).toContain('not found');
    });
});

describe('clickRunwayGenerate', () => {
    it('clicks generate button', async () => {
        const page = makePage({
            waitForSelector: async () => ({}),
            evaluate: async () => true,
            waitForTimeout: async () => undefined,
        });
        const result = await clickRunwayGenerate(page);
        expect(result.clicked).toBe(true);
    });

    it('returns error when button not found', async () => {
        const page = makePage({
            waitForSelector: async () => ({}),
            evaluate: async () => false,
            waitForTimeout: async () => undefined,
        });
        const result = await clickRunwayGenerate(page);
        expect(result.clicked).toBe(false);
    });
});

describe('setupRunwayGeneration', () => {
    it('runs full setup pipeline and returns readyToGenerate', async () => {
        const page = makePage({
            url: () => 'https://app.runwayml.com/ai-tools/generate?mode=tools',
            goto: async () => undefined,
            waitForLoadState: async () => undefined,
            waitForSelector: async () => ({
                click: async () => undefined,
                setInputFiles: async () => undefined,
            }),
            waitForTimeout: async () => undefined,
            keyboard: {
                press: async () => undefined,
                type: async () => undefined,
            },
            evaluate: async (fn, arg) => {
                // Model select — return auto
                if (typeof arg === 'string') return null;
                // Ready check
                if (!arg) {
                    const fnStr = String(fn);
                    if (fnStr.includes('hasGenerateButton')) {
                        return { hasGenerateButton: true, generateEnabled: true };
                    }
                    // Explore mode
                    if (fnStr.includes('explore')) {
                        return { mode: 'Explore', found: true, switched: false };
                    }
                    return null;
                }
                return null;
            },
        });

        const result = await setupRunwayGeneration(page, {
            prompt: 'A cat walking through neon city',
            model: 'auto',
            explore: true,
        });

        expect(result.command).toBe('setup');
        expect(result.prompt).toBe('A cat walking through neon city');
        expect(result.explore).toBe(true);
        expect(result.safety.mutationAllowed).toBe(true);
        expect(result.safety.submitAllowed).toBe(false);
    });
});

describe('runRunwayGenerateCli safety', () => {
    it('rejects setup without --allow-mutation', async () => {
        const { runRunwayGenerateCli } = await import('../../skills/browser/runway-generate.mjs');
        await expect(
            runRunwayGenerateCli('setup', ['--prompt', 'test'], {})
        ).rejects.toThrow('--allow-mutation');
    });

    it('rejects generate without --allow-submit', async () => {
        const { runRunwayGenerateCli } = await import('../../skills/browser/runway-generate.mjs');
        await expect(
            runRunwayGenerateCli('generate', ['--prompt', 'test', '--allow-mutation'], {})
        ).rejects.toThrow('--allow-submit');
    });

    it('rejects generate without --prompt', async () => {
        const { runRunwayGenerateCli } = await import('../../skills/browser/runway-generate.mjs');
        await expect(
            runRunwayGenerateCli('generate', ['--allow-submit'], {})
        ).rejects.toThrow('--prompt');
    });
});
