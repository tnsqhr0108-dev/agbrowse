Attached source reviewed:  

## 1. Where agbrowse meaningfully differs

### Oracle / openclaw `oracle`

* **Control surface:** Oracle is closest for “ask another model with my context,” but it is primarily a one-shot consultation CLI that bundles prompt/files for another model; agbrowse is a lower-level local Chrome/CDP runtime with browser primitives plus provider-specific `status/send/poll/query`. [Source: [https://github.com/steipete/oracle](https://github.com/steipete/oracle)] ([GitHub][1])
* **Context transparency:** Both expose dry-run/render paths; Oracle documents previewing the composed prompt/files before sending, while agbrowse’s `render`/`context-dry-run` exposes a stable `[SYSTEM]` / `[USER]` / `[INSTRUCTIONS]` envelope and local context-package transport. [Source: [https://github.com/steipete/oracle/blob/main/docs/browser-mode.md](https://github.com/steipete/oracle/blob/main/docs/browser-mode.md)] ([GitHub][2]) 
* **Model coverage:** Oracle’s docs list broader API/browser model coverage, including OpenAI, Gemini, and Claude families, and can ask multiple models in one run; agbrowse’s production matrix is ChatGPT, Gemini, Grok web UIs only. [Source: [https://github.com/steipete/oracle](https://github.com/steipete/oracle)] ([GitHub][1]) 
* **Session/login reuse:** Oracle documents browser-mode profiles, session listing/replay, and reattachable sessions; agbrowse has persistent Chrome profile reuse, but current web-ai persistence is baseline-only and keyed by `vendor:url`. [Source: [https://github.com/steipete/oracle/blob/main/CHANGELOG.md](https://github.com/steipete/oracle/blob/main/CHANGELOG.md)] ([GitHub][3]) 

### browser-use

* **Control surface:** browser-use is an autonomous Python agent loop over Chromium/CDP; agbrowse is intentionally a short-lived CLI surface for an external agent to observe/act/poll. [Source: [https://github.com/browser-use/browser-use/blob/main/AGENTS.md](https://github.com/browser-use/browser-use/blob/main/AGENTS.md)] ([GitHub][4])
* **CLI ergonomics:** browser-use exposes commands such as `open`, `state`, `click`, `type`, `screenshot`, and keeps a browser running between commands; agbrowse exposes similar browser primitives plus a dedicated `web-ai` provider runtime. [Source: [https://github.com/browser-use/browser-use](https://github.com/browser-use/browser-use)] ([GitHub][5])
* **Model coverage:** browser-use is LLM-provider agnostic in code examples; agbrowse is narrower but deeper for ChatGPT/Gemini/Grok web UI model selection, uploads, baselines, and copy fallback. [Source: [https://github.com/browser-use/browser-use](https://github.com/browser-use/browser-use)] ([GitHub][5]) 
* **Login/profile reuse:** browser-use Cloud has profile/session persistence and profile sync guidance; agbrowse uses a local `BROWSER_AGENT_HOME` Chrome profile and explicitly treats captcha/Cloudflare bypass as out of scope. [Source: [https://docs.browser-use.com/cloud/guides/authentication](https://docs.browser-use.com/cloud/guides/authentication)] ([Browser Use][6]) 

### Anthropic Computer Use

* **Control surface:** Computer Use is a Claude API beta tool for screenshots, mouse, keyboard, and desktop automation; agbrowse is browser/CDP-first with DOM refs, screenshots, and provider-specific selectors. [Source: [https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)] ([Claude][7])
* **Model coverage:** Computer Use is tied to Claude API tool use; agbrowse drives logged-in ChatGPT, Gemini, and Grok web UIs rather than an API tool contract. [Source: [https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)] ([Claude][7]) 
* **Safety/login posture:** Anthropic recommends dedicated VMs/containers and avoiding sensitive account data for Computer Use; agbrowse’s normal path depends on a user-managed logged-in browser profile. [Source: [https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)] ([Claude][7]) 
* **Transparency:** Computer Use exposes tool actions but not a provider-web prompt envelope; agbrowse’s `web-ai render` makes the exact provider composer text inspectable before mutation. 

### Microsoft `playwright-mcp` and other MCP browser servers

* **Control surface:** Playwright MCP exposes browser actions through MCP using structured accessibility snapshots; agbrowse avoids a long-running MCP server and reconnects short-lived CLI commands to the same CDP endpoint. [Source: [https://playwright.dev/docs/getting-started-mcp](https://playwright.dev/docs/getting-started-mcp)] ([Playwright][8]) 
* **Agent cost/shape:** Microsoft’s repo notes CLI+skills can be more token-efficient than MCP because MCP loads tool schemas and accessibility trees; agbrowse leans into that CLI/skill design. [Source: [https://github.com/microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)] ([GitHub][9])
* **Provider specialization:** Playwright MCP is generic browser automation; agbrowse adds provider-specific fail-closed checks, model aliases, uploads, response polling, and copy-markdown fallback for ChatGPT/Gemini/Grok. [Source: [https://github.com/microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)] ([GitHub][9]) 
* **Profile reuse:** Playwright MCP documents persistent/isolated profile modes and extension attachment to existing tabs; agbrowse defaults to one local automation profile plus `CDP_PORT`. [Source: [https://github.com/microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)] ([GitHub][9]) 

### Plain Playwright/Puppeteer scripts behind tool calls

* **Control surface:** Playwright/Puppeteer are programmable browser libraries, not agent-ready consultation runtimes; they give maximum control but require the wrapper author to define snapshots, help text, baselines, retries, and provider semantics. [Source: [https://playwright.dev/docs/api/class-browsertype](https://playwright.dev/docs/api/class-browsertype)] ([Playwright][10]) [Source: [https://pptr.dev/](https://pptr.dev/)] ([Puppeteer][11])
* **Login/profile reuse:** Playwright supports persistent contexts, but its docs state multiple browser instances cannot use the same `userDataDir`; agbrowse packages a default dedicated automation profile to reduce that setup burden. [Source: [https://playwright.dev/docs/api/class-browsertype](https://playwright.dev/docs/api/class-browsertype)] ([Playwright][10]) 
* **Fail-closed semantics:** Plain scripts do not inherently verify provider host, model, attachment evidence, or prompt commit; agbrowse does some of that in provider runtimes and rejects unsupported vendors/models before mutation. 
* **Agent-friendliness:** Plain scripts can be transparent if written well, but agbrowse ships skill docs and a stable CLI usage surface for agents. 

## 2. Top 5 concrete improvements

| Improvement                                 | Rationale                                                                                                                                                           | Implementation hint                                                                                                                | Files touched                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Typed error taxonomy + retry hints**      | Current outputs have `ok/status/warnings/error`, but errors are mostly strings; agents need `errorCode`, `stage`, `retryHint`, `mutationAllowed`, `selectorsTried`. | Add `WebAiError`, normalize thrown errors in `runWebAiCli`, and return structured JSON even on failure.                            | `web-ai/types.mjs`, `web-ai/cli.mjs`, `web-ai/browser-primitives.mjs`, `web-ai/chatgpt.mjs`, `web-ai/gemini-live.mjs`, `web-ai/grok-live.mjs`       |
| **Session IDs + resume/reattach**           | Baselines keyed by `vendor:url` can collide and cannot resume long runs cleanly.                                                                                    | Persist `sessionId`, `targetId`, `conversationUrl`, `promptHash`, `status`, `deadlineAt`; add `sessions`, `resume`, `reattach`.    | `web-ai/session.mjs`, `web-ai/cli.mjs`, all provider `send/poll/query` files, `skills/web-ai/SKILL.md`                                              |
| **Capability probe rows**                   | Agents need a schema-ready answer to “can I safely send?” before mutation.                                                                                          | Make each provider export `capabilities[]`; `status --json` returns rows like `{capabilityId,state,evidence,next}`.                | `web-ai/*-model.mjs`, `web-ai/*-live.mjs`, `web-ai/chatgpt-attachments.mjs`, `web-ai/cli.mjs`                                                       |
| **Structured DOM/snapshot diffs for churn** | Provider UI selectors are the main fragility; today failures do not show enough repair evidence.                                                                    | Add `web-ai doctor --vendor` or include selector counts, visible candidates, before/after composer state, and response-turn diffs. | `web-ai/browser-primitives.mjs`, `web-ai/chatgpt-composer.mjs`, `web-ai/gemini-live.mjs`, `web-ai/grok-live.mjs`, `skills/browser/browser-core.mjs` |
| **Hard-gate risky Grok context packages**   | The source warns but still allows Grok context packages; agents may ignore soft warnings.                                                                           | Default to hard fail for Grok context packaging unless `--allow-grok-context-pack` is passed.                                      | `web-ai/grok-live.mjs`, `web-ai/cli.mjs`, `skills/web-ai/SKILL.md`, `README.md`                                                                     |

Ambiguity: the attached bundle references `skills/browser/browser.mjs`, but its start/status implementation was not included in the visible source. A port/profile lock would likely touch that file too.

## 3. Missing agent-friendliness

* **Error taxonomy:** Partially present as `BrowserCapabilityError`, but not applied end-to-end; provider code mostly throws plain `Error`. 
* **Retry hints:** Missing structured `next`/`retryHint`; warnings are human strings, and CLI human output collapses most non-answer results to `status: url/vendor`. 
* **Schema-ready capability rows:** Static docs have a provider matrix, but runtime `status` does not return per-capability rows for composer, model picker, upload, copy, response polling. 
* **Structured snapshot diffs:** Browser docs recommend observe → act → observe, but the web-ai runtime does not emit a machine-readable before/after DOM or selector diff. 
* **Watcher reattach:** Explicitly out of scope in README; current production source has no watcher/notification dashboard. 
* **Session resume:** Current persistence is `web-ai-baselines.json` with `makeBaselineKey(vendor,url)`, not durable session IDs. 

## 4. Risk areas / footguns before broader adoption

* **Provider DOM churn:** agbrowse hardcodes ChatGPT/Gemini/Grok selectors; external automation projects have reported ChatGPT prompt DOM changes such as `prompt-textarea` becoming a `contenteditable` div and Grok submit selectors no longer matching live UI. [Source: [https://github.com/C-Nedelcu/talk-to-chatgpt/issues/253](https://github.com/C-Nedelcu/talk-to-chatgpt/issues/253)] ([GitHub][12]) [Source: [https://github.com/srbhptl39/MCP-SuperAssistant/issues/195](https://github.com/srbhptl39/MCP-SuperAssistant/issues/195)] ([GitHub][13])
* **Anti-bot / Cloudflare:** agbrowse correctly says captcha/Cloudflare bypass is out of scope; Cloudflare’s Browser Rendering FAQ also states its automated browser requests are identified as bot traffic, so headed Chrome is not a guarantee. [Source: [https://developers.cloudflare.com/browser-run/faq/](https://developers.cloudflare.com/browser-run/faq/)] ([Cloudflare Docs][14]) 
* **Login state sharing across Chrome instances:** Playwright says multiple browser instances cannot use the same `userDataDir`; Chrome also changed remote debugging behavior to require a non-default user data dir for `--remote-debugging-port`/pipe. [Source: [https://playwright.dev/docs/api/class-browsertype](https://playwright.dev/docs/api/class-browsertype)] ([Playwright][10]) [Source: [https://developer.chrome.com/blog/remote-debugging-port](https://developer.chrome.com/blog/remote-debugging-port)] ([Chrome for Developers][15])
* **Baseline-key collisions:** `makeBaselineKey(vendor,url)` can collide across multiple chats on the same provider URL, redirects, or two agents sharing a profile. 
* **Grok context-pack soft warning:** The runtime warns `grok-context-pack-not-recommended` but still sends; this weakens fail-closed semantics for the provider the docs say should avoid context packages. 
* **`--port` collisions with cli-jaw browser:** agbrowse defaults to CDP port `9222` and reuses any CDP endpoint answering `/json/version`; if cli-jaw also owns that port, agbrowse can attach to the wrong Chrome unless `BROWSER_AGENT_HOME` and `CDP_PORT` are isolated. 

## 5. Ship-one-first

If I had to ship one change first, it would be **session IDs with resume/reattach keyed by target/conversation, not `vendor:url`**, because it fixes the highest-cost failure modes at once: long model runs that outlive `poll`, wrong-tab or same-URL collisions, stale baselines, and future watcher support. It also gives a natural home for structured errors, retry hints, capability evidence, and DOM diagnostics without changing the simple `send → poll → query` UX.

[1]: https://github.com/steipete/oracle "GitHub - steipete/oracle: Ask the oracle when you're stuck. Invoke GPT-5 Pro with a custom context and files. · GitHub"
[2]: https://github.com/steipete/oracle/blob/main/docs/browser-mode.md "oracle/docs/browser-mode.md at main · steipete/oracle · GitHub"
[3]: https://github.com/steipete/oracle/blob/main/CHANGELOG.md "oracle/CHANGELOG.md at main · steipete/oracle · GitHub"
[4]: https://github.com/browser-use/browser-use/blob/main/AGENTS.md "browser-use/AGENTS.md at main · browser-use/browser-use · GitHub"
[5]: https://github.com/browser-use/browser-use "GitHub - browser-use/browser-use:  Make websites accessible for AI agents. Automate tasks online with ease. · GitHub"
[6]: https://docs.browser-use.com/cloud/guides/authentication "Profiles - Browser Use"
[7]: https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool "Computer use tool - Claude API Docs"
[8]: https://playwright.dev/docs/getting-started-mcp "Playwright MCP | Playwright"
[9]: https://github.com/microsoft/playwright-mcp "GitHub - microsoft/playwright-mcp: Playwright MCP server · GitHub"
[10]: https://playwright.dev/docs/api/class-browsertype "BrowserType | Playwright"
[11]: https://pptr.dev/ "Puppeteer"
[12]: https://github.com/C-Nedelcu/talk-to-chatgpt/issues/253?utm_source=chatgpt.com "Voice-to-text not working again · Issue #253 · C-Nedelcu/talk-to- ..."
[13]: https://github.com/srbhptl39/MCP-SuperAssistant/issues/195?utm_source=chatgpt.com "Fix for auto-submit in Grok explained (solution included)"
[14]: https://developers.cloudflare.com/browser-run/faq/ "Frequently asked questions about Cloudflare Browser Run · Cloudflare Browser Run docs"
[15]: https://developer.chrome.com/blog/remote-debugging-port "Changes to remote debugging switches to improve security  |  Blog  |  Chrome for Developers"
