// @ts-check
import { updateSession } from './session.mjs';
import { poolTab } from './tab-pool.mjs';
import { trySaveTranscript, appendArtifactRecord } from './session-artifacts.mjs';
import { resolveArchivePolicy, archiveConversation } from './chatgpt-archive.mjs';

const FINALIZABLE_STATUSES = new Set(['complete', 'completed']);

/**
 * @typedef {Object} FinalizeDeps
 * @property {() => number} [getPort]
 */

/**
 * @typedef {Object} FinalizeSession
 * @property {string} [sessionId]
 * @property {string} [targetId]
 * @property {string} [vendor]
 * @property {string} [conversationUrl]
 * @property {string} [originalUrl]
 */

/**
 * @typedef {Object} FinalizePage
 * @property {() => string} [url]
 */

/**
 * @typedef {Object} FinalizeOptions
 * @property {string} [vendor]
 * @property {FinalizeSession} [session]
 * @property {FinalizePage} [page]
 * @property {string} [answerText]
 * @property {string} [artifactText]
 * @property {string} [status]
 * @property {unknown[]} [warnings]
 * @property {string} [archiveFlag]
 * @property {string} [sessionType]
 */

/**
 * @typedef {{ finalized: false, reason: string } | { finalized: true, pool: unknown, archived?: boolean, archiveSkippedReason?: string, artifactStatus?: unknown }} FinalizeResult
 */

/**
 * @param {FinalizeDeps} [deps]
 * @param {FinalizeOptions} [options]
 * @returns {Promise<FinalizeResult>}
 */
export async function finalizeProviderTab(deps, {
    vendor,
    session,
    page,
    answerText,
    artifactText,
    status = 'complete',
    warnings = [],
    archiveFlag,
    sessionType = 'send-poll',
} = {}) {
    if (!session?.sessionId || !session.targetId || !FINALIZABLE_STATUSES.has(status)) {
        return { finalized: false, reason: 'not-finalizable' };
    }
    const conversationUrl = page?.url?.() || session.conversationUrl || session.originalUrl || undefined;
    const baseWarnings = Array.isArray(warnings) ? warnings : [];
    updateSession(session.sessionId, {
        status: 'complete',
        conversationUrl,
        answer: answerText,
        warnings: baseWarnings,
        completedAt: new Date().toISOString(),
    });
    /** @type {{ required: boolean, ok: boolean, descriptor?: unknown, stage?: string, error?: string }} */
    let artifactStatus = { required: false, ok: true };
    if (answerText) {
        const saved = trySaveTranscript(session.sessionId, artifactText || answerText);
        artifactStatus = saved.ok
            ? { required: true, ok: true, descriptor: saved.descriptor }
            : { required: true, ok: false, stage: saved.stage, error: saved.error };
        if (saved.ok) {
            appendArtifactRecord(session.sessionId, saved.descriptor);
        } else {
            updateSession(session.sessionId, {
                warnings: [...baseWarnings, `artifact-save-failed:${saved.stage}:${saved.error}`],
            });
        }
    }

    const { shouldArchive } = resolveArchivePolicy({
        archiveFlag: archiveFlag || 'auto',
        session: { ...session, conversationUrl, status: 'complete' },
        artifactStatus,
    });

    if (shouldArchive && page && conversationUrl) {
        try {
            const archiveResult = await archiveConversation(page, { conversationUrl });
            if (archiveResult.ok) {
                updateSession(session.sessionId, { archived: true });
                return { finalized: true, pool: null, archived: true };
            }
        } catch { /* archive is best-effort, fall through to pool */ }
    }

    const port = deps?.getPort?.() || 9222;
    const result = await poolTab(vendor || session.vendor || 'chatgpt', session.targetId, conversationUrl, {
        port,
        owner: 'web-ai',
        sessionType,
        sessionId: session.sessionId,
    });
    return {
        finalized: true,
        pool: result,
        archived: false,
        archiveSkippedReason: artifactStatus.required && artifactStatus.ok === false ? 'artifact-save-failed' : undefined,
        artifactStatus,
    };
}
