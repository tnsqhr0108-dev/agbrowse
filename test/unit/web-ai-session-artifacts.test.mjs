import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ORIGINAL_HOME = process.env.BROWSER_AGENT_HOME;
let tmpHome;

beforeEach(() => {
    tmpHome = mkdtempSync(join(tmpdir(), 'agbrowse-artifacts-'));
    process.env.BROWSER_AGENT_HOME = tmpHome;
    vi.resetModules();
});

afterEach(() => {
    if (ORIGINAL_HOME === undefined) delete process.env.BROWSER_AGENT_HOME;
    else process.env.BROWSER_AGENT_HOME = ORIGINAL_HOME;
    rmSync(tmpHome, { recursive: true, force: true });
    vi.resetModules();
});

describe('web-ai session artifacts', () => {
    it('saves transcript artifacts and de-duplicates records by kind and path', async () => {
        const { createSession, getSession } = await import('../../web-ai/session.mjs');
        const { trySaveTranscript, appendArtifactRecord } = await import('../../web-ai/session-artifacts.mjs');
        const session = createSession({ vendor: 'chatgpt', prompt: 'hello', attachmentPolicy: 'inline-only' });

        const saved = trySaveTranscript(session.sessionId, 'hello transcript');
        expect(saved.ok).toBe(true);
        appendArtifactRecord(session.sessionId, saved.descriptor);
        appendArtifactRecord(session.sessionId, { ...saved.descriptor, sizeBytes: 999 });

        const refreshed = getSession(session.sessionId);
        expect(refreshed.artifacts).toHaveLength(1);
        expect(refreshed.artifacts[0]).toMatchObject({
            kind: 'transcript',
            path: 'transcript.md',
            sizeBytes: 999,
        });
    });

    it('returns structured failure when artifact directory creation fails', async () => {
        writeFileSync(join(tmpHome, 'sessions'), 'not a directory');
        const { trySaveTranscript } = await import('../../web-ai/session-artifacts.mjs');

        const saved = trySaveTranscript('session-1', 'hello');

        expect(saved.ok).toBe(false);
        expect(saved.stage).toBe('artifact-transcript');
        expect(saved.error).toMatch(/ENOTDIR|not a directory/i);
    });
});
