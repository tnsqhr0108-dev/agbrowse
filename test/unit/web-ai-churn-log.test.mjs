import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readChurnLog, appendChurnRecord, compactChurnLog, maybeRecordChurn, churnLogPath } from '../../web-ai/churn-log.mjs';

const TEST_HOME = join(tmpdir(), `agbrowse-churn-test-${process.pid}`);

beforeEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
    mkdirSync(TEST_HOME, { recursive: true });
});

describe('churn-log', () => {
    it('readChurnLog returns empty array on missing file', () => {
        expect(readChurnLog(TEST_HOME)).toEqual([]);
    });

    it('appendChurnRecord persists and reads back', () => {
        const record = { key: 'chatgpt:composer', domHash: 'sha256:abc', capturedAt: '2026-05-01T00:00:00Z' };
        appendChurnRecord(record, TEST_HOME);
        const records = readChurnLog(TEST_HOME);
        expect(records).toHaveLength(1);
        expect(records[0].key).toBe('chatgpt:composer');
    });

    it('compactChurnLog keeps newest N records', () => {
        for (let i = 0; i < 10; i += 1) {
            appendChurnRecord({ key: `k${i}`, domHash: `h${i}` }, TEST_HOME);
        }
        expect(readChurnLog(TEST_HOME)).toHaveLength(10);
        const kept = compactChurnLog(TEST_HOME, 3);
        expect(kept).toBe(3);
        const records = readChurnLog(TEST_HOME);
        expect(records).toHaveLength(3);
        expect(records[0].key).toBe('k7');
    });

    it('maybeRecordChurn only records when AGBROWSE_CHURN_LOG=1', () => {
        const original = process.env.AGBROWSE_CHURN_LOG;
        try {
            delete process.env.AGBROWSE_CHURN_LOG;
            const report = { vendor: 'chatgpt', features: [{ feature: 'composer', domHash: 'sha256:abc', state: 'ok' }] };
            const result = maybeRecordChurn(report, TEST_HOME);
            expect(result).toEqual([]);
            expect(readChurnLog(TEST_HOME)).toEqual([]);
        } finally {
            if (original !== undefined) process.env.AGBROWSE_CHURN_LOG = original;
        }
    });

    it('maybeRecordChurn records changed hashes when enabled', () => {
        const original = process.env.AGBROWSE_CHURN_LOG;
        try {
            process.env.AGBROWSE_CHURN_LOG = '1';
            const report = {
                vendor: 'chatgpt',
                capturedAt: '2026-05-01T00:00:00Z',
                features: [
                    { feature: 'composer', domHash: 'sha256:aaa', state: 'ok' },
                    { feature: 'upload', domHash: 'sha256:bbb', state: 'ok' },
                ],
            };
            const first = maybeRecordChurn(report, TEST_HOME);
            expect(first).toHaveLength(2);

            const same = maybeRecordChurn(report, TEST_HOME);
            expect(same).toHaveLength(0);

            report.features[0].domHash = 'sha256:ccc';
            const changed = maybeRecordChurn(report, TEST_HOME);
            expect(changed).toHaveLength(1);
            expect(changed[0].feature).toBe('composer');
            expect(changed[0].previousHash).toBe('sha256:aaa');
        } finally {
            if (original !== undefined) process.env.AGBROWSE_CHURN_LOG = original;
            else delete process.env.AGBROWSE_CHURN_LOG;
        }
    });

    it('maybeRecordChurn skips features with null domHash', () => {
        const original = process.env.AGBROWSE_CHURN_LOG;
        try {
            process.env.AGBROWSE_CHURN_LOG = '1';
            const report = {
                vendor: 'chatgpt',
                features: [{ feature: 'upload', domHash: null, state: 'fail' }],
            };
            expect(maybeRecordChurn(report, TEST_HOME)).toHaveLength(0);
        } finally {
            if (original !== undefined) process.env.AGBROWSE_CHURN_LOG = original;
            else delete process.env.AGBROWSE_CHURN_LOG;
        }
    });

    it('readChurnLog skips malformed lines and preserves valid ones', () => {
        const path = churnLogPath(TEST_HOME);
        writeFileSync(path, '{"key":"a","domHash":"h1"}\n{{bad json\n{"key":"b","domHash":"h2"}\n');
        const records = readChurnLog(TEST_HOME);
        expect(records).toHaveLength(2);
        expect(records[0].key).toBe('a');
        expect(records[1].key).toBe('b');
    });

    it('compactChurnLog at limit=1 keeps only the last record', () => {
        for (let i = 0; i < 5; i += 1) {
            appendChurnRecord({ key: `k${i}`, domHash: `h${i}` }, TEST_HOME);
        }
        const kept = compactChurnLog(TEST_HOME, 1);
        expect(kept).toBe(1);
        const records = readChurnLog(TEST_HOME);
        expect(records).toHaveLength(1);
        expect(records[0].key).toBe('k4');
    });

    it('compactChurnLog returns count when under limit', () => {
        appendChurnRecord({ key: 'k0', domHash: 'h0' }, TEST_HOME);
        const kept = compactChurnLog(TEST_HOME, 100);
        expect(kept).toBe(1);
    });

    it('maybeRecordChurn triggers compaction after writes', () => {
        const original = process.env.AGBROWSE_CHURN_LOG;
        try {
            process.env.AGBROWSE_CHURN_LOG = '1';
            for (let i = 0; i < 3; i += 1) {
                appendChurnRecord({ key: `seed:${i}`, domHash: `h${i}` }, TEST_HOME);
            }
            const report = {
                vendor: 'chatgpt',
                features: [{ feature: 'composer', domHash: 'sha256:new', state: 'ok' }],
            };
            maybeRecordChurn(report, TEST_HOME);
            const records = readChurnLog(TEST_HOME);
            expect(records.length).toBeGreaterThanOrEqual(1);
            expect(records.some(r => r.domHash === 'sha256:new')).toBe(true);
        } finally {
            if (original !== undefined) process.env.AGBROWSE_CHURN_LOG = original;
            else delete process.env.AGBROWSE_CHURN_LOG;
        }
    });
});
