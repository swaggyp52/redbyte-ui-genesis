[CmdletBinding()]
param(
  [switch]$AllowDirty,
  [switch]$SkipInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

. (Join-Path $PSScriptRoot "common.ps1")

$RepoRoot = Resolve-RedByteRepoRoot -StartPath $PSScriptRoot
Set-Location -LiteralPath $RepoRoot

try {
  Write-Host "RedByte ECE141 update" -ForegroundColor Cyan
  Write-Host "Repo: $RepoRoot" -ForegroundColor DarkGray

  if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot ".git"))) {
    Write-RbWarn "This looks like a zip distribution, not a Git clone."
    Write-Host "For a zip distribution, download the new course ZIP, extract it into a new folder, then move only your own saved project exports." -ForegroundColor Yellow
    Write-Host "Do not merge source folders by hand." -ForegroundColor Yellow
    exit 0
  }

  if (-not (Test-RbCommand "git")) {
    throw "Git was not found. Install Git or use the ZIP replacement path."
  }

  $status = git status --porcelain
  if ($status -and -not $AllowDirty) {
    throw "Local changes are present. Commit/stash them or rerun with -AllowDirty if a professor told you to."
  }
  if ($status) {
    Write-RbWarn "Local changes are present; continuing because -AllowDirty was supplied."
  }

  Write-RbSection "Updating Git clone"
  Invoke-RbNative -File "git" -Arguments @("fetch", "origin", "--prune") -Display "git fetch origin --prune"
  Invoke-RbNative -File "git" -Arguments @("checkout", "main") -Display "git checkout main"
  Invoke-RbNative -File "git" -Arguments @("pull", "--ff-only", "origin", "main") -Display "git pull --ff-only origin main"
  Write-RbPass "Source is updated from origin/main."

  if ($SkipInstall) {
    Write-RbWarn "Skipped pnpm install --frozen-lockfile because -SkipInstall was supplied."
  }
  else {
    $null = Ensure-RbPnpmOrThrow
    Write-RbSection "Dependencies"
    Write-Host "Running pnpm install --frozen-lockfile"
    Invoke-RbPnpm -Arguments @("install", "--frozen-lockfile") -Display "pnpm install --frozen-lockfile"
    Write-RbPass "Dependencies are updated."
  }

  Write-Host "Next: .\launch.ps1" -ForegroundColor Green
  exit 0
}
catch {
  Write-RbFail $_.Exception.Message
  exit 1
}
