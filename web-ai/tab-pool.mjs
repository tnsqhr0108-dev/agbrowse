/**
 * Tab Pool — Reuse unbound vendor tabs instead of creating new ones.
 * Tracks tabs that recently completed a session and are still alive.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { isTabAlive } from '../skills/browser/tab-manager.mjs';

const POOL = new Map(); // vendor -> [{ targetId, url, pooledAt }]
const POOL_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
const POOL_MAX_SIZE = 3; // max pooled tabs per vendor
const DATA_DIR = process.env.BROWSER_AGENT_HOME || join(homedir(), '.browser-agent');
const POOL_FILE = join(DATA_DIR, 'web-ai-tab-pool.json');
let loaded = false;

function loadPool() {
    if (loaded) return;
    loaded = true;
    if (!existsSync(POOL_FILE)) return;
    try {
        const parsed = JSON.parse(readFileSync(POOL_FILE, 'utf8'));
        for (const [vendor, list] of Object.entries(parsed.pool || {})) {
            if (Array.isArray(list)) POOL.set(vendor, list.filter(entry => entry?.targetId));
        }
    } catch {
        POOL.clear();
    }
}

function savePool() {
    mkdirSync(dirname(POOL_FILE), { recursive: true });
    writeFileSync(POOL_FILE, `${JSON.stringify({ pool: Object.fromEntries(POOL.entries()) }, null, 2)}\n`);
}

/**
 * Add a tab to the pool when its session completes.
 * @param {string} vendor
 * @param {string} targetId
 * @param {string} url
 */
export function poolTab(vendor, targetId, url) {
    loadPool();
    if (!vendor || !targetId) return;
    const list = POOL.get(vendor) || [];
    // Remove duplicates
    const filtered = list.filter(t => t.targetId !== targetId);
    filtered.push({ targetId, url, pooledAt: Date.now() });
    // Enforce max size (FIFO)
    while (filtered.length > POOL_MAX_SIZE) filtered.shift();
    POOL.set(vendor, filtered);
    savePool();
}

/**
 * Try to get a reusable tab from the pool.
 * @param {number} port
 * @param {string} vendor
 * @returns {Promise<{targetId, url}|null>}
 */
export async function getPooledTab(port, vendor) {
    loadPool();
    const list = POOL.get(vendor);
    if (!list || list.length === 0) return null;

    const now = Date.now();
    // Find first alive tab that's not too old
    for (const entry of list) {
        if (now - entry.pooledAt > POOL_MAX_AGE_MS) continue;
        const alive = await isTabAlive(port, entry.targetId);
        if (alive) {
            const survivors = list.filter(t => t.targetId !== entry.targetId && now - t.pooledAt <= POOL_MAX_AGE_MS);
            if (survivors.length > 0) POOL.set(vendor, survivors);
            else POOL.delete(vendor);
            savePool();
            return { targetId: entry.targetId, url: entry.url };
        }
    }

    // All stale or dead — clear this vendor's pool
    POOL.delete(vendor);
    savePool();
    return null;
}

/**
 * Remove a tab from the pool (e.g. when it is explicitly closed).
 * @param {string} vendor
 * @param {string} targetId
 */
export function unpoolTab(vendor, targetId) {
    loadPool();
    const list = POOL.get(vendor);
    if (!list) return;
    POOL.set(vendor, list.filter(t => t.targetId !== targetId));
    if (POOL.get(vendor).length === 0) POOL.delete(vendor);
    savePool();
}

/**
 * Get pool stats for diagnostics.
 * @returns {Object}
 */
export function getPoolStats() {
    loadPool();
    const stats = {};
    for (const [vendor, list] of POOL) {
        stats[vendor] = list.length;
    }
    return stats;
}
