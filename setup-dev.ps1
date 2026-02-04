# setup-dev.ps1 - Install dependencies for RedByte OS Genesis

$ErrorActionPreference = "Stop"

Write-Host "=== RedByte OS Genesis - Dev Setup ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue

if (-not $nodeCommand) {
    Write-Host "ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js first:" -ForegroundColor Yellow
    Write-Host "  Option 1: Download from https://nodejs.org/" -ForegroundColor White
    Write-Host "  Option 2: Run 'winget install OpenJS.NodeJS.LTS'" -ForegroundColor White
    Write-Host ""
    exit 1
}

$nodeVersion = node --version
Write-Host "Node.js found: $nodeVersion" -ForegroundColor Green

Write-Host "Checking pnpm installation..." -ForegroundColor Yellow
$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue

if (-not $pnpmCommand) {
    Write-Host "Installing pnpm globally..." -ForegroundColor Yellow
    npm install -g pnpm
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install pnpm" -ForegroundColor Red
        exit 1
    }
    Write-Host "pnpm installed" -ForegroundColor Green
} else {
    $pnpmVersion = pnpm --version
    Write-Host "pnpm found: $pnpmVersion" -ForegroundColor Green
}

Write-Host ""
Write-Host "Installing project dependencies..." -ForegroundColor Yellow
pnpm install

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "You can now run:" -ForegroundColor Cyan
Write-Host "  pnpm dev   - Start development server" -ForegroundColor White
Write-Host "  pnpm test  - Run tests" -ForegroundColor White
Write-Host "  pnpm build - Build project" -ForegroundColor White
Write-Host ""
