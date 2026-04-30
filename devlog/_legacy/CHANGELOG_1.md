# CHANGELOG_1: Skills v2 업그레이드

> 날짜: 2026-03-27 | 기반: RESEARCH_1.md → PLAN_1.md

---

## 왜 업그레이드했나

RESEARCH_1에서 3가지 핵심 한계를 식별:

1. **명령어 부족** — 원본 browser.mjs에 scroll, wait, select, drag, tab-switch가 없어서 에이전트가 복잡한 워크플로우를 수행할 수 없었음
2. **Vision = Codex only** — vision-click.mjs가 Codex CLI만 지원. Gemini/Claude 사용자 완전 배제
3. **에러가 불친절** — "No active page" 같은 메시지만 출력. 에이전트가 복구 방법을 모름

---

## 변경 1: browser.mjs (600L → 759L)

### 신규 명령어 6개

| 명령 | 용도 | 예시 |
|------|------|------|
| `scroll <dir>` | 페이지 스크롤 | `scroll down`, `scroll --ref e15` |
| `wait <ms>` | 단순 대기 | `wait 2000` |
| `wait-for <ref>` | ref 등장 대기 (SPA용) | `wait-for e5 --timeout 30000` |
| `tab-switch <N>` | 탭 전환 | `tab-switch 2` |
| `select <ref> <val>` | 드롭다운 선택 | `select e7 "option1"` |
| `drag <from> <to>` | 드래그 앤 드롭 | `drag e3 e5` |

**왜 필요한가:** SPA 로그인 시 `wait-for`로 대시보드 로딩 대기, 긴 페이지 `scroll`로 하단 요소 접근, 폼 `select`로 드롭다운 처리 — 이전에는 불가능했던 시나리오들.

### `--max-nodes` 토큰 예산

```bash
node browser.mjs snapshot --interactive --max-nodes 30
```

대형 페이지에서 snapshot 출력이 수백 노드 → 토큰 낭비. `--max-nodes`로 상한 설정하면 에이전트 컨텍스트 절약.

### CDP 재연결 강화

```
Before: 3회 재시도, 1초 고정 간격
After:  4회 재시도, exponential backoff (1s → 2s → 4s → 8s)
```

불안정한 네트워크(WSL, Docker)에서 연결 성공률 향상.

### Actionable 에러 메시지

```
Before: "No active page"
After:  "No active page — run `start` first, then `navigate <url>`"

Before: "CDP connection failed after 3 attempts: ..."
After:  "CDP connection failed after 4 attempts: ...
         💡 Fix: Ensure Chrome is running (node browser.mjs start) or check port 9222"
```

에이전트가 에러를 읽고 **스스로 복구 행동을 판단**할 수 있게 됨.

---

## 변경 2: vision-click.mjs (246L → 381L)

### Multi-Provider 아키텍처

```
Before:  codexVision()만 존재
After:   codexVision() + geminiVision() + claudeVision() + 자동 감지
```

| Provider | API | 비용/호출 | 속도 |
|----------|-----|----------|------|
| Gemini | REST (`generateContent` + base64 이미지) | ~$0.002 | 1-2s |
| Claude | REST (`messages` + image content block) | ~$0.005 | 2-3s |
| Codex | CLI (`exec -i` + NDJSON 파싱) | ~$0.005-0.01 | 3-5s |

### 자동 감지 로직

```
1. VISION_PROVIDER env 명시 → 해당 provider
2. GEMINI_API_KEY 존재 → gemini
3. ANTHROPIC_API_KEY 존재 → claude  
4. codex CLI 설치됨 → codex
5. 없으면 → 에러 + 설정 가이드 출력
```

### 코드 구조 개선

- `COORD_PROMPT()` — 3개 provider 공통 프롬프트
- `extractCoordJson()` — 공통 좌표 JSON 파싱 (중복 제거)
- 각 provider는 **이미지 전송 방식만 다름**, 응답 형식은 통일

---

## 변경 3: SKILL.md (양쪽 모두 재작성)

### browser SKILL.md

- Recovery Strategy 섹션 추가 (5단계 에스컬레이션 가이드)
- SPA 로그인, long-page scroll, multi-tab 워크플로우 예제
- 모든 신규 명령 문서화

### vision-click SKILL.md

- Multi-provider 가이드 (env var 테이블, 비용 비교)
- Auto-detection 우선순위 설명
- Codex-only 제한 해제 명시

---

## 파일 변경 요약

```diff
  30_browser/skills/browser/
-   browser.mjs     (600L)  → 기본 명령만
+   browser.mjs     (759L)  → +scroll, wait-for, wait, tab-switch, select, drag
+                              +--max-nodes, exponential backoff, actionable errors
-   SKILL.md        (192L)  → 기본 문서
+   SKILL.md        (222L)  → +recovery strategy, +SPA/scroll/multi-tab 예제

  30_browser/skills/vision-click/
-   vision-click.mjs (246L) → Codex only
+   vision-click.mjs (381L) → +geminiVision(), +claudeVision(), +auto-detect
-   SKILL.md         (117L) → Codex only 가이드
+   SKILL.md         (105L) → multi-provider 가이드
```

---

## 검증

- `node --check browser.mjs` ✅ 
- `node --check vision-click.mjs` ✅
- `node browser.mjs` (help 출력) ✅ — 모든 신규 명령 표시
- `node vision-click.mjs` (help 출력) ✅ — provider 감지 로직 표시
