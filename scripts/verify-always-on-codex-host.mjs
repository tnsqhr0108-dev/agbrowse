#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';

const args = process.argv.slice(2);
let requireService = false;
let headlessSmoke = false;
let smokeUrl = 'https://example.com';
let port = process.env.CDP_PORT || '9223';
let smokePort = process.env.AGBROWSE_SMOKE_PORT || '';

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--require-service') {
    requireService = true;
  } else if (arg === '--headless-smoke') {
    headlessSmoke = true;
  } else if (arg === '--url') {
    smokeUrl = args[index + 1] ?? smokeUrl;
    index += 1;
  } else if (arg === '--port') {
    port = args[index + 1] ?? port;
    index += 1;
  } else if (arg === '--smoke-port') {
    smokePort = args[index + 1] ?? smokePort;
    index += 1;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`Usage: verify-always-on-codex-host.mjs [--require-service] [--headless-smoke] [--url URL] [--port PORT] [--smoke-port PORT]

Checks an always-on Linux/SSH host for AGBROWSE + Codex MCP readiness.
`);
    process.exit(0);
  } else {
    console.error(`Unknown option: ${arg}`);
    process.exit(2);
  }
}

function run(command, commandArgs = [], options = {}) {
  let commandToRun = command;
  let argsToRun = commandArgs;
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(command)) {
    commandToRun = 'cmd.exe';
    argsToRun = ['/d', '/c', 'call', command, ...commandArgs];
  }

  const result = spawnSync(commandToRun, argsToRun, {
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    timeout: options.timeout ?? 30000,
  });
  return {
    status: result.status,
    ok: result.status === 0,
    error: result.error?.message ?? null,
    signal: result.signal ?? null,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function commandExists(command) {
  if (process.platform === 'win32') {
    return run('where.exe', [command]).ok;
  }
  return run('bash', ['-lc', `command -v ${shellQuote(command)} >/dev/null 2>&1`]).ok;
}

function commandPath(command) {
  if (process.platform === 'win32') {
    const result = run('where.exe', [command]);
    return result.ok ? result.stdout.trim().split(/\r?\n/)[0] : null;
  }
  const result = run('bash', ['-lc', `command -v ${shellQuote(command)}`]);
  return result.ok ? result.stdout.trim() : null;
}

function executableFor(command) {
  if (process.platform !== 'win32') return command;
  return (
    commandPath(`${command}.cmd`) ||
    commandPath(`${command}.exe`) ||
    commandPath(command) ||
    command
  );
}

function runTool(command, commandArgs = [], options = {}) {
  return run(executableFor(command), commandArgs, options);
}

const checks = [];

function addCheck(id, ok, details = {}, required = true) {
  checks.push({ id, ok: Boolean(ok), required, details });
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
addCheck('node-18-plus', nodeMajor >= 18, { version: process.version, major: nodeMajor });

for (const command of ['npm', 'git', 'codex', 'agbrowse']) {
  addCheck(`${command}-on-path`, commandExists(command), { path: commandPath(command) });
}

const chromeCandidates = [
  process.env.CHROME_BINARY_PATH,
  commandPath('google-chrome-stable'),
  commandPath('google-chrome'),
  commandPath('chromium'),
  commandPath('chromium-browser'),
].filter(Boolean);
addCheck('browser-binary-present', chromeCandidates.some((candidate) => existsSync(candidate)), {
  candidates: chromeCandidates,
});

if (commandExists('agbrowse')) {
  const help = runTool('agbrowse', ['--help']);
  addCheck('agbrowse-help', help.ok, { stderr: help.stderr.slice(0, 500) });

  const status = runTool('agbrowse', ['status', '--json'], { env: { CDP_PORT: port } });
  let parsedStatus = null;
  let textRunning = null;
  try {
    parsedStatus = JSON.parse(status.stdout);
  } catch {
    const match = status.stdout.match(/running:\s*(true|false)/i);
    if (match) textRunning = match[1].toLowerCase() === 'true';
  }
  addCheck('agbrowse-status-readable', status.ok && (parsedStatus !== null || textRunning !== null), {
    port,
    running: parsedStatus?.running ?? textRunning,
    format: parsedStatus !== null ? 'json' : 'text',
    stderr: status.stderr.slice(0, 500),
  });
}

const codexConfig = process.env.CODEX_CONFIG || join(homedir(), '.codex', 'config.toml');
let mcpConfigured = false;
if (existsSync(codexConfig)) {
  const grepResult = process.platform === 'win32'
    ? run('findstr.exe', ['/C:[mcp_servers.agbrowse_web_ai]', codexConfig])
    : run('grep', ['-F', '[mcp_servers.agbrowse_web_ai]', codexConfig]);
  mcpConfigured = grepResult.ok;
}
addCheck('codex-mcp-configured', mcpConfigured, { codexConfig });

const skillRoot = join(homedir(), '.codex', 'skills');
addCheck('agbrowse-skills-installed', existsSync(join(skillRoot, 'web-ai', 'SKILL.md')) && existsSync(join(skillRoot, 'browser', 'SKILL.md')), {
  skillRoot,
});

if (commandExists('systemctl')) {
  const serviceFile = join(homedir(), '.config', 'systemd', 'user', 'agbrowse-cdp.service');
  const active = runTool('systemctl', ['--user', 'is-active', 'agbrowse-cdp.service']);
  addCheck('agbrowse-systemd-service', active.ok, {
    serviceFile,
    serviceFileExists: existsSync(serviceFile),
    status: active.stdout.trim() || active.stderr.trim(),
  }, requireService);
} else {
  addCheck('systemctl-present', false, {}, requireService);
}

if (headlessSmoke && commandExists('agbrowse')) {
  const effectiveSmokePort = smokePort || (port === '9223' ? '9323' : String(Number(port) + 100 || 9323));
  const smokeHome = process.env.AGBROWSE_SMOKE_HOME || join(tmpdir(), `agbrowse-smoke-${effectiveSmokePort}`);
  const smokeEnv = {
    CDP_PORT: effectiveSmokePort,
    BROWSER_AGENT_HOME: smokeHome,
    CHROME_HEADLESS: '1',
    CHROME_NO_SANDBOX: process.env.CHROME_NO_SANDBOX || '1',
    AGBROWSE_JSON_ERRORS: '1',
  };
  const start = runTool('agbrowse', ['start', '--headless', '--port', effectiveSmokePort], { env: smokeEnv, timeout: 60000 });
  const afterStart = runTool('agbrowse', ['status', '--json'], { env: smokeEnv });
  const navigate = runTool('agbrowse', ['navigate', smokeUrl, '--wait-until', 'domcontentloaded', '--timeout', '60000'], { env: smokeEnv, timeout: 90000 });
  const snapshot = runTool('agbrowse', ['snapshot', '--interactive', '--max-nodes', '40'], { env: smokeEnv, timeout: 90000 });
  const stop = runTool('agbrowse', ['stop'], { env: smokeEnv, timeout: 30000 });
  addCheck('headless-smoke', start.ok && afterStart.ok && navigate.ok && snapshot.ok, {
    url: smokeUrl,
    port: effectiveSmokePort,
    browserAgentHome: smokeHome,
    startStatus: start.status,
    startError: start.error,
    navigateStatus: navigate.status,
    navigateError: navigate.error,
    snapshotStatus: snapshot.status,
    snapshotError: snapshot.error,
    stopStatus: stop.status,
    snapshotPreview: snapshot.stdout.slice(0, 1000),
    stderr: [start.stderr, navigate.stderr, snapshot.stderr].join('\n').slice(0, 1000),
  });
}

const ok = checks.filter((check) => check.required).every((check) => check.ok);
console.log(JSON.stringify({
  ok,
  checkedAt: new Date().toISOString(),
  host: process.env.HOSTNAME || null,
  port,
  requireService,
  headlessSmoke,
  checks,
}, null, 2));

if (!ok) {
  process.exitCode = 1;
}
