# 05. Structured Extraction Cases

## Why Snippets Fail

K-BrowseComp problems frequently ask for an entity at a position in a list, a
field in a profile, a table cell, a count, or a value computed from multiple
page sections. Search snippets flatten or omit this structure.

Heuristic count over 400 public problems:

| Signal | Count |
|--------|------:|
| Table/list/ordinal wording | 199 |
| Variable/arithmetic wording | 83 |
| Numbered condition blocks | 77 |
| Official-source wording | 43 |

These are not all separate problems; many hard rows combine all four.

## Representative Query Shapes

No gold answers are included.

| Row | Shape | Why structure matters |
|-----|-------|----------------------|
| `verified#94` | Notice count -> variable `X`; paper author count -> variable `Y`; GitHub commit ordinal | Needs date-filtered notice list, author count, commit ordering |
| `verified#99` | Book + author profile counts `A/B/C`; choose subitem from table of contents | Needs profile field extraction and nested TOC indexing |
| `verified#101` | Korean song/literature DB page; compute chapter/line/word ordinal | Needs structured text positions, not summary |
| `verified#104` | Raw source, iframes, graph links, class membership, link target | Needs raw source, iframe traversal, graph/list structure |
| `verified#106` | League patch-note conditions across champion changes | Needs patch note tables/lists and version arithmetic |
| `verified#108` | Book metadata, author profiles, lesson item order | Needs cross-page entity joins and ordered lists |

## Required Extraction Contracts

### Tables

Return stable row/column data:

```json
{
  "kind": "table",
  "caption": "optional",
  "headers": ["date", "title", "speaker"],
  "rows": [{ "cells": ["2026-08-23", "...", "..."] }],
  "sourceUrl": "https://..."
}
```

### Lists And Ordinals

Return ordered items with nesting:

```json
{
  "kind": "list",
  "title": "Lesson 4",
  "items": [
    { "position": 1, "text": "...", "links": [] },
    { "position": 2, "text": "...", "links": [] }
  ]
}
```

### Profiles

Return named fields and freeform sections:

```json
{
  "kind": "profile",
  "entity": "...",
  "fields": { "education": "...", "researchAreas": ["..."] },
  "sections": [{ "heading": "경력", "text": "..." }]
}
```

### Raw Source / Iframes

Some K-BrowseComp rows explicitly require raw source or iframe traversal.
agbrowse should not make this the default for every page, but should support it
when the problem text contains cues such as `raw source`, `iframe`, `src`,
`googlemap`, or page-source-specific wording.

Contract:

- Count iframes and scripts.
- Extract iframe `src` URLs.
- Fetch iframe documents through the same safety checks.
- Preserve link order and class membership when the task depends on it.

## Current agbrowse Gap

`skills/browser/adaptive-fetch/transforms.mjs` currently turns HTML into
readable text and dedupes candidate URLs. That is useful for article reading,
but it is not enough for K-BrowseComp:

- Row/column identity is lost.
- Ordered-list positions are not first-class.
- Nested sections become plain text.
- Link adjacency/class structure is not retained.

## Patch Requirements

| Priority | Patch | Target |
|----------|-------|--------|
| P0 | Structured extractor interface | `skills/browser/adaptive-fetch/transforms.mjs` |
| P0 | Preserve list/table/heading evidence in fetch result metadata | `skills/browser/adaptive-fetch/output.mjs` |
| P1 | Raw-source/iframe opt-in extraction | browser escalation + safety validators |
| P1 | Ordinal helper for `A+B` style row selection | new deterministic utility |
| P2 | HWP/PDF attachment routing for official pages | separate document-reader integration |

## Benchmark Gate

Add offline fixtures for:

1. HTML table with Korean headers.
2. Nested ordered list with section heading.
3. Profile page with repeated field labels.
4. Iframe source with ordered links.
5. Naver-like result blocks.

The pass condition is not "text contains the answer." It is "the structure
needed to compute the answer survives extraction."
