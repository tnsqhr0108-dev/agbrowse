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

describe('web-ai file artifacts (kind:file)', () => {
    it('saves a generic file artifact preserving the extension', async () => {
        const { createSession, getSession } = await import('../../web-ai/session.mjs');
        const { trySaveFileArtifact, appendArtifactRecord, resolveArtifactsDir } = await import('../../web-ai/session-artifacts.mjs');
        const { existsSync, readFileSync } = await import('node:fs');
        const { join } = await import('node:path');
        const session = createSession({ vendor: 'chatgpt', prompt: 'hi', attachmentPolicy: 'inline-only' });

        const res = trySaveFileArtifact(session.sessionId, {
            filename: 'result.csv',
            buffer: Buffer.from('a,b\n1,2\n'),
            mimeType: 'text/csv',
            sourceUrl: 'https://chatgpt.com/backend-api/files/file_a/download',
        });
        if (!res.ok) throw new Error('expected save to succeed: ' + res.error);
        expect(res.descriptor).toMatchObject({ kind: 'file', label: 'result.csv', path: 'result.csv', mimeType: 'text/csv' });
        const full = join(resolveArtifactsDir(session.sessionId), res.descriptor.path);
        expect(existsSync(full)).toBe(true);
        expect(readFileSync(full, 'utf8')).toContain('a,b');

        appendArtifactRecord(session.sessionId, res.descriptor);
        expect(getSession(session.sessionId).artifacts).toHaveLength(1);
    });

    it('falls back to the MIME subtype when the filename has no extension', async () => {
        const { createSession } = await import('../../web-ai/session.mjs');
        const { trySaveFileArtifact } = await import('../../web-ai/session-artifacts.mjs');
        const session = createSession({ vendor: 'chatgpt', prompt: 'hi', attachmentPolicy: 'inline-only' });
        const res = trySaveFileArtifact(session.sessionId, {
            filename: 'chatgpt-file-1',
            buffer: Buffer.from('PK'),
            mimeType: 'application/zip',
        });
        if (!res.ok) throw new Error('expected save to succeed: ' + res.error);
        expect(res.descriptor.path).toBe('chatgpt-file-1.zip');
    });

    it('returns an artifact-file failure result on write error', async () => {
        const { createSession } = await import('../../web-ai/session.mjs');
        const { trySaveFileArtifact } = await import('../../web-ai/session-artifacts.mjs');
        const session = createSession({ vendor: 'chatgpt', prompt: 'hi', attachmentPolicy: 'inline-only' });
        const res = trySaveFileArtifact(session.sessionId, {
            filename: 'x.bin',
            // @ts-expect-error force a write failure
            buffer: undefined,
            mimeType: 'application/octet-stream',
        });
        expect(res.ok).toBe(false);
        if (res.ok) throw new Error('expected failure');
        expect(res.stage).toBe('artifact-file');
    });

    it('dedupes file artifacts separately from image artifacts at the same path', async () => {
        const { createSession, getSession } = await import('../../web-ai/session.mjs');
        const { appendArtifactRecord } = await import('../../web-ai/session-artifacts.mjs');
        const session = createSession({ vendor: 'chatgpt', prompt: 'hi', attachmentPolicy: 'inline-only' });
        const at = new Date().toISOString();
        appendArtifactRecord(session.sessionId, { kind: 'file', label: 's', path: 'shared.dat', mimeType: 'application/octet-stream', sizeBytes: 1, savedAt: at });
        appendArtifactRecord(session.sessionId, { kind: 'image', label: 's', path: 'shared.dat', mimeType: 'image/png', sizeBytes: 2, savedAt: at });
        expect(getSession(session.sessionId).artifacts).toHaveLength(2);

        appendArtifactRecord(session.sessionId, { kind: 'file', label: 's', path: 'shared.dat', mimeType: 'application/octet-stream', sizeBytes: 99, savedAt: at });
        const arts = getSession(session.sessionId).artifacts;
        expect(arts).toHaveLength(2);
        expect(arts.find((a) => a.kind === 'file').sizeBytes).toBe(99);
        expect(arts.find((a) => a.kind === 'image').sizeBytes).toBe(2);
    });
});
