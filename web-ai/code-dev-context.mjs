// @ts-check
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/** @ts-ignore — archiver has no bundled types and @types/archiver is not installed */
import archiver from 'archiver';

export const GPT_DEV_AGENT_CONTEXT_BASENAME = 'gpt-dev-agent-context.zip';
export const GPT_DEV_AGENT_CONTEXT_MARKDOWN_ENTRY = 'GPT_DEV_AGENT_CONTEXT.md';
export const GPT_DEV_AGENT_CONTEXT_MANIFEST_ENTRY = 'MANIFEST.json';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = dirname(MODULE_DIR);

/**
 * @param {{ packageRoot?: string }} [options]
 */
export function resolveCodeDevContextPaths(options = {}) {
    const packageRoot = options.packageRoot || PACKAGE_ROOT;
    const modulesDir = join(packageRoot, 'skills', 'web-ai', 'modules');
    return {
        packageRoot,
        modulesDir,
        markdownPath: join(modulesDir, 'gpt-dev-agent-context.md'),
        zipPath: join(modulesDir, GPT_DEV_AGENT_CONTEXT_BASENAME),
    };
}

/**
 * @param {{ packageRoot?: string }} [options]
 */
export async function ensureCodeDevContextZip(options = {}) {
    const paths = resolveCodeDevContextPaths(options);
    const markdown = await fs.readFile(paths.markdownPath, 'utf8');
    const manifest = buildManifest(markdown);
    const existing = await readCodeDevContextManifest(paths.zipPath).catch(() => null);
    if (!existing || existing.sha256 !== manifest.sha256 || existing.version !== manifest.version) {
        await writeContextZip(paths.zipPath, markdown, manifest);
    }
    const stat = await fs.stat(paths.zipPath);
    return {
        path: paths.zipPath,
        displayPath: GPT_DEV_AGENT_CONTEXT_BASENAME,
        sizeBytes: stat.size,
        manifest,
    };
}

/**
 * @param {string} zipPath
 * @returns {Promise<any>}
 */
export async function readCodeDevContextManifest(zipPath) {
    const { verifyZipBuffer, readZipTextEntry } = await import('./code-artifact.mjs');
    const buffer = await fs.readFile(zipPath);
    const verified = verifyZipBuffer(buffer);
    if (!verified?.files.includes(GPT_DEV_AGENT_CONTEXT_MANIFEST_ENTRY)) {
        throw new Error('code dev context manifest missing');
    }
    const raw = readZipTextEntry(buffer, GPT_DEV_AGENT_CONTEXT_MANIFEST_ENTRY);
    if (!raw) throw new Error('code dev context manifest unreadable');
    return JSON.parse(raw);
}

/**
 * @param {string} markdown
 */
function buildManifest(markdown) {
    return {
        name: 'gpt-dev-agent-context',
        version: 1,
        createdBy: 'agbrowse web-ai code',
        entries: [GPT_DEV_AGENT_CONTEXT_MARKDOWN_ENTRY],
        sha256: createHash('sha256').update(markdown).digest('hex'),
    };
}

/**
 * @param {string} outputPath
 * @param {string} markdown
 * @param {Record<string, any>} manifest
 */
async function writeContextZip(outputPath, markdown, manifest) {
    await fs.mkdir(dirname(outputPath), { recursive: true });
    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = createWriteStream(outputPath);
    const done = new Promise((resolve, reject) => {
        output.on('close', () => resolve(undefined));
        output.on('error', reject);
        archive.on('error', reject);
    });
    archive.pipe(output);
    archive.append(Buffer.from(markdown, 'utf8'), { name: GPT_DEV_AGENT_CONTEXT_MARKDOWN_ENTRY });
    archive.append(Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'), { name: GPT_DEV_AGENT_CONTEXT_MANIFEST_ENTRY });
    await archive.finalize();
    await done;
}
