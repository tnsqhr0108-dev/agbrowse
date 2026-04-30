Based on the phase bundle and unchanged source bundle.  

## Phase 0 — Papercuts

### 1. Decisions still missing

* **ChatGPT poll fallback should prefer same-host before vendor-latest.** Recommendation: add a tiny optional host filter to `getLatestBaseline`; it reduces wrong-tab risk without waiting for Phase 1.
* **Port mismatch should stay warning-only in Phase 0.** Recommendation: warn now, refuse later in Phase 5; Phase 0 should not introduce a surprising startup failure.

### 2. Exact diff sketches

`web-ai/session.mjs` — add a host-aware latest helper even though the phase file did not list it.

Before:

```js
export function getLatestBaseline(vendor) {
    loadStore();
    const matches = Array.from(baselines.values()).filter(baseline => baseline.vendor === vendor);
    return matches.at(-1) || null;
}
```

After:

```js
export function getLatestBaseline(vendor, options = {}) {
    loadStore();
    const sameHost = normalizeHost(options.sameHostUrl);
    const matches = Array.from(baselines.values())
        .filter(b => b.vendor === vendor)
        .filter(b => !sameHost || normalizeHost(b.url) === sameHost)
        .sort((a, b) => String(a.capturedAt).localeCompare(String(b.capturedAt)));
    return matches.at(-1) || null;
}
```

`web-ai/session.mjs` — helper.

```js
function normalizeHost(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}
```

`web-ai/chatgpt.mjs`

Before:

```js
const page = await requireChatGptPage(deps);
const baseline = getBaseline(vendor, page.url());
if (!baseline) throw new Error('baseline required. Run web-ai send or query first.');

const deadline = Date.now() + timeout * 1000;
```

After:

```js
const page = await requireChatGptPage(deps);
const url = page.url();
const baseline =
    getBaseline(vendor, url) ||
    getLatestBaseline(vendor, { sameHostUrl: url }) ||
    getLatestBaseline(vendor);
if (!baseline) throw new Error('baseline required. Run web-ai send or query first.');

const deadline = Date.now() + timeout * 1000;
```

`web-ai/grok-live.mjs`

Before:

```js
const envelope = normalizeEnvelope({ ...input, vendor: 'grok' });
const contextPack = await prepareContextForBrowser({ ...input, vendor: 'grok' });
if (contextPack?.attachments?.[0] && input.filePath) {
    throw new Error('context package upload and --file upload cannot be combined yet');
}
```

After:

```js
const envelope = normalizeEnvelope({ ...input, vendor: 'grok' });
if (hasContextPackaging(input) && input.allowGrokContextPack !== true) {
    const err = new Error('grok context-pack disabled by default; pass --allow-grok-context-pack to override');
    err.stage = 'grok-context-pack-not-allowed';
    throw err;
}
const contextPack = await prepareContextForBrowser({ ...input, vendor: 'grok' });
if (contextPack?.attachments?.[0] && input.filePath) {
    throw new Error('context package upload and --file upload cannot be combined yet');
}
```

`web-ai/grok-live.mjs`

Before:

```js
const warnings = [...rendered.warnings, ...(contextPack?.warnings || [])];
if (hasContextPackaging(input)) warnings.push(GROK_CONTEXT_PACK_WARNING);
```

After:

```js
const warnings = [...rendered.warnings, ...(contextPack?.warnings || [])];
if (hasContextPackaging(input) && input.allowGrokContextPack === true) {
    warnings.push(GROK_CONTEXT_PACK_WARNING);
}
```

`web-ai/cli.mjs`

Before:

```js
'allow-copy-markdown-fallback': { type: 'boolean', default: false },
file: { type: 'string' },
model: { type: 'string' },
```

After:

```js
'allow-copy-markdown-fallback': { type: 'boolean', default: false },
'allow-grok-context-pack': { type: 'boolean', default: false },
file: { type: 'string' },
model: { type: 'string' },
```

`web-ai/cli.mjs`

Before:

```js
allowCopyMarkdownFallback: values['allow-copy-markdown-fallback'] === true,
```

After:

```js
allowCopyMarkdownFallback: values['allow-copy-markdown-fallback'] === true,
allowGrokContextPack: values['allow-grok-context-pack'] === true,
```

`skills/browser/browser.mjs` — schematic only; full file is not in the attached source.

Before:

```js
if (await isCdpListening(port)) {
    return {
        ok: true,
        status: 'running',
        port,
        reused: true,
    };
}
```

After:

```js
if (await isCdpListening(port)) {
    const version = await readCdpVersion(port).catch(() => null);
    const state = readBrowserState().catch(() => null);
    const warnings = detectForeignCdpWarnings({ state, version, port });
    return {
        ok: true,
        status: 'running',
        port,
        reused: true,
        warnings,
    };
}
```

`skills/browser/browser.mjs` — helper sketch.

```js
function detectForeignCdpWarnings({ state, version, port }) {
    const warnings = [];
    if (!state || !version) return warnings;
    if (state.browserProduct && version.Browser && state.browserProduct !== version.Browser) {
        warnings.push(`cdp-port-browser-mismatch:${port}`);
    }
    if (state.userAgent && version['User-Agent'] && state.userAgent !== version['User-Agent']) {
        warnings.push(`cdp-port-user-agent-mismatch:${port}`);
    }
    return warnings;
}
```

`skills/web-ai/SKILL.md`

Before:

```md
If `web-ai send/query --vendor grok` is invoked with a context package, the
runtime emits a `grok-context-pack-not-recommended` warning so agents can
self-correct without failing closed.
```

After:

```md
Grok context packages fail closed by default. To override deliberately, pass
`--allow-grok-context-pack`; the runtime still emits
`grok-context-pack-not-recommended`.
```

`README.md`

Before:

```md
If Chrome is already listening on the selected CDP port and responds to
`/json/version`, `agbrowse` reuses it.
```

After:

```md
If Chrome is already listening on the selected CDP port and responds to
`/json/version`, `agbrowse` reuses it and warns when the running CDP endpoint
appears to differ from agbrowse's persisted browser state.
```

### 3. Dependency graph + slicing

* **One PR is fine** if the browser warning stays best-effort.
* Add one tiny extra file touch: `web-ai/session.mjs`.
* Order: ChatGPT baseline fallback → Grok hard-gate → CLI flag → docs → browser warning.

### 4. Risk this phase introduces

* **Most likely regression:** ChatGPT `poll` uses the wrong latest baseline when two same-host ChatGPT tabs are active.
* **Test:** create two baselines for `chatgpt.com`, one old and one new; assert strict URL wins, then same-host latest wins, then vendor-latest only as last resort.

---

## Phase 1 — Session IDs + resume / reattach

### 1. Decisions still missing

* **ULID vs UUIDv7 vs short hash:** use a 26-char ULID generated locally from 48-bit timestamp + 80-bit crypto randomness; sortable, compact, dependency-free.
* **Deadline default:** derive from `--deadline`, else `--timeout`, else vendor poll default: ChatGPT/Gemini 1200s, Grok 600s.
* **Legacy baselines:** keep read + dual-write for one minor release; mark deprecated in docs and stop documenting the file.
* **Resume navigation:** default to warn/fail if current tab mismatches; add explicit `--navigate` for changing the tab.
* **External CDP URL for reattach:** do not add in Phase 1; use `CDP_PORT`/`BROWSER_AGENT_HOME` first to avoid a second lifecycle surface.

### 2. Exact diff sketches

NEW `web-ai/session-store.mjs`

```js
export const SESSION_STORE_VERSION = 1;
export function generateSessionId(now = Date.now()) {}
export function readSessionStore() {}
export function writeSessionStore(store) {}
export function withStoreLock(fn, options = {}) {}
export function insertSession(session) {}
export function patchSession(sessionId, patch) {}
export function listStoredSessions(filter = {}) {}
export function loadLegacyBaselines() {}
```

Skeleton:

```js
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const HOME = process.env.BROWSER_AGENT_HOME || join(homedir(), '.browser-agent');
const STORE = join(HOME, 'web-ai-sessions.json');
const LOCK = `${STORE}.lock`;
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateSessionId(now = Date.now()) { return encodeTime(now) + encodeRandom(); }
export function readSessionStore() { /* parse or return {version,sessions:[]} */ }
export function writeSessionStore(store) { /* tmp write + rename */ }
export function withStoreLock(fn) { /* open LOCK with wx, finally unlink */ }
```

`web-ai/session.mjs`

Before:

```js
export function saveBaseline({ vendor, url, envelope, assistantCount, textHash }) {
    loadStore();
    const baseline = {
        vendor,
        url,
        promptHash: hashPrompt(envelope),
        assistantCount,
        textHash,
        capturedAt: new Date().toISOString(),
    };
```

After:

```js
export function createSession(envelope, meta = {}) {
    const now = new Date().toISOString();
    const session = {
        sessionId: generateSessionId(),
        vendor: envelope.vendor,
        createdAt: now,
        updatedAt: now,
        deadlineAt: meta.deadlineAt,
        targetId: meta.targetId || null,
        originalUrl: meta.originalUrl || null,
        conversationUrl: meta.conversationUrl || meta.originalUrl || null,
        promptHash: `sha256:${hashPrompt(envelope)}`,
        envelopeSummary: meta.envelopeSummary || {},
        status: 'sent',
        answer: null,
        lastError: null,
        warnings: [],
    };
```

`web-ai/session.mjs` — public API.

```js
export function updateSession(sessionId, patch) {
    return patchSession(sessionId, { ...patch, updatedAt: new Date().toISOString() });
}

export function getSession(sessionId) {
    return listStoredSessions({ sessionId, limit: 1 })[0] || null;
}

export function findActiveSession({ vendor, targetId, conversationUrl }) {
    return listStoredSessions({ vendor, active: true })
        .find(s => targetId && s.targetId === targetId) ||
        listStoredSessions({ vendor, active: true })
        .find(s => conversationUrl && s.conversationUrl === conversationUrl) ||
        listStoredSessions({ vendor, active: true, limit: 1 })[0] || null;
}
```

`web-ai/chatgpt.mjs`

Before:

```js
const baseline = saveBaseline({
    vendor: envelope.vendor,
    url: page.url(),
    envelope,
    assistantCount,
    textHash: String((await page.innerText('body').catch(() => '')).length),
});
```

After:

```js
const baseline = saveBaseline({
    vendor: envelope.vendor,
    url: page.url(),
    envelope,
    assistantCount,
    textHash: String((await page.innerText('body').catch(() => '')).length),
});
const session = createSession(envelope, {
    targetId: await deps.getTargetId?.(),
    originalUrl: input.url || page.url(),
    conversationUrl: page.url(),
    deadlineAt: resolveDeadlineAt(input, 'chatgpt'),
    envelopeSummary: summarizeEnvelope(input, contextPack),
});
```

`web-ai/chatgpt.mjs`

Before:

```js
return {
    ok: true,
    vendor: envelope.vendor,
    status: 'sent',
    url: page.url(),
    baseline,
```

After:

```js
return {
    ok: true,
    vendor: envelope.vendor,
    status: 'sent',
    url: page.url(),
    sessionId: session.sessionId,
    baseline,
```

`web-ai/chatgpt.mjs` — poll resolution.

Before:

```js
const baseline = getBaseline(vendor, page.url());
if (!baseline) throw new Error('baseline required. Run web-ai send or query first.');
```

After:

```js
const session = input.session
    ? getSession(input.session)
    : findActiveSession({ vendor, targetId: await deps.getTargetId?.(), conversationUrl: page.url() });
const baseline = session
    ? sessionToBaseline(session)
    : getBaseline(vendor, page.url()) || getLatestBaseline(vendor, { sameHostUrl: page.url() });
if (!baseline) throw new Error('baseline required. Run web-ai send/query first.');
if (session) updateSession(session.sessionId, { status: 'polling', conversationUrl: page.url() });
```

`web-ai/chatgpt.mjs` — completion.

Before:

```js
return {
    ok: true,
    vendor,
    status: 'complete',
    url: page.url(),
    answerText,
```

After:

```js
if (session) updateSession(session.sessionId, {
    status: 'complete',
    conversationUrl: page.url(),
    answer: answerText,
});
return {
    ok: true,
    vendor,
    status: 'complete',
    url: page.url(),
    sessionId: session?.sessionId,
    answerText,
```

`web-ai/gemini-live.mjs` — same shape.

Before:

```js
const baseline = saveBaseline({
    vendor: 'gemini',
    url: page.url(),
    envelope,
    assistantCount: turnsBefore,
    textHash: String((await page.innerText('body').catch(() => '')).length),
});
```

After:

```js
const baseline = saveBaseline({ vendor: 'gemini', url: page.url(), envelope,
    assistantCount: turnsBefore,
    textHash: String((await page.innerText('body').catch(() => '')).length),
});
const session = createSession(envelope, {
    targetId: await deps.getTargetId?.(),
    originalUrl: input.url || page.url(),
    conversationUrl: page.url(),
    deadlineAt: resolveDeadlineAt(input, 'gemini'),
    envelopeSummary: summarizeEnvelope(input, contextPack),
});
```

`web-ai/grok-live.mjs` — same shape.

Before:

```js
const baseline = saveBaseline({
    vendor: 'grok',
    url: page.url(),
    envelope,
    assistantCount,
    textHash: String((await page.innerText('body').catch(() => '')).length),
});
```

After:

```js
const baseline = saveBaseline({ vendor: 'grok', url: page.url(), envelope,
    assistantCount,
    textHash: String((await page.innerText('body').catch(() => '')).length),
});
const session = createSession(envelope, {
    targetId: await deps.getTargetId?.(),
    originalUrl: input.url || page.url(),
    conversationUrl: page.url(),
    deadlineAt: resolveDeadlineAt(input, 'grok'),
    envelopeSummary: summarizeEnvelope(input, contextPack),
});
```

`web-ai/cli.mjs`

Before:

```js
const COMMANDS = new Set(['render', 'status', 'send', 'poll', 'query', 'stop', 'context-dry-run', 'context-render']);
```

After:

```js
const COMMANDS = new Set([
    'render', 'status', 'send', 'poll', 'query', 'stop',
    'sessions', 'resume', 'reattach',
    'context-dry-run', 'context-render',
]);
```

`web-ai/cli.mjs`

Before:

```js
timeout: { type: 'string' },
'inline-only': { type: 'boolean', default: false },
```

After:

```js
timeout: { type: 'string' },
deadline: { type: 'string' },
session: { type: 'string' },
navigate: { type: 'boolean', default: false },
'inline-only': { type: 'boolean', default: false },
```

`web-ai/cli.mjs`

Before:

```js
const result = isContextCommand(command)
    ? await runContextCommand(command, input, values)
    : await runCommand(command, deps, input);
```

After:

```js
const result = command === 'sessions'
    ? await runSessionsCommand(argv.slice(1), values)
    : isContextCommand(command)
        ? await runContextCommand(command, input, values)
        : await runCommand(command, deps, input);
```

NEW `bin/agbrowse-sessions.mjs` — recommendation: **do not add**; it is duplicate surface. If kept:

```js
#!/usr/bin/env node
import { runWebAiCli } from '../web-ai/cli.mjs';
import { createBrowserDeps } from '../skills/browser/browser.mjs';

const argv = ['sessions', ...process.argv.slice(2)];
runWebAiCli(argv, await createBrowserDeps()).catch(err => {
    console.error(err.message || String(err));
    process.exit(1);
});
```

`skills/web-ai/SKILL.md`

Before:

```md
agbrowse web-ai poll
agbrowse web-ai query
agbrowse web-ai stop
```

After:

```md
agbrowse web-ai poll --session <id>
agbrowse web-ai query
agbrowse web-ai stop --session <id>
agbrowse web-ai sessions list
agbrowse web-ai sessions show <id>
agbrowse web-ai sessions resume <id>
```

`README.md`

Before:

```md
The provider tab and the agbrowse Chrome process stay open across a
poll timeout — only the polling loop gives up.
```

After:

```md
`send` returns a `sessionId`. Use `web-ai sessions resume <id>` after shell
exit, OS sleep, or a long model run. `poll --session <id>` resolves that
session before any URL-based fallback.
```

### 3. Dependency graph + slicing

* **Split into 3 PRs.**
* **PR 1:** `session-store.mjs`, `session.mjs` API, migration/legacy shims, unit tests.
* **PR 2:** ChatGPT/Gemini/Grok `send/poll/query/stop --session`, deadline handling.
* **PR 3:** `sessions list/show/resume/reattach`, docs, smoke recipes.
* Do not parallelize provider edits with Phase 2; both rewrite the same throw/poll paths.

### 4. Risk this phase introduces

* **Most likely regression:** store corruption or lost records from concurrent CLI invocations.
* **Test:** run `Promise.all([...Array(25)].map(createSession/updateSession))` against a temp store; assert all sessions survive and JSON parses.

---

## Phase 2 — Typed error taxonomy + retry hints

### 1. Decisions still missing

* **Evidence payload:** selector counts and short text snippets only, capped at 4 KB; no raw HTML/screenshots by default.
* **Severity field:** skip it; `retryHint` + `mutationAllowed` is enough for agents.
* **Cross-provider vs vendor-prefixed:** use `provider.*` plus `vendor` field; reserve vendor-prefixed codes for policy-only cases like `grok.context-pack-not-allowed`.

### 2. Exact diff sketches

NEW `web-ai/errors.mjs`

```js
export class WebAiError extends Error {}
export function wrapError(err, fallback) {}
export function providerError(vendor, init) {}
export function contextError(init) {}
export function toErrorJson(err) {}
```

Skeleton:

```js
export class WebAiError extends Error {
    constructor({ errorCode, stage, message, retryHint, vendor, mutationAllowed = false, selectorsTried = [], evidence = null, cause }) {
        super(message);
        this.name = 'WebAiError';
        Object.assign(this, { errorCode, stage, retryHint, vendor, mutationAllowed, selectorsTried, evidence });
        if (cause) this.cause = cause;
    }
    toJSON() { return toErrorJson(this); }
}
export function wrapError(err, fallback = {}) { return err instanceof WebAiError ? err : new WebAiError({ errorCode: 'internal.unhandled', stage: 'internal', retryHint: 'report', message: err?.message || String(err), ...fallback, cause: err }); }
export function toErrorJson(err) { return { name: err.name, errorCode: err.errorCode, stage: err.stage, message: err.message, retryHint: err.retryHint, vendor: err.vendor, mutationAllowed: err.mutationAllowed, selectorsTried: err.selectorsTried || [], evidence: err.evidence || null }; }
```

`web-ai/chatgpt.mjs`

Before:

```js
if (!CHATGPT_HOSTS.has(host)) {
    throw new Error(`active tab is not ChatGPT: ${url}. Use tabs then tab-switch before web-ai.`);
}
```

After:

```js
if (!CHATGPT_HOSTS.has(host)) {
    throw new WebAiError({
        errorCode: 'cdp.target-mismatch',
        stage: 'connect',
        vendor: 'chatgpt',
        retryHint: 'tab-switch',
        message: `active tab is not ChatGPT: ${url}. Use tabs then tab-switch before web-ai.`,
        evidence: { url },
    });
}
```

`web-ai/gemini-live.mjs`

Before:

```js
if (!isGeminiUrl(page.url())) throw new Error(`active tab is not gemini.google.com (${page.url()})`);
```

After:

```js
if (!isGeminiUrl(page.url())) {
    throw new WebAiError({
        errorCode: 'cdp.target-mismatch',
        stage: 'connect',
        vendor: 'gemini',
        retryHint: 'tab-switch',
        message: `active tab is not gemini.google.com (${page.url()})`,
        evidence: { url: page.url() },
    });
}
```

`web-ai/grok-live.mjs`

Before:

```js
const composerSel = await findFirstSelector(page, COMPOSER_SELECTORS, 10_000);
if (!composerSel) throw new Error('grok composer not visible');
```

After:

```js
const composerSel = await findFirstSelector(page, COMPOSER_SELECTORS, 10_000);
if (!composerSel) throw new WebAiError({
    errorCode: 'provider.composer-not-visible',
    stage: 'composer-prereq',
    vendor: 'grok',
    retryHint: 're-snapshot',
    message: 'grok composer not visible',
    selectorsTried: COMPOSER_SELECTORS,
});
```

`web-ai/context-pack/builder.mjs` — required extra MODIFY not listed in phase file.

Before:

```js
if (result.budget.estimatedTokens > result.budget.maxInputTokens) {
    throw new Error(`context package exceeds max input tokens: ${result.budget.estimatedTokens}/${result.budget.maxInputTokens}`);
}
```

After:

```js
if (result.budget.estimatedTokens > result.budget.maxInputTokens) {
    throw new WebAiError({
        errorCode: 'context.over-budget',
        stage: 'context-preflight',
        retryHint: 'reduce-files',
        message: `context package exceeds max input tokens: ${result.budget.estimatedTokens}/${result.budget.maxInputTokens}`,
        evidence: result.budget,
    });
}
```

`web-ai/context-pack/file-selector.mjs` — required extra MODIFY.

Before:

```js
if (stat.isSymbolicLink()) throw new Error(`context path is a symlink and is not allowed: ${pattern}`);
```

After:

```js
if (stat.isSymbolicLink()) throw new WebAiError({
    errorCode: 'context.symlink-rejected',
    stage: 'context-preflight',
    retryHint: 'path-list',
    message: `context path is a symlink and is not allowed: ${pattern}`,
    evidence: { pattern },
});
```

`web-ai/cli.mjs`

Before:

```js
export async function runWebAiCli(argv = [], deps) {
    const command = argv[0];
    if (!command || command === '--help' || command === 'help' || argv.includes('--help')) {
        console.log(WEB_AI_USAGE.trim());
        return { ok: true, status: 'help' };
    }
```

After:

```js
export async function runWebAiCli(argv = [], deps) {
    try {
        return await runWebAiCliInner(argv, deps);
    } catch (err) {
        const wrapped = wrapError(err);
        emitCliError(wrapped, argv);
        wrapped.alreadyReported = true;
        throw wrapped;
    }
}
async function runWebAiCliInner(argv = [], deps) {
```

`web-ai/cli.mjs` — error output.

```js
function emitCliError(err, argv) {
    const forceJson = process.env.AGBROWSE_JSON_ERRORS === '1' || argv.includes('--json');
    const payload = { ok: false, status: 'error', error: err.toJSON() };
    if (forceJson) console.error(JSON.stringify(payload, null, 2));
    else console.error(`[web-ai error] ${err.errorCode}: ${err.message}\n[hint] retryHint: ${err.retryHint}`);
}
```

`skills/web-ai/SKILL.md`

Before:

```md
## Safety
```

After:

```md
## Error taxonomy

Set `AGBROWSE_JSON_ERRORS=1` for agent integrations. Failures include
`errorCode`, `stage`, `retryHint`, `mutationAllowed`, `selectorsTried`, and
optional `evidence`.
```

### 3. Dependency graph + slicing

* **Split into 2 PRs.**
* **PR 1:** `errors.mjs`, CLI wrapper, docs, tests.
* **PR 2:** convert provider/context-pack throw sites.
* Do before Phase 3 if you want capability rows attached to pre-mutation failures.

### 4. Risk this phase introduces

* **Most likely regression:** CLI errors print twice if the outer browser entrypoint also catches.
* **Test:** force wrong vendor with `AGBROWSE_JSON_ERRORS=1`; assert exactly one parseable JSON object on stderr/stdout and non-zero exit.

---

## Phase 3 — Capability probe rows

### 1. Decisions still missing

* **Evidence validation:** loose JSON plus tests; no Zod/JSON Schema dependency for now.
* **Rows on send failure:** yes for pre-mutation failures only; attach `capabilities` to `WebAiError.evidence`.
* **Logged-in detection:** accept provider-specific probes; generic login detection will be noisy.

### 2. Exact diff sketches

NEW `web-ai/capability.mjs`

```js
export function defineCapability(capabilityId, probeFn) {}
export async function runCapabilities(deps, capabilities, input = {}) {}
export function selectorVisibleCapability(capabilityId, selectors, next) {}
export function worstCapabilityState(rows) {}
```

Skeleton:

```js
export function defineCapability(capabilityId, probeFn) {
    return { capabilityId, probeFn };
}
export async function runCapabilities(deps, capabilities, input = {}) {
    const rows = [];
    for (const cap of capabilities) {
        if (input.probe && input.probe !== cap.capabilityId) continue;
        try { rows.push({ capabilityId: cap.capabilityId, ...(await cap.probeFn(deps, input)) }); }
        catch (e) { rows.push({ capabilityId: cap.capabilityId, state: 'unknown', evidence: { error: e.message }, next: 're-snapshot' }); }
    }
    return rows;
}
export function worstCapabilityState(rows) { return rows.some(r => r.state === 'fail') ? 'fail' : rows.some(r => r.state === 'warn') ? 'warn' : 'ok'; }
```

`web-ai/chatgpt-model.mjs`

Before:

```js
export async function selectChatGptModel(page, model) {
    const requested = normalizeChatGptModelChoice(model);
    if (!requested) {
        if (model) throw new Error(`unsupported ChatGPT model selection: ${model}`);
        return null;
    }
```

After:

```js
export async function chatGptModelCapabilityProbe(page, model) {
    const requested = normalizeChatGptModelChoice(model);
    if (!model) return { state: 'unknown', evidence: { requested: null }, next: 'send' };
    if (!requested) return { state: 'fail', evidence: { requested: model }, next: 'model-fallback' };
    const usedFallbacks = [];
    await openModelMenu(page, usedFallbacks).catch(() => null);
    const option = await findModelOption(page, requested).catch(() => null);
    await closeModelMenu(page).catch(() => undefined);
    return option ? { state: 'ok', evidence: { requested, usedFallbacks }, next: 'send' } : { state: 'fail', evidence: { requested }, next: 'model-fallback' };
}
```

`web-ai/gemini-model.mjs`

Before:

```js
export async function selectGeminiModel(page, model) {
    if (isGeminiDeepThinkChoice(model)) return null;
    const requested = normalizeGeminiModelChoice(model);
```

After:

```js
export async function geminiModelCapabilityProbe(page, model) {
    if (isGeminiDeepThinkChoice(model)) {
        return { state: 'unknown', evidence: { requested: model, tool: 'deepthink' }, next: 'send' };
    }
    const requested = normalizeGeminiModelChoice(model);
    if (!model) return { state: 'unknown', evidence: { requested: null }, next: 'send' };
    if (!requested) return { state: 'fail', evidence: { requested: model }, next: 'model-fallback' };
    const before = await readGeminiModel(page).catch(() => null);
    return before === requested ? { state: 'ok', evidence: { active: before }, next: 'send' } : { state: 'warn', evidence: { active: before, requested }, next: 'model-fallback' };
}
```

`web-ai/grok-model.mjs`

Before:

```js
export async function selectGrokModel(page, model) {
    const requested = normalizeGrokModelChoice(model);
    if (!requested) {
        if (model) throw new Error(`unsupported Grok model selection: ${model}`);
        return null;
    }
```

After:

```js
export async function grokModelCapabilityProbe(page, model) {
    const requested = normalizeGrokModelChoice(model);
    if (!model) return { state: 'unknown', evidence: { requested: null }, next: 'send' };
    if (!requested) return { state: 'fail', evidence: { requested: model }, next: 'model-fallback' };
    const active = await readGrokModel(page).catch(() => null);
    return active === requested
        ? { state: 'ok', evidence: { active }, next: 'send' }
        : { state: 'warn', evidence: { active, requested }, next: 'model-fallback' };
}
```

`web-ai/chatgpt.mjs`

Before:

```js
export async function statusWebAi(deps, input = {}) {
    const page = await requireChatGptPage(deps);
    return { ok: true, vendor: input.vendor || 'chatgpt', status: 'ready', url: page.url(), warnings: [] };
}
```

After:

```js
export const chatGptCapabilities = [
    defineCapability('chatgpt.host.matches', chatGptHostProbe),
    defineCapability('chatgpt.composer.visible', chatGptComposerProbe),
    defineCapability('chatgpt.model.alias-selectable', chatGptModelProbe),
    defineCapability('chatgpt.copy.button-present', chatGptCopyProbe),
];

export async function statusWebAi(deps, input = {}) {
    const page = await deps.getPage();
    const capabilities = await runCapabilities({ ...deps, page }, chatGptCapabilities, input);
    return { ok: !capabilities.some(r => r.state === 'fail'), vendor: 'chatgpt', status: 'ready', url: page.url(), capabilities, warnings: [] };
}
```

`web-ai/gemini-live.mjs`

Before:

```js
const inputSel = await findFirstSelector(page, INPUT_SELECTORS, 5_000);
return {
    ok: Boolean(inputSel),
    vendor: 'gemini',
    status: inputSel ? 'ready' : 'blocked',
```

After:

```js
export const geminiCapabilities = [
    defineCapability('gemini.host.matches', geminiHostProbe),
    defineCapability('gemini.composer.visible', geminiComposerProbe),
    defineCapability('gemini.model.alias-selectable', geminiModelProbe),
    defineCapability('gemini.upload.surface-visible', geminiUploadProbe),
];

const capabilities = await runCapabilities({ ...deps, page }, geminiCapabilities, input);
return { ok: !capabilities.some(r => r.state === 'fail'), vendor: 'gemini', status: 'ready', url: page.url(), capabilities, warnings: [] };
```

`web-ai/grok-live.mjs`

Before:

```js
const composerSel = await findFirstSelector(page, COMPOSER_SELECTORS, 5_000);
return {
    ok: Boolean(composerSel),
    vendor: 'grok',
```

After:

```js
export const grokCapabilities = [
    defineCapability('grok.host.matches', grokHostProbe),
    defineCapability('grok.composer.visible', grokComposerProbe),
    defineCapability('grok.model.alias-selectable', grokModelProbe),
    defineCapability('grok.copy.button-present', grokCopyProbe),
];

const capabilities = await runCapabilities({ ...deps, page }, grokCapabilities, input);
return { ok: !capabilities.some(r => r.state === 'fail'), vendor: 'grok', status: 'ready', url: page.url(), capabilities, warnings: [] };
```

`web-ai/cli.mjs`

Before:

```js
json: { type: 'boolean', default: false },
```

After:

```js
probe: { type: 'string' },
json: { type: 'boolean', default: false },
```

`web-ai/cli.mjs`

Before:

```js
allowCopyMarkdownFallback: values['allow-copy-markdown-fallback'] === true,
```

After:

```js
allowCopyMarkdownFallback: values['allow-copy-markdown-fallback'] === true,
probe: values.probe,
```

`skills/web-ai/SKILL.md`

Before:

```md
## Provider Matrix

| Provider | Inline | File upload | Context package upload | Model select | Copy fallback |
```

After:

```md
## Runtime capabilities

Use `agbrowse web-ai status --vendor <v> --json` before mutation. The JSON
contains `capabilities[]` rows with `capabilityId`, `state`, `evidence`, and
`next`. Scope a probe with `--probe <capabilityId>`.
```

### 3. Dependency graph + slicing

* **Split into 2 PRs.**
* **PR 1:** `capability.mjs`, CLI `--probe`, host/composer rows.
* **PR 2:** model/upload/copy/streaming rows and SKILL matrix replacement.
* Phase 4 should wait for Phase 3; `doctor` wants to reuse these probes.

### 4. Risk this phase introduces

* **Most likely regression:** `status` becomes slow or changes UI state by opening model menus.
* **Test:** fake page with model menu; run probe; assert it returns within budget and sends `Escape`/closes menu.

---

## Phase 4 — DOM / snapshot diagnostics

### 1. Decisions still missing

* **Write reports to disk:** no by default; add optional `--output <path>` only if needed.
* **`doctor diff`:** do not ship in Phase 4; Phase 5 churn-log can create comparable reports later.
* **Auto-run as `status --full`:** no; keep `doctor` explicit to avoid slow status calls.

### 2. Exact diff sketches

NEW `web-ai/dom-hash.mjs`

```js
export async function domHashAround(page, selectors, options = {}) {}
export function normalizeDomForHash(html) {}
export async function selectorMatchSummary(page, selectors) {}
```

Skeleton:

```js
import { createHash } from 'node:crypto';

export async function domHashAround(page, selectors, options = {}) {
    const maxChars = options.maxChars ?? 8192;
    const html = await page.evaluate((sels) => {
        const node = sels.map(s => document.querySelector(s)).find(Boolean);
        return node ? node.outerHTML : 'missing';
    }, selectors).catch(() => 'missing');
    return `sha1:${createHash('sha1').update(normalizeDomForHash(html).slice(0, maxChars)).digest('hex')}`;
}
export function normalizeDomForHash(html) { return String(html).replace(/\sdata-message-id="[^"]*"/g, '').replace(/\sstyle="[^"]*"/g, '').replace(/\s+/g, ' ').trim(); }
export async function selectorMatchSummary(page, selectors) { return Promise.all(selectors.map(async selector => ({ selector, matched: await page.locator(selector).count().catch(() => 0), visible: await page.locator(selector).first().isVisible().catch(() => false) }))); }
```

NEW `web-ai/doctor.mjs`

```js
export async function runDoctor(deps, options = {}) {}
export function featureDefinitionsForVendor(vendor) {}
export async function diagnoseFeature(page, feature, options = {}) {}
```

Skeleton:

```js
import { domHashAround, selectorMatchSummary } from './dom-hash.mjs';
import { chatGptCapabilities } from './chatgpt.mjs';
import { geminiCapabilities } from './gemini-live.mjs';
import { grokCapabilities } from './grok-live.mjs';

export async function runDoctor(deps, options = {}) {
    const page = await deps.getPage();
    const vendor = options.vendor || 'chatgpt';
    const features = await Promise.all(featureDefinitionsForVendor(vendor).map(f => diagnoseFeature(page, f, options)));
    return { vendor, url: page.url(), capturedAt: new Date().toISOString(), features, lastSession: options.lastSession || null, warnings: [] };
}
export function featureDefinitionsForVendor(vendor) { /* map vendor to selectors/caps */ }
export async function diagnoseFeature(page, feature, options = {}) { return { feature: feature.feature, selectorsTried: feature.selectors, selectorMatches: await selectorMatchSummary(page, feature.selectors), state: 'unknown', domHash: await domHashAround(page, feature.selectors, options) }; }
```

`web-ai/cli.mjs`

Before:

```js
const COMMANDS = new Set(['render', 'status', 'send', 'poll', 'query', 'stop', 'context-dry-run', 'context-render']);
```

After:

```js
const COMMANDS = new Set([
    'render', 'status', 'send', 'poll', 'query', 'stop',
    'doctor',
    'context-dry-run', 'context-render',
]);
```

`web-ai/cli.mjs`

Before:

```js
const result = isContextCommand(command)
    ? await runContextCommand(command, input, values)
    : await runCommand(command, deps, input);
```

After:

```js
const result = command === 'doctor'
    ? await runDoctor(deps, { vendor: input.vendor, full: values.full })
    : isContextCommand(command)
        ? await runContextCommand(command, input, values)
        : await runCommand(command, deps, input);
```

`web-ai/cli.mjs` — human mode.

Before:

```js
else printHuman(command, result);
```

After:

```js
else if (command === 'doctor') printDoctorHuman(result);
else printHuman(command, result);
```

`skills/web-ai/SKILL.md`

Before:

```md
agbrowse web-ai context-render
```

After:

```md
agbrowse web-ai context-render
agbrowse web-ai doctor --vendor <chatgpt|gemini|grok> --json
```

`README.md`

Before:

```md
upload never appears | provider UI changed | run `snapshot`, `get-dom`, and update provider selectors
```

After:

```md
upload never appears | provider UI changed | run `agbrowse web-ai doctor --vendor <v> --json`
```

### 3. Dependency graph + slicing

* **Split into 2 PRs.**
* **PR 1:** `dom-hash.mjs` + unit tests.
* **PR 2:** `doctor.mjs`, CLI command, docs, provider feature maps.
* Depends on Phase 3 if doctor reuses capability state; otherwise duplicate code creeps in.

### 4. Risk this phase introduces

* **Most likely regression:** diagnostic output leaks large prompt text or sensitive DOM.
* **Test:** fake DOM with long user text/token-like strings; assert report is under 4 KB by default and raw snippets appear only with `--full`.

---

## Phase 5 — Adoption hardening

### 1. Decisions still missing

* **`agbrowse churn report`:** do not ship yet; JSONL is enough for downstream tools.
* **`--port-strict` default:** no; keep default permissive until real users report collision frequency.
* **Public known DOM changes list:** no public list initially; local churn log + GitHub issues are enough.

### 2. Exact diff sketches

NEW `web-ai/churn-log.mjs`

```js
export function maybeRecordChurn(report, options = {}) {}
export function readChurnLog() {}
export function appendChurnRecord(record) {}
export function compactChurnLog(records, limit) {}
```

Skeleton:

```js
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const HOME = process.env.BROWSER_AGENT_HOME || join(homedir(), '.browser-agent');
const LOG = join(HOME, 'churn-log.jsonl');

export function maybeRecordChurn(report, options = {}) {
    if (process.env.AGBROWSE_CHURN_LOG !== '1') return null;
    const prior = readChurnLog();
    const records = changedFeatureRecords(report, prior);
    for (const record of records) appendChurnRecord(record);
    return records;
}
export function readChurnLog() { return existsSync(LOG) ? readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []; }
export function appendChurnRecord(record) { mkdirSync(dirname(LOG), { recursive: true }); appendFileSync(LOG, `${JSON.stringify(record)}\n`); }
```

`skills/browser/browser.mjs` — schematic only; full file is not attached.

Before:

```js
if (await isCdpListening(port)) {
    return reuseExistingCdp(port);
}
```

After:

```js
if (await isCdpListening(port)) {
    if (options.portStrict) {
        throw new Error(`CDP port ${port} is already in use; pass another --port or unset --port-strict`);
    }
    const reuse = await inspectReuseSafety(port, readBrowserState());
    if (reuse.foreign && !options.reuseForeignChrome) {
        throw new Error(`CDP port ${port} appears to belong to another Chrome profile; pass --reuse-foreign-chrome to override`);
    }
    return { ...await reuseExistingCdp(port), warnings: reuse.warnings };
}
```

`skills/browser/browser.mjs` — option parse sketch.

Before:

```js
port: { type: 'string' },
headless: { type: 'boolean', default: false },
```

After:

```js
port: { type: 'string' },
headless: { type: 'boolean', default: false },
'port-strict': { type: 'boolean', default: false },
'reuse-foreign-chrome': { type: 'boolean', default: false },
```

`web-ai/cli.mjs` — note: the phase file says this exposes `start` flags, but `web-ai/cli.mjs` has no `start`; those flags belong in `skills/browser/browser.mjs`.

Before:

```js
const result = command === 'doctor'
    ? await runDoctor(deps, { vendor: input.vendor, full: values.full })
```

After:

```js
const result = command === 'doctor'
    ? await runDoctor(deps, { vendor: input.vendor, full: values.full })
```

Then:

```js
if (command === 'doctor') {
    const churnRecords = maybeRecordChurn(result);
    if (churnRecords?.length) result.warnings.push(`churn-log-recorded:${churnRecords.length}`);
}
```

`skills/web-ai/SKILL.md`

Before:

```md
- Human verification and login screens must be completed by the user.
```

After:

```md
- Human verification and login screens must be completed by the user.
- agbrowse does not bypass anti-bot, captcha, or Cloudflare checks.
- Do not share one Chrome `--user-data-dir` across multiple CDP-controlled instances.
- For agent integrations, prefer `AGBROWSE_JSON_ERRORS=1`.
```

`README.md`

Before:

```md
Do not commit or share `~/.browser-agent`; it contains browser session state.
```

After:

```md
Do not commit or share `~/.browser-agent`; it contains browser session state.
Use separate `BROWSER_AGENT_HOME` and `CDP_PORT` values when running agbrowse
beside cli-jaw or other browser automation tools.
```

NEW `docs/adoption-checklist.md`

```md
# agbrowse adoption checklist

- Pick one `BROWSER_AGENT_HOME` per project or agent.
- Pick one `CDP_PORT` per browser automation stack.
- Use `AGBROWSE_JSON_ERRORS=1` for machine integrations.
- Run `agbrowse web-ai status --json` before mutation.
- Run `agbrowse web-ai doctor --vendor <v> --json` after selector failures.
- Do not assume agbrowse bypasses provider anti-bot checks.
- Do not share Chrome `userDataDir` between live Chrome instances.
- Keep provider logins user-managed and local.
```

### 3. Dependency graph + slicing

* **Split into 3 PRs.**
* **PR 1:** browser profile/port guard and docs.
* **PR 2:** churn-log tied to `doctor`.
* **PR 3:** adoption checklist and integration recipes.
* Depends on Phase 4 for useful churn logs.

### 4. Risk this phase introduces

* **Most likely regression:** false-positive foreign Chrome refusal blocks legitimate reuse.
* **Test:** fake persisted state + fake `/json/version`; assert same-state reuse succeeds, foreign reuse fails, and `--reuse-foreign-chrome` overrides.

---

## A. Sequencing critique

* **Phase 0 first still holds.** It fixes real correctness bugs before bigger churn.
* **Phase 4 cannot run in parallel with Phase 3** if doctor reuses capability probes; sequence Phase 3 → Phase 4.
* **Phase 2 should move before or inside early Phase 1.** A minimal `WebAiError`/JSON-error core makes Phase 1 session failures easier to test and resume.
* **Recommended order:** Phase 0 → Phase 2 core → Phase 1 session store/providers → Phase 3 capabilities → Phase 4 doctor → Phase 5 adoption.
* **Alternative low-conflict order:** Phase 0 → Phase 1 PR1 store only → Phase 2 → Phase 1 provider/CLI → Phase 3 → Phase 4 → Phase 5.

## B. What’s missing from the plan entirely

* **Generic structured snapshot diffs are not fully covered.** Phase 4 covers web-ai doctor, but not browser-wide `snapshot --diff`; absorb a small web-ai-only `lastSession.before/after` diff into Phase 4.
* **Watcher reattach remains missing.** Phase 1 has CLI reattach, not watcher reattach; keep out of scope or create Phase 6.
* **Machine-readable help/capability summary is missing.** Add `web-ai help --json` or `status --json.capabilities` docs in Phase 3/5.
* **Session garbage collection is missing.** Add `sessions prune --older-than 30d` or bounded store cleanup to Phase 1.
* **Profile lock file is only implied.** Phase 5 should add an explicit lock/owner file under `BROWSER_AGENT_HOME`, not rely only on CDP inspection.
* **Copy fallback diagnostics are under-specified.** Phase 4 should include copy-button selector counts and intercepted-copy status.
* **Model picker side effects are under-specified.** Phase 3 should document that probes may open/close provider menus but never submit prompts.

## C. Drop list

* **Drop `bin/agbrowse-sessions.mjs`.** It adds command surface without new capability.
* **Drop `doctor diff` for now.** JSON reports are enough until users have real churn history.
* **Drop disk-written doctor reports in Phase 4.** Phase 5 churn-log can own persistence.
* **Drop Zod/JSON Schema.** Tests and typedefs are enough for an early CLI.
* **Drop external CDP URL reattach in Phase 1.** `CDP_PORT` already covers most local use.
* **Drop generated SKILL matrix in the first pass.** Runtime capability rows matter more than doc generation.
* **Soften the `throw new Error(` grep ban.** Keep it for provider runtime public paths, not every helper/test.
* **Keep `withStoreLock`, but implement it simply.** A cross-platform `open('wx')` lock + atomic rename is enough.

## D. One-week reality check

| Phase   |            Estimate | One-week evening fit? | Note                                                                  |
| ------- | ------------------: | --------------------- | --------------------------------------------------------------------- |
| Phase 0 | 1–1.5 engineer-days | Yes                   | Small, mostly safe.                                                   |
| Phase 1 |   5–7 engineer-days | No                    | Store, provider rewrites, CLI commands, migration, tests.             |
| Phase 2 | 2.5–4 engineer-days | Borderline/no         | Core is small; converting all throws is the work.                     |
| Phase 3 |   3–5 engineer-days | No                    | Provider probes are fiddly and need fake-page tests.                  |
| Phase 4 |   3–4 engineer-days | No                    | Safe DOM hashing + compact reports need careful privacy tests.        |
| Phase 5 | 2.5–4 engineer-days | Borderline/no         | Browser profile guard is risky without full `browser.mjs` visibility. |

Assuming evening work, a one-week iteration realistically fits Phase 0 or one sub-PR of Phase 1/2/3, not a whole later phase.

If I had to cut this to a 4-week sprint, the cut order would be: drop Phase 5 churn-log and public adoption extras first, drop Phase 4 disk/diff/status integration second, trim Phase 3 to host/composer/model rows only third, drop `reattach` and the top-level sessions wrapper fourth, and keep Phase 0 plus a minimal Phase 1 session store/resume path plus Phase 2 JSON errors as the core deliverable.
