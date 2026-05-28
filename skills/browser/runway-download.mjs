// @ts-check

import { parseArgs } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/**
 * @param {any} deps
 * @param {string} text
 */
function emit(deps, text) {
    if (typeof deps.write === 'function') deps.write(text);
    else console.log(text);
}

/**
 * Extract the most recent output asset URL from the Runway page.
 * @param {any} page
 * @param {number} [index] — 0-based index from most recent
 * @returns {Promise<{ url: string | null, type: string, error?: string }>}
 */
export async function extractRunwayOutputUrl(page, index = 0) {
    try {
        const result = await page.evaluate((/** @type {number} */ idx) => {
            const outputPattern = /(?:result|task_artifact|video-previews|generation|cdn\.runwayml)/i;
            const videos = Array.from(document.querySelectorAll('video[src], video source[src]'))
                .map(el => ({ src: el.getAttribute('src') || '', type: 'video' }))
                .filter(v => v.src && outputPattern.test(v.src));
            const images = Array.from(document.querySelectorAll('img[src]'))
                .map(el => ({ src: el.getAttribute('src') || '', type: 'image' }))
                .filter(v => v.src && outputPattern.test(v.src));

            // Merge, most recent first (last in DOM = most recent)
            const all = [...videos, ...images].reverse();
            if (idx >= all.length) return { url: null, type: 'unknown' };
            return { url: all[idx].src, type: all[idx].type };
        }, index);
        return result;
    } catch (error) {
        return { url: null, type: 'unknown', error: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * Download a Runway output asset to a local file.
 * @param {string} url
 * @param {string} outputPath
 * @returns {Promise<{ ok: boolean, path?: string, size?: number, error?: string }>}
 */
export async function downloadRunwayOutput(url, outputPath) {
    try {
        const absPath = resolve(outputPath);
        await mkdir(dirname(absPath), { recursive: true });

        const response = await fetch(url);
        if (!response.ok) {
            return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        await writeFile(absPath, buffer);
        return { ok: true, path: absPath, size: buffer.length };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * Take a screenshot of the current Runway tab.
 * @param {any} page
 * @param {string} outputPath
 * @returns {Promise<{ ok: boolean, path?: string, error?: string }>}
 */
export async function screenshotRunway(page, outputPath) {
    try {
        const absPath = resolve(outputPath);
        await mkdir(dirname(absPath), { recursive: true });
        await page.screenshot({ path: absPath, fullPage: false });
        return { ok: true, path: absPath };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * @param {string} command — 'download' or 'screenshot'
 * @param {string[]} args
 * @param {any} deps
 */
export async function runRunwayDownloadCli(command, args = [], deps = {}) {
    const { values } = parseArgs({
        args,
        options: {
            index: { type: 'string', default: '0' },
            output: { type: 'string' },
            json: { type: 'boolean', default: false },
        },
        strict: false,
    });

    const page = await deps.getPage();

    if (command === 'screenshot') {
        if (!values.output) throw new Error('--output is required for screenshot command');
        const result = await screenshotRunway(page, String(values.output));
        const output = { ok: result.ok, command: 'screenshot', ...result };
        emit(deps, values.json ? JSON.stringify(output, null, 2) : `Screenshot: ${result.ok ? result.path : result.error}`);
        return;
    }

    // download
    const extracted = await extractRunwayOutputUrl(page, Number(values.index) || 0);
    if (!extracted.url) {
        const output = { ok: false, command: 'download', error: extracted.error || 'No output asset found on page' };
        emit(deps, values.json ? JSON.stringify(output, null, 2) : `Download failed: ${output.error}`);
        return;
    }

    if (!values.output) {
        const ext = extracted.type === 'video' ? '.mp4' : '.png';
        const output = {
            ok: true,
            command: 'download',
            url: extracted.url,
            type: extracted.type,
            hint: `Use --output <path${ext}> to save the file`,
        };
        emit(deps, values.json ? JSON.stringify(output, null, 2) : `Asset URL: ${extracted.url}\nType: ${extracted.type}\nUse --output to download.`);
        return;
    }

    const result = await downloadRunwayOutput(extracted.url, String(values.output));
    const output = {
        ok: result.ok,
        command: 'download',
        url: extracted.url,
        type: extracted.type,
        ...result,
    };
    emit(deps, values.json
        ? JSON.stringify(output, null, 2)
        : `Download: ${result.ok ? `${result.path} (${result.size} bytes)` : result.error}`);
}
