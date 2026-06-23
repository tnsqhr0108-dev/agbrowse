# 02 — Tab inventory + pre-cleanup advisor

## Why
User: *"현재 띄워져 있는 탭중에서 내가 띄운거 관리( 현재 몇개가 띄워져 있는지 그리고 10개 전에 어떤거를 정리해야할지 할수 있는것)"*

Today `agbrowse tabs` lists tabs but doesn't:
- show **count + remaining headroom against `MAX_TABS=10`**,
- recommend **which tabs to close first** if user is approaching limit,
- distinguish **"opened by me / tracked" vs "untracked / pre-existing"** in the summary line.

`tab-cleanup` exists but is destructive; we want a **dry-run advisor**.

## Diff plan

### File: `skills/browser/browser.mjs`

#### Patch 1 — extend `tabs` output (line ~1968)

```diff
@@ case 'tabs':
-            tabs.forEach((t, i) => { … existing per-tab line … });
-            console.log('\nTip: run "agbrowse tab-cleanup" to close idle/overflow tabs.');
+            const MAX = Number(process.env.AGBROWSE_MAX_TABS || 10);
+            const tracked   = tabs.filter(t => t.tracked);
+            const untracked = tabs.filter(t => !t.tracked);
+            tabs.forEach((t, i) => { … existing per-tab line … });
+            console.log(`\ntotal: ${tabs.length}/${MAX}  tracked: ${tracked.length}  untracked: ${untracked.length}`);
+            if (tabs.length >= MAX - 2) {
+                const advisor = pickCleanupCandidates(tabs, MAX);
+                console.log(`⚠ approaching MAX_TABS — suggested close (oldest-idle first):`);
+                advisor.forEach(c => console.log(`   • ${c.targetId}  ${c.title}  idle=${c.idleFor}`));
+                console.log(`Run: agbrowse tab-cleanup --dry-run   (or --force to actually close)`);
+            }
```

#### Patch 2 — `tab-cleanup --dry-run` (line ~2026)

```diff
                     force: { type: 'boolean', default: false },
+                    'dry-run': { type: 'boolean', default: false },
                 },
                 strict: false,
             });
+            if (values['dry-run']) {
+                const plan = await planCleanup(getPort(), { …same opts… });
+                console.log(values.json ? JSON.stringify(plan, null, 2) : formatCleanupPreview(plan));
+                break;
+            }
```

#### Patch 3 — new helpers (near `cleanupIdleTabs`, ~line 1450)

```diff
+function pickCleanupCandidates(tabs, max) {
+    return [...tabs]
+        .filter(t => !t.active && !t.providerActive)
+        .sort((a, b) => parseIdleMs(b.idleFor) - parseIdleMs(a.idleFor))
+        .slice(0, Math.max(0, tabs.length - max + 1));
+}
+async function planCleanup(port, opts) {
+    /* same selection logic as cleanupIdleTabs but never invokes Target.closeTarget */
+    return { wouldClose: [...], reasons: {...} };
+}
```

### CLI surface
- `agbrowse tabs` → adds count line + advisory.
- `agbrowse tab-cleanup --dry-run` → list-only, no close.

### Mirror — `cli-jaw`

Files: `src/browser/actions.ts`, `src/routes/browser.ts`, `bin/commands/browser.ts`.

```diff
+ exposeRoute  POST /api/browser/tabs/cleanup   { dryRun: boolean, ...existing }
+ CLI          cli-jaw browser tab-cleanup --dry-run
+ CLI          cli-jaw browser tabs            -> append `total/max + advisor` block
```

## Acceptance
1. `agbrowse tabs` prints `total: N/10  tracked: X  untracked: Y` line.
2. With ≥8 tabs open: prints "suggested close" block.
3. `agbrowse tab-cleanup --dry-run` produces a JSON plan with `wouldClose=[]`, no tabs closed (verified by `agbrowse tabs` count unchanged).
4. cli-jaw mirror has matching subcommand + REST.

## Out of scope
- Auto-cleanup at 9-tab threshold (user wants advisor, not auto-close).
- "Pinned" tab concept — defer until explicit user request.
