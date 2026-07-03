# PLAN_3: Regression Suite + Safety Contracts

> 날짜: 2026-03-28 | 기반: CHANGELOG_2.md + Antigravity browser evidence
> 대상: `30_browser/` 프로젝트 전체 (`browser.mjs` + `vision-click.mjs`)

---

## 목표

PLAN_2까지 구현된 브라우저 기능을 "있다" 수준이 아니라 **계속 깨지지 않는 상태**로 고정한다.

이번 PLAN의 목적은 단순한 Vitest 도입이 아니다.

1. `browser.mjs` / `vision-click.mjs`의 **회귀 테스트 체계**를 만든다.
2. 최근 실제로 터졌던 **stateful 버그**를 테스트로 고정한다.
3. Antigravity에서 확인된 **보안/설정 계약**을 향후 구현 가능한 형태로 문서화하고, 가능한 부분은 테스트 스펙으로 먼저 박아 둔다.

---

## 왜 지금 필요한가

PLAN_2 구현 후 실제 검증과 서브에이전트 감사에서 잡힌 이슈는 전부 "구문"이 아니라 "행동" 문제였다.

- non-default port 재사용 시 다음 프로세스가 같은 포트를 못 따라감
- stale PID 상태에서 `stop`이 Chrome을 못 끄고 성공처럼 보일 수 있음
- `network --reload --duration 0` 의미가 문서보다 약했음

즉, 다음 단계의 우선순위는 기능 추가보다 **회귀 방지**가 맞다.

테스트 없이 `mouse-wheel`, `allowlist`, `JS policy`, `screen recording` 같은 다음 기능으로 가면 이미 구현한 브라우저 레이어도 계속 흔들린다.

---

## Antigravity 근거

로컬 Antigravity 분석 문서에서 다음 사실을 확인했다.

1. Antigravity는 브라우저를 단일 스크립트가 아니라 **상태/설정/도구 제한**이 있는 시스템으로 다룬다.
2. 이미 `BrowserMouseWheel`, `CaptureBrowserConsoleLogs`, `OpenBrowserUrl(validateFileURL)` 같은 개별 도구와,
   `allowedWebsites`, `deniedWebsites`, `BrowserJsExecutionPolicy` 같은 설정 계층이 존재한다.
3. 따라서 우리 테스트 계획도 단순 CLI happy path가 아니라, **상태 계약 + 안전 계약**을 포함해야 한다.

로컬 근거:

- Antigravity 브라우저 22종 도구와 `CaptureBrowserConsoleLogsToolConverter`, `OpenBrowserUrlToolConverter`, `BrowserMouseWheelToolConverter`
- `BrowserSubagentToolConfig`의 `lowLevelToolsConfig`, `maxContextTokens`, `suggestedMaxToolCalls`
- `BrowserSetting.allowedWebsites`, `BrowserSetting.deniedWebsites`, `BrowserJsExecutionPolicy`
- `BrowserContext.HandleScreenRecording()`

---

## 핵심 판단

### 1. PLAN_3는 다음 단계로 맞다

맞다. PLAN_2 직후의 최우선은 테스트다.

다만 기존 초안처럼 "테스트 전용 폴더만 추가"하는 수준으로는 부족하다.
이번 PLAN_3는 **회귀 테스트 + 안전 스펙 정리**까지 포함해야 한다.

### 2. 기존 초안에서 반드시 바꿔야 할 점

1. **프로덕션 함수 복사 테스트 금지**
   `browser.mjs` 로직을 테스트 헬퍼로 복제하면, 테스트가 프로덕션이 아니라 "복사본"을 검증하게 된다.
   지금처럼 파일이 빠르게 변하는 단계에서는 특히 위험하다.

2. **외부 웹 의존 E2E 금지**
   `example.com` 기반 테스트는 네트워크, CDN, 페이지 구조, 인증서, CI 환경에 흔들린다.
   반드시 로컬 fixture server로 바꿔야 한다.

3. **stateful regression이 테스트의 중심이어야 함**
   최근 실제로 깨졌던 포트 persistence, stale PID stop fallback, console/network 버퍼 동작이
   첫 번째 통합 테스트 대상이어야 한다.

4. **Antigravity-derived security gap을 backlog가 아니라 spec으로 남겨야 함**
   아직 `allowlist`/`denylist`/`JS execution policy`를 구현하지 않았더라도,
   이 계약은 테스트 파일에 `todo`/`skip` 스펙으로 먼저 남겨둘 가치가 있다.

---

## 테스트 원칙

1. **로컬 deterministic 우선**
   외부 웹 대신 로컬 fixture server를 사용한다.

2. **CLI contract 우선**
   이 프로젝트의 공개 인터페이스는 내부 함수가 아니라 CLI이므로, subprocess 기반 통합 테스트가 중심이다.

3. **최소한의 testability refactor 허용**
   "skills/ 절대 불변" 원칙은 버린다.
   대신 위험이 낮은 수준의 helper extraction만 허용한다.
   테스트를 위해 프로덕션 코드를 뜯는 것이 아니라, 복사 테스트를 피하기 위한 최소 분리를 한다.

4. **E2E는 smoke, regression은 integration**
   실제 Chrome이 필요한 검증은 integration/e2e로 두고, 전체 suite가 지나치게 느려지지 않게 분리한다.

5. **미구현 Antigravity 기능은 failing test가 아니라 pending spec**
   `mouse-wheel`, `allowlist`, `JS policy`, `screen recording`은 현재 main suite를 깨지 않도록
   `it.skip` 또는 spec 문서 테스트로 남긴다.

---

## 디렉토리 구조

```text
30_browser/
├── skills/
│   ├── browser/
│   │   ├── browser.mjs
│   │   └── lib/                       # [NEW] 순수 로직 최소 추출
│   │       ├── ax-parsers.mjs
│   │       ├── network-utils.mjs
│   │       └── state-utils.mjs
│   └── vision-click/
│       ├── vision-click.mjs
│       └── lib/                       # [NEW]
│           ├── coord-utils.mjs
│           └── provider-utils.mjs
├── test/
│   ├── unit/
│   │   ├── ax-parsers.test.mjs
│   │   ├── network-utils.test.mjs
│   │   ├── state-utils.test.mjs
│   │   ├── coord-utils.test.mjs
│   │   └── provider-utils.test.mjs
│   ├── integration/
│   │   ├── cli-help.test.mjs
│   │   ├── lifecycle.test.mjs
│   │   ├── regression-port-persistence.test.mjs
│   │   ├── regression-stop-stale-pid.test.mjs
│   │   ├── dom-console-network.test.mjs
│   │   └── pointer-actions.test.mjs
│   ├── e2e/
│   │   └── smoke.test.mjs
│   ├── spec/
│   │   ├── antigravity-security-contracts.test.mjs
│   │   └── antigravity-gap-tracking.test.mjs
│   ├── fixtures/
│   │   ├── server/
│   │   │   ├── index.html
│   │   │   ├── async-fetch.html
│   │   │   ├── iframe.html
│   │   │   └── ping.json
│   │   ├── ax/
│   │   │   ├── aria-snapshot.yaml
│   │   │   └── cdp-ax-tree.json
│   │   └── vision/
│   │       ├── codex-response.ndjson
│   │       ├── gemini-response.json
│   │       └── claude-response.json
│   └── helpers/
│       ├── exec-browser.mjs
│       ├── fixture-server.mjs
│       ├── fake-codex.mjs
│       └── temp-browser-home.mjs
├── package.json                      # [NEW]
└── vitest.config.mjs                 # [NEW]
```

---

## Phase 1: 테스트 가능한 최소 분리

### 1.1 browser.mjs

다음 순수 로직만 `skills/browser/lib/`로 추출한다.

- `parseAriaYaml`
- `parseCdpAxTree`
- `filterRequests`
- `dedupeRequests`
- persisted state read/write helper

### 1.2 vision-click.mjs

다음 순수 로직만 `skills/vision-click/lib/`로 추출한다.

- `extractCoordJson`
- provider auto-detection
- DPR correction helper

### 1.3 금지

- 테스트를 위해 `browser.mjs` 전체를 라이브러리로 재작성하지 않는다
- 테스트 헬퍼에 프로덕션 함수를 복사하지 않는다

---

## Phase 2: 로컬 fixture server

외부 `example.com`을 제거하고, 로컬 HTTP 서버를 fixture로 사용한다.

fixture page는 최소 다음 시나리오를 가져야 한다.

1. interactive ref가 보이는 기본 페이지
2. `load` 이후 `fetch`가 발생하는 페이지
3. `console.log` / `console.error`가 발생하는 페이지
4. 우클릭 / 마우스 이동 / down/up을 호출할 수 있는 페이지
5. DOM 추출과 truncation을 확인할 수 있는 충분한 길이의 HTML

이 서버를 기준으로 `console`, `network`, `reload`, `resize`, `get-dom`을 재현한다.

---

## Phase 3: Unit Tests

### 3.1 browser lib

- `parseAriaYaml`: depth, blank input, sequential ref
- `parseCdpAxTree`: ignored node skip, value 보존, depth 계산
- `filterRequests` / `dedupeRequests`
- persisted state helper: non-default port 저장/복원

### 3.2 vision lib

- `extractCoordJson`
- provider auto-detect 우선순위
- DPR correction math
- 잘못된 provider 응답 처리

---

## Phase 4: Integration Regression Tests

여기가 PLAN_3의 핵심이다.

### 4.1 CLI help / default contract

- no command → help
- unknown command → help
- 신규 명령 (`reload`, `resize`, `console`, `network`, `move-mouse`, `mouse-down`, `mouse-up`) 노출 확인

### 4.2 lifecycle / state contract

- `start --headless --port <custom>` 후 다음 프로세스의 `status`가 같은 포트를 봄
- 이미 떠 있는 non-default port 인스턴스를 `start`로 재사용해도 다음 프로세스가 같은 포트를 봄
- stale PID 상태에서도 `stop`이 CDP fallback으로 종료함
- `stop` 후 `status`는 `running: false`

### 4.3 browser action regression

- `reload`
- `resize` window-bounds 경로
- `resize --fullscreen` fallback 경로
- `click --right`
- `move-mouse`
- `mouse-down` / `mouse-up`
- `get-dom --max-chars` 반환 계약
- `console --clear --reload --limit`
- `network --reload --duration 1000`

### 4.4 vision-click integration

실 API를 치지 않는다.

- fake `codex` executable로 NDJSON 응답 스텁
- Gemini/Claude는 local/mock fetch 응답 사용
- screenshot JSON → DPR correction → `mouse-click` 호출 인수 검증
- provider 미설정 / 인증 없음 / invalid JSON failure path 검증

---

## Phase 5: Antigravity-Derived Safety Specs

Antigravity evidence는 테스트 계획에 다음 "pending contract"를 추가할 근거가 있다.

### 5.1 URL allowlist / denylist

근거:

- `allowedWebsites`
- `deniedWebsites`
- `OpenBrowserUrlToolConverter (validateFileURL)`

현재는 미구현이므로 `test/spec/antigravity-security-contracts.test.mjs`에 `it.skip(...)`로 남긴다.

예시:

- 허용되지 않은 도메인 `navigate` 차단
- `file://` / 위험한 URL 차단
- allowlist 적중 시 정상 통과

### 5.2 JS execution policy

근거:

- `BrowserJsExecutionPolicy`

현재는 `evaluate`가 항상 허용된다.
이 역시 pending spec으로 남긴다.

예시:

- `policy=deny`일 때 `evaluate` 거부
- `policy=allowlist`일 때 제한된 expression만 허용

### 5.3 아직 테스트 대상이 아닌 Antigravity gap

다음은 current PLAN의 직접 구현 범위 밖이지만 추적은 남긴다.

- `mouse-wheel`
- `screen recording`
- tool-budget / interaction-budget 설정

이 항목은 `test/spec/antigravity-gap-tracking.test.mjs`에서 `it.skip(...)`로 표시한다.

---

## Phase 6: E2E Smoke

`npm run test:e2e`는 로컬 fixture server 기반으로만 돈다.

검증 흐름:

1. `start --headless --port <N>`
2. `navigate` local fixture
3. `snapshot --interactive`
4. `click --right`
5. `reload`
6. `screenshot --json`
7. `console`
8. `network`
9. `stop`

외부 인터넷이 필요한 페이지는 사용하지 않는다.

---

## 파일 변경 요약

| 파일 | 변경 | 비고 |
|------|------|------|
| `package.json` | [NEW] | vitest + test scripts |
| `vitest.config.mjs` | [NEW] | test timeout / include |
| `skills/browser/lib/*.mjs` | [NEW] | 순수 로직 최소 추출 |
| `skills/vision-click/lib/*.mjs` | [NEW] | vision 순수 로직 최소 추출 |
| `test/helpers/*.mjs` | [NEW] | subprocess / fixture server / fake codex |
| `test/fixtures/**` | [NEW] | local HTML + AX + provider fixtures |
| `test/unit/*.test.mjs` | [NEW] | pure logic unit test |
| `test/integration/*.test.mjs` | [NEW] | regression 중심 CLI test |
| `test/e2e/smoke.test.mjs` | [NEW] | local-only smoke |
| `test/spec/*.test.mjs` | [NEW] | Antigravity-derived pending contracts |

---

## 실행 순서

```text
1. package.json + vitest.config.mjs 추가
2. skills/browser/lib + skills/vision-click/lib 최소 추출
3. fixture server + fake codex helper 작성
4. unit test 작성 → npm run test:unit
5. integration regression 작성 → npm run test:integration
6. e2e smoke 작성 → npm run test:e2e
7. spec/ pending contract 추가
8. npm test 전체 확인
9. CHANGELOG_3.md 작성
```

---

## 이 PLAN에서 일부러 안 하는 것

- `mouse-wheel` 실제 구현
- URL allowlist 실제 구현
- JS execution policy 실제 구현
- screen recording 실제 구현
- GitHub Actions / coverage gate

이 항목은 테스트로 "추적"만 하고, 구현은 다음 기능 PLAN으로 넘긴다.

---

## 다음 기능 PLAN 후보

테스트가 고정된 뒤 다음 기능 PLAN은 아래 순서가 자연스럽다.

1. `mouse-wheel`
2. `allowlist` / `deniedWebsites`
3. `BrowserJsExecutionPolicy`
4. `screen recording`

