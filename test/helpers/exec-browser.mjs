import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScriptRunner } from './exec-script.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const BROWSER_SCRIPT = join(PROJECT_ROOT, 'skills', 'browser', 'browser.mjs');

export const execBrowser = createScriptRunner(BROWSER_SCRIPT, PROJECT_ROOT);

export async function stopBrowserIfRunning(env = {}) {
    await execBrowser(['stop'], { env });
}
