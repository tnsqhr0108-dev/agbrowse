// @ts-check
import { WebAiError } from './errors.mjs';
import { listSessions } from './session.mjs';

const DEFAULT_VENDOR = 'chatgpt';
const IMPLICIT_SESSION_COMMANDS = new Set(['poll', 'stop']);

/**
 * @typedef {{
 *   sessionId: string,
 *   vendor: string|null,
 *   status: string|null,
 *   targetId: string|null,
 *   conversationUrl: string|null,
 *   deadlineAt: string|null,
 * }} SessionCandidate
 */

/**
 * @param {any} value
 * @returns {string}
 */
export function normalizeWebAiVendor(value) {
    return String(value || DEFAULT_VENDOR);
}

/**
 * @param {any} session
 * @returns {SessionCandidate}
 */
export function sanitizeSessionCandidate(session) {
    return {
        sessionId: String(session?.sessionId || ''),
        vendor: session?.vendor || null,
        status: session?.status || null,
        targetId: session?.targetId || null,
        conversationUrl: session?.conversationUrl || null,
        deadlineAt: session?.deadlineAt || null,
    };
}

/**
 * @param {string} vendor
 * @returns {SessionCandidate[]}
 */
export function activeProviderSessionCandidates(vendor) {
    return listSessions({ vendor: normalizeWebAiVendor(vendor), active: true })
        .map(sanitizeSessionCandidate)
        .filter((candidate) => candidate.sessionId);
}

/**
 * @param {{ command?: string, vendor?: string, session?: string|null, port?: string|number }} input
 * @returns {{ action: 'explicit'|'none'|'auto-bind', sessionId: string|null, candidates: SessionCandidate[] }}
 */
export function resolveImplicitSessionSelection(input = {}) {
    const command = String(input.command || '');
    if (input.session || !IMPLICIT_SESSION_COMMANDS.has(command)) {
        return { action: 'explicit', sessionId: input.session ? String(input.session) : null, candidates: [] };
    }
    const vendor = normalizeWebAiVendor(input.vendor);
    const candidates = activeProviderSessionCandidates(vendor);
    if (candidates.length === 0) return { action: 'none', sessionId: null, candidates };
    if (candidates.length === 1) {
        return { action: 'auto-bind', sessionId: candidates[0].sessionId, candidates };
    }
    throw ambiguousSessionTargetError({
        command,
        vendor,
        port: Number(input.port || 9222),
        candidates,
    });
}

/**
 * @param {{ command: string, vendor: string, port: number, candidates: SessionCandidate[] }} input
 * @returns {WebAiError}
 */
export function ambiguousSessionTargetError(input) {
    const summary = input.candidates
        .map((candidate) => `${candidate.sessionId}${candidate.targetId ? ` target=${candidate.targetId}` : ''}`)
        .join(', ');
    return new WebAiError({
        errorCode: 'session.target-ambiguous',
        stage: 'target-resolution',
        vendor: input.vendor,
        retryHint: 'pass-session',
        message: `multiple active ${input.vendor} web-ai sessions on CDP port ${input.port}; pass --session <id>. candidates: ${summary}`,
        mutationAllowed: false,
        evidence: {
            command: input.command,
            vendor: input.vendor,
            port: input.port,
            candidates: input.candidates,
        },
    });
}

/**
 * @param {string} vendor
 * @param {string} sessionId
 * @returns {string}
 */
export function sessionPollRecoveryCommand(vendor, sessionId) {
    return `agbrowse web-ai poll --vendor ${normalizeWebAiVendor(vendor)} --session ${sessionId} --navigate --json`;
}

/**
 * @param {{
 *   vendor: string,
 *   session: any,
 *   actualTargetId: string,
 *   port?: number,
 *   url?: string,
 *   baseline?: any,
 * }} input
 * @returns {Record<string, any>}
 */
export function buildTargetMismatchResult(input) {
    const expectedTargetId = input.session?.targetId || null;
    const actualTargetId = input.actualTargetId || null;
    const port = Number(input.port || 9222);
    const sessionId = String(input.session?.sessionId || '');
    const recovery = sessionPollRecoveryCommand(input.vendor, sessionId);
    const targetMismatch = {
        expectedTargetId,
        actualTargetId,
        port,
        sessionId,
        vendor: input.vendor,
        recovery,
    };
    return {
        ok: false,
        vendor: input.vendor,
        status: 'target-mismatch',
        url: input.url || input.session?.conversationUrl || input.session?.originalUrl || '',
        sessionId,
        answerText: '',
        baseline: input.baseline,
        usedFallbacks: [],
        expectedTargetId,
        actualTargetId,
        port,
        targetMismatch,
        recovery,
        warnings: [`poll target changed: ${expectedTargetId || 'unknown'} -> ${actualTargetId || 'unknown'}`],
        error: 'target changed during poll',
    };
}
