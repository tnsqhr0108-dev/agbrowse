// @ts-check
/**
 * G01 (experimental) — local-only autonomous planner loop runtime.
 *
 * runPlannerLoop(objective, deps) drives observe → propose → act → verify
 * cycles. All transport is supplied by `deps`:
 *   - deps.observe()    : Promise<{ observationId, bundle }>
 *   - deps.act(action)  : Promise<{ ok, errorCode? }>
 *   - deps.verify(step) : Promise<VerificationV1>
 *   - deps.propose(state): Promise<CandidateActionV1>
 *   - deps.now?         : () => number
 *
 * No hosted/cloud calls. No provider SDKs. No external CDP.
 * Retry policy is shared with G09: MAX_MODEL_ADAPTER_ATTEMPTS = 1 + 1.
 */

import { MAX_MODEL_ADAPTER_ATTEMPTS, isModelAdapterTransient } from './constants.mjs';
import {
    PLANNER_RESULT_SCHEMA_VERSION,
    isValidCandidateAction,
} from './planner-contract.mjs';

const DEFAULT_MAX_STEPS = 8;
const DEFAULT_STEP_MS = 15000;
const DEFAULT_OVERALL_MS = 120000;

/**
 * @param {import('./planner-contract.mjs').PlannerObjective} objective
 * @param {{
 *   observe: () => Promise<{ observationId: string, bundle: unknown }>,
 *   act: (a: import('./planner-contract.mjs').CandidateActionV1) => Promise<{ ok: boolean, errorCode?: string, statusCode?: number, transient?: boolean, midStream?: boolean, idempotent?: boolean }>,
 *   verify: (s: { observationId: string, action: import('./planner-contract.mjs').CandidateActionV1, actResult: unknown }) => Promise<import('./planner-contract.mjs').VerificationV1>,
 *   propose: (state: { objective: import('./planner-contract.mjs').PlannerObjective, observationId: string, bundle: unknown, history: Array<import('./planner-contract.mjs').PlannerStepV1> }) => Promise<import('./planner-contract.mjs').CandidateActionV1>,
 *   now?: () => number,
 * }} deps
 * @returns {Promise<import('./planner-contract.mjs').PlannerResultV1>}
 */
export async function runPlannerLoop(objective, deps) {
    if (!objective || typeof objective.id !== 'string') {
        throw new Error('runPlannerLoop: objective.id required');
    }
    const now = deps.now || (() => Date.now());
    const maxSteps = objective.maxSteps ?? DEFAULT_MAX_STEPS;
    const stepMs = objective.maxStepMs ?? DEFAULT_STEP_MS;
    const overallMs = objective.overallTimeoutMs ?? DEFAULT_OVERALL_MS;
    const startedAt = now();
    /** @type {Array<import('./planner-contract.mjs').PlannerStepV1>} */
    const steps = [];
    let retryCount = 0;
    let observeCount = 0;
    let mutateCount = 0;
    let finalAnswer = /** @type {string|null} */ (null);
    /** @type {import('./planner-contract.mjs').PlannerResultV1['outcome']} */
    let outcome = 'error';

    try {
        for (let step = 1; step <= maxSteps; step++) {
            if (now() - startedAt >= overallMs) { outcome = 'timeout'; break; }

            const stepStart = now();
            const obs = await withTimeout(deps.observe(), stepMs, 'observe');
            observeCount += 1;

            const action = await withTimeout(
                deps.propose({ objective, observationId: obs.observationId, bundle: obs.bundle, history: steps }),
                stepMs,
                'propose',
            );
            if (!isValidCandidateAction(action)) {
                outcome = 'error';
                break;
            }

            // Act with bounded retry for transient failures only.
            let attempts = 0;
            let actResult = /** @type {Awaited<ReturnType<typeof deps.act>>} */ ({ ok: false });
            for (let i = 0; i < MAX_MODEL_ADAPTER_ATTEMPTS; i++) {
                attempts += 1;
                if (action.kind !== 'observe' && action.kind !== 'finalize') mutateCount += 1;
                actResult = await withTimeout(deps.act(action), stepMs, 'act');
                if (actResult.ok) break;
                if (i + 1 < MAX_MODEL_ADAPTER_ATTEMPTS && isModelAdapterTransient(actResult)) {
                    retryCount += 1;
                    continue;
                }
                break;
            }

            const verification = await withTimeout(
                deps.verify({ observationId: obs.observationId, action, actResult }),
                stepMs,
                'verify',
            );

            steps.push({
                step,
                observationId: obs.observationId,
                action,
                verification,
                startedAt: stepStart,
                endedAt: now(),
                attempts,
            });

            if (action.kind === 'finalize' && verification.ok) {
                finalAnswer = action.text ?? null;
                outcome = 'completed';
                break;
            }
            if (!actResult.ok && !verification.ok) {
                // Hard failure (non-transient or retry-exhausted) → abort.
                outcome = 'aborted';
                break;
            }
        }

        if (outcome === 'error' && steps.length === maxSteps) outcome = 'max-steps';
        if (outcome === 'error' && steps.length > 0) outcome = 'aborted';
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === 'planner.timeout') outcome = 'timeout';
        else outcome = 'error';
    }

    return {
        schemaVersion: PLANNER_RESULT_SCHEMA_VERSION,
        objectiveId: objective.id,
        outcome,
        steps,
        finalAnswer,
        stats: {
            totalMs: now() - startedAt,
            retryCount,
            observeCount,
            mutateCount,
        },
    };
}

/**
 * @template T
 * @param {Promise<T>} p
 * @param {number} ms
 * @param {string} stage
 * @returns {Promise<T>}
 */
function withTimeout(p, ms, stage) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('planner.timeout')), ms);
        p.then(
            (v) => { clearTimeout(timer); resolve(v); },
            (e) => { clearTimeout(timer); reject(e instanceof Error ? e : new Error(`${stage}:${String(e)}`)); },
        );
    });
}
