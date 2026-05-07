import { describe, expect, it } from 'vitest';
import { KeyedMutex } from '../../skills/browser/keyed-mutex.mjs';

describe('KeyedMutex', () => {
    it('runs a single task immediately', async () => {
        const mutex = new KeyedMutex();
        const result = await mutex.runExclusive('tab-1', async () => 42);
        expect(result).toBe(42);
        expect(mutex.size).toBe(0);
    });

    it('serializes concurrent tasks on the same key', async () => {
        const mutex = new KeyedMutex();
        const order = [];
        const task = (id, ms) => mutex.runExclusive('tab-1', async () => {
            order.push(`start-${id}`);
            await new Promise(r => setTimeout(r, ms));
            order.push(`end-${id}`);
            return id;
        });
        const [a, b, c] = await Promise.all([task('a', 30), task('b', 10), task('c', 10)]);
        expect(a).toBe('a');
        expect(b).toBe('b');
        expect(c).toBe('c');
        expect(order).toEqual(['start-a', 'end-a', 'start-b', 'end-b', 'start-c', 'end-c']);
    });

    it('allows parallel execution on different keys', async () => {
        const mutex = new KeyedMutex();
        const order = [];
        const task = (key, id, ms) => mutex.runExclusive(key, async () => {
            order.push(`start-${id}`);
            await new Promise(r => setTimeout(r, ms));
            order.push(`end-${id}`);
        });
        await Promise.all([task('tab-1', 'a', 30), task('tab-2', 'b', 10)]);
        expect(order.indexOf('start-a')).toBeLessThan(order.indexOf('end-b'));
        expect(order.indexOf('start-b')).toBeLessThan(order.indexOf('end-a'));
    });

    it('cleans up entry when all waiters finish', async () => {
        const mutex = new KeyedMutex();
        await mutex.runExclusive('tab-1', async () => 'done');
        expect(mutex.size).toBe(0);
    });

    it('propagates errors without blocking subsequent tasks', async () => {
        const mutex = new KeyedMutex();
        const failing = mutex.runExclusive('tab-1', async () => { throw new Error('boom'); });
        const succeeding = mutex.runExclusive('tab-1', async () => 'ok');
        await expect(failing).rejects.toThrow('boom');
        expect(await succeeding).toBe('ok');
        expect(mutex.size).toBe(0);
    });
});
