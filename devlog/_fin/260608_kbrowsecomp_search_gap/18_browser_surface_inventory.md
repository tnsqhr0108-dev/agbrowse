# 18. Browser Surface Inventory

## Purpose

P0a is an A/B inventory of the agent-visible browser surfaces:

- A = `cli-jaw browser`
- B = standalone `agbrowse`

The goal is not to force every cli-jaw server operation into agbrowse. The goal
is to keep the browse/search workflow teachable across both systems:

```text
query planning -> search URL candidates -> fetch -> browser verification
```

An employee should not need one mental model inside cli-jaw and another mental
model after installing agbrowse as a standalone skill.

## Sources Checked

Observed on 2026-06-09:

```text
cli-jaw browser --help
node bin/agbrowse.mjs --help
skills/browser/browser.mjs
web-ai/cli.mjs
skills/browser/SKILL.md
skills/web-ai/SKILL.md
skills/vision-click/SKILL.md
```

Important correction from source inspection: some commands that are absent from
the main agbrowse help are implemented in `skills/browser/browser.mjs`. Those
are documented as **surface/docs gaps**, not missing runtime primitives.

## Shared Core

These are already close enough for the K-BrowseComp search/browse loop:

| Family | cli-jaw browser | agbrowse | P0a status |
|--------|-----------------|----------|------------|
| lifecycle | `start`, `stop`, `status`, `doctor`, `reset` | same core | keep aligned |
| observe | `snapshot`, `screenshot`, `text`, `get-dom` | same core | keep aligned |
| URL read | `fetch <url>` | `fetch <url>` | keep aligned |
| navigation | `navigate`, `open`, `reload`, `resize`, `tabs`, `tab-switch`, `scroll` | same/near-same | keep aligned |
| interaction | `click`, `type`, `press`, `hover`, `select`, `drag`, mouse commands | same/near-same | keep aligned |
| diagnostics | `console`, `network`, `evaluate` | same/near-same | keep aligned |
| web-ai core | `render`, `status`, `send`, `poll`, `query`, `stop` | same core | keep aligned |

These shared commands are enough for:

```text
candidate URL -> fetch -> if weak, navigate/snapshot/click/text/network
```

## cli-jaw Browser Only Or Stronger

| Surface | cli-jaw browser | agbrowse status | Decision |
|---------|-----------------|-----------------|----------|
| runtime cleanup | `cleanup-runtimes` | absent | cli-jaw-only; server-owned state |
| active tab contract | `active-tab --json` | absent from main help/source command search | mirror or document replacement |
| vision click in main command | `vision-click <target>` | standalone `agbrowse-vision-click`; shown in help as separate binary | expose route in main skill/help, not necessarily same command |
| web-ai notifications | `web-ai notifications` | absent | cli-jaw-only unless standalone notifications are added |
| web-ai capabilities list | `web-ai capabilities` | capability probes exist internally, but command differs/absent | later parity, not K-BrowseComp P0 |
| web-ai diagnose | `web-ai diagnose` | `web-ai doctor` exists | name parity/doc alias candidate |
| web-ai watchers | `web-ai watchers` | `web-ai watch` exists; watcher listing not main surfaced | later parity |

## agbrowse Only Or Stronger

| Surface | agbrowse | cli-jaw browser status | Decision |
|---------|----------|------------------------|----------|
| skill distribution | `skills list/get/path/install`, `install-skills` | not a browser subcommand concern | agbrowse-only; package responsibility |
| Runway automation | `runway ...` | absent from cli-jaw browser | agbrowse-only; unrelated to K-BrowseComp |
| context packaging dry-run | `web-ai context-dry-run`, `context-render` | cli-jaw uses `context-from-files`/prompt path, not same surface | keep agbrowse-only for package workflow |
| MCP bridge/eval/claim audit | `web-ai mcp-server`, `eval`, `claim-audit` | absent or different cli-jaw ownership | agbrowse package/release responsibility |
| package positioning/help | npm install, bundled skills, release claims | absent | agbrowse-only |

These should be documented, not mirrored into cli-jaw by default.

## Same Name, Different Surface

| Command | Difference | P0a action |
|---------|------------|------------|
| `new-tab` | cli-jaw help documents `--no-activate`; agbrowse source has `new-tab` but help omits it and source path does not expose `--no-activate`/`--json` parity | implement or document exact delta |
| `tab-close` | cli-jaw help documents command; agbrowse source has command but help omits it and no JSON flag | implement or document exact delta |
| `doctor` / `diagnose` | cli-jaw browser has browser `doctor` and web-ai `diagnose`; agbrowse has browser `doctor` and web-ai `doctor` | document naming split; avoid hidden synonym assumptions |
| `vision-click` | cli-jaw has browser subcommand; agbrowse has separate binary and skill | route in browser skill/help; optional main command alias |
| `web-ai sessions` | both have persisted sessions, but subcommand set and help differ | later web-ai parity doc, not P0a blocker |

## P0a Required Fix List

The K-BrowseComp P0a docs should treat these as the mirror set before coding:

```text
1. active-tab truth surface:
   - add agbrowse active-tab --json, or document tab-switch/tabs replacement.

2. tab isolation surface:
   - align agbrowse new-tab help/flags with cli-jaw browser.

3. tab cleanup surface:
   - align agbrowse tab-close help/JSON envelope.

4. no-ref click fallback:
   - make the agbrowse browser skill point clearly from snapshot failure to
     agbrowse-vision-click, or add a main command alias.

5. naming/ownership table:
   - mark cli-jaw-server-only and agbrowse-package-only surfaces explicitly.
```

## What Not To Mirror In P0a

Do not mirror these into agbrowse as part of K-BrowseComp P0a:

- `cleanup-runtimes`: cli-jaw server runtime records.
- `notifications`: cli-jaw notification store.
- Dashboard, heartbeat, employee orchestration.

Do not mirror these into cli-jaw browser as part of K-BrowseComp P0a:

- Runway.
- agbrowse package skill installation.
- npm/package claim audit.

## Success Criterion

P0a is not done when every feature exists. P0a is done when every command is in
one of these buckets:

```text
shared and aligned
shared but surface/docs drift
cli-jaw-only with reason
agbrowse-only with reason
mirror-required before K-BrowseComp implementation
later parity, not P0 blocker
```

This prevents accidental scope creep while keeping the shared browse workflow
honest.
