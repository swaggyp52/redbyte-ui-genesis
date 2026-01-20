# RedByte FPGA MVP bootstrap script (Windows)
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RequiredNodeVersion = "20.19.0"
$RequiredPnpmVersion = "10.24.0"
$RequiredVivadoVersion = "2024.1"
$RepoUrl = "https://github.com/swaggyp52/redbyte-ui-genesis.git"
$DefaultRepoRef = "fpga-mvp-0.1.0"
$RepoRef = if ($env:RB_GIT_REF) { $env:RB_GIT_REF } else { $DefaultRepoRef }
$RepoDir = Join-Path (Get-Location) "redbyte-ui-genesis"
$ExpectedUiUrl = "http://localhost:5173"

function Write-Section([string]$Text) {
  Write-Host ""
  Write-Host "=== $Text ===" -ForegroundColor Cyan
}

function Write-Ok([string]$Text) {
  Write-Host "  [OK] $Text" -ForegroundColor Green
}

function Write-Fail([string]$Text) {
  Write-Host "  [FAIL] $Text" -ForegroundColor Red
}

function Update-SessionPath {
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath"
}

function Get-NodeVersion {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    return $null
  }
  $raw = (node --version).Trim()
  return $raw.TrimStart("v")
}

function Get-PnpmVersion {
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    return $null
  }
  return (pnpm --version).Trim()
}

function Get-GitVersion {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    return $null
  }
  return (git --version).Trim()
}

function Get-VivadoInfo {
  $vivadoExe = "vivado.bat"
  try {
    $out = & $vivadoExe -version 2>$null
    if ($out -match "Vivado v?([0-9.]+)") {
      return @{ Path = $vivadoExe; Version = $Matches[1] }
    }
  } catch {
    # Not on PATH
  }

  $paths = @(
    "C:\Xilinx\Vivado",
    "D:\Xilinx\Vivado",
    "C:\Program Files\Xilinx\Vivado"
  )
  foreach ($base in $paths) {
    if (-not (Test-Path $base)) { continue }
    $versions = Get-ChildItem -Path $base -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match "^\d+\.\d+" } |
      Sort-Object -Property Name -Descending
    foreach ($version in $versions) {
      $candidate = Join-Path $version.FullName "bin\vivado.bat"
      if (Test-Path $candidate) {
        return @{ Path = $candidate; Version = $version.Name }
      }
    }
  }
  return $null
}

function Require-Installer {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    return "winget"
  }
  if (Get-Command choco -ErrorAction SilentlyContinue) {
    return "choco"
  }
  throw "Neither winget nor choco is installed. Install one package manager first."
}

function Install-Tool {
  param(
    [string]$Name,
    [string]$WingetId,
    [string]$ChocoId,
    [string]$Version = ""
  )

  $installer = Require-Installer
  Write-Host "  Installing $Name via $installer..."

  if ($installer -eq "winget") {
    $args = @("install", "--id", $WingetId, "--exact", "--accept-source-agreements", "--accept-package-agreements", "--silent")
    if ($Version) {
      $args += @("--version", $Version)
    }
    & winget @args | Out-Null
  } else {
    $args = @("install", $ChocoId, "-y", "--no-progress")
    if ($Version) {
      $args += @("--version", $Version)
    }
    & choco @args | Out-Null
  }

  Update-SessionPath
}

Write-Section "Prerequisites"

$gitVersion = Get-GitVersion
if (-not $gitVersion) {
  Install-Tool -Name "Git" -WingetId "Git.Git" -ChocoId "git"
  $gitVersion = Get-GitVersion
}
if (-not $gitVersion) {
  Write-Fail "Git not found after install."
  throw "Git install failed."
}
Write-Ok $gitVersion

$nodeVersion = Get-NodeVersion
if ($nodeVersion -ne $RequiredNodeVersion) {
  Install-Tool -Name "Node.js $RequiredNodeVersion" -WingetId "OpenJS.NodeJS" -ChocoId "nodejs" -Version $RequiredNodeVersion
  $nodeVersion = Get-NodeVersion
}
if ($nodeVersion -ne $RequiredNodeVersion) {
  Write-Fail "Node.js $RequiredNodeVersion required, found '$nodeVersion'."
  throw "Node.js version mismatch."
}
Write-Ok "Node.js v$nodeVersion"

$pnpmVersion = Get-PnpmVersion
if ($pnpmVersion -ne $RequiredPnpmVersion) {
  Install-Tool -Name "pnpm $RequiredPnpmVersion" -WingetId "pnpm.pnpm" -ChocoId "pnpm" -Version $RequiredPnpmVersion
  $pnpmVersion = Get-PnpmVersion
}
if ($pnpmVersion -ne $RequiredPnpmVersion) {
  Write-Fail "pnpm $RequiredPnpmVersion required, found '$pnpmVersion'."
  throw "pnpm version mismatch."
}
Write-Ok "pnpm $pnpmVersion"

$vivado = Get-VivadoInfo
if (-not $vivado) {
  Write-Fail "Vivado $RequiredVivadoVersion not detected."
  throw "Install AMD Vivado WebPACK $RequiredVivadoVersion and ensure vivado.bat is on PATH."
}
if (-not ($vivado.Version -like "$RequiredVivadoVersion*")) {
  Write-Fail "Vivado $RequiredVivadoVersion required, found '$($vivado.Version)'."
  throw "Vivado version mismatch."
}
Write-Ok "Vivado $($vivado.Version) ($($vivado.Path))"

Write-Section "Repository"

if (-not (Test-Path $RepoDir)) {
  Write-Host "  Cloning $RepoUrl..."
  git clone $RepoUrl $RepoDir | Out-Null
}
if (-not (Test-Path (Join-Path $RepoDir ".git"))) {
  Write-Fail "Target directory exists but is not a git repo: $RepoDir"
  throw "Repo clone failed."
}

Push-Location $RepoDir
try {
  Write-Ok "Using repo ref: $RepoRef"
  $status = git status --porcelain
  if ($status) {
    Write-Fail "Repo has local changes. Clean the directory or clone into a new folder."
    throw "Working tree is not clean."
  }

  $head = (git rev-parse HEAD).Trim()
  if ($head -ne $RepoRef) {
    git fetch --all --tags | Out-Null
    git checkout $RepoRef | Out-Null
  }

  $finalHead = (git rev-parse HEAD).Trim()
  if ($finalHead -ne $RepoRef) {
    Write-Fail "Expected commit $RepoRef but found $finalHead."
    throw "Pinned commit checkout failed."
  }
  Write-Ok "Checked out $RepoRef"
} finally {
  Pop-Location
}

Write-Section "Install and Build"

Push-Location $RepoDir
try {
  Write-Host "  Running: pnpm install --frozen-lockfile"
  pnpm install --frozen-lockfile
  Write-Ok "pnpm install complete"

  Write-Host "  Running: pnpm -r build"
  pnpm -r build
  Write-Ok "Build complete"
} finally {
  Pop-Location
}

Write-Section "Next Steps"
Write-Host "  cd $RepoDir"
Write-Host "  pnpm --filter @redbyte/playground dev"
Write-Host "  Open $ExpectedUiUrl"
Write-Host ""
Write-Host "Expected success output: === BOOTSTRAP COMPLETE ==="
Write-Host "=== BOOTSTRAP COMPLETE ===" -ForegroundColor Green
