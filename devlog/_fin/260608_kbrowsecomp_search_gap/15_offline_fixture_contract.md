# 15. Offline Fixture Contract

## Purpose

The next K-BrowseComp step is to turn the analysis set into a reproducible
offline gate before running live search APIs. This avoids confusing provider
quality, network drift, browser access, and query planning in one test.

## Contract

Each fixture should contain:

| Field | Meaning |
|-------|---------|
| `problem` | Abridged Korean benchmark-shaped prompt, without gold answer leakage |
| `expectedHints` | Required source/date/content-type hints |
| `expectedQueryTerms` | Terms that must survive query rewrite |
| `mockSearchResults` | URL candidates returned by an external backend |
| `fetchedPages` | Static HTML/text for those URL candidates |
| `expectedLedger` | Supported and pending constraint ids after fetch |
| `expectedEscalation` | `none`, `fetch`, or `browse` with reason |

The important assertion is trajectory visibility:

```text
problem -> constraints -> focused queries -> URL candidates -> fetch evidence
  -> supported/pending constraints -> browse escalation if needed
```

Gold answers are not required for this gate. The fixture proves that the agent
does not answer from snippets, does not drop constraints, and can explain which
piece of evidence is still missing.

## First Smoke Corpus

Use the same five behavior classes from doc 14:

1. Fresh Korean public-policy query.
2. Naver Blog original-evidence query.
3. K-BrowseComp-style multi-constraint entity query.
4. Official notice/date-constrained query.
5. Table/list/ordinal extraction query.

These map to the observed provider failures in doc 13 and the minimal
keyword/fetch loop in doc 10.

## Current Implementation Hook

The initial offline contract is now represented by:

```text
skills/browser/search-research/search-strategy.mjs
skills/browser/search-research/korean-routes.mjs
skills/browser/search-research/constraint-ledger.mjs
test/unit/kbrowsecomp-search-research.test.mjs
```

This is deliberately network-free. It fixes the P0 shape first:

- Korean source/date/structured hint detection.
- 1-3 focused query candidates.
- Search result role as URL candidates.
- Fetch-before-answer expectation.
- Browse escalation for Naver, JS, and table/list/ordinal cases.
- Constraint ledger readiness gate.

## Pass Criteria

The unit gate passes when:

- No test searches the full Korean natural-language prompt as the only query.
- Every planned query is shorter and more focused than the problem where
  decomposition is expected.
- Source hints such as Naver, official, bookstore, academic, date, and
  table/list survive planning.
- Ledger status stays `insufficient-evidence` while mandatory constraints are
  pending.
- Browse escalation is explicit for source classes fetch cannot verify.
