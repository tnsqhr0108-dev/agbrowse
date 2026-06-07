# 07. Failure Mode Countermeasures

This mapping combines the prior K-BrowseComp failure-mode analysis with the
actual public query-pattern scan.

## F0: Incomplete Trajectory

Cause: The model fails to produce a coherent sequence of searches/actions.

agbrowse countermeasure:

- Planner output contract with explicit constraints and route plan.
- Fail closed when decomposition is empty for a complex prompt.

Priority: P1. This is partly model/prompt-side, but a structured planner
reduces freeform trajectory drift.

## F1: Ineffective Initial Search

Cause: First query is too broad, too literal, or anchored on a bad clue.

Observed query signals:

- Long inverted questions.
- Multiple unrelated constraints in one sentence.
- Korean source hints buried in prose.

agbrowse countermeasure:

- Query decomposition.
- Korean morphology cleanup.
- Source-hint routing before global search.

Priority: P0.

## F2: Search-Access Structure Failure

Cause: The needed evidence is not in the search snippet.

Observed query signals:

- Table/list/ordinal wording: 199 problems.
- Explicit source/page structure wording.
- Expected-chain domains with rich pages (`namu.wiki`, Naver Blog, official
  notices, book pages, music pages).

agbrowse countermeasure:

- Browser/fetch full page before trusting snippets.
- Structured extraction contract.
- Raw-source/iframe opt-in path.

Priority: P0. This is the clearest tool-side gap.

## F3: Cross-Source Hopping Failure

Cause: The agent finds an intermediate entity but does not use it to continue
to the next source.

agbrowse countermeasure:

- Evidence ledger with bridge entities.
- Next-query generation tied to a ledger value.
- Source family transitions, such as wiki -> official page -> news archive.

Priority: P1.

## F4: Semi-Structured Parsing Failure

Cause: Tables, lists, tracklists, menus, timelines, or profile fields are
flattened incorrectly.

Observed query signals:

- `목차`, `번째`, `순위`, `항목`, `공지사항`, `개수`.
- Variable arithmetic selecting an ordinal.

agbrowse countermeasure:

- Table/list/profile extractors.
- Deterministic ordinal helper.
- Tests that verify structure preservation, not answer text.

Priority: P0.

## F5: Search Result Selection Failure

Cause: The agent chooses a plausible candidate before verifying every
constraint.

agbrowse countermeasure:

- Candidate vector scoring by constraint.
- Authority/source-diversity tie-breakers.
- Completion gate: no answer until all mandatory constraints pass.

Priority: P1.

## F6: Sparse Entity Normalization

Cause: Korean names, aliases, stage names, romanization, Hanja, and particles
split evidence across pages.

agbrowse countermeasure:

- `normalizeKoreanEntity(text)`.
- Alias expansion for Korean/English/Hanja when source hints justify it.
- Candidate merge by normalized key while preserving source display text.

Priority: P1.

## F7: Constraint Tracking Failure

Cause: Multi-condition prompts lose a requirement mid-run.

Observed query signals:

- Numbered conditions: 77 problems.
- Parallel type: 187 of 400 problems.

agbrowse countermeasure:

- Constraint checklist in every planner run.
- Per-constraint evidence status.
- Final answer refusal when pending constraints remain.

Priority: P0.

## F8: Intermediate Reasoning Failure

Cause: Calculation, comparison, count, or final synthesis is wrong after
retrieval.

Observed query signals:

- Variable/arithmetic: 83 problems.
- Date and ordinal calculations.

agbrowse countermeasure:

- Keep arithmetic outside freeform prose where possible.
- Store variables as typed values.
- Run deterministic operations for counts, sums, differences, and ordinals.

Priority: P2. This matters, but only after the evidence extraction path is
reliable.

## Priority Stack

| Priority | Countermeasure |
|----------|----------------|
| P0 | Query decomposition, Korean source routing, full-page/structured extraction, constraint completion gate |
| P1 | Candidate tracker, Korean entity normalization, cross-source bridge ledger |
| P2 | Deterministic arithmetic helpers, PDF/HWP/OCR expansion, benchmark scoring harness |

## Non-Goals

- Do not automate login, CAPTCHA, or private community access.
- Do not claim K-BrowseComp score gains without a fresh reproducible run.
- Do not publish full query-answer pairs in agbrowse docs.
