# Fix 6 — Session URL Reuse: Selector Wait + Session Persist

**Priority: P2** | **Status: planned** | **Audit: Rounds 1-6 PASS**

## Files

| File | Action |
|------|--------|
| `web-ai/chatgpt.mjs` | MODIFY |
| `web-ai/tab-recovery.mjs` | MODIFY |

## Problem

When navigating to an existing conversation URL (containing `/c/<id>`), agbrowse counts assistant messages before the page finishes loading, producing a wrong baseline count. Also, redirect URLs are not persisted back to the session, causing subsequent recovery to navigate to the stale URL.

## Diffs

### MODIFY `web-ai/chatgpt.mjs` — Add exported helper (near `waitForStableAssistantCount`, ~line 650)

```diff
+const CONVERSATION_URL_PATTERN = /\/c\/[a-f0-9-]+/;
+
+/**
+ * Wait for conversation page to be ready after navigation.
+ * For existing conversations (URL contains /c/), waits for assistant message
+ * selectors before counting. For new conversations, skips selector wait.
+ * @param {any} page
+ * @param {string} url
+ */
+export async function waitForConversationReady(page, url) {
+    if (CONVERSATION_URL_PATTERN.test(url || '')) {
+        await page.locator(ASSISTANT_SELECTORS[0]).first()
+            .waitFor({ state: 'attached', timeout: 10_000 })
+            .catch(() => undefined);
+    }
+    await waitForStableAssistantCount(page);
+}
```

### MODIFY `web-ai/chatgpt.mjs` — Update `sendWebAi`'s `if (input.url)` block (~lines 141-144)

```diff
     if (input.url) {
         const page = await deps.getPage();
-        await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
+        await page.goto(input.url, { waitUntil: 'load', timeout: 30_000 });
+        await waitForConversationReady(page, input.url);
+        const redirectedUrl = page.url();
+        if (redirectedUrl !== input.url) {
+            input.url = redirectedUrl;
+        }
     }
```

### MODIFY `web-ai/tab-recovery.mjs` — Update imports

```diff
-import { createTab, isTabAlive, getPageByTargetId, listManagedTabs } from '../skills/browser/tab-manager.mjs';
+import { createTab, isTabAlive, getPageByTargetId, waitForPageByTargetId, listManagedTabs } from '../skills/browser/tab-manager.mjs';
```

```diff
+import { waitForConversationReady } from './chatgpt.mjs';
```

### MODIFY `web-ai/tab-recovery.mjs` — Path 1: `withSessionPage` existing-tab (~line 197-199)

```diff
         if (current.conversationUrl && page.url() !== current.conversationUrl) {
-            await page.goto(current.conversationUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
+            await page.goto(current.conversationUrl, { waitUntil: 'load', timeout: 30_000 });
+            await waitForConversationReady(page, current.conversationUrl);
+            const finalUrl = page.url();
+            if (finalUrl !== current.conversationUrl) {
+                updateSession(sessionId, { conversationUrl: finalUrl });
+            }
         }
```

### MODIFY `web-ai/tab-recovery.mjs` — Path 2: `recoverSessionTab` existing-tab (~line 39-41)

```diff
             if (currentUrl !== session.conversationUrl) {
-                await page.goto(/** @type {string} */ (session.conversationUrl), { waitUntil: 'domcontentloaded', timeout: 30_000 });
+                await page.goto(/** @type {string} */ (session.conversationUrl), { waitUntil: 'load', timeout: 30_000 });
+                await waitForConversationReady(page, /** @type {string} */ (session.conversationUrl));
+                const finalUrl = page.url();
+                if (finalUrl !== session.conversationUrl) {
+                    await updateSession(session.sessionId, { conversationUrl: finalUrl });
+                }
             }
```

### MODIFY `web-ai/tab-recovery.mjs` — Path 3: `recoverSessionTab` new-tab (~line 52-62)

```diff
     // 2. Create new tab
     const newTab = await createTab(port, session.conversationUrl || 'about:blank');
+    // Wait for page handle unconditionally, then conversation DOM
+    let recoveredConversationUrl = session.conversationUrl;
+    if (session.conversationUrl) {
+        const newPage = await waitForPageByTargetId(port, newTab.targetId);
+        await waitForConversationReady(newPage, session.conversationUrl);
+        const finalUrl = newPage.url();
+        if (finalUrl !== session.conversationUrl) {
+            recoveredConversationUrl = finalUrl;
+        }
+    }

     // 3. Update session binding
     await updateSession(session.sessionId, {
         targetId: newTab.targetId,
+        conversationUrl: recoveredConversationUrl,
         tabState: {
```

## Design notes

All three navigation paths now:
1. Use `waitUntil: 'load'` instead of `'domcontentloaded'`
2. Call `waitForConversationReady()` for selector wait on existing conversations
3. Persist redirect URL back to the session

New-tab path uses `waitForPageByTargetId` (not `getPageByTargetId`) to ensure page handle is attached.
