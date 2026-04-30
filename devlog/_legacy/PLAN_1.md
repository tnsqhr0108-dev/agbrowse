# PLAN_1: agbrowse Skills 업그레이드 계획

> 작성: 2026-03-27 | 기반: RESEARCH_1.md
> 대상: `30_browser/skills/` (browser.mjs + vision-click.mjs)

---

## 목표

`30_browser/skills/` 스킬을 업그레이드하여:
1. Multi-provider Vision AI 지원 (Gemini / Claude / Codex)
2. browser.mjs 견고성 강화
3. SKILL.md 최적화 및 에이전트 가이드 개선

---

## Phase 1: browser.mjs 강화 (P0)

### 1.1 기존 기능 보강

| 항목 | 현재 | 목표 |
|------|------|------|
| Snapshot 출력 | 전체 노드 | `--interactive` 기본값 + 토큰 예산 상한 (50노드) |
| Error 처리 | 단순 throw | 구조화된 에러 메시지 + 복구 가이드 |
| Tab 관리 | `tabs` 리스트만 | `tab-switch <N>` 추가 |
| Wait/Delay | 없음 | `wait <ms>` 또는 `wait-for <ref>` 추가 |
| Scroll | 없음 | `scroll down/up` + `scroll-to <ref>` 추가 |
| Select (dropdown) | 없음 | `select <ref> <value>` 추가 |

**작업:**
- [ ] `browser.mjs`에 `scroll`, `wait-for`, `tab-switch`, `select` 명령 추가
- [ ] Snapshot 토큰 예산 `--max-nodes N` 옵션 추가
- [ ] 에러 메시지에 복구 가이드 포함 (actionable error messages)
- [ ] `SKILL.md` 업데이트

### 1.2 연결 안정성

- [ ] CDP 재연결 로직 강화 (현재 3-retry → exponential backoff)
- [ ] `start` 시 기존 Chrome 프로세스 자동 감지 개선
- [ ] Timeout 설정 노출 (`--timeout <ms>`)

---

## Phase 2: Multi-Provider Vision (P1)

### 2.1 Vision Provider 추상화

```javascript
// 현재 (vision-click.mjs): Codex only
const result = await codexVision(screenshotPath, target);

// 목표: Provider 패턴
const providers = { codex: codexVision, gemini: geminiVision, claude: claudeVision };
const provider = detectProvider(); // 환경변수 or API key 자동 감지
const result = await providers[provider](screenshotPath, target);
```

**구현 대상:**
- [ ] `geminiVision()` — Gemini REST API (`generateContent` with inline image base64)
- [ ] `claudeVision()` — Claude REST API (`messages` with image content block)
- [ ] `antigravityVision()` — Antigravity `browser_subagent` screenshot analysis
- [ ] Provider 자동 감지: `VISION_PROVIDER` env → API key 존재 여부 폴백
- [ ] 통합 JSON 응답 포맷 유지: `{ found, x, y, description, provider }`

### 2.2 API Key 관리

| Provider | 환경변수 | 비고 |
|----------|----------|------|
| Codex | `codex` CLI 인증 | 기존 방식 유지 |
| Gemini | `GEMINI_API_KEY` | REST 직접 호출 |
| Claude | `ANTHROPIC_API_KEY` | REST 직접 호출 |
| Antigravity | 내장 | browser_subagent 도구 활용 |

### 2.3 vision-click.mjs 업데이트

- [ ] Provider 선택 로직 (`--provider codex|gemini|claude|auto`)
- [ ] `geminiVision()` 구현 (Google AI SDK or fetch)
- [ ] `claudeVision()` 구현 (Anthropic SDK or fetch)
- [ ] 각 provider 응답 파싱 통일
- [ ] SKILL.md에 multi-provider 가이드 추가

---

## Phase 3: SKILL.md 최적화 (P2)

### 3.1 에이전트 가이드 개선

- [ ] "실패 시 복구 전략" 섹션 추가 (snapshot 실패 → CDP fallback → vision-click)
- [ ] "토큰 예산" 가이드 (어떤 명령이 얼마나 토큰을 소비하는지)
- [ ] 에이전트별 사용법 분기 (Codex / Antigravity / Claude)

### 3.2 예제 워크플로우 확장

- [ ] SPA 로그인 플로우 예제
- [ ] iframe/Shadow DOM → vision-click 폴백 예제
- [ ] 다중 탭 작업 예제

---

## Phase 4: Testing & CI (P3)

- [ ] Headless E2E 테스트 스크립트 (`test/e2e.mjs`)
- [ ] Vision-click smoke test (DPR 보정 검증)
- [ ] Cross-platform: macOS / Linux / WSL
- [ ] npm 패키지화 (선택)

---

## 우선순위 요약

| Phase | 목표 | 예상 규모 | 우선순위 |
|-------|------|----------|---------|
| P0 | browser.mjs 강화 | scroll/wait/select + 안정성 | 🔴 즉시 |
| P1 | Multi-Provider Vision | gemini/claude vision 구현 | 🟡 다음 |
| P2 | SKILL.md 최적화 | 에이전트 가이드 + 예제 | 🔵 개선 |
| P3 | Testing & CI | E2E + cross-platform | 🟢 안정화 |

---

## 파일 변경 예정

```
30_browser/skills/
├── browser/
│   ├── browser.mjs             ← [MODIFY] scroll, wait-for, select, tab-switch 추가
│   └── SKILL.md                ← [MODIFY] 신규 명령 + 복구 전략 문서화
├── vision-click/
│   ├── vision-click.mjs        ← [MODIFY] multi-provider (gemini/claude) 추가
│   └── SKILL.md                ← [MODIFY] multi-provider 가이드
└── test/                       ← [NEW]
    └── e2e.mjs                 ← [NEW] headless E2E 테스트
```
