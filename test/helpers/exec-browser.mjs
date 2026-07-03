import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScriptRunner } from './exec-script.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const BROWSER_SCRIPT = join(PROJECT_ROOT, 'skills', 'browser', 'browser.mjs');
const runBrowserScript = createScriptRunner(BROWSER_SCRIPT, PROJECT_ROOT);

export async function execBrowser(args = [], options = {}) {
    return runBrowserScript(args, {
        ...options,
        env: {
            AGBROWSE_UPDATE_CHECK: '0',
            ...(options.env || {}),
        },
    });
}

export async function stopBrowserIfRunning(env = {}) {
    await execBrowser(['stop'], { env });
}
