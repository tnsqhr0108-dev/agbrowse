// @ts-check
// Code-mode prompt contract (Phase 11 of devlog/_plan/260611_webai_gpt_code_mode).
// The contract text was settled by interrogating GPT (thinking/standard) and
// verified end-to-end: GPT used container.exec, built exactly one
// /mnt/data/result.zip, and answered with the plain path only. The hardening
// clauses (no mid-confirmation, artifact exclusions, forced find self-check)
// came from GPT's own large-codebase failure-mode answers — see
// 01_prompt_contract.md for the verbatim Q&A.

export const CODE_ARTIFACT_PATH = '/mnt/data/result.zip';

export const ARTIFACT_EXCLUSIONS = [
    'node_modules/', '.venv/', 'venv/', 'dist/', 'build/', '.next/',
    'coverage/', '.turbo/', '__pycache__/', '.pytest_cache/', '.git/',
];

/**
 * Build the strict code-mode prompt around the caller's requirements.
 *
 * @param {string} requirements - what to build (language, stack, features)
 * @returns {string}
 */
export function buildCodeModePrompt(requirements) {
    const spec = String(requirements || '').trim();
    if (!spec) throw new Error('code-mode requirements must not be empty');
    return [
        '[CODE MODE — 자동화 파이프라인. 아래 계약을 정확히 지켜라.]',
        '',
        '목표:',
        spec,
        '',
        '빌드/패키징 계약:',
        '- 모든 소스를 먼저 /mnt/data/workdir 아래에 작성한다.',
        '- 패키징 전 기존 /mnt/data/*.zip 을 모두 삭제한다.',
        `- container.exec 로 단 하나의 ${CODE_ARTIFACT_PATH} 을 생성한다.`,
        `- zip에는 사람이 작성한 소스·설정·README만 포함한다. ${ARTIFACT_EXCLUSIONS.join(' ')} 및 캐시/빌드 산출물은 절대 포함하지 않는다. 의존성은 매니페스트(package.json, requirements.txt, pyproject.toml 등)로만 표현한다.`,
        '- zip 생성 후 반드시 find /mnt/data -maxdepth 1 -name "*.zip" -print 를 실제 실행하라. 출력이 1개가 아니거나 경로가 ' + CODE_ARTIFACT_PATH + ' 이 아니면 기존 zip을 모두 삭제하고 다시 생성하라. 이 검증이 성공하기 전에는 최종 응답을 하지 말라.',
        '- 중간 확인 질문 금지. 불완전하더라도 현재 응답 안에서 작성→생성→검증까지 끝내라. 실패 시에도 가능한 최소 완성본을 zip으로 만들어라.',
        `- 최종 assistant 메시지는 오직 plain path 한 줄: ${CODE_ARTIFACT_PATH}`,
        '- markdown 금지, sandbox 링크 금지, 설명 금지, 인라인 코드 금지.',
    ].join('\n');
}

/**
 * Check whether a completed assistant answer honored the contract's final-line
 * rule. Tolerates surrounding whitespace and accidental wrapping, but the
 * artifact path must be present; anything else signals contract drift worth a
 * warning (retrieval may still succeed via the conversation scan).
 *
 * @param {string} answerText
 * @returns {{ compliant: boolean, mentionsPath: boolean }}
 */
export function checkContractCompliance(answerText) {
    const text = String(answerText || '').trim();
    const mentionsPath = text.includes(CODE_ARTIFACT_PATH);
    const stripped = text.replace(/^[\["'`]+|[\]"'`]+$/g, '').trim();
    return { compliant: stripped === CODE_ARTIFACT_PATH, mentionsPath };
}
