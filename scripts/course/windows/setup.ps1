[CmdletBinding()]
param(
  [switch]$SkipInstall,
  [switch]$NoCorepack
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

. (Join-Path $PSScriptRoot "common.ps1")

$RepoRoot = Resolve-RedByteRepoRoot -StartPath $PSScriptRoot
Set-Location -LiteralPath $RepoRoot

Write-Host "RedByte ECE141 course setup" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot" -ForegroundColor DarkGray

try {
  Write-RbSection "PowerShell"
  if ($PSVersionTable.PSVersion.Major -lt 5) {
    throw "PowerShell 5.1 or newer is required."
  }
  Write-RbPass "PowerShell $($PSVersionTable.PSVersion)"

  Write-RbSection "Node.js"
  $node = Ensure-RbNodeOrThrow
  Write-RbPass $node.Message

  Write-RbSection "pnpm"
  $pnpm = Test-RbPnpm
  if (-not $pnpm.Ok) {
    if ($NoCorepack) {
      throw "$($pnpm.Message) Run Corepack manually or remove -NoCorepack."
    }
    if (-not (Test-RbCommand "corepack")) {
      throw "corepack was not found. Reinstall Node.js 20.19.0 or newer with Corepack enabled."
    }
    Write-RbWarn "pnpm was not ready. Activating pnpm 10.24.0 with corepack."
    Invoke-RbNative -File "corepack" -Arguments @("enable") -Display "corepack enable"
    Invoke-RbNative -File "corepack" -Arguments @("prepare", "pnpm@10.24.0", "--activate") -Display "corepack prepare pnpm@10.24.0 --activate"
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User") + ";" + $env:Path
    $pnpm = Ensure-RbPnpmOrThrow
  }
  else {
    $pnpm = Ensure-RbPnpmOrThrow
  }
  Write-RbPass $pnpm.Message

  Write-RbSection "Dependencies"
  if ($SkipInstall) {
    Write-RbWarn "Skipped pnpm install --frozen-lockfile because -SkipInstall was supplied."
  }
  else {
    Write-Host "Running pnpm install --frozen-lockfile"
    Invoke-RbPnpm -Arguments @("install", "--frozen-lockfile") -Display "pnpm install --frozen-lockfile"
    Write-RbPass "Workspace dependencies are installed."
  }

  Write-RbSection "Hardware"
  Write-RbPass "Vivado is not required for normal app launch."
  Write-RbWarn "Vivado and Basys3 are only needed for downstream hardware build/programming evidence."

  Write-RbSection "Next"
  Write-Host "Run this from the repo root:" -ForegroundColor Green
  Write-Host "  .\launch.ps1" -ForegroundColor Green
  exit 0
}
catch {
  Write-RbFail $_.Exception.Message
  Write-Host "Run .\doctor.ps1 for a fuller environment report." -ForegroundColor Yellow
  exit 1
}
