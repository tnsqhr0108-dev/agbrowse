import { existsSync, mkdirSync, openSync, closeSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_HOME = process.env.BROWSER_AGENT_HOME || join(homedir(), '.browser-agent');
const LOCK_NAME = 'profile.lock';
const STALE_AFTER_MS = 5 * 60 * 1000;

export function acquireProfileLock(homeDir = DEFAULT_HOME) {
    const lockPath = join(homeDir, LOCK_NAME);
    mkdirSync(homeDir, { recursive: true });
    if (existsSync(lockPath)) {
        const prior = readProfileLock(homeDir);
        if (prior && !isStaleLock(prior)) {
            throw new Error(
                `profile.lock held by pid ${prior.pid} since ${prior.acquiredAt}. ` +
                `Another agbrowse/Chrome instance is using this BROWSER_AGENT_HOME. ` +
                `If the process is dead, delete ${lockPath} manually or wait ${Math.ceil(STALE_AFTER_MS / 1000)}s for stale reclaim.`
            );
        }
        unlinkSync(lockPath);
    }
    const lock = { pid: process.pid, acquiredAt: new Date().toISOString(), heartbeatAt: new Date().toISOString() };
    const fd = openSync(lockPath, 'wx');
    writeFileSync(fd, JSON.stringify(lock, null, 2));
    closeSync(fd);
    return { ...lock, path: lockPath };
}

export function releaseProfileLock(homeDir = DEFAULT_HOME) {
    try { unlinkSync(join(homeDir, LOCK_NAME)); } catch { /* already gone */ }
}

export function readProfileLock(homeDir = DEFAULT_HOME) {
    const lockPath = join(homeDir, LOCK_NAME);
    if (!existsSync(lockPath)) return null;
    try { return JSON.parse(readFileSync(lockPath, 'utf8')); } catch { return null; }
}

export function isStaleLock(lock) {
    if (!lock) return true;
    const ref = lock.heartbeatAt || lock.acquiredAt;
    if (!ref) return true;
    return (Date.now() - Date.parse(ref)) > STALE_AFTER_MS;
}

export function updateHeartbeat(homeDir = DEFAULT_HOME) {
    const lockPath = join(homeDir, LOCK_NAME);
    const lock = readProfileLock(homeDir);
    if (!lock || lock.pid !== process.pid) return;
    lock.heartbeatAt = new Date().toISOString();
    try { writeFileSync(lockPath, JSON.stringify(lock, null, 2)); } catch { /* race safe */ }
}
