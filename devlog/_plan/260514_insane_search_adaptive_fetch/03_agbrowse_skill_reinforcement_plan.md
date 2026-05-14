---
created: 2026-05-14
status: planning
tags: [jawdev, agbrowse, adaptive-fetch, skill, browser]
---

# agbrowse Skill Reinforcement Plan

## Goal

Teach agents that agbrowse can act as a search-tool helper after a URL exists.

The skill must not say "use agbrowse for generic web search." It should say:

```text
Use search to find candidate URLs.
Use agbrowse fetch to read and validate candidate URLs.
```

The detailed search keyword bucket plan lives in
`04_search_keyword_consolidation_plan.md`.

## Current Skill Surface

Existing file:

```text
skills/browser/SKILL.md
```

Current positioning already says agbrowse is a local Chrome/CDP runtime and not a
hosted browser, stealth browser, CAPTCHA bypass tool, or cloud-session provider.
The adaptive fetch wording should extend that positioning instead of weakening
it.

## Proposed Frontmatter Change

Current frontmatter describes browser control:

```yaml
---
name: browser
description: "Chrome browser control: open pages, take ref snapshots, click, type, screenshot. No external server required."
---
```

Planned frontmatter should keep browser control and add URL-reading triggers:

```yaml
---
name: browser
description: >
  Chrome browser control and traceable URL reading through agbrowse. Use for
  opening pages, snapshots, clicking, typing, screenshots, network inspection,
  and adaptive fetch when a user provides a URL, a search result URL, source
  URL, citation/reference URL, blocked or empty native fetch result, SPA shell,
  or public API/RSS/metadata/browser-network inspection target. For broad
  search, use native search first to obtain candidate URLs, then use agbrowse
  fetch on selected URLs.
---
```

## New Skill Section

Add a section near the observe/network docs:

```markdown
### Adaptive URL Reading

```bash
agbrowse fetch "https://example.com" --json --trace
```

Use this only after a URL exists. It is a URL reader, not a search engine.

Good triggers:

- user gives a URL;
- user asks to read a search result link;
- user asks to inspect a source, citation, or reference URL;
- native fetch/WebFetch returned 402, 403, blocked, or empty HTML;
- the page looks like an empty SPA shell;
- the task needs public API/RSS/metadata/browser-network inspection.

Bad triggers:

- broad "search the web" requests with no URL;
- trend/news/reaction discovery before candidate URLs exist;
- bulk crawling without explicit scope.

Boundary behavior:

- stop at login, CAPTCHA, paywall, credential, or private membership walls;
- do not claim bypass, stealth, or anti-detection;
- keep trace output redacted.
```
```

## Routing Rule For Agents

Add a short operational rule:

```text
When a user asks for generic web search with no URL, use the current CLI's
native search capability first. When a URL exists, or native fetch/WebFetch is
blocked or weak, or the task mentions a search result/source/citation/reference
URL, run:

  agbrowse fetch "<url>" --json --trace

Read the trace before retrying. Stop at login, CAPTCHA, paywall, or credential
boundaries.
```

## Skill Acceptance Criteria

- `skills/browser/SKILL.md` mentions `agbrowse fetch`.
- The skill says adaptive fetch requires an existing URL.
- The skill says generic search still starts with native search tooling.
- The skill lists blocked/empty/SPA/network cases as good triggers.
- The skill lists search-result/source/citation/reference URL cases as good
  triggers once a URL exists.
- The skill explicitly rejects CAPTCHA, login, paywall, credential bypass, and
  stealth claims.
- The skill examples include JSON and trace output.
- No skill wording implies agbrowse can browse arbitrary blocked content without
  user-visible boundaries.

## Documentation Touch Points

Update these docs when implementation lands:

```text
README.md
skills/browser/SKILL.md
structure/commands.md
structure/CAPABILITY_TRUTH_TABLE.md
structure/str_func.md
```

If a server/API endpoint is added, also update:

```text
structure/server_api.md
```

## Verification

After the skill docs are updated:

```bash
rg -n "agbrowse fetch|adaptive fetch|generic web search|candidate URLs" skills/browser/SKILL.md README.md structure
bash structure/check-doc-drift.sh
bash structure/verify-counts.sh
```
