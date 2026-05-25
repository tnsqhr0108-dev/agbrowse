import fs from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runWebAiCli } from '../../web-ai/cli.mjs';

const ORIGINAL_HOME = process.env.BROWSER_AGENT_HOME;
let tmpHome;

beforeEach(() => {
    tmpHome = mkdtempSync(join(tmpdir(), 'agbrowse-policy-cli-'));
    process.env.BROWSER_AGENT_HOME = tmpHome;
});

afterEach(() => {
    if (ORIGINAL_HOME === undefined) delete process.env.BROWSER_AGENT_HOME;
    else process.env.BROWSER_AGENT_HOME = ORIGINAL_HOME;
    rmSync(tmpHome, { recursive: true, force: true });
});

describe('web-ai policy CLI', () => {
    it('allows provider copy capture when the CLI fallback flag is explicitly set', async () => {
        const deps = { getPage: vi.fn(() => { throw new Error('now browser may be reached'); }) };
        await expect(runWebAiCli([
            'poll',
            '--vendor', 'chatgpt',
            '--allow-copy-markdown-fallback',
            '--json',
        ], deps)).rejects.toThrow(/now browser may be reached/);
        expect(deps.getPage).toHaveBeenCalled();
    });

    it('fails before browser mutation when policy explicitly disables provider copy capture', async () => {
        await fs.writeFile('tmp-deny-copy-policy.json', JSON.stringify({
            version: 1,
            allowClipboardWrite: false,
        }));
        try {
            const deps = { getPage: vi.fn(() => { throw new Error('browser should not be touched'); }) };
            await expect(runWebAiCli([
                'poll',
                '--vendor', 'chatgpt',
                '--allow-copy-markdown-fallback',
                '--policy', 'tmp-deny-copy-policy.json',
                '--json',
            ], deps)).rejects.toThrow(/provider copy capture denied/);
            expect(deps.getPage).not.toHaveBeenCalled();
        } finally {
            await fs.rm('tmp-deny-copy-policy.json', { force: true });
        }
    });

    it('allows provider copy capture with the legacy clipboard-read unsafe allowance', async () => {
        const deps = { getPage: vi.fn(() => { throw new Error('now browser may be reached'); }) };
        await expect(runWebAiCli([
            'poll',
            '--vendor', 'chatgpt',
            '--allow-copy-markdown-fallback',
            '--unsafe-allow', 'clipboard-read',
            '--json',
        ], deps)).rejects.toThrow(/now browser may be reached/);
        expect(deps.getPage).toHaveBeenCalled();
    });

    it('allows provider copy capture with clipboard-write-intercept unsafe allowance', async () => {
        const deps = { getPage: vi.fn(() => { throw new Error('reached browser via new alias'); }) };
        await expect(runWebAiCli([
            'poll',
            '--vendor', 'chatgpt',
            '--allow-copy-markdown-fallback',
            '--unsafe-allow', 'clipboard-write-intercept',
            '--json',
        ], deps)).rejects.toThrow(/reached browser via new alias/);
        expect(deps.getPage).toHaveBeenCalled();
    });

    it('enforces denied vendor default origin before browser mutation', async () => {
        await fs.writeFile('tmp-deny-chatgpt-policy.json', JSON.stringify({
            version: 1,
            deniedOrigins: ['https://chatgpt.com'],
        }));
        try {
            const deps = { getPage: vi.fn(() => { throw new Error('browser should not be touched'); }) };
            await expect(runWebAiCli([
                'send',
                '--vendor', 'chatgpt',
                '--inline-only',
                '--prompt', 'hello',
                '--policy', 'tmp-deny-chatgpt-policy.json',
                '--json',
            ], deps)).rejects.toThrow(/origin denied/);
            expect(deps.getPage).not.toHaveBeenCalled();
        } finally {
            await fs.rm('tmp-deny-chatgpt-policy.json', { force: true });
        }
    });
});
