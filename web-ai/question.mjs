const INLINE_CHAR_LIMIT = 50000;
import { ATTACHMENT_POLICY, WEB_AI_VENDOR } from './types.mjs';
import { WebAiError } from './errors.mjs';

export const DEFAULT_RESEARCH_INSTRUCTIONS = 'Use web search whenever possible to verify facts and gather up-to-date information. Cite the sources inline in the response body next to the claims they support (for example: [Source: <url-or-title>]).';

const SUPPORTED_VENDORS = new Set([WEB_AI_VENDOR.CHATGPT, WEB_AI_VENDOR.GEMINI, WEB_AI_VENDOR.GROK]);
const SUPPORTED_ATTACHMENT_POLICIES = new Set([
    ATTACHMENT_POLICY.INLINE_ONLY,
    ATTACHMENT_POLICY.UPLOAD,
    ATTACHMENT_POLICY.AUTO,
]);

export function normalizeEnvelope(input = {}) {
    const vendor = input.vendor || WEB_AI_VENDOR.CHATGPT;
    if (!SUPPORTED_VENDORS.has(vendor)) {
        throw new WebAiError({
            errorCode: 'provider.runtime-disabled',
            stage: 'provider-runtime-gate',
            retryHint: 'enable-or-skip',
            message: `unsupported vendor: ${vendor}`,
            evidence: { vendor },
        });
    }

    const prompt = String(input.prompt || input.question || '').trim();
    if (!prompt) throw new WebAiError({
        errorCode: 'context.over-budget',
        stage: 'context-preflight',
        retryHint: 'reduce-files',
        message: 'prompt required',
    });

    const attachmentPolicy = input.attachmentPolicy || ATTACHMENT_POLICY.INLINE_ONLY;
    if (!SUPPORTED_ATTACHMENT_POLICIES.has(attachmentPolicy)) {
        throw new WebAiError({
            errorCode: 'provider.attachment-preflight',
            stage: 'attachment-preflight',
            retryHint: 'inline-only-or-file',
            message: `unsupported attachment policy: ${attachmentPolicy}`,
            evidence: { attachmentPolicy },
        });
    }

    return {
        vendor,
        system: cleanOptional(input.system),
        project: cleanOptional(input.project),
        goal: cleanOptional(input.goal),
        context: cleanOptional(input.context),
        question: cleanOptional(input.question) || prompt,
        output: cleanOptional(input.output),
        constraints: cleanOptional(input.constraints),
        prompt,
        attachmentPolicy,
    };
}

export function renderQuestionEnvelope(input = {}) {
    const envelope = normalizeEnvelope(input);
    return renderNormalizedEnvelope(envelope);
}

export function renderQuestionEnvelopeWithContext(input = {}, contextComposerText = '') {
    const envelope = normalizeEnvelope(input);
    const contextText = String(contextComposerText || '').trim();
    if (!contextText) return renderNormalizedEnvelope(envelope);
    return renderNormalizedEnvelope({
        ...envelope,
        question: contextText,
    });
}

function renderNormalizedEnvelope(envelope) {
    const blocks = [];
    const warnings = [];

    if (envelope.system) blocks.push(section('[SYSTEM]', envelope.system));
    blocks.push(section('[USER]', [
        field('Project', envelope.project),
        field('Goal', envelope.goal),
        field('Context', envelope.context),
        field('Question', envelope.question || envelope.prompt),
        field('Output', envelope.output),
        field('Constraints', envelope.constraints),
    ].filter(Boolean).join('\n\n')));
    blocks.push(section('[INSTRUCTIONS]', DEFAULT_RESEARCH_INSTRUCTIONS));

    if (!envelope.project) warnings.push('project omitted');
    if (!envelope.goal) warnings.push('goal omitted');
    if (!envelope.output) warnings.push('output preference omitted');

    const composerText = blocks.join('\n\n');
    if (composerText.length > INLINE_CHAR_LIMIT) {
        throw new WebAiError({
            errorCode: 'context.over-budget',
            stage: 'context-preflight',
            retryHint: 'reduce-files',
            message: `inline prompt too large: ${composerText.length}/${INLINE_CHAR_LIMIT} chars`,
            evidence: { length: composerText.length, limit: INLINE_CHAR_LIMIT },
        });
    }

    return {
        markdown: composerText,
        composerText,
        estimatedChars: composerText.length,
        warnings,
    };
}

function cleanOptional(value) {
    if (value === undefined || value === null) return undefined;
    const text = String(value).trim();
    return text || undefined;
}

function section(title, body) {
    return `${title}\n${body}`;
}

function field(label, value) {
    if (!value) return '';
    return `## ${label}\n${value}`;
}
