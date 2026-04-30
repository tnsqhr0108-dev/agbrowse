import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function createScriptRunner(scriptPath, rootDir) {
    return async function exec(args = [], options = {}) {
        const env = { ...process.env, ...(options.env || {}) };

        try {
            const result = await execFileAsync('node', [scriptPath, ...args], {
                cwd: rootDir,
                env,
                timeout: options.timeout || 45000,
                maxBuffer: 1024 * 1024,
            });
            return { code: 0, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
        } catch (error) {
            return {
                code: error.status ?? (typeof error.code === 'number' ? error.code : 1),
                stdout: String(error.stdout || '').trim(),
                stderr: String(error.stderr || '').trim(),
            };
        }
    };
}
