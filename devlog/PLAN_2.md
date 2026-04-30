# PLAN_2: browser.mjs v3 — Antigravity 기능 포팅

> 날짜: 2026-03-27 | 기반: RESEARCH_2.md (Go 바이너리 540 심볼 분석)
> 대상: `30_browser/skills/browser/browser.mjs`

---

## P0: 즉시 추가 (reload, resize, right-click, chrome-path)

### 1. `reload` 명령

**Actions Layer 추가** (Extended Actions v2 섹션 끝에):

```javascript
async function reload(port) {
    const page = await getActivePage(port);
    if (!page) throw new Error('No active page');
    await page.reload({ waitUntil: 'domcontentloaded' });
    return { ok: true, url: page.url() };
}
```

**CLI Layer 추가** (`case 'evaluate':` 앞에):

```javascript
        case 'reload': {
            const r = await reload(getPort());
            console.log(`reloaded → ${r.url}`);
            break;
        }
```

**help 출력 추가** (`navigate <url>` 줄 아래):

```diff
     navigate <url>         Go to URL
+    reload                 Reload current page
     tabs                   List tabs
```

---

### 2. `resize` 명령

**Actions Layer 추가:**

```javascript
async function resize(port, width, height, opts = {}) {
    const page = await getActivePage(port);
    if (!page) throw new Error('No active page');

    if (opts.fullscreen) {
        // CDP fullscreen
        const cdp = await getCdpSession(port);
        await cdp.send('Emulation.setDeviceMetricsOverride', {
            width: 0, height: 0, deviceScaleFactor: 0, mobile: false,
        });
        await cdp.send('Page.setWebLifecycleState', { state: 'active' });
        await cdp.detach().catch(() => {});
        return { ok: true, mode: 'fullscreen' };
    }

    await page.setViewportSize({ width, height });
    const vp = page.viewportSize();
    return { ok: true, width: vp.width, height: vp.height };
}
```

**CLI Layer 추가:**

```javascript
        case 'resize': {
            const rw = parseInt(process.argv[3]);
            const rh = parseInt(process.argv[4]);
            if (process.argv.includes('--fullscreen')) {
                const rr = await resize(getPort(), 0, 0, { fullscreen: true });
                console.log(`resized to fullscreen`);
            } else {
                if (isNaN(rw) || isNaN(rh)) {
                    console.error('Usage: browser.mjs resize <width> <height> [--fullscreen]');
                    process.exit(1);
                }
                const rr = await resize(getPort(), rw, rh);
                console.log(`resized to ${rr.width}×${rr.height}`);
            }
            break;
        }
```

**help 추가:**

```diff
     mouse-click <x> <y>    Click at pixel coordinates [--double]
+    resize <w> <h>         Resize viewport [--fullscreen]
```

---

### 3. `right-click` (click --right 옵션)

**Actions Layer 수정** — `click()` 함수:

```diff
 async function click(port, ref, opts = {}) {
     const page = await getActivePage(port);
     const locator = await refToLocator(page, port, ref);
-    if (opts.doubleClick) await locator.dblclick();
-    else await locator.click();
+    if (opts.doubleClick) await locator.dblclick();
+    else if (opts.rightClick) await locator.click({ button: 'right' });
+    else await locator.click();
     return { ok: true, url: page.url() };
 }
```

**CLI Layer 수정** — `case 'click':`:

```diff
         case 'click': {
             const ref = process.argv[3];
             if (!ref) { console.error('Usage: browser.mjs click <ref>'); process.exit(1); }
             const opts = {};
             if (process.argv.includes('--double')) opts.doubleClick = true;
+            if (process.argv.includes('--right')) opts.rightClick = true;
             await click(getPort(), ref, opts);
             console.log(`clicked ${ref}`);
             break;
         }
```

**help 수정:**

```diff
-    click <ref>            Click element [--double]
+    click <ref>            Click element [--double] [--right]
```

---

### 4. `--chrome-path` 옵션

**Config 섹션 수정:**

```diff
 const DEFAULT_CDP_PORT = parseInt(process.env.CDP_PORT || '9222', 10);
+const CUSTOM_CHROME_PATH = process.env.CHROME_BINARY_PATH || null;
```

**`findChrome()` 수정:**

```diff
 function findChrome() {
+    if (CUSTOM_CHROME_PATH) {
+        if (existsSync(CUSTOM_CHROME_PATH)) return CUSTOM_CHROME_PATH;
+        throw new Error(`Custom Chrome path not found: ${CUSTOM_CHROME_PATH}`);
+    }
     const platform = process.platform;
```

**help 추가:**

```diff
     CHROME_NO_SANDBOX=1    Disable sandbox (Docker/CI)
+    CHROME_BINARY_PATH     Custom Chrome/Chromium binary path
```

---

## P1: 다음 단계 (get-dom, network, console, move-mouse, mouse-down/up)

### 5. `get-dom` 명령

**Actions Layer:**

```javascript
async function getDom(port, opts = {}) {
    const page = await getActivePage(port);
    if (!page) throw new Error('No active page');

    if (opts.selector) {
        const el = page.locator(opts.selector);
        return { html: await el.innerHTML() };
    }
    
    // Full page DOM (can be large — use with caution)
    const html = await page.content();
    if (opts.maxChars && html.length > opts.maxChars) {
        return { html: html.slice(0, opts.maxChars), truncated: true, totalChars: html.length };
    }
    return { html };
}
```

**CLI Layer:**

```javascript
        case 'get-dom': {
            const { values } = parseArgs({
                args: process.argv.slice(3),
                options: {
                    selector: { type: 'string' },
                    'max-chars': { type: 'string' },
                }, strict: false,
            });
            const maxChars = values['max-chars'] ? parseInt(values['max-chars']) : undefined;
            const r = await getDom(getPort(), { selector: values.selector, maxChars });
            if (r.truncated) console.error(`[truncated: ${r.maxChars}/${r.totalChars} chars]`);
            console.log(r.html);
            break;
        }
```

---

### 6. `console` 명령 (콘솔 로그 캡처)

**Actions Layer:**

```javascript
async function captureConsole(port, opts = {}) {
    const page = await getActivePage(port);
    if (!page) throw new Error('No active page');
    const duration = opts.duration || 5000;

    const logs = [];
    const handler = msg => {
        logs.push({ type: msg.type(), text: msg.text() });
    };
    page.on('console', handler);

    await new Promise(r => setTimeout(r, duration));
    page.removeListener('console', handler);

    return { logs, count: logs.length };
}
```

**CLI Layer:**

```javascript
        case 'console': {
            const dur = process.argv.includes('--duration')
                ? parseInt(process.argv[process.argv.indexOf('--duration') + 1])
                : 5000;
            const cl = await captureConsole(getPort(), { duration: dur });
            for (const log of cl.logs) {
                console.log(`[${log.type}] ${log.text}`);
            }
            if (cl.count === 0) console.log('(no console output captured)');
            break;
        }
```

---

### 7. `network` 명령 (네트워크 요청 조회)

**Actions Layer:**

```javascript
async function captureNetwork(port, opts = {}) {
    const page = await getActivePage(port);
    if (!page) throw new Error('No active page');

    const cdp = await getCdpSession(port);
    await cdp.send('Network.enable');

    const requests = [];
    const duration = opts.duration || 5000;

    cdp.on('Network.requestWillBeSent', (params) => {
        requests.push({
            method: params.request.method,
            url: params.request.url,
            type: params.type,
        });
    });

    await new Promise(r => setTimeout(r, duration));
    await cdp.send('Network.disable');
    await cdp.detach().catch(() => {});

    if (opts.filter) {
        return { requests: requests.filter(r => r.url.includes(opts.filter)) };
    }
    return { requests };
}
```

**CLI Layer:**

```javascript
        case 'network': {
            const dur = process.argv.includes('--duration')
                ? parseInt(process.argv[process.argv.indexOf('--duration') + 1])
                : 5000;
            const filter = process.argv.includes('--filter')
                ? process.argv[process.argv.indexOf('--filter') + 1]
                : undefined;
            const nr = await captureNetwork(getPort(), { duration: dur, filter });
            for (const req of nr.requests) {
                console.log(`${req.method.padEnd(6)} ${req.type?.padEnd(10) || ''} ${req.url}`);
            }
            console.log(`\n${nr.requests.length} requests captured`);
            break;
        }
```

---

### 8. `move-mouse` / `mouse-down` / `mouse-up`

**Actions Layer:**

```javascript
async function moveMouse(port, x, y) {
    const page = await getActivePage(port);
    await page.mouse.move(x, y);
    return { ok: true, position: { x, y } };
}

async function mouseDown(port, opts = {}) {
    const page = await getActivePage(port);
    await page.mouse.down({ button: opts.button || 'left' });
    return { ok: true };
}

async function mouseUp(port, opts = {}) {
    const page = await getActivePage(port);
    await page.mouse.up({ button: opts.button || 'left' });
    return { ok: true };
}
```

**CLI Layer:**

```javascript
        case 'move-mouse': {
            const mmx = parseInt(process.argv[3]);
            const mmy = parseInt(process.argv[4]);
            if (isNaN(mmx) || isNaN(mmy)) {
                console.error('Usage: browser.mjs move-mouse <x> <y>');
                process.exit(1);
            }
            await moveMouse(getPort(), mmx, mmy);
            console.log(`mouse moved to (${mmx}, ${mmy})`);
            break;
        }
        case 'mouse-down': {
            const btn = process.argv.includes('--right') ? 'right' : 'left';
            await mouseDown(getPort(), { button: btn });
            console.log(`mouse down (${btn})`);
            break;
        }
        case 'mouse-up': {
            const btn = process.argv.includes('--right') ? 'right' : 'left';
            await mouseUp(getPort(), { button: btn });
            console.log(`mouse up (${btn})`);
            break;
        }
```

---

## 파일 변경 요약

```diff
  30_browser/skills/browser/browser.mjs
+   P0: reload, resize, click --right, CHROME_BINARY_PATH
+   P1: get-dom, console, network, move-mouse, mouse-down, mouse-up
+   예상: 759L → ~950L

  30_browser/skills/browser/SKILL.md
+   신규 명령 문서화
```

## 실행 순서

```
1. P0 4개 적용 → node --check → help 확인
2. P1 4개 적용 → node --check → help 확인  
3. SKILL.md 업데이트
4. CHANGELOG_2.md 작성
```
