import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runWebAiCli } from '../../web-ai/cli.mjs';

describe('web-ai trace fixture', () => {
    it('writes trace for offline eval command without Chrome', async () => {
        const traceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agbrowse-eval-trace-'));
        const result = await runWebAiCli([
            'eval',
            '--vendor', 'chatgpt',
            '--fixtures', 'test/fixtures/provider-dom',
            '--variant', 'baseline',
            '--trace-dir', traceDir,
            '--json',
        ], {});
        expect(result.traceId).toBeTruthy();
        const files = await fs.readdir(traceDir);
        expect(files.some(file => file.endsWith('.jsonl'))).toBe(true);
    });

    it('adds traceId to structured errors', async () => {
        const traceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agbrowse-error-trace-'));
        let thrown;
        try {
            await runWebAiCli([
                'query',
                '--vendor', 'chatgpt',
                '--prompt', 'hello',
                '--inline-only',
                '--allow-copy-markdown-fallback',
                '--trace-dir', traceDir,
                '--json',
            ], { getPage: () => { throw new Error('browser should not be reached'); } });
        } catch (error) {
            thrown = error;
        }
        expect(thrown?.traceId).toBeTruthy();
        expect(thrown.toJSON()).toMatchObject({ traceId: thrown.traceId });
        const files = await fs.readdir(traceDir);
        expect(files.some(file => file.endsWith('.jsonl'))).toBe(true);
    });
});
