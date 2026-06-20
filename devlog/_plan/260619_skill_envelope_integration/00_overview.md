# Skill Envelope Integration

## Problem
Context package (file attachment) and prompt envelope (skill instructions) are built in separate pipelines. Skill selection info is not encoded in the envelope, and developer instructions passed via `--context` are rendered as UNTRUSTED.

## Key Gaps

### Separate render paths
- `question.mjs:113-135` — envelope rendering (Path A)
- `chatgpt.mjs:172-177,239-254` — context pack building (Path B)
- No unified "envelope + attachment" path

### Skill info lost in serialization
- Tool/skill selection stored in `selectedTools` warnings, not in `session.envelopeSummary`
- Session resumption cannot reconstruct which skills were active

### Developer instructions marked UNTRUSTED
- `question.mjs:153` — `--context` content rendered as `[CONTEXT]` with UNTRUSTED boundary
- Model may ignore developer instructions in this section
- No explicit DEVELOPER INSTRUCTIONS section separate from data CONTEXT

## Goal
Unified envelope that wraps skill instructions + file attachments together, with clear trust boundary between developer instructions (trusted) and attached data (untrusted).

## Test Coverage Needed
- Envelope rendering with skill instructions + file attachment combined
- Session serialization/deserialization preserves skill info
- Trust boundary verification: developer instructions not ignored by model

## Decision (locked 2026-06-19)
Unify into one `buildEnvelope` with explicit trust tiers: `[DEVELOPER INSTRUCTIONS]` (trusted skill + `--developer`) and a new `[ATTACHMENT MANIFEST]` rendered even on upload transport, separate from `[UNTRUSTED_CONTEXT]`. Persist skill/tool selection into `session.envelopeSummary` (zero-migration shallow merge). See `01_root_cause.md`, `10_solution_plan.md`.

## Status
- [x] Interview/requirements gathering
- [x] Plan (`10_solution_plan.md`)
- [ ] Implementation (deferred — devlog-only this round; skill-loading mechanism still to be specified)
- [ ] Verification
