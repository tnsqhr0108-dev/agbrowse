# Runway UI Selector Capture — Apps/Custom First

Date: 2026-05-21
Source: logged-in user Chrome session with Runway Unlimited visible
Primary capture note: `/Users/jun/.cli-jaw-3461/runway_selectors_260521.md`

## Why this note exists

The earlier Runway architecture decision established that Runway should not be folded into `web-ai`: its workflow is not "send prompt, wait for text response, extract markdown." It is a media task-runner surface with model selection, generation parameters, asset picking, quota/plan checks, queued jobs, and binary outputs.

This capture narrows the first browser automation target:

- **Deep automation**: `Apps` and `Custom/tools`
- **Surface-only cataloging**: `Agent`, `Recents`, `Workflow`, `Characters`
- **Do not click**: `Generate`, `Run all`, payment, destructive, or submission-like controls during smoke/selector discovery

The user specifically clarified that `Apps` and `Custom` are the relevant Unlimited-plan areas in the logged-in Chrome session. Treat that as the implementation focus, but still verify plan/quota state in-product rather than assuming the label alone proves server-side entitlement.

## Capture method

1. Control employee performed broad Computer Use traversal and wrote the first selector inventory.
2. Codex performed direct Computer Use + Chrome DevTools Console capture for real DOM interactables.
3. Runway CSP blocked page-side POST to localhost capture endpoints, so DevTools `copy(JSON.stringify(...))` was used to copy DOM JSON out through the clipboard.
4. AppleScript JavaScript execution was not enabled in Chrome and was not toggled.

Captured JSON artifacts:

| Artifact | Surface | Items | URL |
|---|---:|---:|---|
| `/tmp/runway-selector-captures-260521/dom-apps.json` | Apps | 65 | `/ai-tools/generate?mode=apps` |
| `/tmp/runway-selector-captures-260521/dom-custom-tools.json` | Custom/tools | 49 | `/ai-tools/generate?mode=tools` |
| `/tmp/runway-selector-captures-260521/dom-sessions.json` | Sessions | 22 | `/ai-tools/generate?mode=sessions` |
| `/tmp/runway-selector-captures-260521/dom-workflow-create.json` | Workflow create | 50 | `/ai-tools/workflows/create` |

## Product scope decision

Runway automation should be a separate task-runner command surface, not `web-ai`.

Acceptable command shapes:

```bash
agbrowse runway generate --app "Seedance 2.0" --prompt "..." --duration 5s --ratio 16:9 --output ./out.mp4
agbrowse media generate --vendor runway --prompt "..." --duration 5s --ratio 16:9 --output ./out.mp4
```

Implementation can choose either `agbrowse runway` for a Runway-first slice or `agbrowse media --vendor runway` for the broader media architecture. What should not happen is overloading `agbrowse web-ai query --vendor runway`, because the output and polling contracts are different.

## Apps selectors

Stable selector priority:

1. `data-testid` when present
2. Playwright role/name locators
3. Placeholder/aria-label locators
4. Dynamic `#react-aria...` ids only as last-resort debug evidence, not committed automation selectors

| Element | Preferred locator | DOM evidence / fallback |
|---|---|---|
| Left sidebar | `page.locator('[data-testid="mira-app-sidebar"]')` | Stable `data-testid` observed |
| Apps sidebar button | `getByRole('button', { name: /^Apps$/ })` | Dynamic `#react-aria...` id observed |
| Custom sidebar button | `getByRole('button', { name: /^Custom$/ })` | Dynamic `#react-aria...` id observed |
| Agent/Recents/Workflow/Characters | `getByRole('button', { name: /^(Agent|Recents|Workflow|Characters)$/ })` | Surface navigation only |
| Add media | `getByRole('button', { name: /^Add media$/ })` | Dynamic id observed |
| Search apps | `getByPlaceholder('Describe your creation or search apps')` | Input placeholder observed |
| Starter Kits tab | `getByRole('tab', { name: 'Starter Kits' })` | DOM id suffix includes `-tab-starter-kits` |
| Custom tab | `getByRole('tab', { name: 'Custom' })` | DOM id suffix includes `-tab-custom` |
| Image tab | `getByRole('tab', { name: 'Image' })` | DOM id suffix includes `-tab-image` |
| Video tab | `getByRole('tab', { name: 'Video' })` | DOM id suffix includes `-tab-video` |
| Audio tab | `getByRole('tab', { name: 'Audio' })` | DOM id suffix includes `-tab-audio` |
| Models tab | `getByRole('tab', { name: 'Models' })` | DOM id suffix includes `-tab-models` |
| Collections tab | `getByRole('tab', { name: 'Collections' })` | DOM id suffix includes `-tab-collections` |
| Unlimited plan indicator | `page.locator('[data-testid="credit-info-button"]')` | Stable `data-testid` observed |
| Quests | `getByRole('button', { name: /Quests/ })` | Dynamic id only |
| Help | `getByRole('button', { name: /^Help$/ })` | Dynamic id only |

Observed Apps model cards in the Models tab include:

- `Seedance 2.0 - Video`
- `GPT Image 2 - Image`
- `Grok Imagine - Image`
- `Gen-4.5 - Video`
- `Kling O3 4K - Video + Audio`
- `Veo 3.1 - Video + Audio`
- `Nano Banana Pro - Image`

Use role locators for cards:

```ts
page.getByRole('button', { name: /^Seedance 2\.0 - Video$/ });
page.getByRole('button', { name: /^Gen-4\.5 - Video$/ });
```

## Custom/tools selectors

Custom/tools is the highest-value first implementation surface because it exposes the actual generation form and parameter controls.

| Element | Preferred locator | DOM evidence / fallback |
|---|---|---|
| Output Image | `getByRole('radio', { name: /^Image$/ })` | input value/name `image` observed |
| Output Video | `getByRole('radio', { name: /^Video$/ })` | input value/name `video` observed |
| Output Audio | `getByRole('radio', { name: /^Audio$/ })` | input value/name `audio` observed |
| Multi-reference | `getByRole('radio', { name: /^Multi-reference$/ })` | input value/name `multi-reference` observed |
| Keyframe | `getByRole('radio', { name: /^Keyframe$/ })` | input value/name `keyframe` observed |
| File input | avoid direct click unless upload is requested | `input[type="file"]` observed |
| Reference button | `getByRole('button', { name: /^Reference$/ })` | Dynamic id only |
| Prompt editor | `page.locator('div[aria-label="Prompt"]')` | Stable aria-label observed |
| See Guide | `getByRole('link', { name: /^See Guide$/ })` | Help-center href observed |
| Presets | `getByRole('button', { name: /^Presets$/ })` | Dynamic id only |
| References toggle | `getByRole('button', { name: /^References$/ })` | Dynamic id only |
| Audio settings | `getByRole('button', { name: /^Audio settings$/ })` | Dynamic id only |
| Aspect ratio | `getByRole('button', { name: /^Aspect ratio$/ })` | options include `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16` |
| Resolution | `getByRole('button', { name: /^Resolution$/ })` | options include `480p`, `720p`, `1080p` |
| Duration | `getByRole('button', { name: /^Duration$/ })` | options include `4 seconds` through `15 seconds` |
| View generation cost | `getByRole('button', { name: /^View generation cost$/ })` | Cost preflight candidate |
| Helpful Apps | `page.locator('#related-apps-trigger')` | Stable id observed |
| Video models | `page.locator('[data-testid="select-base-model"]')` | Stable `data-testid` observed |
| Unlimited indicator | `page.locator('[data-testid="credit-info-button"]')` | Same as Apps |
| Session title | `page.locator('[data-testid="session-title-without-session"]')` | Session title container observed |
| Rename session | `page.locator('button[title="Click to rename"]')` | Stable title observed |
| Generate | `getByRole('button', { name: /^Generate$/ })` | Selector only; do not click in smoke/discovery |

## Surface-only areas

These surfaces should remain low-depth until there is a user story that justifies deeper automation.

| Surface | Role in first implementation | Reason |
|---|---|---|
| Agent | Surface read + optional prompt injection | Agent flow is conversational/outline-oriented and not the Unlimited-critical area |
| Recents | Asset library read/list only | Better handled as job/result library later |
| Workflow | Template/canvas surface read only | Node graph UI is not robust for generic agent automation |
| Characters | Catalog read/select only | Useful as future input source, not first generation target |

## Implementation implications

1. First Runway browser provider should target `Apps` and `Custom/tools` only.
2. Build a plan/quota preflight around `credit-info-button`, visible Unlimited text, and `View generation cost`.
3. Treat React Aria ids as unstable and avoid committing them into tests.
4. Smoke tests must assert selectors and state changes but never trigger `Generate`.
5. Add a destructive/paid-action guard in the future provider before any submit-like button can be clicked.
6. Keep output contract media/job-shaped:

```ts
type RunwayResult = {
  ok: boolean;
  vendor: 'runway';
  surface: 'apps' | 'custom-tools';
  status: 'prepared' | 'submitted' | 'running' | 'complete' | 'blocked';
  sessionUrl?: string;
  outputFiles?: string[];
  quota?: {
    planLabel?: string;
    generationCostText?: string;
  };
};
```

## Verification notes

- DOM JSON validated with `jq`.
- `Apps` and `Custom/tools` captures were taken from the logged-in Chrome profile.
- `Generate`, `Run all`, payment, and destructive actions were not clicked.
- Temporary localhost capture server was stopped after capture.
