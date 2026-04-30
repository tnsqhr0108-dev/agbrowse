import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const browserSrc = readFileSync(join(root, 'skills/browser/browser.mjs'), 'utf8');

describe('active tab persistence contract', () => {
    it('persists tab-switch target id across CLI invocations', () => {
        expect(browserSrc).toMatch(/Target\.activateTarget/);
        expect(browserSrc).toMatch(/activeTargetId:\s*wanted\.id/);
        expect(browserSrc).toMatch(/index-or-targetId/);
        expect(browserSrc).toMatch(/updatePersistedState\(/);
    });

    it('getActivePage resolves the persisted target before array-order fallback', () => {
        const start = browserSrc.indexOf('async function getActivePage');
        const end = browserSrc.indexOf('async function listTabs', start);
        const block = browserSrc.slice(start, end);
        expect(block).toMatch(/activeTargetId/);
        expect(block).toMatch(/getPageTargetId\(page\)/);
        expect(block).toMatch(/pageTargetId === activeTargetId/);
        expect(block).toMatch(/present in CDP but not attached as a Playwright page/);
        expect(block.indexOf('activeTargetId')).toBeLessThan(block.indexOf('pages[pages.length - 1]'));
    });
});
