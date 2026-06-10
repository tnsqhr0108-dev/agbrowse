import { describe, expect, it } from 'vitest';
import {
    ARTIFACT_EXCLUSIONS,
    CODE_ARTIFACT_PATH,
    buildCodeModePrompt,
    checkContractCompliance,
} from '../../web-ai/code-mode-prompt.mjs';

describe('buildCodeModePrompt', () => {
    it('embeds the requirements and every contract clause', () => {
        const prompt = buildCodeModePrompt('Node.js Express ping API MVP');
        expect(prompt).toContain('Node.js Express ping API MVP');
        expect(prompt).toContain('/mnt/data/workdir');
        expect(prompt).toContain(`container.exec 로 단 하나의 ${CODE_ARTIFACT_PATH}`);
        expect(prompt).toContain('find /mnt/data -maxdepth 1 -name "*.zip" -print');
        expect(prompt).toContain('중간 확인 질문 금지');
        for (const exclusion of ARTIFACT_EXCLUSIONS) {
            expect(prompt).toContain(exclusion);
        }
    });

    it('rejects empty requirements', () => {
        expect(() => buildCodeModePrompt('   ')).toThrow(/must not be empty/);
    });

    it('emits a multi-zip contract when multiZip is set', () => {
        const prompt = buildCodeModePrompt('FastAPI backend + React frontend', { multiZip: true });
        expect(prompt).toContain('MULTI-ZIP');
        expect(prompt).toContain('frontend.zip');
        expect(prompt).toContain('한 줄에 하나씩');
        // the single-zip "exactly one result.zip" clause must NOT appear
        expect(prompt).not.toContain('단 하나의 /mnt/data/result.zip');
    });
});

describe('checkContractCompliance', () => {
    it('accepts the plain path and bracket-wrapped variants seen live', () => {
        expect(checkContractCompliance('/mnt/data/result.zip').compliant).toBe(true);
        // Live run answered with a JSON-ish wrap: ["/mnt/data/result.zip"]
        expect(checkContractCompliance('["/mnt/data/result.zip"]').compliant).toBe(true);
        expect(checkContractCompliance('  /mnt/data/result.zip\n').compliant).toBe(true);
    });

    it('flags non-compliant answers while noting path mentions', () => {
        const chatty = checkContractCompliance('Done! Your zip is at /mnt/data/result.zip — enjoy.');
        expect(chatty.compliant).toBe(false);
        expect(chatty.mentionsPath).toBe(true);
        const missing = checkContractCompliance('Here is the code inline:\n```js\n1\n```');
        expect(missing.compliant).toBe(false);
        expect(missing.mentionsPath).toBe(false);
    });
});
