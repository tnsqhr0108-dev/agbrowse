param(
    [string]$ConfigPath = "$env:USERPROFILE\.codex\config.toml",
    [string]$Command = "$env:APPDATA\npm\agbrowse.cmd",
    [string]$CdpPort = "9223",
    [string]$ChromeBinaryPath = "$env:USERPROFILE\.cache\puppeteer\chrome\win64-150.0.7871.24\chrome-win64\chrome.exe",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function ConvertTo-TomlLiteral([string]$Value) {
    return "'" + $Value.Replace("'", "''") + "'"
}

if (-not (Test-Path -LiteralPath $Command)) {
    throw "AGBROWSE command was not found: $Command. Install it first with npm install -g agbrowse."
}

$configDir = Split-Path -Parent $ConfigPath
if (-not $DryRun -and -not (Test-Path -LiteralPath $configDir)) {
    New-Item -ItemType Directory -Path $configDir | Out-Null
}

$existing = ""
if (Test-Path -LiteralPath $ConfigPath) {
    $existing = Get-Content -Raw -LiteralPath $ConfigPath
}

if ($existing -match '(?m)^\[mcp_servers\.agbrowse_web_ai\]\s*$') {
    Write-Output "agbrowse_web_ai MCP server is already configured in $ConfigPath"
    exit 0
}

$lines = @(
    "",
    "[mcp_servers.agbrowse_web_ai]",
    "command = $(ConvertTo-TomlLiteral $Command)",
    'args = ["web-ai", "mcp-server"]',
    "startup_timeout_sec = 20",
    "tool_timeout_sec = 1800",
    "enabled = true",
    "required = false",
    'default_tools_approval_mode = "prompt"',
    "",
    "[mcp_servers.agbrowse_web_ai.env]",
    "CDP_PORT = `"$CdpPort`"",
    'AGBROWSE_JSON_ERRORS = "1"'
)

if ($ChromeBinaryPath -and (Test-Path -LiteralPath $ChromeBinaryPath)) {
    $lines += "CHROME_BINARY_PATH = $(ConvertTo-TomlLiteral $ChromeBinaryPath)"
}

$section = ($lines -join [Environment]::NewLine) + [Environment]::NewLine

if ($DryRun) {
    Write-Output $section
    exit 0
}

Add-Content -LiteralPath $ConfigPath -Value $section -Encoding UTF8
Write-Output "Added agbrowse_web_ai MCP server to $ConfigPath"
Write-Output "Restart Codex or start a new Codex session before expecting the new MCP tools."
