import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const grokLiveSrc = readFileSync(join(root, 'web-ai/grok-live.mjs'), 'utf8');
const copyMarkdownSrc = readFileSync(join(root, 'web-ai/copy-markdown.mjs'), 'utf8');
const grokModelSrc = readFileSync(join(root, 'web-ai/grok-model.mjs'), 'utf8');

describe('web-ai grok live policy', () => {
    it('uses observed Grok DOM selectors', () => {
        expect(grokLiveSrc).toMatch(/\.ProseMirror\[contenteditable="true"\]/);
        expect(grokLiveSrc).toMatch(/\[data-testid="new-chat"\]/);
        expect(grokLiveSrc).toMatch(/\[data-testid="assistant-message"\]/);
        expect(grokLiveSrc).toMatch(/response-content-markdown/);
    });

    it('verifies Grok uploads with visible and sent-turn evidence', () => {
        expect(grokLiveSrc).toMatch(/attachLocalFileLive/);
        expect(grokLiveSrc).toMatch(/verifyGrokSentTurnAttachment/);
        expect(grokLiveSrc).toMatch(/closest\('\[id\^="response-"\]'\)/);
        expect(grokLiveSrc).toMatch(/waitForTimeout\(250\)/);
        expect(grokLiveSrc).toMatch(/Grok sent turn has no attachment evidence/);
        expect(grokLiveSrc).toMatch(/data-testid\*="file"/);
    });

    it('supports opt-in copy markdown fallback', () => {
        expect(copyMarkdownSrc).toMatch(/GROK_COPY_SELECTORS/);
        expect(copyMarkdownSrc).toMatch(/\[data-testid="assistant-message"\]/);
        expect(copyMarkdownSrc).toMatch(/button\[aria-label="Copy"\]/);
        expect(grokLiveSrc).toMatch(/captureCopiedResponseText\(page, GROK_COPY_SELECTORS\)/);
        expect(grokLiveSrc).toMatch(/copy-markdown/);
    });

    it('supports observed model picker choices', () => {
        expect(grokModelSrc).toMatch(/button\[aria-label="Model select"\]/);
        for (const label of ['auto', 'fast', 'expert', 'grok-4.3', 'heavy']) {
            expect(grokModelSrc).toMatch(new RegExp(label.replace('.', '\\.')));
        }
        expect(grokLiveSrc).toMatch(/selectGrokModel/);
        expect(grokLiveSrc).toMatch(/model selected:/);
    });
});
