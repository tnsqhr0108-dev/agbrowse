# Agent-Safe Update Notice Plan

## Goal

Add a lightweight `agbrowse` update notice for agent-run global CLI installs.

When a user or agent runs an older `agbrowse` version, the CLI should emit a
short stderr advisory that a newer npm version exists and that the agent should
tell the user before updating the global CLI. The notice must never corrupt JSON
stdout contracts, MCP stdio, CI logs, or help output.

## Decisions

- Notice channel: stderr only.
- Notice copy:
  - `[agbrowse] new version is available: <current> -> <latest>`
  - `[agbrowse] npm install -g agbrowse@latest to update`
  - `[agbrowse] tell the user before updating this global CLI`
  - `[agbrowse] set AGBROWSE_UPDATE_CHECK=0 to hide this notice`
- Default cache TTL: 24 hours.
- Disable env: `AGBROWSE_UPDATE_CHECK=0`.
- Force/mock envs for tests and local diagnosis:
  - `AGBROWSE_UPDATE_CHECK=1`
  - `AGBROWSE_UPDATE_CHECK_TTL=<duration>`
  - `AGBROWSE_UPDATE_CHECK_LATEST=<semver>`
- Skip by default for:
  - any truthy `CI` value, including GitHub Actions `CI=true`
  - `--json`
  - `AGBROWSE_JSON_ERRORS=1`
  - root help/no command/unknown command
  - any command containing `--help`
  - `skills`, `install-skills`, `research`
  - `web-ai mcp-server`
  - any `web-ai` command with `--json`
- First pass scope: `agbrowse` main CLI only. `agbrowse-vision-click` remains out
  of scope.
- No auto-update command is executed by agbrowse.
- No release/publish is performed in this PABCD pass; this prepares a patch
  release candidate.

Precedence:

1. `AGBROWSE_UPDATE_CHECK=0` always disables the notice.
2. `AGBROWSE_UPDATE_CHECK=1` enables the notice even when `CI` is set, so tests
   can force the path.
3. Without either value, skip in CI and for all JSON/MCP/help-safe surfaces.

## Repo Facts

- `bin/agbrowse.mjs` is a thin wrapper that imports
  `skills/browser/browser.mjs`.
- `skills/browser/browser.mjs` owns the root CLI dispatch.
- JSON contracts are common across `tabs --json`, browser action commands, and
  `web-ai ... --json`.
- MCP stdio lives behind `agbrowse web-ai mcp-server`.
- Package release already uses GitHub Actions npm Trusted Publishing/OIDC; this
  change does not require `NPM_TOKEN` or release workflow edits.

## File Plan

### NEW `skills/browser/update-check.mjs`

Implement a small dependency-injected update checker:

- reads current version from `package.json`;
- checks npm latest using Node `fetch` against
  `https://registry.npmjs.org/agbrowse/latest`;
- uses `AbortSignal.timeout` for a short network timeout;
- stores cache at `$BROWSER_AGENT_HOME/update-check.json`;
- treats cache read/write failures as non-fatal;
- compares semver without adding dependencies;
- returns a list of notice lines instead of writing directly;
- exposes helpers for unit tests:
  - `parseDurationMs`
  - `compareSemver`
  - `shouldSkipUpdateNotice`
  - `getUpdateNoticeLines`
  - `maybeEmitUpdateNotice`

### MODIFY `skills/browser/browser.mjs`

Import `maybeEmitUpdateNotice` from `./update-check.mjs` and call it once near
the CLI dispatch entrypoint before the switch:

```js
await maybeEmitUpdateNotice({
    argv: process.argv.slice(2),
    dataDir: DATA_DIR,
    packageRoot: PACKAGE_ROOT,
});
```

Errors are swallowed by the update checker so normal browser/web-ai commands are
not blocked by npm registry or filesystem issues.

### NEW `test/unit/browser-update-check.test.mjs`

Cover pure behavior without live npm:

- semver comparison handles equal, newer, prerelease-ish, and invalid versions;
- duration parser handles `24h`, `30m`, numbers, and fallback;
- skip policy suppresses CI, JSON, help, skills/install/research, and MCP stdio;
- notice lines are returned when latest is greater than current;
- no notice is returned when local is current;
- cache suppresses refetch inside TTL;
- stale cache refetches;
- mock latest env bypasses network for CLI integration tests.

### MODIFY `test/integration/cli-help.test.mjs`

Add CLI smoke assertions:

- `AGBROWSE_UPDATE_CHECK_LATEST=9.9.9 agbrowse status` emits the stderr notice
  without touching stdout JSON;
- `AGBROWSE_UPDATE_CHECK_LATEST=9.9.9 agbrowse tabs --json` emits no notice;
- `AGBROWSE_UPDATE_CHECK_LATEST=9.9.9 agbrowse web-ai mcp-server` is not run as a
  long process; skip policy is covered in unit tests instead.

If `status` requires a browser state check but no browser process, that is fine:
it exits normally and prints `running: false`.

### MODIFY `test/helpers/exec-browser.mjs`

Set `AGBROWSE_UPDATE_CHECK=0` by default for ordinary CLI integration tests so
local test runs do not hit npm. Preserve caller overrides so the dedicated update
notice tests can force `AGBROWSE_UPDATE_CHECK=1`.

### MODIFY `README.md`

Add a short install/update note near the install section:

- older global installs may print an agent-readable stderr update notice;
- update command is `npm install -g agbrowse@latest`;
- agents should tell the user before updating;
- `AGBROWSE_UPDATE_CHECK=0` disables the notice.

Also add the update-check environment variables to the README environment table
for agent discoverability.

### MODIFY `skills/browser/browser.mjs` help text

Add update-check environment variables to the root help environment block. This
keeps `agbrowse --help` aligned with README without changing command behavior.

### MODIFY `structure/runtime_contracts.md`

Add an update notice row to runtime contracts:

- cache file under `BROWSER_AGENT_HOME`;
- stderr-only;
- JSON/MCP/CI skip;
- no auto-update.

### MODIFY `structure/release_gates.md`

Add update notice tests to release gate meaning so future release checks preserve
the stdout/JSON/MCP boundaries.

### MODIFY `structure/str_func.md`

Run `npm run fix:counts` after adding the new module/test/devlog docs.

### MODIFY `devlog/00_index.md`

Add `_plan/260622_update_notice/` as active during implementation. Move to
`_fin/` only after the implementation is verified and committed.

## Verification Plan

Focused checks:

- `node --check skills/browser/update-check.mjs`
- `node --check skills/browser/browser.mjs`
- `npx vitest run test/unit/browser-update-check.test.mjs`
- `npx vitest run test/integration/cli-help.test.mjs`

Release/doc checks:

- `npm run typecheck`
- `npm run test:release-gates`
- `npm run smoke:bins`
- `npm run gate:all`
- `npm pack --dry-run --json`
- `git diff --check`

No push or publish will be performed without a separate explicit user request.

## Acceptance Criteria

- Older version advisory is visible to agents on ordinary non-json CLI runs.
- JSON stdout remains parseable with no notice noise.
- MCP server command is not contaminated by update notice output.
- npm registry failure or timeout never blocks a normal agbrowse command.
- Cache prevents frequent registry checks.
- Docs explain how to update and how to suppress the notice.
- Release gates pass and the change is committed locally.

## Final Closeout Evidence

Status: implemented and verified locally.

Implementation paths:

- `skills/browser/update-check.mjs`
- `skills/browser/browser.mjs`
- `test/helpers/exec-browser.mjs`
- `test/unit/browser-update-check.test.mjs`
- `test/integration/cli-help.test.mjs`
- `README.md`
- `structure/runtime_contracts.md`
- `structure/release_gates.md`
- `structure/str_func.md`
- `devlog/00_index.md`

Verification evidence:

- Plan audit: Backend PASS after explicit audit of this update-notice plan.
- Build verification: Backend DONE after checking implementation, docs, tests,
  skip policy, imports, and syntax.
- Final focused verification: Backend DONE after confirming `AGBROWSE_UPDATE_CHECK=1`
  help docs, additional skip tests, `verify-counts.sh`, and syntax checks.
- Focused tests: `npx vitest run test/unit/browser-update-check.test.mjs test/integration/cli-help.test.mjs`
  passed 2 files / 16 tests.
- Syntax: `node --check skills/browser/update-check.mjs` and
  `node --check skills/browser/browser.mjs` passed.
- Typecheck: `npm run typecheck` passed.
- Structure docs: `npm run test:release-gates` passed.
- Bin smoke: `npm run smoke:bins` passed.
- Full release gates: `npm run gate:all` passed all 16 gates.
- Package dry-run: `npm pack --dry-run --json` passed and includes
  `skills/browser/update-check.mjs`.
- Whitespace: `git diff --check` passed.
- Audit: `npm audit --audit-level=high` passed with only an existing low-severity
  esbuild advisory below the high gate.

No push or npm publish was performed in this PABCD pass.
