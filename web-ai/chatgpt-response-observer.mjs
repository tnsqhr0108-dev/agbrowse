// @ts-check
/**
 * Response-capture short-circuit + 3rd-tier recovery (spec 33).
 *
 * Per the locked decision the poller in chatgpt.mjs stays AUTHORITATIVE: this
 * module only (a) wakes the poll loop early when the DOM settles (a MutationObserver
 * short-circuit, so capture latency drops without changing any decision) and
 * (b) provides a best-effort last-turn re-read when the poller times out.
 *
 * Self-contained (no import from chatgpt.mjs) to avoid a cycle; the placeholder
 * predicate is injected so the recovery path matches chatgpt.mjs isFinalAnswer.
 */

const DEFAULT_QUIET_MS = 1_200;
const DEFAULT_OBSERVER_TIMEOUT_MS = 30_000;

/**
 * Build the in-page expression: a MutationObserver that resolves once a new
 * assistant turn (beyond `baselineAssistantCount`) has been quiet for `quietMs`
 * with the stop button gone, or resolves `null` after `timeoutMs` (never
 * rejects — it must lose a race silently).
 * @param {{ baselineAssistantCount?: number, quietMs?: number, timeoutMs?: number }} [opts]
 * @returns {string}
 */
export function buildResponseObserverExpression({ baselineAssistantCount = 0, quietMs = DEFAULT_QUIET_MS, timeoutMs = DEFAULT_OBSERVER_TIMEOUT_MS } = {}) {
    const minIdx = Number.isFinite(Number(baselineAssistantCount)) ? Math.max(0, Math.floor(Number(baselineAssistantCount))) : 0;
    const quiet = Number.isFinite(Number(quietMs)) ? Math.max(200, Math.floor(Number(quietMs))) : DEFAULT_QUIET_MS;
    const timeout = Number.isFinite(Number(timeoutMs)) ? Math.max(1_000, Math.floor(Number(timeoutMs))) : DEFAULT_OBSERVER_TIMEOUT_MS;
    return `(() => new Promise((resolve) => {
        const MIN = ${minIdx};
        const QUIET = ${quiet};
        const HARD = ${timeout};
        const ASSIST = '[data-message-author-role="assistant"], [data-turn="assistant"]';
        const STOP = 'button[data-testid="stop-button"], button[aria-label*="Stop" i]';
        let quietTimer = null;
        let done = false;
        const newAssistant = () => document.querySelectorAll(ASSIST).length > MIN;
        const stopGone = () => !document.querySelector(STOP);
        const finish = (val) => {
            if (done) return;
            done = true;
            try { obs.disconnect(); } catch (e) {}
            clearTimeout(quietTimer);
            clearTimeout(hardTimer);
            resolve(val);
        };
        const scheduleQuiet = () => {
            clearTimeout(quietTimer);
            quietTimer = setTimeout(() => { if (newAssistant() && stopGone()) finish({ settled: true }); }, QUIET);
        };
        const obs = new MutationObserver(() => { if (newAssistant()) scheduleQuiet(); });
        try { obs.observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (e) {}
        const hardTimer = setTimeout(() => finish(null), HARD);
        if (newAssistant() && stopGone()) scheduleQuiet();
    })())`;
}

/**
 * Run the observer expression as an early-wake signal. Resolves `{ settled }` on
 * settle, or `null` on timeout/abort/error. Never throws.
 * @param {{ evaluate: Function }} page
 * @param {{ baselineAssistantCount?: number, timeoutMs?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ settled: true } | null>}
 */
export async function observeAssistantResponse(page, { baselineAssistantCount = 0, timeoutMs = DEFAULT_OBSERVER_TIMEOUT_MS, signal } = {}) {
    if (signal?.aborted) return null;
    try {
        const evalP = page.evaluate(buildResponseObserverExpression({ baselineAssistantCount, timeoutMs }));
        if (!signal) return await evalP;
        const abortP = new Promise((resolve) => signal.addEventListener('abort', () => resolve(null), { once: true }));
        return await Promise.race([evalP, abortP]);
    } catch {
        return null;
    }
}

/**
 * 3rd-tier recovery: re-read the latest assistant turn after the baseline once,
 * rejecting placeholders via the injected `isFinalAnswer` predicate. Read-only;
 * never throws. Returns `null` when there is no usable final answer.
 * @param {{ evaluate: Function }} page
 * @param {{ baselineAssistantCount?: number, isFinalAnswer?: (text: string) => boolean }} [opts]
 * @returns {Promise<{ from: 'recovery', text: string, recovered: true } | null>}
 */
export async function recoverAssistantResponse(page, { baselineAssistantCount = 0, isFinalAnswer } = {}) {
    let texts;
    try {
        texts = await page.evaluate((minIdx) => {
            const sel = '[data-message-author-role="assistant"], [data-turn="assistant"]';
            return Array.from(document.querySelectorAll(sel))
                .slice(minIdx)
                .map((n) => (n.innerText || '').trim())
                .filter(Boolean);
        }, Math.max(0, Math.floor(Number(baselineAssistantCount) || 0)));
    } catch {
        return null;
    }
    if (!Array.isArray(texts) || !texts.length) return null;
    const latest = texts[texts.length - 1];
    if (!latest) return null;
    if (typeof isFinalAnswer === 'function' && !isFinalAnswer(latest)) return null;
    return { from: 'recovery', text: latest, recovered: true };
}
