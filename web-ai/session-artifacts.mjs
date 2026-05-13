// @ts-check
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { homedir } from 'node:os';
import { updateSession, getSession } from './session.mjs';

const BROWSER_AGENT_HOME = process.env.BROWSER_AGENT_HOME || join(homedir(), '.browser-agent');

/**
 * @typedef {Object} ArtifactDescriptor
 * @property {'transcript'|'report'|'image'} kind
 * @property {string} label
 * @property {string} path
 * @property {string} [mimeType]
 * @property {number} [sizeBytes]
 * @property {string} [sourceUrl]
 * @property {string} savedAt
 */

/**
 * @typedef {{ ok: true, descriptor: ArtifactDescriptor } | { ok: false, stage: string, error: string }} ArtifactSaveResult
 */

/**
 * Sanitize a path segment to prevent directory traversal.
 * @param {string} segment
 * @returns {string}
 */
function sanitizeSegment(segment) {
    return segment.replace(/[\/\\:*?"<>|.]/g, '_').replace(/^_+|_+$/g, '') || 'unknown';
}

/**
 * Resolve the artifacts directory for a session.
 * Directory is created lazily on first write, not eagerly.
 * @param {string} sessionId
 * @returns {string}
 */
export function resolveArtifactsDir(sessionId) {
    const safe = sanitizeSegment(sessionId);
    return join(BROWSER_AGENT_HOME, 'sessions', safe, 'artifacts');
}

/**
 * Ensure the artifacts directory exists.
 * @param {string} dir
 */
function ensureDir(dir) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

/**
 * Save a transcript artifact.
 * @param {string} sessionId
 * @param {string} markdown
 * @returns {ArtifactDescriptor}
 */
export function saveTranscript(sessionId, markdown) {
    const dir = resolveArtifactsDir(sessionId);
    ensureDir(dir);
    const filename = 'transcript.md';
    const fullPath = join(dir, filename);
    writeFileSync(fullPath, markdown, 'utf8');
    return {
        kind: 'transcript',
        label: 'Conversation transcript',
        path: filename,
        mimeType: 'text/markdown',
        sizeBytes: Buffer.byteLength(markdown, 'utf8'),
        savedAt: new Date().toISOString(),
    };
}

/**
 * Save a transcript artifact and convert filesystem failures into a result.
 * @param {string} sessionId
 * @param {string} markdown
 * @returns {ArtifactSaveResult}
 */
export function trySaveTranscript(sessionId, markdown) {
    try {
        return { ok: true, descriptor: saveTranscript(sessionId, markdown) };
    } catch (err) {
        return {
            ok: false,
            stage: 'artifact-transcript',
            error: /** @type {Error} */ (err)?.message || String(err),
        };
    }
}

/**
 * Save a Deep Research report artifact.
 * @param {string} sessionId
 * @param {{ text: string, sources?: string[] }} report
 * @returns {ArtifactDescriptor}
 */
export function saveReport(sessionId, { text, sources }) {
    const dir = resolveArtifactsDir(sessionId);
    ensureDir(dir);
    const filename = 'report.md';
    let content = text;
    if (sources?.length) {
        content += '\n\n## Sources\n' + sources.map((s, i) => `${i + 1}. ${s}`).join('\n');
    }
    const fullPath = join(dir, filename);
    writeFileSync(fullPath, content, 'utf8');
    return {
        kind: 'report',
        label: 'Deep Research report',
        path: filename,
        mimeType: 'text/markdown',
        sizeBytes: Buffer.byteLength(content, 'utf8'),
        savedAt: new Date().toISOString(),
    };
}

/**
 * Save a Deep Research report artifact and convert failures into a result.
 * @param {string} sessionId
 * @param {{ text: string, sources?: string[] }} report
 * @returns {ArtifactSaveResult}
 */
export function trySaveReport(sessionId, report) {
    try {
        return { ok: true, descriptor: saveReport(sessionId, report) };
    } catch (err) {
        return {
            ok: false,
            stage: 'artifact-report',
            error: /** @type {Error} */ (err)?.message || String(err),
        };
    }
}

/**
 * Save an image artifact to the session artifacts directory.
 * @param {string} sessionId
 * @param {{ filename: string, buffer: Buffer, mimeType: string, sourceUrl?: string }} image
 * @returns {ArtifactDescriptor}
 */
export function saveImageArtifact(sessionId, { filename, buffer, mimeType, sourceUrl }) {
    const dir = resolveArtifactsDir(sessionId);
    ensureDir(dir);
    const safeName = sanitizeSegment(basename(filename, '.' + filename.split('.').pop())) +
        '.' + (mimeType.split('/')[1] || 'png');
    const fullPath = join(dir, safeName);
    writeFileSync(fullPath, buffer);
    return {
        kind: 'image',
        label: filename,
        path: safeName,
        mimeType,
        sizeBytes: buffer.length,
        sourceUrl: sourceUrl || undefined,
        savedAt: new Date().toISOString(),
    };
}

/**
 * Save an image artifact and convert failures into a result.
 * @param {string} sessionId
 * @param {{ filename: string, buffer: Buffer, mimeType: string, sourceUrl?: string }} image
 * @returns {ArtifactSaveResult}
 */
export function trySaveImageArtifact(sessionId, image) {
    try {
        return { ok: true, descriptor: saveImageArtifact(sessionId, image) };
    } catch (err) {
        return {
            ok: false,
            stage: 'artifact-image',
            error: /** @type {Error} */ (err)?.message || String(err),
        };
    }
}

/**
 * Append an artifact descriptor to a session's artifacts array.
 * @param {string} sessionId
 * @param {ArtifactDescriptor} descriptor
 * @returns {import('./session-store.mjs').WebAiSession|null}
 */
export function appendArtifactRecord(sessionId, descriptor) {
    const session = getSession(sessionId);
    if (!session) return null;
    const artifacts = /** @type {ArtifactDescriptor[]} */ (session.artifacts || []);
    const withoutDuplicate = artifacts.filter((artifact) => !(artifact.kind === descriptor.kind && artifact.path === descriptor.path));
    return updateSession(sessionId, { artifacts: [...withoutDuplicate, descriptor] });
}
