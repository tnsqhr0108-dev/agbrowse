import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTraceRecord } from '../../web-ai/trace/types.mjs';
import { appendTraceRecord, writeCommandTrace } from '../../web-ai/trace/writer.mjs';
import { renderTraceReport } from '../../web-ai/trace/report.mjs';

describe('web-ai trace writer/report', () => {
    it('creates parent directories and writes redacted JSONL', async () => {
        const traceDir = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'agbrowse-trace-')), 'nested');
        const record = createTraceRecord({
            traceId: 'trace-test',
            command: 'web-ai query',
            provider: 'chatgpt',
            sessionId: 'session-secret',
            targetId: 'target-secret',
            url: 'https://chatgpt.com/c/abc',
            evidence: {
                prompt: 'raw prompt should be hashed only',
                answerText: 'raw answer should be hashed only',
                pageText: 'raw page should be hashed only',
            },
            errorEnvelope: {
                message: 'alice@example.com',
                prompt: 'do not keep',
                evidence: { pageText: 'raw page evidence should not keep' },
            },
        });
        const tracePath = await appendTraceRecord(traceDir, record);
        const raw = await fs.readFile(tracePath, 'utf8');
        const parsed = JSON.parse(raw.trim());
        expect(raw).toContain('[redacted-email]');
        expect(raw).not.toContain('do not keep');
        expect(raw).not.toContain('raw page evidence should not keep');
        expect(raw).not.toContain('raw prompt should be hashed only');
        expect(raw).not.toContain('raw answer should be hashed only');
        expect(raw).not.toContain('raw page should be hashed only');
        expect(raw).toContain('sessionIdHash');
        expect(parsed.evidenceHashes.promptHash).toMatch(/^sha256:/);
        expect(parsed.evidenceHashes.answerTextHash).toMatch(/^sha256:/);
        expect(parsed.evidenceHashes.pageTextHash).toMatch(/^sha256:/);
    });

    it('renders deterministic offline report', async () => {
        const traceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agbrowse-trace-report-'));
        const tracePath = await writeCommandTrace(traceDir, {
            traceId: 'trace-report',
            command: 'web-ai eval',
            provider: 'chatgpt',
            status: 'fail',
            errorEnvelope: { errorCode: 'eval.target-resolution-failed' },
        });
        const report = await renderTraceReport(tracePath);
        expect(report).toContain('# agbrowse trace report');
        expect(report).toContain('eval.target-resolution-failed');
    });
});
