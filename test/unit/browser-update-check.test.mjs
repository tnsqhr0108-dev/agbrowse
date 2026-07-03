import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
    compareSemver,
    getUpdateNoticeLines,
    parseDurationMs,
    shouldSkipUpdateNotice,
} from '../../skills/browser/update-check.mjs';

const tmpDirs = [];

function makeTempRoot(version = '0.1.15') {
    const root = mkdtempSync(join(tmpdir(), 'agbrowse-update-root-'));
    const dataDir = mkdtempSync(join(tmpdir(), 'agbrowse-update-data-'));
    tmpDirs.push(root, dataDir);
    writeFileSync(join(root, 'package.json'), `${JSON.stringify({ version }, null, 2)}\n`, 'utf8');
    return { root, dataDir };
}

afterEach(() => {
    for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('browser update notice', () => {
    it('parses duration strings for update-check TTLs', () => {
        expect(parseDurationMs('24h')).toBe(24 * 60 * 60 * 1000);
        expect(parseDurationMs('30m')).toBe(30 * 60 * 1000);
        expect(parseDurationMs('2s')).toBe(2000);
        expect(parseDurationMs('250ms')).toBe(250);
        expect(parseDurationMs('500')).toBe(500);
        expect(parseDurationMs('bad', 123)).toBe(123);
    });

    it('compares semver strings without adding dependencies', () => {
        expect(compareSemver('0.1.16', '0.1.15')).toBe(1);
        expect(compareSemver('0.1.15', '0.1.15')).toBe(0);
        expect(compareSemver('0.1.14', '0.1.15')).toBe(-1);
        expect(compareSemver('v0.1.16-preview.1', '0.1.15')).toBe(1);
        expect(compareSemver('bad', '0.1.15')).toBeNull();
    });

    it('skips JSON, MCP, CI, help, and non-command surfaces', () => {
        expect(shouldSkipUpdateNotice({ argv: ['tabs', '--json'], env: {} })).toBe(true);
        expect(shouldSkipUpdateNotice({ argv: ['status'], env: { AGBROWSE_JSON_ERRORS: '1' } })).toBe(true);
        expect(shouldSkipUpdateNotice({ argv: ['web-ai', 'mcp-server'], env: {} })).toBe(true);
        expect(shouldSkipUpdateNotice({ argv: ['status'], env: { CI: 'true' } })).toBe(true);
        expect(shouldSkipUpdateNotice({ argv: ['status'], env: { CI: 'true', AGBROWSE_UPDATE_CHECK: '1' } })).toBe(false);
        expect(shouldSkipUpdateNotice({ argv: ['status', '--help'], env: { AGBROWSE_UPDATE_CHECK: '1' } })).toBe(true);
        expect(shouldSkipUpdateNotice({ argv: [], env: { AGBROWSE_UPDATE_CHECK: '1' } })).toBe(true);
        expect(shouldSkipUpdateNotice({ argv: ['does-not-exist'], env: { AGBROWSE_UPDATE_CHECK: '1' } })).toBe(true);
        expect(shouldSkipUpdateNotice({ argv: ['skills'], env: { AGBROWSE_UPDATE_CHECK: '1' } })).toBe(true);
        expect(shouldSkipUpdateNotice({ argv: ['install-skills'], env: { AGBROWSE_UPDATE_CHECK: '1' } })).toBe(true);
        expect(shouldSkipUpdateNotice({ argv: ['research'], env: { AGBROWSE_UPDATE_CHECK: '1' } })).toBe(true);
        expect(shouldSkipUpdateNotice({ argv: ['status'], env: { AGBROWSE_UPDATE_CHECK: '0' } })).toBe(true);
    });

    it('returns advisory lines when npm latest is newer', async () => {
        const { root, dataDir } = makeTempRoot('0.1.15');
        const lines = await getUpdateNoticeLines({
            argv: ['status'],
            env: { AGBROWSE_UPDATE_CHECK: '1', AGBROWSE_UPDATE_CHECK_LATEST: '0.1.16' },
            dataDir,
            packageRoot: root,
        });
        expect(lines).toEqual([
            '[agbrowse] new version is available: 0.1.15 -> 0.1.16',
            '[agbrowse] npm install -g agbrowse@latest to update',
            '[agbrowse] tell the user before updating this global CLI',
            '[agbrowse] set AGBROWSE_UPDATE_CHECK=0 to hide this notice',
        ]);
    });

    it('stays quiet when the local version is current', async () => {
        const { root, dataDir } = makeTempRoot('0.1.15');
        const lines = await getUpdateNoticeLines({
            argv: ['status'],
            env: { AGBROWSE_UPDATE_CHECK: '1', AGBROWSE_UPDATE_CHECK_LATEST: '0.1.15' },
            dataDir,
            packageRoot: root,
        });
        expect(lines).toEqual([]);
    });

    it('uses cache inside the TTL instead of refetching', async () => {
        const { root, dataDir } = makeTempRoot('0.1.15');
        let calls = 0;
        const fetchImpl = async () => {
            calls += 1;
            return { ok: true, json: async () => ({ version: '0.1.16' }) };
        };
        const first = await getUpdateNoticeLines({
            argv: ['status'],
            env: { AGBROWSE_UPDATE_CHECK: '1', AGBROWSE_UPDATE_CHECK_TTL: '24h' },
            dataDir,
            packageRoot: root,
            now: 1000,
            fetchImpl,
        });
        const second = await getUpdateNoticeLines({
            argv: ['status'],
            env: { AGBROWSE_UPDATE_CHECK: '1', AGBROWSE_UPDATE_CHECK_TTL: '24h' },
            dataDir,
            packageRoot: root,
            now: 2000,
            fetchImpl,
        });
        expect(first.length).toBe(4);
        expect(second.length).toBe(4);
        expect(calls).toBe(1);
    });

    it('refetches when cache is stale', async () => {
        const { root, dataDir } = makeTempRoot('0.1.15');
        let calls = 0;
        const versions = ['0.1.16', '0.1.17'];
        const fetchImpl = async () => {
            const version = versions[calls] || versions.at(-1);
            calls += 1;
            return { ok: true, json: async () => ({ version }) };
        };
        await getUpdateNoticeLines({
            argv: ['status'],
            env: { AGBROWSE_UPDATE_CHECK: '1', AGBROWSE_UPDATE_CHECK_TTL: '1ms' },
            dataDir,
            packageRoot: root,
            now: 1000,
            fetchImpl,
        });
        const second = await getUpdateNoticeLines({
            argv: ['status'],
            env: { AGBROWSE_UPDATE_CHECK: '1', AGBROWSE_UPDATE_CHECK_TTL: '1ms' },
            dataDir,
            packageRoot: root,
            now: 2000,
            fetchImpl,
        });
        expect(second[0]).toContain('0.1.17');
        expect(calls).toBe(2);
    });

    it('swallows registry failures', async () => {
        const { root, dataDir } = makeTempRoot('0.1.15');
        const lines = await getUpdateNoticeLines({
            argv: ['status'],
            env: { AGBROWSE_UPDATE_CHECK: '1' },
            dataDir,
            packageRoot: root,
            fetchImpl: async () => {
                throw new Error('registry down');
            },
        });
        expect(lines).toEqual([]);
    });
});
