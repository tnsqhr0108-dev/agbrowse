# Oracle Parity — Plan Index

Repo: https://github.com/lidge-jun/agbrowse
Reference: https://github.com/steipete/oracle (0.11.0, May 2026)

Feature gaps identified by comparing oracle 0.11.0 CHANGELOG + source against agbrowse HEAD.

## Priority Batches

### P1 — Core Feature Parity
| Plan | Issue | Description |
|------|-------|-------------|
| [plan-images](plan-images.md) | #68 | ChatGPT generated image collection/download |
| [plan-tab-harvest](plan-tab-harvest.md) | #71 | Rich tab state model + harvest/reattach |

### P2 — Extended Capabilities
| Plan | Issue | Description |
|------|-------|-------------|
| [plan-multi-turn](plan-multi-turn.md) | #69 | Multi-turn follow-up prompts |
| [plan-deep-research](plan-deep-research.md) | #70 | ChatGPT Deep Research mode |
| [plan-artifacts](plan-artifacts.md) | #72 | Session artifacts (transcripts, reports, images) |

### P3 — Nice-to-Have
| Plan | Issue | Description |
|------|-------|-------------|
| [plan-project-sources](plan-project-sources.md) | #73 | ChatGPT Project Sources management |
| [plan-archive](plan-archive.md) | #74 | Auto-archive one-shot runs |
| [plan-heartbeat](plan-heartbeat.md) | #75 | Heartbeat/liveness during responses |
| [plan-control-plan](plan-control-plan.md) | #76 | Browser control plan output |

## Implementation Order

Recommended: images (#68) → tab-harvest (#71) → multi-turn (#69) → artifacts (#72) → deep-research (#70) → rest

Tab harvest is foundational for multi-turn and deep-research. Images can be done independently.
