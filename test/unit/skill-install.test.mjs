import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
    installBundledSkills,
    isLinkedSkill,
    listBundledSkills,
    parseInstallSkillsArgs,
    readBundledSkill,
    resolveSkillPath,
    runSkillsCli,
} from '../../skills/browser/skill-install.mjs';

function makeTempDir(prefix = 'agbrowse-skill-install-') {
    return mkdtempSync(join(tmpdir(), prefix));
}

describe('skill installer', () => {
    it('requires an explicit target directory', () => {
        expect(() => parseInstallSkillsArgs([])).toThrow(/install-skills --target/);
    });

    it('copies bundled skills into the target root', () => {
        const sourceRoot = join(process.cwd(), 'skills');
        const targetRoot = makeTempDir();
        try {
            const result = installBundledSkills({ sourceRoot, targetRoot });

            expect(result.mode).toBe('copy');
            expect(result.installed.map(item => item.name)).toEqual(['browser', 'web-ai', 'vision-click']);
            expect(existsSync(join(targetRoot, 'browser', 'SKILL.md'))).toBe(true);
            expect(existsSync(join(targetRoot, 'web-ai', 'SKILL.md'))).toBe(true);
            expect(existsSync(join(targetRoot, 'vision-click', 'SKILL.md'))).toBe(true);
        } finally {
            rmSync(targetRoot, { recursive: true, force: true });
        }
    });

    it('refuses to overwrite existing skills unless force is enabled', () => {
        const sourceRoot = join(process.cwd(), 'skills');
        const targetRoot = makeTempDir();
        try {
            installBundledSkills({ sourceRoot, targetRoot });
            expect(() => installBundledSkills({ sourceRoot, targetRoot })).toThrow(/already exists/);

            writeFileSync(join(targetRoot, 'browser', 'local.txt'), 'stale');
            const result = installBundledSkills({ sourceRoot, targetRoot, force: true });
            expect(result.installed).toHaveLength(3);
            expect(existsSync(join(targetRoot, 'browser', 'local.txt'))).toBe(false);
            expect(readFileSync(join(targetRoot, 'browser', 'SKILL.md'), 'utf8')).toContain('browser');
        } finally {
            rmSync(targetRoot, { recursive: true, force: true });
        }
    });

    it('can link skills instead of copying them', () => {
        const sourceRoot = join(process.cwd(), 'skills');
        const targetRoot = makeTempDir();
        try {
            const result = installBundledSkills({ sourceRoot, targetRoot, link: true });

            expect(result.mode).toBe('link');
            expect(isLinkedSkill(join(targetRoot, 'browser'))).toBe(true);
            expect(isLinkedSkill(join(targetRoot, 'web-ai'))).toBe(true);
            expect(isLinkedSkill(join(targetRoot, 'vision-click'))).toBe(true);
        } finally {
            rmSync(targetRoot, { recursive: true, force: true });
        }
    });

    it('lists bundled skills with descriptions and paths', () => {
        const sourceRoot = join(process.cwd(), 'skills');
        const skills = listBundledSkills(sourceRoot);

        expect(skills.map(skill => skill.name)).toEqual(['browser', 'web-ai', 'vision-click']);
        expect(skills.every(skill => skill.available)).toBe(true);
        expect(skills.find(skill => skill.name === 'web-ai').description).toContain('ChatGPT');
    });

    it('prints the core guide and bundled skills for agents', () => {
        const sourceRoot = join(process.cwd(), 'skills');

        expect(readBundledSkill(sourceRoot, 'core')).toContain('Decision Loop');
        expect(readBundledSkill(sourceRoot, 'core', { full: true })).toContain('--- web-ai/SKILL.md ---');
        expect(readBundledSkill(sourceRoot, 'browser')).toContain('browser');
    });

    it('resolves package skill paths explicitly', () => {
        const sourceRoot = join(process.cwd(), 'skills');

        expect(resolveSkillPath(sourceRoot)).toBe(sourceRoot);
        expect(resolveSkillPath(sourceRoot, 'browser')).toBe(join(sourceRoot, 'browser'));
        expect(() => resolveSkillPath(sourceRoot, 'missing')).toThrow(/unknown skill/);
    });

    it('routes agent-first skills commands', () => {
        const sourceRoot = join(process.cwd(), 'skills');

        expect(runSkillsCli(['list'], { sourceRoot }).skills).toHaveLength(3);
        expect(runSkillsCli(['get', 'core'], { sourceRoot }).text).toContain('Decision Loop');
        expect(runSkillsCli(['path', 'web-ai'], { sourceRoot }).text).toBe(join(sourceRoot, 'web-ai'));
    });
});
