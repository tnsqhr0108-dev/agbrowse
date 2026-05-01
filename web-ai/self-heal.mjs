import { observeProviderTargets, rankTargetCandidates } from './observe-targets.mjs';
import { semanticTargetsForVendor } from './vendor-editor-contract.mjs';
import { isRegistryStale, resolveRef } from './ref-registry.mjs';
import { WebAiError } from './errors.mjs';

export const ResolutionSource = Object.freeze({
    CACHE: 'cache',
    SNAPSHOT_SEMANTIC: 'snapshot-semantic',
    CSS_FALLBACK: 'css-fallback',
    OBSERVE_RANKED: 'observe-ranked',
});

const INTENT_FEATURE = Object.freeze({
    'composer.fill': 'composer',
    'composer.click': 'composer',
    'copy.lastResponse': 'copyButton',
    'modelPicker.open': 'modelPicker',
    'modelPicker.click': 'modelPicker',
    'upload.attach': 'uploadSurface',
    'upload.click': 'uploadSurface',
    'responseFeed.read': 'responseFeed',
    'streaming.check': 'streamingIndicator',
    'stop.click': 'streamingIndicator',
});

export function resolveIntentFeature(intent, featureOverride = null) {
    if (featureOverride) return featureOverride;
    return INTENT_FEATURE[intent] || null;
}

export async function resolveActionTarget(page, ctx) {
    const {
        provider,
        intent,
        actionKind = 'click',
        snapshot = null,
        registry = null,
        cache = null,
        fingerprint = null,
        feature: featureOverride = null,
        semanticTargetOverride = null,
    } = ctx;

    const feature = resolveIntentFeature(intent, featureOverride);
    const allTargets = semanticTargetsForVendor(provider);
    const semanticTarget = semanticTargetOverride || (feature ? allTargets[feature] : null);
    const selectors = semanticTarget?.cssFallbacks || [];
    const attempts = [];

    let urlHost = null;
    try { urlHost = new URL(page.url()).hostname; } catch { /* ignore */ }

    if (cache && typeof cache.get === 'function') {
        const cached = cache.get({ provider, intent, actionKind, urlHost, fingerprint });
        if (cached) {
            const validation = await validateResolvedTarget(page, cached.target, {
                semanticTarget,
                actionKind,
                registry,
            });
            attempts.push({ source: ResolutionSource.CACHE, validation });
            if (validation.ok) {
                return {
                    ok: true,
                    target: { ...cached.target, resolution: ResolutionSource.CACHE },
                    attempts,
                };
            }
        }
    }

    const candidates = await collectTargetCandidates(page, {
        provider,
        feature,
        semanticTarget,
        snapshot,
        registry,
        selectors,
    });

    const ranked = rankTargetCandidates(candidates, {
        expectedRole: semanticTarget?.roles?.[0] || null,
        expectedNames: semanticTarget?.names || [],
    });

    for (const candidate of ranked) {
        const validation = await validateResolvedTarget(page, candidate, {
            semanticTarget,
            actionKind,
            registry,
        });
        attempts.push({
            source: candidate.source,
            ref: candidate.ref || null,
            selector: candidate.selector || null,
            validation,
        });
        if (validation.ok) {
            return {
                ok: true,
                target: { ...candidate, resolution: candidate.source },
                attempts,
            };
        }
    }

    return {
        ok: false,
        errorCode: 'TARGET_UNRESOLVED',
        provider,
        intent,
        actionKind,
        feature,
        required: semanticTarget?.required || false,
        attempts,
    };
}

async function collectTargetCandidates(page, {
    provider,
    feature,
    semanticTarget,
    snapshot,
    registry,
    selectors = [],
}) {
    const candidates = [];

    if (snapshot?.refs && (!registry || !isRegistryStale(registry))) {
        const featureMap = semanticTargetsForVendor(provider);
        const observed = await observeProviderTargets(page, {
            provider,
            featureMap,
            snapshot,
        });
        if (feature && observed[feature]) {
            for (const c of observed[feature]) {
                candidates.push({ ...c, source: c.source || ResolutionSource.OBSERVE_RANKED });
            }
        }
    }

    for (const sel of selectors) {
        if (candidates.some(c => c.selector === sel)) continue;
        const count = await page.locator(sel).count().catch(() => 0);
        if (count > 0) {
            candidates.push({
                source: ResolutionSource.CSS_FALLBACK,
                selector: sel,
                count,
                confidence: count === 1 ? 3 : 1,
            });
        }
    }

    return candidates;
}

export async function validateResolvedTarget(page, target, {
    semanticTarget = null,
    actionKind = 'click',
    registry = null,
} = {}) {
    let selector = target?.selector;

    if (target?.ref && registry) {
        if (isRegistryStale(registry)) {
            return { ok: false, reason: 'ref-stale' };
        }
        try {
            const entry = await resolveRef(page, registry, target.ref, { allowStale: false });
            if (entry.selector) selector = entry.selector;
        } catch {
            return { ok: false, reason: 'ref-invalid' };
        }
    }

    if (!selector) {
        if (target?.ref && target.role && target.name) {
            const roleLocator = page.getByRole(target.role, { name: new RegExp(escapeForRegExp(target.name), 'i') });
            const roleCount = await roleLocator.count().catch(() => 0);
            if (roleCount === 0) return { ok: false, reason: 'role-locator-not-found' };
            const roleEl = roleLocator.first();
            const roleVisible = await roleEl.isVisible().catch(() => false);
            if (!roleVisible) return { ok: false, reason: 'not-visible' };
            if (actionKind === 'fill') {
                const editable = await roleEl.isEditable().catch(() => false);
                if (!editable) return { ok: false, reason: 'not-editable' };
            }
            return { ok: true, resolvedVia: 'role-locator' };
        }
        if (target?.ref) return { ok: false, reason: 'ref-no-selector' };
        return { ok: false, reason: 'missing-selector' };
    }

    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    if (count === 0) return { ok: false, reason: 'not-found' };

    const el = locator.first();
    const visible = await el.isVisible().catch(() => false);
    if (!visible) return { ok: false, reason: 'not-visible' };

    const enabled = await el.isEnabled().catch(() => false);
    if (!enabled) return { ok: false, reason: 'not-enabled' };

    if (actionKind === 'fill') {
        const editable = await el.isEditable().catch(() => false);
        if (!editable) return { ok: false, reason: 'not-editable' };
    }

    if (target.role && target.name) {
        return { ok: true };
    }

    if (semanticTarget?.roles?.length || semanticTarget?.names?.length) {
        const matchesSemantic = await checkSemanticMatch(page, el, semanticTarget);
        if (!matchesSemantic) return { ok: false, reason: 'semantic-mismatch' };
    }

    return { ok: true };
}

async function checkSemanticMatch(page, locator, semanticTarget) {
    try {
        const info = await locator.evaluate(node => {
            const explicitRole = node.getAttribute('role');
            const tag = node.tagName.toLowerCase();
            const isEditable = node.isContentEditable || node.contentEditable === 'true';
            const implicitRole = explicitRole
                || (tag === 'textarea' ? 'textbox'
                    : (tag === 'input' && (!node.type || node.type === 'text') ? 'textbox'
                        : (isEditable ? 'textbox'
                            : (tag === 'button' ? 'button'
                                : (tag === 'a' && node.href ? 'link' : tag)))));
            const label = node.getAttribute('aria-label') || '';
            const labelledById = node.getAttribute('aria-labelledby') || '';
            let labelText = label;
            if (!labelText && labelledById) {
                const ref = node.ownerDocument?.getElementById(labelledById);
                labelText = ref?.textContent?.trim()?.slice(0, 100) || '';
            }
            if (!labelText) labelText = node.textContent?.trim()?.slice(0, 100) || '';
            return { role: implicitRole, label: labelText };
        }).catch(() => ({ role: null, label: '' }));

        if (semanticTarget.excludeNames?.some(p => patternMatches(p, info.label))) {
            return false;
        }

        if (semanticTarget.roles?.length && info.role) {
            if (semanticTarget.roles.some(r => r === info.role)) return true;
        }

        if (semanticTarget.names?.length) {
            return semanticTarget.names.some(p => patternMatches(p, info.label));
        }

        return true;
    } catch {
        return false;
    }
}

function patternMatches(pattern, value) {
    if (!pattern) return false;
    const text = String(value || '');
    if (pattern instanceof RegExp) {
        pattern.lastIndex = 0;
        return pattern.test(text);
    }
    return text.toLowerCase().includes(String(pattern).toLowerCase());
}

export async function locatorForResolvedTarget(page, target, { registry } = {}) {
    if (target.selector) {
        return page.locator(target.selector).first();
    }

    if (target.ref) {
        if (!registry) {
            throw new WebAiError({
                errorCode: 'internal.unhandled',
                stage: 'self-heal',
                retryHint: 'report',
                message: `ref ${target.ref} requires a registry to resolve`,
                evidence: { ref: target.ref },
            });
        }
        const resolved = await resolveRef(page, registry, target.ref, { allowStale: false });
        if (resolved.selector) return page.locator(resolved.selector).first();
        if (resolved.role && resolved.name) {
            return page.getByRole(resolved.role, { name: new RegExp(escapeForRegExp(resolved.name), 'i') }).first();
        }
        throw new WebAiError({
            errorCode: 'internal.unhandled',
            stage: 'self-heal',
            retryHint: 'report',
            message: `ref ${target.ref} resolved but not actionable`,
            evidence: { ref: target.ref, role: resolved.role },
        });
    }

    throw new WebAiError({
        errorCode: 'internal.unhandled',
        stage: 'self-heal',
        retryHint: 'report',
        message: 'target has neither selector nor ref',
        evidence: { target },
    });
}

function escapeForRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
