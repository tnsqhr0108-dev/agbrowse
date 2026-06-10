// @ts-check
// Code-mode artifact retrieval (Phase 10 of devlog/_plan/260611_webai_gpt_code_mode).
// Retrieves a /mnt/data/*.zip built by ChatGPT's container tools without any
// button click: conversation JSON → sandbox path scan → interpreter/download
// presigned URL → in-page credentialed fetch (estuary URLs are cookie-bound;
// external fetches get 403 — verified 2026-06-11, see 01_prompt_contract.md).

import { writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** @typedef {import('playwright-core').Page} Page */

/**
 * @typedef {Object} ZipScanResult
 * @property {string|null} zipPath
 * @property {string[]} candidateMids
 */

/**
 * @typedef {Object} RetrieveResult
 * @property {boolean} ok
 * @property {string|null} reason
 * @property {string|null} zipPath
 * @property {string|null} savedPath
 * @property {number} sizeBytes
 * @property {string[]} files
 */

const ZIP_PATH_RE = /\/mnt\/data\/[A-Za-z0-9_\-./]+\.zip/;
const ZIP_PATH_RE_GLOBAL = /\/mnt\/data\/[A-Za-z0-9_\-./]+\.zip/g;

/**
 * Pure scan of a conversation JSON for the newest /mnt/data/*.zip reference
 * and the tool-message ids usable as interpreter/download `message_id`.
 *
 * The path is NOT reliably present in execution_output text (verified empty
 * for container.exec runs) — scan every message's content JSON instead, and
 * collect code/execution_output mids as download candidates (no single-mid
 * assumption; callers try each until one mints a URL).
 *
 * @param {{ mapping?: Record<string, { message?: { id?: string, content?: { content_type?: string } } }> }} conversation
 * @returns {ZipScanResult}
 */
export function scanConversationForZip(conversation) {
    /** @type {string|null} */
    let zipPath = null;
    /** @type {string[]} */
    const candidateMids = [];
    for (const node of Object.values(conversation?.mapping || {})) {
        const message = node?.message;
        if (!message) continue;
        const contentType = message.content?.content_type || '';
        const blob = JSON.stringify(message.content || {});
        const match = blob.match(ZIP_PATH_RE);
        if (match) zipPath = match[0];
        if ((contentType === 'execution_output' || contentType === 'code') && message.id) {
            candidateMids.push(message.id);
        }
    }
    return { zipPath, candidateMids };
}

/**
 * Multi-zip variant: collect every distinct /mnt/data/*.zip referenced anywhere
 * in the conversation (in first-seen order) plus the same tool-message id
 * candidates. Used when the contract permits more than one archive.
 *
 * @param {{ mapping?: Record<string, { message?: { id?: string, content?: { content_type?: string } } }> }} conversation
 * @returns {{ zipPaths: string[], candidateMids: string[] }}
 */
export function scanConversationForAllZips(conversation) {
    /** @type {string[]} */
    const zipPaths = [];
    const seen = new Set();
    /** @type {string[]} */
    const candidateMids = [];
    for (const node of Object.values(conversation?.mapping || {})) {
        const message = node?.message;
        if (!message) continue;
        const contentType = message.content?.content_type || '';
        const blob = JSON.stringify(message.content || {});
        for (const match of blob.match(ZIP_PATH_RE_GLOBAL) || []) {
            if (!seen.has(match)) { seen.add(match); zipPaths.push(match); }
        }
        if ((contentType === 'execution_output' || contentType === 'code') && message.id) {
            candidateMids.push(message.id);
        }
    }
    return { zipPaths, candidateMids };
}

/**
 * Minimal zip validation without dependencies: local-file magic at offset 0
 * plus an End-Of-Central-Directory record, whose central directory yields the
 * entry names. Returns null when the buffer is not a readable zip.
 *
 * @param {Buffer} buffer
 * @returns {{ files: string[] } | null}
 */
export function verifyZipBuffer(buffer) {
    if (!buffer || buffer.length < 22) return null;
    if (buffer.readUInt32LE(0) !== 0x04034b50) return null;
    const eocdStart = Math.max(0, buffer.length - 22 - 65535);
    let eocd = -1;
    for (let i = buffer.length - 22; i >= eocdStart; i--) {
        if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return null;
    const entryCount = buffer.readUInt16LE(eocd + 10);
    const cdOffset = buffer.readUInt32LE(eocd + 16);
    /** @type {string[]} */
    const files = [];
    let cursor = cdOffset;
    for (let i = 0; i < entryCount; i++) {
        if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) return null;
        const nameLength = buffer.readUInt16LE(cursor + 28);
        const extraLength = buffer.readUInt16LE(cursor + 30);
        const commentLength = buffer.readUInt16LE(cursor + 32);
        files.push(buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength));
        cursor += 46 + nameLength + extraLength + commentLength;
    }
    return { files };
}

/**
 * @param {Page} page
 * @param {string} conversationId
 * @returns {Promise<Record<string, unknown>|null>}
 */
export async function fetchConversationJson(page, conversationId) {
    return page.evaluate(async (convId) => {
        const session = await fetch('/api/auth/session').then(r => r.json()).catch(() => null);
        if (!session?.accessToken) return null;
        return fetch('/backend-api/conversation/' + convId, {
            headers: { Authorization: 'Bearer ' + session.accessToken },
        }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    }, conversationId);
}

/**
 * Mint an estuary presigned URL for one (message_id, sandbox_path) pair.
 *
 * @param {Page} page
 * @param {{ conversationId: string, messageId: string, sandboxPath: string }} params
 * @returns {Promise<string|null>}
 */
export async function mintDownloadUrl(page, { conversationId, messageId, sandboxPath }) {
    return page.evaluate(async (args) => {
        const session = await fetch('/api/auth/session').then(r => r.json()).catch(() => null);
        if (!session?.accessToken) return null;
        const url = '/backend-api/conversation/' + args.conversationId
            + '/interpreter/download?message_id=' + args.messageId
            + '&sandbox_path=' + encodeURIComponent(args.sandboxPath);
        const body = await fetch(url, { headers: { Authorization: 'Bearer ' + session.accessToken } })
            .then(r => (r.ok ? r.json() : null)).catch(() => null);
        return body?.download_url || null;
    }, { conversationId, messageId, sandboxPath });
}

/**
 * Fetch a cookie-bound binary inside the page and return it base64-encoded.
 *
 * @param {Page} page
 * @param {string} url
 * @returns {Promise<{ status: number, base64: string }|null>}
 */
export async function fetchBinaryBase64(page, url) {
    return page.evaluate(async (target) => {
        const response = await fetch(target, { credentials: 'include' }).catch(() => null);
        if (!response || !response.ok) return response ? { status: response.status, base64: '' } : null;
        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode.apply(null, /** @type {number[]} */ (/** @type {unknown} */ (bytes.subarray(i, i + CHUNK))));
        }
        return { status: response.status, base64: btoa(binary) };
    }, url);
}

/**
 * End-to-end retrieval: scan the conversation, mint a presigned URL (trying
 * every candidate mid), fetch in-page, verify the zip, and save it.
 *
 * Fail-fast: every failure surfaces a distinct `reason`; there is no silent
 * fallback between stages.
 *
 * @param {Page} page
 * @param {{ conversationId: string, outputPath: string }} params
 * @returns {Promise<RetrieveResult>}
 */
export async function retrieveCodeArtifact(page, { conversationId, outputPath }) {
    /** @type {RetrieveResult} */
    const result = { ok: false, reason: null, zipPath: null, savedPath: null, sizeBytes: 0, files: [] };

    const conversation = await fetchConversationJson(page, conversationId);
    if (!conversation) return { ...result, reason: 'code-artifact:conversation-unavailable' };

    const { zipPath, candidateMids } = scanConversationForZip(conversation);
    if (!zipPath) return { ...result, reason: 'code-artifact:missing' };
    if (!candidateMids.length) return { ...result, zipPath, reason: 'code-artifact:no-tool-messages' };

    return downloadAndSaveZip(page, { conversationId, zipPath, candidateMids, outputPath });
}

/**
 * Retrieve EVERY /mnt/data/*.zip in the conversation, saving each under
 * outputDir using its sandbox basename. Per-artifact failures are reported in
 * the artifacts array; the call succeeds when at least one zip was saved.
 *
 * @param {Page} page
 * @param {{ conversationId: string, outputDir: string }} params
 * @returns {Promise<{ ok: boolean, reason: string|null, artifacts: RetrieveResult[] }>}
 */
export async function retrieveAllCodeArtifacts(page, { conversationId, outputDir }) {
    const conversation = await fetchConversationJson(page, conversationId);
    if (!conversation) return { ok: false, reason: 'code-artifact:conversation-unavailable', artifacts: [] };

    const { zipPaths, candidateMids } = scanConversationForAllZips(conversation);
    if (!zipPaths.length) return { ok: false, reason: 'code-artifact:missing', artifacts: [] };
    if (!candidateMids.length) return { ok: false, reason: 'code-artifact:no-tool-messages', artifacts: [] };

    /** @type {RetrieveResult[]} */
    const artifacts = [];
    for (const zipPath of zipPaths) {
        const outputPath = join(outputDir, basename(zipPath));
        // eslint-disable-next-line no-await-in-loop -- sequential to reuse one page and avoid presigned-URL races
        artifacts.push(await downloadAndSaveZip(page, { conversationId, zipPath, candidateMids, outputPath }));
    }
    const ok = artifacts.some(a => a.ok);
    return { ok, reason: ok ? null : 'code-artifact:all-failed', artifacts };
}

/**
 * Mint a URL for one sandbox path (trying each candidate mid), fetch in-page,
 * verify, and save. Shared by single- and multi-zip retrieval.
 *
 * @param {Page} page
 * @param {{ conversationId: string, zipPath: string, candidateMids: string[], outputPath: string }} params
 * @returns {Promise<RetrieveResult>}
 */
async function downloadAndSaveZip(page, { conversationId, zipPath, candidateMids, outputPath }) {
    /** @type {RetrieveResult} */
    const result = { ok: false, reason: null, zipPath, savedPath: null, sizeBytes: 0, files: [] };

    let payload = null;
    for (const messageId of candidateMids) {
        // eslint-disable-next-line no-await-in-loop -- try mids in order; stop at first that mints a working URL
        const downloadUrl = await mintDownloadUrl(page, { conversationId, messageId, sandboxPath: zipPath });
        if (!downloadUrl) continue;
        // eslint-disable-next-line no-await-in-loop
        const fetched = await fetchBinaryBase64(page, downloadUrl);
        if (fetched?.base64) { payload = fetched; break; }
    }
    if (!payload) return { ...result, reason: 'code-artifact:download-failed' };

    const buffer = Buffer.from(payload.base64, 'base64');
    const verified = verifyZipBuffer(buffer);
    if (!verified) return { ...result, sizeBytes: buffer.length, reason: 'code-artifact:invalid-zip' };

    try {
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, buffer);
    } catch (error) {
        console.error('[code-artifact]', /** @type {Error} */ (error)?.message || error);
        return { ...result, sizeBytes: buffer.length, files: verified.files, reason: 'code-artifact:write-failed' };
    }
    return { ok: true, reason: null, zipPath, savedPath: outputPath, sizeBytes: buffer.length, files: verified.files };
}
