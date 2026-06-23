# 03 — "start keeps dying" diagnostics + clearer failure messages

## Symptom
User: *"자꾸 start가 안되어서 종료된다는 그런 문제들이 있는데 왜 자꾸 그런 문제가 발생하는지"*

`agbrowse start --headed` sometimes:
- exits with `❌ Failed` and no further detail,
- attaches to a stale CDP it didn't spawn (warning printed but easy to miss),
- silently re-uses headless when user wanted headed (current code throws but only when `previousState.headless===true`),
- gets `Chrome CDP not responding on port X after 10s` with three bullet points but no instruction on what to actually run next.

## Root causes (from code reading)
1. **macOS Chrome singleton**: if user already has a Chrome window open (even unrelated), spawning `Google Chrome.app` with the same `--user-data-dir=` may be absorbed by the existing process. Our launch only checks port-listening, not "did our PID become the CDP".
2. **Stale lockfile**: `acquireProfileLock` may succeed but the actual Chrome from a previous run was killed externally; `previousState.pid` is stale.
3. **Foreign CDP**: a non-agbrowse Chrome on port 9222 (e.g., DevTools-launched) gets attached silently; user thinks `start` worked but profile/flags differ.
4. **CHROME_HEADLESS env leak**: env var set in a parent shell silently flips mode; no warning.

## Diff plan

### File: `skills/browser/browser.mjs`

#### Patch 1 — `agbrowse doctor` subcommand (new, near `status` ~line 1720)

```diff
+        case 'doctor': {
+            const r = await runStartDoctor({ port: Number(values?.port || DEFAULT_CDP_PORT) });
+            console.log(r.format === 'json' ? JSON.stringify(r, null, 2) : formatDoctorReport(r));
+            if (!r.ok) process.exit(2);
+            break;
+        }
```

`runStartDoctor` checks (in order, fail-fast with cite-able reasons):

| # | check                                                | failure → user instruction                                                       |
|---|------------------------------------------------------|----------------------------------------------------------------------------------|
| 1 | Profile lock file exists & PID alive                 | "Stale lock from PID X. Run `agbrowse stop` then retry, or rm `<lock-path>`."    |
| 2 | Port 9222 already listening?                         | "Port in use by PID X (`<exe>`). If not agbrowse, kill it or `agbrowse start --port 9223`." |
| 3 | If listening, is it ours? (compare `/json/version.User-Agent` against persisted state) | "Foreign CDP detected. `agbrowse stop` does NOT close it. Close manually."        |
| 4 | `CHROME_HEADLESS` / `AGBROWSE_*` env vars set?      | "Detected env var X=… — this overrides `--headed`. Unset to use `--headed`."     |
| 5 | macOS: any other Chrome instance with our `--user-data-dir`? | "Another Chrome.app is bound to the profile. Quit it before `start --headed`." |
| 6 | Display available? (`echo $DISPLAY` on Linux, AppKit on macOS) | "No display. Use `--headless` or `CHROME_HEADLESS=1`."                          |

#### Patch 2 — improved CDP-not-responding error (line ~480)

```diff
-            throw new Error(
-                `Chrome CDP not responding on port ${port} after 10s. ` +
-                `Possible causes:\n` +
-                `  - Windows: Chrome singleton absorbed the launch (close ALL Chrome windows first)\n` +
-                `  - No display available (try --headless or CHROME_HEADLESS=1)\n` +
-                `  - Port conflict (try --port <other>)`
-            );
+            const lockPath = path.join(DATA_DIR, 'profile.lock');
+            const portInfo = await describePortHolder(port);
+            throw new Error(
+                `Chrome CDP not responding on port ${port} after 10s.\n` +
+                `\n` +
+                `Diagnose: agbrowse doctor\n` +
+                `\n` +
+                `Likely causes (most common first):\n` +
+                `  1. macOS/Win Chrome singleton absorbed the launch.\n` +
+                `       → Quit all Chrome windows, then: agbrowse start --headed\n` +
+                `  2. Port ${port} held by ${portInfo || 'another process'}.\n` +
+                `       → agbrowse start --port ${port + 1}\n` +
+                `  3. Stale profile lock at ${lockPath}.\n` +
+                `       → agbrowse stop  (or: rm ${lockPath})\n` +
+                `  4. No display available.\n` +
+                `       → CHROME_HEADLESS=1 agbrowse start\n`
+            );
```

#### Patch 3 — env-var leak warning (line ~503)

```diff
 function resolveHeadlessMode(opts = {}) {
     if (opts.headed === true) return false;
-    return opts.headless === true || process.env.CHROME_HEADLESS === '1';
+    if (opts.headless === true) return true;
+    if (process.env.CHROME_HEADLESS === '1') {
+        console.warn('[browser] note: CHROME_HEADLESS=1 in env → starting headless. Use --headed to override.');
+        return true;
+    }
+    return false;
 }
```

#### Patch 4 — mark `start` failures with PID-in-message (line ~485)

```diff
         } else {
             if (chromeProc && !chromeProc.killed) {
+                console.error(`[browser] failed launch: spawned PID ${chromeProc.pid} but CDP did not respond`);
                 chromeProc.kill('SIGTERM');
                 chromeProc = null;
             }
```

### Mirror — `cli-jaw`
- `cli-jaw browser doctor` → calls REST `/api/browser/doctor` → backend invokes same `runStartDoctor`.
- `cli-jaw browser start` error printer mirrors the new multi-line format.

## Acceptance
1. `agbrowse doctor` exits 0 when start would succeed, 2 with diagnostic JSON when not.
2. Triggering each of the 6 failure modes manually produces the matching guidance line.
3. cli-jaw mirror exposes `cli-jaw browser doctor` returning identical JSON shape.

## Out of scope
- Auto-recovery (auto-killing foreign CDP) — explicit user action only.
- Windows-specific singleton workaround — note in error message, don't try to solve.
