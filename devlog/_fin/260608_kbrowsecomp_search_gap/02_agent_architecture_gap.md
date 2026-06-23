# 02. Agent Architecture Gap: K-BrowseComp vs agbrowse

## K-BrowseComp Harness

Verified from the local prior analysis and public repo/readme:

```text
DeepResearchAgent
  -> LLM function-calling loop
  -> ToolSet
       -> SearchWebTool
            -> search engine adapter
                 -> Perplexity / Brave / Exa / Tavily
  -> max_steps = 10
  -> final short-answer grading
```

The critical interface is `search_web(query: str)`. Search results are exposed
as title, URL, and snippet. The agent does not browse arbitrary pages during
the released evaluation loop.

## Harness Strengths

K-BrowseComp is a fair LLM-to-LLM comparison inside one harness:

- The LLM is swapped, while the tool contract is held constant.
- The first turn requires search.
- Search calls are budgeted.
- Results are short-answer graded.
- `verified_with_metadata` enables trajectory-level diagnostics.

That means the benchmark is useful for measuring query construction, snippet
interpretation, and state maintenance under a constrained search interface.

## Harness Limits

| Limit | Effect |
|-------|--------|
| Snippet-only retrieval | No DOM, no table structure, no hidden sections, no iframe/raw-source path |
| Single search tool | No tool choice between search API, page fetch, browser navigation, OCR, or PDF/HWP read |
| Ten-step budget | Little room for wrong initial direction, source hopping, and final verification |
| No Korean-first planner | Query generation relies on the model's implicit Korean search instincts |
| No persistent evidence ledger | Parallel constraints can be forgotten or prematurely collapsed |

The local analysis already identified F2 (search-access structure failure) as
the major tool-side issue: if the needed evidence is outside the snippet, the
agent cannot see it.

## agbrowse Runtime Surface

Current relevant implementation lives under:

```text
skills/browser/browser.mjs
skills/browser/adaptive-fetch/
web-ai/
test/unit/browser-adaptive-fetch-*.test.mjs
```

Current strengths:

- CDP navigation, snapshot, screenshot, DOM text, console, and network tools.
- `agbrowse fetch <url>` for one known candidate URL.
- Adaptive URL reading ladder: public endpoint, direct fetch, metadata, reader,
  browser render, optional user session, human loop.
- Web-AI execution with source-audit and durable sessions.
- Offline adaptive-fetch tests for endpoint resolution, output, scoring, trace,
  session, WAF profile, and third-party reader behavior.

Current gaps for K-BrowseComp-style search:

- `agbrowse fetch` is explicitly a URL reader, not a generic search engine.
- No first-class Korean query planner.
- No built-in Naver/Daum/Google Korea search-result parser.
- No structured table/list/ranking output contract from fetched HTML.
- No candidate tracker that scores entities against multiple constraints.
- No benchmark harness that replays K-BrowseComp-style problems without
  leaking gold answers.

## Capability Mapping

| K-BrowseComp need | agbrowse today | Required change |
|-------------------|----------------|-----------------|
| Make focused Korean search queries | Web-AI prompt can ask for search, but no deterministic planner | Add query decomposition and Korean normalization |
| Find candidate URLs | Browser can navigate if URL exists | Add Korean search route/result extraction |
| Read full page | `agbrowse fetch` and CDP snapshot | Already present; connect to planner |
| Extract tables/lists/ordinals | Readable text only, no stable structured contract | Add structured extraction result |
| Track constraints | No K-BrowseComp-style ledger | Add constraint/evidence tracker |
| Verify before final answer | Source audit exists for web-ai text, not search chain | Add all-constraints completion gate |

## Design Implication

The right agbrowse response is not to replace Perplexity with another snippet
API. It is to build a browser-backed research loop:

```text
problem
  -> decompose into atomic constraints
  -> generate Korean/source-specific queries
  -> search/browse/fetch pages
  -> extract structured evidence
  -> update candidate ledger
  -> verify all constraints
  -> answer or report insufficient evidence
```

This complements the existing adaptive-fetch design: adaptive-fetch remains
the URL reader, while the new layer decides which URLs and source routes are
worth reading.
