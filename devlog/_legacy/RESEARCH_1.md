# RESEARCH_1: Agbrowse Skill Comparison

> 작성: 2026-03-27 | 대상: Antigravity browser_subagent vs agbrowse(cli-jaw standalone) vs Claude Code

---

## 1. 분석 대상

| 구분 | Antigravity (현재) | agbrowse (standalone) | Claude Code |
|------|-------------------|---------------------------|-------------|
| **소스** | `.agents/skills/browser/SKILL.md` | `30_browser/skills/browser/browser.mjs` (600L) | 브라우저 도구 없음 (텍스트 에이전트 전용) |
| **엔진** | cli-jaw HTTP 서버 → playwright-core | playwright-core 직접 (서버 제거) | N/A |
| **의존성** | cli-jaw 서버 실행 필수 (`cli-jaw serve`) | playwright-core만 (`npm i playwright-core`) | — |
| **비전** | vision-click skill (별도, Codex only) | vision-click.mjs 내장 (Codex only) | — |

---

## 2. 아키텍처 비교

### 2.1 Antigravity 브라우저 (현재)

```
┌─────────────────────┐     HTTP API     ┌───────────────────────┐
│  Agent (Gemini)     │ ───────────────→ │  cli-jaw Server       │
│  browser SKILL.md   │                  │  Express on port N    │
│  "cli-jaw browser"  │                  │  playwright-core      │
└─────────────────────┘                  └───────┬───────────────┘
                                                 │ CDP
                                           ┌─────▼──────┐
                                           │  Chrome     │
                                           └────────────┘
```

**특징:**
- 3계층: CLI → HTTP Server (Express) → Core (playwright-core)
- 서버가 상태 유지 (연결 풀링, 다중 클라이언트)
- CDP 포트 = `server_port + 5783` (자동 계산)
- 스크린샷: `~/.cli-jaw/screenshots/`

**제한:**
- `cli-jaw serve` 서버 실행 필수
- cli-jaw npm 패키지 전체 설치 필요
- 포트 관리 복잡 (서버 포트 + CDP 포트)

### 2.2 agbrowse (standalone)

```
┌─────────────────────┐                  ┌───────────────────────┐
│  Agent (Any)        │  직접 호출       │                       │
│  "node browser.mjs" │ ───────────────→ │  playwright-core      │
│  단일 파일 CLI      │                  │  CDP 직접 연결        │
└─────────────────────┘                  └───────┬───────────────┘
                                                 │ CDP
                                           ┌─────▼──────┐
                                           │  Chrome     │
                                           └────────────┘
```

**특징:**
- 2계층: CLI → Core (서버 제거)
- Chrome CDP 자체가 상태 서버 역할
- 프로세스 격리: 각 명령이 독립 프로세스 → CDP 연결 → 작업 → exit
- 스크린샷: `~/.browser-agent/screenshots/`

**핵심 차이점:**
1. **서버 불필요** — playwright-core만 설치
2. **JS evaluate 지원** — `evaluate "document.title"` 임의 JS 실행
3. **좌표 클릭** — `mouse-click <x> <y>` 내장
4. **Vision AI** — DPR 자동 보정 포함 (`screenshot --json` → `codex exec -i` → `mouse-click`)
5. **Snapshot 2단계 폴백** — `ariaSnapshot()` → CDP `Accessibility.getFullAXTree`

### 2.3 Antigravity Go 바이너리 (browser 모듈)

```
Go Language Server
├── BrowserContext         ← 브라우저 세션 관리
├── BrowserPage            ← 페이지 인스턴스
├── BrowserNode            ← DOM 노드
├── BrowserLaunchManager   ← Chrome 실행 관리
├── BrowserSubagentHandler ← 핸들러 (CortexStep)
└── CascadeBrowserMixin    ← 프롬프트 믹스인
```

Go 바이너리의 내장 브라우저는 CLI 스킬과 별개로 동작하며, `BrowserSubagentHandler`가 CortexStep으로 브라우저 작업을 처리한다. `BrowserConfigSchemas.js` (216L)와 `WindowStateSchemas.js` (135L)가 UI 측 스키마를 정의한다.

---

## 3. 기능 매트릭스

| 기능 | Antigravity (cli-jaw) | agbrowse | Antigravity Go Binary |
|------|:-----:|:-----:|:-----:|
| 서버 필요 | ✅ 필수 | ❌ 불필요 | ❌ 내장 |
| Snapshot (ref ID) | ✅ | ✅ (2-fallback) | ✅ (내장) |
| Screenshot | ✅ | ✅ + `--json` (DPR 포함) | ✅ |
| Click (ref) | ✅ | ✅ | ✅ |
| Click (좌표) | ❌ (cliclick 필요) | ✅ `mouse-click` | ✅ |
| Type + Submit | ✅ | ✅ `--submit` | ✅ |
| JS evaluate | ✅ | ✅ | ✅ |
| Tabs 관리 | ✅ | ✅ | ✅ |
| Text 추출 | ✅ | ✅ + `--format html` | — |
| Vision AI | ⚠️ 별도 skill | ✅ 내장 (Codex only) | ❌ |
| DPR 보정 | ❌ | ✅ 자동 | — |
| Headless | ✅ | ✅ | ✅ |
| Reset | ❌ | ✅ `reset --force` | — |
| Chrome 자동 탐색 | ❌ | ✅ (macOS/Win/Linux/WSL) | ✅ |
| 프로세스 격리 | ❌ (서버) | ✅ (명령당 독립) | N/A (내장) |

---

## 4. 코드 분석: agbrowse 핵심

### 4.1 browser.mjs 구조 (600L)

```
┌─ Config (L1-50)       ── DATA_DIR, PROFILE_DIR, SCREENSHOTS_DIR
├─ Connection (L52-240)  ── isPortListening, waitForCdpReady, findChrome, launchChrome
│                           connectCdp (3-retry), getActivePage, listTabs
├─ Actions (L244-400)    ── snapshot (ariaSnapshot+CDP fallback), refToLocator
│                           screenshotAction, click, typeAction, press, hover
│                           navigate, evaluate, getPageText, mouseClick
└─ CLI (L402-600)        ── parseArgs → switch → 각 명령 실행 → process.exit(0)
```

### 4.2 vision-click.mjs 구조 (246L)

```
┌─ browserCmd helper     ── execFileSync로 browser.mjs 호출
├─ codexVision           ── spawn 'codex exec -i' → NDJSON 파싱 → 좌표 추출
├─ visionClick pipeline  ── screenshot → codexVision → DPR 보정 → mouseClick → verify
└─ CLI                   ── 인자 파싱 → visionClick 실행
```

### 4.3 Snapshot 폴백 전략 (핵심 코드)

```javascript
// Strategy 1: Playwright ariaSnapshot() — v1.49+
const yaml = await page.locator('body').ariaSnapshot({ timeout: 10000 });
nodes = parseAriaYaml(yaml);

// Strategy 2 (폴백): CDP Accessibility.getFullAXTree
const { nodes: axNodes } = await cdp.send('Accessibility.getFullAXTree');
nodes = parseCdpAxTree(axNodes);
```

---

## 5. 토큰 효율성

| 도구 | 한 페이지 인터랙션 토큰 |
|------|:---:|
| `@playwright/mcp` | ~13,000 (스키마 3K + 스냅샷 10K) |
| `cli-jaw browser` (현재 Antigravity) | ~500 (CLI stdout) |
| `agbrowse` | ~500 (CLI stdout, 동일) |

> MCP 도구 스키마는 **매 턴마다** 컨텍스트에 주입됨 → 브라우저를 안 쓰는 턴에서도 토큰 과세. CLI 방식은 0.

---

## 6. 핵심 발견

1. **서버 제거가 가장 큰 혁신** — cli-jaw 서버 의존성 제거로 설치/운영 복잡도 대폭 감소
2. **Vision-click 파이프라인 내장** — Canvas/WebGL/Shadow DOM 요소 클릭 가능
3. **DPR 자동 보정** — Retina 디스플레이에서 정확한 좌표 클릭 보장
4. **Chrome 자동 탐색** — macOS/Windows/Linux/WSL 모두 지원
5. **Snapshot 이중 폴백** — ariaSnapshot + CDP fullAXTree로 견고성 확보
6. **Vision Provider 확장 필요** — 현재 Codex CLI만 지원, Gemini/Claude REST 미구현

---

## 7. 참고 리소스

- [agbrowse 소스](file:///Users/jun/Developer/codex/30_browser)
- [현재 browser SKILL.md](file:///Users/jun/Developer/codex/.agents/skills/browser/SKILL.md)
- [vision-click SKILL.md](file:///Users/jun/Developer/codex/.agents/skills/vision-click/SKILL.md)  
- [Antigravity agent map](file:///Users/jun/Developer/codex/00_AGENT_MAP/ag/index.md) — browser/ 모듈 (L61-65)
- [DZone Playwright CLI vs MCP benchmark](https://dzone.com)
