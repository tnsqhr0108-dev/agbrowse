# 09. Existing Search Backend I/O Contracts

## Why This Matters

The earlier docs explained that K-BrowseComp is snippet-limited. The sharper
point is that the benchmark already supports multiple search backends, but the
harness normalizes all of them into the same narrow shape:

```json
{ "title": "...", "url": "...", "snippet": "..." }
```

That means Exa, Tavily, Brave, and Perplexity can differ in ranking and snippet
quality, but their richer backend-specific fields mostly do not reach the
agent.

## K-BrowseComp Tool Contract

From `search_evals/agents/tools/search_web.py`:

```text
search_web(query: str)
  input: concise search query
  output: results[] with title, url, snippet
```

The agent prompt tells the model:

- Keep queries focused.
- Search is a limited resource.
- Do not expect quotes/brackets/special syntax to work.
- Natural language or keyword-style queries are both acceptable.
- Ten search calls are available.

So the only lever the model has is the `query` string. It cannot ask the tool
to open a URL, fetch raw content, apply Korean language filters, or preserve
backend-specific metadata.

## Backend Matrix In K-BrowseComp

| Backend | K-BrowseComp request | K-BrowseComp returned snippet | Backend capability left unused |
|---------|----------------------|-------------------------------|--------------------------------|
| Perplexity | `query`, `max_results`, `max_tokens`, `max_tokens_per_page` | `result.snippet` | country/language/domain filters, multi-query grouping, date fields |
| Perplexity-long | same, but larger token budget | longer `result.snippet` | still normalized to one snippet string |
| Exa | `query`, `num_results`, `type=fast`, `highlights` | joined highlights | text/full contents, summaries, include domains, date filters, deep variants |
| Tavily | `query[:400]`, `max_results`, `search_depth=basic`, `include_raw_content=false` | `result["content"]` | raw content, advanced depth, domain/date/country parameters |
| Brave | `q=query`, `count`, `extra_snippets=true` | description + extra snippets | country/search language/UI language/freshness/rich result fields |

## Perplexity

K-BrowseComp adapter:

```python
client.search.create(
    query=query,
    max_results=num_results,
    max_tokens=3000,
    max_tokens_per_page=3000,
)
```

It maps each result to:

```python
SearchResult(url=result.url, title=result.title, snippet=result.snippet)
```

Official API docs show that Search API returns ranked structured results with
`title`, `url`, `snippet`, `date`, and `last_updated`; it also supports country
regional search, multi-query search, domain filters, language filters, and
manual token budgets. K-BrowseComp uses only the snippet budget path.

Implication:

- Good for broad ranked URL discovery.
- Not enough for Korean source targeting unless query strings carry source
  hints or the harness uses domain/language/country filters.

## Exa

K-BrowseComp adapter:

```python
search_and_contents(
    query=query,
    num_results=num_results,
    type="fast",
    highlights={ query, num_sentences=3, highlights_per_url=5 },
)
```

It maps the result to:

```python
snippet = "\n".join(result.highlights)
```

Official Exa docs support `contents` modes such as highlights, text, and
summary. The Search API also exposes include/exclude domains, published-date
filters, `additionalQueries` for deep search variants, search type selection,
and optional output schema.

Implication:

- Exa can be a better URL candidate finder for semantic queries.
- In K-BrowseComp's fast/highlights mode it is still not a page reader.
- For Korean benchmark tasks, Exa likely helps most when the query is rewritten
  into source/entity keywords and then fetched separately.

## Tavily

K-BrowseComp adapter:

```python
client.search(
    query=query[:400],
    max_results=num_results,
    search_depth="basic",
    include_raw_content=False,
)
```

It maps each result to:

```python
snippet = result["content"]
```

Official Tavily docs show `query`, `search_depth`, `max_results`, time/date
filters, `include_answer`, `include_raw_content`, image options, domain
filters, country boosting, and exact-match mode. K-BrowseComp uses basic depth
and disables raw content.

Implication:

- Tavily has knobs that can expose more content or better source targeting.
- K-BrowseComp intentionally chooses the fast/basic configuration, so it is
  closer to snippet search than full retrieval.
- The 400-character truncation makes full-problem Korean queries especially
  fragile.

## Brave

K-BrowseComp adapter:

```python
GET /res/v1/web/search
  q=query
  count=num_results
  extra_snippets=true
```

It maps each result to:

```python
snippet = description + " " + extra_snippets.join(" ")
```

Official Brave docs show query parameter limits, country, search language, UI
language, count, offset, freshness, spellcheck, result filters, and
`extra_snippets`.

Implication:

- Brave is useful as a classic search index with extra snippets.
- K-BrowseComp does not set Korean country/language/freshness parameters.
- It cannot replace a fetch/browser layer because snippets still preserve only
  selected excerpts.

## Common Weakness

All four engines become a URL-and-snippet provider in the benchmark.

That creates a practical design target for agbrowse:

```text
search backend -> URL candidates
agbrowse fetch -> page evidence
browse skill -> dynamic/interactive evidence
ledger -> final answer readiness
```

The search engine should not be treated as the final evidence source. It should
be treated as a URL discovery layer.

## Sources

- K-BrowseComp source: `search_evals/search_engines/*.py`
- K-BrowseComp source: `search_evals/agents/tools/search_web.py`
- Perplexity Search API: https://docs.perplexity.ai/docs/search/quickstart
- Exa Search API: https://exa.ai/docs/reference/search
- Tavily Search API: https://tavilyai.mintlify.app/documentation/api-reference/endpoint/search
- Brave Search API: https://api-dashboard.search.brave.com/api-reference/web/search/get
