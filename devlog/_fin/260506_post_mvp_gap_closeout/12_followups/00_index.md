# Phase 12 Followups — diff-ready plans

Each subplan is **diff-only** (file:line, before/after, no prose meandering).
Land order is independent; each closes a distinct user-reported pain point from the 260506 evening session.

| #  | File                              | Title                                                          | Touch | Risk |
|----|-----------------------------------|----------------------------------------------------------------|-------|------|
| 01 | 01_navigate_residual_envfails.md  | nytimes/amazon residual env-fails — root-cause + flag matrix   | M     | low  |
| 02 | 02_tab_inventory_ux.md            | Tab inventory + pre-cleanup advisor (count, what to close)     | M     | low  |
| 03 | 03_start_failure_diagnostics.md   | "start keeps dying" — diagnose + better fail messages          | M     | low  |
| 04 | 04_help_friendlier.md             | --help is unfriendly — restructure with examples + recipes     | S     | none |
| 05 | 05_webai_auth_plan_detection.md   | web-ai login/plan-tier detection (logged-out, free, pro gates) | L     | med  |

Mirror requirement: every CLI surface change here MUST be mirrored to `cli-jaw` (browser actions + REST + bin/commands/browser.ts), per user mandate.
