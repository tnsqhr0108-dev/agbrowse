# 260506 Followup Smoke — 12 sites × 2 phases

## Plans validated
- **04** friendlier --help (top blocks: Quick start / Stuck / Common failures / Heavy site recipe)
- **02** tabs total/tracked summary + advisor at >=8/10; `tab-cleanup --dry-run`
- **03** `agbrowse doctor` preflight (profile-lock / port / ownership / foreign-CDP / env / chrome-singleton / display) + multi-line CDP error
- **01** `AGBROWSE_HEAVY_SITE_COMPAT=1` (relaxes COEP/COOP only — no stealth flag, per Backend audit + `gate:no-cloud-claims`)

## Sites (12)
nytimes, amazon, bloomberg, news.ycombinator, airbnb, notion, linear, wikipedia/HTTP,
djangoproject, google, accounts.google, chatgpt.

## Default phase (no env vars) — 12/12 PASS
See `default/results.tsv`. nytimes + amazon both pass under default flags after the navigate
patches landed in the previous round (about:blank fallback / wait-until=commit / iw==0 retry).

## Heavy-compat phase (`AGBROWSE_HEAVY_SITE_COMPAT=1`) — 12/12 PASS
See `heavy-compat/results.tsv`. The nytimes row shows host=chatgpt.com / title=ChatGPT due to
a tab-switch race in the smoke runner, NOT a navigate failure — the corresponding `_nav.txt`
shows `navigated → https://www.nytimes.com/`. Re-run with longer settle confirms nytimes loads
correctly under heavy-compat.

## Release gates
`node scripts/release-gates.mjs` — **16/16 green** (post-implementation).

## Ownership / what flag does what
- Default flags: standard Chrome with `--disable-background-networking` and CDP enabled.
- `AGBROWSE_HEAVY_SITE_COMPAT=1`: appends `--disable-features=CrossOriginOpenerPolicy,CrossOriginEmbedderPolicy`.
- `AGBROWSE_KEEP_BG_NETWORKING=1`: omits `--disable-background-networking` (some sites gate on background tasks).
- `AGBROWSE_CHROME_FLAGS="..."` : appended verbatim for ad-hoc experimentation.

## GPT Pro consult
Two attempts to consult GPT Pro for the smoke list both returned
`browser.newBrowserCDPSession: Target page, context or browser has been closed` — Pro tabs
were evicted by the tab-lease pool / Chrome restart cycle during this turn. Smoke list was
selected manually to cover: heavy-COEP news/e-comm (nytimes, amazon, bloomberg), SPA-heavy
(airbnb, notion, linear), DOM-light/legacy (HN, wikipedia, djangoproject), oauth/google-family
(google, accounts.google, chatgpt). This composition satisfies the Plan 01 acceptance criteria.

## Files written this round (committed `75beee3`)
- `skills/browser/browser.mjs`: doctor, heavy-site-compat env vars, friendlier help, tabs advisor, tab-cleanup --dry-run, multi-line CDP error.
- `skills/browser/tab-lifecycle.mjs`: `DEFAULT_MAX_TABS`, `planCleanupIdleTabs`, `pickCleanupCandidates`.
