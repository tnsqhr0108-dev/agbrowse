---
name: browser
description: "Chrome browser control: open pages, take ref snapshots, click, type, screenshot. No external server required."
---

# Browser Control

Control Chrome browser via `agent-browser` commands.
Uses ref-based snapshots to identify page elements, then click/type by ref ID.

## Prerequisites

- Node.js 18+
- Google Chrome (or Chromium/Brave) installed
- `playwright-core` installed:

```bash
cd <project-root>
npm install playwright-core
```

## Quick Start

```bash
agent-browser start                               # Start Chrome (CDP auto port)
agent-browser start --headless                    # Headless mode (server/CI/WSL)
agent-browser navigate "https://example.com"      # Go to URL
agent-browser snapshot --interactive              # Interactive elements with ref IDs
agent-browser click e3                            # Click ref e3
agent-browser type e5 "hello" --submit           # Type + Enter
agent-browser screenshot                          # Save screenshot
agent-browser reload                              # Reload current page
```

For AI provider websites, use the bundled `web-ai` skill/command instead of
raw click/type sequences when possible:

```bash
agent-browser web-ai status --vendor chatgpt
agent-browser web-ai query --vendor gemini --url https://gemini.google.com/app --inline-only --prompt "Reply exactly OK"
```

## Core Workflow

> **Always follow this pattern:**
> 1. `snapshot --interactive` → See elements + ref IDs
> 2. `click`/`type`/`press`/`select` → Interact using ref
> 3. `snapshot` → Verify result → Repeat

## Commands

### Browser Management

```bash
agent-browser start [--port <9222>] [--headless] [--chrome-path /path/to/chrome]
agent-browser stop
agent-browser status
agent-browser reset [--force]
```

### Observe

```bash
agent-browser snapshot                # Ref snapshot (all elements)
agent-browser snapshot --interactive  # Interactive elements only (recommended)
agent-browser snapshot --max-nodes 30 # Limit output for token budget
agent-browser screenshot              # Current viewport
agent-browser screenshot --full-page  # Full page
agent-browser screenshot --ref e5     # Specific ref element only
agent-browser screenshot --clip 0 0 320 180  # Clipped region in CSS pixels
agent-browser screenshot --json       # JSON output (path, dpr, viewport)
agent-browser text                    # Page text content
agent-browser text --format html      # HTML source
agent-browser get-dom                 # Full DOM HTML
agent-browser get-dom --selector ".card" --max-chars 2000
agent-browser console --clear --reload --duration 3000 # Buffered console logs
agent-browser network --reload --duration 1000         # Fresh page-load + async requests
```

### Snapshot Output Example

```
e1   link       "Gmail"
e2   link       "Images"
e3   textbox    "Search"           ← To type here: type e3 "query"
e4   button     "Google Search"    ← To click: click e4
e5   button     "I'm Feeling Lucky"
```

### Act

```bash
agent-browser click e3              # Click element
agent-browser click e3 --double     # Double-click
agent-browser click e3 --right      # Right-click / context menu
agent-browser type e3 "hello"       # Type text
agent-browser type e3 "hello" --submit  # Type + press Enter
agent-browser press Enter           # Press key
agent-browser press Escape
agent-browser press Tab
agent-browser hover e5              # Mouse hover
agent-browser select e7 "option1"   # Select dropdown option
agent-browser drag e3 e5            # Drag element to another
agent-browser move-mouse 400 300    # Move mouse only
agent-browser mouse-down            # Hold left mouse button
agent-browser mouse-up --right      # Release right mouse button
agent-browser mouse-click 400 300   # Click at pixel coordinates
```

### Navigate & Scroll

```bash
agent-browser navigate "https://example.com"  # Go to URL
agent-browser reload                           # Reload current page
agent-browser resize 1440 900                 # Resize browser window
agent-browser resize 0 0 --fullscreen         # Fullscreen or 1920x1080 viewport fallback
agent-browser tabs                             # List tabs
agent-browser tab-switch 2                     # Switch to tab 2
agent-browser scroll down                      # Scroll down 500px
agent-browser scroll up --amount 1000          # Scroll up 1000px
agent-browser scroll --ref e15                 # Scroll element into view
agent-browser evaluate "document.title"        # Execute JS
```

### Wait & Sync

```bash
agent-browser wait 2000              # Wait 2 seconds
agent-browser wait-for e5            # Deprecated: wait for last-snapshot ref
agent-browser wait-for-selector ".toast-success" --timeout 30000
agent-browser wait-for-text "Dashboard" --timeout 30000
```

## Common Workflows

### Web Search

```bash
agent-browser start
agent-browser navigate "https://www.google.com"
agent-browser snapshot --interactive
# → e3 textbox "Search"
agent-browser type e3 "search query" --submit
agent-browser snapshot --interactive
# Click desired result link
agent-browser click e7
```

### Form Filling

```bash
agent-browser snapshot --interactive
# → e1 textbox "Name", e2 textbox "Email", e3 button "Submit"
agent-browser type e1 "John Doe"
agent-browser type e2 "john@example.com"
agent-browser click e3
agent-browser snapshot  # Verify result
```

### SPA Login Flow

```bash
agent-browser navigate "https://app.example.com/login"
agent-browser snapshot --interactive
agent-browser type e1 "user@example.com"
agent-browser type e2 "password"
agent-browser click e3                    # Login button
agent-browser wait-for-text "Dashboard" --timeout 15000
agent-browser snapshot --interactive      # Verify logged in
```

### Long Page with Scrolling

```bash
agent-browser navigate "https://news.ycombinator.com"
agent-browser snapshot --interactive --max-nodes 20  # First 20 items
agent-browser scroll down
agent-browser snapshot --interactive --max-nodes 20  # Next items
```

### Multi-Tab Workflow

```bash
agent-browser navigate "https://docs.example.com"  # Tab 1
agent-browser evaluate "window.open('https://api.example.com')"  # Tab 2
agent-browser tabs                  # List tabs
agent-browser tab-switch 2          # Switch to tab 2
agent-browser snapshot --interactive
```

### Inspect DOM / Console / Network

```bash
agent-browser navigate "https://example.com"
agent-browser get-dom --selector "main" --max-chars 4000
agent-browser console --clear --expression "console.log('probe')"
agent-browser network --reload --duration 2000 --filter example
```

## Recovery Strategy

If something goes wrong, follow this escalation path:

1. **`snapshot` fails** → Try `screenshot` for visual inspection
2. **Ref not found** → Re-run `snapshot --interactive` (refs reset on navigation and can go stale after page changes)
3. **CDP connection fails** → `status`, then `start` if Chrome is not running
4. **Chrome frozen** → ask before `reset --force`; reset deletes local browser state
5. **Fullscreen resize falls back in headless mode** → The command uses a 1920x1080 viewport fallback when window APIs are unavailable
6. **DOM ref unavailable** (Canvas/WebGL/Shadow DOM) → Use `vision-click` skill after confirming no usable ref exists

## Environment Variables

| Variable             | Default            | Description                               |
| -------------------- | ------------------ | ----------------------------------------- |
| `BROWSER_AGENT_HOME` | `~/.browser-agent` | Data directory (profile, screenshots)     |
| `CDP_PORT`           | `9222`             | Default Chrome DevTools Protocol port     |
| `CHROME_HEADLESS`    | `0`                | Set to `1` for headless mode              |
| `CHROME_NO_SANDBOX`  | `0`                | Set to `1` to disable sandbox (Docker/CI) |
| `CHROME_BINARY_PATH` | auto-detect        | Override Chrome/Chromium executable path  |

## Headless Mode (Server/CI/WSL)

```bash
agent-browser start --headless               # CLI flag
CHROME_HEADLESS=1 agent-browser start         # env var
```

- GUI 없는 환경(WSL, SSH, Docker, CI)에서 사용
- `--headless=new` (Chrome 112+) 사용 — full browser 기능 유지

## Troubleshooting

| Symptom                          | Cause                               | Fix                                            |
| -------------------------------- | ----------------------------------- | ---------------------------------------------- |
| CDP connection refused           | Chrome running with default profile | Close all Chrome, retry or `browser.mjs reset` |
| Windows: only test browser opens | Chrome singleton absorbs launch     | Close all Chrome → `browser.mjs start`         |
| Headless CDP not opening         | `--headless` not specified          | Add `--headless` flag                          |
| Port conflict                    | Other process on CDP port           | Use `--port <other>`                           |
| Fullscreen resize falls back     | Headless / unsupported window APIs  | Expected: command switches to a 1920x1080 viewport fallback |
| Snapshot returns many nodes      | Large page, token waste             | Use `--interactive --max-nodes 30`             |

## Notes

- Ref IDs come from the **last snapshot** and reset on navigation. Always re-run `snapshot` after `navigate`, `reload`, tab switches, or any action that changed the page.
- Prefer `wait-for-selector` or `wait-for-text` for async UI state. `wait-for <ref>` only works against the last persisted snapshot and is deprecated.
- Use `--interactive` to show only clickable/typeable elements (shorter list).
- Use `--max-nodes N` to cap output for token budget.
- Screenshots are saved to `~/.browser-agent/screenshots/`.
- Default CDP port is `9222`. Override with `--port` or `CDP_PORT` env var.
- `start --chrome-path /path/to/chrome` and `CHROME_BINARY_PATH` both override auto-detection.
- If CDP is already responding on the port, `start` reuses the existing instance.
- CDP reconnection uses exponential backoff (1s → 2s → 4s → 8s).
- `console` reads a page-side buffer. Use `--clear` before a flow and `--reload` if you want logs from a fresh navigation.
- `network` merges current page performance entries with optional live CDP capture. Use `--duration 0` for a fast current-state dump only, add a non-zero duration with `--reload` if the page triggers late `fetch`/XHR activity, and use `--live-only` to skip performance history.
- Non-DOM elements (Canvas, iframe, Shadow DOM): use **vision-click** skill.
