import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const browserSrc = readFileSync(join(__dirname, '..', '..', 'skills', 'browser', 'browser.mjs'), 'utf-8');

describe('captureConsole policy gate', () => {
    it('enforces evaluate policy before page.evaluate in captureConsole', () => {
        const fnStart = browserSrc.indexOf('async function captureConsole');
        const fnEnd = browserSrc.indexOf('\nasync function', fnStart + 1);
        const block = browserSrc.slice(fnStart, fnEnd > -1 ? fnEnd : fnStart + 600);
        const evalCallIndex = block.indexOf('page.evaluate(opts.expression)');
        const policyIndex = block.indexOf('enforcePolicy(opts.policy');
        expect(policyIndex).toBeGreaterThan(-1);
        expect(evalCallIndex).toBeGreaterThan(-1);
        expect(policyIndex).toBeLessThan(evalCallIndex);
    });

    it('passes evaluate: true to enforcePolicy in captureConsole', () => {
        const fnStart = browserSrc.indexOf('async function captureConsole');
        const fnEnd = browserSrc.indexOf('\nasync function', fnStart + 1);
        const block = browserSrc.slice(fnStart, fnEnd > -1 ? fnEnd : fnStart + 600);
        expect(block).toContain('evaluate: true');
    });
});
