import { execFileSync } from 'node:child_process';

// ─── JSON extraction ─────────────────────────────

function extractJsonObjects(text) {
    const objects = [];
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (ch === '\\') {
            escaped = true;
            continue;
        }

        if (ch === '"') {
            inString = !inString;
            continue;
        }

        if (inString) continue;

        if (ch === '{') {
            if (depth === 0) start = i;
            depth += 1;
        } else if (ch === '}') {
            if (depth === 0) continue;
            depth -= 1;
            if (depth === 0 && start !== -1) {
                objects.push(text.slice(start, i + 1));
                start = -1;
            }
        }
    }

    return objects;
}

// ─── CLI args ────────────────────────────────────

export function parseVisionClickCliArgs(args, defaults = {}) {
    const positionals = [];
    const opts = {
        doubleClick: false,
        port: defaults.port,
        browserScript: defaults.browserScript,
        prepareStable: false,
        verifyBeforeClick: false,
        viewport: defaults.viewport || null,
        region: null,
        clip: null,
        help: false,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--help' || arg === '-h') {
            opts.help = true;
            continue;
        }
        if (arg === '--double') {
            opts.doubleClick = true;
            continue;
        }
        if (arg === '--prepare-stable') {
            opts.prepareStable = true;
            continue;
        }
        if (arg === '--verify-before-click') {
            opts.verifyBeforeClick = true;
            continue;
        }
        if (arg === '--port') {
            opts.port = args[i + 1] || opts.port;
            i += 1;
            continue;
        }
        if (arg === '--browser-script') {
            opts.browserScript = args[i + 1] || opts.browserScript;
            i += 1;
            continue;
        }
        if (arg === '--viewport') {
            opts.viewport = parseViewportSpec(args[i + 1]) || opts.viewport;
            i += 1;
            continue;
        }
        if (arg === '--region') {
            opts.region = args[i + 1] || opts.region;
            i += 1;
            continue;
        }
        if (arg === '--clip') {
            const values = args.slice(i + 1, i + 5).map(value => parseInt(value, 10));
            if (values.length < 4 || values.some(value => Number.isNaN(value))) {
                throw new Error('Invalid --clip arguments. Usage: --clip <x> <y> <width> <height>');
            }
            opts.clip = {
                x: values[0],
                y: values[1],
                width: values[2],
                height: values[3],
            };
            i += 4;
            continue;
        }
        if (arg.startsWith('--')) continue;
        positionals.push(arg);
    }

    return {
        target: positionals.join(' ').trim(),
        opts,
    };
}

export function parseViewportSpec(value) {
    if (!value) return null;
    const match = String(value).match(/^(\d+)x(\d+)$/i);
    if (!match) {
        throw new Error(`Invalid --viewport value: ${value}. Use WIDTHxHEIGHT, e.g. 1440x900`);
    }
    return {
        width: parseInt(match[1], 10),
        height: parseInt(match[2], 10),
    };
}

export function describeRegion(region) {
    if (!region) return '';
    const hints = {
        'left-panel': 'Focus only on the left-side results panel. Ignore the map canvas, header chrome, and floating controls.',
        'center-map': 'Focus only on the center map canvas area. Ignore the side panel, top search bar, and floating controls.',
        'top-bar': 'Focus only on the top search and header controls area. Ignore the map canvas and side panel.',
    };
    return hints[region] || `Focus only on the region labeled "${region}".`;
}

export function resolveRegionClip(region, viewport) {
    if (!region) return null;
    const width = viewport.width;
    const height = viewport.height;

    switch (region) {
        case 'left-panel':
            return {
                x: 0,
                y: 0,
                width: Math.min(440, Math.round(width * 0.38)),
                height,
            };
        case 'center-map': {
            const clipWidth = Math.round(width * 0.5);
            const clipHeight = Math.round(height * 0.72);
            return {
                x: Math.round((width - clipWidth) / 2),
                y: Math.round(height * 0.12),
                width: clipWidth,
                height: clipHeight,
            };
        }
        case 'top-bar':
            return {
                x: 0,
                y: 0,
                width,
                height: Math.min(180, Math.round(height * 0.2)),
            };
        default:
            throw new Error(`Unknown --region value: ${region}`);
    }
}

export function clipAroundPoint(point, viewport, size = {}) {
    const width = Math.min(size.width || 260, viewport.width);
    const height = Math.min(size.height || 180, viewport.height);
    const x = Math.max(0, Math.min(Math.round(point.x - width / 2), viewport.width - width));
    const y = Math.max(0, Math.min(Math.round(point.y - height / 2), viewport.height - height));
    return { x, y, width, height };
}

// ─── Prompt ──────────────────────────────────────

export function buildCoordPrompt(target, options = {}) {
    const prompt = [
        'Look at this screenshot image carefully.',
        `Find the UI element "${target}" and return its center pixel coordinate.`,
        'You MUST respond with ONLY this JSON format, nothing else:',
        '{"found":true,"x":<int>,"y":<int>,"description":"<brief description>"}',
        'If not found: {"found":false,"x":0,"y":0,"description":"not found"}',
        'IMPORTANT: Do NOT run any commands. Just analyze the image visually and return the JSON.',
    ];
    if (options.regionHint) {
        prompt.splice(2, 0, options.regionHint);
    }
    if (options.centerBias) {
        prompt.splice(2, 0, 'The correct target should be close to the center of this cropped image.');
    }
    if (options.preferContainer) {
        prompt.splice(2, 0, 'Prefer the clickable row or container center over inner icons or decorative badges.');
    }
    return prompt.join(' ');
}

// ─── Coord JSON extraction ───────────────────────

export function extractCoordJson(text) {
    const candidates = extractJsonObjects(String(text || ''));
    for (const candidate of candidates.reverse()) {
        try {
            const coords = JSON.parse(candidate);
            if (typeof coords?.found !== 'boolean') continue;
            if (typeof coords.x === 'number' && typeof coords.y === 'number') return coords;
        } catch {
            // Skip malformed JSON candidates and keep scanning.
        }
    }
    return null;
}

// ─── Codex CLI check ─────────────────────────────

export function assertCodexCli(options = {}) {
    const execFn = options.execFn || execFileSync;
    const binary = options.binary || (process.platform === 'win32' ? 'where' : 'which');
    try {
        execFn(binary, ['codex'], { encoding: 'utf-8', timeout: 3000 });
    } catch {
        throw new Error(
            'codex CLI not found.\n' +
            '  Install: npm install -g @openai/codex\n' +
            '  Docs: https://github.com/openai/codex'
        );
    }
}

// ─── DPR correction ──────────────────────────────

export function applyDprCorrection(rawX, rawY, dpr = 1) {
    return {
        x: Math.round(rawX / dpr),
        y: Math.round(rawY / dpr),
    };
}
