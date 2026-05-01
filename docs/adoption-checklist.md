# agbrowse adoption checklist

## Environment isolation

- Pick one `BROWSER_AGENT_HOME` per project or agent instance.
- Pick one `CDP_PORT` per browser automation stack.
- Do not share Chrome `--user-data-dir` between live Chrome instances.
- Use separate `BROWSER_AGENT_HOME` and `CDP_PORT` values when running
  agbrowse beside cli-jaw or other browser automation tools.

## Machine integration

- Use `AGBROWSE_JSON_ERRORS=1` for machine integrations.
- Use `--json` on automation commands when another tool will parse the result.
- Run `agbrowse web-ai status --json` before mutation.
- Run `agbrowse web-ai doctor --vendor <v> --json` after selector failures.

## Security posture

- agbrowse does not bypass anti-bot, captcha, or Cloudflare checks.
- Keep provider logins user-managed and local.
- Do not commit or share `~/.browser-agent`; it contains browser session state.
- Doctor output never includes raw user content, content-derived hashes,
  or session text — only structural DOM fingerprints and character counts.

## Diagnostics

- Enable `AGBROWSE_CHURN_LOG=1` to track selector drift over time.
- Churn log writes to `$BROWSER_AGENT_HOME/churn-log.jsonl`.
- Run `web-ai doctor` periodically to detect provider DOM changes early.

## Diagnostics — churn log rotation

- `compactChurnLog` runs automatically after each doctor-triggered churn
  write, keeping the log at 500 records maximum.
- For manual compaction: `readChurnLog` + `compactChurnLog(homeDir, limit)`.

## Profile lock

- agbrowse creates `$BROWSER_AGENT_HOME/profile.lock` when launching a
  **fresh** Chrome process. If the CDP port is already listening (an
  existing Chrome session), agbrowse reuses it without acquiring a lock.
- The lock stores the Chrome PID and an ownership token. A second fresh
  launch from the same `BROWSER_AGENT_HOME` will refuse while the lock
  is held and the Chrome PID is alive.
- Staleness is determined by PID liveness: if the recorded Chrome PID is
  dead, the lock is immediately reclaimable. The 5-minute timeout applies
  only when no PID is recorded (legacy lock files).
- If Chrome was `kill -9`'d, the lock auto-reclaims on the next launch
  (PID check detects the dead process) or can be manually deleted.
- `releaseProfileLock` verifies ownership (token or PID) before deleting;
  it will not remove another instance's lock.
- If Chrome fails to launch after the lock is acquired, the lock is
  automatically released via try/finally cleanup.
