# PLAN_4: Test Integrity & Code Hygiene — 재감사

> 날짜: 2026-03-28 | 기반: PLAN_3 구현 후 전체 코드 감사
> 대상: `30_browser/` 전체 (`skills/`, `test/`, root config)

---

## 감사 결과

PLAN_3 구현이 생각보다 잘 되어 있었다.
원래 3개로 추정했던 이슈 중 2개는 **이미 해결**되어 있었다:

- ✅ `browser.mjs` → `browser-core.mjs` import 완료 (L40-45)
- ✅ `vision-click.mjs` → `vision-core.mjs` import 완료 (L20-25)
- ⚠️ `extractRef` 중복만 남아 있음

그러나 전체 파일을 정밀 감사한 결과 **7개 추가 이슈**를 발견했다.

---

## 발견된 이슈 전체 목록

### 🔴 P0: 반드시 수정

#### Issue 1: 하드코딩된 절대 경로 (6곳 테스트 + 2곳 프로덕션)

**테스트가 다른 환경에서 깨진다.** CI, 다른 개발자, 다른 macOS 계정에서 전부 실패.

| 파일 | 줄 | 하드코딩 |
|------|:---:|----------|
| `test/helpers/exec-browser.mjs` | L6 | `'/Users/jun/Developer/codex/30_browser'` |
| `test/helpers/exec-vision-click.mjs` | L6 | `'/Users/jun/Developer/codex/30_browser'` |
| `test/helpers/fixture-server.mjs` | L5 | `'/Users/jun/Developer/codex/30_browser/test/fixtures/site'` |
| `test/unit/browser-core.test.mjs` | L10 | `'/Users/jun/Developer/codex/30_browser/test/fixtures/aria-snapshot.yaml'` |
| `test/unit/browser-core.test.mjs` | L12 | `'/Users/jun/Developer/codex/30_browser/test/fixtures/cdp-ax-tree.json'` |
| `test/unit/vision-core.test.mjs` | L11 | `'/Users/jun/Developer/codex/30_browser/test/fixtures/coord-responses.json'` |
| `skills/browser/browser.mjs` | L316 | `'cd /Users/jun/Developer/codex/30_browser && npm install ...'` |
| `skills/browser/browser.mjs` | L1240 | 동일 |

**수정:** `import.meta.url` + `fileURLToPath` + `dirname` + `join`으로 상대 경로 해석.

```javascript
// AS-IS (exec-browser.mjs)
const PROJECT_ROOT = '/Users/jun/Developer/codex/30_browser';

// TO-BE
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
```

프로덕션 에러 메시지는 하드코딩 경로 대신 제네릭 안내로 변경:

```diff
- `  💡 Fix: cd /Users/jun/Developer/codex/30_browser && npm install playwright-core`
+ `  💡 Fix: cd <project-root> && npm install playwright-core`
```

---

#### Issue 2: `exec-browser.mjs` exit code 처리 버그

```javascript
// AS-IS (L21)
code: typeof error.code === 'number' ? error.code : 1,
```

Node.js `child_process` exec 에러에서 `error.code`는 실제 exit code가 아니다.
`execFile` 에러 시 숫자 exit code는 `error.status`에 들어 있다 (POSIX convention).
`error.code`는 `'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'` 같은 **문자열 에러 코드**가 올 수 있다.

```javascript
// TO-BE
code: error.status ?? (typeof error.code === 'number' ? error.code : 1),
```

`exec-vision-click.mjs`에도 동일 버그 (L22).

---

### 🟡 P1: 개선 권장

#### Issue 3: `extractRef` 헬퍼 중복

`cli-dom-commands.test.mjs` (L6-10)과 `smoke.test.mjs` (L7-11)에 동일 함수.

**수정:** `test/helpers/snapshot-utils.mjs`로 추출.

---

#### Issue 4: `exec-browser.mjs` / `exec-vision-click.mjs` 코드 중복

두 파일이 스크립트 경로만 다르고 **나머지 28줄이 동일**하다.

**수정:** 공통 `exec-script.mjs` 팩토리로 추출.

```javascript
// test/helpers/exec-script.mjs
export function createScriptRunner(scriptPath) {
    return async function exec(args = [], options = {}) {
        // ... 공통 로직
    };
}

// test/helpers/exec-browser.mjs
import { createScriptRunner } from './exec-script.mjs';
const BROWSER_SCRIPT = join(__dirname, '..', '..', 'skills', 'browser', 'browser.mjs');
export const execBrowser = createScriptRunner(BROWSER_SCRIPT);
export async function stopBrowserIfRunning(env) { await execBrowser(['stop'], { env }); }

// test/helpers/exec-vision-click.mjs
import { createScriptRunner } from './exec-script.mjs';
const VISION_SCRIPT = join(__dirname, '..', '..', 'skills', 'vision-click', 'vision-click.mjs');
export const execVisionClick = createScriptRunner(VISION_SCRIPT);
```

---

#### Issue 5: 테스트 fixture 커버리지 부족

현재 fixture가 **happy path만** 커버하고 edge case가 없다.

| Fixture | 현재 | 부족한 케이스 |
|---------|:----:|--------------|
| `aria-snapshot.yaml` | 5줄, 5노드 | 빈 name, 깊은 중첩(depth 3+), role만 있는 줄 |
| `cdp-ax-tree.json` | 3노드 | parentId chain 3단계+, value 없는 노드, 역순 parentId |
| `coord-responses.json` | 2개 | 잘린 JSON, 불완전한 text, 마크다운에 묻힌 JSON, `x`/`y` 누락 |

**수정:** 각 fixture에 edge case 추가.

---

#### Issue 6: PLAN_3에서 약속한 `test/spec/` 미구현

PLAN_3는 아래를 명시적으로 약속했지만 현재 `test/spec/` 디렉토리가 없다:

- `antigravity-security-contracts.test.mjs` (URL allowlist, JS policy pending specs)
- `antigravity-gap-tracking.test.mjs` (mouse-wheel, screen recording pending specs)

당장 기능이 없으므로 `it.skip`으로 spec만 남기는 것도 충분하다.
하지만 PLAN_3에 있는 약속이 빈 상태로 남으면 devlog 신뢰도가 떨어진다.

**수정:** PLAN_3 전환을 명시적으로 기록. `spec/` 생성은 선택으로 남기되, 만드는 경우 `it.skip` placeholder를 넣는다. **이번 PLAN의 필수 범위에서는 제외한다.**

---

#### Issue 7: SKILL.md 하드코딩 경로

`skills/browser/SKILL.md` L18:

```
cd /Users/jun/Developer/codex/30_browser
```

SKILL.md는 에이전트가 읽는 문서이므로, 환경 독립적인 안내로 변경해야 한다.
하지만 SKILL.md는 특정 로컬 환경에 맞춘 개인 skill이므로 **위험도는 낮다**.

---

## 파일 변경 요약

| 파일 | 변경 | Issue |
|------|:----:|:-----:|
| `test/helpers/exec-script.mjs` | [NEW] | #4 |
| `test/helpers/snapshot-utils.mjs` | [NEW] | #3 |
| `test/helpers/exec-browser.mjs` | MODIFY | #1 #2 #4 |
| `test/helpers/exec-vision-click.mjs` | MODIFY | #1 #2 #4 |
| `test/helpers/fixture-server.mjs` | MODIFY | #1 |
| `test/unit/browser-core.test.mjs` | MODIFY | #1 |
| `test/unit/vision-core.test.mjs` | MODIFY | #1 |
| `test/integration/cli-dom-commands.test.mjs` | MODIFY | #3 |
| `test/e2e/smoke.test.mjs` | MODIFY | #3 |
| `test/fixtures/aria-snapshot.yaml` | MODIFY | #5 |
| `test/fixtures/cdp-ax-tree.json` | MODIFY | #5 |
| `test/fixtures/coord-responses.json` | MODIFY | #5 |
| `skills/browser/browser.mjs` | MODIFY | #1 (에러 메시지) |

`skills/browser/browser-core.mjs` — 변경 없음
`skills/vision-click/vision-core.mjs` — 변경 없음
`skills/vision-click/vision-click.mjs` — 변경 없음

---

## 실행 순서

```text
1. test/helpers/exec-script.mjs 생성 (공통 팩토리)
2. test/helpers/snapshot-utils.mjs 생성 (extractRef)
3. exec-browser.mjs 리팩토링: 상대경로 + error.status + exec-script import
4. exec-vision-click.mjs 리팩토링: 동일
5. fixture-server.mjs: 상대경로
6. unit test 파일들: 상대경로 fixture 로딩
7. dom-commands / smoke: extractRef import 교체
8. fixtures 보강: edge case 추가
9. browser.mjs 에러 메시지: 하드코딩 경로 제거
10. npm test → 전체 통과 확인
```

## Verification Plan

### Automated Tests

```bash
cd /Users/jun/Developer/codex/30_browser

# Syntax check
node --check skills/browser/browser.mjs
node --check skills/vision-click/vision-click.mjs

# Full test suite (all changes are test infra, so existing tests validate)
npm test
```

### Manual Verification

- help 출력에서 하드코딩 경로가 제거되었는지 확인:
  ```bash
  node skills/browser/browser.mjs 2>&1 | grep -i '/Users/jun' && echo "FAIL: hardcoded path found" || echo "OK"
  ```
