# 03. Actual Query Generation Patterns

## Method

The 400 public `problem` strings were scanned for recurring signals that
create bad first-search behavior. The counts below are heuristic, but they are
useful for product work because they identify when a search planner should not
send the whole question as one query.

Gold answers are not included here.

## Pattern Summary

| Pattern | Count | Main failure |
|---------|------:|--------------|
| Date/time scoped wording | 256 | Search returns stale or broad pages |
| Table/list/ordinal wording | 199 | Snippet loses position and row context |
| Variable/arithmetic wording | 83 | Agent needs state, not only retrieval |
| Numbered condition blocks | 77 | First query overconstrains or drops constraints |
| Explicit Naver mention | 16 | Generic web search misses intended Korean surface |
| Alias/romanization risk | 20 | Entity joins fail across Korean/English/Hanja forms |

## P1: Inverted Entity Search

Shape:

```text
Find the entity satisfying condition A, condition B, condition C...
```

Observed rows: `verified#0`, `verified#1`, `verified#3`, many entertainment
and media rows.

Why naive search fails:

- The answer entity is hidden; no single literal query contains it.
- Searching every condition together often yields no page.
- Searching one salient condition first can anchor on a wrong candidate.

Required planner behavior:

1. Extract constraints as separate clauses.
2. Pick the most discriminative clause for discovery.
3. Collect candidate entities.
4. Verify remaining clauses against each candidate.

agbrowse patch target: `search-strategy.mjs` should emit
`{ discoveryQueries, verificationQueries, constraints }`.

## P2: Parallel Constraint Intersection

Shape:

```text
(a) source/person/product has property A
(b) same or related entity has property B
(c) final answer is an item at intersection
```

Observed rows: `verified#96`, `verified#99`, `verified#108`, `verified#141`.

Why naive search fails:

- Each branch may independently produce multiple plausible candidates.
- A model can satisfy A and B with different entities and still finalize.
- Snippets often omit the disambiguating page section.

Required planner behavior:

- Maintain a candidate table.
- Store evidence by constraint id.
- Only rank candidates that satisfy all mandatory constraints.

agbrowse patch target: `candidate-tracker.mjs`.

## P3: Variables And Arithmetic

Shape:

```text
Let A be a count from source 1.
Let B be a count from source 2.
Use A+B or B-A to choose a row/list item.
```

Observed rows: `verified#94`, `verified#99`, `verified#101`,
`verified#104`, `verified#108`, `verified#144`.

Why naive search fails:

- Intermediate values are not search terms.
- The answer may be an ordinal position in a table or list.
- The final step requires calculation after extraction.

Required planner behavior:

1. Represent variables explicitly.
2. Attach each variable to a source and extraction rule.
3. Calculate after evidence collection.
4. Use calculated ordinal against structured data.

agbrowse patch target: structured extraction plus deterministic arithmetic
helper.

## P4: Korean Source And Portal Terms

Shape:

```text
Naver movie rating, Daum article, NamuWiki profile, Korean official notice,
K-MOOC lecture, Kyobo/Yes24 book metadata...
```

Observed domain pressure from expected chains:

- `namu.wiki`: 244 references
- `blog.naver.com`: 38
- `search.naver.com`: 10
- `v.daum.net`: 27
- `product.kyobobook.co.kr`: 11
- `dbpia.co.kr`: 10

Why naive search fails:

- English-style keyword search underweights Korean portal surfaces.
- Perplexity/Bing snippets may not expose Naver Blog, Cafe, or search blocks.
- Some Korean sites render the useful region after tab clicks, scripts, or
  section expansion.

Required planner behavior:

- Detect Korean-context signals.
- Prefer Korean-first routes before generic global search.
- Use source-specific parsers when the source is known.

agbrowse patch target: Korean search routing layer, not adaptive-fetch endpoint
resolvers alone.

## P5: Date-Scoped Official Evidence

Shape:

```text
As of 2026-04...
Notice posted on 2025-06...
Press releases between date X and date Y...
```

Observed count: 256 of 400 problems have date/time signals.

Why naive search fails:

- Search ranking returns recent pages that are irrelevant to the date range.
- Old official notices are often deep in site-specific search pages.
- Snippets may show a date but not the row/order needed for the answer.

Required planner behavior:

- Preserve date constraints as filters.
- Search official domains first when the problem names official pages,
  notices, policy, terms, or profiles.
- Reject sources outside the required date window unless they are only bridge
  evidence.

agbrowse patch target: date constraint parser and source freshness checks.

## P6: Alias, Romanization, And Morphology

Shape:

```text
Korean name variants, English names, Hanja terms, first/second character
operations, organization abbreviations.
```

Observed count: 20 strong alias/romanization-risk problems. This undercounts
ordinary Korean morphology risk because it only captures explicit signals.

Why naive search fails:

- Korean particles attach to entity names.
- English and Korean spellings are mixed in source pages.
- Hanja, romanization, nicknames, and stage names can split evidence across
  pages.

Required planner behavior:

- Strip particles from candidate names.
- Generate Korean/English/Hanja/abbreviation variants when warranted.
- Merge candidate evidence by normalized key, while preserving display forms.

agbrowse patch target: `korean-normalize.mjs`.

## Search Planner Rule

For K-BrowseComp-shaped prompts, never send the full problem as the first
search unless the problem is already a direct title/identifier lookup. The
default first step should be:

```text
problem -> constraints -> source hints -> discovery query -> candidate set
```

Then each follow-up query should be tied to a missing constraint or a candidate
verification step.
