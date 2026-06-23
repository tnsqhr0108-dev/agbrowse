# 19. Standalone / Orchestrated / Integrated Architecture

## Core Requirement

K-BrowseComp search improvement must work in three modes:

```text
cli-jaw only
agbrowse only
cli-jaw + agbrowse together
```

The systems should reinforce each other, but neither should become unusable
when the other is absent.

## Mode A: cli-jaw Only

Purpose:

```text
Improve employee search behavior even when standalone agbrowse is not installed
or not selected for a task.
```

Required behavior:

- Korean external/current/source-sensitive searches are rewritten into 1-3
  focused queries.
- Search results are treated as URL candidates.
- Employees avoid final answers from snippets when original-source evidence is
  required.
- If no agbrowse CLI is available, employees still use their native search,
  fetch/open, and browser/browse capability where available.

This is why the cli-jaw prompt patch remains valuable by itself.

## Mode B: agbrowse Only

Purpose:

```text
Let a standalone agent install agbrowse skills and run the same browser/search
trajectory without cli-jaw employees or the cli-jaw server.
```

Required behavior:

- `agbrowse research plan --query ... --json` generates constraints, source
  hints, focused queries, route URLs, and fetch/browse policy.
- `agbrowse fetch <url>` verifies URL candidates.
- Browser commands inspect dynamic pages when fetch is weak.
- The agbrowse bundled `browser`, `web-ai`, and `vision-click` skills teach the
  same flow.

This is why P0a browser mirror work belongs in the agbrowse devlog, not only in
cli-jaw prompt docs.

## Mode C: cli-jaw + agbrowse Integrated

Purpose:

```text
Let cli-jaw employees use agbrowse as the stronger browser/runtime tool when it
is available.
```

Target flow:

```text
user Korean research request
  -> cli-jaw employee classifies external/current/source-sensitive intent
  -> agbrowse research plan --query "<request>" --json
  -> employee runs provider/native search with plan.atomicQueries
  -> normalize URL candidates
  -> agbrowse fetch <candidate-url> --json --trace
  -> if pending constraints or weak fetch, use agbrowse browser commands
  -> final answer only after ledger is complete or pending state is disclosed
```

This is the full K-BrowseComp improvement path.

## Entity Model

| Entity | Owner | Meaning |
|--------|-------|---------|
| user request | cli-jaw / standalone agent | Korean research task |
| research plan | agbrowse | constraints, source hints, atomic queries, route URLs |
| employee prompt policy | cli-jaw | when to rewrite/search/fetch/browse |
| browser command surface | both | observable actions over CDP/browser |
| search backend result | provider/native search | URL candidates, snippets, dates, raw metadata |
| fetch result | agbrowse | original-page evidence and weak-source signals |
| constraint ledger | agbrowse | supported/pending state |
| final answer | employee/agent | answer with evidence or unresolved constraints |

## Invariants

The following rules should not change by mode:

1. Search snippets are ranking hints, not final evidence.
2. Original-source requests require fetch or browser verification.
3. Naver, JS-rendered, iframe, table/list/ordinal, and official dynamic pages
   need explicit browse escalation when fetch cannot see the evidence.
4. Unresolved mandatory constraints must remain visible.
5. cli-jaw-only and agbrowse-only features must be named as such rather than
   silently assumed to exist in both systems.

## Patch Sequence With Modes

| Phase | cli-jaw only | agbrowse only | integrated |
|-------|--------------|---------------|------------|
| P0a browser mirror docs | command policy inventory | command surface inventory | shared vocabulary |
| P0b offline core | prompt can describe expected shape | modules exist and are tested | future shared contract |
| P1 research CLI | optional external tool | primary standalone entry | cli-jaw can call it |
| P2 skill/prompt wiring | employee rules remain useful | skills teach same rules | employee invokes agbrowse |
| P3 fetch enrichment | native fetch/open fallback | `agbrowse fetch` loop | agbrowse evidence ledger |
| P4 browse escalation | browser skill fallback | browser commands fallback | shared browser verification |
| P5 full CLI surface | no hard dependency | complete standalone CLI | strongest combined workflow |

## Documentation Requirement

Before implementation continues, the devlog must make the mode split explicit:

```text
cli-jaw without agbrowse: still improves query sending.
agbrowse without cli-jaw: still works as standalone browser/research CLI.
cli-jaw with agbrowse: gets the strongest query/fetch/browse loop.
```

This prevents the plan from collapsing into either:

- prompt-only advice with no standalone browser implementation, or
- agbrowse-only implementation that cli-jaw employees do not know how to use.
