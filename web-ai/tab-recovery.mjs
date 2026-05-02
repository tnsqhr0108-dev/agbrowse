import { createTab, switchToTab } from '../skills/browser/tab-manager.mjs';
import { updateSession, getSession, incrementRecoveryCount } from './session.mjs';

/**
 * Recover a session's tab
 * @param {Object} deps - Dependencies { getPort, getPage }
 * @param {Object} session - Session record
 * @returns {Promise<{recovered: boolean, strategy, targetId}>}
 */
export async function recoverSessionTab(deps, session) {
    if (!session) throw new Error('recoverSessionTab: session required');
    
    const port = deps.getPort();
    
    // 1. Check if original tab exists
    try {
        const tabs = await listTabs(port);
        const existing = tabs.find(t => t.id === session.targetId);
        
        if (existing) {
            // Tab exists - verify URL
            if (existing.url !== session.conversationUrl) {
                // Navigate to correct URL
                const page = await deps.getPage();
                await page.goto(session.conversationUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
            }
            
            // Switch to it
            await switchToTab(port, session.targetId);
            
            return {
                recovered: true,
                strategy: 'existing-tab',
                targetId: session.targetId
            };
        }
    } catch (error) {
        // Tab doesn't exist, continue to create new
    }
    
    // 2. Create new tab
    const newTab = await createTab(port, session.conversationUrl || 'about:blank');
    
    // 3. Update session binding
    await updateSession(session.sessionId, {
        targetId: newTab.targetId,
        tabState: {
            ...session.tabState,
            recoveryCount: (session.tabState?.recoveryCount || 0) + 1,
            lastActiveAt: new Date().toISOString(),
        }
    });
    
    return {
        recovered: true,
        strategy: 'new-tab',
        targetId: newTab.targetId
    };
}

/**
 * Verify session tab is still valid
 * @param {Object} deps - Dependencies
 * @param {Object} session - Session record
 * @returns {Promise<{valid: boolean, targetId, needsRecovery}>}
 */
export async function verifySessionTab(deps, session) {
    if (!session?.targetId) {
        return { valid: false, needsRecovery: true };
    }
    
    try {
        const tabs = await listTabs(deps.getPort());
        const exists = tabs.some(t => t.id === session.targetId);
        
        if (exists) {
            return { valid: true, targetId: session.targetId, needsRecovery: false };
        }
    } catch {
        // Error listing tabs
    }
    
    return { valid: false, targetId: session.targetId, needsRecovery: true };
}

async function listTabs(port) {
    const resp = await fetch(`http://127.0.0.1:${port}/json/list`);
    return (await resp.json()).filter(t => t.type === 'page');
}
