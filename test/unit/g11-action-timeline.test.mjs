// @ts-check
import { describe, it, expect } from 'vitest';
import {
    buildActionTimeline,
    formatActionTimeline,
    ACTION_TIMELINE_SCHEMA_VERSION,
} from '../../web-ai/trace/action-timeline.mjs';

const baseEvents = () => ([
    { traceId: 't1', eventId: 'e1', t: 1000, kind: /** @type {const} */('observe'), command: 'snapshot', outcome: /** @type {const} */('ok'), url: 'https://x.test/' },
    { traceId: 't1', eventId: 'e2', t: 1100, kind: /** @type {const} */('observe'), command: 'observe-actions', target: 'click sign in', outcome: /** @type {const} */('ok') },
    { traceId: 't1', eventId: 'e3', t: 1200, kind: /** @type {const} */('mutate'), command: 'click', target: '@e1', outcome: /** @type {const} */('ok') },
    { traceId: 't1', eventId: 'e4', t: 1300, kind: /** @type {const} */('wait'), command: 'wait-for-selector', target: '.signed-in', outcome: /** @type {const} */('fail'), errorCode: 'wait.timeout' },
]);

describe('G11 — action timeline', () => {
    it('builds a v1 timeline with stats', () => {
        const tl = buildActionTimeline(baseEvents());
        expect(tl.schemaVersion).toBe(ACTION_TIMELINE_SCHEMA_VERSION);
        expect(tl.traceId).toBe('t1');
        expect(tl.events.length).toBe(4);
        expect(tl.stats.eventCount).toBe(4);
        expect(tl.stats.okCount).toBe(3);
        expect(tl.stats.failCount).toBe(1);
        expect(tl.stats.byKind.observe).toBe(2);
        expect(tl.durationMs).toBe(300);
    });

    it('sorts unordered events by t', () => {
        const evs = baseEvents();
        const tl = buildActionTimeline([evs[3], evs[0], evs[2], evs[1]]);
        expect(tl.events.map(e => e.eventId)).toEqual(['e1', 'e2', 'e3', 'e4']);
    });

    it('rejects mixed traceIds', () => {
        const evs = baseEvents();
        evs[2].traceId = 't2';
        expect(() => buildActionTimeline(evs)).toThrow(/traceId/);
    });

    it('rejects empty input', () => {
        expect(() => buildActionTimeline([])).toThrow();
    });

    it('rejects unknown kind/outcome', () => {
        expect(() => buildActionTimeline([{ traceId: 't1', eventId: 'e1', t: 1, kind: /** @type {any} */('bogus'), command: 'x', outcome: 'ok' }])).toThrow();
        expect(() => buildActionTimeline([{ traceId: 't1', eventId: 'e1', t: 1, kind: 'meta', command: 'x', outcome: /** @type {any} */('bogus') }])).toThrow();
    });

    it('formats human-readable output', () => {
        const tl = buildActionTimeline(baseEvents());
        const text = formatActionTimeline(tl);
        expect(text).toMatch(/action-timeline-v1/);
        expect(text).toMatch(/events=4/);
        expect(text).toMatch(/wait-for-selector/);
        expect(text).toMatch(/wait\.timeout/);
    });

    it('lists touched commands sorted', () => {
        const tl = buildActionTimeline(baseEvents());
        expect(tl.stats.commandsTouched).toEqual(['click', 'observe-actions', 'snapshot', 'wait-for-selector']);
    });
});
