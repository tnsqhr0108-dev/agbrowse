---
name: vision-click
description: "Vision-based coordinate click: screenshot → Codex CLI (NDJSON) → DPR correction → mouse click. Codex CLI only."
---

# Vision Click (Codex CLI)

Click non-DOM elements by screenshot analysis using Codex CLI.

## Quick Start

```bash
agent-browser-vision-click "Submit button"
agent-browser-vision-click "Play icon" --double
agent-browser-vision-click "first search result row" --prepare-stable --region left-panel --verify-before-click
```

## Prerequisites

- **agent-browser** running Chrome (`agent-browser start`)
- **Codex CLI** installed (`npm install -g @openai/codex`)

## When to Use

Use when `agent-browser snapshot` returns **NO ref** for target:
- Canvas elements, cross-origin iframes, Shadow DOM
- Dynamically rendered content (WebGL, SVG)
- Elements behind overlays or custom web components

> **Always try `snapshot --interactive` first.** Only fall back to vision-click if no usable ref exists.

## Pipeline

```
1. agent-browser snapshot --interactive  → Check if target has a ref ID
2. If ref exists → agent-browser click <ref>  (normal path, preferred)
3. If NO ref → vision-click fallback:
   a. agent-browser screenshot --json     → { path, dpr, viewport }
   b. optional stable viewport / clip   → more deterministic framing
   c. codex exec -i <path> --json       → NDJSON events → { found, x, y }
   d. optional verify crop              → second-pass confirmation near center
   e. DPR correction: x/dpr, y/dpr      → CSS pixels
   f. agent-browser mouse-click <x> <y>   → click
   g. agent-browser snapshot              → verify
```

## How It Works

`codex exec --json` emits NDJSON (newline-delimited JSON) events:

```jsonl
{"type":"thread.started","thread_id":"..."}
{"type":"turn.started"}
{"type":"item.completed","item":{"type":"agent_message","text":"{\"found\":true,\"x\":522,\"y\":82,\"description\":\"search button\"}"}}
{"type":"turn.completed","usage":{"input_tokens":16964,"output_tokens":542}}
```

The coordinate JSON is extracted from the `item.completed` event's `item.text` field.

## Examples

```bash
# Basic click
agent-browser-vision-click "Login button"

# Double-click
agent-browser-vision-click "Canvas play icon" --double

# Custom CDP port
agent-browser-vision-click "Submit" --port 9333

# Custom browser script path
agent-browser-vision-click "Menu" --browser-script /path/to/browser.mjs

# Accuracy-first mode for dense UIs
agent-browser-vision-click "first search result row" --prepare-stable --region left-panel --verify-before-click

# Manual clip when you know the rough area
agent-browser-vision-click "zoom button" --clip 980 120 220 220
```

## Accuracy Tips

- Start with `--prepare-stable` to normalize the viewport before capture.
- Use `--region left-panel` for search result panels and `--region center-map` for map canvas targets.
- Use `--verify-before-click` on dense UIs where a wrong click is expensive.
- If you already know the rough target area, `--clip x y w h` is more reliable than full-screen analysis.

## Environment Variables

| Variable           | Default                  | Description          |
| ------------------ | ------------------------ | -------------------- |
| `BROWSER_SCRIPT`   | `../browser/browser.mjs` | Path to browser.mjs  |
| `CDP_PORT`         | `9222`                   | Chrome CDP port      |

## DPR (Device Pixel Ratio) Correction

Retina displays (DPR=2) produce screenshots at 2x resolution.
Codex returns coordinates in image pixel space.
`vision-click` auto-divides by DPR before passing to `mouse-click`.

```
raw: (600, 200)  DPR=2  →  css: (300, 100)  →  mouse-click 300 100
```

## Limitations

- Requires codex CLI (GPT vision) — no other providers
- Latency: 3-10 seconds per call (model inference)
- English target descriptions work best; Korean can fail on some elements
- Complex dense UIs may need `--region`, `--clip`, or `--verify-before-click`
