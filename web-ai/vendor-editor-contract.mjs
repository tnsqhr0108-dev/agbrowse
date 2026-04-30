import {
    countConversationTurns,
    insertPromptIntoComposer,
    submitPromptFromComposer,
    verifyPromptCommitted,
} from './chatgpt-composer.mjs';

export function createChatGptEditorAdapter(page, options = {}) {
    return {
        vendor: 'chatgpt',
        async waitForReady() {
            await page.locator('#prompt-textarea, .ProseMirror, [contenteditable="true"]').first().waitFor({ state: 'visible', timeout: 10_000 });
        },
        async getCommitBaseline() {
            return { turnsCount: await countConversationTurns(page) };
        },
        async insertPrompt(text) {
            await insertPromptIntoComposer(page, text, options);
        },
        async submitPrompt() {
            return submitPromptFromComposer(page);
        },
        async verifyPromptCommitted(prompt, baseline = {}) {
            return verifyPromptCommitted(page, prompt, { baselineTurns: baseline.turnsCount });
        },
    };
}

export const GEMINI_DEEP_THINK_CONSTRAINTS = {
    inputSelectors: ['rich-textarea .ql-editor', '[role="textbox"][aria-label*="prompt" i]', 'div[contenteditable="true"]'],
    responseSelectors: ['model-response', 'message-content', '.model-response-text message-content'],
    completionSignals: ['.response-footer.complete', '[role="progressbar"]'],
    modeSelectors: [
        'button[aria-label="New chat"]:not([aria-disabled="true"]):not(.disabled)',
        'button.toolbox-drawer-button',
        '[role="menuitemcheckbox"]:has-text("Deep think")',
        'button[aria-label*="Deselect Deep think"]',
    ],
};
