# agbrowse devlog — index (v2, post-critique)

Phased plan derived from the 2026-05-01 GPT-5.5 Pro peer review and the
follow-up phase critique. Each phase file is diff-level: every MODIFY entry
shows actual before/after snippets and every NEW file shows the exported API
surface plus a 10-line skeleton.

## Reading order

1. This file (`00_index.md`).
2. `context/260501_gpt_pro_peer_review.md` — verbatim peer review with citations.
3. `context/260501_gpt_pro_phase_critique.md` — verbatim phase critique with diff sketches.
4. Phase files in numbered order.

## Phases

| Phase | File | Theme | Sub-PRs | Engineer-days |
| --- | --- | --- | --- | ---: |
| 0 | `01_phase0_papercuts.md` | Papercuts | 1 | 1–1.5 |
| 2 | `03_phase2_errors.md` | Typed error taxonomy (core first) | 2 | 2.5–4 |
| 1 ⭐ | `02_phase1_sessions.md` | Session IDs + resume | 3 | 5–7 |
| 3 | `04_phase3_capabilities.md` | Capability probe rows | 2 | 3–5 |
| 4 | `05_phase4_diagnostics.md` | DOM diagnostics (`web-ai doctor`) | 2 | 3–4 |
| 5 | `06_phase5_adoption.md` | Adoption hardening | 3 | 2.5–4 |
| 6 | `07_phase6_watcher.md` | Watcher reattach (deferred) | TBD | TBD |

Total core estimate: 17–25 engineer-days.

## Sequencing (revised after critique)

```
Phase 0
   ↓
Phase 2 PR1 (errors core)        ← move before Phase 1 so session failures
   ↓                               can use WebAiError from day one
Phase 1 PR1 (session-store)
   ↓
Phase 1 PR2 (provider --session)
   ↓
Phase 1 PR3 (sessions list/show/resume)
   ↓
Phase 2 PR2 (convert call sites) ← parallel allowed with Phase 3 PR1
   ↓
Phase 3 (capability probes)
   ↓
Phase 4 (doctor)
   ↓
Phase 5 (adoption)
```

Reasons:

- Phase 4 reuses Phase 3 probes; cannot run in parallel.
- Phase 2 PR1 (errors core) before Phase 1 because session failures need
  structured shape from the start.
- Phase 2 PR2 (call-site rewrites) can be parallelized with Phase 3 PR1
  because they touch different files (provider throws vs capability probes).

## 4-week sprint cut order (if shipping must compress)

1. Drop Phase 5 churn-log + adoption extras.
2. Drop Phase 4 disk/diff/status integration.
3. Trim Phase 3 to host/composer/model rows only.
4. Drop `reattach` and the top-level sessions wrapper.

Keep: Phase 0 + minimal Phase 1 (store + resume) + Phase 2 JSON errors.

## Out of scope (current iteration)

- Watcher dashboard / web UI.
- New providers (Claude, Perplexity).
- API-mode fallback when login is missing.
- Docker / cloud profile sync.
- `agbrowse churn report` summarization command (Phase 5 leaves JSONL for
  downstream tools).
- `bin/agbrowse-sessions.mjs` shortcut (route through `web-ai sessions`).

## Conventions

- One phase per file. Every PR is one bullet list of files changed.
- Each phase file contains: decisions, diffs, public-surface changes, test
  plan, smoke plan, exit criteria, risks.
- Diffs use real before/after snippets when the call site is known; otherwise
  marked "schematic".
- Source of truth for diff sketches is `context/260501_gpt_pro_phase_critique.md`;
  this devlog mirrors the relevant slices only.
