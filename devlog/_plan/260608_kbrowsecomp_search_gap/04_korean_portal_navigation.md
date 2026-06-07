# 04. Korean Portal And Source Navigation

## Source Pressure

The verified metadata shows that K-BrowseComp is heavily grounded in Korean
web surfaces. The most repeated expected-chain sources are not generic global
search destinations; they are Korean encyclopedias, portals, news archives,
official pages, and commerce/music/book catalogs.

| Source family | Representative domains | Required capability |
|---------------|------------------------|---------------------|
| Korean wiki/entity | `namu.wiki`, `ko.wikipedia.org`, `encykorea.aks.ac.kr` | Section navigation, infobox/table extraction, disambiguation |
| Naver | `blog.naver.com`, `m.blog.naver.com`, `search.naver.com` | Direct browser route, tab/block parsing, mobile/desktop variants |
| Daum/Kakao/news | `v.daum.net`, `news.nate.com`, `donga.com`, `chosun.com`, `yna.co.kr` | Article extraction, date/source verification |
| Books/music/media | `product.kyobobook.co.kr`, `yes24.com`, `music.bugs.co.kr`, `youtube.com` | Product metadata, track lists, channel/video metadata |
| Official/academic | `korea.kr`, `heritage.go.kr`, `dbpia.co.kr`, university domains | Notice search, PDFs/HWP, profile pages, table parsing |
| Login-prone social | `instagram.com`, some Cafe/community surfaces | Detect boundary, do not guess, request/flag login if needed |

## Routing Principle

`agbrowse fetch <url>` is correct after a candidate URL exists. K-BrowseComp
requires a layer before fetch:

```text
problem clause -> source hint -> source route -> candidate URL -> fetch/browser parse
```

For Korean context, source hints should change the route:

| Query hint | Preferred route |
|------------|-----------------|
| `네이버`, `블로그`, `카페`, `지식iN`, `영화 평점` | Naver search/browser route first |
| `나무위키`, stage names, entertainment profiles | NamuWiki page/search route |
| `공지사항`, `보도자료`, `약관`, `공식` | Official site/domain search |
| `목차`, `저자`, `교보`, `예스24` | Bookstore/product page search |
| `논문`, `저자`, `github`, `arxiv`, `DBpia` | Academic/source-code route |
| `유튜브`, music video, performance | YouTube metadata/transcript route |

## Naver-Specific Requirements

Naver is not only a domain. It is a separate search environment with result
blocks that can be more useful for Korean queries than global search.

Minimum route:

```text
https://search.naver.com/search.naver?query=<encoded Korean query>
```

Needed parser outputs:

- Result block type: blog, news, kin, cafe, web, knowledge, place.
- Title, URL, snippet, date if present.
- Whether the result is Naver-internal or external.
- Mobile URL canonicalization (`m.blog.naver.com` vs `blog.naver.com`).

Boundaries:

- Do not automate credential entry.
- Do not claim Cafe/private content when login blocks the page.
- Exhaust public Naver search, public blog, news, oEmbed/metadata, and
  isolated browser render before declaring a login boundary.

## NamuWiki Requirements

NamuWiki dominates the expected chains. For agbrowse this suggests a
source-specific extractor:

- Normalize title variants.
- Extract table of contents and section headings.
- Preserve infobox fields.
- Detect disambiguation pages.
- Extract aliases/stage names/related works.
- Score evidence by section, not only full-page text density.

NamuWiki pages are often long. A plain readable-text dump can bury the useful
section and harm the next reasoning step. The extractor should return
section-addressable evidence.

## Official And Academic Pages

Many K-BrowseComp problems use official notices, university profiles,
research-center pages, and policy/terms pages. These often require:

- Site-local search.
- Date range filtering.
- PDF/HWP attachment discovery.
- Table row/column extraction.
- Profile field extraction.
- Source authority scoring.

For public official pages, agbrowse should prefer authority over rank:

```text
official page > official press release > university profile > major news
  > wiki summary > blog/forum
```

## Source-Quality Ledger

Each collected evidence item should carry:

| Field | Purpose |
|-------|---------|
| `sourceUrl` | Revisitable URL |
| `sourceFamily` | Naver, NamuWiki, official, news, academic, commerce, social |
| `authority` | Trust weighting |
| `accessMode` | search snippet, direct fetch, browser DOM, attachment, raw source |
| `date` | Freshness / range validation |
| `constraintIds` | Which problem constraints this evidence supports |
| `boundary` | public, login-required, challenge, paywall, unavailable |

This ledger is the bridge between browser automation and reliable final
answers. Without it, agbrowse risks becoming a stronger fetcher attached to the
same weak reasoning loop.
