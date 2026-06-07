# K-BrowseComp Search Gap Analysis

Date: 2026-06-08
Target: agbrowse search/research capability backlog
Primary sources:
- Local prior analysis: `/Users/jun/developer/k-browsecomp-analysis/`
- Dataset: `prometheus-eval/k-browsecomp` on Hugging Face
- Code/readme: `prometheus-eval/K-BrowseComp`

## Scope Boundary

This document set analyzes the public benchmark problems (`problem`) and the
released intended solution metadata (`expected_chain`, `checklist`,
`korean_specific_keyword`). The public dataset does not expose per-model
tool-call strings for each evaluation run, so "actual query" here means the
actual benchmark problem text and expected retrieval chain, not private
model-generated `search_web(...)` logs.

Gold answers are intentionally omitted from the examples in this public
agbrowse repo. The analysis uses row ids, short excerpts, pattern tags, and
source-domain statistics to avoid republishing query-answer pairs.

## Documents

| # | File | Topic | Output |
|---|------|-------|--------|
| 01 | `01_dataset_anatomy.md` | Dataset/query anatomy | Counts, source domains, query-shape distribution |
| 02 | `02_agent_architecture_gap.md` | Harness gap | K-BrowseComp search-only harness vs agbrowse browser runtime |
| 03 | `03_query_generation_patterns.md` | Actual query patterns | Six recurring patterns that break naive search |
| 04 | `04_korean_portal_navigation.md` | Korean source routing | Source-specific browser/navigation requirements |
| 05 | `05_structured_extraction_cases.md` | Structured extraction | Table/list/raw-source/ordinal cases and parser needs |
| 06 | `06_multi_hop_orchestration.md` | Multi-hop state | Decomposition, evidence ledger, budget policy |
| 07 | `07_failure_mode_countermeasures.md` | Failure modes | F0-F8 mapped to agbrowse countermeasures |
| 08 | `08_agbrowse_search_skill_spec.md` | Implementation spec | Prioritized patches and benchmark gates |

## Key Dataset Facts

| Metric | Value |
|--------|-------|
| Verified split | 300 problems |
| Synthetic split | 100 problems |
| All public problems | 400 |
| Type distribution | 213 multi-hop / 187 parallel |
| Verified expected-chain depth | median 4, p75 6, max 11 |
| Verified sources per problem | median 5, p75 6, max 20 |
| Problem length | median 174 chars, p90 309, max 1315 |
| Top expected-chain domain | `namu.wiki` (244 references) |

## Key Query Signals

Heuristic counts over the 400 public `problem` fields:

| Signal | Count | Search implication |
|--------|-------|--------------------|
| Date/time scoped | 256 | Needs temporal filters and stale-source rejection |
| Table/list/ordinal wording | 199 | Snippets are unsafe; full DOM or structured parser needed |
| Variable/arithmetic (`A`, `B`, `X+45`) | 83 | Needs state ledger and deterministic calculation |
| Numbered conditions | 77 | Needs all-constraints checklist before final answer |
| Explicit Naver mention | 16 | Direct Naver route should be preferred |
| Alias/romanization risk | 20 | Needs Korean entity normalization and alias expansion |

## Main Conclusion

K-BrowseComp exposes a search/research gap that is larger than "which search
engine is used." The strongest missing capability is an agent loop that can:

1. Decompose a Korean multi-constraint problem into atomic searches.
2. Route each atomic search through Korean-first sources when appropriate.
3. Visit and parse full pages instead of trusting snippets.
4. Preserve candidate, constraint, and evidence state across hops.
5. Refuse or defer finalization until all required constraints are verified.

agbrowse already has the CDP/browser layer and adaptive URL reading needed for
item 3. It lacks a first-class Korean search planner, Korean portal routing,
structured extraction contract, and candidate/constraint tracker.
