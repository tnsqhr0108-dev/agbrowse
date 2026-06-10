import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    fetchBinaryBase64,
    retrieveAllCodeArtifacts,
    retrieveCodeArtifact,
    scanConversationForAllZips,
    scanConversationForZip,
    verifyZipBuffer,
} from '../../web-ai/code-artifact.mjs';

const BACKEND_ZIP_B64 = 'UEsDBAoAAAAAAAQYy1ygsE1MAwAAAAMAAAAGABwAYXBwLnB5VVQJAAMnpilqJ6YpanV4CwABBPUBAAAEAAAAAGJlClBLAQIeAwoAAAAAAAQYy1ygsE1MAwAAAAMAAAAGABgAAAAAAAEAAACkgQAAAABhcHAucHlVVAUAAyemKWp1eAsAAQT1AQAABAAAAABQSwUGAAAAAAEAAQBMAAAAQwAAAAAA';
const FRONTEND_ZIP_B64 = 'UEsDBAoAAAAAAAQYy1x8GERLAwAAAAMAAAAIABwAaW5kZXguanNVVAkAAyemKWonpilqdXgLAAEE9QEAAAQAAAAAZmUKUEsBAh4DCgAAAAAABBjLXHwYREsDAAAAAwAAAAgAGAAAAAAAAQAAAKSBAAAAAGluZGV4LmpzVVQFAAMnpilqdXgLAAEE9QEAAAQAAAAAUEsFBgAAAAABAAEATgAAAEUAAAAAAA==';

// Real 469-byte zip (README.md, src/, src/a.js) generated with `zip -r`.
const FIXTURE_ZIP_B64 = 'UEsDBAoAAAAAANwQy1wgMDo2BgAAAAYAAAAJABwAUkVBRE1FLm1kVVQJAAOwmSlqsJkpanV4CwABBPUBAAAEAAAAAGhlbGxvClBLAwQKAAAAAADcEMtcAAAAAAAAAAAAAAAABAAcAHNyYy9VVAkAA7CZKWqwmSlqdXgLAAEE9QEAAAQAAAAAUEsDBAoAAAAAANwQy1wH7v1xDwAAAA8AAAAIABwAc3JjL2EuanNVVAkAA7CZKWqwmSlqdXgLAAEE9QEAAAQAAAAAY29uc29sZS5sb2coMSkKUEsBAh4DCgAAAAAA3BDLXCAwOjYGAAAABgAAAAkAGAAAAAAAAQAAAKSBAAAAAFJFQURNRS5tZFVUBQADsJkpanV4CwABBPUBAAAEAAAAAFBLAQIeAwoAAAAAANwQy1wAAAAAAAAAAAAAAAAEABgAAAAAAAAAEADtQUkAAABzcmMvVVQFAAOwmSlqdXgLAAEE9QEAAAQAAAAAUEsBAh4DCgAAAAAA3BDLXAfu/XEPAAAADwAAAAgAGAAAAAAAAQAAAKSBhwAAAHNyYy9hLmpzVVQFAAOwmSlqdXgLAAEE9QEAAAQAAAAAUEsFBgAAAAADAAMA5wAAANgAAAAAAA==';

function conversationFixture() {
    return {
        mapping: {
            a: { message: { id: 'mid-prompt', content: { content_type: 'text', parts: ['make a zip'] } } },
            b: { message: { id: 'mid-code', content: { content_type: 'code', text: 'bash -lc zip ...' } } },
            c: { message: { id: 'mid-output', content: { content_type: 'execution_output', text: '' } } },
            d: { message: { id: 'mid-final', content: { content_type: 'text', parts: ['/mnt/data/result.zip'] } } },
        },
    };
}

// Fake page whose evaluate dispatches on the callback arity/argument shape used
// by the module: conversation fetch (string convId), mint (object with
// messageId), binary fetch (url string).
function makeRetrievalPage({ conversation, urlByMid = {}, binaryByUrl = {} }) {
    return {
        evaluate: async (_fn, arg) => {
            if (typeof arg === 'string' && arg.startsWith('http')) {
                return binaryByUrl[arg] ?? null;
            }
            if (typeof arg === 'string') return conversation;
            if (arg && typeof arg === 'object' && 'messageId' in arg) {
                return urlByMid[arg.messageId] ?? null;
            }
            return null;
        },
    };
}

describe('scanConversationForZip', () => {
    it('finds the zip path in assistant text and collects tool mids', () => {
        const { zipPath, candidateMids } = scanConversationForZip(conversationFixture());
        expect(zipPath).toBe('/mnt/data/result.zip');
        expect(candidateMids).toEqual(['mid-code', 'mid-output']);
    });

    it('returns null path for conversations without sandbox zips', () => {
        const { zipPath, candidateMids } = scanConversationForZip({ mapping: {
            a: { message: { id: 'x', content: { content_type: 'text', parts: ['inline code only'] } } },
        } });
        expect(zipPath).toBeNull();
        expect(candidateMids).toEqual([]);
    });
});

describe('verifyZipBuffer', () => {
    it('lists entries of a real zip buffer', () => {
        const verified = verifyZipBuffer(Buffer.from(FIXTURE_ZIP_B64, 'base64'));
        expect(verified).not.toBeNull();
        expect(verified.files).toContain('README.md');
        expect(verified.files).toContain('src/a.js');
    });

    it('rejects non-zip payloads (e.g. JSON error bodies)', () => {
        expect(verifyZipBuffer(Buffer.from('{"error":"forbidden and padded out beyond min"}'))).toBeNull();
        expect(verifyZipBuffer(Buffer.alloc(0))).toBeNull();
    });
});

describe('retrieveCodeArtifact', () => {
    const outputPath = join(tmpdir(), 'code-artifact-test', 'result.zip');

    it('retrieves, verifies, and saves the artifact end-to-end', async () => {
        rmSync(outputPath, { force: true });
        const page = makeRetrievalPage({
            conversation: conversationFixture(),
            // First mid mints nothing (mirrors live behavior where only one
            // message id works) — the loop must advance to the next.
            urlByMid: { 'mid-output': 'https://chatgpt.com/backend-api/estuary/content?id=f&sig=s' },
            binaryByUrl: { 'https://chatgpt.com/backend-api/estuary/content?id=f&sig=s': { status: 200, base64: FIXTURE_ZIP_B64 } },
        });
        const result = await retrieveCodeArtifact(page, { conversationId: 'conv-1', outputPath });
        expect(result.ok).toBe(true);
        expect(result.zipPath).toBe('/mnt/data/result.zip');
        expect(result.files).toContain('src/a.js');
        expect(existsSync(outputPath)).toBe(true);
        expect(readFileSync(outputPath).length).toBe(result.sizeBytes);
    });

    it('reports code-artifact:missing when no zip was produced', async () => {
        const page = makeRetrievalPage({ conversation: { mapping: {} } });
        const result = await retrieveCodeArtifact(page, { conversationId: 'conv-1', outputPath });
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('code-artifact:missing');
    });

    it('reports download-failed when no candidate mid mints a URL', async () => {
        const page = makeRetrievalPage({ conversation: conversationFixture() });
        const result = await retrieveCodeArtifact(page, { conversationId: 'conv-1', outputPath });
        expect(result.reason).toBe('code-artifact:download-failed');
    });

    it('reports invalid-zip when the payload is not an archive', async () => {
        const page = makeRetrievalPage({
            conversation: conversationFixture(),
            urlByMid: { 'mid-code': 'https://chatgpt.com/x' },
            binaryByUrl: { 'https://chatgpt.com/x': { status: 200, base64: Buffer.from('not a zip at all, just padding text').toString('base64') } },
        });
        const result = await retrieveCodeArtifact(page, { conversationId: 'conv-1', outputPath });
        expect(result.reason).toBe('code-artifact:invalid-zip');
    });

    it('reports conversation-unavailable when the session/API is dead', async () => {
        const page = { evaluate: async () => null };
        const result = await retrieveCodeArtifact(page, { conversationId: 'conv-1', outputPath });
        expect(result.reason).toBe('code-artifact:conversation-unavailable');
    });
});

describe('scanConversationForAllZips', () => {
    it('collects every distinct zip path in first-seen order', () => {
        const conversation = { mapping: {
            a: { message: { id: 'mid-code', content: { content_type: 'code', text: 'zip /mnt/data/backend.zip; zip /mnt/data/frontend.zip' } } },
            b: { message: { id: 'mid-final', content: { content_type: 'text', parts: ['/mnt/data/backend.zip\n/mnt/data/frontend.zip'] } } },
        } };
        const { zipPaths, candidateMids } = scanConversationForAllZips(conversation);
        expect(zipPaths).toEqual(['/mnt/data/backend.zip', '/mnt/data/frontend.zip']);
        expect(candidateMids).toEqual(['mid-code']);
    });
});

describe('retrieveAllCodeArtifacts', () => {
    const outputDir = join(tmpdir(), 'code-artifact-multi');

    function multiPage() {
        const conversation = { mapping: {
            a: { message: { id: 'mid-code', content: { content_type: 'code', text: '/mnt/data/backend.zip /mnt/data/frontend.zip' } } },
        } };
        const binaryByPath = {
            '/mnt/data/backend.zip': BACKEND_ZIP_B64,
            '/mnt/data/frontend.zip': FRONTEND_ZIP_B64,
        };
        let lastSandbox = null;
        return {
            evaluate: async (_fn, arg) => {
                if (typeof arg === 'string' && arg.startsWith('http')) {
                    return { status: 200, base64: binaryByPath[lastSandbox] };
                }
                if (typeof arg === 'string') return conversation;
                if (arg && typeof arg === 'object' && 'sandboxPath' in arg) {
                    lastSandbox = arg.sandboxPath;
                    return 'https://chatgpt.com/estuary?p=' + encodeURIComponent(arg.sandboxPath);
                }
                return null;
            },
        };
    }

    it('saves each zip under its basename', async () => {
        rmSync(outputDir, { force: true, recursive: true });
        const result = await retrieveAllCodeArtifacts(multiPage(), { conversationId: 'conv-1', outputDir });
        expect(result.ok).toBe(true);
        expect(result.artifacts).toHaveLength(2);
        expect(result.artifacts.every(a => a.ok)).toBe(true);
        expect(existsSync(join(outputDir, 'backend.zip'))).toBe(true);
        expect(existsSync(join(outputDir, 'frontend.zip'))).toBe(true);
        const be = result.artifacts.find(a => a.zipPath.endsWith('backend.zip'));
        expect(be.files).toContain('app.py');
    });

    it('reports missing when no zips are present', async () => {
        const page = { evaluate: async (_fn, arg) => (typeof arg === 'string' && !arg.startsWith('http') ? { mapping: {} } : null) };
        const result = await retrieveAllCodeArtifacts(page, { conversationId: 'conv-1', outputDir });
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('code-artifact:missing');
    });
});

describe('fetchBinaryBase64 fake-page contract', () => {
    it('passes the url through to the page evaluate', async () => {
        const page = makeRetrievalPage({ conversation: null, binaryByUrl: { 'https://x/y': { status: 200, base64: 'QQ==' } } });
        expect(await fetchBinaryBase64(page, 'https://x/y')).toEqual({ status: 200, base64: 'QQ==' });
    });
});
