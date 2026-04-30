import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScriptRunner } from './exec-script.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const SCRIPT = join(PROJECT_ROOT, 'skills', 'vision-click', 'vision-click.mjs');

export const execVisionClick = createScriptRunner(SCRIPT, PROJECT_ROOT);
