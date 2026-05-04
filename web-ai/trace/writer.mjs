import fs from 'node:fs/promises';
import path from 'node:path';
import { createTraceRecord } from './types.mjs';
import { redactTraceValue } from './redact.mjs';

export async function appendTraceRecord(traceDir, record) {
    if (!traceDir) return null;
    const absoluteDir = path.resolve(traceDir);
    await fs.mkdir(absoluteDir, { recursive: true });
    const traceId = record.traceId || createTraceRecord(record).traceId;
    const filePath = path.join(absoluteDir, `${traceId}.jsonl`);
    const line = `${JSON.stringify(redactTraceValue(record))}\n`;
    // JSONL traces are append-only. A single append call keeps each record
    // intact without temp-file rename semantics that would drop prior records.
    await fs.appendFile(filePath, line);
    return filePath;
}

export async function writeCommandTrace(traceDir, {
    traceId,
    command,
    provider,
    modelAlias,
    sessionId,
    targetId,
    url,
    status,
    errorEnvelope,
    evidence = {},
    steps = [],
    artifacts = [],
} = {}) {
    if (!traceDir) return null;
    const record = createTraceRecord({
        traceId,
        command,
        provider,
        modelAlias,
        sessionId,
        targetId,
        url,
        evidence,
        steps: [
            ...steps,
            { type: 'command-result', status, at: new Date().toISOString() },
        ],
        artifacts,
        errorEnvelope,
    });
    return appendTraceRecord(traceDir, record);
}
