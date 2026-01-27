<#
.SYNOPSIS
    RedByte Lab Machine Bootstrap Script
    Installs Node.js (LTS), dependencies, and starts the development server.

.DESCRIPTION
    This script is designed for "Lab Machine ready" deployment. 
    It ensures Node.js is installed via Winget, sets up pnpm, installs dependencies, 
    and launches the dev server.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -NoProfile -File .\bootstrap.ps1
#>

$ErrorActionPreference = "Stop"

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "   REDBYTE LAB MACHINE BOOTSTRAP    " -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# 1. Check for Node.js
try {
  $nodeVersion = node --version
  Write-Host "[OK] Node.js found: $nodeVersion" -ForegroundColor Green
}
catch {
  Write-Host "[WARN] Node.js not found. Attempting install via Winget..." -ForegroundColor Yellow
  try {
    winget install -e --id OpenJS.NodeJS.LTS
    # Refresh env vars in current session is tricky, manual restart might be needed
    Write-Host "[INFO] Node.js installed. Please restart PowerShell and run this script again." -ForegroundColor Cyan
    exit 0
  }
  catch {
    Write-Host "[ERR] Failed to install Node.js via Winget. Please install manually from nodejs.org." -ForegroundColor Red
    exit 1
  }
}

# 2. Check for PNPM (via Corepack)
try {
  $pnpmVersion = pnpm --version
  Write-Host "[OK] PNPM found: $pnpmVersion" -ForegroundColor Green
}
catch {
  Write-Host "[INFO] Enabling Corepack to activate PNPM..." -ForegroundColor Yellow
  try {
    # Corepack comes with modern Node
    Enable-Corepack
    Write-Host "[OK] Corepack enabled." -ForegroundColor Green
  }
  catch {
    # Fallback if corepack not in path (older node?)
    Write-Host "[WARN] Corepack not found. Installing pnpm via npm..." -ForegroundColor Yellow
    npm install -g pnpm
  }
}

# 3. Install Dependencies
if (Test-Path "package.json") {
  Write-Host "[INFO] Installing dependencies (this may take a minute)..." -ForegroundColor Cyan
  pnpm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERR] Dependency install failed." -ForegroundColor Red
    exit 1
  }
  Write-Host "[OK] Dependencies installed." -ForegroundColor Green
}
else {
  Write-Host "[ERR] package.json not found in current directory." -ForegroundColor Red
  exit 1
}

# 4. Start Dev Server
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "   STARTING REDBYTE DEVELOPMENT     " -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray

# Use a separate window or blocking call? User said "boots local dev".
# We'll just run it.
pnpm dev

