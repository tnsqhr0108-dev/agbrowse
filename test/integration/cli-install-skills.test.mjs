import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execBrowser } from '../helpers/exec-browser.mjs';

function makeTarget() {
    return mkdtempSync(join(tmpdir(), 'agbrowse-cli-skills-'));
}

describe('CLI install-skills', () => {
    it('lists bundled skills through the agent-first skills namespace', async () => {
        const result = await execBrowser(['skills', 'list']);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('browser');
        expect(result.stdout).toContain('web-ai');
        expect(result.stdout).toContain('vision-click');
    });

    it('prints the core guide through the agent-first skills namespace', async () => {
        const result = await execBrowser(['skills', 'get', 'core']);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('agbrowse Core Guide');
        expect(result.stdout).toContain('Decision Loop');
    });

    it('prints bundled skill paths through the agent-first skills namespace', async () => {
        const result = await execBrowser(['skills', 'path', 'web-ai']);

        expect(result.code).toBe(0);
        expect(result.stdout.trim()).toMatch(/skills\/web-ai$/);
    });

    it('shows install help without requiring a target', async () => {
        const result = await execBrowser(['install-skills', '--help']);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('agbrowse install-skills --target <skills-dir>');
    });

    it('installs bundled skills into an explicit target directory', async () => {
        const target = makeTarget();
        try {
            const result = await execBrowser(['install-skills', '--target', target, '--json']);

            expect(result.code).toBe(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed.mode).toBe('copy');
            expect(parsed.installed.map(item => item.name)).toEqual(['browser', 'web-ai', 'vision-click']);
            expect(existsSync(join(target, 'browser', 'SKILL.md'))).toBe(true);
            expect(existsSync(join(target, 'web-ai', 'SKILL.md'))).toBe(true);
            expect(existsSync(join(target, 'vision-click', 'SKILL.md'))).toBe(true);
        } finally {
            rmSync(target, { recursive: true, force: true });
        }
    });

    it('installs bundled skills through skills install', async () => {
        const target = makeTarget();
        try {
            const result = await execBrowser(['skills', 'install', '--target', target, '--json']);

            expect(result.code).toBe(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed.installed.map(item => item.name)).toEqual(['browser', 'web-ai', 'vision-click']);
            expect(existsSync(join(target, 'browser', 'SKILL.md'))).toBe(true);
        } finally {
            rmSync(target, { recursive: true, force: true });
        }
    });
});
