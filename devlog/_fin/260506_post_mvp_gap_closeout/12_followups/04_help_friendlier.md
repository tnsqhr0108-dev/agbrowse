# 04 — `--help` friendlier

## Why
User: *"--help 플래그를 좀더 친절하게"*

Current `agbrowse --help` (skills/browser/browser.mjs ~line 2400-2600) is dense, ordered by category, with no:
- "first-run" recipe block,
- common-failure → fix mapping,
- copy-pasteable smoke commands,
- pointer to `agbrowse doctor` (added by plan 03).

## Diff plan

### File: `skills/browser/browser.mjs`

Insert at the **top** of the help body (right after `Usage: …`):

```diff
+
+  Quick start:
+    agbrowse start --headed             Launch a visible Chrome
+    agbrowse navigate https://example.com
+    agbrowse snapshot --interactive     Get refs (e1, e2, …)
+    agbrowse click e1                   Click ref
+    agbrowse stop                       Close Chrome
+
+  Stuck? Run:
+    agbrowse doctor                     Diagnose start/CDP/profile issues
+    agbrowse tabs                       See open tabs + cleanup advice
+    agbrowse tab-cleanup --dry-run      Preview cleanup without closing
+
+  Common failures:
+    "❌ Failed" / "Chrome CDP not responding"
+        → run: agbrowse doctor
+    "Port X in use but not responding as CDP"
+        → another process holds the port. Use --port 9223 or stop it.
+    "CDP port X is already backed by a headless agbrowse Chrome"
+        → agbrowse stop && agbrowse start --headed
+    "tab-cleanup --include-untracked requires --force"
+        → safety; add --force only after reviewing --dry-run output.
+
+  Heavy / anti-bot sites (nytimes, amazon class):
+    AGBROWSE_HEAVY_SITE_COMPAT=1 agbrowse start --headed
+    agbrowse navigate <url> --wait-until commit --timeout 60000
+
```

Then keep the existing categorized reference below, but **add a one-line example to each subcommand** where missing:

```diff
     navigate <url>         Go to URL [--wait-until <commit|domcontentloaded|load>] [--timeout ms]
+                              ex: agbrowse navigate https://github.com --wait-until commit
     reload                 Reload current page
+                              ex: agbrowse reload
```

(repeat trivial example for: snapshot, click, type, screenshot, text, tabs, tab-cleanup, web-ai render).

Also rename existing first line:

```diff
- Usage: agbrowse <command> [args]
+ Usage: agbrowse <command> [args]    (try: agbrowse start --headed)
```

### Help for `web-ai` block

Add at top of web-ai help section:

```diff
+      Quick recipes:
+        # 1) one-shot text query
+        agbrowse web-ai query --vendor chatgpt --inline-only --prompt "hi"
+        # 2) long Pro run with resume
+        SID=$(agbrowse web-ai send --vendor chatgpt --model pro --effort extended \\
+              --inline-only --prompt "long task" --json | jq -r .sessionId)
+        agbrowse web-ai poll --vendor chatgpt --session "$SID" --timeout 1800
+        # 3) provider-tab cleanup (keeps newest 1)
+        agbrowse tab-cleanup --provider chatgpt --keep-provider-tabs 1
+
+      Auth/plan checks (see also: agbrowse web-ai status):
+        agbrowse web-ai status --vendor chatgpt          # logged-in? plan tier?
+        Plan-gated models that need auth/upgrade are reported in status output.
+
```

### Mirror — `cli-jaw`
- `cli-jaw browser --help`: same Quick start + Stuck + Common failures block at top.
- File: `bin/commands/browser.ts` help printer.

## Acceptance
1. `agbrowse --help | head -40` shows Quick start, Stuck, Common failures blocks before reference.
2. Each top-3 subcommand shows a working example.
3. `cli-jaw browser --help` mirrors structure.

## Out of scope
- Localized (Korean) help — keep English for now; user is fluent in EN help.
- `man` page — defer.
