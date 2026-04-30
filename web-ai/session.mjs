import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const baselines = new Map();
let loaded = false;
const STORE_PATH = join(process.env.BROWSER_AGENT_HOME || join(homedir(), '.browser-agent'), 'web-ai-baselines.json');

export function hashPrompt(envelope) {
    const payload = {
        vendor: envelope.vendor,
        system: envelope.system || '',
        prompt: envelope.prompt || '',
        project: envelope.project || '',
        goal: envelope.goal || '',
        context: envelope.context || '',
        question: envelope.question || '',
        output: envelope.output || '',
        constraints: envelope.constraints || '',
        attachmentPolicy: envelope.attachmentPolicy || 'inline-only',
    };
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function makeBaselineKey(vendor, url) {
    return `${vendor}:${url || 'unknown-url'}`;
}

export function saveBaseline({ vendor, url, envelope, assistantCount, textHash }) {
    loadStore();
    const baseline = {
        vendor,
        url,
        promptHash: hashPrompt(envelope),
        assistantCount,
        textHash,
        capturedAt: new Date().toISOString(),
    };
    baselines.set(makeBaselineKey(vendor, url), baseline);
    saveStore();
    return baseline;
}

export function getBaseline(vendor, url) {
    loadStore();
    return baselines.get(makeBaselineKey(vendor, url)) || null;
}

export function getLatestBaseline(vendor) {
    loadStore();
    const matches = Array.from(baselines.values()).filter(baseline => baseline.vendor === vendor);
    return matches.at(-1) || null;
}

export function clearBaseline(vendor, url) {
    loadStore();
    baselines.delete(makeBaselineKey(vendor, url));
    saveStore();
}

function loadStore() {
    if (loaded) return;
    loaded = true;
    if (!existsSync(STORE_PATH)) return;
    try {
        const parsed = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
        for (const baseline of parsed.baselines || []) {
            if (baseline.vendor && baseline.url) baselines.set(makeBaselineKey(baseline.vendor, baseline.url), baseline);
        }
    } catch {
        baselines.clear();
    }
}

function saveStore() {
    mkdirSync(dirname(STORE_PATH), { recursive: true });
    writeFileSync(STORE_PATH, `${JSON.stringify({ baselines: Array.from(baselines.values()) }, null, 2)}\n`);
}
