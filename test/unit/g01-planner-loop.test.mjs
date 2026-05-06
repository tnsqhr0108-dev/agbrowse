// @ts-check
import { describe, it, expect } from 'vitest';
import { runPlannerLoop } from '../../web-ai/planner-loop.mjs';
import {
    PLANNER_RESULT_SCHEMA_VERSION,
    isValidCandidateAction,
} from '../../web-ai/planner-contract.mjs';

/** Fixture deps factory. */
function makeDeps(actions, options = {}) {
    let observeIdx = 0;
    let actIdx = 0;
    return {
        async observe() {
            return { observationId: `obs-${++observeIdx}`, bundle: { refs: ['@e1', '@e2'] } };
        },
        async act() {
            const r = options.actResults?.[actIdx++] ?? { ok: true };
            return r;
        },
        async verify({ action }) {
            if (action.kind === 'finalize') return { ok: true };
            return { ok: true };
        },
        async propose({ history }) {
            return actions[history.length];
        },
    };
}

describe('G01 planner-loop', () => {
    it('contract schema versions are frozen', () => {
        expect(PLANNER_RESULT_SCHEMA_VERSION).toBe('planner-result-v1');
    });

    it('isValidCandidateAction rejects unknown kinds', () => {
        expect(isValidCandidateAction({ kind: 'click' })).toBe(true);
        expect(isValidCandidateAction({ kind: 'rm-rf' })).toBe(false);
        expect(isValidCandidateAction(null)).toBe(false);
        expect(isValidCandidateAction({})).toBe(false);
    });

    it('completes when proposer returns finalize and verification is ok', async () => {
        const deps = makeDeps([
            { kind: 'observe' },
            { kind: 'click', ref: '@e1' },
            { kind: 'finalize', text: '4' },
        ]);
        const result = await runPlannerLoop(
            { id: 'test-1', description: 'compute 2+2', stopConditions: [] },
            deps,
        );
        expect(result.outcome).toBe('completed');
        expect(result.finalAnswer).toBe('4');
        expect(result.steps).toHaveLength(3);
        expect(result.stats.observeCount).toBe(3);
        expect(result.stats.mutateCount).toBe(1); // only the click
    });

    it('hits max-steps when no finalize is proposed', async () => {
        const actions = Array.from({ length: 10 }, () => ({ kind: 'observe' }));
        const result = await runPlannerLoop(
            { id: 'test-2', description: 'never finishes', stopConditions: [], maxSteps: 3 },
            makeDeps(actions),
        );
        expect(result.outcome).toBe('max-steps');
        expect(result.steps).toHaveLength(3);
    });

    it('retries transient act failures up to the G09 cap (2 attempts) and counts retryCount', async () => {
        const deps = makeDeps(
            [
                { kind: 'click', ref: '@e1' },
                { kind: 'finalize', text: 'done' },
            ],
            {
                actResults: [
                    { ok: false, statusCode: 503, transient: true }, // first attempt
                    { ok: true },                                     // retry
                    { ok: true },                                     // finalize act
                ],
            },
        );
        const result = await runPlannerLoop(
            { id: 'test-3', description: 'transient retry', stopConditions: [] },
            deps,
        );
        expect(result.stats.retryCount).toBe(1);
        expect(result.outcome).toBe('completed');
        expect(result.steps[0].attempts).toBe(2);
    });

    it('does NOT retry non-transient failures (e.g. 401)', async () => {
        const deps = makeDeps(
            [{ kind: 'click', ref: '@e1' }],
            { actResults: [{ ok: false, statusCode: 401 }] },
        );
        const result = await runPlannerLoop(
            { id: 'test-4', description: '401 no retry', stopConditions: [] },
            deps,
        );
        expect(result.stats.retryCount).toBe(0);
        expect(result.steps[0].attempts).toBe(1);
        expect(result.outcome).toBe('aborted');
    });

    it('rejects an invalid candidate action and returns error outcome', async () => {
        const deps = {
            async observe() { return { observationId: 'o', bundle: {} }; },
            async act() { return { ok: true }; },
            async verify() { return { ok: true }; },
            async propose() { return { kind: 'rm-rf' }; },
        };
        const result = await runPlannerLoop(
            { id: 'test-5', description: 'bad action', stopConditions: [] },
            deps,
        );
        expect(['error', 'aborted']).toContain(result.outcome);
    });

    it('throws if objective.id missing', async () => {
        await expect(
            runPlannerLoop(/** @type {any} */ ({ description: 'x' }), /** @type {any} */ ({})),
        ).rejects.toThrow();
    });
});
