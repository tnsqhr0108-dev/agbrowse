// @ts-check
// Code-mode orchestration (Phase 12 of devlog/_plan/260611_webai_gpt_code_mode):
// strict contract prompt → ChatGPT query → conversation-id resolution →
// in-page artifact retrieval → zip verification. ChatGPT-only: the contract
// depends on container tools that Gemini/Grok do not expose the same way.

import { WebAiError } from './errors.mjs';
import { buildCodeModePrompt, checkContractCompliance } from './code-mode-prompt.mjs';
import { retrieveAllCodeArtifacts, retrieveCodeArtifact } from './code-artifact.mjs';

const CONVERSATION_ID_RE = /\/c\/([a-z0-9-]+)/i;

/**
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
export function extractConversationId(url) {
    const match = String(url || '').match(CONVERSATION_ID_RE);
    return match ? match[1] : null;
}

/**
 * @param {{ getPage: () => Promise<import('playwright-core').Page> }} deps
 * @param {Record<string, any>} input
 * @param {{ queryWebAi: (deps: any, input: any) => Promise<any>, getSession: (id: string) => any }} services
 */
export async function codeWebAi(deps, input, services) {
    if (input.vendor && input.vendor !== 'chatgpt') {
        throw new WebAiError({
            errorCode: 'code-mode.vendor-unsupported',
            stage: 'code-mode',
            retryHint: 'use-chatgpt',
            message: 'web-ai code is ChatGPT-only (container tool contract)',
        });
    }
    const multiZip = input.multiZip === true;
    const contractPrompt = buildCodeModePrompt(input.prompt, { multiZip });
    const result = await services.queryWebAi(deps, { ...input, prompt: contractPrompt, inlineOnly: true });
    if (!result?.ok) return result;

    const warnings = [...(result.warnings || [])];
    if (!multiZip) {
        const compliance = checkContractCompliance(result.answerText || '');
        if (!compliance.compliant) warnings.push('code-mode:contract-drift');
        if (!compliance.mentionsPath) warnings.push('code-mode:answer-missing-artifact-path');
        result.compliance = compliance;
    }

    const session = result.sessionId ? services.getSession(result.sessionId) : null;
    const page = await deps.getPage();
    const pageUrl = typeof page?.url === 'function' ? page.url() : '';
    const conversationId = extractConversationId(session?.conversationUrl)
        || extractConversationId(session?.url)
        || extractConversationId(pageUrl);
    if (!conversationId) {
        return { ...result, ok: false, errorCode: 'code-mode.conversation-id-missing', warnings };
    }

    if (multiZip) {
        const outputDir = input.outputDir || `${process.cwd()}/code-artifacts-${conversationId.slice(0, 8)}`;
        const multi = await retrieveAllCodeArtifacts(page, { conversationId, outputDir });
        if (!multi.ok) {
            return { ...result, ok: false, errorCode: multi.reason || 'code-mode.retrieval-failed', artifacts: multi.artifacts, warnings };
        }
        const failed = multi.artifacts.filter(a => !a.ok);
        if (failed.length) warnings.push(`code-mode:partial-retrieval(${failed.length} failed)`);
        return { ...result, ok: true, artifacts: multi.artifacts, outputDir, warnings };
    }

    const outputPath = input.outputZip
        || `${process.cwd()}/code-artifact-${conversationId.slice(0, 8)}.zip`;
    const artifact = await retrieveCodeArtifact(page, { conversationId, outputPath });
    if (!artifact.ok) {
        return { ...result, ok: false, errorCode: artifact.reason || 'code-mode.retrieval-failed', artifact, warnings };
    }
    return { ...result, ok: true, artifact, warnings };
}
