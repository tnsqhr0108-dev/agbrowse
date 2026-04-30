# RESEARCH_2: Antigravity 브라우저 심층 분석 — 추가 업그레이드 기회

> 날짜: 2026-03-27 | 소스: Go 바이너리 심볼 540개 + browser.proto + JS 스키마

---

## 발견 요약

Antigravity Go 바이너리에는 **17개 브라우저 ToolConverter**가 존재한다. 현재 agbrowse에서 구현된 것과 비교하면 **10개 이상의 기능이 누락**되어 있다.

---

## 1. Antigravity 브라우저 도구 전체 목록 (17개)

| # | Tool | Tool ID | agbrowse 현재 | 상태 |
|---|------|---------|:---:|:---:|
| 1 | BrowserClickElement | 79 | ✅ `click` | 구현됨 |
| 2 | ClickBrowserPixel | 64 | ✅ `mouse-click` | 구현됨 |
| 3 | BrowserInput | — | ✅ `type` | 구현됨 |
| 4 | BrowserPressKey | — | ✅ `press` | 구현됨 |
| 5 | BrowserScroll | 88 | ✅ `scroll` | v2에서 추가 |
| 6 | BrowserScrollDown | 78 | ✅ `scroll down` | v2에서 추가 |
| 7 | BrowserScrollUp | 77 | ✅ `scroll up` | v2에서 추가 |
| 8 | BrowserSelectOption | — | ✅ `select` | v2에서 추가 |
| 9 | BrowserDragPixelToPixel | — | ✅ `drag` | v2에서 추가 |
| 10 | **BrowserGetDom** | — | ❌ | **NEW** |
| 11 | **BrowserMoveMouse** | — | ❌ | **NEW** |
| 12 | **BrowserMouseDown** | — | ❌ | **NEW** |
| 13 | **BrowserMouseUp** | — | ❌ | **NEW** |
| 14 | **BrowserMouseWheel** | 113 | ❌ | **NEW** |
| 15 | **BrowserRefreshPage** | — | ❌ | **NEW** |
| 16 | **BrowserResizeWindow** | 96 | ❌ | **NEW** |
| 17 | **BrowserGetNetworkRequest** | — | ❌ | **NEW** |
| 18 | **BrowserListNetworkRequests** | — | ❌ | **NEW** |
| — | ExecuteBrowserJavascript | 61 | ✅ `evaluate` | 구현됨 |

---

## 2. 누락 기능 상세

### 2.1 🔴 High Priority — 에이전트 워크플로우에 직접 영향

#### `reload` (BrowserRefreshPage)
- SPA 디버깅, 상태 초기화에 필수
- 현재 `evaluate "location.reload()"` 우회해야 함

#### `resize` (BrowserResizeWindow — Tool ID 96)
- 반응형 테스트에 필수
- WindowState enum: `NORMAL`, `MINIMIZED`, `MAXIMIZED`, `FULLSCREEN`
- `(*BrowserPage).ResizeWindow` + `(*BrowserWindowSize).GetWidthPx/GetHeightPx`

#### `get-dom` (BrowserGetDom)
- snapshot(ariaTree)과 다른 **실제 DOM 트리** 반환
- `(*BrowserSubagentToolConfig).GetDomExtractionConfig` — 별도 DOM 추출 설정 존재
- `SerializablePageState.dom_tree` + `.serialized_dom_tree` 양쪽 지원

#### `network` (BrowserGetNetworkRequest / BrowserListNetworkRequests)
- 네트워크 요청 인터셉션/조회
- API 디버깅, 로그인 플로우 분석에 핵심
- `(*BrowserGetNetworkRequestToolConfig).GetEnabled` — 별도 활성화 필요

### 2.2 🟡 Medium Priority — 정밀 제어

#### `move-mouse` (BrowserMoveMouse)
- 클릭 없이 마우스 이동 (hover와 다름 — 호버 이벤트 없이 좌표 이동)
- Canvas/game 제어, 드래그 전처리

#### `mouse-down` / `mouse-up` (BrowserMouseDown / BrowserMouseUp)
- 마우스 버튼 누르기/놓기 분리
- 드래그 앤 드롭의 세밀한 제어, 장기 누르기, 슬라이더 조작

#### `mouse-wheel` (BrowserMouseWheel — Tool ID 113)
- scroll과 별개의 **마우스 휠** 이벤트 (zoom, 수평 스크롤 등)
- 현재 scroll 명령이 `page.mouse.wheel()` 사용 중이나, 별도 명령으로 분리 필요

### 2.3 🔵 Low Priority — 고급 기능

#### Right-click (ClickType.RIGHT)
- 컨텍스트 메뉴 호출
- `click --right` 옵션으로 추가 가능

#### Console Logs
- `SerializablePageState.console_logs` — 브라우저 콘솔 로그 캡처
- 디버깅 시 JS 에러 확인에 유용

#### Screen Recording
- `(*BrowserContext).StartScreenRecording` / `.HandleScreenRecording`
- `(*BrowserSubagentHandler).handleStopRecording` / `.addRecordingHighlights`
- 자동화 과정 기록 → 디버깅/리플레이

---

## 3. Configuration 기능 (BrowserConfigSchemas.js)

Antigravity는 다음 브라우저 설정을 Unified State Sync로 관리:

| 설정 | 설명 | agbrowse |
|------|------|:---:|
| `BrowserAllowlistConfig` | URL 허용 목록 | ❌ |
| `BrowserCdpPortConfig` | CDP 포트 | ✅ (`CDP_PORT` env) |
| `BrowserUserProfilePath` | Chrome 프로필 경로 | ✅ (`BROWSER_AGENT_HOME`) |
| `BrowserChromeBinaryPath` | Chrome 바이너리 경로 | ❌ (자동탐지만) |
| `BrowserToolsConfig` | 사용 가능 도구 집합 | ❌ |
| `BrowserJavascriptExecutionConfig` | JS 실행 정책 | ❌ (항상 허용) |

**업그레이드 기회:**
- `--chrome-path` 옵션 추가 (커스텀 바이너리)
- `--allowlist` URL 제한 (보안)

---

## 4. State Management (BrowserState)

```
BrowserState
├── AddPage / RemovePage           ← 다중 페이지 상태 관리
├── GetActivePageID / SetActivePageID
├── GetAllPageStates               ← 모든 페이지 스냅샷
├── AddTrajectory / GetTrajectoryState  ← 상호작용 이력 기록
├── CacheURLDenylistResult         ← URL 차단 캐시
└── TakeSnapshot                   ← 전체 상태 캡처

BrowserStateDiff
├── ToString                       ← 상태 변경 diff 생성
└── BrowserStateDiffingConfig
    ├── CaptureAgentActionDiffs     ← 에이전트 행동 diff 기록
    └── IncludeDomTreeInDiffs       ← DOM 트리 diff 포함
```

agbrowse에는 이 수준의 상태 관리가 없다. 프로세스 격리 방식이므로 명령 간 상태를 유지하지 않는다.

---

## 5. BrowserSubagentToolConfig 분석

Antigravity의 브라우저 서브에이전트는 다음 설정을 가진다:

| Property | 의미 | agbrowse 적용 가능? |
|----------|------|:---:|
| `MaxContextTokens` | 컨텍스트 토큰 상한 | ✅ → `--max-nodes`로 일부 구현 |
| `MaxBrowserInteractions` | 최대 상호작용 횟수 | ✅ → CLI 옵션으로 추가 가능 |
| `SuggestedMaxToolCalls` | 권장 최대 tool call 수 | ⚠️ SKILL.md 가이드로 |
| `DomExtractionConfig` | DOM 추출 세부 설정 | ✅ → `get-dom` 명령에 적용 |
| `EnableScratchpad` | 스크래치패드 활성화 | ⚠️ 에이전트 레벨 기능 |
| `DisableScreenshot` | 스크린샷 비활성화 | ⚠️ 보안 옵션 |
| `DisableOnboarding` | 온보딩 비활성화 | — |
| `SubagentReminderMode` | 리마인더 모드 | — |
| `LowLevelToolsConfig` | 저수준 도구 설정 | ✅ → mouse-down/up 활성화 |

---

## 6. 결론: 추가 업그레이드 후보

### 즉시 추가 (P0 추가분)

1. **`reload`** — 1줄 구현 (`page.reload()`)
2. **`resize`** — `page.setViewportSize({ width, height })` + `--fullscreen`
3. **`right-click`** — `click --right` 옵션 추가

### 다음 단계 (P1 추가분)

4. **`get-dom`** — `page.content()` or CDP `DOM.getDocument` + 파싱
5. **`network`** — CDP `Network.enable` + 요청 인터셉션
6. **`console`** — `page.on('console')` 로그 캡처
7. **`move-mouse`** — `page.mouse.move(x, y)`
8. **`mouse-down`** / **`mouse-up`** — 분리 명령

### 연구 (P2)

9. **Screen Recording** — CDP `Page.startScreencast`
10. **URL Allowlist** — 보안 제한
11. **`--chrome-path`** — 커스텀 바이너리 지정
