import { createTab, isTabAlive, getPageByTargetId } from '../skills/browser/tab-manager.mjs';
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

    // 1. Check if original tab still exists
    const alive = await isTabAlive(port, session.targetId);

    if (alive) {
        // Tab exists - verify URL by checking the actual page
        const page = await getPageByTargetId(port, session.targetId);
        if (page) {
            const currentUrl = page.url();
            if (currentUrl !== session.conversationUrl) {
                // Navigate to correct URL
                await page.goto(session.conversationUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
            }
            return {
                recovered: true,
                strategy: 'existing-tab',
                targetId: session.targetId
            };
        }
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

    const alive = await isTabAlive(deps.getPort(), session.targetId);

    if (alive) {
        return { valid: true, targetId: session.targetId, needsRecovery: false };
    }

    return { valid: false, targetId: session.targetId, needsRecovery: true };
}

/**
 * Execute operation with session's bound page
 * GPT Pro recommendation: resolve page directly, don't use active tab routing
 * @param {Object} deps - Dependencies { getPort }
 * @param {string} sessionId - Session ID
 * @param {Function} fn - Callback({ page, targetId, session })
 * @returns {Promise<any>}
 */
export async function withSessionPage(deps, sessionId, fn) {
    const session = getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const port = deps.getPort();

    // Verify tab is alive
    const { valid, needsRecovery } = await verifySessionTab(deps, session);

    if (!valid) {
        if (needsRecovery && session.conversationUrl) {
            const recovery = await recoverSessionTab(deps, session);
            if (!recovery.recovered) {
                throw new Error(`Session ${sessionId} tab recovery failed`);
            }
            // Refresh session after recovery
            const recoveredSession = getSession(sessionId);
            const page = await getPageByTargetId(port, recoveredSession.targetId);
            if (!page) throw new Error(`Session ${sessionId} page not found after recovery`);
            return fn({ page, targetId: recoveredSession.targetId, session: recoveredSession });
        }
        throw new Error(`Session ${sessionId} tab is not valid and cannot be recovered`);
    }

    const page = await getPageByTargetId(port, session.targetId);
    if (!page) throw new Error(`Session ${sessionId} page not found for targetId ${session.targetId}`);

    return fn({ page, targetId: session.targetId, session });
}
