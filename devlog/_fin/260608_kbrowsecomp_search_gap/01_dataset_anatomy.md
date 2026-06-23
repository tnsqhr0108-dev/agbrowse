# 01. K-BrowseComp Dataset And Query Anatomy

## Dataset Shape

| Field | Value |
|-------|-------|
| Verified | 300 human-written, human-validated problems |
| Synthetic | 100 diagnostic stress problems |
| Public fields | `problem`, `answer`, `type`, `category` |
| Metadata fields | `expected_chain`, `checklist`, `korean_specific_keyword`, `rationale` |
| License | MIT |

The most useful public field for agbrowse planning is not the gold answer. It
is the combination of `problem` and `expected_chain`: the problem shows the
query surface an agent receives, while the expected chain shows the sources
and intermediate facts a successful run should collect.

## Type Distribution

| Split | Multi-hop | Parallel | Total |
|-------|----------:|---------:|------:|
| Verified | 160 | 140 | 300 |
| Synthetic | 53 | 47 | 100 |
| All | 213 | 187 | 400 |

Multi-hop problems require sequential discovery. Parallel problems require
collecting multiple independent constraints and intersecting candidates. Both
are bad fits for a stateless "search once, read snippet, answer" loop.

## Category Distribution

### Verified

| Category | Count | Share |
|----------|------:|------:|
| 엔터테인먼트/미디어 | 109 | 36.3% |
| 교통/장소/지역 | 48 | 16.0% |
| 교육/대학/시험 | 35 | 11.7% |
| 스포츠/게임 | 26 | 8.7% |
| 과학기술/IT/학술 | 20 | 6.7% |
| 음식/음료/맛집 | 19 | 6.3% |
| 문학/도서/언어 | 15 | 5.0% |
| 제품/브랜드/뷰티 | 13 | 4.3% |
| 역사/문화/정치 | 10 | 3.3% |
| 금융/경제/공공정책 | 4 | 1.3% |
| 제품/브랜드/패션 | 1 | 0.3% |

### Synthetic Shift

Synthetic intentionally shifts toward harder agent-search domains:

| Category | Verified | Synthetic |
|----------|---------:|----------:|
| 과학기술/IT/학술 | 20 | 33 |
| 스포츠/게임 | 26 | 16 |
| 금융/경제/공공정책 | 4 | 9 |
| 엔터테인먼트/미디어 | 109 | 9 |

Interpretation: the diagnostic split is not just "more of the same." It is
designed to stress source discovery, official-page lookup, paper/code linking,
date arithmetic, and structured list extraction.

## Problem Text Length

| Split | Median | P90 | Max |
|-------|-------:|----:|----:|
| Verified | 149 chars | 278 | 1315 |
| Synthetic | 251 chars | 334 | 434 |
| All | 174 chars | 309 | 1315 |

The query surface is often long enough that a naive search query containing the
entire problem will diffuse the signal. A successful agent needs to extract
high-value entities and constraints before searching.

## Expected Chain And Source Depth

`verified_with_metadata` exposes the intended chain for the 300 verified
problems.

| Metric | Median | P75 | P90 | Max |
|--------|-------:|----:|----:|----:|
| Expected-chain steps | 4 | 6 | 7 | 11 |
| Source URLs per problem | 5 | 6 | 8 | 20 |

This directly contradicts a single-query mental model. The benchmark expects
roughly four to six retrieval steps before answer finalization.

## Top Expected-Chain Domains

| Rank | Domain | Count | Implication |
|------|--------|------:|-------------|
| 1 | `namu.wiki` | 244 | Korean entity pages; disambiguation and long-page sections matter |
| 2 | `ko.wikipedia.org` | 83 | Infobox/table/section extraction needed |
| 3 | `blog.naver.com` | 38 | Naver-specific rendering and partial indexing risk |
| 4 | `v.daum.net` | 27 | News articles, syndicated URLs |
| 5 | `yna.co.kr` | 24 | News/date verification |
| 6 | `youtube.com` | 23 | Video title/channel/description/transcript surface |
| 7 | `en.wikipedia.org` | 21 | Cross-lingual entity bridge |
| 8 | `chosun.com` | 19 | News archive pages |
| 9 | `music.bugs.co.kr` | 18 | Music metadata and track lists |
| 10 | `encykorea.aks.ac.kr` | 17 | Korean encyclopedia, formal entities |
| 11 | `instagram.com` | 14 | Often login-gated; should be flagged, not guessed |
| 12 | `species.nibr.go.kr` | 13 | Official scientific pages |
| 13 | `donga.com` | 12 | News archive pages |
| 14 | `product.kyobobook.co.kr` | 11 | Book metadata, contents, author profiles |
| 15 | `arxiv.org` | 11 | Paper metadata and code links |

## Query Pattern Counts

Heuristic counts over all 400 problem strings:

| Pattern | Count | Reason it hurts search |
|---------|------:|------------------------|
| Location/source signals | 312 | Needs source-specific routing and Korean place/entity normalization |
| Date-heavy wording | 256 | Needs temporal filtering and freshness checks |
| Table/list/ordinal wording | 199 | Snippets lose row order and section context |
| Daum/Kakao literal or ambiguous `다음` | 100 | Needs disambiguation between Korean word "next" and portal/source |
| Variable/arithmetic | 83 | Needs stateful values and deterministic post-processing |
| Numbered conditions | 77 | Needs all-constraints ledger |
| Official-source wording | 43 | Needs authority/source-type preference |
| Explicit Naver mention | 16 | Needs direct Naver route |
| Alias/romanization risk | 20 | Needs Korean/English/Hanja alias expansion |

## Takeaway For agbrowse

The benchmark is mostly a stateful research problem, not a generic search
problem. agbrowse should not try to become only another snippet search backend.
The high-value path is:

1. Build a Korean query planner from the full `problem`.
2. Convert it into focused source-specific searches.
3. Use browser/fetch to read full pages and structured content.
4. Maintain an evidence ledger until every condition is satisfied.
