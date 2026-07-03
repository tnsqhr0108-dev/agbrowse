import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mutable holder the hoisted mocks read from (vi.mock factories cannot close
// over per-test locals directly).
const mock = { pageUrl: '', created: 0, closed: [] };

vi.mock('../../skills/browser/tab-manager.mjs', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        createTab: async () => { mock.created += 1; return { targetId: 't1' }; },
        waitForPageByTargetId: async () => ({ url: () => mock.pageUrl }),
        closeTab: async (_port, targetId) => { mock.closed.push(targetId); },
    };
});

vi.mock('../../web-ai/navigation-ready.mjs', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, waitForConversationReady: async () => undefined };
});

const SAFE_URL = 'https://chatgpt.com/c/abc123-def';

describe('openConversationInNewTab (35.1 new-tab recovery)', () => {
    beforeEach(() => {
        mock.pageUrl = '';
        mock.created = 0;
        mock.closed = [];
    });

    it('refuses an unsafe target WITHOUT opening a tab', async () => {
        const { openConversationInNewTab } = await import('../../web-ai/tab-recovery.mjs');
        let portCalled = false;
        const deps = { getPort: () => { portCalled = true; return 9222; } };
        const r = await openConversationInNewTab(deps, { conversationUrl: 'https://chatgpt.com/' });
        expect(r).toEqual({ opened: false, reason: 'unsafe-conversation-url' });
        expect(portCalled).toBe(false);
        expect(mock.created).toBe(0);
    });

    it('opens a fresh tab when the safe target loads correctly', async () => {
        const { openConversationInNewTab } = await import('../../web-ai/tab-recovery.mjs');
        mock.pageUrl = SAFE_URL;
        const r = await openConversationInNewTab({ getPort: () => 9222 }, { conversationUrl: SAFE_URL });
        expect(r.opened).toBe(true);
        expect(r.targetId).toBe('t1');
        expect(r.conversationUrl).toBe(SAFE_URL);
        expect(mock.created).toBe(1);
        expect(mock.closed).toEqual([]);
    });

    it('closes the stray tab and fails closed when the loaded URL mismatches', async () => {
        const { openConversationInNewTab } = await import('../../web-ai/tab-recovery.mjs');
        mock.pageUrl = 'https://chatgpt.com/c/some-other-thread';
        const r = await openConversationInNewTab({ getPort: () => 9222 }, { conversationUrl: SAFE_URL });
        expect(r.opened).toBe(false);
        expect(r.reason).toBe('conversation-mismatch');
        expect(mock.closed).toEqual(['t1']);
    });
});
