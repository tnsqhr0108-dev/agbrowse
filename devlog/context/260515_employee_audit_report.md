# agbrowse Professional Code Audit

Date: 2026-05-15
Auditor: jaw employee Backend
Repository root: `/Users/jun/Developer/new/700_projects/agbrowse`
GitHub: https://github.com/lidge-jun/agbrowse

## Executive Summary

`agbrowse` is a serious, mostly well-hardened local Chrome/CDP automation and web-AI CLI. The project has stronger-than-average safety posture for an agent tool: conservative web-AI policy defaults, strict MCP input schemas, trace redaction, private-network protection in adaptive fetch, active command ownership, tab/session leases, source-of-truth structure docs, release gates, and a broad test suite.

The project is not "small and clean" anymore. Its main risk is accumulated complexity: `skills/browser/browser.mjs` is a 3,091-line CLI/runtime file, `web-ai/cli.mjs` is 1,446 lines, and the provider runtimes are large state machines. The architecture has good modules around these cores, but several critical command surfaces still live in large files with mixed responsibilities. Distribution also needs tightening: the published package currently includes `devlog/` including `_plan`, `_smoke`, and `_legacy` artifacts.

Verdict: **needs-work** before calling it broadly production-ready, but it is credible for a beta/local-tool release.

Overall score: **7.2 / 10**

## Evidence Base

I read and checked the actual source tree, not only README:

- Package and build: `package.json`, `tsconfig.json`, `tsconfig.checkjs.json`, `tsconfig.checkjs-dom.json`, `vitest.config.mjs`
- CLI/bin: `bin/agbrowse.mjs`, `bin/agbrowse-vision-click.mjs`
- Browser skill/runtime: `skills/browser/browser.mjs`, `browser-core.mjs`, `profile-lock.mjs`, `tab-manager.mjs`, `tab-lifecycle.mjs`, `tab-monitor.mjs`, `keyed-mutex.mjs`, `skill-install.mjs`, `adaptive-fetch/*`
- Web-AI core: `web-ai/cli.mjs`, `chatgpt.mjs`, `chatgpt-model.mjs`, `chatgpt-composer.mjs`, `chatgpt-attachments.mjs`, `chatgpt-images.mjs`, `gemini-live.mjs`, `grok-live.mjs`, `mcp-server.mjs`, `tool-schema.mjs`, `browser-tool-schema.mjs`, `errors.mjs`, `session-store.mjs`, `session.mjs`, `active-command-store.mjs`, `tab-lease-store.mjs`, `trace/*`, `policy/*`, `context-pack/*`
- Vision click: `skills/vision-click/vision-core.mjs`, `vision-click.mjs`
- Benchmarks: `benchmarks/agbrowse/trajectory.mjs`, `benchmarks/agbrowse/run-task.mjs`
- Docs/source of truth: `README.md`, `structure/INDEX.md`, `structure/runtime_contracts.md`, `structure/phase_status.md`, `structure/CAPABILITY_TRUTH_TABLE.md`, `structure/commands.md`, `docs/*`
- Tests: `test/unit/*`, `test/integration/*`, `test/e2e/*`, `test/spec/*`

Verification commands run:

- `npm run typecheck` - PASS
- `npm run typecheck:checkjs` - PASS
- `npm run typecheck:checkjs-dom` - PASS
- `npm test` - PASS: 100 test files passed, 2 skipped; 680 tests passed, 12 skipped
- `npm run check:module-graph` - PASS: 234 `.mjs` files, 72 leaves, max tier 11
- `npm run test:release-gates` - PASS: 134 structure drift checks and 40 structure count checks
- `npm pack --dry-run --json` - PASS technically, but packaging includes 386 entries and `devlog/`

## Scores

| Area | Score |
| --- | ---: |
| Architecture & Design | 7 / 10 |
| Code Quality | 7 / 10 |
| Security | 7 / 10 |
| Testing | 8 / 10 |
| Documentation | 8 / 10 |
| Package & Distribution | 6 / 10 |
| Performance | 7 / 10 |
| Developer Experience | 8 / 10 |

Weighted average: **7.2 / 10**

Weights used: Architecture 15%, Code Quality 15%, Security 20%, Testing 15%, Documentation 10%, Package 10%, Performance 10%, Developer Experience 5%.

## 1. Architecture & Design - 7 / 10

### Key Strengths

- Clear top-level domain split: `bin/`, `skills/browser/`, `skills/vision-click/`, `skills/web-ai/`, `web-ai/`, `benchmarks/`, `structure/`, `test/`.
- The source-of-truth docs correctly describe the system map. `structure/INDEX.md` positions CLI -> browser runtime -> web-AI/provider modules and links the operational docs.
- Several high-risk responsibilities have been split into focused modules:
  - Policy: `web-ai/policy/default-policy.mjs`, `web-ai/policy/enforce.mjs`, `web-ai/policy/schema.mjs`
  - Trace: `web-ai/trace/redact.mjs`, `web-ai/trace/writer.mjs`, `web-ai/trace/types.mjs`
  - Session persistence: `web-ai/session-store.mjs`, `web-ai/session.mjs`
  - Active command ownership: `web-ai/active-command-store.mjs`
  - Tab lease/pool ownership: `web-ai/tab-lease-store.mjs`, `web-ai/tab-pool.mjs`, `skills/browser/tab-lifecycle.mjs`
  - Adaptive fetch: `skills/browser/adaptive-fetch/*`
- `skills/browser/tab-manager.mjs:1` explicitly documents that it is self-contained to avoid circular dependencies, and the module graph check passed.
- `npm run check:module-graph` reported a valid graph: 234 `.mjs` files, 72 leaves, max tier 11.

### Key Issues

1. **Core CLI/runtime files are too large and own too many responsibilities.**
   - `skills/browser/browser.mjs` is 3,091 lines. Its function index spans browser launch, doctor, state persistence, CDP connection, DOM actions, network capture, screenshots, command dispatch, help text, and web-AI delegation. Command dispatch begins around `skills/browser/browser.mjs:2025`.
   - `web-ai/cli.mjs` is 1,446 lines. It handles help text, argument parsing, policy, browser startup, provider routing, session routing, tracing, output rendering, context packaging, source audit enforcement, and provider capability gating. The single `parseArgs` option block is at `web-ai/cli.mjs:353-425`; command routing is concentrated at `web-ai/cli.mjs:520-532` and `web-ai/cli.mjs:952-1031`.
   - Provider modules are also large: `web-ai/chatgpt-model.mjs` around 952 lines, `web-ai/chatgpt.mjs` around 917, `web-ai/gemini-live.mjs` around 770, `web-ai/grok-live.mjs` around 576.

2. **Several persistence modules duplicate ad hoc lock-store patterns.**
   - `web-ai/session-store.mjs`, `web-ai/active-command-store.mjs`, `web-ai/tab-lease-store.mjs`, `skills/browser/profile-lock.mjs`, and `skills/browser/tab-manager.mjs` all implement JSON file state, lock paths, tmp writes, stale logic, and cleanup with slightly different semantics.
   - Example: `web-ai/active-command-store.mjs:85-113`, `web-ai/tab-lease-store.mjs:124-154`, and `web-ai/session-store.mjs:135-164` repeat similar lock acquisition patterns.

3. **Module graph depth indicates organic growth.**
   - `check-module-graph` reports max tier 11. This is not a failure, but it means dependency layering is deep enough that accidental cross-layer coupling should be watched.

### Priority Fix Recommendations

- Split `skills/browser/browser.mjs` into command registration, browser lifecycle, CDP primitives, action commands, capture commands, and help rendering.
- Split `web-ai/cli.mjs` into argument parser, input normalizer, policy preflight, provider router, output renderer, and trace wrapper.
- Introduce a small shared file-store/lock utility for JSON stores. Keep APIs domain-specific, but centralize safe read/write/lock behavior.
- Add a CI gate for max file length or at least a warning threshold for `browser.mjs` and `web-ai/cli.mjs`.

## 2. Code Quality - 7 / 10

### Key Strengths

- The project consistently uses ESM and `// @ts-check`.
- Important runtime APIs have JSDoc typedefs, for example `web-ai/session-store.mjs:7-40`, `web-ai/context-pack/file-selector.mjs:10-18`, `benchmarks/agbrowse/trajectory.mjs:8-67`.
- The code favors explicit fail-closed checks:
  - Unsupported policy versions are rejected in `web-ai/policy/schema.mjs`.
  - MCP schemas have `additionalProperties: false` in `web-ai/tool-schema.mjs:18-23` and `web-ai/browser-tool-schema.mjs:7-12`.
  - Attachment preflight rejects unsupported extensions and size excess at `web-ai/chatgpt-attachments.mjs:178-197`.
- Type verification is better than the root `tsconfig.json` initially suggests: `typecheck:checkjs` and `typecheck:checkjs-dom` both passed.
- Error taxonomy exists in `web-ai/errors.mjs`, with structured fields and JSON serialization.

### Key Issues

1. **Root `tsconfig.json` excludes all `.mjs`/`.js` files.**
   - `tsconfig.json:21-23` sets `allowJs:false`, `checkJs:false`.
   - `tsconfig.json:41-46` excludes `**/*.mjs` and `**/*.js`.
   - This is mitigated by `tsconfig.checkjs.json` and `tsconfig.checkjs-dom.json`, but the default `npm run typecheck` alone does not check most implementation files.

2. **Strictness is intentionally softened.**
   - `tsconfig.json:17-18` sets `noUnusedLocals:false` and `noUnusedParameters:false`.
   - That is pragmatic for a JSDoc-heavy repo, but it reduces static cleanup pressure.

3. **High use of `any` and local casts.**
   - Many public functions accept `any` in JSDoc, especially `web-ai/cli.mjs`, `web-ai/mcp-server.mjs`, and provider modules. This keeps the repo moving but leaves contract drift easier.

4. **Raw `Error` remains common despite the `WebAiError` taxonomy.**
   - `web-ai/errors.mjs:4-5` says conversion of every `throw new Error` site is a later phase.
   - This is visible in many modules. Not every failure produces a structured `errorCode`, `stage`, and `retryHint`.

5. **Some parsing remains ad hoc.**
   - `skills/browser/browser-core.mjs` uses a simple regex parser for ARIA YAML. It is tested, but it is still fragile if snapshot text evolves beyond the expected shape.
   - `skills/vision-click/vision-core.mjs:63-104` extracts JSON objects by scanning brace depth. It handles normal cases, but malformed model output can still be tricky.

### Priority Fix Recommendations

- Make the release command run `typecheck`, `typecheck:checkjs`, and `typecheck:checkjs-dom` together so no one mistakes root `typecheck` for full coverage.
- Gradually replace `any` on public module boundaries with shared typedefs.
- Continue migrating high-level CLI/provider errors to `WebAiError`.
- Extract the repeated CLI argument normalization into typed helpers.

## 3. Security - 7 / 10

### Key Strengths

- Default web-AI policy is conservative:
  - Downloads denied, clipboard read denied, evaluate denied, file access denied by default in `web-ai/policy/default-policy.mjs:2-15`.
  - Provider defaults only upgrade file access for supported providers when the user did not explicitly set policy in `web-ai/policy/default-policy.mjs:28-31`.
- Policy enforcement rejects denied origins, non-allowlisted origins, non-explicit uploads, clipboard interception, evaluate, and file access at `web-ai/policy/enforce.mjs:37-69`.
- MCP clients cannot set `unsafeAllow`; `web-ai/mcp-server.mjs:38-41` rejects it before schema validation.
- MCP tool schemas are strict:
  - `web-ai/tool-schema.mjs:18-23` uses `additionalProperties:false`.
  - `web-ai/browser-tool-schema.mjs:178-257` recursively validates object/string/number/boolean/array schemas.
- Adaptive fetch has solid SSRF-style protections:
  - URL scheme and credentials are rejected at `skills/browser/adaptive-fetch/safety.mjs:84-105`.
  - Private/local hosts are blocked by default at `skills/browser/adaptive-fetch/safety.mjs:106-112`.
  - IPv4/IPv6 private and special-use ranges are covered at `skills/browser/adaptive-fetch/safety.mjs:118-151`.
  - Third-party reader targets reject sensitive query params at `skills/browser/adaptive-fetch/safety.mjs:225-234`.
- Trace redaction explicitly removes prompts, answers, page text, cookies, authorization, storage, emails, JWT-like tokens, and common API keys in `web-ai/trace/redact.mjs:3-27`.
- ChatGPT generated-image download validates host and estuary path before using cookies: `web-ai/chatgpt-images.mjs:166-172` and `web-ai/chatgpt-images.mjs:236-247`.
- Context package ZIP entries are sanitized against `..`, absolute paths, and Windows drive prefixes in `web-ai/context-pack/builder.mjs:160-175`.
- Context file selection rejects symlinks and binary files in `web-ai/context-pack/file-selector.mjs:85-96` and `web-ai/context-pack/file-selector.mjs:144-166`.

### Key Issues

1. **Root browser navigation is not policy-gated.**
   - `skills/browser/browser.mjs:1429-1484` calls `page.goto(url)` and fallback navigation directly.
   - There is no equivalent scheme/origin/private-network validation on generic `agbrowse navigate`.
   - The skipped Antigravity security spec explicitly includes URL allowlist/denylist and `file://` blocking expectations in `test/spec/antigravity-security-contracts.test.mjs:4-13`.

2. **Generic browser MCP scope is intentionally narrow, but some expected security contracts are skipped.**
   - `browser_snapshot` and `browser_click_ref` are live; type/navigate/screenshot/wait are deferred in `web-ai/browser-tool-schema.mjs:69-118`.
   - That is a safe choice, but the skipped security tests show unimplemented security policy expectations for broader browser primitives.

3. **Cookie-bearing generated image download is carefully scoped but still sensitive.**
   - `web-ai/chatgpt-images.mjs:226-247` pulls ChatGPT cookies and sends them in a manual `fetch`.
   - The host/path allowlist reduces risk, but this code should remain under explicit test coverage for redirect behavior, final URL host, and content-type/size limits.

4. **Trace redaction is good but pattern-based.**
   - `web-ai/trace/redact.mjs` redacts common keys and strings, but any new evidence field with sensitive payload and a non-redacted key can leak unless developers remember to use safe names.

### Priority Fix Recommendations

- Add a common browser navigation policy layer for `navigate`, `reload`-driven navigation, and future MCP navigation. At minimum reject `file:`, `javascript:`, `data:`, credential URLs, and private/local origins unless explicitly allowed.
- Unskip or replace `test/spec/antigravity-security-contracts.test.mjs` with executable security tests for the generic browser CLI.
- Add tests for `chatgpt-images` redirect/final URL safety and max image byte cap.
- Add a trace schema allowlist so evidence fields cannot accidentally bypass redaction by key naming.

## 4. Testing - 8 / 10

### Key Strengths

- Full test suite passed:
  - 100 test files passed, 2 skipped
  - 680 tests passed, 12 skipped
  - Duration around 33 seconds
- Test breadth is strong:
  - Unit: browser core, primitives, active tab, adaptive fetch, policy, trace, source audit, session store, action memory, eval, provider contracts.
  - Integration: CLI lifecycle, DOM commands, network/console, install skills, fake ChatGPT, MCP server, policy CLI/MCP, trace fixture.
  - E2E: browser smoke workflow.
  - Spec placeholders: Antigravity gap/security contracts.
- `vitest.config.mjs:5-10` disables file parallelism, which is sensible because Chrome/CDP and shared state are involved.
- Tests include explicit safety contracts:
  - MCP unknown-field rejection in `test/integration/web-ai-mcp-server.test.mjs:52-68`.
  - `unsafeAllow` rejection in `test/integration/web-ai-mcp-server.test.mjs:70-86`.
  - Snapshot ref staleness in `test/integration/web-ai-mcp-server.test.mjs:88-116`.
  - Duplicate ref occurrence handling in `test/integration/web-ai-mcp-server.test.mjs:118-148`.
- Release gates and structure drift checks passed.

### Key Issues

1. **12 skipped tests include important security and parity contracts.**
   - Mouse wheel, screen recording, tool budgets: `test/spec/antigravity-gap-tracking.test.mjs:4-16`.
   - URL allowlist/denylist, `file://` blocking, evaluate allowlist: `test/spec/antigravity-security-contracts.test.mjs:4-13`.

2. **Live provider behavior is inherently fixture-heavy.**
   - The fixture suite is substantial, but ChatGPT/Gemini/Grok UI behavior can regress outside fixtures.
   - This is documented as beta in `structure/CAPABILITY_TRUTH_TABLE.md:28-38`, which is honest.

3. **Root `npm test` passes skipped specs.**
   - Skips are visible, but they do not fail the release. For a "production ready" label, critical security skips should be tracked by a failing gate or removed from the main suite until implemented.

### Priority Fix Recommendations

- Convert skipped Antigravity security specs into executable tests or move them into a separate non-release roadmap file.
- Add a release gate that fails if `test/spec/*security*.test.mjs` contains `it.skip`.
- Add a small live-smoke checklist outside CI for provider DOM selectors, with recorded date and account prerequisites.
- Add package installation smoke from `npm pack` tarball, not just source tree bin shims.

## 5. Documentation - 8 / 10

### Key Strengths

- README is unusually explicit about what is ready, beta, experimental, and out of scope.
- `structure/INDEX.md` is a strong source-of-truth hub and explains which documents govern runtime contracts, release gates, command surfaces, and phase status.
- `structure/CAPABILITY_TRUTH_TABLE.md:15-20` defines ready/beta/experimental/deferred status clearly, and `structure/CAPABILITY_TRUTH_TABLE.md:71-76` forbids hosted/cloud, remote CDP, stealth, and benchmark score claims.
- `structure/runtime_contracts.md` documents the safety model, redaction, policy, MCP scope, and provider status.
- `structure/commands.md` lists CLI and MCP surfaces and explicitly documents deferred MCP tools.
- `docs/EXTERNAL_CDP.md` marks external CDP as deferred, avoiding overclaiming.
- Release docs and gates are aligned: `npm run test:release-gates` passed all drift/count checks.

### Key Issues

1. **MCP server version is stale.**
   - `package.json:2-3` is version `0.1.6`.
   - `web-ai/mcp-server.mjs:278-283` reports `serverInfo.version: '0.1.5-preview'`.
   - This is minor operationally but matters for MCP client diagnostics and package trust.

2. **Docs are extensive enough to become product payload.**
   - Because `package.json:12-21` includes `devlog/`, `structure/`, and `docs/`, internal planning material is shipped to npm. Some of that is useful; all of `devlog/_plan`, `_legacy`, and `_smoke` is probably not.

3. **Some docs are source-of-truth but not user-facing.**
   - The docs are excellent for maintainers, but casual users may have too many status documents and phase references to understand quickly.

### Priority Fix Recommendations

- Derive MCP server version from package metadata or a single constants file.
- Keep `README.md`, selected `docs/`, `structure/commands.md`, and `structure/CAPABILITY_TRUTH_TABLE.md` in the package, but exclude raw devlog planning/smoke artifacts.
- Add a short `docs/quick-errors.md` or README troubleshooting section for the top 10 CLI failures.

## 6. Package & Distribution - 6 / 10

### Key Strengths

- `package.json` has correct basic npm metadata: name, version, license, repository, bugs, homepage, engines.
- Bin scripts are simple and executable:
  - `package.json:8-11` maps `agbrowse` and `agbrowse-vision-click`.
  - `bin/agbrowse.mjs` and `bin/agbrowse-vision-click.mjs` are small shims.
- Runtime dependencies are few: `archiver`, `fast-glob`, `playwright-core`.
- `npm pack --dry-run --json` succeeds.
- `scripts` include dry pack, smoke bins, release preview, release gates, typecheck, JS check, unit/integration/e2e splits.

### Key Issues

1. **Package includes too much internal material.**
   - `package.json:12-21` includes `devlog/`.
   - Dry pack showed 386 entries, 644 KB tarball, 2.3 MB unpacked.
   - The package includes `devlog/_plan`, `devlog/_legacy`, and `devlog/_smoke` artifacts. These are not runtime-critical and can expose internal planning/noise.

2. **No `exports` field.**
   - For a CLI package this is not fatal, but the package also exposes useful modules (`web-ai/*`, `benchmarks/*`) by file path. Without `exports`, consumers can couple to arbitrary internal paths.

3. **Version source is duplicated.**
   - `package.json` is `0.1.6`; MCP server reports `0.1.5-preview`.

4. **Tests are not packaged, but `vitest.config.mjs` is.**
   - `package.json:21` includes `vitest.config.mjs`; the package does not include tests. This is harmless but unnecessary for consumers.

### Priority Fix Recommendations

- Replace broad `devlog/` inclusion with a curated subset or remove it from `files`.
- Add `exports` for intended public module surfaces only, or explicitly document that the package public API is CLI-only.
- Generate runtime version from `package.json` or a committed version module.
- Add a `pack:assert` script that fails when `_plan`, `_smoke`, `_legacy`, or `test/` appear in the tarball.

## 7. Performance - 7 / 10

### Key Strengths

- Browser/CDP connections are cached by port in `skills/browser/tab-manager.mjs:26-31` and reused in `skills/browser/tab-manager.mjs:107-115`.
- Tab lifecycle cleanup protects active sessions, active commands, pinned tabs, and leased tabs before closing anything. See `skills/browser/tab-lifecycle.mjs:79-132` and `skills/browser/tab-lifecycle.mjs:210-262`.
- Tab lease pooling has per-key/global limits and expiration in `web-ai/tab-lease-store.mjs:462-490`.
- Adaptive fetch bounds response size and time:
  - Defaults in `skills/browser/adaptive-fetch/safety.mjs:5-7`.
  - Streaming read limit in `skills/browser/adaptive-fetch/fetcher.mjs:59-86`.
- Browser escalation removes response listeners and closes pages in `skills/browser/adaptive-fetch/browser-escalation.mjs:102-105`.
- Long-running active commands heartbeat and release in `web-ai/active-command-store.mjs:249-271`.

### Key Issues

1. **Raw browser CDP session can leave pending promises unresolved if the websocket closes unexpectedly.**
   - `skills/browser/tab-manager.mjs:160-195` implements a raw WebSocket CDP fallback.
   - It rejects pending requests only on explicit `detach()` at `skills/browser/tab-manager.mjs:190-194`.
   - There is no close/error listener after open that rejects pending requests if the socket dies.

2. **Synchronous filesystem stores may become a bottleneck under multi-process load.**
   - Session, lease, active-command, profile-lock, and tab-activity stores use synchronous reads/writes/renames.
   - This is acceptable for a local CLI but can block commands under concurrent agents.

3. **Lock retry windows are shorter than some stale windows.**
   - `web-ai/active-command-store.mjs:34-37` uses 25 ms * 200 retries = ~5 seconds, but stale lock is 30 seconds.
   - `web-ai/tab-lease-store.mjs:61-64` has the same pattern.
   - A crashed process can cause transient failures before the stale window is reached.

4. **JSON stores are unbounded.**
   - Session store and active command/history files are JSON files. Prune functions exist for sessions, but there is no universal automatic compaction strategy.

### Priority Fix Recommendations

- Add `close`/`error` handlers to raw WebSocket CDP fallback and reject all pending requests.
- Introduce a common file-store helper with async IO and consistent lock stale/retry behavior.
- Add opportunistic compaction/prune for session and lease stores during startup or doctor.
- Add stress tests for concurrent `web-ai query/poll/stop` or active command ownership.

## 8. Developer Experience - 8 / 10

### Key Strengths

- README is easy to start with and has clear command examples.
- `agbrowse skills` and `agbrowse install-skills` are agent-first and explicit. Installer requires `--target` and does not guess, as documented in `skills/browser/skill-install.mjs:75-100`.
- `doctor` concepts exist in both browser and web-AI paths.
- CLI help documents ready/beta/deferred status and recommends state inspection before action.
- Error messages often include concrete fixes:
  - `skills/browser/tab-manager.mjs:94-97` explains installing `playwright-core`.
  - `web-ai/cli.mjs:1059-1087` tells the user how to start/restart headed Chrome.
  - `skills/browser/profile-lock.mjs:41-46` explains the profile lock owner and manual recovery.
- Release gates and structure docs create good maintainer onboarding.

### Key Issues

1. **Main help surface is very large.**
   - `skills/browser/browser.mjs` contains thousands of lines including a long help block, making CLI UX edits risky.

2. **Some errors are structured and some are plain.**
   - Users/agents get highly actionable `WebAiError` in many paths, but raw `Error` elsewhere. This creates inconsistent machine parsing.

3. **Profile lock recovery asks for manual deletion.**
   - `skills/browser/profile-lock.mjs:41-46` is explicit, but a `doctor --fix-lock` or safe stale reclaim UX would be better.

4. **MCP server version mismatch can confuse client diagnostics.**
   - `web-ai/mcp-server.mjs:278-283` reports stale version.

### Priority Fix Recommendations

- Add structured error envelopes to root browser CLI commands, not only web-AI.
- Split help text into command metadata and generate CLI help and docs from the same source.
- Add `agbrowse doctor --fix-stale-locks` or similarly explicit remediation.
- Fix MCP server version source.

## Top 5 Action Items Ranked by Impact

1. **Add generic browser navigation/file/evaluate security policy and unskip security specs.**
   - Impact: highest security hardening.
   - Evidence: `skills/browser/browser.mjs:1429-1484`, `test/spec/antigravity-security-contracts.test.mjs:4-13`.

2. **Stop shipping internal `devlog/` planning/smoke/legacy artifacts in npm package.**
   - Impact: package cleanliness, user trust, lower accidental disclosure.
   - Evidence: `package.json:12-21`; dry pack includes 386 entries and raw `devlog/_plan`, `_legacy`, `_smoke`.

3. **Split `skills/browser/browser.mjs` and `web-ai/cli.mjs` into smaller command/runtime modules.**
   - Impact: architecture, maintainability, regression risk.
   - Evidence: browser command switch around `skills/browser/browser.mjs:2025`; web-AI parse/routing at `web-ai/cli.mjs:353-425`, `web-ai/cli.mjs:520-532`, `web-ai/cli.mjs:952-1031`.

4. **Centralize JSON file-store locking and make stale/retry semantics consistent.**
   - Impact: reliability under concurrent agents.
   - Evidence: repeated lock code in `web-ai/session-store.mjs:135-164`, `web-ai/active-command-store.mjs:85-113`, `web-ai/tab-lease-store.mjs:124-154`, `skills/browser/profile-lock.mjs:36-78`.

5. **Fix version drift and make the release gate check runtime version surfaces.**
   - Impact: package/API correctness and diagnostics.
   - Evidence: `package.json:2-3` is `0.1.6`, but `web-ai/mcp-server.mjs:278-283` reports `0.1.5-preview`.

## Verdict

**needs-work**

Rationale: The project is much stronger than a typical early CLI automation repo. It has a real safety model, real tests, release gates, and honest capability docs. However, skipped security contracts, an unpolicy-gated generic navigation path, oversized core modules, duplicated lock-store logic, npm package bloat, and version drift prevent a clean "ship-ready" verdict for a professional-grade browser automation tool.

It is suitable to ship as a local beta/advanced-user tool with clear caveats. It is not yet ready to market as broadly production-ready or fully hardened.
