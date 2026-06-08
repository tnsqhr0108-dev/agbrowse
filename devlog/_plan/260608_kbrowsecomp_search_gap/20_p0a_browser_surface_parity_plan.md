# 20. P0a Browser Surface Parity Plan

## Scope

Implement only the P0a mirror-required browser command surface:

```text
active-tab --json
new-tab <url> [--no-activate] [--json]
tab-close <targetId> [--json]
vision-click routing in main help/skill surface
```

This phase does not implement `research plan`, search backend normalization,
fetch enrichment, or browse escalation logic. Those are P1-P4.

## Current Source Facts

Observed in `skills/browser/browser.mjs`:

- `new-tab` exists but only reads `process.argv[3]`, activates implicitly, and
  always prints human text.
- `tab-close` exists but always prints human text and has no JSON envelope.
- `active-tab` does not exist as a command.
- `agbrowse-vision-click` exists as a separate bin/skill, and main help
  mentions it only under a short Vision click section.

## Implementation

### MODIFY `skills/browser/browser.mjs`

Add command handling:

```text
active-tab --json
```

Behavior:

- Does not mutate browser state.
- Uses `browser.mjs` as the active-target source of truth, because persisted
  `activeTargetId` is owned by `readPersistedState()` and the local
  `getActivePage()` helper in this file.
- Returns the current active page plus persisted tab metadata where available.
- JSON output is mandatory for `active-tab`; human output may be a concise
  fallback.

Update existing command handling:

```text
new-tab <url> [--no-activate] [--json]
tab-close <targetId> [--json]
```

Behavior:

- `new-tab` defaults to activating the new tab.
- `--no-activate` creates the tab without marking it active when supported by
  the existing `createTab` options.
- `--json` returns a structured envelope.
- `tab-close --json` returns the `closeTab` result.

Update help text:

- Add `active-tab --json`.
- Add `new-tab <url> [--no-activate] [--json]`.
- Add `tab-close <targetId> [--json]`.
- Expand Vision click to make the no-DOM-ref route explicit:

```text
Use agbrowse-vision-click when snapshot refs are unavailable.
```

### MODIFY `skills/browser/tab-manager.mjs`

Use this only if a small helper is needed for tab row formatting. Do not make
`tab-manager.mjs` the source of truth for active target selection, because its
private `getActivePage()` does not read `browser.mjs` persisted active state.

### MODIFY `skills/browser/SKILL.md`

Document the P0a workflow:

- Use `tabs --json` / `active-tab --json` before mutating when multiple tabs
  exist.
- Use `new-tab --no-activate` to stage candidate pages.
- Use `tab-close --json` after candidate verification.
- Use `agbrowse-vision-click` only after snapshot/ref paths fail.

### MODIFY `test/integration/cli-help.test.mjs`

Assert the main help exposes:

- `active-tab --json`
- `new-tab <url>`
- `--no-activate`
- `tab-close <targetId>`
- `agbrowse-vision-click`

### MODIFY or ADD unit/integration tests

Prefer source-level tests when live CDP is not required:

- Verify `new-tab` command source declares `--no-activate` and `--json`.
- Verify `tab-close` command source declares `--json`.
- Verify `active-tab` command source exists.
- Verify help output includes the P0a surface.

### MODIFY `structure/commands.md`

Add `active-tab` to the root navigation/tab command registry and note that
`new-tab` / `tab-close` now expose JSON/parity flags.

### MODIFY `structure/str_func.md`

Update line-count/source-map rows touched by this implementation:

- `skills/browser/` aggregate
- `skills/browser/browser.mjs`
- `skills/browser/SKILL.md`
- any other touched tracked source/doc row already listed there

## Verification

Run:

```bash
npx vitest run test/integration/cli-help.test.mjs test/unit/browser-active-tab.test.mjs --reporter=verbose
npm run typecheck:checkjs
npm run test:release-gates
git diff --check
```

If command logic can be exercised without launching Chrome, add a focused unit
test. Do not start a visible browser for this phase unless required by an
existing test harness.

## Acceptance Criteria

- `agbrowse --help` exposes the P0a browser surface.
- `skills/browser/SKILL.md` teaches the same tab/vision fallback workflow.
- `new-tab` and `tab-close` have JSON output.
- `new-tab` supports `--no-activate`.
- `active-tab --json` exists as a read-only truth surface and reports the same
  persisted active target that normal browser commands use.
- `structure/commands.md` and `structure/str_func.md` are updated when touched
  source counts or command registry entries change.
- No P1-P4 research behavior is implemented in this phase.
