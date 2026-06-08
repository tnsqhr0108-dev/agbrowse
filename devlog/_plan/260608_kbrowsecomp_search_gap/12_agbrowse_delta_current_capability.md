# 12. agbrowse Delta From Current Capability

## Current State

agbrowse already has strong primitives:

- Browser start/status/navigate/snapshot/text/get-dom/click/type.
- Adaptive URL fetch for one known URL.
- Public endpoint and metadata discovery.
- Browser-render escalation.
- Web-AI query/poll/session flows.
- Source-audit and artifact support.

But current agbrowse is not yet a full search research agent:

- It does not run Exa/Tavily/Brave/Perplexity directly as normalized search
  backends.
- It does not rewrite Korean benchmark questions into focused queries.
- It does not automatically fetch search results.
- It does not maintain a K-BrowseComp-style evidence ledger.
- It does not choose between fetch and browse from a constraint state.

## What agbrowse Can Add

### 1. Search Backend Normalizer

Create a common interface:

```json
{
  "backend": "perplexity|exa|tavily|brave|browser-serp",
  "query": "...",
  "results": [
    {
      "url": "...",
      "title": "...",
      "snippet": "...",
      "raw": {},
      "date": null,
      "rank": 1
    }
  ]
}
```

Unlike K-BrowseComp, keep backend-specific raw fields in `raw` for diagnostics.

### 2. Query Rewrite Simulator

Before live API calls, expose:

```bash
agbrowse research plan --query "<problem>" --json
```

Output:

- extracted constraints
- source hints
- focused query candidates
- route selection
- expected evidence type

This lets us test "small keyword adjustments" without spending API calls.

### 3. Search + Fetch Enrichment

After a search backend returns URLs:

```text
top N URL candidates -> agbrowse fetch -> evidence ledger
```

Store:

- fetched title
- final URL
- content score
- structured tables/lists
- metadata dates
- constraints supported
- fetch warnings/boundaries

### 4. Browse Escalation Controller

If fetch is weak, use browser skills with a reason:

```json
{
  "reason": "fetch-weak-js-rendered",
  "nextAction": "browser.navigate",
  "url": "..."
}
```

This prevents silent fallback and makes each escalation auditable.

### 5. Constraint And Candidate Ledger

Use a ledger as the main state object:

```json
{
  "constraints": [{ "id": "c1", "status": "supported" }],
  "candidates": [{ "name": "...", "support": { "c1": ["url"] } }],
  "pending": ["c3"],
  "blocked": []
}
```

This is the component that directly targets K-BrowseComp's low-search cases.

### 6. Benchmark Harness

Build a private/local harness first:

- No gold answers in prompts.
- No public score claims.
- Store search queries, URLs, fetch evidence, browse actions, and final answer.
- Categorize failures by F0-F8.

This creates the missing visibility: actual generated search queries per
problem and which backend/fetch/browse stage failed.

## What This Adds Beyond Existing Search Backends

Existing backends answer:

```text
"What pages look relevant to this query?"
```

agbrowse should answer:

```text
"Which pages should I inspect, what evidence did I extract from them,
which constraints remain unresolved, and do I need browser interaction?"
```

That is the difference between search and browsing/research.

## Implementation Slice

Recommended order:

1. Documented backend I/O contract (this doc set).
2. `research plan` command with offline query rewrites.
3. Search backend normalizer.
4. Search result -> fetch enrichment.
5. Constraint ledger and candidate tracker.
6. Browse escalation controller.
7. K-BrowseComp-like local eval harness.

## Success Criteria

The first success criterion should not be benchmark accuracy. It should be
trajectory visibility:

- Which query was generated?
- Which backend returned which URLs?
- Which URLs were fetched?
- Which constraints were supported?
- Which constraints stayed pending?
- Which page required browse escalation?

Once this exists, actual K-BrowseComp score improvement becomes measurable
instead of guessed.
