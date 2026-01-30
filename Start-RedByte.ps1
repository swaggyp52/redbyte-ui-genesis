<#
.SYNOPSIS
    One-click launcher for RedByte OS Genesis (Student Edition)
.DESCRIPTION
    Checks environment, installs dependencies, builds, and launches the OS.
    Optional: Starts Bridge Agent for hardware.
#>

Write-Host "🚀 RedByte OS Genesis Launcher" -ForegroundColor Cyan
$ErrorActionPreference = "Stop"

# 1. Check Node
try {
    $nodeVer = node -v
    Write-Host "✅ Node.js detected: $nodeVer" -ForegroundColor Green
} catch {
    Write-Error "❌ Node.js not found. Please install Node.js v20+ (LTS) from https://nodejs.org"
}

# 2. Check pnpm
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️ pnpm not found. Installing via npm..." -ForegroundColor Yellow
    npm install -g pnpm
}
$pnpmVer = pnpm -v
Write-Host "✅ pnpm detected: $pnpmVer" -ForegroundColor Green

# 3. Install Dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies (this may take a minute)..." -ForegroundColor Cyan
    pnpm install --frozen-lockfile
} else {
    Write-Host "✅ Dependencies already installed." -ForegroundColor Gray
}

# 4. Build Core
Write-Host "🔨 Building RedByte Core..." -ForegroundColor Cyan
pnpm build:os

# 5. Launch
Write-Host "🌐 Launching RedByte OS..." -ForegroundColor Green
Write-Host "   Open http://localhost:4173 if browser doesn't start." -ForegroundColor Gray

# Option to start Bridge
$runBridge = Read-Host "🔌 Start Hardware Bridge Agent? (y/N)"
if ($runBridge -match "y") {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "pnpm bridge:dev"
    Write-Host "✅ Bridge Agent starting in new window." -ForegroundColor Green
}

# Start Preview (using fixed script)
pnpm preview
