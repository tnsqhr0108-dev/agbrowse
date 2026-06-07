# 06. Multi-Hop Orchestration

## Why A Planner Is Needed

The verified metadata has median 4 expected-chain steps and p75 6. A large
fraction of questions also require parallel constraint satisfaction, variable
tracking, or ordinal extraction. A browser can access richer evidence than a
snippet API, but without orchestration it will still follow salient leads and
finalize too early.

## Problem Types

### Multi-hop

Sequential dependency:

```text
Find A -> use A to find B -> use B to find C -> answer C
```

Risk:

- Losing the bridge entity.
- Searching for the final answer before intermediate values are known.
- Mixing stale and current sources.

### Parallel

Candidate intersection:

```text
Find entities satisfying constraint A, B, C, then choose the one that satisfies all.
```

Risk:

- Verifying constraints against different candidates.
- Treating one strong source as enough.
- Dropping a negative constraint.

## Evidence Ledger

Every research run should maintain a ledger:

| Field | Meaning |
|-------|---------|
| `constraintId` | Stable id from decomposition |
| `claim` | What must be true |
| `query` | Search query or page action used |
| `sourceUrl` | Evidence URL |
| `sourceType` | official, wiki, news, naver, academic, commerce, social |
| `candidate` | Candidate entity supported |
| `status` | pending, supported, contradicted, blocked |
| `confidence` | Evidence confidence, not answer confidence |

Final answer is allowed only when every mandatory constraint is `supported`
for the same candidate or for the required chain.

## Search Budget Policy

K-BrowseComp uses a 10-call search budget. agbrowse does not need to copy that
limit internally, but any benchmark-comparable run should track equivalent
effort.

Suggested policy for a 10-call budget:

| Budget | Use |
|--------|-----|
| 1 | Initial source/candidate discovery |
| 2-6 | Constraint-specific discovery |
| 7-8 | Candidate verification / contradiction checks |
| 9 | Authoritative source or full-page confirmation |
| 10 | Final missing constraint only, not exploratory drift |

If the evidence ledger still has unresolved mandatory constraints after the
budget, the correct behavior is "insufficient evidence," not a guess.

## Planner Output Contract

```json
{
  "language": "ko",
  "type": "parallel",
  "constraints": [
    { "id": "c1", "text": "..." },
    { "id": "c2", "text": "..." }
  ],
  "sourceHints": ["naver", "namuwiki", "official"],
  "discoveryQueries": [
    { "constraintIds": ["c1"], "query": "...", "route": "naver" }
  ],
  "verificationQueries": [
    { "candidate": "...", "constraintIds": ["c2"], "query": "..." }
  ],
  "computedValues": [
    { "name": "A", "sourceConstraintId": "c3", "operation": "count" }
  ]
}
```

## Candidate Tracker

For parallel questions, each candidate should be scored as a vector rather than
a scalar:

```json
{
  "candidate": "entity name",
  "normalizedKey": "entity-name",
  "constraints": {
    "c1": { "status": "supported", "sourceUrl": "..." },
    "c2": { "status": "pending" }
  },
  "contradictions": [],
  "sourceDiversity": 2
}
```

Ranking rule:

1. Drop candidates with contradicted mandatory constraints.
2. Prefer candidates with all mandatory constraints supported.
3. Break ties by authority and source diversity.
4. If no candidate satisfies all constraints, return unresolved constraints.

## Interaction With adaptive-fetch

The planner should not modify `agbrowse fetch` semantics. Instead:

```text
planner -> candidate search URLs -> adaptive-fetch(URL) -> structured evidence
```

This keeps the URL-reader safety model intact while adding a search/research
layer above it.

## Failure Prevention Rules

- Never finalize after a single high-salience source if the problem has
  numbered conditions.
- Never use a snippet for an ordinal/list/table answer unless the source page
  was fetched and the relevant structure survived extraction.
- Never merge candidates by display text alone; normalize Korean particles,
  romanization, aliases, and spacing.
- Never let date constraints live only in prose; store them in the ledger.
