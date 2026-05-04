import { createHash, randomUUID } from 'node:crypto';
import { domHashAround } from './dom-hash.mjs';
import { WebAiError } from './errors.mjs';

export const DEFAULT_SNAPSHOT_MAX_DEPTH = 6;
export const DEFAULT_MAX_NAME_CHARS = 900;
export const DEFAULT_INTERACTIVE_ROLES = new Set([
    'button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio',
    'switch', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'tab',
    'slider', 'spinbutton', 'treeitem', 'listbox', 'gridcell', 'cell',
]);

export async function buildWebAiSnapshot(page, {
    provider = null,
    compact = true,
    interactiveOnly = true,
    maxDepth = DEFAULT_SNAPSHOT_MAX_DEPTH,
    rootSelector = null,
    refPrefix = '@e',
    redactText = false,
    includeDomHash = true,
    domHashMaxChars = 32768,
} = {}) {
    const tree = await captureAccessibilitySnapshot(page, { interactiveOnly, rootSelector });
    const serialized = serializeAxTree(tree, { compact, maxDepth, refPrefix, redactText });
    const domHash = includeDomHash
        ? await domHashAround(page, rootSelector ? [rootSelector] : ['body'], { maxChars: domHashMaxChars }).catch(() => null)
        : null;
    const text = serialized.text || '- document';
    return {
        snapshotId: randomUUID(),
        provider,
        url: page.url?.() || null,
        domHash,
        axHash: hashAccessibilitySnapshot(text),
        text,
        refs: serialized.refs,
        stats: {
            nodeCount: serialized.nodeCount,
            interactiveCount: Object.keys(serialized.refs).length,
            tokenEstimate: estimateSnapshotTokens(text),
        },
    };
}

export function estimateSnapshotTokens(snapshotText) {
    return Math.ceil(String(snapshotText || '').length / 4);
}

export function hashAccessibilitySnapshot(snapshotText) {
    const normalized = String(snapshotText || '').replace(/\s+/g, ' ').trim();
    return `sha256:${createHash('sha256').update(normalized).digest('hex').slice(0, 16)}`;
}

export function extractInteractiveRefs(snapshot, prefix = '@e') {
    if (snapshot?.refs && typeof snapshot.refs === 'object' && !snapshot.role) {
        return { ...snapshot.refs };
    }
    const refs = {};
    let counter = 1;
    const occurrenceCounts = new Map();
    walkAx(snapshot, (node, depth, path) => {
        if (!isInteractiveNode(node)) return;
        const ref = `${prefix}${counter++}`;
        const name = truncateName(node.name || '');
        const role = String(node.role || 'unknown');
        const occurrenceKey = roleNameKey(role, name);
        const occurrenceIndex = occurrenceCounts.get(occurrenceKey) || 0;
        occurrenceCounts.set(occurrenceKey, occurrenceIndex + 1);
        refs[ref] = {
            ref,
            role,
            name,
            occurrenceIndex,
            selector: null,
            framePath: [],
            shadowPath: [],
            signatureHash: hashElementSignature({ role, name, depth, path }),
        };
    });
    return refs;
}

export function summarizeSnapshotForDoctor(snapshot, { maxRefs = 8 } = {}) {
    const refs = Object.values(snapshot?.refs || {}).slice(0, maxRefs);
    return {
        enabled: true,
        contentSafe: true,
        snapshotId: snapshot?.snapshotId || null,
        axHash: snapshot?.axHash || null,
        domHash: snapshot?.domHash || null,
        interactiveCount: snapshot?.stats?.interactiveCount || 0,
        tokenEstimate: snapshot?.stats?.tokenEstimate || 0,
        topRefs: refs.map(ref => ({
            ref: ref.ref,
            role: ref.role,
            nameHash: ref.name ? hashDoctorField(ref.name) : null,
            nameChars: ref.name ? ref.name.length : 0,
        })),
    };
}

async function captureAccessibilitySnapshot(page, { interactiveOnly, rootSelector }) {
    if (!page?.accessibility || typeof page.accessibility.snapshot !== 'function') {
        throw new WebAiError({
            errorCode: 'snapshot.unavailable',
            stage: 'snapshot-capture',
            retryHint: 'pin-playwright-or-add-cdp-fallback',
            message: 'page.accessibility.snapshot() is not available in this Playwright runtime',
        });
    }
    let root = null;
    try {
        if (rootSelector) {
            root = await page.locator(rootSelector).elementHandle().catch(() => null);
            if (!root) {
                throw new WebAiError({
                    errorCode: 'snapshot.root-not-found',
                    stage: 'snapshot-capture',
                    retryHint: 'fix-root-selector',
                    message: `snapshot root selector did not match: ${rootSelector}`,
                    evidence: { rootSelector },
                });
            }
        }
        return await page.accessibility.snapshot({
            interestingOnly: interactiveOnly,
            ...(root ? { root } : {}),
        });
    } finally {
        await root?.dispose?.().catch(() => undefined);
    }
}

function serializeAxTree(tree, options) {
    const ctx = { ...options, refs: {}, nextRef: 1, nodeCount: 0, occurrenceCounts: new Map() };
    const lines = serializeNode(tree || { role: 'document', name: '' }, 0, ctx, []);
    return { text: lines.join('\n'), refs: ctx.refs, nodeCount: ctx.nodeCount };
}

function serializeNode(node, depth, ctx, path) {
    if (!node || depth > ctx.maxDepth) return [];
    ctx.nodeCount += 1;
    const role = sanitizeRole(node.role || 'generic');
    const rawName = truncateName(node.name || '');
    const name = ctx.redactText && rawName ? `[redacted:${hashDoctorField(rawName)}]` : rawName;
    const indent = '  '.repeat(depth);
    const attrs = [];

    if (isInteractiveNode(node)) {
        const ref = `${ctx.refPrefix}${ctx.nextRef++}`;
        const occurrenceKey = roleNameKey(role, rawName);
        const occurrenceIndex = ctx.occurrenceCounts.get(occurrenceKey) || 0;
        ctx.occurrenceCounts.set(occurrenceKey, occurrenceIndex + 1);
        attrs.push(`ref=${ref}`);
        ctx.refs[ref] = {
            ref, role, name: rawName,
            occurrenceIndex,
            selector: null, framePath: [], shadowPath: [],
            signatureHash: hashElementSignature({ role, name: rawName, depth, path }),
        };
    }
    for (const attr of ['checked', 'disabled', 'expanded', 'selected', 'pressed', 'level', 'value']) {
        if (node[attr] !== undefined && node[attr] !== null && node[attr] !== '') {
            attrs.push(`${attr}=${formatAttrValue(node[attr])}`);
        }
    }

    const children = Array.isArray(node.children) ? node.children : [];
    const singleText = ctx.compact ? singleTextChild(node) : null;

    if (role === 'text') return [`${indent}- text: ${quoteAxString(name)}`];

    if (singleText && !name) {
        const renderedText = ctx.redactText ? `[redacted:${hashDoctorField(singleText)}]` : truncateName(singleText);
        return [`${indent}- ${role}: ${quoteAxString(renderedText)}${attrs.length ? ` [${attrs.join(' ')}]` : ''}`];
    }

    const head = `${indent}- ${role}${name ? ` ${quoteAxString(name)}` : ''}${attrs.length ? ` [${attrs.join(' ')}]` : ''}${children.length ? ':' : ''}`;
    const out = [head];
    children.forEach((child, index) => out.push(...serializeNode(child, depth + 1, ctx, [...path, index])));
    return out;
}

function walkAx(node, visit, depth = 0, path = []) {
    if (!node) return;
    visit(node, depth, path);
    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach((child, index) => walkAx(child, visit, depth + 1, [...path, index]));
}

function isInteractiveNode(node) {
    if (!node?.role) return false;
    if (DEFAULT_INTERACTIVE_ROLES.has(String(node.role))) return true;
    return node.focused === true || node.focusable === true;
}

function singleTextChild(node) {
    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length !== 1) return null;
    const child = children[0];
    if (child?.role !== 'text' || !child.name) return null;
    return child.name;
}

function truncateName(value, max = DEFAULT_MAX_NAME_CHARS) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

function sanitizeRole(role) {
    return String(role || 'generic').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

function quoteAxString(value) {
    return JSON.stringify(String(value || ''));
}

function formatAttrValue(value) {
    if (typeof value === 'string') return JSON.stringify(truncateName(value, 120));
    return String(value);
}

function hashElementSignature(input) {
    return `sha256:${createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 16)}`;
}

function roleNameKey(role, name) {
    return `${String(role || 'unknown')}\u0000${String(name || '')}`;
}

export function hashDoctorField(value) {
    return `sha256:${createHash('sha256').update(String(value)).digest('hex').slice(0, 12)}`;
}
