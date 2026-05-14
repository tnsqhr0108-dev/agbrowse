---
created: 2026-05-14
status: planning
tags: [jawdev, adaptive-fetch, browser, diff-plan]
---

# Diff-Level Browser Fetch Plan

## Goal

Add a traceable adaptive URL reader under:

```bash
agbrowse fetch <url>
```

This command is not generic search. It reads a URL or search-result URL using a
bounded ladder: public endpoints, RSS/JSON, neutral fetch, metadata extraction,
and existing browser render/network inspection. First implementation is `.mjs`
inside `skills/browser/`, matching the surrounding agbrowse command code.

## Planned File Changes

### New Module

NEW:

```text
skills/browser/adaptive-fetch/index.mjs
skills/browser/adaptive-fetch/validators.mjs
skills/browser/adaptive-fetch/endpoint-resolvers.mjs
skills/browser/adaptive-fetch/fetcher.mjs
skills/browser/adaptive-fetch/metadata.mjs
skills/browser/adaptive-fetch/transforms.mjs
skills/browser/adaptive-fetch/browser-escalation.mjs
skills/browser/adaptive-fetch/safety.mjs
skills/browser/adaptive-fetch/trace.mjs
```

### CLI And API

MODIFY:

```text
skills/browser/browser.mjs
skills/browser/SKILL.md
README.md
structure/commands.md
structure/CAPABILITY_TRUTH_TABLE.md
structure/str_func.md
```

MODIFY only if a local HTTP API endpoint is added:

```text
structure/server_api.md
```

### Skills

MODIFY:

```text
skills/browser/SKILL.md
```

### Tests

NEW:

```text
test/unit/browser-adaptive-fetch-validators.test.mjs
test/unit/browser-adaptive-fetch-endpoints.test.mjs
test/unit/browser-adaptive-fetch-transforms.test.mjs
test/unit/browser-adaptive-fetch-trace.test.mjs
test/integration/browser-fetch-command.test.mjs
```

## Type Contracts

Use JSDoc typedefs in `skills/browser/adaptive-fetch/index.mjs` or a dedicated
`types` comment block. Do not add TypeScript tooling for this slice.

```js
/**
 * @typedef {'strong_ok'|'weak_ok'|'blocked'|'auth_required'|'challenge'|'paywall'|'browser_required'|'unsupported'|'error'} AdaptiveFetchVerdict
 * @typedef {'public_endpoint'|'fetch'|'reader'|'metadata'|'browser'|'network_api'} AdaptiveFetchSource
 * @typedef {'auto'|'never'|'required'} BrowserMode
 *
 * @typedef {object} AdaptiveFetchResult
 * @property {boolean} ok
 * @property {AdaptiveFetchVerdict} verdict
 * @property {AdaptiveFetchSource} source
 * @property {string} finalUrl
 * @property {BrowserMode} browserMode
 * @property {boolean} chromeUsed
 * @property {boolean} chromeRequired
 * @property {string} summary
 * @property {Array<object>} attempts
 */
```

## `skills/browser/browser.mjs` Diff Shape

Before:

```js
switch (subcommand) {
  case 'status':
  case 'start':
  case 'snapshot':
  case 'web-ai':
    ...
}
```

After:

```js
switch (subcommand) {
  case 'fetch':
    return runAdaptiveFetchCli(args.slice(1));
  case 'status':
  case 'start':
  case 'snapshot':
  case 'web-ai':
    ...
}
```

Add help:

```text
fetch <url> [--json] [--trace] [--browser auto|never|required] [--selector <css>]
  Adaptive URL reading. Not generic web search.
```

## Browser Escalation Import Shape

`browser-escalation.mjs` should import or receive only the small browser helpers
it needs. Avoid making the pure fetch modules depend on the Chrome lifecycle.

```js
import { ensureBrowser, getPage } from '../browser.mjs'; // shape to verify before build
```

If current helpers are not exportable without circular imports, extract a small
helper module instead of importing the entire CLI file.

## Browser Mode Behavior

| Mode | Fetch/core | Browser render | Failure when Chrome needed |
| --- | --- | --- | --- |
| `auto` | Yes | Only if weak/blocked/empty | `browser_required` if unavailable |
| `never` | Yes | Never | `weak_ok`/`blocked` with no browser attempt |
| `required` | URL validation only first | Yes | `browser_required` |

## Scheduler Order

```text
1. public_endpoint
2. fetch
3. reader
4. metadata
5. browser
6. network_api
7. boundary verdict
```

Boundary verdicts stop the ladder:

- `auth_required`
- `unsupported`
- `blocked` when retries are exhausted

## CLI Output

Default human output:

```text
ok: true
verdict: strong_ok
source: public_endpoint
final_url: ...
summary: Reddit JSON endpoint succeeded after native fetch was weak.
```

`--json` output:

```json
{
  "ok": true,
  "verdict": "strong_ok",
  "source": "public_endpoint",
  "finalUrl": "https://...",
  "content": "...",
  "attempts": []
}
```

`--trace` prints attempt table or includes attempts in JSON.

## Non-Goals In Code

Do not implement:

- CAPTCHA solving;
- login bypass;
- paywall bypass;
- automatic dependency install;
- stealth browser claims;
- site-specific hardcoded engine branches;
- new MCP browser tool registration.

## Verification Commands

```bash
npm run typecheck
npm test -- adaptive-fetch
bash structure/verify-counts.sh
```

If route or command docs change:

```bash
npm run gate:all
```
