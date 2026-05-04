import crypto from 'node:crypto';

export const TRACE_VERSION = 1;

export function createTraceId(seed = `${Date.now()}:${Math.random()}`) {
    return crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, 16);
}

export function hashTraceValue(value) {
    if (!value) return null;
    return `sha256:${crypto.createHash('sha256').update(String(value)).digest('hex')}`;
}

export function createTraceRecord({
    traceId = createTraceId(),
    command = 'web-ai',
    provider = null,
    modelAlias = null,
    sessionId = null,
    targetId = null,
    url = null,
    steps = [],
    artifacts = [],
    evidence = {},
    sourceAudit = null,
    errorEnvelope = null,
    gitCommit = null,
    agbrowseVersion = null,
} = {}) {
    return {
        traceVersion: TRACE_VERSION,
        traceId,
        gitCommit,
        agbrowseVersion,
        command,
        provider,
        modelAlias,
        sessionIdHash: hashTraceValue(sessionId),
        targetIdHash: hashTraceValue(targetId),
        urlOrigin: originOf(url),
        evidenceHashes: createEvidenceHashes({
            sessionId,
            targetId,
            url,
            steps,
            artifacts,
            errorEnvelope,
            ...evidence,
        }),
        viewport: null,
        steps,
        artifacts,
        sourceAudit,
        errorEnvelope,
        capturedAt: new Date().toISOString(),
    };
}

export function createEvidenceHashes(evidence = {}) {
    const out = {};
    for (const [key, value] of Object.entries(evidence)) {
        if (value === null || value === undefined || value === '') continue;
        out[`${key}Hash`] = hashTraceValue(typeof value === 'string' ? value : JSON.stringify(value));
    }
    return out;
}

export function originOf(url) {
    try {
        return url ? new URL(url).origin : null;
    } catch {
        return null;
    }
}
