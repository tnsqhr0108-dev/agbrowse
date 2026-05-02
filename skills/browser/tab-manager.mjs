import { getActivePage, getCdpSession, listTabs } from './browser.mjs';

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
        // Create new target via CDP
        const { targetId } = await cdp.send('Target.createTarget', {
            url,
            newWindow: false,
            background: !opts.activate
        });
        
        // Wait a moment for navigation to start
        await new Promise(r => setTimeout(r, 100));
        
        // Get tab info
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
        // Tab might already be closed
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
        // Get current active target
        const { targetInfo } = await cdp.send('Target.getTargetInfo');
        const previousTargetId = targetInfo?.targetId;
        
        // Activate new target
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
