param(
    [Parameter(Mandatory = $true)]
    [string]$HostAlias,

    [string]$RemoteDir = "~/agbrowse",
    [string]$RepoUrl = "https://github.com/tnsqhr0108-dev/agbrowse.git",
    [string]$Branch = "main",
    [switch]$InstallChrome,
    [switch]$InstallSystemdService,
    [switch]$SkipAgbrowseInstall,
    [switch]$Verify,
    [switch]$HeadlessSmoke,
    [string]$SmokeUrl = "https://example.com",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Quote-Remote([string]$Value) {
    return "'" + $Value.Replace("'", "'\''") + "'"
}

function Quote-RemotePath([string]$Value) {
    if ($Value -match '^[A-Za-z0-9_./~$-]+$') {
        return $Value
    }
    return Quote-Remote $Value
}

$bootstrapArgs = @()
if ($InstallChrome) {
    $bootstrapArgs += "--install-chrome"
}
if ($SkipAgbrowseInstall) {
    $bootstrapArgs += "--skip-agbrowse-install"
}
if ($InstallSystemdService) {
    $bootstrapArgs += "--install-systemd-service"
}

if ($HeadlessSmoke) {
    $Verify = $true
}

$verifyArgs = @()
if ($InstallSystemdService) {
    $verifyArgs += "--require-service"
}
if ($HeadlessSmoke) {
    $verifyArgs += "--headless-smoke"
    $verifyArgs += "--url"
    $verifyArgs += $SmokeUrl
}

$remoteDirQ = Quote-RemotePath $RemoteDir
$repoUrlQ = Quote-Remote $RepoUrl
$branchQ = Quote-Remote $Branch
$bootstrapArgLine = ($bootstrapArgs | ForEach-Object { Quote-Remote $_ }) -join " "
$verifyArgLine = ($verifyArgs | ForEach-Object { Quote-Remote $_ }) -join " "
$verifyLine = ""
if ($Verify) {
    $verifyLine = "node ./scripts/verify-always-on-codex-host.mjs $verifyArgLine"
}

$remoteScript = @"
set -euo pipefail
need_cmd() {
  if ! command -v "`$1" >/dev/null 2>&1; then
    echo "Missing required command on remote host: `$1" >&2
    exit 1
  fi
}
need_cmd git
need_cmd bash
need_cmd node
need_cmd npm
need_cmd codex
if [ -d $remoteDirQ/.git ]; then
  git -C $remoteDirQ fetch origin $branchQ
  git -C $remoteDirQ checkout $branchQ
  git -C $remoteDirQ pull --ff-only origin $branchQ
else
  git clone --branch $branchQ $repoUrlQ $remoteDirQ
fi
cd $remoteDirQ
bash ./scripts/bootstrap-always-on-codex-host.sh $bootstrapArgLine
$verifyLine
"@

if ($DryRun) {
    Write-Output "ssh $HostAlias <remote-script>"
    Write-Output $remoteScript
    exit 0
}

$remoteScript | & ssh $HostAlias "bash -s"
