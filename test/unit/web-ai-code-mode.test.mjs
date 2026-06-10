import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codeWebAi, extractCodeArtifacts, extractConversationId } from '../../web-ai/code-mode.mjs';

const FIXTURE_ZIP_B64 = 'UEsDBAoAAAAAANwQy1wgMDo2BgAAAAYAAAAJABwAUkVBRE1FLm1kVVQJAAOwmSlqsJkpanV4CwABBPUBAAAEAAAAAGhlbGxvClBLAwQKAAAAAADcEMtcAAAAAAAAAAAAAAAABAAcAHNyYy9VVAkAA7CZKWqwmSlqdXgLAAEE9QEAAAQAAAAAUEsDBAoAAAAAANwQy1wH7v1xDwAAAA8AAAAIABwAc3JjL2EuanNVVAkAA7CZKWqwmSlqdXgLAAEE9QEAAAQAAAAAY29uc29sZS5sb2coMSkKUEsBAh4DCgAAAAAA3BDLXCAwOjYGAAAABgAAAAkAGAAAAAAAAQAAAKSBAAAAAFJFQURNRS5tZFVUBQADsJkpanV4CwABBPUBAAAEAAAAAFBLAQIeAwoAAAAAANwQy1wAAAAAAAAAAAAAAAAEABgAAAAAAAAAEADtQUkAAABzcmMvVVQFAAOwmSlqdXgLAAEE9QEAAAQAAAAAUEsBAh4DCgAAAAAA3BDLXAfu/XEPAAAADwAAAAgAGAAAAAAAAQAAAKSBhwAAAHNyYy9hLmpzVVQFAAOwmSlqdXgLAAEE9QEAAAQAAAAAUEsFBgAAAAADAAMA5wAAANgAAAAAAA==';

function conversationFixture() {
    return {
        mapping: {
            a: { message: { id: 'mid-code', content: { content_type: 'code', text: 'zip ...' } } },
            b: { message: { id: 'mid-final', content: { content_type: 'text', parts: ['/mnt/data/result.zip'] } } },
        },
    };
}

// Page whose evaluate serves conversation JSON, a presigned URL, and the binary.
function makePage(url) {
    return {
        url: () => url,
        evaluate: async (_fn, arg) => {
            if (typeof arg === 'string' && arg.startsWith('http')) return { status: 200, base64: FIXTURE_ZIP_B64 };
            if (typeof arg === 'string') return conversationFixture();
            if (arg && typeof arg === 'object' && 'messageId' in arg) return 'https://chatgpt.com/estuary?sig=1';
            return null;
        },
    };
}

describe('extractConversationId', () => {
    it('pulls the id from a chatgpt conversation url', () => {
        expect(extractConversationId('https://chatgpt.com/c/6a29932e-4848-83aa-871b-3850096c0224')).toBe('6a29932e-4848-83aa-871b-3850096c0224');
        expect(extractConversationId('6a29932e-4848-83aa-871b-3850096c0224')).toBe('6a29932e-4848-83aa-871b-3850096c0224');
        expect(extractConversationId('https://chatgpt.com/')).toBeNull();
        expect(extractConversationId(null)).toBeNull();
    });
});

describe('extractCodeArtifacts', () => {
    const outputZip = join(tmpdir(), 'code-extract-test', 'out.zip');

    it('retrieves from an existing conversation URL without sending a prompt', async () => {
        rmSync(outputZip, { force: true });
        let gotoUrl = null;
        const page = {
            url: () => 'https://example.com/',
            goto: async (url) => { gotoUrl = url; },
            evaluate: async (_fn, arg) => {
                if (typeof arg === 'string' && arg.startsWith('http')) return { status: 200, base64: FIXTURE_ZIP_B64 };
                if (typeof arg === 'string') return conversationFixture();
                if (arg && typeof arg === 'object' && 'messageId' in arg) return 'https://chatgpt.com/estuary?sig=1';
                return null;
            },
        };
        const result = await extractCodeArtifacts({ getPage: async () => page }, {
            vendor: 'chatgpt',
            url: 'https://chatgpt.com/c/conv-abc',
            outputZip,
        });
        expect(result.ok).toBe(true);
        expect(gotoUrl).toBe('https://chatgpt.com/c/conv-abc');
        expect(result.conversationId).toBe('conv-abc');
        expect(result.artifact.files).toContain('src/a.js');
        expect(existsSync(outputZip)).toBe(true);
    });

    it('retrieves from the current ChatGPT tab when only the assistant text contains the zip path', async () => {
        rmSync(outputZip, { force: true });
        const page = makePage('https://chatgpt.com/c/conv-abc');
        const result = await extractCodeArtifacts({ getPage: async () => page }, {
            vendor: 'chatgpt',
            outputZip,
        });
        expect(result.ok).toBe(true);
        expect(result.artifact.zipPath).toBe('/mnt/data/result.zip');
        expect(existsSync(outputZip)).toBe(true);
    });

    it('reports a clear error when no conversation id is available', async () => {
        const page = makePage('https://chatgpt.com/');
        const result = await extractCodeArtifacts({ getPage: async () => page }, { vendor: 'chatgpt', outputZip });
        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe('code-extract.conversation-id-missing');
    });
});

describe('codeWebAi', () => {
    const outputZip = join(tmpdir(), 'code-mode-test', 'out.zip');

    function services(queryResult) {
        return {
            queryWebAi: async () => queryResult,
            getSession: () => ({ conversationUrl: 'https://chatgpt.com/c/conv-abc' }),
        };
    }

    it('rejects non-chatgpt vendors', async () => {
        await expect(codeWebAi({}, { vendor: 'gemini', prompt: 'x' }, services({ ok: true })))
            .rejects.toThrow(/ChatGPT-only/);
    });

    it('runs query then retrieves and verifies the artifact', async () => {
        rmSync(outputZip, { force: true });
        const page = makePage('https://chatgpt.com/c/conv-abc');
        const deps = { getPage: async () => page };
        const result = await codeWebAi(deps, { vendor: 'chatgpt', prompt: 'ping API', outputZip }, services({
            ok: true, sessionId: 's1', answerText: '/mnt/data/result.zip', warnings: [],
        }));
        expect(result.ok).toBe(true);
        expect(result.artifact.files).toContain('src/a.js');
        expect(result.compliance.compliant).toBe(true);
        expect(existsSync(outputZip)).toBe(true);
        expect(readFileSync(outputZip).length).toBe(result.artifact.sizeBytes);
    });

    it('flags contract drift when the answer is chatty but still retrieves', async () => {
        const page = makePage('https://chatgpt.com/c/conv-abc');
        const deps = { getPage: async () => page };
        const result = await codeWebAi(deps, { vendor: 'chatgpt', prompt: 'ping API', outputZip }, services({
            ok: true, sessionId: 's1', answerText: 'Done! see /mnt/data/result.zip', warnings: [],
        }));
        expect(result.ok).toBe(true);
        expect(result.warnings).toContain('code-mode:contract-drift');
    });

    it('passes through a failed query result untouched', async () => {
        const result = await codeWebAi({ getPage: async () => makePage('') }, { vendor: 'chatgpt', prompt: 'x' }, services({ ok: false, errorCode: 'provider.timeout' }));
        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe('provider.timeout');
    });

    it('retrieves multiple zips into outputDir when multiZip is set', async () => {
        const outputDir = join(tmpdir(), 'code-mode-multi');
        rmSync(outputDir, { force: true, recursive: true });
        const conversation = { mapping: {
            a: { message: { id: 'mid-code', content: { content_type: 'code', text: '/mnt/data/a.zip /mnt/data/b.zip' } } },
        } };
        let lastSandbox = null;
        const page = {
            url: () => 'https://chatgpt.com/c/conv-abc',
            evaluate: async (_fn, arg) => {
                if (typeof arg === 'string' && arg.startsWith('http')) return { status: 200, base64: FIXTURE_ZIP_B64 };
                if (typeof arg === 'string') return conversation;
                if (arg && typeof arg === 'object' && 'sandboxPath' in arg) { lastSandbox = arg.sandboxPath; return 'https://chatgpt.com/e?p=' + lastSandbox; }
                return null;
            },
        };
        const deps = { getPage: async () => page };
        const result = await codeWebAi(deps, { vendor: 'chatgpt', prompt: 'fullstack', multiZip: true, outputDir }, {
            queryWebAi: async () => ({ ok: true, sessionId: 's1', answerText: '/mnt/data/a.zip\n/mnt/data/b.zip', warnings: [] }),
            getSession: () => ({ conversationUrl: 'https://chatgpt.com/c/conv-abc' }),
        });
        expect(result.ok).toBe(true);
        expect(result.artifacts).toHaveLength(2);
        expect(existsSync(join(outputDir, 'a.zip'))).toBe(true);
        expect(existsSync(join(outputDir, 'b.zip'))).toBe(true);
    });

    it('errors when no conversation id can be resolved', async () => {
        const page = makePage('https://chatgpt.com/');
        const deps = { getPage: async () => page };
        const result = await codeWebAi(deps, { vendor: 'chatgpt', prompt: 'x', outputZip }, {
            queryWebAi: async () => ({ ok: true, sessionId: 's1', answerText: '/mnt/data/result.zip', warnings: [] }),
            getSession: () => ({ conversationUrl: null, url: null }),
        });
        expect(result.ok).toBe(false);
        expect(result.errorCode).toBe('code-mode.conversation-id-missing');
    });
});
