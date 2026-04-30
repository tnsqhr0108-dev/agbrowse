# agbrowse — MVP Plan

## 개요

AI 에이전트를 위한 독립형 브라우저 자동화 CLI.
cli-jaw 브라우저 엔진을 추출·보강하여 MCP 토큰 세금 없이 브라우저 제어 가능.

## 핵심 기능

1. **browser.mjs** — CLI 기반 브라우저 제어 (snapshot, click, type, evaluate, screenshot)
2. **vision-click.mjs** — Vision AI 좌표 클릭 파이프라인 (GPT/Codex only)
3. **DPR 자동 보정** — Retina 디스플레이 좌표 보정

## 차별점

- MCP 서버 불필요 (토큰 세금 0)
- 임의 JS evaluate 지원
- 좌표 기반 + Vision AI 클릭 지원
- playwright-core 단일 의존성

## 현재 상태

- [x] browser.mjs 핵심 명령어 구현 완료
- [x] vision-click.mjs 구현 (Codex/GPT only)
- [x] headless 테스트 통과
- [ ] Gemini/Claude Vision provider 추가
- [ ] npm 패키지화
- [ ] CI/CD 파이프라인

## 원본

- **출처**: [cli-jaw/openclaw](https://github.com/nicepkg/cli-jaw)
- **리모트**: https://github.com/lidge-jun/agbrowse.git
