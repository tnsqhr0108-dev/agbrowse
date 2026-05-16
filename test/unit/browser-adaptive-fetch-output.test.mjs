import { describe, expect, it } from 'vitest';
import {
    compactAdaptiveFetchResult,
    truncateTextToUtf8Bytes,
    writeStdoutLine,
} from '../../skills/browser/adaptive-fetch/output.mjs';

describe('adaptive fetch JSON output helpers', () => {
    it('compacts selected content before JSON serialization', () => {
        const result = compactAdaptiveFetchResult({
            ok: true,
            verdict: 'strong_ok',
            content: 'abc'.repeat(10),
        }, { contentLimitBytes: 16 });

        expect(result.content).toBe('abcabcabcabcabca');
        expect(result.contentBytes).toBe(30);
        expect(result.contentLimitBytes).toBe(16);
        expect(result.contentTruncated).toBe(true);
        expect(JSON.parse(JSON.stringify(result))).toMatchObject({
            ok: true,
            contentTruncated: true,
        });
    });

    it('does not cut UTF-8 text beyond the byte limit', () => {
        const result = truncateTextToUtf8Bytes('가나다라마', 7);
        expect(Buffer.byteLength(result.text, 'utf8')).toBeLessThanOrEqual(7);
        expect(result.text).toBe('가나');
        expect(result.bytes).toBe(15);
        expect(result.truncated).toBe(true);
    });

    it('waits for stdout write completion', async () => {
        const writes = [];
        let callbackObserved = false;
        await writeStdoutLine('{"ok":true}', {
            write(chunk, callback) {
                writes.push(String(chunk));
                setTimeout(() => {
                    callbackObserved = true;
                    callback();
                }, 0);
                return false;
            },
        });

        expect(callbackObserved).toBe(true);
        expect(writes).toEqual(['{"ok":true}\n']);
    });
});
