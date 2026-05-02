/**
 * Tab Manager — self-contained (no import from browser.mjs to avoid circular deps)
 */

async function loadPlaywright() {
    try {
        return await import('playwright-core');
    } catch (error) {
        if (error?.code === 'ERR_MODULE_NOT_FOUND' || String(error?.message || '').includes('playwright-core')) {
            throw new Error(
                `playwright-core is required.\n` +
                `  Fix: cd <project-root> && npm install playwright-core`
            );
        }
        throw error;
    }
}

async function connectCdp(port) {
    const { chromium } = await loadPlaywright();
    const cdpUrl = `http://127.0.0.1:${port}`;
    const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 10000 });
    return { browser, cdpUrl };
}

async function getActivePage(port) {
    const { browser } = await connectCdp(port);
    const pages = browser.contexts().flatMap(c => c.pages());
    return pages[pages.length - 1] || null;
}

async function getCdpSession(port) {
    const page = await getActivePage(port);
    if (!page) return null;
    return page.context().newCDPSession(page);
}

async function listTabs(port) {
    const resp = await fetch(`http://127.0.0.1:${port}/json/list`);
    return (await resp.json()).filter(t => t.type === 'page');
}

// ─── Tab operations ──────────────────────────────────────

/**
 * Create a new browser tab and optionally navigate to URL
 * @param {number} port - CDP port
 * @param {string} url - Initial URL
 * @param {Object} opts - Options
 * @param {boolean} opts.activate - Switch to new tab immediately (default: true)
 * @returns {Promise<{targetId, url, title}>}
 */
export async function createTab(port, url = 'about:blank', opts = {}) {
    const cdp = await getCdpSession(port);
    if (!cdp) throw new Error('No CDP session available for tab creation');

    try {
        const { targetId } = await cdp.send('Target.createTarget', {
            url,
            newWindow: false,
            background: !opts.activate
        });

        await new Promise(r => setTimeout(r, 100));

        const tabs = await listTabs(port);
        const tab = tabs.find(t => t.id === targetId);

        return {
            targetId,
            url: tab?.url || url,
            title: tab?.title || 'New Tab',
            activated: opts.activate !== false
        };
    } finally {
        await cdp.detach().catch(() => { });
    }
}

/**
 * Close a tab by targetId
 * @param {number} port - CDP port
 * @param {string} targetId - CDP target ID
 * @returns {Promise<{closed: boolean, targetId}>}
 */
export async function closeTab(port, targetId) {
    const cdp = await getCdpSession(port);
    if (!cdp) throw new Error('No CDP session available for tab close');

    try {
        await cdp.send('Target.closeTarget', { targetId });
        return { closed: true, targetId };
    } catch (error) {
        if (error.message?.includes('No target')) {
            return { closed: true, targetId, alreadyClosed: true };
        }
        throw error;
    } finally {
        await cdp.detach().catch(() => { });
    }
}

/**
 * Switch active tab to targetId
 * @param {number} port - CDP port
 * @param {string} targetId - CDP target ID
 * @returns {Promise<{active: boolean, previousTargetId, currentTargetId}>}
 */
export async function switchToTab(port, targetId) {
    const cdp = await getCdpSession(port);
    if (!cdp) throw new Error('No CDP session available for tab switch');

    try {
        const { targetInfo } = await cdp.send('Target.getTargetInfo');
        const previousTargetId = targetInfo?.targetId;

        await cdp.send('Target.activateTarget', { targetId });

        return {
            active: true,
            previousTargetId,
            currentTargetId: targetId
        };
    } finally {
        await cdp.detach().catch(() => { });
    }
}

/**
 * List all managed tabs with metadata
 * @param {number} port - CDP port
 * @returns {Promise<Array<{targetId, url, title, type, attached}>>}
 */
export async function listManagedTabs(port) {
    const tabs = await listTabs(port);
    return tabs.map(t => ({
        targetId: t.id,
        url: t.url,
        title: t.title,
        type: t.type,
        attached: t.attached
    }));
}

/**
 * Get info for a specific tab
 * @param {number} port - CDP port
 * @param {string} targetId - Tab target ID
 * @returns {Promise<{targetId, url, title, type}>}
 */
export async function getTabInfo(port, targetId) {
    const tabs = await listTabs(port);
    const tab = tabs.find(t => t.id === targetId);
    if (!tab) throw new Error(`Tab not found: ${targetId}`);

    return {
        targetId: tab.id,
        url: tab.url,
        title: tab.title,
        type: tab.type
    };
}

/**
 * Check if a tab is still alive
 * @param {number} port - CDP port
 * @param {string} targetId - Tab target ID
 * @returns {Promise<boolean>}
 */
export async function isTabAlive(port, targetId) {
    try {
        const tabs = await listTabs(port);
        return tabs.some(t => t.id === targetId);
    } catch {
        return false;
    }
}

/**
 * Get Playwright page by targetId via CDP
 * @param {number} port - CDP port
 * @param {string} targetId - Tab target ID
 * @returns {Promise<Page|null>}
 */
export async function getPageByTargetId(port, targetId) {
    const { browser } = await connectCdp(port);
    const contexts = browser.contexts();
    for (const context of contexts) {
        for (const page of context.pages()) {
            const session = await context.newCDPSession(page);
            try {
                const { targetInfo } = await session.send('Target.getTargetInfo');
                if (targetInfo.targetId === targetId) {
                    return page;
                }
            } finally {
                await session.detach().catch(() => { });
            }
        }
    }
    return null;
}
