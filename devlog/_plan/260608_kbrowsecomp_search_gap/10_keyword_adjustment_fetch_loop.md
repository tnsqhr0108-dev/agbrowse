# 10. Minimal Keyword Adjustment + Fetch Loop

## Thesis

K-BrowseComp coverage can improve without building a full browser research
agent first. The cheapest useful improvement is:

```text
slightly better keyword query -> search backend returns candidate URLs
  -> agbrowse fetch reads those URLs
  -> only unresolved/dynamic cases go to browse skill
```

This works because the current benchmark harness often fails before it reaches
the evidence page. It asks a broad or awkward query, gets weak snippets, and
then reasons over the weak snippets. Fetch changes the value of search results:
they become candidate URLs, not final evidence.

## Query Rewrite Rules

### R1. Do Not Search The Full Problem

Bad:

```text
Full multi-condition Korean problem as one query
```

Better:

```text
anchor entity + rare condition + source hint
```

Example shapes:

| Problem signal | Query rewrite |
|----------------|---------------|
| Movie + awards + Naver rating | `한국 영화 신인 감독상 신인 여우상 뮤지컬화 네이버 영화 평점` |
| Book + publisher + table of contents | `고려대학교출판문화원 2024 12 27 540쪽 MOOC 목차` |
| Official notice + date | `site:<official-domain> 공지사항 2025년 6월 제목 숫자` |
| Patch-note ordinal | `리그오브레전드 패치노트 챔피언 변경 기본 지속효과 주문력 계수` |

The exact answer is not needed in the query. The goal is to find pages likely
to contain the needed evidence.

### R2. Use Source Hints As Routing, Not Just Terms

If the problem says `네이버`, `나무위키`, `교보문고`, `공지사항`, or `공식`, the
query should be routed.

| Source hint | Search route |
|-------------|--------------|
| Naver movie/blog/cafe/knowledge | Naver search URL or Korean web backend with Naver terms |
| NamuWiki/profile/entity | NamuWiki direct/search route |
| Official notice/profile/terms | domain-restricted or official-site query |
| Book/product metadata | Kyobo/Yes24/product search |
| Academic/paper/code | arXiv/DBpia/university/GitHub route |

### R3. Split Discovery And Verification

Discovery query:

```text
Find possible candidate entities.
```

Verification query:

```text
candidate + one missing constraint + source hint
```

This prevents the initial query from being overconstrained and returning no
useful results.

### R4. Preserve Dates As Filters

Dates are not decoration. They decide which result is valid.

Rewrite:

```text
entity + source + date/range + content type
```

For backends with date filters:

- Perplexity: use country/language/domain filters where available.
- Exa: use published-date filters when source dates matter.
- Tavily: use `start_date` / `end_date` or `time_range`.
- Brave: use `freshness` or custom date ranges.

If the K-BrowseComp-compatible adapter cannot pass those fields, put the date
in the keyword query and verify by fetch.

## Fetch-Enriched Search Loop

```text
1. Decompose the problem into constraints.
2. Generate 1-3 focused queries per discovery phase.
3. Run existing search backend.
4. Normalize results into URL candidates.
5. Fetch top candidates with agbrowse fetch.
6. Extract title, readable text, metadata, tables/lists if available.
7. Score each fetched page against constraints.
8. If evidence is incomplete, generate verification queries.
9. If fetch cannot see required state, escalate to browse skill.
```

Important change:

```text
search snippet = ranking hint
fetched page = evidence
```

## When Fetch Is Enough

Fetch can improve coverage when the target evidence is in:

- Static article body.
- Public NamuWiki/Wikipedia sections.
- Product/book metadata visible in HTML.
- Official pages with readable HTML.
- News pages.
- Public endpoint alternatives.
- Metadata/oEmbed/RSS/Wayback surfaces.

## When Fetch Is Not Enough

Escalate to browse skill when the task requires:

- Search result page interaction.
- JS-rendered result blocks.
- Tabs, filters, accordions, pagination, infinite scroll.
- Naver smart blocks or source-specific UI.
- iframe traversal that needs live DOM.
- screenshots/OCR for image-heavy Korean content.
- network API discovery from browser runtime.

## Scoring Improvement Hypothesis

The smallest measurable improvement is not from adding more search backends.
It is from converting the existing backends into a two-stage system:

| Stage | Old K-BrowseComp | Proposed agbrowse route |
|-------|------------------|--------------------------|
| Search | query -> snippets | query -> candidate URLs |
| Evidence | snippet text | fetched full page / browser DOM |
| State | model memory | constraint ledger |
| Finalization | model decides | all mandatory constraints checked |

This should especially improve F2, F4, F5, and F7:

- F2: page content hidden from snippets.
- F4: tables/lists not preserved.
- F5: wrong candidate selected from snippet.
- F7: constraints dropped between searches.

## Benchmarkable Offline Gate

For each fixture problem:

1. Store abridged problem text.
2. Store expected query rewrites, not gold answers.
3. Store mock search results with URLs.
4. Store static fetched HTML.
5. Assert that the ledger marks constraints as supported or pending.

This tests the retrieval/control loop without leaking answers or requiring
live API keys.
