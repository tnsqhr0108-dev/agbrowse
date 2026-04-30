---
created: 2026-03-29
tags: [vision-click, browser-automation, viewport-stability, codex-cli, regression-test]
aliases: [PLAN 6, vision-click 정확도 개선, Vision Accuracy Plan]
---
# PLAN6: vision-click 정확도 향상 및 좌표계 안정화

## 이 문서는 무엇인가

이 문서는 `vision-click`의 성공률을 높이기 위한 다음 단계 계획이다.

지금 `vision-click`은 Codex CLI 기반으로 실제 페이지에서 좌표를 찾아 클릭할 수 있다.
하지만 정확도는 브라우저 크기, DPR, 레이아웃 변형, 화면 내 잡음에 크게 흔들린다.

즉, 이번 PLAN의 목적은 provider를 늘리는 것이 아니다.
**같은 Codex 기반 경로를 더 안정적이고 예측 가능하게 만드는 것**이다.

## 왜 중요한가

실페이지 검증에서 확인된 핵심 사실은 두 가지다.

1. `naver map` 검색 이후 결과 영역은 `snapshot --interactive`에 잘 안 잡히는 경우가 있다.
2. 이런 경우 `vision-click`이 실제 fallback 역할을 한다.

따라서 이 경로의 성공률은 "있으면 좋은 부가기능"이 아니다.
DOM ref가 사라지는 화면에서는 사실상 유일한 클릭 경로가 된다.

하지만 현재 방식은 다음 요인에 흔들린다.

- 브라우저 창 크기와 viewport가 매번 달라진다.
- Retina 환경에서 DPR 보정은 하더라도 화면 구성은 여전히 흔들린다.
- 전체 화면을 그대로 모델에 주면 좌표 탐색 범위가 너무 넓다.
- 클릭 전에 좌표 검증 단계가 없다.

## 어떻게 진행하나

이번 PLAN은 네 단계로 진행한다.

1. 브라우저 좌표계를 표준화한다.
2. 비전 입력 범위를 줄인다.
3. 클릭 전에 검증 단계를 넣는다.
4. 실페이지 회귀 테스트를 강화한다.

핵심 체크리스트는 아래와 같다.

- [ ] `vision-click` 실행 전 viewport를 안정화할 수 있는 준비 경로를 만든다.
- [ ] DPR과 viewport를 포함한 표준 실행 모드를 문서화한다.
- [ ] 전체 화면 대신 특정 영역을 잘라서 모델에 줄 수 있게 한다.
- [ ] 클릭 전 소형 검증 단계 또는 재시도 경로를 넣는다.
- [ ] 지도/결과 패널 같은 dense UI에 대한 실전 프롬프트 규칙을 추가한다.
- [ ] 로컬 fixture와 실페이지 수동 검증 절차를 분리해서 기록한다.

---

## 기술 기준

### 1. 현재 판단

| 영역 | 현재 상태 | 완료 판정 여부 | 핵심 문제 |
|------|------|:---:|------|
| viewport | 가변 | ✗ | 레이아웃이 매번 달라짐 |
| DPR 보정 | 있음 | △ | 좌표 변환은 되지만 구도 안정성은 부족 |
| screenshot 범위 | 전체 화면 | ✗ | dense UI에서 오검출 가능성 큼 |
| 클릭 검증 | 없음 | ✗ | 잘못 클릭해도 바로 다음 단계로 감 |
| 프롬프트 | 단일 타깃 설명 | △ | 영역 힌트와 우선순위 정보 부족 |

### 2. 해결해야 할 이슈

#### Issue 1. viewport 고정 부재

브라우저 창 크기가 달라지면 같은 요소도 완전히 다른 위치에 놓인다.
반응형 브레이크포인트가 바뀌면 결과 패널과 지도 구성도 변한다.

**목표**

- `vision-click` 전에 안정적인 viewport preset을 선택적으로 적용한다.
- 실전 기본값을 하나 정한다.

**작업**

- [ ] `browser.mjs` 또는 `vision-click.mjs`에 표준 viewport 준비 옵션을 추가한다.
- [ ] 기본 권장 viewport를 `1440x900` 또는 동등한 데스크톱 폭으로 고정한다.
- [ ] 문서에 "정확도 우선 모드" 사용법을 추가한다.

#### Issue 2. 전체 화면 입력의 과도한 탐색 범위

모델이 전체 화면에서 작은 타깃을 찾게 하면, 비슷한 아이콘이나 텍스트에 끌릴 수 있다.

**목표**

- 필요한 영역만 잘라서 vision input으로 준다.
- 검색 결과 패널, 지도 중앙, 우측 floating button 등 반복 패턴을 다룰 수 있게 한다.

**작업**

- [ ] `browser.mjs screenshot --clip x y w h` 또는 동등 기능을 추가한다.
- [ ] `vision-click`에 `--region` 또는 좌표 clip 옵션을 추가한다.
- [ ] 실전 예제로 `left-panel`, `center-map` 같은 사용 패턴을 문서에 남긴다.

#### Issue 3. 클릭 전 검증 부재

현재는 좌표를 받으면 곧바로 클릭한다.
이 구조는 false positive가 날 때 복구가 늦다.

**목표**

- 좌표를 찾은 뒤, 클릭 전에 주변 영역을 다시 확인한다.
- confidence가 낮으면 재시도한다.

**작업**

- [ ] `vision-click`에 `--verify-before-click` 단계를 추가한다.
- [ ] 첫 추정 좌표 주변을 다시 잘라 검증하는 2단계 흐름을 넣는다.
- [ ] 검증 실패 시 재시도 또는 클릭 중단 로직을 둔다.

#### Issue 4. 실전 프롬프트의 정보 부족

단순 타깃 문자열만으로는 dense UI에서 정확도가 떨어진다.

**목표**

- 영역, 텍스트, 우선순위, 형태를 프롬프트에 더 구조적으로 포함한다.

**작업**

- [ ] "왼쪽 패널 안", "첫 번째 결과 행", "아이콘이 아니라 행 전체 중심" 같은 힌트를 넣는 프롬프트 옵션을 설계한다.
- [ ] 한글 타깃과 영어 타깃의 차이를 수동 검증으로 기록한다.

#### Issue 5. 실전 검증 부족

현재 테스트는 로컬 fixture 중심으로 유효하다.
하지만 `vision-click` 정확도는 결국 실페이지에서 흔들리는지를 봐야 한다.

**목표**

- 로컬 회귀와 실페이지 수동 검증을 둘 다 문서화한다.

**작업**

- [ ] fixture 기반 smoke는 계속 유지한다.
- [ ] `naver map` 같은 dense UI 수동 검증 시나리오를 devlog에 기록한다.
- [ ] 결과 패널 ref 부재 확인 → `vision-click` fallback 성공 여부를 검증 항목으로 추가한다.

### 3. 파일 변경 범위

| 파일 | 변경 유형 | 목적 |
|------|:---:|------|
| `skills/browser/browser.mjs` | MODIFY | clip screenshot, viewport prep |
| `skills/vision-click/vision-click.mjs` | MODIFY | 준비 단계, region, verify-before-click |
| `skills/vision-click/vision-core.mjs` | MODIFY | 프롬프트/좌표 검증 보조 로직 |
| `skills/vision-click/SKILL.md` | MODIFY | 실전 사용법 문서화 |
| `README.md` | MODIFY | 정확도 향상 모드와 한계 설명 |
| `test/*` | MODIFY | clip/verify/region 회귀 테스트 |

### 4. 실행 순서

1. viewport preset 방향을 먼저 확정한다.
2. screenshot clip 기능을 추가한다.
3. `vision-click`의 region/verify 옵션을 추가한다.
4. prompt 보강과 재시도 규칙을 넣는다.
5. 로컬 회귀 테스트를 만든다.
6. 실페이지 수동 검증을 기록한다.

### 5. 완료 기준

- [ ] 표준 viewport 경로가 추가되고 문서화된다.
- [ ] 특정 영역 clip 기반 vision input이 가능하다.
- [ ] 클릭 전 검증 옵션이 동작한다.
- [ ] 로컬 회귀 테스트가 통과한다.
- [ ] 실페이지 dense UI에서 fallback 성공 사례가 문서화된다.

### 6. 검증 명령

```bash
cd /Users/jun/Developer/codex/30_browser

node --check skills/browser/browser.mjs
node --check skills/vision-click/vision-click.mjs
node --check skills/vision-click/vision-core.mjs

npm test
```

선택 수동 검증:

```bash
node skills/browser/browser.mjs start
node skills/browser/browser.mjs navigate "https://map.naver.com/p/"
node skills/browser/browser.mjs snapshot --interactive
node skills/vision-click/vision-click.mjs "first search result row"
```

## 연결 문서

- 이전 계획: [[PLAN5]]

## 변경 기록

- 2026-03-29: `vision-click` 정확도 향상을 별도 계획으로 분리했다.
