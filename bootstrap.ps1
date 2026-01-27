# bootstrap.ps1
# RedByte repo bootstrap (run from repo root)
# - Installs Node.js LTS via winget if missing
# - Runs node requirements.txt

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Section($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Have-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Ensure-Winget() {
  if (Have-Command "winget") { return $true }
  Write-Host "winget not found." -ForegroundColor Yellow
  Write-Host "Install 'App Installer' from Microsoft Store to enable winget." -ForegroundColor Yellow
  return $false
}

function Ensure-Node() {
  if (Have-Command "node") {
    Write-Host "Node already installed: $(& node -v)" -ForegroundColor Green
    return
  }
  if (-not (Ensure-Winget)) {
    throw "Node.js missing and winget unavailable. Install Node.js LTS, then re-run."
  }
  Write-Host "Installing Node.js LTS via winget..." -ForegroundColor Gray
  & winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements | Out-Host
  $env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  if (-not (Have-Command "node")) {
    throw "Node install completed but 'node' not found in PATH. Restart PowerShell and re-run."
  }
  Write-Host "Node installed: $(& node -v)" -ForegroundColor Green
}

Write-Section "RedByte Bootstrap"

if (-not (Test-Path (Join-Path (Get-Location) "requirements.txt"))) {
  throw "requirements.txt not found. Run this from the repo root."
}

Ensure-Node

Write-Section "Running requirements.txt"
& node .\requirements.txt
