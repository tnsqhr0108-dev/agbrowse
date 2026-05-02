export function scrubTargetForTrace(target) {
    if (!target) return null;
    return {
        resolution: target.resolution || null,
        source: target.source || null,
        ref: target.ref || null,
        selector: target.selector || null,
        role: target.role || null,
    };
}

export async function assertPostAction(page, action, target, options = {}) {
    switch (action) {
        case 'fill': {
            const locator = page.locator(target.selector);
            const inputValue = typeof locator.inputValue === 'function'
                ? await locator.inputValue().catch(() => null)
                : null;
            const value = inputValue ?? await locator.evaluate(el => el.textContent || el.value || '').catch(() => '');
            const expected = options.expectedValue;
            if (expected && value !== expected) {
                return { ok: false, reason: 'value-mismatch', expected, actual: value };
            }
            return { ok: true };
        }
        case 'click': {
            if (options.expectElementVisible) {
                const visible = await page.locator(options.expectElementVisible).isVisible().catch(() => false);
                if (!visible) return { ok: false, reason: 'expected-element-not-visible' };
            }
            return { ok: true };
        }
        default:
            return { ok: true };
    }
}

export async function clickWithPostAssert(page, locator, resolvedTarget, traceCtx, options = {}) {
    const beforeUrl = page.url();
    
    try {
        await locator.click();
    } catch (err) {
        if (traceCtx) traceCtx.record({ action: 'click', target: scrubTargetForTrace(resolvedTarget), status: 'error', errorCode: err.name });
        throw err;
    }
    
    if (options.expectUrlChange) {
        try {
            await page.waitForURL(url => String(url) !== beforeUrl, { timeout: options.timeoutMs ?? 3000 });
        } catch {
            const afterUrl = page.url();
            if (afterUrl === beforeUrl) {
                const failure = { ok: false, reason: 'url-unchanged', beforeUrl, afterUrl };
                if (traceCtx) traceCtx.record({ action: 'click', target: scrubTargetForTrace(resolvedTarget), status: 'false-heal', error: failure });
                return failure;
            }
        }
    }
    
    const assertion = await assertPostAction(page, 'click', resolvedTarget, options);
    if (!assertion.ok) {
        if (traceCtx) traceCtx.record({ action: 'click', target: scrubTargetForTrace(resolvedTarget), status: 'false-heal', error: assertion });
        return assertion;
    }
    
    if (traceCtx) traceCtx.record({ action: 'click', target: scrubTargetForTrace(resolvedTarget), status: 'ok' });
    return { ok: true };
}

export async function fillWithPostAssert(page, locator, resolvedTarget, value, traceCtx, options = {}) {
    try {
        await locator.fill(value);
    } catch (fillErr) {
        const role = resolvedTarget.role || '';
        const isContentEditable = role === 'textbox' || resolvedTarget.contentEditable;
        if (isContentEditable) {
            try {
                await locator.click();
                const focused = await page.evaluate((sel) => {
                    const target = sel ? document.querySelector(sel) : null;
                    if (!target) return false;
                    return document.activeElement === target || target.contains(document.activeElement);
                }, resolvedTarget.selector || null).catch(() => false);
                if (!focused) {
                    if (traceCtx) traceCtx.record({ action: 'fill', target: scrubTargetForTrace(resolvedTarget), status: 'error', errorCode: 'focus-mismatch' });
                    throw fillErr;
                }
                const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
                await page.keyboard.press(`${mod}+a`);
                await page.keyboard.insertText(value);
            } catch (kbErr) {
                if (traceCtx) traceCtx.record({ action: 'fill', target: scrubTargetForTrace(resolvedTarget), status: 'error', errorCode: kbErr.name });
                throw kbErr;
            }
        } else {
            if (traceCtx) traceCtx.record({ action: 'fill', target: scrubTargetForTrace(resolvedTarget), status: 'error', errorCode: fillErr.name });
            throw fillErr;
        }
    }
    
    const assertion = await assertPostAction(page, 'fill', resolvedTarget, { expectedValue: value });
    if (!assertion.ok) {
        if (traceCtx) traceCtx.record({ action: 'fill', target: scrubTargetForTrace(resolvedTarget), status: 'false-heal', error: assertion });
        return assertion;
    }
    
    if (traceCtx) traceCtx.record({ action: 'fill', target: scrubTargetForTrace(resolvedTarget), status: 'ok' });
    return { ok: true };
}
