---
created: 2026-05-14
status: planning
tags: [jawdev, agbrowse, adaptive-fetch, mirror-plan, search-helper]
---

# agbrowse-First Mirror Plan

## Decision

Implement adaptive fetch in agbrowse first.

Then mirror the proven shape into cli-jaw as:

```bash
cli-jaw browser fetch <url>
```

The reason is simple: agbrowse already owns the standalone browser/CDP runtime.
cli-jaw can call or wrap that proven behavior later, but agbrowse should not wait
for a cli-jaw-specific implementation.

## Product Boundary

agbrowse adaptive fetch is not search.

```text
Native search tool -> candidate URLs
agbrowse fetch     -> validated content from one URL
```

That boundary makes agbrowse useful as a search-tool helper without turning it
into a search engine, crawler, or anti-blocking product.

## User-Facing Contract

Primary command:

```bash
agbrowse fetch "<url>"
agbrowse fetch "<url>" --json
agbrowse fetch "<url>" --json --trace
agbrowse fetch "<url>" --browser never
agbrowse fetch "<url>" --browser required
```

Optional command flags for v1:

```text
--json
--trace
--browser auto|never|required
--max-bytes <n>
--timeout-ms <n>
--selector <css>
--no-public-endpoints
```

Compatibility alias:

```text
--no-browser -> --browser never
```

Deferred flags:

```text
--bulk
--save-artifact
--third-party-reader
```

Bulk and artifact modes should be separate slices because they increase storage,
rate-limit, and UX complexity.

## Proposed File Map

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

MODIFY:

```text
skills/browser/browser.mjs
skills/browser/SKILL.md
README.md
structure/commands.md
structure/CAPABILITY_TRUTH_TABLE.md
structure/str_func.md
```

MODIFY only if a local HTTP API route is exposed:

```text
structure/server_api.md
```

TEST:

```text
test/unit/browser-adaptive-fetch-validators.test.mjs
test/unit/browser-adaptive-fetch-endpoints.test.mjs
test/unit/browser-adaptive-fetch-transforms.test.mjs
test/unit/browser-adaptive-fetch-trace.test.mjs
test/integration/browser-fetch-command.test.mjs
```

## Execution Slices

### Slice 1 — Safe URL Fetch Core

Build:

- URL validation;
- timeout and max-byte bounds;
- content-type classification;
- redirect limit;
- browser mode parsing (`auto`, `never`, `required`);
- trace attempt recording;
- human and JSON output.

Acceptance:

- invalid URLs fail before network work;
- binary content is rejected as unsupported;
- weak/empty HTML returns a weak verdict, not a fake success;
- trace redacts sensitive headers/query material.

### Slice 2 — Endpoint And Metadata Readers

Build:

- RSS/Atom discovery;
- canonical URL and OpenGraph metadata;
- JSON endpoint candidate resolver for a small approved set;
- clean text transform for HTML.

Acceptance:

- public endpoint success returns `source: "public_endpoint"`;
- metadata-only results are marked `weak_ok`;
- no third-party dependency is installed silently.

### Slice 3 — Browser Escalation

Build:

- reuse existing Chrome/CDP session code;
- navigate only after earlier phases are weak or blocked when
  `--browser auto`;
- navigate after URL validation when `--browser required`;
- never navigate when `--browser never`;
- collect title, visible text, DOM text, and network JSON candidates;
- stop on login/CAPTCHA/paywall/challenge boundaries.

Acceptance:

- empty SPA shells can become `strong_ok` after browser render;
- login/challenge pages return a boundary verdict;
- browser escalation is visible in `attempts`.

### Slice 4 — Skill, README, Structure Docs

Build:

- update browser skill frontmatter and command examples;
- add search keyword consolidation for search-result/source/citation/reference
  URL routing;
- update README command list;
- update structure docs and capability truth table;
- add tests for help text.

Acceptance:

- docs say adaptive fetch is URL-only;
- docs preserve "no stealth/bypass" positioning;
- doc drift scripts pass.

## Result Schema

Use stable JSON keys from the first slice:

```json
{
  "ok": true,
  "verdict": "strong_ok",
  "source": "browser",
  "finalUrl": "https://example.com/article",
  "browserMode": "auto",
  "chromeUsed": true,
  "chromeRequired": false,
  "title": "Example title",
  "content": "Readable extracted text...",
  "summary": "Browser render produced readable text after native fetch was weak.",
  "attempts": [],
  "safetyFlags": []
}
```

Verdicts:

```text
strong_ok
weak_ok
blocked
auth_required
challenge
paywall
unsupported
error
```

Sources:

```text
public_endpoint
fetch
metadata
reader
browser
network_api
```

## Mirror Back To cli-jaw

After agbrowse passes implementation and tests, cli-jaw can mirror this in one of
two ways:

1. Wrap `agbrowse fetch <url>` from `cli-jaw browser fetch <url>`.
2. Port the `.mjs` modules back into cli-jaw's browser package if cli-jaw needs a
   fully internal implementation.

Preferred first mirror:

```text
cli-jaw browser fetch -> agbrowse fetch-compatible result schema
```

That keeps one behavior contract across both tools while avoiding duplicate
research-reader logic during the first pass.

## Guardrails

- Do not solve CAPTCHA.
- Do not bypass login or paywalls.
- Do not claim Cloudflare or anti-bot bypass.
- Do not auto-install Python, curl impersonation libraries, or reader services.
- Do not treat a broad search query as a URL.
- Do not bulk crawl without explicit scope and rate limits.
- Do not store page contents unless a later artifact slice explicitly adds that.

## Verification Commands

Planned verification once code exists:

```bash
npm run typecheck
npm test -- test/unit/browser-adaptive-fetch-validators.test.mjs test/unit/browser-adaptive-fetch-endpoints.test.mjs test/unit/browser-adaptive-fetch-transforms.test.mjs test/unit/browser-adaptive-fetch-trace.test.mjs test/integration/browser-fetch-command.test.mjs
bash structure/check-doc-drift.sh
bash structure/verify-counts.sh
git diff --check HEAD
```

If the repo has no TypeScript typecheck gate for these `.mjs` files, keep the
configured typecheck command but rely on focused unit/integration tests for the
adaptive-fetch module.
