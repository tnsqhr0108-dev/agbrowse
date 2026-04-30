# CHANGELOG_3: Test Suite + Regression Harness

> 날짜: 2026-03-28 | 기반: PLAN_3.md

---

## 변경 요약

`30_browser/`에 테스트 하네스를 추가했다.

- `browser-core.mjs` / `vision-core.mjs` 최소 추출
- Vitest 기반 unit / integration / e2e 테스트 추가
- 로컬 fixture 서버 기반 브라우저 smoke test 추가
- `PLAN_2`에서 실제 발생한 회귀를 고정하는 lifecycle 테스트 추가

## 검증 대상

- non-default port reuse
- stale PID stop fallback
- DOM 명령(`reload`, `resize`, `get-dom`, low-level mouse)
- console / network semantics
- vision-click 좌표 파싱 / provider detection / DPR correction
