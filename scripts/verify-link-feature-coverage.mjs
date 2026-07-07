#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function run(args) {
  const result = spawnSync(process.execPath, ['bin/agbrowse.mjs', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, AGBROWSE_UPDATE_CHECK: '0' },
  });
  return {
    ok: result.status === 0,
    text: `${result.stdout || ''}\n${result.stderr || ''}`,
  };
}

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function hasAll(text, patterns) {
  return patterns.every((pattern) => text.includes(pattern));
}

const help = run(['--help']);
const webAiHelp = run(['web-ai', '--help']);
const packageJson = read('package.json');
const browserSkill = read('skills/browser/SKILL.md');
const webAiSkill = read('skills/web-ai/SKILL.md');
const coverageDoc = read('docs/LINK_FEATURE_COVERAGE.md');

const checks = [
  {
    id: 'install-and-skills',
    ok:
      help.ok &&
      hasAll(help.text, ['skills list', 'skills install', 'browser', 'web-ai', 'vision-click']) &&
      existsSync(join(root, 'skills/browser/SKILL.md')) &&
      existsSync(join(root, 'skills/web-ai/SKILL.md')) &&
      existsSync(join(root, 'skills/vision-click/SKILL.md')),
  },
  {
    id: 'web-ai-general',
    ok:
      webAiHelp.ok &&
      hasAll(webAiHelp.text, ['query', 'send', 'poll', '--vendor <name>', 'chatgpt', 'gemini', 'grok']),
  },
  {
    id: 'web-ai-review-context',
    ok:
      hasAll(webAiHelp.text, ['context-dry-run', '--context-from-files', '--context-transport']) &&
      hasAll(webAiSkill, ['Context Package Upload', 'ChatGPT or Gemini']) &&
      hasAll(coverageDoc, ['1-1 question/review mode', 'context package upload']),
  },
  {
    id: 'web-ai-code-mode',
    ok:
      hasAll(webAiHelp.text, ['code', 'code-extract', '--output-zip', '--multi-zip']) &&
      hasAll(webAiSkill, ['PLAN.md', '00_plan.md', 'ChatGPT-only']),
  },
  {
    id: 'sessions-and-tabs',
    ok:
      hasAll(help.text, ['tabs', 'tab-switch', 'new-tab', 'tab-cleanup']) &&
      hasAll(webAiHelp.text, ['sessions <sub>', '--session <id>', 'watch']),
  },
  {
    id: 'search-mode',
    ok:
      hasAll(help.text, ['research plan', 'research normalize-results', 'research enrich-fetch', 'research browse-plan']) &&
      hasAll(browserSkill, ['Research Planning', 'agbrowse fetch']),
  },
  {
    id: 'web-manipulation',
    ok:
      hasAll(help.text, ['navigate <url>', 'snapshot', 'click <ref>', 'type <ref>', 'evaluate <js>']) &&
      hasAll(browserSkill, ['snapshot --interactive', 'click', 'type']),
  },
  {
    id: 'codex-mcp',
    ok:
      hasAll(webAiHelp.text, ['mcp-server']) &&
      existsSync(join(root, 'scripts/install-codex-mcp-agbrowse.ps1')) &&
      existsSync(join(root, 'scripts/install-codex-mcp-agbrowse.sh')),
  },
  {
    id: 'mobile-free-remote',
    ok:
      existsSync(join(root, '.github/workflows/agbrowse-remote-smoke.yml')) &&
      existsSync(join(root, '.devcontainer/devcontainer.json')) &&
      existsSync(join(root, 'docs/FREE_REMOTE_ALTERNATIVES.md')) &&
      existsSync(join(root, 'docs/MOBILE_CODEX_BRIDGE.md')) &&
      coverageDoc.includes('Mobile Codex bridge'),
  },
  {
    id: 'packaged-support-files',
    ok:
      packageJson.includes('"docs/"') &&
      packageJson.includes('"examples/"') &&
      packageJson.includes('"scripts/bootstrap-codespaces-agbrowse.sh"'),
  },
];

const failed = checks.filter((check) => !check.ok);

const report = {
  ok: failed.length === 0,
  checkedAt: new Date().toISOString(),
  checks,
};

console.log(JSON.stringify(report, null, 2));

if (failed.length) {
  process.exitCode = 1;
}
