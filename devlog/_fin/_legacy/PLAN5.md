---
created: 2026-03-29
tags: [browser-automation, vision-click, completion-gate, regression-test, Playwright]
aliases: [PLAN 5, 브라우저 스킬 마감 계획, Skill Completion Gate]
---
# PLAN5: browser / vision-click 완료 판정 계획

> 상태: 이 문서는 **이전 감사 시점의 계획 기록**이다.
> 현재 구현 기준 active plan은 `PLAN6.md`이며, `vision-click`은 Codex CLI 전용 경로로 정리되었다.
> 따라서 아래의 multi-provider 관련 항목은 당시 맥락을 보존한 기록으로 읽어야 한다.

## 이 문서는 무엇인가

이 문서는 `30_browser/skills` 아래 두 스킬을 "구현됨"이 아니라 "완료됨"으로 올리기 위한 마감 계획이다.

지금 상태의 `browser`는 기본 동작이 된다.
하지만 ref 안정성과 대기 계약이 완전히 닫히지 않았다.

`vision-click`은 provider 다변화까지는 들어갔다.
하지만 CLI 인자 처리와 응답 파싱이 흔들려 실사용 완성 상태라고 보기 어렵다.

이번 PLAN의 목적은 새 기능을 더 붙이는 것이 아니다.
이미 만든 기능을 신뢰 가능한 인터페이스로 고정하는 것이다.

현재 감사 기준에서 이 문서는 초안이 아니라 **수정된 실행 계획**이다.
즉, 이전 문서처럼 "이미 거의 완성"을 전제로 하지 않는다.
실제 코드, 테스트, 의존성, 문서 계약을 다시 대조한 뒤 우선순위를 재배치한 버전이다.

## 왜 중요한가

이 프로젝트는 에이전트가 직접 호출하는 로컬 스킬이다.
이때 가장 위험한 실패는 "없는 기능"보다 "있는 것처럼 보이지만 상황에 따라 다르게 동작하는 기능"이다.

특히 지금 드러난 문제는 전부 이런 종류다.

- `browser`의 ref는 snapshot마다 다시 생성된다.
- `wait-for <ref>`는 문서상 의미와 실제 동작이 어긋날 수 있다.
- `vision-click --provider gemini` 같은 호출은 provider 인자가 target 문자열에 섞인다.
- `vision-click --browser-script`는 문서에 있지만 실제로는 적용되지 않는다.
- Vision provider 응답이 조금만 흔들려도 좌표 추출이 실패한다.
- 테스트 스위트가 한 번은 실패하고 재실행에서는 통과하는 식으로 흔들릴 수 있다.

즉, 다음 단계의 우선순위는 기능 확장이 아니라 완료 기준 정의와 회귀 방지다.

## 어떻게 진행하나

이번 PLAN은 다섯 단계로 진행한다.

1. 흔들리는 베이스라인을 먼저 고정한다.
2. `vision-click`의 CLI 입력 계약을 바로잡는다.
3. `browser`의 ref와 대기 계약을 재정의한다.
4. Vision 응답 파싱과 의존성 계약을 정리한다.
5. 문서와 검증 절차를 로컬 재현 기준으로 다시 맞춘다.

이번 작업의 핵심 체크리스트는 아래와 같다.

- [ ] `npm test`가 단발 성공이 아니라 반복 실행에서도 안정적으로 통과한다.
- [ ] `browser`의 ref가 snapshot 간 재생성된다는 사실을 코드와 문서에 명시한다.
- [ ] `wait-for`를 ref 재사용 기반이 아니라 selector 또는 조건 기반으로 재설계한다.
- [ ] `refToLocator()`의 role/name 충돌 문제를 줄일 수 있는 식별 전략을 넣는다.
- [ ] `vision-click`의 CLI 인자 파서를 `target`과 옵션 인자로 분리한다.
- [ ] `--provider auto`와 `--browser-script`의 계약을 문서와 실제 동작이 일치하도록 수정한다.
- [ ] `extractCoordJson()`을 자유형 응답, fenced code block, 부분 JSON에 더 강하게 만든다.
- [ ] Gemini, Claude, Codex 각각에 대한 응답 fixture를 보강한다.
- [ ] `package.json`의 런타임/테스트 버전 정책을 명시한다.
- [ ] 문서 예제를 현재 실제 동작과 일치시키고 misleading example을 제거한다.
- [ ] 최종 smoke 스크립트로 `browser`와 `vision-click`의 마감 기준을 자동 검증한다.

---

## 기술 기준

### 1. 현재 판단

| 영역 | 현재 상태 | 완료 판정 여부 | 핵심 문제 |
|------|------|:---:|------|
| `browser` | 기본 명령 다수 동작 | △ | ref 안정성, `wait-for` 계약 불일치 |
| `vision-click` | provider 구조 존재 | ✗ | CLI 파싱 오류, `auto`/`browser-script` 계약 불일치 |
| 문서 | 기능 목록은 풍부함 | △ | 실제 계약보다 낙관적 서술 존재 |
| 테스트 | 회귀 인프라는 있음 | ✗ | 단발 통과는 가능하지만 baseline 안정성 미확정 |
| 의존성 | 실행은 가능 | △ | Node 최소 버전 미명시, Vitest 정책 미정 |

### 2. 우선 전제

이번 PLAN의 첫 번째 전제는 단순하다.
**기본 베이스라인이 녹색이어야 한다.**

감사 시점에는 전체 테스트가 한 번 실패한 뒤 재실행에서 통과했다.
이 의미는 "완전히 망가졌다"가 아니라 "flaky 가능성이 있다"는 뜻이다.

따라서 이번 PLAN은 기능 수정 전에 아래를 먼저 만족해야 한다.

- [ ] `npm test`를 연속 3회 실행해 모두 통과한다.
- [ ] 실패가 재현되면 원인을 기록하고, PLAN 범위에 flaky 안정화 작업을 포함한다.
- [ ] 완료 판정은 "한 번 통과"가 아니라 "반복 통과"로 잡는다.

### 3. 해결해야 할 이슈

#### Issue 1. `vision-click` CLI 인자 파싱 오류

현재 구현은 `--provider gemini`처럼 값이 붙는 옵션에서 `gemini`를 target 일부로 취급한다.
이 버그는 실행 자체는 되더라도 잘못된 프롬프트를 만들어 탐색 실패율을 높인다.

**목표**

- `target`은 순수 사용자 질의만 남긴다.
- 옵션 값은 모두 별도로 파싱한다.
- `--provider`, `--port`, `--browser-script`는 positional target에 섞이지 않는다.
- `--provider auto`는 도움말에 남길 경우 실제로 동작해야 한다.
- `--browser-script`는 도움말에 남길 경우 실제 browser script 경로를 바꿔야 한다.

**작업**

- [ ] `vision-click.mjs` CLI 파서를 `parseArgs()` 또는 동등한 명시적 파서로 교체한다.
- [ ] `"Submit" --provider gemini` 케이스를 regression test로 고정한다.
- [ ] `"Submit" --provider auto`를 지원하거나, 도움말과 문서에서 `auto`를 제거한다.
- [ ] `--browser-script`를 실제 경로 주입이 되게 수정하거나, 옵션을 제거한다.
- [ ] help 예제도 새 파서 기준으로 다시 검증한다.

#### Issue 2. Vision JSON 추출 취약성

현재 응답 파서는 자유 텍스트 안의 JSON 조각 하나를 정규식으로 긁는다.
이 방식은 provider가 code block을 감싸거나, 응답을 둘로 나누거나, description에 특수문자가 들어가면 약해진다.

**목표**

- fenced code block 안 JSON을 읽는다.
- 앞뒤 설명 문장이 붙어도 마지막 유효 JSON을 우선한다.
- 잘린 JSON과 누락 필드를 구분해 에러를 낸다.

**작업**

- [ ] `extractCoordJson()`을 다단계 파서로 바꾼다.
- [ ] `coord-responses.json` fixture에 partial JSON, markdown-wrapped JSON, trailing prose 사례를 추가한다.
- [ ] provider별 에러 메시지를 "좌표 없음", "응답 형식 불량", "API 실패"로 분리한다.

#### Issue 3. `browser` ref 안정성 부족

현재 ref는 snapshot 출력용 임시 번호다.
그런데 액션 레이어가 다시 snapshot을 떠서 같은 `eN`을 role/name 기반 locator로 복원하려고 시도한다.
이 구조는 이름이 같은 버튼이 여러 개일 때 오동작 여지가 있다.

**목표**

- snapshot ref의 범위를 명확히 제한한다.
- 최소한 같은 snapshot 안에서는 일관된 locator 해석이 되게 한다.
- 장기적으로는 DOM path 또는 AX node 기반 식별자로 확장 가능하게 만든다.

**작업**

- [ ] snapshot 노드에 현재보다 안정적인 식별 단서를 포함할 수 있는지 검토한다.
- [ ] `refToLocator()`를 단순 `role + name`에서 더 좁은 매칭으로 개선한다.
- [ ] 중복 role/name fixture를 추가해 잘못된 locator 선택을 검출한다.

#### Issue 4. `wait-for <ref>` 계약 재설계 필요

지금 방식은 새 snapshot에서 동일 ref가 다시 나타난다고 가정한다.
하지만 ref는 snapshot마다 재생성되므로 문서가 설명하는 의미와 구현이 어긋난다.

**목표**

- `wait-for` 의미를 실제 가능한 계약으로 바꾼다.
- CLI 사용자에게 오해를 주는 ref 영속성 표현을 제거한다.

**선택지**

| 안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A | `wait-for-ref` 제거 | 오해 제거가 빠름 | 사용성 후퇴 |
| B | `wait-for-role --role button --name Save` 추가 | 의미가 명확함 | CLI가 길어짐 |
| C | `wait-for-text`, `wait-for-selector` 추가 | 실제 브라우저 개념과 맞음 | 구현 범위가 조금 큼 |

**권장안**

- [ ] `wait-for <ref>`는 deprecated로 전환한다.
- [ ] `wait-for-selector` 또는 `wait-for-text`를 기본 대기 명령으로 추가한다.
- [ ] `SKILL.md` 예제는 새 명령 기준으로 교체한다.

#### Issue 5. 의존성 및 런타임 계약 미정

현재 설치된 버전은 동작한다.
하지만 패키지 문서 차원에서 어떤 버전을 기준으로 보장하는지가 불분명하다.

감사 시점 기준:

- 설치된 `playwright-core`: `1.58.2`
- 설치된 `vitest`: `3.2.4`
- 최신 stable 확인값: `playwright-core 1.58.2`, `vitest 4.1.2`
- 로컬 검증 Node: `v22.18.0`

이 상태에서 중요한 문제는 두 가지다.

1. Node 최소 버전이 `package.json`에 없다.
2. Vitest는 현재 설치 버전과 최신 stable major가 다르지만, 업그레이드 정책이 문서화되어 있지 않다.

**목표**

- 실행 가능한 최소 Node 버전을 명시한다.
- 테스트 도구는 "현행 유지" 또는 "최신 major 업그레이드" 중 하나로 의사결정한다.
- 의존성은 문서와 lockfile이 같은 현실을 보게 한다.

**작업**

- [ ] `package.json`에 `engines.node`를 추가한다.
- [ ] `README` 또는 devlog에 공식 지원 Node 범위를 명시한다.
- [ ] `vitest`를 3.x로 유지할지 4.x로 올릴지 결정하고 이유를 적는다.
- [ ] `playwright-core`는 현재 검증 버전에 맞춰 문서와 테스트 기준을 정리한다.

#### Issue 6. 문서-구현 불일치 해소

현재 문서는 기능이 많고 읽기 좋다.
하지만 일부 예시는 실제 계약보다 더 강한 안정성을 암묵적으로 가정한다.

**목표**

- 문서가 실제 동작을 과장하지 않는다.
- ref의 수명, vision-click fallback 조건, provider 전제조건을 더 분명히 쓴다.

**작업**

- [ ] `browser/SKILL.md`의 `wait-for` 예제를 수정한다.
- [ ] `snapshot → click/type → snapshot` 패턴에 "navigation 후 ref 무효화"를 강조한다.
- [ ] `vision-click/SKILL.md`에 "먼저 ref 존재 여부 확인" 규칙을 더 강하게 명시한다.
- [ ] `vision-click` 문서에서 `auto`, `--browser-script` 지원 여부를 실제 구현과 일치시킨다.
- [ ] devlog 문서에는 "현재 flaky baseline 존재 여부"를 명시한다.

#### Issue 7. 검증 절차의 외부 의존성

기존 검증 예제는 외부 네트워크와 live API key를 전제로 했다.
이 방식은 재현성, 비용, 속도, CI 적합성 모두에서 불리하다.

**목표**

- 기본 검증은 로컬 fixture만으로 재현 가능해야 한다.
- live provider 검증은 선택 단계로 분리한다.

**작업**

- [ ] `browser` smoke는 로컬 fixture server 기준으로 고정한다.
- [ ] `vision-click` smoke는 mock provider 또는 fixture 응답 기반으로 먼저 검증한다.
- [ ] live Gemini/Claude 검증은 optional manual verification으로 분리한다.

### 4. 파일 변경 범위

| 파일 | 변경 유형 | 목적 |
|------|:---:|------|
| `skills/browser/browser.mjs` | MODIFY | ref 해석 개선, 대기 계약 수정 |
| `skills/browser/browser-core.mjs` | MODIFY | ref/파싱 관련 보조 로직 확장 가능 |
| `skills/browser/SKILL.md` | MODIFY | 실제 계약 기준으로 문서 수정 |
| `skills/vision-click/vision-click.mjs` | MODIFY | CLI 파서 수정, 에러 분기 개선 |
| `skills/vision-click/vision-core.mjs` | MODIFY | JSON 추출 견고화 |
| `skills/vision-click/SKILL.md` | MODIFY | provider/실패 조건 명확화 |
| `package.json` | MODIFY | Node/version policy 명시 |
| `test/unit/vision-core.test.mjs` | MODIFY | 파싱 edge case 보강 |
| `test/integration/*` | MODIFY | CLI 파싱, ref 대기, locator 충돌 회귀 고정 |
| `test/fixtures/*` | MODIFY | duplicate label, malformed response fixture 추가 |

### 5. 실행 순서

1. `npm test` 3회 반복으로 baseline 안정성을 먼저 확인한다.
2. flaky가 재현되면 원인을 기록하고 테스트 안정화부터 처리한다.
3. `vision-click` CLI 파서를 먼저 고친다.
4. `auto` 및 `--browser-script` 계약을 정리한다.
5. `vision-core` 응답 파서를 고친다.
6. 관련 unit test를 추가해 provider 응답을 고정한다.
7. `browser`의 `wait-for` 계약을 재설계한다.
8. `refToLocator()` 충돌 케이스를 줄인다.
9. `package.json`의 Node/버전 정책을 명시한다.
10. `SKILL.md`와 devlog 문서를 실제 계약으로 맞춘다.
11. 로컬 fixture 기반 smoke를 돌린다.

### 6. 완료 기준

아래 조건을 모두 만족해야 이번 PLAN을 완료로 본다.

- [ ] `npm test` 3회 연속 통과 또는 flaky 원인이 제거되었다는 재현 기록이 있다.
- [ ] `node skills/vision-click/vision-click.mjs "Submit" --provider gemini`가 provider 값을 target에 섞지 않는다.
- [ ] `--provider auto`는 실제 동작하거나, 도움말과 문서에서 제거되었다.
- [ ] `--browser-script`는 실제 동작하거나, 도움말과 문서에서 제거되었다.
- [ ] Gemini/Claude/Codex fixture 응답에서 좌표 추출 unit test가 모두 통과한다.
- [ ] duplicate role/name fixture에서 locator 충돌 회귀가 재현되고, 수정 후 통과한다.
- [ ] `wait-for` 문서와 실제 명령 계약이 일치한다.
- [ ] `package.json`에 최소 Node 버전이 명시된다.
- [ ] `browser` 기본 smoke (`start`, `navigate`, `snapshot`, `click or text`, `screenshot`, `stop`)가 통과한다.
- [ ] `vision-click` smoke가 로컬 fixture 또는 mock provider 기준으로 재현 가능하게 통과한다.

### 7. 검증 명령

```bash
cd /Users/jun/Developer/codex/30_browser

# syntax
node --check skills/browser/browser.mjs
node --check skills/browser/browser-core.mjs
node --check skills/vision-click/vision-click.mjs
node --check skills/vision-click/vision-core.mjs

# baseline stability
npm test
npm test
npm test

# focused regression checks
npx vitest run test/unit/vision-core.test.mjs --reporter=verbose
npx vitest run test/integration/cli-dom-commands.test.mjs --reporter=verbose
npx vitest run test/integration/cli-network-console.test.mjs --reporter=verbose
npx vitest run test/e2e/smoke.test.mjs --reporter=verbose
```

선택 수동 검증:

```bash
# live provider는 선택 검증으로 분리
GEMINI_API_KEY=... node skills/vision-click/vision-click.mjs "Probe Button" --provider gemini
ANTHROPIC_API_KEY=... node skills/vision-click/vision-click.mjs "Probe Button" --provider claude
```

## 연결 문서

- 이전 계획: [[PLAN_4]]
- 이전 연구: [[RESEARCH_2]]
- 이전 변경 기록: [[CHANGELOG_4]]

## 변경 기록

- 2026-03-29: `browser`와 `vision-click`의 완료 판정 기준을 별도 PLAN으로 정리했다.
- 2026-03-29: 기능 추가보다 계약 정합성과 회귀 방지를 우선순위로 재정렬했다.
