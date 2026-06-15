import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { autoConfirmPlan } from '../../web-ai/chatgpt-deep-research.mjs';

const chatgptDeepResearchSrc = readFileSync(join(process.cwd(), 'web-ai', 'chatgpt-deep-research.mjs'), 'utf8');

describe('web-ai ChatGPT Deep Research flow', () => {
    it('auto-confirms the post-submit Deep Research Start plan card', async () => {
        const clicked = [];
        const page = {
            locator(selector) {
                return {
                    first() {
                        return this;
                    },
                    async isVisible() {
                        return selector === 'button:has-text("Start")';
                    },
                    async click() {
                        clicked.push(selector);
                    },
                };
            },
            async waitForTimeout() {
                throw new Error('should not wait once Start is visible');
            },
        };

        await expect(autoConfirmPlan(page, 15_000)).resolves.toBe(true);
        expect(clicked).toEqual(['button:has-text("Start")']);
    });

    it('uses the live-observed 15 second post-submit confirmation window', () => {
        expect(chatgptDeepResearchSrc).toContain('button:has-text("Start research")');
        expect(chatgptDeepResearchSrc).toContain('button:has-text("Start")');
        expect(chatgptDeepResearchSrc).toContain('button:has-text("시작")');
        expect(chatgptDeepResearchSrc).toContain('timeoutMs = 15_000');
        expect(chatgptDeepResearchSrc).toContain('await page.waitForTimeout(250)');
    });
});
