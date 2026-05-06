// @ts-check
/**
 * G01 (experimental) — local-only autonomous planner loop contract.
 *
 * The planner-loop orchestrates observe → propose → act → verify cycles
 * over agbrowse local CDP primitives only. No hosted/cloud planner, no
 * external model API. The proposeFn is supplied by the caller (web-ai
 * skill / future planner adapter) and returns CandidateActionV1 against
 * the current ObservationBundleV1.
 *
 * This file defines ONLY the contract types (JSDoc + frozen schema
 * version constant). The runtime lives in `planner-loop.mjs`.
 */

export const PLANNER_CONTRACT_SCHEMA_VERSION = 'planner-contract-v1';

/**
 * @typedef {Object} PlannerObjective
 * @property {string} id                    — caller-supplied trace id
 * @property {string} description           — natural-language goal
 * @property {Array<string>} stopConditions — verifier hints (e.g. "answer matches /\\d{4}/")
 * @property {number} [maxSteps=8]
 * @property {number} [maxStepMs=15000]
 * @property {number} [overallTimeoutMs=120000]
 */

/**
 * @typedef {Object} CandidateActionV1
 * @property {'observe' | 'click' | 'type' | 'press' | 'scroll' | 'wait' | 'extract' | 'finalize'} kind
 * @property {string} [ref]                 — observation ref (@e3 etc.)
 * @property {string} [text]                — type/extract payload
 * @property {string} [reason]              — why this action
 * @property {Record<string, unknown>} [args]
 */

/**
 * @typedef {Object} VerificationV1
 * @property {boolean} ok
 * @property {string} [reason]
 * @property {Array<string>} [signals]
 */

/**
 * @typedef {Object} PlannerStepV1
 * @property {number} step
 * @property {string} observationId
 * @property {CandidateActionV1} action
 * @property {VerificationV1} verification
 * @property {number} startedAt
 * @property {number} endedAt
 * @property {number} attempts
 */

/**
 * @typedef {Object} PlannerResultV1
 * @property {'planner-result-v1'} schemaVersion
 * @property {string} objectiveId
 * @property {'completed' | 'max-steps' | 'timeout' | 'aborted' | 'error'} outcome
 * @property {Array<PlannerStepV1>} steps
 * @property {string|null} finalAnswer
 * @property {{ totalMs: number, retryCount: number, observeCount: number, mutateCount: number }} stats
 */

export const PLANNER_RESULT_SCHEMA_VERSION = 'planner-result-v1';

/**
 * Validate a CandidateAction shape (defensive — proposers may be flaky).
 * @param {unknown} a
 * @returns {a is CandidateActionV1}
 */
export function isValidCandidateAction(a) {
    if (!a || typeof a !== 'object') return false;
    const k = /** @type {{kind?: unknown}} */ (a).kind;
    return typeof k === 'string'
        && ['observe', 'click', 'type', 'press', 'scroll', 'wait', 'extract', 'finalize'].includes(k);
}
