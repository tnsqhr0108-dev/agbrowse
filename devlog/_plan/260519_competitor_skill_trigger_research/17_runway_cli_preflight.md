# Runway CLI Preflight Slice

Date: 2026-05-27
Status: implemented as the first safe command surface

## Why this slice exists

The 2026-05-21 selector capture established that Runway is not a `web-ai`
provider. It is a media task-runner with Apps, Custom/tools, quota state, model
selection, asset inputs, and submission buttons.

This slice converts that capture into a real `agbrowse runway` command without
crossing the paid/submission boundary. A later update added a read-only poll
command for live smoke verification after a user-authorized submit.

## Command surface

```bash
agbrowse runway selectors --surface apps
agbrowse runway selectors --surface custom-tools --json
agbrowse runway status --surface auto --json
agbrowse runway open --surface apps --json
agbrowse runway preflight --surface custom-tools --json
agbrowse runway poll --timeout 600000 --interval 5000 --queue-limit 2 --json
```

## Scope

Deep target surfaces:

- `apps`
- `custom-tools`

Surface-only areas remain documented but are not opened by this first slice:

- `agent`
- `recents`
- `workflow`
- `characters`

## Safety contract

The command is read-only except for navigation in `open` and `preflight`.
`poll` is also read-only: it watches active queue/completion signals after a
generation has already been submitted by an explicitly authorized flow.

It must never click:

- `Generate`
- `Run all`
- payment controls
- destructive controls
- submit-like controls

The `generate` selector is present in the static contract only as a blocked
selector so future implementation has to opt into a separate submit guard.

## Implementation notes

New module:

- `skills/browser/runway.mjs`
- `skills/browser/runway-monitor.mjs`

CLI integration:

- `skills/browser/browser.mjs` adds the top-level `runway` command.

Docs/tests:

- `skills/browser/SKILL.md` includes Runway-specific routing guidance.
- `test/unit/runway-cli.test.mjs` covers the selector contract, surface
  detection, page inspection envelope, open/preflight mutation guard, and
  queue/completion poll contract.
- `test/integration/cli-help.test.mjs` covers the CLI help surface.

## Output contract

`status`, `open`, and `preflight` return a media/job-shaped envelope:

```json
{
  "ok": true,
  "vendor": "runway",
  "command": "status",
  "surfaceRequested": "auto",
  "surfaceDetected": "custom-tools",
  "deepAutomationTarget": true,
  "quota": {
    "creditInfoText": "Unlimited",
    "hasUnlimitedText": true,
    "hasGenerationCostText": true
  },
  "safety": {
    "mutationAllowed": false
  }
}
```

## Next implementation step

The next slice should add a guarded `prepare` command for Custom/tools that can
fill prompt/model/ratio/duration fields but still stops before `Generate`.
Submission should stay behind an explicit separate guard and a user-visible cost
preflight.
