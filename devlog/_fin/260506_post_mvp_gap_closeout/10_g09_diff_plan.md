---
created: 2026-05-06
gap: G09
order: 10
severity: P1
category: provider-coverage
estimate: M
issue: "https://github.com/lidge-jun/agbrowse/issues/66"
depends_on: ['G01']
decision: freeze-web-ai-skill-as-model-adapter
---

# G09 Diff Plan - Model Adapter Surface

## 1. Decision

G09 should **not add API mode in this closeout**. Freeze G09 as: the `web-ai`
skill is the model adapter surface, and the adapter surface is already covered by
`agbrowse web-ai render|send|poll|query|watch` for ChatGPT, Gemini, and Grok web
automation. No OpenAI, Anthropic, Gemini API, OpenAI-compatible endpoint, or
Vercel AI SDK-style provider is selected in this phase. The explicit rationale
for `structure/CAPABILITY_TRUTH_TABLE.md` and `structure/mcp_scope.md` is:
`agbrowse` is a local browser/web-AI runtime; adding an API adapter now would
duplicate the web-ai skill, create a second provider lifecycle, expand secret
handling, and blur the release claim boundary. API mode remains supplemental and
deferred until the user picks a first provider and key source; if it lands later,
it must live under `agbrowse web-ai *`, never as a new top-level command, and must
use the G09/G01 hard retry cap of `MAX_MODEL_ADAPTER_ATTEMPTS = 2`.

## 2. File list (NEW / MODIFY / DELETE)

### NEW

- NEW `test/unit/g09-model-adapter-freeze.test.mjs`
  - Purpose: vitest regression test for the no-API-mode decision.
  - Assertions: `web-ai/cli.mjs` does not expose `api-query` in `COMMANDS`;
    `skills/web-ai/SKILL.md` contains the `*-api-model-adapter` deferred row;
    `structure/CAPABILITY_TRUTH_TABLE.md` contains the no-API-mode rationale;
    `structure/mcp_scope.md` says API model adapters are outside MCP scope.
  - Test path: this file is the vitest test path for the G09 freeze surface.

### MODIFY

- MODIFY `web-ai/cli.mjs`
  - Before: help text lists browser-backed web-ai commands only and unknown
    commands fall through the generic usage error path.
  - After: keep dispatcher unchanged for `case 'query':` per vendor; add only a
    short help boundary paragraph saying no API model command exists in G09.
    Do **not** add `api-query` to `COMMANDS`; do **not** add provider API calls.

- MODIFY `skills/web-ai/SKILL.md`
  - Before: capability matrix lists vendor web-UI capabilities for ChatGPT,
    Gemini, and Grok.
  - After: add one deferred capability row using the existing hyphenated
    `*-foo-bar` convention: `*-api-model-adapter`.

- MODIFY `skills/browser/browser.mjs`
  - Before: browser skill delegates web-ai behavior to `web-ai/cli.mjs` and
    root browser commands.
  - After: no new top-level browser token. Optional help comment may point users
    to `agbrowse web-ai query`; the root dispatcher must not gain `api-query`,
    `model-query`, `llm`, `adapter`, or equivalent top-level commands.

- MODIFY `structure/commands.md`
  - Before: Web-AI Commands table lists `render`, `status`, `send`, `poll`,
    `query`, `watch`, sessions, MCP server, eval, doctor, and current G02/G03/G06
    additions.
  - After: add a G09 command-boundary note: API model adapters are deferred; no
    `api-query` command exists; provider automation remains under `web-ai query`.

- MODIFY `structure/release_gates.md`
  - Before: `gate:all` documents the current 12 named gates.
  - After: add `gate:model-adapter-frozen` as gate 13 and explain it protects the
    no-parallel-adapter decision.

- MODIFY `structure/CAPABILITY_TRUTH_TABLE.md`
  - Before: no explicit G09 model-adapter row.
  - After: add row:
    `| API model adapter / web-ai skill adapter boundary | deferred (no API mode in G09) | no API adapter code; browser-backed surface remains web-ai query/send/poll | test/unit/g09-model-adapter-freeze.test.mjs, npm run gate:model-adapter-frozen | cli-jaw mirror: no API adapter mirror until agbrowse implements one; cli-jaw must keep no ready model-adapter parity claim. |`

- MODIFY `structure/mcp_scope.md`
  - Before: MCP scope documents frozen browser tools and deferred browser tools.
  - After: add G09 non-goal: model API adapters are not MCP tools, do not unfreeze
    MCP scope, and must not introduce hosted/cloud/external-CDP claims.

- MODIFY `scripts/release-gates.mjs`
  - Before: `GATES` has the current 12 gate entries and `node scripts/release-gates.mjs`
    runs all entries.
  - After: add `model-adapter-frozen` gate that checks:
    `web-ai/cli.mjs` does not include `'api-query'` in `COMMANDS`;
    `structure/CAPABILITY_TRUTH_TABLE.md` contains `API model adapter`;
    `structure/mcp_scope.md` contains `model API adapters are not MCP tools`;
    `skills/web-ai/SKILL.md` contains `*-api-model-adapter`.

- MODIFY `package.json`
  - Before: `gate:all` runs all gates through `scripts/release-gates.mjs`; named
    scripts expose the current 12 gates.
  - After: add `"gate:model-adapter-frozen": "node scripts/release-gates.mjs model-adapter-frozen"`.
    `gate:all` continues to run all gates because the script enumerates `GATES`.

- MODIFY `README.md`
  - Before: provider web-AI examples may be read as the only active adapter
    surface but do not explicitly reject API mode.
  - After: add one sentence in the capability boundary section: G09 does not add
    API model adapters; use `agbrowse web-ai query` for ChatGPT/Gemini/Grok web
    automation.

- MODIFY `devlog/00_index.md`
  - Before: G09 skeleton points at model-adapter work as a broad future gap.
  - After: link this diff plan and mark G09 decision as no-API-mode freeze until
    user answers the open provider/key/status questions.

### DELETE

- DELETE none.
  - No adapter files are removed because no adapter files exist.
  - No CLI command is deleted because no API-mode CLI command exists.

### Explicitly NOT added in G09

- Do not add `web-ai/model-adapter/openai.mjs`.
- Do not add `web-ai/model-adapter/anthropic.mjs`.
- Do not add `web-ai/model-adapter/gemini-api.mjs`.
- Do not add `web-ai/model-adapter/index.mjs`.
- Do not add `agbrowse api-query`, `agbrowse model-query`, `agbrowse llm`, or any
  other top-level command.
- Do not add a new MCP tool or unfreeze `browser_*` MCP scope.

## 3. Command shape & --help integration

Decision path: **no API mode**, so there is no new command shape and no new
dispatcher case. The `web-ai/cli.mjs` dispatcher remains centered on the existing
per-vendor `case 'query':` paths:

```js
case 'query': return withWebAiActiveCommand(command, deps, input, () => geminiQueryWebAi(deps, input));
case 'query': return withWebAiActiveCommand(command, deps, input, () => grokQueryWebAi(deps, input));
case 'query': return withWebAiActiveCommand(command, deps, input, () => queryWebAi(deps, input));
```

Exact `agbrowse web-ai --help` text addition, placed after the `Commands:` block
and before `Provider:`:

```text
Capability boundary:
  G09 does not add an API model adapter or api-query command. Use query/send/poll
  for ChatGPT, Gemini, and Grok web automation. API mode is deferred until a
  provider and key source are explicitly selected.
```

No new top-level command is introduced. If the user later approves API mode, it
must be inside the existing tree as `agbrowse web-ai api-query`, not `agbrowse
api-query`, and it must share the current flag shape:

```bash
agbrowse web-ai api-query --vendor <api-provider> --prompt "..." --json
```

Deferred API-mode success JSON envelope, if implemented later:

```json
{
  "ok": true,
  "vendor": "openai",
  "status": "complete",
  "mode": "api",
  "answerText": "text",
  "attempts": 1,
  "outcome": "ok",
  "warnings": []
}
```

Deferred API-mode failure JSON envelope must match the existing `web-ai query`
failure envelope shape exactly:

```json
{
  "ok": false,
  "status": "error",
  "error": {
    "name": "WebAiError",
    "errorCode": "capability.unsupported",
    "stage": "capability-preflight",
    "message": "web-ai api mode is deferred in G09; use web-ai query for browser-backed providers",
    "retryHint": "use-web-ai-query-or-enable-future-api-mode",
    "vendor": "openai",
    "mutationAllowed": false,
    "selectorsTried": [],
    "evidence": {
      "capabilityId": "openai-api-model-adapter",
      "mode": "api",
      "status": "deferred"
    }
  }
}
```

## 4. Skill table integration

Exact row to add to `skills/web-ai/SKILL.md` in the `Capability IDs per vendor`
matrix:

```markdown
| `*-api-model-adapter` | deferred | deferred | deferred |
```

Add this note immediately below the table:

```markdown
`*-api-model-adapter` is a G09 deferred capability. The active adapter surface is
browser-backed `web-ai query/send/poll` for ChatGPT, Gemini, and Grok. Do not add
API key handling or direct model API calls unless a later G09 implementation
decision selects a first provider and key source.
```

## 5. Retry policy spec

The retry policy is shared by any future G09 API mode and G01 planner loop. It is
defined here once and referenced from G01; do not duplicate or make it user
tunable.

- Constant name: `MAX_MODEL_ADAPTER_ATTEMPTS = 2`.
- Meaning: one initial attempt plus one retry, hard cap.
- User control: no CLI flag, no env override, no config override.
- Retry condition: retry only transient errors:
  - network disconnect/reset/timeout before response;
  - HTTP 5xx from an API provider;
  - provider SDK error explicitly classified as transient.
- No retry on:
  - 4xx responses, including authentication, authorization, quota, rate-limit if
    the provider marks it non-transient;
  - missing API key;
  - prompt/input/schema validation failure;
  - unsupported capability/provider;
  - JSON/schema parse failure after a completed response.
- Telemetry fields:
  - `attempts: number`
  - `outcome: 'ok' | 'fail-after-retry' | 'fail-no-retry'`
- G01 planner-loop reference:
  - Each planner cycle may call the model adapter at most
    `MAX_MODEL_ADAPTER_ATTEMPTS` times.
  - G01 must not wrap G09 with another retry loop. If G09 returns
    `fail-after-retry`, the planner cycle records the failure and moves to its
    own next state.

## 6. Gate strategy

Add one gate to the existing 12, making `npm run gate:all` run 13 gates:

```bash
npm run gate:model-adapter-frozen
```

Gate implementation:

- `scripts/release-gates.mjs` adds `GATES['model-adapter-frozen']`.
- `package.json` adds the named script.
- `gate:all` remains `node scripts/release-gates.mjs`; no separate aggregator
  edit is needed beyond adding the new `GATES` entry.

Fixtures and assertions:

- Fixture source: repo files only; no provider credentials and no network.
- Assert `web-ai/cli.mjs`:
  - `COMMANDS` does not contain `api-query`.
  - `WEB_AI_USAGE` contains the G09 capability boundary text.
- Assert `skills/web-ai/SKILL.md`:
  - contains row `| \`*-api-model-adapter\` | deferred | deferred | deferred |`.
- Assert `structure/CAPABILITY_TRUTH_TABLE.md`:
  - contains `API model adapter / web-ai skill adapter boundary`;
  - contains `deferred (no API mode in G09)`;
  - contains cli-jaw no-mirror rationale.
- Assert `structure/mcp_scope.md`:
  - contains `model API adapters are not MCP tools`.
- Assert no forbidden new files exist:
  - `web-ai/model-adapter/openai.mjs`
  - `web-ai/model-adapter/index.mjs`
  - `web-ai/model-adapters/openai-compatible.mjs`

Vitest coverage:

```bash
vitest run test/unit/g09-model-adapter-freeze.test.mjs
```

The test and gate intentionally verify the freeze. If a later user decision
approves API mode, this gate must be replaced by `gate:model-adapter-retry-cap`
and the truth table status must move from `deferred` to `experimental`.

## 7. cli-jaw mirror impact

Default rule: if API mode is added later, cli-jaw mirror is required because both
repos have truth tables and cli-jaw publicly documents selected agbrowse parity.
For this G09 decision, API mode is not added, so cli-jaw mirrors only the
deferred claim boundary.

Per-file impact:

- `cli-jaw/structure/CAPABILITY_TRUTH_TABLE.md`
  - Mirror required.
  - Add matching row: API model adapter is deferred/no API mode; cli-jaw must not
    claim model-adapter parity.

- `cli-jaw/skills_ref/web-ai/SKILL.md`
  - Mirror required.
  - Add `*-api-model-adapter` deferred row or equivalent support-label note.

- `cli-jaw/bin/commands/browser-web-ai.ts`
  - No mirror code change for the no-API-mode decision.
  - It must not add `api-query` to `WEB_AI_COMMANDS`.

- `cli-jaw/src/browser/web-ai/model-adapter/openai.ts`
  - No mirror file in this decision.
  - If API mode is later approved in agbrowse, this TS file becomes required
    alongside the agbrowse `.mjs` adapter.

- `cli-jaw/src/browser/web-ai/model-adapter/index.ts`
  - No mirror file in this decision.
  - Future mirror only if agbrowse adds `web-ai/model-adapter/index.mjs`.

- `cli-jaw/tests/unit/browser-web-ai-model-adapter.test.ts`
  - No mirror test in this decision.
  - Future mirror required if API mode is approved.

- `cli-jaw/scripts/release-gates.mjs`
  - Mirror optional for this decision if cli-jaw already has a truth-table gate.
  - Required if cli-jaw's `gate:all` claims parity freshness against all agbrowse
    capability rows.

- `cli-jaw/structure/commands.md`
  - Mirror required only as a no-API-mode note if cli-jaw docs mention model
    adapter parity.

## 8. Release-claim fence

Truth table row after this lands:

```markdown
| API model adapter / web-ai skill adapter boundary | deferred (no API mode in G09) | no API adapter code; browser-backed surface remains `agbrowse web-ai query/send/poll` | `test/unit/g09-model-adapter-freeze.test.mjs`, `npm run gate:model-adapter-frozen` | cli-jaw mirrors the deferred claim only; no model-adapter parity claim. |
```

Explicitly NOT claimed:

- No hosted/cloud browser operation.
- No stealth, CAPTCHA bypass, Cloudflare bypass, or account-access guarantee.
- No external CDP or remote-CDP support.
- No benchmark score or leaderboard claim.
- No MCP scope unfreeze.
- No direct API provider support.
- No OpenAI/Anthropic/Gemini API selection.
- No drop-in replacement for Vercel AI SDK.
- No best-in-class model orchestration claim.
- No schema-guaranteed planner/extractor API until G01/G09 are implemented with
  fixtures and retry-cap tests.

## 9. Open questions back to user

1. Should G09 remain frozen as no API mode through the next release, or should a
   later implementation branch add API mode?
2. If API mode is added later, which provider is first: none, openai-only, or a
   generic OpenAI-compatible endpoint?
3. If API mode is added later, should the API key source be environment variable
   only, or environment variable plus config file?
4. If API mode is added later, should `web-ai api-query` be `experimental` until
   live smoke tests run, or can fixture-only tests make it `ready`?
5. Should the G01 planner loop consume only browser-backed `web-ai query` for
   MVP, or wait for a future G09 API adapter?
6. Should cli-jaw mirror the deferred G09 row immediately, or only when the
   agbrowse no-API-mode gate lands?

## Audit checks

- Every NEW file has a vitest test path listed: yes,
  `test/unit/g09-model-adapter-freeze.test.mjs`.
- Every MODIFY shows before/after intent: yes.
- No new top-level CLI token: yes; no `agbrowse api-query` or equivalent.
- Retry cap is hard-coded constant: yes, `MAX_MODEL_ADAPTER_ATTEMPTS = 2`.
- cli-jaw mirror impact line is present per file: yes.
- Open questions list is non-empty and concrete: yes.

---

## GPT Pro  Revision (260506, session 01KQY6M2P4TH2431PC18HBXANJ)Audit 

 PASS-conditional on the following amendments**.

### A. Freeze  confirmed sounddecision 
- Adopt the freeze. No API mode in this release. If reopened, the only acceptable shape is `agbrowse web-ai query --transport api` (NOT `agbrowse api-query`), reusing the same capability-matrix row and the same hard cap.

### B. Strengthen `gate:model-adapter-frozen` (was tautological)
The gate must scan the source tree and FAIL on any of:
- **Commands/aliases/dispatchers** matching `api-query`, `web-ai api`, `*-api-query`, `model-query`, `model-adapter`, `--api`, `--transport api`, `--mode api`.
- **MCP tools** beyond the frozen set (`browser_snapshot`, `browser_click_ref`); especially anything `api-*`, `model-*`, `llm-*`.
- **Deps/imports** for provider SDKs: `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, `@google/genai`, `ai`, `@ai-sdk/*`.
- **Env/config names**: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `MODEL_ADAPTER_*`, `AI_SDK_*`.
- **New paths**: `web-ai/model-adapter/*`, `model-adapter/*`, `api-client/*`.
- **Help/README text** advertising API mode, "coming soon", "planned", "future support".

### C. Retry-cap  tightenedspec 
- Cap stays `MAX_MODEL_ADAPTER_ATTEMPTS = 2` (1 initial + 1 retry total). Stricter than Vercel AI SDK default (which is 2 *retries*, i.e. 3 attempts).
- The single retry must be **delayed + jittered + `Retry-After`-aware**. No immediate retry. No exponential backoff needed because cap is 2.
- **Transient classification** (retry only these):
  - 408 request timeout
  - 429 rate limited (Anthropic `rate_limit_error`, Google quota/capacity)
  - 5xx server error (incl. Anthropic 500 `api_error`, 504 `timeout_error`)
  - 529 Anthropic `overloaded_error`
  - SDK-classified network/transient
- **No-retry**: 4xx (except 408/429), missing-key, schema, unsupported, non-idempotent side-effectful calls.
- **Streaming**: an error after HTTP 200 (mid-stream) is NOT auto-retried.
- **Telemetry fields** (no content leakage): `{ attempts, outcome, statusCode, providerErrorType, retryAfterUsed, transientClass }`.

### D. Failure  drop new shapeenvelope 
- **Do NOT introduce `capability.unsupported`** as a new public runtime shape for G09.
- API model adapter remains a **docs/truth-table deferred row**, NOT a callable path. There is no runtime call to fail.
- If any code path must signal unsupported, it must reuse the existing `web-ai query` error envelope/`errorCode`.

### E. Mirror  add negative assertionparity 
- cli-jaw mirror = truth-table deferred row + skill capability row only.
- Add cli-jaw mirror check: **fail if any API adapter code, provider SDK dep, `api-*` command, or API help text exists in cli-jaw.**

### F. "Explicitly NOT  expanded listadded" 
- no agbrowse-mcp `api-*` / `model-*` / `llm-*` tools
- no provider SDK deps/imports
- no API-key env vars or secret storage
- no `--api`, `--transport api`, `--mode api`, `api-query`, or aliases
- no `web-ai/model-adapter/*` or `model-adapter/*`
- no retry override flags or env vars
- no cli-jaw adapter code
- no README/help examples implying hosted/API support

### G. Help  exact wording (replaces previous draft)text 
```
Capability boundary: web-ai query uses the existing local browser automation
skill for chatgpt, gemini, and grok. G09 does not add provider API clients,
API-key auth, hosted model routing, or MCP model tools. API model adapters
are explicitly deferred and unavailable in this release.
```
(Note: "unavailable/ never "coming soon" / "planned" / "future".)deferred" 

### H. Open  revisedquestions 
**Resolved (drop):**
 No.
 Defer; if reopened, only `web-ai query --transport api`.

**Still open for user (5):**
1. Exact denylist patterns for `gate:model-adapter- confirm B above is complete?frozen` 
2. Where does `MAX_MODEL_ADAPTER_ATTEMPTS` live? (proposed: shared `web-ai/constants.mjs` or planner constants  NOT a new `model-adapter` module).file 
3. Confirm transient classification in C is the binding spec.
4. Confirm unsupported errors reuse existing `web-ai query` error envelope (no new shape).
5. cli-jaw negative parity  accept as part of mirror gate?check 

### I. Smallest changes to reach PASS
1. Strengthen `gate:model-adapter-frozen` per ( denylist scans, not row-existence checks.B) 
2. Amend retry spec per ( bounded delay + jitter + `Retry-After`, no exponential backoff.C) 
3. Tighten help text per (G).
4. Drop `capability.unsupported` per (D); reuse existing envelope.
5. Add cli-jaw negative parity assertion per (E).

