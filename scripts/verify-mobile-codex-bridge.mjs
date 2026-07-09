#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function hasAll(text, patterns) {
  return patterns.every((pattern) => text.includes(pattern));
}

const bridgeDoc = read('docs/MOBILE_CODEX_BRIDGE.md');
const remoteDoc = read('docs/CODEX_MCP_REMOTE_MOBILE.md');
const freeDoc = read('docs/FREE_REMOTE_ALTERNATIVES.md');
const alwaysOnDoc = read('docs/ALWAYS_ON_HOST_RUNBOOK.md');
const packageJson = read('package.json');

const checks = [
  {
    id: 'official-codex-cloud',
    ok: hasAll(bridgeDoc, ['https://chatgpt.com/codex', 'connect GitHub', 'PC-off']),
  },
  {
    id: 'mobile-remote-control-host-boundary',
    ok:
      hasAll(bridgeDoc, ['Codex mobile remote control', 'host must stay awake and online']) &&
      hasAll(remoteDoc, ['ChatGPT mobile', 'powered-off computer']),
  },
  {
    id: 'chatgpt-app-mcp-bridge',
    ok:
      hasAll(bridgeDoc, ['ChatGPT App connector', 'HTTPS MCP server', 'start_agbrowse_smoke']) &&
      hasAll(bridgeDoc, ['start_codex_task', 'get_task_status']),
  },
  {
    id: 'agbrowse-remote-smoke-workflow',
    ok:
      existsSync(join(root, '.github/workflows/agbrowse-remote-smoke.yml')) &&
      hasAll(freeDoc, ['GitHub Actions Mobile Trigger', 'AGBROWSE Remote Smoke']),
  },
  {
    id: 'always-on-host-runbook',
    ok:
      existsSync(join(root, 'docs/ALWAYS_ON_HOST_RUNBOOK.md')) &&
      existsSync(join(root, 'scripts/verify-always-on-codex-host.mjs')) &&
      existsSync(join(root, 'scripts/install-agbrowse-systemd-user-service.sh')) &&
      existsSync(join(root, 'scripts/agbrowse-cdp-service-loop.sh')) &&
      hasAll(alwaysOnDoc, ['agbrowse-cdp.service', '--headless-smoke', 'Do not expose the CDP port']),
  },
  {
    id: 'api-key-boundary',
    ok:
      hasAll(bridgeDoc, ['OPENAI_API_KEY', 'No-API-Key Lane']) &&
      hasAll(bridgeDoc, ['ChatGPT web subscription login does not transfer to GitHub-hosted runners']),
  },
  {
    id: 'packaged-doc',
    ok:
      packageJson.includes('"docs/"') &&
      packageJson.includes('"scripts/verify-mobile-codex-bridge.mjs"') &&
      packageJson.includes('"scripts/verify-always-on-codex-host.mjs"'),
  },
];

const failed = checks.filter((check) => !check.ok);

console.log(JSON.stringify({
  ok: failed.length === 0,
  checkedAt: new Date().toISOString(),
  checks,
}, null, 2));

if (failed.length) {
  process.exitCode = 1;
}
