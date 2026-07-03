# 05 — web-ai login + plan-tier detection

## Why
User: *"이제 web ai에서 로그인 상태 확인, 요금제 확인 / 비로그인 상태 - 모델 선택 불가나 팝업 / 요금제 pro 모델 선택 불가능 expert 선택 불가능 deepthink 선택 불가능 이런걸 인지할수 있도록 하는 플랜"*

Today `web-ai status` returns capability rows for **composer-visible / model-alias-selectable / upload-surface-visible / copy-button-present / response-streaming**, but does **not** explicitly classify:
- logged-out (no account avatar, login wall visible),
- free / plus / pro tier,
- which models the **current account** can pick (model-alias-selectable today only checks if the alias appears in DOM, not that the user can actually select it without a paywall popup).

Goal: add **two new capability rows per provider** (`auth-state`, `plan-tier`) and gate model selection so paywall-blocked aliases fail fast with a structured error instead of crashing inside the picker.

## Provider-specific selectors (research findings)

### ChatGPT
| signal                        | selector / probe                                                  |
|-------------------------------|-------------------------------------------------------------------|
| logged-out                    | `a[href^="/auth/login"]:visible`, banner `[data-testid="login-button"]` |
| account avatar (logged-in)    | `[data-testid="profile-button"]`, `button[aria-haspopup="menu"][aria-label*="profile" i]` |
| paywall popup on Pro click    | `[role="dialog"] :text("Upgrade to ChatGPT Pro")`                  |
| Plan in profile menu          | open profile menu → `:text("Upgrade plan")` ↔ free, `:text("My plan")` ↔ paid |

### Gemini
| signal                        | selector / probe                                                  |
|-------------------------------|-------------------------------------------------------------------|
| logged-out                    | `a[aria-label*="Sign in" i]`, `[href*="ServiceLogin"]`             |
| Pro / Advanced badge          | `:text("Gemini Advanced")` next to model selector                 |
| DeepThink unavailable popup   | `[role="dialog"] :text("Get Gemini Advanced")`                    |

### Grok
| signal                        | selector / probe                                                  |
|-------------------------------|-------------------------------------------------------------------|
| logged-out (uses x.com auth)  | `a[href*="/login"]:visible`, `[data-testid="loginButton"]`         |
| SuperGrok / Heavy gating      | toast/dialog with `:text("subscription")` or `:text("Upgrade")`    |
| Expert/Heavy click → modal    | `[role="dialog"] :text("Upgrade to SuperGrok")`                    |

## Diff plan

### File: `web-ai/chatgpt-model.mjs` (and analogues for grok-model.mjs / gemini-model.mjs)

#### Patch 1 — auth + plan probes (new exports)

```diff
+const CHATGPT_LOGIN_SELECTORS = [
+    'a[href^="/auth/login"]',
+    '[data-testid="login-button"]',
+];
+const CHATGPT_AVATAR_SELECTORS = [
+    '[data-testid="profile-button"]',
+    'button[aria-haspopup="menu"][aria-label*="profile" i]',
+];
+const CHATGPT_PAYWALL_DIALOG_SELECTORS = [
+    '[role="dialog"]:has-text("Upgrade to ChatGPT")',
+    '[role="dialog"]:has-text("ChatGPT Pro")',
+];
+
+export async function probeChatGptAuthState(page) {
+    const login = await firstVisible(page, CHATGPT_LOGIN_SELECTORS, 800);
+    if (login) return { state: 'fail', evidence: { reason: 'login-wall', selector: login.selector }, next: 'sign in at chatgpt.com then re-run' };
+    const avatar = await firstVisible(page, CHATGPT_AVATAR_SELECTORS, 1200);
+    if (!avatar) return { state: 'unknown', evidence: { reason: 'no-avatar-no-login' }, next: 'reload page or check session cookies' };
+    return { state: 'ok', evidence: { selector: avatar.selector }, next: 'logged in' };
+}
+
+export async function probeChatGptPlanTier(page) {
+    // Open profile menu non-destructively; close after probe.
+    const avatar = await firstVisible(page, CHATGPT_AVATAR_SELECTORS, 800);
+    if (!avatar) return { state: 'unknown', evidence: { reason: 'no-avatar' }, next: 'auth state unknown' };
+    let tier = 'unknown';
+    try {
+        await page.locator(avatar.selector).first().click({ trial: false, timeout: 2000 });
+        const upgrade = await page.locator('[role="menuitem"]:has-text("Upgrade plan"), [role="menuitem"]:has-text("Upgrade to")').first();
+        const myPlan  = await page.locator('[role="menuitem"]:has-text("My plan"), :text("ChatGPT Plus"), :text("ChatGPT Pro")').first();
+        if (await upgrade.isVisible({ timeout: 600 }).catch(() => false)) tier = 'free';
+        else if (await myPlan.isVisible({ timeout: 600 }).catch(() => false)) {
+            const txt = (await myPlan.innerText().catch(() => '')).toLowerCase();
+            tier = txt.includes('pro') ? 'pro' : txt.includes('plus') ? 'plus' : 'paid';
+        }
+    } finally {
+        await page.keyboard.press('Escape').catch(() => {});
+    }
+    return { state: tier === 'unknown' ? 'unknown' : 'ok', evidence: { tier }, next: '' };
+}
```

#### Patch 2 — gate `selectChatGptModel` paywall path

```diff
 export async function selectChatGptModel(page, model, opts = {}) {
+    // pre-flight: detect a known paywall dialog left over from a prior click
+    const paywall = await firstVisible(page, CHATGPT_PAYWALL_DIALOG_SELECTORS, 200);
+    if (paywall) {
+        await page.keyboard.press('Escape').catch(() => {});
+        throw new WebAiError('PAYWALL_BLOCKED', `model "${model}" requires a higher plan (paywall dialog detected: ${paywall.selector})`, { model, selector: paywall.selector, recoverable: false });
+    }
     ...
     // existing click flow
+    // post-click: if a paywall popped up after click, surface as PAYWALL_BLOCKED
+    const postClickPaywall = await firstVisible(page, CHATGPT_PAYWALL_DIALOG_SELECTORS, 1200);
+    if (postClickPaywall) {
+        await page.keyboard.press('Escape').catch(() => {});
+        throw new WebAiError('PAYWALL_BLOCKED', `model "${model}" not selectable on current plan (post-click dialog)`, { model, selector: postClickPaywall.selector, recoverable: false });
+    }
```

### File: `web-ai/chatgpt.mjs` (also gemini-live.mjs / grok-live.mjs)

```diff
 export const chatGptCapabilities = [
     defineCapability('chatgpt-active-tab-verification', ...),
+    defineCapability('chatgpt-auth-state', async (deps) => probeChatGptAuthState(await deps.getPage())),
+    defineCapability('chatgpt-plan-tier', async (deps) => probeChatGptPlanTier(await deps.getPage())),
     defineCapability('chatgpt-composer-visible', ...),
     defineCapability('chatgpt-model-alias-selectable', ...),
     ...
 ];
```

`statusWebAi` then naturally surfaces the new rows:
```json
{
  "status": "ready",
  "capabilities": [
    {"capabilityId":"chatgpt-auth-state","state":"ok","evidence":{...}},
    {"capabilityId":"chatgpt-plan-tier","state":"ok","evidence":{"tier":"pro"}},
    ...
  ]
}
```

### CLI surface
- `agbrowse web-ai status --vendor <v> --json` → returns auth + tier rows.
- `agbrowse web-ai status --vendor <v>` (text) → adds two lines:
  ```
  auth: logged-in
  plan: pro   (models available: instant, thinking, pro)
  ```
- `agbrowse web-ai send --vendor chatgpt --model pro` on free account → fails with `PAYWALL_BLOCKED` envelope (no crash).

### Mirror — `cli-jaw`
Files: `src/browser/web-ai/chatgpt.ts`, `gemini-live.ts`, `grok-live.ts`, `capability-registry.ts`.

```
+ probeChatGptAuthState  / probeChatGptPlanTier      (port from .mjs)
+ probeGeminiAuthState   / probeGeminiPlanTier
+ probeGrokAuthState     / probeGrokPlanTier
+ register `*-auth-state` and `*-plan-tier` capability rows
+ extend CLI status printer to render auth: / plan: lines
+ extend types for `PAYWALL_BLOCKED` error envelope
```

## Acceptance
1. Logged-out chatgpt.com tab → `web-ai status --vendor chatgpt` reports `auth-state=fail`, exits non-zero on `--strict`.
2. Free-tier chatgpt account → `auth-state=ok`, `plan-tier=ok evidence.tier=free`. Attempting `--model pro` returns `errorCode=PAYWALL_BLOCKED`.
3. Pro-tier account → tier=pro, all three models selectable.
4. Same three checks pass on gemini (free vs Advanced) and grok (free vs SuperGrok).
5. cli-jaw mirror produces identical JSON envelope.

## Risks / mitigations
- **Selectors drift**: chatgpt/gemini/grok ship UI tweaks weekly. Probes use `:has-text()` substring + multi-selector fallback; failures degrade to `state:'unknown'` rather than crashing.
- **Profile menu side-effect**: opening the menu mutates UI state. Probe wraps in try/finally with `Escape`. Gate behind `--probe-plan` flag if turbo-mode users want to skip.

## Out of scope
- Auto-upgrade flow / payment links — explicit refusal.
- Cookie-injection workarounds — forbidden by gate:no-cloud-stealth-claims.
- Model alias→tier mapping cache — defer until first use surfaces drift.
