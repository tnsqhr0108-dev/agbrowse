import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_HOME = process.env.BROWSER_AGENT_HOME || join(homedir(), '.browser-agent');
const LOG_NAME = 'churn-log.jsonl';
const DEFAULT_COMPACT_LIMIT = 500;

export function churnLogPath(homeDir = DEFAULT_HOME) {
    return join(homeDir, LOG_NAME);
}

export function readChurnLog(homeDir = DEFAULT_HOME) {
    const path = churnLogPath(homeDir);
    if (!existsSync(path)) return [];
    try {
        return readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
    } catch { return []; }
}

export function appendChurnRecord(record, homeDir = DEFAULT_HOME) {
    const path = churnLogPath(homeDir);
    mkdirSync(homeDir, { recursive: true });
    appendFileSync(path, `${JSON.stringify(record)}\n`);
}

export function compactChurnLog(homeDir = DEFAULT_HOME, limit = DEFAULT_COMPACT_LIMIT) {
    const records = readChurnLog(homeDir);
    if (records.length <= limit) return records.length;
    const kept = records.slice(-limit);
    const path = churnLogPath(homeDir);
    writeFileSync(path, kept.map(r => JSON.stringify(r)).join('\n') + '\n');
    return kept.length;
}

export function maybeRecordChurn(report, homeDir = DEFAULT_HOME) {
    if (process.env.AGBROWSE_CHURN_LOG !== '1') return [];
    const prior = readChurnLog(homeDir);
    const records = changedFeatureRecords(report, prior);
    for (const record of records) appendChurnRecord(record, homeDir);
    return records;
}

function changedFeatureRecords(report, priorRecords) {
    if (!report?.features?.length) return [];
    const changed = [];
    for (const f of report.features) {
        if (!f.domHash) continue;
        const key = `${report.vendor}:${f.feature}`;
        const last = findLastByKey(priorRecords, key);
        if (last && last.domHash === f.domHash) continue;
        changed.push({
            key,
            vendor: report.vendor,
            feature: f.feature,
            domHash: f.domHash,
            previousHash: last?.domHash || null,
            state: f.state,
            capturedAt: report.capturedAt || new Date().toISOString(),
        });
    }
    return changed;
}

function findLastByKey(records, key) {
    for (let i = records.length - 1; i >= 0; i -= 1) {
        if (records[i].key === key) return records[i];
    }
    return null;
}
