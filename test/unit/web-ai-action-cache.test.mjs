import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
    cacheKey,
    loadActionCache,
    saveActionCache,
    getCachedTarget,
    updateCacheEntry,
    createActionCacheHandle,
} from '../../web-ai/action-cache.mjs';

describe('web-ai action-cache', () => {
    let tempDir;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'action-cache-test-'));
    });

    afterEach(() => {
        try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    describe('cacheKey', () => {
        it('builds deterministic composite key', () => {
            const key = cacheKey({ provider: 'chatgpt', urlHost: 'chatgpt.com', intent: 'composer.fill', actionKind: 'fill', domHashPrefix: 'abc', axHashPrefix: 'def' });
            expect(key).toBe('v1|chatgpt|chatgpt.com|composer.fill|fill|abc|def');
        });

        it('uses wildcards for missing parts', () => {
            const key = cacheKey({ provider: 'chatgpt' });
            expect(key).toBe('v1|chatgpt|*|*|*|*|*');
        });
    });

    describe('loadActionCache', () => {
        it('returns empty cache when file does not exist', () => {
            const cache = loadActionCache(tempDir);
            expect(cache.schemaVersion).toBe(1);
            expect(Object.keys(cache.entries)).toHaveLength(0);
        });

        it('loads existing cache file', () => {
            const existing = {
                schemaVersion: 1,
                entries: {
                    'v1|chatgpt|*|composer.fill|*|*|*': {
                        target: { selector: '#composer' },
                        stats: { hitCount: 5, lastValidatedAt: new Date().toISOString() },
                    },
                },
            };
            saveActionCache(existing, tempDir);
            const cache = loadActionCache(tempDir);
            expect(Object.keys(cache.entries)).toHaveLength(1);
        });

        it('prunes entries older than 30 days', () => {
            const staleDate = new Date(Date.now() - 31 * 86_400_000).toISOString();
            const existing = {
                schemaVersion: 1,
                entries: {
                    'old': {
                        target: { selector: '#old' },
                        stats: { hitCount: 1, lastValidatedAt: staleDate },
                    },
                    'fresh': {
                        target: { selector: '#fresh' },
                        stats: { hitCount: 1, lastValidatedAt: new Date().toISOString() },
                    },
                },
            };
            saveActionCache(existing, tempDir);
            const cache = loadActionCache(tempDir);
            expect(Object.keys(cache.entries)).toHaveLength(1);
            expect(cache.entries.fresh).toBeDefined();
        });

        it('resets cache on schema version mismatch', () => {
            const existing = { schemaVersion: 999, entries: { a: { target: {} } } };
            saveActionCache(existing, tempDir);
            const cache = loadActionCache(tempDir);
            expect(Object.keys(cache.entries)).toHaveLength(0);
        });
    });

    describe('getCachedTarget', () => {
        it('returns matching entry', () => {
            const cache = {
                entries: {
                    'v1|chatgpt|chatgpt.com|composer.fill|fill|abc|def': {
                        target: { selector: '#composer' },
                    },
                },
            };
            const result = getCachedTarget(cache, {
                provider: 'chatgpt',
                urlHost: 'chatgpt.com',
                intent: 'composer.fill',
                actionKind: 'fill',
                fingerprint: { domHashPrefix: 'abc', axHashPrefix: 'def' },
            });
            expect(result.target.selector).toBe('#composer');
        });

        it('returns null on miss', () => {
            const cache = { entries: {} };
            const result = getCachedTarget(cache, { provider: 'chatgpt', intent: 'missing' });
            expect(result).toBeNull();
        });
    });

    describe('updateCacheEntry', () => {
        it('writes new entry with correct structure', () => {
            const cache = { entries: {} };
            updateCacheEntry(cache, {
                provider: 'chatgpt',
                intent: 'composer.fill',
                actionKind: 'fill',
                urlHost: 'chatgpt.com',
            }, { selector: '#composer', role: 'textbox', name: 'Message ChatGPT' }, { domHashPrefix: 'abc' });

            const key = 'v1|chatgpt|chatgpt.com|composer.fill|fill|abc|*';
            expect(cache.entries[key]).toBeDefined();
            expect(cache.entries[key].target.selector).toBe('#composer');
            expect(cache.entries[key].target.role).toBe('textbox');
            expect(cache.entries[key].stats.hitCount).toBe(1);
            expect(cache.entries[key].stats.lastValidatedAt).toBeDefined();
        });

        it('increments hitCount on existing entry', () => {
            const cache = { entries: {} };
            const ctx = { provider: 'chatgpt', intent: 'composer.fill', actionKind: 'fill' };
            updateCacheEntry(cache, ctx, { selector: '#composer' });
            updateCacheEntry(cache, ctx, { selector: '#composer' });

            const key = 'v1|chatgpt|*|composer.fill|fill|*|*';
            expect(cache.entries[key].stats.hitCount).toBe(2);
        });

        it('ignores entries without selector', () => {
            const cache = { entries: {} };
            updateCacheEntry(cache, { provider: 'chatgpt' }, { role: 'button' });
            expect(Object.keys(cache.entries)).toHaveLength(0);
        });
    });

    describe('createActionCacheHandle', () => {
        it('get returns matching entry', () => {
            const handle = createActionCacheHandle(tempDir);
            handle.update({ provider: 'chatgpt', intent: 'test' }, { selector: '#btn' });
            const result = handle.get({ provider: 'chatgpt', intent: 'test' });
            expect(result.target.selector).toBe('#btn');
        });

        it('save writes valid JSON atomically', () => {
            const handle = createActionCacheHandle(tempDir);
            handle.update({ provider: 'chatgpt', intent: 'test' }, { selector: '#btn' });
            handle.save();

            const path = join(tempDir, 'action-cache.json');
            expect(existsSync(path)).toBe(true);
            const raw = JSON.parse(readFileSync(path, 'utf8'));
            expect(raw.schemaVersion).toBe(1);
            expect(Object.keys(raw.entries)).toHaveLength(1);
        });

        it('raw returns internal cache object', () => {
            const handle = createActionCacheHandle(tempDir);
            expect(handle.raw().schemaVersion).toBe(1);
        });
    });
});
