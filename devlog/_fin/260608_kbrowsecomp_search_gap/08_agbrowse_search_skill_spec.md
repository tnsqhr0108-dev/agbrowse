# 08. agbrowse Search Capability Spec

## Objective

Add a browser-backed Korean research layer above the existing URL-reader
surface. The goal is not to make `agbrowse fetch` a search engine. The goal is
to decide which Korean/search/source routes to inspect, then use existing
browser and adaptive-fetch primitives to read them.

## Current Boundary

Existing:

- `agbrowse fetch <url>` reads one candidate URL.
- Browser commands can navigate, snapshot, click, type, inspect text/DOM.
- Web-AI commands can run provider-side web search prompts.

Missing:

- Problem-to-query decomposition.
- Korean source routing.
- Search-result parsing for Korean portals.
- Structured extraction output.
- Candidate and constraint tracking.

## Proposed Module Set

| Priority | Module | Path |
|----------|--------|------|
| P0 | Search strategy/decomposition | `skills/browser/search-research/search-strategy.mjs` |
| P0 | Korean source routing | `skills/browser/search-research/korean-routes.mjs` |
| P0 | Constraint ledger | `skills/browser/search-research/constraint-ledger.mjs` |
| P0 | Structured extraction extension | `skills/browser/adaptive-fetch/transforms.mjs` |
| P1 | Candidate tracker | `skills/browser/search-research/candidate-tracker.mjs` |
| P1 | Korean normalization | `skills/browser/search-research/korean-normalize.mjs` |
| P1 | Naver/NamuWiki result parsers | `skills/browser/search-research/source-parsers.mjs` |
| P2 | Benchmark harness | `test/eval/kbrowsecomp-search-gap*.mjs` |

The new `search-research/` directory is preferable to placing query planning
inside `adaptive-fetch/` because adaptive-fetch is URL-first and should keep
its safety contract narrow.

## CLI Surface

Start with non-mutating, inspectable commands:

```bash
agbrowse research plan --query "<Korean problem>" --json
agbrowse research routes --query "<atomic query>" --json
agbrowse research extract "https://example.com/page" --json
```

Later:

```bash
agbrowse research run --query "<Korean problem>" --max-steps 10 --json
```

`run` should be experimental until live benchmark evidence exists.

## P0 Behavior

### Decomposition

Input:

```text
Full Korean problem text
```

Output:

```json
{
  "constraints": [{ "id": "c1", "text": "..." }],
  "sourceHints": ["naver", "namuwiki", "official"],
  "atomicQueries": [{ "constraintIds": ["c1"], "query": "...", "route": "naver" }],
  "computedValues": []
}
```

### Korean Routing

Route examples:

| Route | URL/action |
|-------|------------|
| `naver_search` | `https://search.naver.com/search.naver?query=` |
| `google_kr` | Google with Korean query and source domain hints |
| `namuwiki` | NamuWiki search/page direct route |
| `official_site` | site-scoped query or source-domain search |
| `bookstore` | Kyobo/Yes24 product route |
| `academic` | arXiv/DBpia/university route |

### Completion Gate

The research layer must return unresolved constraints instead of an answer
when mandatory evidence is missing:

```json
{
  "ok": false,
  "status": "insufficient-evidence",
  "pendingConstraints": ["c3", "c5"],
  "candidates": [...]
}
```

## P1 Behavior

### Candidate Tracker

Track candidate support by constraint:

```json
{
  "candidate": "...",
  "normalizedKey": "...",
  "support": {
    "c1": [{ "sourceUrl": "...", "authority": 0.8 }],
    "c2": []
  }
}
```

### Korean Normalization

Minimum features:

- Strip common particles from entity candidates.
- Normalize whitespace and punctuation.
- Preserve aliases inside parentheses.
- Generate simple English/Korean variants when both are present in evidence.
- Convert obvious Korean number words where used as counts.

## P2 Benchmark Gates

Offline gates:

- Decomposition fixtures from abridged K-BrowseComp-like prompts.
- Naver/NamuWiki parser fixtures from static HTML.
- Structured extraction fixtures for table/list/profile/iframe.
- Constraint-ledger completion tests.
- Korean normalization tests.

Live gates:

- Naver search result parsing smoke.
- NamuWiki section extraction smoke.
- Official notice page date-filter smoke.
- Browser route -> adaptive-fetch -> ledger update smoke.

## Verification Policy

Do not publish an agbrowse K-BrowseComp accuracy number until all of the
following are true:

1. The benchmark runner is reproducible.
2. Gold answers are not embedded in prompts or committed docs.
3. Search-call/tool budget is recorded.
4. Source URLs and evidence ledger are stored per task.
5. Failures are categorized by F0-F8 and tool/model attribution.

## Implementation Order

1. P0 docs/spec only: this document set.
2. P0 offline modules: decomposition, Korean routing, constraint ledger.
3. P0 structured extraction extension and fixtures.
4. P1 candidate tracker and normalization.
5. P2 live smoke harness.
6. Only then: benchmark comparison run.
