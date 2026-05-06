// @ts-check
/**
 * G11 — local action timeline (pure).
 *
 * Aggregates browser command events into one ordered timeline so debug
 * UIs (and our `web-ai/trace/report.mjs` HTML render) can correlate
 * observations, mutations, screenshots, console, and network entries
 * without claiming Browserbase-style cloud replay.
 *
 * Strictly local artifact. No hosted/cloud, no stealth, no external CDP.
 */

/** @typedef {'observe'|'mutate'|'navigate'|'capture'|'wait'|'meta'} TimelineKind */

/**
 * @typedef {Object} ActionTimelineEvent
 * @property {string} traceId
 * @property {string} eventId
 * @property {number} t          monotonic-ish ms timestamp (Date.now or relative)
 * @property {TimelineKind} kind
 * @property {string} command    CLI subcommand or operation name
 * @property {string} [target]   ref / selector / URL the command operated on
 * @property {string} [url]      page URL at the moment of the event
 * @property {'ok'|'fail'|'skip'} outcome
 * @property {string} [errorCode]
 * @property {Object} [evidence] redacted evidence pointers (no payloads)
 * @property {string} [evidence.screenshotPath]
 * @property {string} [evidence.bundleSchemaVersion]
 * @property {number} [evidence.consoleEventCount]
 * @property {number} [evidence.networkEventCount]
 */

/**
 * @typedef {Object} ActionTimelineV1
 * @property {'action-timeline-v1'} schemaVersion
 * @property {string} traceId
 * @property {string} startedAt   ISO timestamp of first event
 * @property {string} endedAt     ISO timestamp of last event
 * @property {number} durationMs  endedAt - startedAt in ms
 * @property {ActionTimelineEvent[]} events
 * @property {Object} stats
 * @property {number} stats.eventCount
 * @property {number} stats.okCount
 * @property {number} stats.failCount
 * @property {Record<string, number>} stats.byKind
 * @property {string[]} stats.commandsTouched
 */

/** @type {Set<TimelineKind>} */
const VALID_KINDS = new Set(['observe', 'mutate', 'navigate', 'capture', 'wait', 'meta']);

/** @type {Set<'ok'|'fail'|'skip'>} */
const VALID_OUTCOMES = new Set(['ok', 'fail', 'skip']);

const SCHEMA_VERSION = 'action-timeline-v1';

/**
 * @param {ActionTimelineEvent} event
 * @returns {ActionTimelineEvent}
 */
function normalizeEvent(event) {
    if (!event || typeof event !== 'object') throw new Error('event must be an object');
    if (typeof event.traceId !== 'string' || !event.traceId) throw new Error('event.traceId required');
    if (typeof event.eventId !== 'string' || !event.eventId) throw new Error('event.eventId required');
    if (typeof event.t !== 'number' || !Number.isFinite(event.t)) throw new Error('event.t must be a finite number');
    if (!VALID_KINDS.has(event.kind)) throw new Error(`event.kind must be one of ${[...VALID_KINDS].join(',')}`);
    if (typeof event.command !== 'string' || !event.command) throw new Error('event.command required');
    if (!VALID_OUTCOMES.has(event.outcome)) throw new Error(`event.outcome must be one of ${[...VALID_OUTCOMES].join(',')}`);
    return {
        traceId: event.traceId,
        eventId: event.eventId,
        t: event.t,
        kind: event.kind,
        command: event.command,
        target: event.target,
        url: event.url,
        outcome: event.outcome,
        errorCode: event.errorCode,
        evidence: event.evidence,
    };
}

/**
 * @param {ActionTimelineEvent[]} events
 * @returns {ActionTimelineV1}
 */
export function buildActionTimeline(events) {
    if (!Array.isArray(events) || events.length === 0) {
        throw new Error('buildActionTimeline: at least one event is required');
    }
    const normalized = events.map(normalizeEvent);
    const traceId = normalized[0].traceId;
    for (const e of normalized) {
        if (e.traceId !== traceId) throw new Error('buildActionTimeline: all events must share traceId');
    }
    normalized.sort((a, b) => a.t - b.t);
    const startedAtMs = normalized[0].t;
    const endedAtMs = normalized[normalized.length - 1].t;
    /** @type {Record<string, number>} */
    const byKind = {};
    /** @type {Set<string>} */
    const commands = new Set();
    let okCount = 0;
    let failCount = 0;
    for (const e of normalized) {
        byKind[e.kind] = (byKind[e.kind] || 0) + 1;
        commands.add(e.command);
        if (e.outcome === 'ok') okCount += 1;
        else if (e.outcome === 'fail') failCount += 1;
    }
    return {
        schemaVersion: SCHEMA_VERSION,
        traceId,
        startedAt: new Date(startedAtMs).toISOString(),
        endedAt: new Date(endedAtMs).toISOString(),
        durationMs: endedAtMs - startedAtMs,
        events: normalized,
        stats: {
            eventCount: normalized.length,
            okCount,
            failCount,
            byKind,
            commandsTouched: [...commands].sort(),
        },
    };
}

/**
 * @param {ActionTimelineV1} timeline
 */
export function formatActionTimeline(timeline) {
    const lines = [
        `${timeline.schemaVersion}  trace=${timeline.traceId}  events=${timeline.stats.eventCount}  ok=${timeline.stats.okCount}  fail=${timeline.stats.failCount}  duration=${timeline.durationMs}ms`,
    ];
    for (const e of timeline.events) {
        const tag = e.outcome === 'ok' ? '✓' : e.outcome === 'fail' ? '✗' : '·';
        const target = e.target ? ` target=${e.target}` : '';
        const err = e.errorCode ? ` err=${e.errorCode}` : '';
        lines.push(`  ${tag} t=${e.t}  ${e.kind.padEnd(8)} ${e.command.padEnd(14)}${target}${err}`);
    }
    return lines.join('\n');
}

export const ACTION_TIMELINE_SCHEMA_VERSION = SCHEMA_VERSION;
