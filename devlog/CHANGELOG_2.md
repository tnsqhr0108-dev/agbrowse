# CHANGELOG_2: browser.mjs v3 구현

> 날짜: 2026-03-27 | 기반: PLAN_2.md

---

## 변경 요약

`30_browser/skills/browser/browser.mjs`에 Antigravity 브라우저 기능 포팅의 2차분을 반영했다.

추가된 명령:

- `reload`
- `resize <w> <h>`
- `resize --fullscreen`
- `click --right`
- `get-dom`
- `console`
- `network`
- `move-mouse`
- `mouse-down`
- `mouse-up`
- `start --chrome-path`

문서 반영:

- `30_browser/skills/browser/SKILL.md`에 신규 명령과 사용 예제 추가
- `CHROME_BINARY_PATH` / `--chrome-path` 가이드 추가
- `console` / `network`의 실제 동작 방식과 제약 문서화

보정 사항:

- `snapshot --max-nodes` 요약 문구가 잘못된 총 개수를 표시하던 버그 수정
- `get-dom --max-chars` truncate 메시지의 반환 계약 정합성 수정
- `resize`는 window-bounds 시도를 우선하고, 불가 시 viewport fallback을 사용

---

## 검증

- `node --check 30_browser/skills/browser/browser.mjs`
- `node 30_browser/skills/browser/browser.mjs` help 출력 확인
- headless smoke test로 `reload`, `resize`, `get-dom`, `console`, `network`, `move-mouse`, `mouse-down`, `mouse-up` 확인
