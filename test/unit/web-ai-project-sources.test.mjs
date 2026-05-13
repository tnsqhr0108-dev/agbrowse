import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    addProjectSource,
    buildProjectSourcesListExpression,
    buildProjectSourcesUploadEvidenceExpression,
    validateProjectSourceFiles,
    validateProjectSourcesUrl,
} from '../../web-ai/chatgpt-project-sources.mjs';

let tmpDir;

afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
});

describe('ChatGPT Project Sources helpers', () => {
    it('requires an explicit ChatGPT project URL', () => {
        expect(validateProjectSourcesUrl('https://chatgpt.com/g/project_123').ok).toBe(true);
        expect(validateProjectSourcesUrl('https://chatgpt.com/').ok).toBe(false);
        expect(validateProjectSourcesUrl('https://example.com/g/project_123').ok).toBe(false);
    });

    it('validates real regular files for dry-run without CDP', async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'agbrowse-project-sources-'));
        const file = join(tmpDir, 'source.txt');
        writeFileSync(file, 'source');

        const validated = validateProjectSourceFiles([file], { maxFileSize: 100 });
        expect(validated.errors).toEqual([]);
        expect(validated.valid[0]).toMatchObject({ name: 'source.txt', size: 6 });

        const result = await addProjectSource(null, {
            projectUrl: 'https://chatgpt.com/g/project_123',
            filePaths: [file],
            dryRun: true,
        });
        expect(result.ok).toBe(true);
        expect(result.uploads).toEqual([{ name: 'source.txt', type: 'file', uploaded: false }]);
        expect(result.warnings).toContain('dry-run-no-upload');
    });

    it('builds DOM expressions for source rows and upload evidence', () => {
        expect(buildProjectSourcesListExpression()).toContain('project-source-item');
        const evidence = buildProjectSourcesUploadEvidenceExpression(['source.txt']);
        expect(evidence).toContain('source.txt');
        expect(evidence).toContain('inputFileCount');
    });
});
