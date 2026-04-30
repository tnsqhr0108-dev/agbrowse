import { renderQuestionEnvelope, renderQuestionEnvelopeWithContext, normalizeEnvelope } from './question.mjs';
import { getBaseline, saveBaseline } from './session.mjs';
import { createChatGptEditorAdapter } from './vendor-editor-contract.mjs';
import {
    attachLocalFileLive,
    fileInfoFromPath,
    verifySentTurnAttachmentLive,
} from './chatgpt-attachments.mjs';
import { selectChatGptModel } from './chatgpt-model.mjs';
import { prepareContextForBrowser } from './context-pack/index.mjs';
import { captureCopiedResponseText, CHATGPT_COPY_SELECTORS, preferCopiedText } from './copy-markdown.mjs';

const CHATGPT_HOSTS = new Set(['chatgpt.com', 'chat.openai.com']);
const ASSISTANT_SELECTORS = [
    '[data-message-author-role="assistant"]',
    '[data-turn="assistant"]',
    'article[data-testid^="conversation-turn"]',
];
const PLACEHOLDER_PATTERNS = [
    /^answer now$/i,
    /^pro thinking/i,
    /^finalizing answer$/i,
    /^instant$/i,
    /^thinking$/i,
    /^pro$/i,
    /^configure\.{0,3}$/i,
    /^reading documents?$/i,
    /^analyzing files?$/i,
    /^\s*$/,
];

export async function renderWebAi(input = {}) {
    const envelope = normalizeEnvelope(input);
    const contextPack = await prepareContextForBrowser(input);
    const rendered = contextPack
        ? contextPack.transport === 'inline'
            ? renderQuestionEnvelopeWithContext(envelope, contextPack.composerText)
            : renderQuestionEnvelope(envelope)
        : renderQuestionEnvelope(envelope);
    return {
        ok: true,
        vendor: envelope.vendor,
        status: 'rendered',
        rendered,
        contextPack: contextPack ? summarizeContextPack(contextPack) : undefined,
        warnings: [...rendered.warnings, ...(contextPack?.warnings || [])],
    };
}

export async function statusWebAi(deps, input = {}) {
    const page = await requireChatGptPage(deps);
    return { ok: true, vendor: input.vendor || 'chatgpt', status: 'ready', url: page.url(), warnings: [] };
}

export async function sendWebAi(deps, input = {}) {
    const envelope = normalizeEnvelope(input);
    if (input.url) {
        const page = await deps.getPage();
        await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    }
    const page = await requireChatGptPage(deps);
    const contextPack = await prepareContextForBrowser(input);
    const rendered = contextPack
        ? contextPack.transport === 'inline'
            ? renderQuestionEnvelopeWithContext(envelope, contextPack.composerText)
            : renderQuestionEnvelope(envelope)
        : renderQuestionEnvelope(envelope);
    const selectedModel = await selectChatGptModel(page, input.model);
    await waitForStableAssistantCount(page);
    const assistantCount = await countAssistantMessages(page);
    const baseline = saveBaseline({
        vendor: envelope.vendor,
        url: page.url(),
        envelope,
        assistantCount,
        textHash: String((await page.innerText('body').catch(() => '')).length),
    });

    const adapter = createChatGptEditorAdapter(page, {
        insertText: async (text) => {
            const cdp = await deps.getCdpSession?.();
            if (!cdp) throw new Error('CDP session unavailable for Input.insertText');
            try {
                await cdp.send('Input.insertText', { text });
            } finally {
                await cdp.detach?.().catch(() => undefined);
            }
        },
    });
    await adapter.waitForReady();
    const commitBaseline = await adapter.getCommitBaseline();
    await adapter.insertPrompt(rendered.composerText);
    let attachmentWarnings = [];
    let usedFallbacks = [];
    const contextAttachmentPath = contextPack?.attachments?.[0]?.path;
    if (contextAttachmentPath && input.filePath) {
        throw new Error('context package upload and --file upload cannot be combined yet');
    }
    const uploadPath = input.filePath || contextAttachmentPath;
    if (uploadPath) {
        const upload = await attachLocalFileLive(page, fileInfoFromPath(uploadPath));
        if (!upload.ok) throw new Error(upload.error);
        attachmentWarnings = upload.warnings || [];
        usedFallbacks = upload.usedFallbacks || [];
    }
    await adapter.submitPrompt();
    await adapter.verifyPromptCommitted(rendered.composerText, commitBaseline);
    if (uploadPath) {
        const sentAttachment = await verifySentTurnAttachmentLive(page, fileInfoFromPath(uploadPath));
        if (!sentAttachment.ok) throw new Error(sentAttachment.error);
    }
    return {
        ok: true,
        vendor: envelope.vendor,
        status: 'sent',
        url: page.url(),
        baseline,
        usedFallbacks: [...usedFallbacks, ...(selectedModel?.usedFallbacks || [])],
        contextPack: contextPack ? summarizeContextPack(contextPack) : undefined,
        warnings: [
            ...rendered.warnings,
            ...(contextPack?.warnings || []),
            ...(contextAttachmentPath ? [`context package attached: ${contextPack.attachments[0].displayPath}`] : []),
            ...attachmentWarnings,
            ...(selectedModel ? [`model selected: ${selectedModel.selected}${selectedModel.alreadySelected ? ' (already selected)' : ''}`] : []),
        ],
    };
}

export async function pollWebAi(deps, input = {}) {
    const vendor = input.vendor || 'chatgpt';
    const timeout = Math.max(1, Number(input.timeout || 600));
    const page = await requireChatGptPage(deps);
    const baseline = getBaseline(vendor, page.url());
    if (!baseline) throw new Error('baseline required. Run web-ai send or query first.');

    const deadline = Date.now() + timeout * 1000;
    let stableText = '';
    let stableSince = 0;
    while (Date.now() <= deadline) {
        const answers = await readAssistantMessages(page);
        const newAnswers = answers.slice(baseline.assistantCount).filter(isFinalAnswer);
        const latest = newAnswers.at(-1) || '';
        const streaming = await isStreaming(page);
        if (latest && !streaming) {
            if (latest === stableText) {
                if (Date.now() - stableSince >= 1500) {
                    const usedFallbacks = [];
                    const warnings = [];
                    let answerText = latest;
                    if (input.allowCopyMarkdownFallback === true) {
                        const copied = await captureCopiedResponseText(page, CHATGPT_COPY_SELECTORS);
                        const copiedText = preferCopiedText(latest, copied);
                        if (copiedText) {
                            answerText = cleanAssistantText(copiedText);
                            usedFallbacks.push('copy-markdown');
                        } else {
                            warnings.push(`copy-markdown-fallback-unavailable:${copied.status || 'unknown'}`);
                        }
                    }
                    return {
                        ok: true,
                        vendor,
                        status: 'complete',
                        url: page.url(),
                        answerText,
                        baseline,
                        usedFallbacks,
                        warnings,
                    };
                }
            } else {
                stableText = latest;
                stableSince = Date.now();
            }
        } else {
            stableText = '';
            stableSince = 0;
        }
        await page.waitForTimeout(500);
    }

    if (input.allowCopyMarkdownFallback === true && stableText) {
        const copied = await captureCopiedResponseText(page, CHATGPT_COPY_SELECTORS);
        const copiedText = preferCopiedText(stableText, copied);
        if (copiedText) {
            return {
                ok: true,
                vendor,
                status: 'complete',
                url: page.url(),
                answerText: cleanAssistantText(copiedText),
                baseline,
                usedFallbacks: ['copy-markdown'],
                warnings: [],
            };
        }
        return {
            ok: false,
            vendor,
            status: 'timeout',
            url: page.url(),
            baseline,
            warnings: [`copy-markdown-fallback-unavailable:${copied.status || 'unknown'}`],
            usedFallbacks: [],
            error: 'timed out waiting for answer',
        };
    }
    return { ok: false, vendor, status: 'timeout', url: page.url(), baseline, warnings: [], usedFallbacks: [], error: 'timed out waiting for answer' };
}

async function isStreaming(page) {
    for (const selector of ['button[data-testid="stop-button"]', 'button[aria-label*="Stop" i]']) {
        const first = page.locator(selector).first();
        if (typeof first.isVisible === 'function' && await first.isVisible().catch(() => false)) return true;
    }
    return false;
}

export async function queryWebAi(deps, input = {}) {
    const sent = await sendWebAi(deps, input);
    const result = await pollWebAi(deps, {
        vendor: sent.vendor,
        timeout: input.timeout,
        allowCopyMarkdownFallback: input.allowCopyMarkdownFallback === true,
    });
    return {
        ...result,
        usedFallbacks: [...(sent.usedFallbacks || []), ...(result.usedFallbacks || [])],
        warnings: [...(sent.warnings || []), ...(result.warnings || [])],
    };
}

export async function stopWebAi(deps, input = {}) {
    const page = await requireChatGptPage(deps);
    await page.keyboard.press('Escape');
    return { ok: true, vendor: input.vendor || 'chatgpt', status: 'blocked', url: page.url(), warnings: ['sent Escape to stop generation'] };
}

async function requireChatGptPage(deps) {
    const page = await deps.getPage();
    const url = page.url();
    let host = '';
    try {
        host = new URL(url).hostname.replace(/^www\./, '');
    } catch {
        throw new Error(`active tab has invalid URL: ${url}`);
    }
    if (!CHATGPT_HOSTS.has(host)) {
        throw new Error(`active tab is not ChatGPT: ${url}. Use tabs then tab-switch before web-ai.`);
    }
    return page;
}

async function countAssistantMessages(page) {
    return (await readAssistantMessages(page)).length;
}

async function waitForStableAssistantCount(page, timeoutMs = 8_000) {
    const deadline = Date.now() + timeoutMs;
    let previous = -1;
    let stableReads = 0;
    while (Date.now() < deadline) {
        const count = await countAssistantMessages(page).catch(() => 0);
        if (count === previous) stableReads += 1;
        else stableReads = 0;
        previous = count;
        if (stableReads >= 2) return;
        await page.waitForTimeout(500).catch(() => undefined);
    }
}

async function readAssistantMessages(page) {
    const evaluated = await page.evaluate((selectors) => {
        for (const selector of selectors) {
            const texts = Array.from(document.querySelectorAll(selector))
                .map(el => String(el.innerText || el.textContent || '').trim())
                .filter(Boolean);
            if (texts.length) return texts;
        }
        return [];
    }, ASSISTANT_SELECTORS).catch(() => []);
    if (Array.isArray(evaluated) && evaluated.length) return evaluated.map(cleanAssistantText).filter(Boolean);

    const messages = [];
    for (const selector of ASSISTANT_SELECTORS) {
        const locators = await page.locator(selector).all().catch(() => []);
        for (const locator of locators) {
            const text = cleanAssistantText(await locator.innerText().catch(() => ''));
            if (text) messages.push(text);
        }
        if (messages.length > 0) break;
    }
    return messages;
}

function isFinalAnswer(text) {
    return !PLACEHOLDER_PATTERNS.some(pattern => pattern.test(text));
}

function cleanAssistantText(text) {
    return String(text || '')
        .replace(/^Thought for\s+\d+s\s*/i, '')
        .trim();
}

function summarizeContextPack(contextPack) {
    return {
        files: contextPack.files.map(file => ({
            relativePath: file.relativePath,
            sizeBytes: file.sizeBytes,
            estimatedTokens: file.estimatedTokens,
        })),
        excluded: contextPack.excluded,
        budget: contextPack.budget,
    };
}
