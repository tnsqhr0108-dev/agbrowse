import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export function createTempBrowserEnv(prefix = 'agent-browser-test-') {
    const homeDir = mkdtempSync(join(tmpdir(), prefix));
    const env = { BROWSER_AGENT_HOME: homeDir };
    const cleanup = () => rmSync(homeDir, { recursive: true, force: true });
    return { homeDir, env, cleanup };
}

export function readBrowserState(homeDir) {
    const statePath = join(homeDir, 'browser-state.json');
    if (!existsSync(statePath)) return null;
    return JSON.parse(readFileSync(statePath, 'utf8'));
}

export function writeBrowserState(homeDir, state) {
    const statePath = join(homeDir, 'browser-state.json');
    writeFileSync(statePath, JSON.stringify(state, null, 2));
}

export async function getAvailablePort() {
    return await new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : null;
            server.close(error => {
                if (error) reject(error);
                else resolve(String(port));
            });
        });
    });
}
