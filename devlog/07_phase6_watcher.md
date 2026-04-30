# Phase 6 — Watcher reattach (deferred)

GPT Pro's phase critique flagged that **watcher reattach** is genuinely
missing from the current plan. Phase 1 covers CLI session reattach (a human
or agent in a fresh shell can resume a session by ID), but a long-running
watcher process that survives across reboots and pushes notifications is a
different surface.

This phase is **deferred** — kept as a stub so future planning has a place
to land.

## Goals (sketch)

- A long-running `agbrowse web-ai watch --session <id>` process that polls
  a session, persists progress, and survives Chrome restart / system sleep.
- Notifications when a session completes or hits its deadline (via the
  channel send endpoint or a configurable webhook).
- Survive `agbrowse start --reuse-foreign-chrome` re-attaching the lock to a
  different Chrome process.

## Non-goals

- No web UI dashboard.
- No multi-machine sync.
- No background daemon installation.

## Why deferred

- Phase 1 sessions cover the common case: long Pro/Deep Think runs an agent
  resumes with `sessions resume <id>` from a fresh shell.
- The watcher needs a lifecycle and notification target story (channel send
  endpoint? user-defined webhook? local file?). That decision can wait until
  Phases 0–5 land and we have real users asking for it.

## Prerequisites

- Phase 1 (sessions) — in progress.
- Phase 2 (errors) — must define `provider.poll-timeout` and a watcher-
  specific `watcher.heartbeat-stale` code.
- Phase 3 (capabilities) — watcher should run pre-poll capability checks.
- Phase 4 (doctor) — watcher should auto-`doctor` on failure.
- Phase 5 (profile lock) — watcher must respect the same lock semantics.

## Open questions

- File-based heartbeat vs PID file vs systemd-style supervision?
- Notification target: channel send endpoint (cli-jaw style) only, or also a
  user-defined webhook URL?
- Watcher process supervision: agbrowse-managed (`agbrowse watcher start`)
  or external supervisor (`launchctl`/`systemd`/`pm2`)?
- One watcher per session vs one watcher fanning out to many sessions?
- How does the watcher survive `agbrowse start --reuse-foreign-chrome`
  swapping Chrome instances?

## Status

Deferred. Re-open after Phase 5 ships. Until then, agents needing watcher
behavior should run their own loop calling `agbrowse web-ai sessions resume
<id>` on a cron or supervisor.
