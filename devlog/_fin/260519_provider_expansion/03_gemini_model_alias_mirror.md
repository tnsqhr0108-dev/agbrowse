# Gemini Model Alias + cli-jaw Mirror

> Date: 2026-05-19
> Scope: agbrowse Gemini Web UI model aliases, then cli-jaw `browser web-ai` mirror

## Why

Gemini's visible Web UI labels changed from old generic wording to versioned
labels such as `3.1 Flash-Lite`, `3 Flash`, and `3.1 Pro`. The runtime should
not pin command aliases to `3.1` because Gemini 3.n labels can move again.

## agbrowse Changes

Files updated:

- `web-ai/gemini-model.mjs`
- `web-ai/cli.mjs`
- `test/unit/web-ai-gemini-contract.test.mjs`
- `README.md`
- `skills/web-ai/SKILL.md`

Behavior:

- Primary aliases are now `flash-lite`, `flash`, and `pro`.
- Compatibility aliases remain:
  - `fast` -> `flash-lite`
  - `thinking` / `think` -> `pro`
- Versioned labels normalize generically:
  - `3.1 Flash-Lite` -> `flash-lite`
  - `3 Flash` -> `flash`
  - `3.1 Pro`, `3.2 Pro`, or later `3.n Pro` -> `pro`
- `deepthink` remains a separate Gemini tool/mode path, not a plain model alias.

## cli-jaw Mirror

The same alias contract is mirrored in cli-jaw's `browser web-ai` implementation
instead of changing unrelated Gemini API/model registries.

Target files:

- `src/browser/web-ai/gemini-model.ts`
- `bin/commands/browser-web-ai.ts`
- `tests/unit/browser-web-ai-gemini-live-policy.test.ts`
- `skills_ref/web-ai/SKILL.md`

## Verification

agbrowse verification completed before the mirror:

- Backend employee verification: DONE
- `npx vitest run test/unit/web-ai-gemini-contract.test.mjs`
- `npm run smoke:bins`
- `npm run test:smoke`
- `npm run test:unit`
- `npm run typecheck:checkjs`
- `npm run typecheck`
- render smoke for `flash-lite`, `flash`, `pro`, and `3.2 Pro`

cli-jaw verification is tracked in the cli-jaw devlog mirror folder.

Final cli-jaw mirror result:

- Backend employee verification: DONE, no mirror findings.
- cli-jaw focused web-ai tests: passed.
- cli-jaw typecheck: passed.
- cli-jaw API smoke: passed after starting a temporary local server.
- cli-jaw `structure/verify-counts.sh`: initially exposed unrelated stale
  structure counts, then was aligned after the user asked to commit all dirty
  work. Final result: 49/49 PASS.
