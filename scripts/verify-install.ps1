# Verify pnpm install does not emit missing-bin warnings

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot\..

Write-Host "=== Verify pnpm install (bin stubs) ===" -ForegroundColor Cyan

$output = pnpm install --frozen-lockfile 2>&1 | Out-String
if ($output -match "Failed to create bin") {
  Write-Host "  [FAIL] pnpm install reported missing bin entries." -ForegroundColor Red
  exit 1
}

Write-Host "  [OK] pnpm install completed without missing bin warnings." -ForegroundColor Green
exit 0
