# P4 Browse Escalation Controller Plan

Date: 2026-06-09
Phase: P4
Scope: Browse escalation controller

## Goal

Turn fetch enrichment output into explicit browser next actions.

P3 reads normalized URL candidates and updates the constraint ledger from
original-page fetch evidence. P4 decides which remaining candidates need browser
inspection, names the reason, and prints the next `agbrowse` commands instead
of silently switching tools.

## Non-Goals

- Do not run Chrome or mutate browser state in P4.
- Do not perform live search.
- Do not decide the final answer.
- Do not implement full `research run` or benchmark scoring.

## Input Contracts

- `research-plan-v1`
- `research-fetch-enrichment-v1`

## Output Contract

Add a new `research-browse-escalation-v1` envelope:

```json
{
  "schemaVersion": "research-browse-escalation-v1",
  "planSchemaVersion": "research-plan-v1",
  "enrichmentSchemaVersion": "research-fetch-enrichment-v1",
  "needsBrowse": true,
  "summary": {
    "actionCount": 1,
    "reasons": ["naver-shell-or-iframe-risk"],
    "pending": ["c2"]
  },
  "actions": [
    {
      "rank": 1,
      "url": "https://blog.naver.com/example",
      "reason": "naver-shell-or-iframe-risk",
      "priority": "high",
      "commands": [
        "agbrowse new-tab \"https://blog.naver.com/example\" --json",
        "agbrowse snapshot --interactive",
        "agbrowse text",
        "agbrowse get-dom --selector body --max-chars 20000"
      ],
      "verify": {
        "pendingConstraintIds": ["c2"],
        "ledgerStatusBeforeBrowse": "insufficient-evidence"
      }
    }
  ]
}
```

This is a controller plan, not browser execution. Agents may execute the command
sequence after inspecting the envelope.

## Reason Mapping

| Reason | Trigger |
|--------|---------|
| `naver-shell-or-iframe-risk` | Naver URL or plan browse reason names Naver |
| `dynamic-page-state` | Fetch reports browser required, chrome required, weak dynamic evidence, or plan names dynamic state |
| `table-list-ordinal-requires-dom` | Plan/source hints indicate structured/table/list/ordinal evidence and ledger remains pending |
| `official-page-fetch-empty` | Official route/source hint plus fetch body is empty, weak, blocked, or errored |
| `fetch-insufficient-or-constraints-pending` | Ledger has pending mandatory constraints after fetch |

## Implementation

1. Add `skills/browser/search-research/browse-escalation.mjs`.
   - Export `planBrowseEscalation(plan, enrichment, options)`.
   - Keep it pure and offline-testable.
   - Rank candidates by explicit plan reasons, fetch weakness, and pending
     ledger state.
   - Emit command strings using existing agbrowse browser commands:
     `new-tab`, `snapshot`, `text`, `get-dom`, `network`, `scroll`.
2. Add `agbrowse research browse-plan --plan <json> --enrichment <json> --json`.
   - Reads local JSON files.
   - Outputs `research-browse-escalation-v1`.
   - Missing required flags fail before any browser mutation.
3. Update browser skill docs and command structure.
4. Add offline unit tests for reason mapping and command generation.
5. Add CLI tests with fixture JSON and no Chrome/network.

## Success Criteria

- Naver candidates produce `naver-shell-or-iframe-risk` and browser commands.
- Dynamic/browser-required fetch results produce `dynamic-page-state`.
- Structured/table pending constraints produce `table-list-ordinal-requires-dom`.
- Official empty/blocked fetch results produce `official-page-fetch-empty`.
- No browse actions are emitted when the ledger is complete and fetch is strong.
- CLI tests prove `research browse-plan` emits JSON without Chrome/network and
  fails missing args before mutation.
- Typecheck, release gates, diff check, and full tests pass before commit.

