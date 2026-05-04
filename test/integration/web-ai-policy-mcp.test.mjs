import { describe, expect, it, vi } from 'vitest';
import { handleMcpMessage } from '../../web-ai/mcp-server.mjs';

describe('web-ai policy MCP', () => {
    it('denies copy markdown clipboard read before touching page', async () => {
        const deps = { getPage: vi.fn(() => { throw new Error('browser should not be touched'); }) };
        const response = await handleMcpMessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: 'web_ai_copy_markdown', arguments: { provider: 'chatgpt' } },
        }, deps, {});
        expect(response.result.isError).toBe(true);
        expect(response.result.content[0].text).toContain('clipboard read denied');
        expect(deps.getPage).not.toHaveBeenCalled();
    });

    it('allows copy markdown policy path when explicitly unsafe-allowed', async () => {
        const deps = { getPage: vi.fn(() => { throw new Error('browser reached after policy pass'); }) };
        const response = await handleMcpMessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: 'web_ai_copy_markdown',
                arguments: { provider: 'chatgpt', unsafeAllow: ['clipboard-read'] },
            },
        }, deps, {});
        expect(response.result.isError).toBe(true);
        expect(response.result.content[0].text).toContain('browser reached after policy pass');
        expect(deps.getPage).toHaveBeenCalled();
    });

    it('enforces denied provider default origin before touching page', async () => {
        const deps = { getPage: vi.fn(() => { throw new Error('browser should not be touched'); }) };
        const response = await handleMcpMessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: 'web_ai_copy_markdown',
                arguments: {
                    provider: 'chatgpt',
                    unsafeAllow: ['clipboard-read'],
                    policy: { version: 1, deniedOrigins: ['https://chatgpt.com'] },
                },
            },
        }, deps, {});
        expect(response.result.isError).toBe(true);
        expect(response.result.content[0].text).toContain('origin denied');
        expect(deps.getPage).not.toHaveBeenCalled();
    });

    it('enforces denied snapshot origin for copy and submit before touching page', async () => {
        const state = {
            latestSnapshot: {
                snapshotId: 'snap-1',
                url: 'https://evil.test/page',
                refs: {},
            },
        };
        const deps = { getPage: vi.fn(() => { throw new Error('browser should not be touched'); }) };
        const policy = { version: 1, deniedOrigins: ['https://evil.test'] };
        const copyResponse = await handleMcpMessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: 'web_ai_copy_markdown',
                arguments: { provider: 'chatgpt', unsafeAllow: ['clipboard-read'], policy },
            },
        }, deps, state);
        const submitResponse = await handleMcpMessage({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
                name: 'web_ai_submit_prompt',
                arguments: { provider: 'chatgpt', prompt: 'hello', inlineOnly: true, policy },
            },
        }, deps, state);
        expect(copyResponse.result.isError).toBe(true);
        expect(copyResponse.result.content[0].text).toContain('origin denied');
        expect(submitResponse.result.isError).toBe(true);
        expect(submitResponse.result.content[0].text).toContain('origin denied');
        expect(deps.getPage).not.toHaveBeenCalled();
    });

    it('uses snapshot origin over caller-supplied url for snapshot actions', async () => {
        const state = {
            latestSnapshot: {
                snapshotId: 'snap-1',
                url: 'https://evil.test/page',
                refs: {},
            },
        };
        const deps = { getPage: vi.fn(() => { throw new Error('browser should not be touched'); }) };
        const response = await handleMcpMessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: 'web_ai_copy_markdown',
                arguments: {
                    provider: 'chatgpt',
                    url: 'https://chatgpt.com/',
                    unsafeAllow: ['clipboard-read'],
                    policy: { version: 1, deniedOrigins: ['https://evil.test'] },
                },
            },
        }, deps, state);
        expect(response.result.isError).toBe(true);
        expect(response.result.content[0].text).toContain('origin denied');
        expect(deps.getPage).not.toHaveBeenCalled();
    });

    it('rejects invalid inline MCP policy before defaulting', async () => {
        const deps = { getPage: vi.fn(() => { throw new Error('browser should not be touched'); }) };
        const response = await handleMcpMessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: 'web_ai_copy_markdown',
                arguments: { provider: 'chatgpt', policy: null },
            },
        }, deps, {});
        expect(response.result.isError).toBe(true);
        expect(response.result.content[0].text).toContain('MCP policy must be an inline policy object');
        expect(deps.getPage).not.toHaveBeenCalled();
    });

    it('checks actual current page origin for copy when no snapshot exists', async () => {
        const page = { url: () => 'https://evil.test/current' };
        const deps = { getPage: vi.fn(() => page) };
        const response = await handleMcpMessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: 'web_ai_copy_markdown',
                arguments: {
                    provider: 'chatgpt',
                    url: 'https://chatgpt.com/',
                    unsafeAllow: ['clipboard-read'],
                    policy: { version: 1, deniedOrigins: ['https://evil.test'] },
                },
            },
        }, deps, {});
        expect(response.result.isError).toBe(true);
        expect(response.result.content[0].text).toContain('origin denied');
        expect(deps.getPage).toHaveBeenCalledOnce();
    });

    it('checks actual current page origin for copy even when snapshot origin is allowed', async () => {
        const state = {
            latestSnapshot: {
                snapshotId: 'snap-1',
                url: 'https://chatgpt.com/c/allowed',
                refs: {},
            },
        };
        const page = { url: () => 'https://evil.test/current' };
        const deps = { getPage: vi.fn(() => page) };
        const response = await handleMcpMessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: 'web_ai_copy_markdown',
                arguments: {
                    provider: 'chatgpt',
                    unsafeAllow: ['clipboard-read'],
                    policy: { version: 1, deniedOrigins: ['https://evil.test'] },
                },
            },
        }, deps, state);
        expect(response.result.isError).toBe(true);
        expect(response.result.content[0].text).toContain('origin denied');
        expect(deps.getPage).toHaveBeenCalledOnce();
    });
});
