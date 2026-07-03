# Poll stderr heartbeat — bgtask stall prevention

## 문제

`agbrowse web-ai query` (= send + poll)는 내부적으로 ChatGPT 응답 완료까지 500ms 간격으로 polling하지만, polling 중 stdout/stderr에 아무것도 출력하지 않는다.

cli-jaw의 bgtask runner는 stdout/stderr 라인을 `lastActivity`로 추적하며, 일정 시간(기본 10분) 동안 출력이 없으면 `stalled: no output for Nms`로 프로세스를 kill한다.

ChatGPT가 10MB zip 파일을 분석하는 코드 리뷰 같은 긴 작업은 5~15분 소요 → bgtask runner가 stall로 판정하여 kill → 결과 유실.

ChatGPT는 이 시간 동안 스트리밍 응답을 생성하고 있으며(브라우저에서 볼 수 있음), agbrowse의 `isStreaming()` 체크도 이를 감지한다. 하지만 이 정보가 외부(stderr)로 전달되지 않는다.

## 핵심 아이디어

polling 루프가 streaming 또는 진행 중임을 감지했을 때, **stderr에 heartbeat 라인을 주기적으로 출력**하면:
1. bgtask runner의 `lastActivity`가 갱신됨 (runner.ts:147 — stderr도 activity로 인정)
2. stall timer가 리셋되어 작업이 살아남음
3. stdout은 최종 결과 전용으로 유지 (기존 계약 변경 없음)

## 수정

### MODIFY `web-ai/chatgpt.mjs` — `pollWebAi()` 함수

**위치**: `while (Date.now() <= deadline)` 루프 내부 (line 357~499)

변경:
- 루프 진입 전에 `lastHeartbeat = 0` 초기화
- 매 iteration에서 streaming이 감지되거나 `latest` 텍스트가 존재할 때, 마지막 heartbeat로부터 30초 이상 경과했으면 stderr에 heartbeat 출력

```js
// 루프 상단에 추가
let lastHeartbeat = 0;

// streaming 감지 후, stable text 체크 전에 삽입
const now = Date.now();
if ((streaming || latest) && now - lastHeartbeat >= 30_000) {
    const elapsed = Math.round((now - (deadline - timeout * 1000)) / 1000);
    process.stderr.write(`[poll] ${elapsed}s — ${streaming ? 'streaming' : 'stabilizing'}...\n`);
    lastHeartbeat = now;
}
```

### 설계 결정

| 결정 | 이유 |
|---|---|
| stderr (not stdout) | stdout은 최종 JSON 결과 전용. stderr는 진행 로그용 |
| 30초 간격 | 너무 잦으면 noise, 너무 드물면 stall 방어 불가. 30초면 10분 stall에 충분한 여유 |
| streaming OR latest 조건 | 실제 진행이 있을 때만 heartbeat. 아무 응답 없으면 heartbeat도 없음 (진짜 stall은 stall로 잡혀야 함) |
| `[poll]` prefix | bgtask runner가 파싱할 필요 없음 — 라인 존재 자체가 activity |

### 영향 범위

- `pollWebAi()` 함수만 변경 (chatgpt.mjs)
- stdout 계약 변경 없음
- 다른 vendor (gemini, grok) 의 poll 함수에도 같은 패턴 적용 가능 (이번 scope는 chatgpt만)

## 검증

1. `agbrowse web-ai query --vendor chatgpt --prompt "hello" --inline-only` 실행 중 stderr에 `[poll]` 라인 출력 확인
2. bgtask로 등록한 긴 web-ai query가 stall 없이 완료 확인
3. stdout에는 heartbeat 라인 미출력 확인 (최종 JSON만)
