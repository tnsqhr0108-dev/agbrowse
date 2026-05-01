import { describe, expect, it, beforeEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { acquireProfileLock, releaseProfileLock, readProfileLock, isStaleLock, updateHeartbeat, updateLockPid, isPidAlive } from '../../skills/browser/profile-lock.mjs';

const TEST_HOME = join(tmpdir(), `agbrowse-lock-test-${process.pid}`);
const DEAD_PID = 2147483647;

beforeEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
    mkdirSync(TEST_HOME, { recursive: true });
});

describe('profile-lock', () => {
    it('acquireProfileLock succeeds on clean home', () => {
        const lock = acquireProfileLock(TEST_HOME);
        expect(lock.pid).toBe(process.pid);
        expect(lock.token).toBeTruthy();
        expect(lock.acquiredAt).toBeTruthy();
        expect(lock.path).toContain('profile.lock');
        expect(existsSync(join(TEST_HOME, 'profile.lock'))).toBe(true);
    });

    it('second acquire within stale window throws', () => {
        acquireProfileLock(TEST_HOME);
        expect(() => acquireProfileLock(TEST_HOME)).toThrow(/profile\.lock held by pid/);
    });

    it('releaseProfileLock with correct token removes the lock file', () => {
        const lock = acquireProfileLock(TEST_HOME);
        releaseProfileLock(TEST_HOME, lock.token);
        expect(existsSync(join(TEST_HOME, 'profile.lock'))).toBe(false);
    });

    it('releaseProfileLock with wrong token does not remove lock', () => {
        acquireProfileLock(TEST_HOME);
        releaseProfileLock(TEST_HOME, 'wrong-token');
        expect(existsSync(join(TEST_HOME, 'profile.lock'))).toBe(true);
    });

    it('releaseProfileLock without token uses pid check', () => {
        acquireProfileLock(TEST_HOME);
        releaseProfileLock(TEST_HOME);
        expect(existsSync(join(TEST_HOME, 'profile.lock'))).toBe(false);
    });

    it('releaseProfileLock without token skips foreign pid lock', () => {
        acquireProfileLock(TEST_HOME);
        const data = readProfileLock(TEST_HOME);
        data.pid = DEAD_PID;
        writeFileSync(join(TEST_HOME, 'profile.lock'), JSON.stringify(data));
        releaseProfileLock(TEST_HOME);
        expect(existsSync(join(TEST_HOME, 'profile.lock'))).toBe(true);
    });

    it('readProfileLock returns null when no lock exists', () => {
        expect(readProfileLock(TEST_HOME)).toBeNull();
    });

    it('readProfileLock returns lock data after acquire', () => {
        acquireProfileLock(TEST_HOME);
        const lock = readProfileLock(TEST_HOME);
        expect(lock.pid).toBe(process.pid);
        expect(lock.token).toBeTruthy();
        expect(lock.heartbeatAt).toBeTruthy();
    });

    it('readProfileLock returns null for malformed JSON', () => {
        writeFileSync(join(TEST_HOME, 'profile.lock'), '{{not json');
        expect(readProfileLock(TEST_HOME)).toBeNull();
    });

    it('isStaleLock returns true for null', () => {
        expect(isStaleLock(null)).toBe(true);
    });

    it('isStaleLock returns false for fresh lock with alive pid', () => {
        const lock = { pid: process.pid, acquiredAt: new Date().toISOString(), heartbeatAt: new Date().toISOString() };
        expect(isStaleLock(lock)).toBe(false);
    });

    it('isStaleLock returns true when pid is dead', () => {
        const lock = { pid: DEAD_PID, acquiredAt: new Date().toISOString(), heartbeatAt: new Date().toISOString() };
        expect(isStaleLock(lock)).toBe(true);
    });

    it('isStaleLock returns false for alive pid even with old timestamp', () => {
        const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        expect(isStaleLock({ pid: process.pid, acquiredAt: old, heartbeatAt: old })).toBe(false);
    });

    it('isStaleLock returns true for old lock without pid', () => {
        const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        expect(isStaleLock({ acquiredAt: old, heartbeatAt: old })).toBe(true);
    });

    it('isStaleLock returns true for NaN timestamp without pid', () => {
        expect(isStaleLock({ acquiredAt: 'not-a-date', heartbeatAt: 'garbage' })).toBe(true);
    });

    it('stale lock (dead pid) is reclaimed on acquire', () => {
        const staleLock = { pid: DEAD_PID, token: 'old', acquiredAt: new Date().toISOString(), heartbeatAt: new Date().toISOString() };
        writeFileSync(join(TEST_HOME, 'profile.lock'), JSON.stringify(staleLock));
        const newLock = acquireProfileLock(TEST_HOME);
        expect(newLock.pid).toBe(process.pid);
        expect(newLock.token).not.toBe('old');
    });

    it('updateHeartbeat refreshes the heartbeatAt field', () => {
        acquireProfileLock(TEST_HOME);
        const before = readProfileLock(TEST_HOME).heartbeatAt;
        updateHeartbeat(TEST_HOME);
        const after = readProfileLock(TEST_HOME).heartbeatAt;
        expect(Date.parse(after)).toBeGreaterThanOrEqual(Date.parse(before));
    });

    it('updateHeartbeat with wrong token does nothing', () => {
        acquireProfileLock(TEST_HOME);
        const before = readProfileLock(TEST_HOME).heartbeatAt;
        updateHeartbeat(TEST_HOME, 'wrong-token');
        const after = readProfileLock(TEST_HOME).heartbeatAt;
        expect(after).toBe(before);
    });

    it('updateLockPid changes the pid in the lock', () => {
        const lock = acquireProfileLock(TEST_HOME);
        updateLockPid(TEST_HOME, lock.token, 12345);
        const updated = readProfileLock(TEST_HOME);
        expect(updated.pid).toBe(12345);
        expect(updated.token).toBe(lock.token);
    });

    it('updateLockPid with wrong token does nothing', () => {
        const lock = acquireProfileLock(TEST_HOME);
        updateLockPid(TEST_HOME, 'bad-token', 99999);
        const unchanged = readProfileLock(TEST_HOME);
        expect(unchanged.pid).toBe(process.pid);
    });

    it('isPidAlive returns true for current process', () => {
        expect(isPidAlive(process.pid)).toBe(true);
    });

    it('isPidAlive returns false for dead pid', () => {
        expect(isPidAlive(DEAD_PID)).toBe(false);
    });

    it('isPidAlive returns false for null/undefined', () => {
        expect(isPidAlive(null)).toBe(false);
        expect(isPidAlive(undefined)).toBe(false);
    });
});
