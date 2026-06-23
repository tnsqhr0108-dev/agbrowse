# 01 — Residual env-fails: nytimes / amazon

## Symptom
After 4-stage navigate fallback (commit 30cd857), 18/20 sites pass headed-Chrome bench. Two stay blank:
- `https://www.nytimes.com`
- `https://www.amazon.com`

Even a fresh `Target.createTarget` tab renders 0×0 / blank. Both URLs return 200 via `curl` from the same machine. Failure reproduces on cold profile.

## Hypotheses (ranked)
1. **COEP/CORP × launch-flag mismatch** — both sites set strict `Cross-Origin-Embedder-Policy: require-corp` and our launch flags include `--disable-background-networking`, which historically gates some embedder fetches. (highest)
2. **Anti-bot fingerprint kill** — nytimes & amazon both run heavy bot detection; with profile reused, the page may load then JS-redirect to a 0×0 challenge frame.
3. **Window size race** — both sites do early `window.matchMedia`; if the navigate fires before the OS finishes window allocation, layout collapses.

## Evidence to collect (one bash session)
```
agbrowse stop && agbrowse start --headed
agbrowse navigate https://www.nytimes.com
agbrowse evaluate "JSON.stringify({w:innerWidth,h:innerHeight,coop:document.featurePolicy?.allowedFeatures?.()??null,err:document.title})"
# repeat with: --disable-features=CrossOriginOpenerPolicy,CrossOriginEmbedderPolicy
# repeat with: --disable-blink-features=AutomationControlled
# repeat with: --disable-background-networking REMOVED
# repeat after deleting profile (reset --force) to rule out anti-bot
```
Save each transcript to `devlog/_smoke/260506_20site_bench/residual/<flag>_<site>.txt`.

## Diff plan

### File: `skills/browser/browser.mjs`

#### Patch 1 — make launch flags configurable (line ~451)

```diff
@@ chrome launch
-        chromeProc = spawn(chrome, [
-            `--remote-debugging-port=${port}`,
-            `--user-data-dir=${PROFILE_DIR}`,
-            `--window-size=${minWidth},${minHeight}`,
-            '--no-first-run', '--no-default-browser-check',
-            '--disable-dev-shm-usage',
-            '--disable-background-networking',
-            ...(noSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
-            ...(headless ? ['--headless=new'] : []),
-            'about:blank',
-        ], { detached: true, stdio: 'ignore' });
+        const extraFlags = (process.env.AGBROWSE_CHROME_FLAGS || '').split(/\s+/).filter(Boolean);
+        const baseFlags = [
+            `--remote-debugging-port=${port}`,
+            `--user-data-dir=${PROFILE_DIR}`,
+            `--window-size=${minWidth},${minHeight}`,
+            '--no-first-run', '--no-default-browser-check',
+            '--disable-dev-shm-usage',
+        ];
+        const networkingFlag = process.env.AGBROWSE_KEEP_BG_NETWORKING === '1'
+            ? []
+            : ['--disable-background-networking'];
+        const compatFlags = process.env.AGBROWSE_HEAVY_SITE_COMPAT === '1'
+            ? ['--disable-blink-features=AutomationControlled',
+               '--disable-features=CrossOriginOpenerPolicy,CrossOriginEmbedderPolicy']
+            : [];
+        chromeProc = spawn(chrome, [
+            ...baseFlags,
+            ...networkingFlag,
+            ...compatFlags,
+            ...extraFlags,
+            ...(noSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
+            ...(headless ? ['--headless=new'] : []),
+            'about:blank',
+        ], { detached: true, stdio: 'ignore' });
```

#### Patch 2 — `start --heavy-site-compat` shortcut (line ~1697)

```diff
@@ start case
-                'chrome-path': { type: 'string' },
+                'chrome-path': { type: 'string' },
+                'heavy-site-compat': { type: 'boolean', default: false },
+                'keep-bg-networking': { type: 'boolean', default: false },
             }, strict: false,
         });
+        if (values['heavy-site-compat']) process.env.AGBROWSE_HEAVY_SITE_COMPAT = '1';
+        if (values['keep-bg-networking']) process.env.AGBROWSE_KEEP_BG_NETWORKING = '1';
         await launchChrome(Number(values.port), { ...
```

#### Patch 3 — help text (under `start`, ~line 2440)

```diff
+        --heavy-site-compat   Add Chrome flags that unblock nytimes/amazon-class
+                              sites (relaxes COEP/COOP, hides automation hint).
+                              Trades some perf for compatibility.
+        --keep-bg-networking  Don't pass --disable-background-networking.
```

### File: `cli-jaw` mirror

Mirror nothing source-side — cli-jaw delegates launch to its own `launchAgent` path. **Audit only**: confirm cli-jaw inherits any `AGBROWSE_*` env or has its own equivalent. If not, file follow-up issue (out of scope here).

## Acceptance
- `AGBROWSE_HEAVY_SITE_COMPAT=1 agbrowse start --headed && agbrowse navigate https://www.nytimes.com` → snapshot returns ≥5 refs.
- `agbrowse start --headed` (default) still passes the 18 currently-green sites.
- New evidence written under `devlog/_smoke/260506_20site_bench/residual/`.

## Out of scope
- Stealth / `playwright-extra-plugin-stealth` — explicitly forbidden by gate:no-cloud-stealth-claims.
- Auto-enabling heavy-site-compat per-URL: route flag is opt-in.
