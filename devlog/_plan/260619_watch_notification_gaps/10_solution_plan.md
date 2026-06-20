# Watch / Notification Gaps — Solution Plan

> Documentation only; code sketch illustrative. Split into TIER 1 (safe, do-first) and TIER 2 (optional, risk-bounded). **Poll is always the source of truth**; events only ever shorten the wait, never declare completion.

## TIER 1 — Safe wins (no event dependency)

**1A. Adaptive poll interval (bounded, deterministic).** Replace the constant `sleep(intervalMs)` with an interval from the last tick's `status` + time-since-send, clamped to `[minMs, maxMs]`:
- Just after `watch.start` / a fresh `sent` session (completion likely soon): poll fast (~2s).
- `status === 'streaming'` (`watcher.mjs:236,449-453`): medium (~3s) — answer imminent.
- `status === 'polling'`, stable for N ticks (idle / long reasoning / pro): **back off** geometrically toward `maxMs` (5s → 10s → 15s default, cap 30s for pro-length deadlines).

This *is* the pro=3600s mitigation: idle ⇒ slow floor, never a 500ms hammer; the fast band applies only in the short completion-likely window.

**1B. Format-agnostic conversation identity (per-provider registry).** Replace the single `/c/{id}` regex:

```js
const CONVERSATION_ID_EXTRACTORS = {
  chatgpt: (u) => u.match(/\/c\/([a-f0-9-]+)/)?.[1] ?? null,
  gemini:  (u) => u.match(/\/app\/([a-z0-9-]+)/i)?.[1] ?? null,
  grok:    (u) => u.match(/\/chat\/([a-z0-9-]+)/i)?.[1] ?? null,
};
function extractConversationId(url, vendor = 'chatgpt') {
  if (!url) return null;
  return (CONVERSATION_ID_EXTRACTORS[vendor] ?? CONVERSATION_ID_EXTRACTORS.chatgpt)(url);
}
```

Unknown vendor ⇒ normalized-URL compare (host alias + trailing-slash + query/hash stripped). Fixes the poll mismatch guard for all three vendors.

**1C. Re-read `conversationUrl` from the live tab + tolerate redirects.** In `ensureWatcherAttached`, stop the strict compare-or-fail. Instead: call the **existing** `shouldPreferCurrentProviderUrl` (`tab-recovery.mjs`); if the live tab is the *same conversation id* (1B) but a drifted URL, **self-heal** — write the live URL back into the session (mirroring `tab-recovery.mjs:314-325`), no `--navigate`. Only a genuinely *different* conversation (different id, or cross-host with no id match) stays a mismatch.

**1D. Robust reattach without manual `--navigate`.** Route the watcher's attach through `resolveSessionPage(deps, sessionId, { allowNavigate })` (`tab-recovery.mjs:259`) so watch **inherits** the drift tolerance + recovery already shipped for reattach/resume — closing the asymmetry and retiring the Issue #77 "root-to-conversation URL drift" row for the watch path. `--navigate` then governs only *cross-tab* switching (genuinely different conversation), not benign same-conversation drift.

## TIER 2 — Optional CDP "early nudge" (opt-in `--cdp-nudge`, default off)

A bounded enhancement layered on the Tier-1 poll. It **never declares completion**; it only resolves the sleep early so the next poll (with its robust DOM-stability logic) runs sooner. Delivered as an internal early-wake signal, orthogonal to the pluggable notifier (which still emits the authoritative `watch.complete` only after a real poll confirms).

```js
// inside the loop, replacing await sleep(interval)
const wake = subscribeEarlyWake(deps, { floorMs: 1_500 });   // first cheap signal wins
await Promise.race([sleep(interval), wake.promise]).catch(() => {});  // a rejected wake must never crash
wake.dispose();
```

Cheap signals (any one fires the nudge): stop-button present→absent (`MutationObserver` on `button[data-testid="stop-button"]`); `Page.lifecycleEvent` networkIdle; `Network.loadingFinished` on the SSE endpoint. Debounce ~250ms; **floor the early-wake at ≥1.5s** so a chatty page can't poll faster than that.

### Honest risk table (why poll-as-safety-net contains every failure)

| Failure mode | Trigger | If it fires wrong | Containment |
|---|---|---|---|
| `stop-button` testid renamed/removed | provider DOM change | nudge silently no-ops | falls back to Tier-1 floor (≤15s); no missed completion |
| networkIdle not fired / late | known CDP bug (devtools-protocol #154) | late/absent nudge | latency degrades to 15s floor — strictly no-worse than today |
| networkIdle fires early (mid-stream lull) | SSE keep-alive gap | an extra poll runs; sees streaming still true → `polling` | wasted poll only; poll, not event, decides completion |
| event flood | heavy DOM churn | tight-loop / CPU burn | debounce + ≥1.5s early-wake floor cap the poll rate |
| truncated/errored response leaves stop-button stuck | provider error UI | nudge never fires | Tier-1 floor + existing deadline/timeout path (`watcher.mjs:163-173`) still terminates |
| CDP session detaches / tab crash | tab death | `earlyWake()` rejects | `Promise.race(...).catch()` → sleep still resolves; poll hits existing `isPageDeathError` path |
| long pro/Deep-Research run | — | frequent benign idle nudges | each gated by floor + backoff; poll confirms "still streaming" |

**Net contract:** a broken or hostile event can only make latency *worse-bounded-by-the-floor* or waste a poll — it can **never** cause a false or missed completion, because completion is decided exclusively by `pollWebAi`'s DOM-stability logic, unchanged.

## Code sketch (illustrative — NOT for commit)

```diff
// watcher.mjs — adaptive interval
+ function nextInterval(prev, tick, opts) {
+   const { minMs = 2_000, maxMs = 30_000, floorMs = opts.intervalMs } = opts;
+   if (tick.status === 'streaming') return Math.max(minMs, 3_000);
+   if (tick.justSent)              return minMs;
+   if (tick.status === 'polling') return Math.min(maxMs, Math.round((prev ?? floorMs) * 1.5)); // pro-safe backoff
+   return floorMs;
+ }
- await sleep(options.intervalMs);
+ const interval = nextInterval(interval, tick, options);
+ const wake = options.cdpNudge ? subscribeEarlyWake(deps, { floorMs: 1_500 }) : null;
+ await Promise.race([sleep(interval), wake?.promise].filter(Boolean)).catch(() => {});
+ wake?.dispose?.();

// watcher.mjs — ensureWatcherAttached: reuse existing tolerance, self-heal
+ if (sameConversation(currentUrl, targetUrl, session.vendor)) {            // 1B registry
+   if (currentUrl !== targetUrl) updateSession(session.sessionId, { conversationUrl: currentUrl }); // self-heal
+   return { ok: true, url: currentUrl, warnings: [] };
+ }
+ if (options.navigate) { await page.goto(targetUrl, ...); return { ok: true, ... }; }
+ return { ok: false, url: currentUrl, warnings: [`tab is a different conversation; pass --navigate`] };
```

## Test Strategy (absorbs area-5 gaps)

Homes: `test/unit/web-ai-watcher.test.mjs` (source-string contracts), `test/integration/web-ai-fake-chatgpt.test.mjs` (fake provider).

**Tier 1**
- **URL extraction registry (unit, table-driven):** per vendor feed real + drifted URLs (`/c/<uuid>`, `/app/<id>`, `/chat/<id>`, host alias `chat.openai.com`↔`chatgpt.com`, trailing slash, `?model=`, `#hash`) → `extractConversationId` returns the stable id; `sameConversation` true across cosmetic drift, false across different ids.
- **Watcher self-heals on provider redirect (integration):** session created at `/`, fake redirects to `/c/<id>` after send; `watchSessionOnce` **without** `--navigate` → no `reattach-mismatch`, `session.conversationUrl` rewritten to live URL, poll proceeds.
- **Reattach with/without `--navigate` (integration):** (a) *different conversation*, no `--navigate` → `reattach-mismatch` preserved (don't hijack the user's other tab); (b) same + `--navigate` → navigates; (c) same-conversation drift, no `--navigate` → recovers silently.
- **Adaptive interval (unit, pure fn):** `nextInterval` fast after send, medium while streaming, geometric backoff while polling; a long-deadline (pro) sequence converges to the slow floor and never below `minMs`.

**Tier 2 (if built)**
- **Nudge shortens wait (integration, fake CDP):** synthetic stop-button-removed / networkIdle mid-sleep → next poll starts before `interval` elapsed.
- **Fallback-to-poll correctness (load-bearing):** (a) never fire any event → completion still detected within the Tier-1 floor; (b) fire networkIdle *early while still streaming* → poll returns `polling`, NOT `complete`; (c) make `earlyWake()` reject (simulate CDP detach) → loop catches, `sleep` still resolves, watch continues; (d) flood events → poll rate capped by the floor.

## Open Risks / Tradeoffs (honest CDP-event assessment)

- **The user's "risky" call is correct, and the search confirms it.** `Page.lifecycleEvent` networkIdle is documented as "not fired in some cases" (devtools-protocol #154). A design that *trusted* it would be fragile. Using it only as an early-*nudge* with poll-as-truth converts that unreliability from a correctness bug into, at worst, latency capped at today's 15s floor.
- **Tier-1 carries the genuine behavior-change risk, not Tier-2.** Self-healing `conversationUrl` (1C/1D) means the watcher follows a drifted URL without asking. Mitigation: strict gating on *conversation-id equality* (1B) — a different id still requires `--navigate`. Be conservative here: silently attaching to the wrong conversation is worse than a 15s delay.
- **Selector coupling** (stop-button testid) is the Tier-2 liability, but unlike completion detection it incurs no correctness penalty when it rots.
- **Adaptive polling raises request volume in the fast band** — bounded by `minMs` and backoff once `polling` stabilizes; the pro/Deep-Research path explicitly backs off.
- **Scope discipline:** Tier 1 is mostly *consolidation* — `shouldPreferCurrentProviderUrl` + self-heal already exist in `tab-recovery.mjs`; the watcher just isn't using them. Ship Tier 2 behind `--cdp-nudge` (default off), with the floor and `Promise.race(...).catch()` containment as non-negotiable.

## References (web)

devtools-protocol #154 (networkIdle unreliable — validates poll-as-safety-net); Chrome DevTools Protocol reference (Page/Network/DOM); Chrome for Developers "Detect DOM changes with MutationObserver" (stop-button-disappearance nudge).
