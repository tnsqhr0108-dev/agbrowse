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

## Profile lock

- agbrowse creates `$BROWSER_AGENT_HOME/profile.lock` when launching Chrome.
- A second launch from the same `BROWSER_AGENT_HOME` will refuse while the
  lock is held (5-minute stale reclaim window).
- If Chrome was `kill -9`'d, the lock auto-reclaims after 5 minutes or can
  be manually deleted.
