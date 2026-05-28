// @ts-check

import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { RUNWAY_SURFACES, buildRunwaySafety } from './runway-selectors.mjs';
import { inspectRunwayPage, normalizeRunwaySurface } from './runway.mjs';
import { waitForRunwayCompletion } from './runway-monitor.mjs';

const DEFAULT_WAIT_TIMEOUT_MS = 15000;
const DEFAULT_GENERATE_TIMEOUT_MS = 600000;
const DEFAULT_GENERATE_INTERVAL_MS = 5000;

/**
 * @param {unknown} value
 * @returns {string}
 */
function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {any} deps
 * @param {string} text
 */
function emit(deps, text) {
    if (typeof deps.write === 'function') deps.write(text);
    else console.log(text);
}

/**
 * Select a model from the base-model-select dropdown.
 * @param {any} page
 * @param {string} modelName
 * @returns {Promise<{ selected: boolean, model: string, error?: string }>}
 */
export async function selectRunwayModel(page, modelName) {
    if (!modelName || modelName === 'auto') {
        const current = await page.evaluate(() => {
            const el = document.querySelector('[data-testid="select-base-model"]');
            return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : null;
        });
        return { selected: true, model: current || 'auto (unchanged)' };
    }

    try {
        const selectEl = await page.waitForSelector('[data-testid="select-base-model"]', { timeout: 5000 });
        await selectEl.click();
        await page.waitForTimeout(500);

        const matched = await page.evaluate((/** @type {string} */ target) => {
            const lower = target.toLowerCase();
            const items = Array.from(document.querySelectorAll(
                '[role="option"], [role="menuitem"], [role="listbox"] button, [class*="dropdown"] button, [class*="model-list"] button, [class*="ModelList"] button'
            ));
            for (const item of items) {
                const text = String(item.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
                if (text.includes(lower) || lower.includes(text)) {
                    /** @type {HTMLElement} */ (item).click();
                    return text;
                }
            }
            return null;
        }, modelName);

        if (!matched) {
            await page.keyboard.press('Escape');
            return { selected: false, model: modelName, error: `Model "${modelName}" not found in dropdown` };
        }

        await page.waitForTimeout(300);
        return { selected: true, model: matched };
    } catch (error) {
        return { selected: false, model: modelName, error: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * Type prompt text into the prompt editor.
 * @param {any} page
 * @param {string} promptText
 * @returns {Promise<{ set: boolean, error?: string }>}
 */
export async function setRunwayPrompt(page, promptText) {
    try {
        const editor = await page.waitForSelector('div[aria-label="Prompt"]', { timeout: 5000 });
        await editor.click();
        await page.waitForTimeout(200);

        // Select all existing text and replace
        const isMac = process.platform === 'darwin';
        await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
        await page.waitForTimeout(100);

        if (promptText) {
            await page.keyboard.type(promptText, { delay: 10 });
        } else {
            await page.keyboard.press('Backspace');
        }

        await page.waitForTimeout(200);
        return { set: true };
    } catch (error) {
        return { set: false, error: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * Set generation parameters (duration, ratio, resolution, audio).
 * @param {any} page
 * @param {{ duration?: number, ratio?: string, resolution?: string, audio?: boolean }} params
 * @returns {Promise<{ set: string[], skipped: string[], errors: string[] }>}
 */
export async function setRunwayParams(page, params) {
    /** @type {string[]} */ const setParams = [];
    /** @type {string[]} */ const skipped = [];
    /** @type {string[]} */ const errors = [];

    if (params.duration != null) {
        try {
            const durationText = `${params.duration}s`;
            const found = await page.evaluate((/** @type {string} */ text) => {
                const buttons = Array.from(document.querySelectorAll('button'));
                for (const btn of buttons) {
                    const label = String(btn.textContent || '').trim();
                    if (label === text || label === String(text).replace('s', '')) {
                        /** @type {HTMLElement} */ (btn).click();
                        return true;
                    }
                }
                return false;
            }, durationText);
            if (found) setParams.push(`duration=${params.duration}`);
            else skipped.push(`duration=${params.duration} (button not found)`);
        } catch (e) {
            errors.push(`duration: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    if (params.ratio) {
        try {
            const found = await page.evaluate((/** @type {string} */ text) => {
                const buttons = Array.from(document.querySelectorAll('button'));
                for (const btn of buttons) {
                    const label = String(btn.textContent || '').trim();
                    if (label === text) {
                        /** @type {HTMLElement} */ (btn).click();
                        return true;
                    }
                }
                return false;
            }, params.ratio);
            if (found) setParams.push(`ratio=${params.ratio}`);
            else skipped.push(`ratio=${params.ratio} (button not found)`);
        } catch (e) {
            errors.push(`ratio: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    if (params.resolution) {
        try {
            const found = await page.evaluate((/** @type {string} */ text) => {
                const buttons = Array.from(document.querySelectorAll('button'));
                for (const btn of buttons) {
                    const label = String(btn.textContent || '').trim();
                    if (label === text) {
                        /** @type {HTMLElement} */ (btn).click();
                        return true;
                    }
                }
                return false;
            }, params.resolution);
            if (found) setParams.push(`resolution=${params.resolution}`);
            else skipped.push(`resolution=${params.resolution} (button not found)`);
        } catch (e) {
            errors.push(`resolution: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    if (params.audio != null) {
        try {
            const toggled = await page.evaluate((/** @type {boolean} */ desired) => {
                const toggle = document.querySelector(
                    '[data-testid="audio-toggle"], input[type="checkbox"][aria-label*="audio" i]'
                );
                if (!toggle) return false;
                const isChecked = /** @type {HTMLInputElement} */ (toggle).checked
                    || toggle.getAttribute('aria-checked') === 'true';
                if (isChecked !== desired) {
                    /** @type {HTMLElement} */ (toggle).click();
                }
                return true;
            }, params.audio);
            if (toggled) setParams.push(`audio=${params.audio}`);
            else skipped.push('audio (toggle not found)');
        } catch (e) {
            errors.push(`audio: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    return { set: setParams, skipped, errors };
}

/**
 * Upload a file via the browser file input.
 * @param {any} page
 * @param {string} filePath
 * @returns {Promise<{ uploaded: boolean, filename: string, error?: string }>}
 */
export async function uploadRunwayFile(page, filePath) {
    const absPath = resolve(filePath);
    const filename = absPath.split('/').pop() || filePath;

    if (!existsSync(absPath)) {
        return { uploaded: false, filename, error: `File not found: ${absPath}` };
    }

    try {
        const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 5000 });
        await fileInput.setInputFiles(absPath);
        await page.waitForTimeout(1000);
        return { uploaded: true, filename };
    } catch (error) {
        return { uploaded: false, filename, error: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * Ensure the UI is in Explore mode (Unlimited plan only).
 * @param {any} page
 * @returns {Promise<{ mode: string, switched: boolean, error?: string }>}
 */
export async function ensureExploreMode(page) {
    try {
        const result = await page.evaluate(() => {
            const normalize = (/** @type {unknown} */ v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
            const buttons = Array.from(document.querySelectorAll('button'));

            // Look for Explore/Credits toggle
            const exploreBtn = buttons.find(b => /^explore$/i.test(normalize(b.textContent)));
            const creditsBtn = buttons.find(b => /^credits$/i.test(normalize(b.textContent)));

            if (!exploreBtn) return { mode: 'unknown', found: false };

            const isExploreActive = exploreBtn.getAttribute('aria-pressed') === 'true'
                || exploreBtn.classList.contains('active')
                || exploreBtn.closest('[aria-pressed="true"]') !== null;

            if (isExploreActive) return { mode: 'Explore', found: true, switched: false };

            // Click Explore button to switch
            /** @type {HTMLElement} */ (exploreBtn).click();
            return { mode: 'Explore', found: true, switched: true };
        });

        if (!result.found) {
            return { mode: 'unknown', switched: false, error: 'Explore/Credits toggle not found. May not be an Unlimited plan.' };
        }

        if (result.switched) await page.waitForTimeout(500);
        return { mode: result.mode, switched: Boolean(result.switched) };
    } catch (error) {
        return { mode: 'unknown', switched: false, error: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * Click the Generate button. Level 2 only.
 * @param {any} page
 * @returns {Promise<{ clicked: boolean, error?: string }>}
 */
export async function clickRunwayGenerate(page) {
    try {
        const btn = await page.waitForSelector('button', { timeout: 5000 });
        const clicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const genBtn = buttons.find(b => /^generate$/i.test(String(b.textContent || '').trim()));
            if (!genBtn) return false;
            if (genBtn.disabled || genBtn.getAttribute('aria-disabled') === 'true') return false;
            /** @type {HTMLElement} */ (genBtn).click();
            return true;
        });
        if (!clicked) {
            return { clicked: false, error: 'Generate button not found or disabled' };
        }
        await page.waitForTimeout(1000);
        return { clicked: true };
    } catch (error) {
        return { clicked: false, error: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * Full setup: navigate → model → prompt → params → upload → explore mode.
 * Does NOT click Generate.
 * @param {any} page
 * @param {object} options
 * @param {string} [options.surface]
 * @param {string} [options.model]
 * @param {string} options.prompt
 * @param {string} [options.mode]
 * @param {number} [options.duration]
 * @param {string} [options.ratio]
 * @param {string} [options.resolution]
 * @param {boolean} [options.audio]
 * @param {string} [options.seedImage]
 * @param {string} [options.endImage]
 * @param {string[]} [options.referenceImages]
 * @param {boolean} [options.explore]
 * @param {number} [options.count]
 * @returns {Promise<object>}
 */
export async function setupRunwayGeneration(page, options) {
    const surface = options.surface || 'custom-tools';
    const target = RUNWAY_SURFACES[normalizeRunwaySurface(surface)];
    const errors = [];
    const steps = {};

    // Navigate if needed
    const currentUrl = typeof page.url === 'function' ? page.url() : '';
    if (!currentUrl.includes('runwayml.com') || !currentUrl.includes('mode=tools')) {
        if (target?.url) {
            await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: DEFAULT_WAIT_TIMEOUT_MS });
            try { await page.waitForLoadState('networkidle', { timeout: 5000 }); } catch { /* ok */ }
            steps.navigated = true;
        }
    }

    // Select model
    const modelResult = await selectRunwayModel(page, options.model || 'auto');
    steps.model = modelResult;
    if (!modelResult.selected) errors.push(`model: ${modelResult.error}`);

    // Explore mode
    if (options.explore) {
        const exploreResult = await ensureExploreMode(page);
        steps.explore = exploreResult;
        if (exploreResult.error) errors.push(`explore: ${exploreResult.error}`);
    }

    // Set prompt
    const promptResult = await setRunwayPrompt(page, options.prompt);
    steps.prompt = promptResult;
    if (!promptResult.set) errors.push(`prompt: ${promptResult.error}`);

    // Set params
    const paramResult = await setRunwayParams(page, {
        duration: options.duration,
        ratio: options.ratio,
        resolution: options.resolution,
        audio: options.audio,
    });
    steps.params = paramResult;
    if (paramResult.errors.length) errors.push(...paramResult.errors.map(e => `params: ${e}`));

    // Upload seed image
    if (options.seedImage) {
        const uploadResult = await uploadRunwayFile(page, options.seedImage);
        steps.seedImage = uploadResult;
        if (!uploadResult.uploaded) errors.push(`seedImage: ${uploadResult.error}`);
    }

    // Upload end image
    if (options.endImage) {
        const uploadResult = await uploadRunwayFile(page, options.endImage);
        steps.endImage = uploadResult;
        if (!uploadResult.uploaded) errors.push(`endImage: ${uploadResult.error}`);
    }

    // Upload reference images
    if (options.referenceImages?.length) {
        const refResults = [];
        for (const ref of options.referenceImages) {
            refResults.push(await uploadRunwayFile(page, ref));
        }
        steps.referenceImages = refResults;
        const failed = refResults.filter(r => !r.uploaded);
        if (failed.length) errors.push(`referenceImages: ${failed.length} upload(s) failed`);
    }

    const readyCheck = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const genBtn = btns.find(b => /^generate$/i.test(String(b.textContent || '').trim()));
        return {
            hasGenerateButton: Boolean(genBtn),
            generateEnabled: genBtn ? !genBtn.disabled && genBtn.getAttribute('aria-disabled') !== 'true' : false,
        };
    });

    return {
        ok: errors.length === 0,
        command: 'setup',
        model: modelResult.model,
        prompt: options.prompt,
        mode: options.mode || 'auto',
        explore: Boolean(options.explore),
        params: {
            duration: options.duration ?? null,
            ratio: options.ratio ?? null,
            resolution: options.resolution ?? null,
            audio: options.audio ?? null,
        },
        readyToGenerate: readyCheck.generateEnabled,
        safety: buildRunwaySafety(1),
        steps,
        errors,
    };
}

/**
 * Full generation: setup + Generate click + poll + optional download.
 * @param {any} page
 * @param {object} options
 * @param {string} options.prompt
 * @param {string} [options.model]
 * @param {string} [options.mode]
 * @param {string} [options.surface]
 * @param {number} [options.duration]
 * @param {string} [options.ratio]
 * @param {string} [options.resolution]
 * @param {boolean} [options.audio]
 * @param {string} [options.seedImage]
 * @param {string} [options.endImage]
 * @param {string[]} [options.referenceImages]
 * @param {boolean} [options.explore]
 * @param {string} [options.output]
 * @param {number} [options.timeout]
 * @param {number} [options.interval]
 * @param {number} [options.count]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @returns {Promise<object>}
 */
export async function executeRunwayGeneration(page, options) {
    // Get baseline output count before generation
    const baseline = await page.evaluate(() => {
        const outputPattern = /\.(?:mp4|png|jpe?g)\b|\/(?:result|task_artifact|video-previews)\b|\b(?:use frame|reuse settings|see full prompt)\b/i;
        const labels = Array.from(document.querySelectorAll('img[src], video[src], source[src], button, [aria-label]'))
            .map(el => String(el.getAttribute('src') || el.textContent || el.getAttribute('aria-label') || '').trim())
            .filter(l => outputPattern.test(l));
        return labels.length;
    });

    // Setup
    const setupResult = await setupRunwayGeneration(page, options);
    if (!setupResult.ok && setupResult.errors.length > 0) {
        return { ...setupResult, command: 'generate', status: 'setup_failed' };
    }

    // Click Generate
    const genResult = await clickRunwayGenerate(page);
    if (!genResult.clicked) {
        return {
            ok: false,
            command: 'generate',
            status: 'generate_failed',
            error: genResult.error,
            setup: setupResult,
            safety: buildRunwaySafety(2),
        };
    }

    // Poll for completion
    const pollResult = await waitForRunwayCompletion(page, {
        timeoutMs: options.timeout || DEFAULT_GENERATE_TIMEOUT_MS,
        intervalMs: options.interval || DEFAULT_GENERATE_INTERVAL_MS,
        afterCount: baseline,
        sleep: options.sleep,
    });

    // Extract output URL
    const outputUrl = await page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video[src], video source[src]'));
        const images = Array.from(document.querySelectorAll('img[src]'));
        const all = [...videos, ...images];
        for (const el of all) {
            const src = el.getAttribute('src') || '';
            if (/(?:result|task_artifact|video-previews|generation)/i.test(src)) return src;
        }
        const lastVideo = videos[videos.length - 1];
        if (lastVideo) return lastVideo.getAttribute('src');
        return null;
    });

    // Download if --output specified
    let downloadResult = null;
    if (options.output && outputUrl) {
        try {
            const { downloadRunwayOutput } = await import('./runway-download.mjs');
            downloadResult = await downloadRunwayOutput(outputUrl, options.output);
        } catch (e) {
            downloadResult = { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    return {
        ok: pollResult.terminal && pollResult.state === 'idle',
        command: 'generate',
        status: pollResult.state === 'idle' ? 'complete' : pollResult.state,
        model: setupResult.model,
        prompt: options.prompt,
        explore: Boolean(options.explore),
        outputUrl,
        outputFile: downloadResult?.ok ? options.output : null,
        download: downloadResult,
        poll: {
            polls: pollResult.polls,
            waitedMs: pollResult.waitedMs,
            timedOut: pollResult.timedOut,
        },
        safety: buildRunwaySafety(2),
    };
}

/**
 * @param {string} command — 'setup' or 'generate'
 * @param {string[]} args
 * @param {any} deps
 */
export async function runRunwayGenerateCli(command, args = [], deps = {}) {
    const { values } = parseArgs({
        args,
        options: {
            surface: { type: 'string', default: 'custom-tools' },
            model: { type: 'string', default: 'auto' },
            prompt: { type: 'string' },
            mode: { type: 'string', default: 'auto' },
            duration: { type: 'string' },
            ratio: { type: 'string' },
            resolution: { type: 'string' },
            audio: { type: 'string' },
            'seed-image': { type: 'string' },
            'end-image': { type: 'string' },
            'reference-images': { type: 'string', multiple: true },
            explore: { type: 'boolean', default: false },
            count: { type: 'string' },
            output: { type: 'string' },
            timeout: { type: 'string', default: String(DEFAULT_GENERATE_TIMEOUT_MS) },
            interval: { type: 'string', default: String(DEFAULT_GENERATE_INTERVAL_MS) },
            'allow-mutation': { type: 'boolean', default: false },
            'allow-submit': { type: 'boolean', default: false },
            json: { type: 'boolean', default: false },
        },
        strict: false,
    });

    if (!values.prompt) {
        throw new Error('--prompt is required for setup/generate commands');
    }

    // Safety enforcement
    if (command === 'setup' && !values['allow-mutation'] && !values['allow-submit']) {
        throw new Error('setup requires --allow-mutation or --allow-submit flag');
    }
    if (command === 'generate' && !values['allow-submit']) {
        throw new Error('generate requires --allow-submit flag');
    }

    const page = await deps.getPage();
    const options = {
        surface: String(values.surface || 'custom-tools'),
        model: String(values.model || 'auto'),
        prompt: String(values.prompt),
        mode: String(values.mode || 'auto'),
        duration: values.duration ? Number(values.duration) : undefined,
        ratio: values.ratio ? String(values.ratio) : undefined,
        resolution: values.resolution ? String(values.resolution) : undefined,
        audio: values.audio != null ? values.audio !== 'false' : undefined,
        seedImage: values['seed-image'] ? String(values['seed-image']) : undefined,
        endImage: values['end-image'] ? String(values['end-image']) : undefined,
        referenceImages: values['reference-images']?.map(String),
        explore: Boolean(values.explore),
        count: values.count ? Number(values.count) : undefined,
        output: values.output ? String(values.output) : undefined,
        timeout: Number(values.timeout || DEFAULT_GENERATE_TIMEOUT_MS),
        interval: Number(values.interval || DEFAULT_GENERATE_INTERVAL_MS),
        sleep: deps.sleep,
    };

    const result = command === 'generate'
        ? await executeRunwayGeneration(page, options)
        : await setupRunwayGeneration(page, options);

    emit(deps, values.json ? JSON.stringify(result, null, 2) : formatGenerateResult(result));
}

/**
 * @param {string[]} args
 * @param {any} deps
 */
export async function runRunwayUploadCli(args = [], deps = {}) {
    const { values } = parseArgs({
        args,
        options: {
            file: { type: 'string' },
            'allow-mutation': { type: 'boolean', default: false },
            json: { type: 'boolean', default: false },
        },
        strict: false,
    });

    if (!values.file) throw new Error('--file is required for upload command');
    if (!values['allow-mutation']) throw new Error('upload requires --allow-mutation flag');

    const page = await deps.getPage();
    const result = await uploadRunwayFile(page, String(values.file));
    const output = {
        ok: result.uploaded,
        command: 'upload',
        ...result,
        safety: buildRunwaySafety(1),
    };
    emit(deps, values.json ? JSON.stringify(output, null, 2) : `Upload: ${result.uploaded ? 'ok' : 'failed'} — ${result.filename}${result.error ? ` (${result.error})` : ''}`);
}

/**
 * @param {any} result
 */
function formatGenerateResult(result) {
    const lines = [
        `Runway ${result.command}`,
        `status: ${result.status || (result.ok ? 'ok' : 'error')}`,
        `model: ${result.model || 'n/a'}`,
        `prompt: ${clean(result.prompt || '').slice(0, 100)}`,
        `explore: ${result.explore ? 'yes' : 'no'}`,
    ];
    if (result.readyToGenerate != null) lines.push(`readyToGenerate: ${result.readyToGenerate}`);
    if (result.outputUrl) lines.push(`outputUrl: ${result.outputUrl}`);
    if (result.outputFile) lines.push(`outputFile: ${result.outputFile}`);
    if (result.poll) {
        lines.push(`polls: ${result.poll.polls}, waitedMs: ${result.poll.waitedMs}, timedOut: ${result.poll.timedOut}`);
    }
    if (result.errors?.length) lines.push(`errors: ${result.errors.join('; ')}`);
    return lines.join('\n');
}
