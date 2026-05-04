# Trace and replay evidence

`agbrowse web-ai` can write redacted JSONL traces with `--trace-dir`.

The trace layer is intentionally evidence-only:

- prompt and answer text are redacted by default
- cookies, storage values, auth headers, API keys, and emails are redacted
- screenshots are not written by default
- trace reports render offline with `scripts/render-trace-report.mjs`

Example:

```bash
agbrowse web-ai query --vendor chatgpt --inline-only --prompt "Reply OK" \
  --trace-dir tmp/traces --json
```

Render:

```bash
node scripts/render-trace-report.mjs tmp/traces/<traceId>.jsonl
```
