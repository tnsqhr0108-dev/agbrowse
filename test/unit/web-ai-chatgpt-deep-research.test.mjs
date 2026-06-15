import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { autoConfirmPlan } from '../../web-ai/chatgpt-deep-research.mjs';

const chatgptDeepResearchSrc = readFileSync(join(process.cwd(), 'web-ai', 'chatgpt-deep-research.mjs'), 'utf8');

describe('web-ai ChatGPT Deep Research flow', () => {
    it('auto-confirms the post-submit Deep Research Start plan card on the page', async () => {
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
            frames() {
                return [];
            },
            async waitForTimeout() {
                throw new Error('should not wait once Start is visible');
            },
        };

        await expect(autoConfirmPlan(page, 70_000)).resolves.toBe(true);
        expect(clicked).toEqual(['button:has-text("Start")']);
    });

    it('auto-confirms the Deep Research Start card inside the app iframe', async () => {
        const clicked = [];
        const invisibleContext = {
            locator() {
                return {
                    first() {
                        return this;
                    },
                    async isVisible() {
                        return false;
                    },
                    async click() {
                        throw new Error('should not click the page context');
                    },
                };
            },
        };
        const frameContext = {
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
        };
        const page = {
            ...invisibleContext,
            frames() {
                return [frameContext];
            },
            async waitForTimeout() {
                throw new Error('should not wait once iframe Start is visible');
            },
        };

        await expect(autoConfirmPlan(page, 70_000)).resolves.toBe(true);
        expect(clicked).toEqual(['button:has-text("Start")']);
    });

    it('uses the live-observed post-submit confirmation window and labels', () => {
        expect(chatgptDeepResearchSrc).toContain('button:has-text("Start research")');
        expect(chatgptDeepResearchSrc).toContain('button:has-text("Start")');
        expect(chatgptDeepResearchSrc).toContain('button:has-text("시작")');
        expect(chatgptDeepResearchSrc).toContain('timeoutMs = 70_000');
        expect(chatgptDeepResearchSrc).toContain('page.frames()');
        expect(chatgptDeepResearchSrc).toContain('await page.waitForTimeout(250)');
    });
});
