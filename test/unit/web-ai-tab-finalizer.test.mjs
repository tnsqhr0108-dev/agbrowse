import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ORIGINAL_HOME = process.env.BROWSER_AGENT_HOME;
let tmpHome;

beforeEach(() => {
    tmpHome = mkdtempSync(join(tmpdir(), 'agbrowse-finalizer-'));
    process.env.BROWSER_AGENT_HOME = tmpHome;
    vi.resetModules();
});

afterEach(() => {
    if (ORIGINAL_HOME === undefined) delete process.env.BROWSER_AGENT_HOME;
    else process.env.BROWSER_AGENT_HOME = ORIGINAL_HOME;
    rmSync(tmpHome, { recursive: true, force: true });
    vi.resetModules();
});

describe('web-ai tab finalizer artifact-before-archive contract', () => {
    it('archive policy skips provider archive when required artifact save failed', async () => {
        const { resolveArchivePolicy } = await import('../../web-ai/chatgpt-archive.mjs');

        expect(resolveArchivePolicy({
            archiveFlag: 'always',
            artifactStatus: { required: true, ok: false, stage: 'artifact-transcript' },
            session: {
                conversationUrl: 'https://chatgpt.com/c/abc123',
                status: 'complete',
            },
        })).toEqual({ shouldArchive: false, reason: 'artifact-save-failed' });
    });

    it('finalizeProviderTab does not call archive after transcript save failure', async () => {
        const archiveConversation = vi.fn(async () => ({ ok: true }));
        const poolTab = vi.fn(async () => ({ ok: true, pooled: true }));
        vi.doMock('../../web-ai/chatgpt-archive.mjs', async () => {
            const actual = await vi.importActual('../../web-ai/chatgpt-archive.mjs');
            return { ...actual, archiveConversation };
        });
        vi.doMock('../../web-ai/tab-pool.mjs', () => ({ poolTab }));

        const { createSession } = await import('../../web-ai/session.mjs');
        const { finalizeProviderTab } = await import('../../web-ai/tab-finalizer.mjs');
        const session = createSession(
            { vendor: 'chatgpt', prompt: 'hello', attachmentPolicy: 'inline-only' },
            {
                targetId: 'target-1',
                conversationUrl: 'https://chatgpt.com/c/abc123',
            },
        );
        writeFileSync(join(tmpHome, 'sessions'), 'not a directory');

        const result = await finalizeProviderTab({
            getPort: () => 9222,
        }, {
            vendor: 'chatgpt',
            session,
            page: { url: () => 'https://chatgpt.com/c/abc123' },
            answerText: 'final answer',
            archiveFlag: 'always',
        });

        expect(result.finalized).toBe(true);
        expect(result.archived).toBe(false);
        expect(result.archiveSkippedReason).toBe('artifact-save-failed');
        expect(archiveConversation).not.toHaveBeenCalled();
        expect(poolTab).toHaveBeenCalled();
    });
});
