# 11. Browse Skill Coverage

## Fetch vs Browse

`agbrowse fetch` should be the default after a candidate URL exists. Browse
skills should be used when the answer depends on live page state, interaction,
or browser-only rendering.

| Need | Fetch | Browse skill |
|------|-------|--------------|
| Static article body | good | optional |
| Static wiki section | good | optional for long-page section navigation |
| Search result page | weak | good |
| JS-rendered widgets | weak | good |
| Tabs/accordions/filter UI | weak | required |
| Infinite scroll/pagination | weak | required |
| Naver result blocks | weak/partial | required for robust parsing |
| Raw source/iframe order | partial | browser/evaluate often needed |
| Network API discovery | no | required |
| Screenshot/OCR | no | required |

## Coverage Ladder

The practical ladder should be:

```text
Search API
  -> URL candidates
  -> agbrowse fetch
  -> browser text/get-dom/snapshot
  -> browser click/filter/scroll/evaluate/network
  -> web-ai/deep research only for synthesis or hard ambiguity
```

This keeps most tasks cheap while reserving full browser work for pages where
fetch cannot see the state.

## Browse Skill Tasks

### 1. Korean SERP Parsing

When the source hint is Naver or Daum, a regular search API may be weaker than
opening the Korean search page directly.

Required browser actions:

- Navigate to search URL.
- Snapshot result blocks.
- Extract block type, title, URL, snippet, date.
- Click tab/filter if the problem names blog/news/cafe/kin/place.

### 2. Dynamic Page Expansion

Many Korean pages hide relevant content behind:

- `더보기`
- tabs
- accordions
- pagination
- embedded widgets

Fetch may return a short or incomplete document. Browse can click, re-snapshot,
and verify text presence.

### 3. Raw Source And iframe Inspection

Some benchmark rows explicitly mention raw source, iframe `src`, graph calls,
or link order. Fetch can retrieve simple HTML, but browser inspection is safer
when:

- iframe content is same-origin/JS-generated.
- link order depends on rendered DOM.
- classes or graph nodes matter.
- network requests populate the page after load.

### 4. Network Discovery

For pages where rendered data comes from JSON APIs:

- Use browser network capture.
- Identify API endpoint.
- Fetch API response through existing safety checks.
- Store endpoint evidence in ledger.

This is a major agbrowse advantage over snippet-only search.

### 5. Visual/OCR Escalation

Korean blogs and public notices sometimes embed key text in images. Browse
should preserve screenshot evidence and route to OCR only when text extraction
fails and the image is public and relevant.

## Decision Rule

Escalate from fetch to browse when any of these are true:

- Fetched text is weak but the URL/domain is highly relevant.
- The query asks for a UI-visible list, ranking, tab, calendar, map, or table.
- The problem mentions raw source, iframe, source order, or hidden content.
- Source family is Naver SERP, dynamic official site, commerce page, or media
  metadata page.
- The evidence ledger has a high-confidence candidate but a missing
  constraint that likely lives on the same page.

## What This Means For K-BrowseComp

The benchmark can be improved in tiers:

1. Use search API for URL discovery.
2. Fetch all high-confidence URLs.
3. Browse only pages where fetch returns incomplete evidence.

This avoids turning every question into a full browser session while still
covering the important failures that snippet search misses.
