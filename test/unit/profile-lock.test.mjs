import { describe, expect, it, beforeEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { acquireProfileLock, releaseProfileLock, readProfileLock, isStaleLock, updateHeartbeat } from '../../skills/browser/profile-lock.mjs';

const TEST_HOME = join(tmpdir(), `agbrowse-lock-test-${process.pid}`);

beforeEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
    mkdirSync(TEST_HOME, { recursive: true });
});

describe('profile-lock', () => {
    it('acquireProfileLock succeeds on clean home', () => {
        const lock = acquireProfileLock(TEST_HOME);
        expect(lock.pid).toBe(process.pid);
        expect(lock.acquiredAt).toBeTruthy();
        expect(lock.path).toContain('profile.lock');
        expect(existsSync(join(TEST_HOME, 'profile.lock'))).toBe(true);
    });

    it('second acquire within stale window throws', () => {
        acquireProfileLock(TEST_HOME);
        expect(() => acquireProfileLock(TEST_HOME)).toThrow(/profile\.lock held by pid/);
    });

    it('releaseProfileLock removes the lock file', () => {
        acquireProfileLock(TEST_HOME);
        releaseProfileLock(TEST_HOME);
        expect(existsSync(join(TEST_HOME, 'profile.lock'))).toBe(false);
    });

    it('readProfileLock returns null when no lock exists', () => {
        expect(readProfileLock(TEST_HOME)).toBeNull();
    });

    it('readProfileLock returns lock data after acquire', () => {
        acquireProfileLock(TEST_HOME);
        const lock = readProfileLock(TEST_HOME);
        expect(lock.pid).toBe(process.pid);
        expect(lock.heartbeatAt).toBeTruthy();
    });

    it('isStaleLock returns true for null', () => {
        expect(isStaleLock(null)).toBe(true);
    });

    it('isStaleLock returns false for fresh lock', () => {
        const lock = { pid: 1, acquiredAt: new Date().toISOString(), heartbeatAt: new Date().toISOString() };
        expect(isStaleLock(lock)).toBe(false);
    });

    it('isStaleLock returns true for old lock', () => {
        const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        expect(isStaleLock({ pid: 1, acquiredAt: old, heartbeatAt: old })).toBe(true);
    });

    it('stale lock is reclaimed on acquire', () => {
        acquireProfileLock(TEST_HOME);
        const lock = readProfileLock(TEST_HOME);
        lock.heartbeatAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        lock.acquiredAt = lock.heartbeatAt;
        releaseProfileLock(TEST_HOME);
        writeFileSync(join(TEST_HOME, 'profile.lock'), JSON.stringify(lock));
        const newLock = acquireProfileLock(TEST_HOME);
        expect(newLock.pid).toBe(process.pid);
    });

    it('updateHeartbeat refreshes the heartbeatAt field', () => {
        acquireProfileLock(TEST_HOME);
        const before = readProfileLock(TEST_HOME).heartbeatAt;
        updateHeartbeat(TEST_HOME);
        const after = readProfileLock(TEST_HOME).heartbeatAt;
        expect(Date.parse(after)).toBeGreaterThanOrEqual(Date.parse(before));
    });
});
